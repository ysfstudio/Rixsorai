// Rixsor backend — serves the app and proxies chat requests to Claude.
// The Anthropic API key never touches the browser: it stays here, read from env.
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.RIXSOR_MODEL || 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are Rixsor (ريكسور), a personal AI assistant. Core personality: smart first, playful second — confident, warm, socially natural, never a stiff corporate chatbot. Match the user's humor: joke back if they joke, stay serious if they're serious, be brief if they're in a hurry, explain fully if they want depth.
Language rule (critical): detect the language/dialect the user just wrote or spoke in and reply in that same language. If they use Iraqi spoken Arabic dialect, reply in Iraqi dialect (not formal MSA). If they use Sorani Kurdish (کوردیی سۆرانی), reply in Sorani Kurdish. If they use English, reply in English. Never switch language unless the user does.
Keep replies conversational plain text (this renders in a chat bubble, not markdown) — no headers, no bullet-point walls unless the user asked for a structured list. Use emoji naturally and sparingly to carry tone, not on every sentence.`;

app.post('/api/chat', async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set on the server. Add it to your .env file.' });
  }
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }
  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages
      })
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data.error?.message || 'Upstream error' });
    }
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();
    res.json({ reply: text || '…' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error contacting Claude.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Rixsor is running → http://localhost:${PORT}`);
});
