const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const AGENTS_DIR = path.join(__dirname, '../../agents');

function ensureDir() {
  if (!fs.existsSync(AGENTS_DIR)) fs.mkdirSync(AGENTS_DIR, { recursive: true });
}

function listAgents() {
  ensureDir();
  return fs.readdirSync(AGENTS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(AGENTS_DIR, f), 'utf8')); }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function getAgent(id) {
  ensureDir();
  const file = path.join(AGENTS_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveAgent(data) {
  ensureDir();
  const id = data.id || crypto.randomUUID();
  const now = new Date().toISOString();
  const agent = {
    id,
    name: data.name,
    description: data.description || '',
    systemPrompt: data.systemPrompt,
    model: data.model || '',
    createdAt: data.createdAt || now,
    updatedAt: now,
  };
  fs.writeFileSync(path.join(AGENTS_DIR, `${id}.json`), JSON.stringify(agent, null, 2));
  return agent;
}

function deleteAgent(id) {
  const file = path.join(AGENTS_DIR, `${id}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

module.exports = { listAgents, getAgent, saveAgent, deleteAgent };
