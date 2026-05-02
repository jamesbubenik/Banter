const router = require('express').Router();
const { listAgents, getAgent, saveAgent, deleteAgent } = require('../services/agentService');
const logger = require('../services/logger');

router.get('/', (req, res) => {
  const agents = listAgents();
  logger.debug(`GET /agents — returned ${agents.length} agent(s)`);
  res.json(agents);
});

router.get('/:id', (req, res) => {
  const agent = getAgent(req.params.id);
  if (!agent) {
    logger.error(`GET /agents/${req.params.id} — not found`);
    return res.status(404).json({ error: 'Agent not found' });
  }
  logger.debug(`GET /agents/${req.params.id} — found "${agent.name}"`);
  res.json(agent);
});

router.post('/', (req, res) => {
  const { name, systemPrompt } = req.body;
  if (!name || !systemPrompt) {
    logger.error('POST /agents — missing name or systemPrompt');
    return res.status(400).json({ error: 'name and systemPrompt are required' });
  }
  const agent = saveAgent(req.body);
  logger.info(`POST /agents — created "${agent.name}" (${agent.id})`);
  res.status(201).json(agent);
});

router.put('/:id', (req, res) => {
  const existing = getAgent(req.params.id);
  if (!existing) {
    logger.error(`PUT /agents/${req.params.id} — not found`);
    return res.status(404).json({ error: 'Agent not found' });
  }
  const agent = saveAgent({ ...existing, ...req.body, id: req.params.id });
  logger.info(`PUT /agents/${req.params.id} — updated "${agent.name}"`);
  res.json(agent);
});

router.delete('/:id', (req, res) => {
  deleteAgent(req.params.id);
  logger.info(`DELETE /agents/${req.params.id}`);
  res.json({ ok: true });
});

module.exports = router;
