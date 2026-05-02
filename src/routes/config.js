const router = require('express').Router();
const { getConfig, saveConfig } = require('../services/configService');
const { listModels, checkHealth, loadModel, unloadModel } = require('../services/llmService');
const logger = require('../services/logger');

router.get('/', (req, res) => {
  logger.debug('GET /config');
  res.json(getConfig());
});

router.post('/', async (req, res) => {
  const cfg = saveConfig(req.body);
  logger.info(`POST /config — saved (logLevel=${cfg.logLevel}, model="${cfg.model || 'default'}")`);
  if (cfg.model) {
    try {
      await loadModel(cfg.model);
      logger.info(`POST /config — loaded model "${cfg.model}" into LM Studio`);
    } catch (err) {
      logger.warn(`POST /config — could not load model "${cfg.model}": ${err.message}`);
    }
  }
  res.json(cfg);
});

router.get('/models', async (req, res) => {
  logger.info('GET /config/models — fetching from LM Studio');
  try {
    const models = await listModels();
    logger.info(`GET /config/models — got ${models.length} model(s)`);
    res.json({ models });
  } catch (err) {
    logger.error('GET /config/models —', err.message);
    res.status(502).json({ error: err.message });
  }
});

router.post('/models/unload', async (req, res) => {
  const { modelId } = req.body;
  if (!modelId) return res.status(400).json({ error: 'modelId required' });
  logger.info(`POST /config/models/unload — unloading "${modelId}"`);
  try {
    await unloadModel(modelId);
    logger.info(`POST /config/models/unload — unloaded "${modelId}"`);
    res.json({ ok: true });
  } catch (err) {
    logger.error('POST /config/models/unload —', err.message);
    res.status(502).json({ error: err.message });
  }
});

router.get('/health', async (req, res) => {
  logger.debug('GET /config/health');
  const result = await checkHealth();
  res.json(result);
});

module.exports = router;
