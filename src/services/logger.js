const fs   = require('fs');
const path = require('path');
const { getConfig } = require('./configService');

const LEVELS   = { off: 0, error: 1, info: 2, debug: 3 };
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const LOGS_DIR = path.join(__dirname, '../../logs');

let currentFile = null;
let currentSize = 0;

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function getLogFile() {
  if (!currentFile || currentSize >= MAX_SIZE) {
    ensureLogsDir();
    const stamp = new Date().toISOString()
      .replace('T', '_')
      .replace(/:/g, '-')
      .slice(0, 19);
    currentFile = path.join(LOGS_DIR, `Banter_${stamp}.log`);
    currentSize = 0;
  }
  return currentFile;
}

function writeToFile(line) {
  const data = line + '\n';
  currentSize += Buffer.byteLength(data, 'utf8');
  fs.appendFile(getLogFile(), data, () => {});
}

function level() {
  return LEVELS[getConfig().logLevel] ?? LEVELS.error;
}

function ts() {
  return new Date().toISOString();
}

function log(label, consoleFn, args) {
  const line = `[${ts()}] [${label}] ${args.map(a =>
    typeof a === 'object' ? JSON.stringify(a) : String(a)
  ).join(' ')}`;
  consoleFn(line);
  writeToFile(line);
}

const logger = {
  error: (...args) => { if (level() >= LEVELS.error) log('ERROR', console.error, args); },
  info:  (...args) => { if (level() >= LEVELS.info)  log('INFO ', console.log,   args); },
  debug: (...args) => { if (level() >= LEVELS.debug) log('DEBUG', console.log,   args); },
};

module.exports = logger;
