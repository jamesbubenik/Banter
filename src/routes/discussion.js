const router = require('express').Router();
const { getAgent } = require('../services/agentService');
const { getConfig } = require('../services/configService');
const { streamTurn } = require('../services/llmService');
const logger = require('../services/logger');

function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}

function getRollingContextHistory(system, topic, history, otherAgentName, agent, contextWindowTokens) {
  const rollingHistory = history.slice(-6);
  const reservedForResponse = 1024;
  const budget = Math.max(1024, (contextWindowTokens || 8192) - reservedForResponse);
  const baseTokens = estimateTokens(system) + estimateTokens(topic) + estimateTokens(otherAgentName) + 256;
  let remaining = Math.max(0, budget - baseTokens);
  const selected = [];

  for (let i = rollingHistory.length - 1; i >= 0; i--) {
    const entry = rollingHistory[i];
    const label = entry.agentId === agent.id ? `You (${agent.name})` : otherAgentName;
    const cost = estimateTokens(label) + estimateTokens(entry.content) + 16;
    if (selected.length && cost > remaining) break;
    if (!selected.length && cost > remaining) {
      selected.unshift({
        ...entry,
        content: String(entry.content || '').slice(-Math.max(1000, remaining * 4)),
      });
      break;
    }
    selected.unshift(entry);
    remaining -= cost;
  }

  return selected;
}

function buildMessages(agent, topic, history, otherAgentName, contextWindowTokens) {
  const system = [
    agent.systemPrompt,
    '',
    'You are participating in a structured discussion guided by this context:',
    `"${topic}"`,
    `You are speaking with ${otherAgentName}.`,
    'Treat the context as the system-level direction for the conversation.',
    'Keep your response focused, relevant, and conversational - 2 to 4 paragraphs.',
    'Engage directly with the most recent message while continuing the direction set by the context.',
    'If you produce a thinking or reasoning phase, always follow it with a final discussion response.',
    'Write in flowing prose - no bullet points or headers.',
  ].join('\n');

  const msgs = [{ role: 'system', content: system }];

  if (history.length === 0) {
    msgs.push({
      role: 'user',
      content: `Begin the discussion using this context as your guide:\n\n"${topic}"`,
    });
    return msgs;
  }

  const contextHistory = getRollingContextHistory(system, topic, history, otherAgentName, agent, contextWindowTokens);

  // Always use a single user message containing full context so the conversation
  // is always in valid [system, user] format regardless of whose turn it is.
  const transcript = contextHistory.map(entry => {
    const label = entry.agentId === agent.id ? `You (${agent.name})` : otherAgentName;
    return `${label}: ${entry.content}`;
  }).join('\n\n---\n\n');

  const lastEntry = history[history.length - 1];
  const lastSpeaker = lastEntry.agentId === agent.id ? 'you' : otherAgentName;

  msgs.push({
    role: 'user',
    content: `Discussion context:\n"${topic}"\n\nConversation so far:\n\n${transcript}\n\n---\n\nThe last message was by ${lastSpeaker}. Continue the discussion in a way that follows the context.`,
  });

  return msgs;
}

router.post('/turn', async (req, res) => {
  const { topic, history = [], agentId, otherAgentName } = req.body;

  if (!topic || !agentId) {
    logger.error('POST /discussion/turn — missing topic or agentId');
    return res.status(400).json({ error: 'topic and agentId are required' });
  }

  const agent = getAgent(agentId);
  if (!agent) {
    logger.error(`POST /discussion/turn — agent not found: ${agentId}`);
    return res.status(404).json({ error: 'Agent not found' });
  }

  logger.info(`POST /discussion/turn — agent="${agent.name}", turn=${history.length + 1}`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  try {
    const cfg = getConfig();
    const model = agent.model || cfg.model;
    const messages = buildMessages(
      agent,
      topic,
      history,
      otherAgentName || 'the other agent',
      cfg.contextWindowTokens,
    );

    logger.debug(`POST /discussion/turn — model="${model || 'default'}", messages=${messages.length}`);

    let chunkCount = 0;
    await streamTurn({
      messages,
      model,
      onChunk: (event) => {
        if (event.type === 'chunk') chunkCount++;
        send(event);
      },
    });

    logger.info(`POST /discussion/turn — complete, chunks=${chunkCount}`);
    send({ type: 'done' });
  } catch (err) {
    logger.error(`POST /discussion/turn — ${err.message}`);
    send({ type: 'error', message: err.message });
  } finally {
    res.end();
  }
});

router.post('/condense', async (req, res) => {
  const { topic, history = [], agent1Name, agent2Name } = req.body;

  logger.info(`POST /discussion/condense — summarising ${history.length} history entries`);

  const transcript = history.map(e => `${e.agentName}: ${e.content}`).join('\n\n---\n\n');

  const messages = [
    {
      role: 'system',
      content: 'You are a conversation summariser. Write a concise, accurate summary in plain prose — no bullet points or headers.',
    },
    {
      role: 'user',
      content: [
        `Discussion context: "${topic}"`,
        `Participants: ${agent1Name} and ${agent2Name}`,
        '',
        'Conversation so far:',
        '',
        transcript,
        '',
        'Write 2–3 paragraphs summarising the main arguments each participant has made, key points of agreement and disagreement, and where the discussion currently stands. Preserve each participant\'s distinct perspective.',
      ].join('\n'),
    },
  ];

  try {
    const cfg = getConfig();
    let summary = '';
    await streamTurn({
      messages,
      model: cfg.model,
      onChunk: ({ type, content }) => { if (type === 'chunk') summary += content; },
    });
    logger.info(`POST /discussion/condense — summary length=${summary.length}`);
    res.json({ summary });
  } catch (err) {
    logger.error(`POST /discussion/condense — ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports._test = { buildMessages, getRollingContextHistory };
