const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../../data/config.json');

const DEFAULTS = {
  baseUrl: 'http://localhost:1234/v1',
  apiKey: 'lm-studio',
  model: '',
  contextWindowTokens: 8192,
  timeoutMs: 120000,
  logLevel: 'error',
};

let _cache = null;

function getConfig() {
  if (_cache) return _cache;
  try {
    _cache = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
  } catch {
    _cache = { ...DEFAULTS };
  }
  return _cache;
}

function saveConfig(updates) {
  _cache = { ...getConfig(), ...updates };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(_cache, null, 2));
  return _cache;
}

module.exports = { getConfig, saveConfig };
