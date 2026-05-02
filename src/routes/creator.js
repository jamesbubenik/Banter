const router = require('express').Router();
const { streamTurn } = require('../services/llmService');
const logger = require('../services/logger');

const SYSTEM = `You are a creative persona designer helping users build AI personas for conversations and discussions.

When the user describes a person they want, engage naturally, help develop the character, and ask clarifying questions if helpful. Suggest a name, a brief description, and a detailed system prompt.

The system prompt you write should:
- Be written in second person ("You are...")
- Define the persona's personality, perspective, communication style, and areas of expertise
- Be 2-4 paragraphs long and richly detailed
- Include specifics about how the persona speaks, what they value, and how they engage

At the end of EVERY response, include a draft in exactly this format (no explanation, just append it):
<draft>{"name":"...","description":"...","systemPrompt":"..."}</draft>

Rules:
- name: Short, memorable name (first name or character name)
- description: One sentence — what makes this persona distinctive
- systemPrompt: Full second-person system prompt for the persona
- Update ALL three fields in every response, even if only one thing changed
- If you lack enough info, make creative suggestions based on what you have`;

router.post('/chat', async (req, res) => {
  const { history = [], message } = req.body;
  if (!message) {
    logger.error('POST /creator/chat — message is required');
    return res.status(400).json({ error: 'message is required' });
  }

  logger.info(`POST /creator/chat — history=${history.length}, message length=${message.length}`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  try {
    const messages = [
      { role: 'system', content: SYSTEM },
      ...history,
      { role: 'user', content: message },
    ];

    logger.debug(`POST /creator/chat — sending ${messages.length} messages to LLM`);

    let fullText = '';
    await streamTurn({
      messages,
      onChunk: ({ type, content }) => {
        if (type === 'chunk') {
          fullText += content;
          send({ type: 'chunk', content });
        }
      },
    });

    const match = fullText.match(/<draft>([\s\S]*?)<\/draft>/);
    if (match) {
      try {
        const draft = JSON.parse(match[1]);
        logger.debug(`POST /creator/chat — draft: name="${draft.name}"`);
        send({ type: 'draft', draft });
      } catch {
        logger.error('POST /creator/chat — failed to parse draft JSON');
      }
    } else {
      logger.debug('POST /creator/chat — no draft block in response');
    }

    logger.info(`POST /creator/chat — complete, response length=${fullText.length}`);
    send({ type: 'done', fullText });
  } catch (err) {
    logger.error(`POST /creator/chat — ${err.message}`);
    send({ type: 'error', message: err.message });
  } finally {
    res.end();
  }
});

module.exports = router;
