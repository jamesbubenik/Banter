// ─── Agent Management ────────────────────────────────────────────────────────

let agentsList = [];

async function loadAgents() {
  try {
    agentsList = await fetch('/api/agents').then(r => r.json());
    renderAgentsGrid();
  } catch (err) {
    console.error('Failed to load agents:', err);
  }
}

function agentInitials(name) {
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function renderAgentsGrid() {
  const grid  = document.getElementById('agents-grid');
  const empty = document.getElementById('agents-empty');

  if (!agentsList.length) {
    grid.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';
  grid.innerHTML = agentsList.map(agent => `
    <div class="agent-card" data-id="${agent.id}">
      <div class="agent-card-header">
        <div class="agent-avatar-lg">${escapeHtml(agentInitials(agent.name))}</div>
        <div>
          <div class="agent-card-name">${escapeHtml(agent.name)}</div>
        </div>
      </div>
      ${agent.description ? `<div class="agent-card-desc">${escapeHtml(agent.description)}</div>` : ''}
      <div class="agent-card-model ${agent.model ? '' : 'no-model'}">
        ${agent.model ? escapeHtml(agent.model) : 'Default model'}
      </div>
      <div class="agent-card-actions">
        <button class="btn btn-secondary btn-sm" onclick="openEditAgent('${agent.id}')">Edit</button>
        <button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger);background:var(--danger-dim)" onclick="confirmDeleteAgent('${agent.id}', '${escapeHtml(agent.name)}')">Delete</button>
      </div>
    </div>
  `).join('');
}

// ─── Modal ────────────────────────────────────────────────────────────────────

const overlay    = document.getElementById('agent-modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalError = document.getElementById('modal-error');
let editingAgentId = null;

function openNewAgent() {
  editingAgentId = null;
  modalTitle.textContent = 'New Person';
  document.getElementById('agent-name').value = '';
  document.getElementById('agent-description').value = '';
  document.getElementById('agent-model').value = '';
  document.getElementById('agent-system-prompt').value = '';
  document.getElementById('agent-models-list').style.display = 'none';
  modalError.style.display = 'none';
  overlay.style.display = 'flex';
  document.getElementById('agent-name').focus();
}

function openEditAgent(id) {
  const agent = agentsList.find(a => a.id === id);
  if (!agent) return;
  editingAgentId = id;
  modalTitle.textContent = 'Edit Person';
  document.getElementById('agent-name').value = agent.name;
  document.getElementById('agent-description').value = agent.description || '';
  document.getElementById('agent-model').value = agent.model || '';
  document.getElementById('agent-system-prompt').value = agent.systemPrompt;
  document.getElementById('agent-models-list').style.display = 'none';
  modalError.style.display = 'none';
  overlay.style.display = 'flex';
}

function closeModal() {
  overlay.style.display = 'none';
  editingAgentId = null;
}

async function saveAgentFromModal() {
  const name         = document.getElementById('agent-name').value.trim();
  const description  = document.getElementById('agent-description').value.trim();
  const model        = document.getElementById('agent-model').value.trim();
  const systemPrompt = document.getElementById('agent-system-prompt').value.trim();

  if (!name || !systemPrompt) {
    modalError.textContent = 'Name and System Prompt are required.';
    modalError.style.display = 'block';
    return;
  }

  modalError.style.display = 'none';
  const saveBtn = document.getElementById('modal-save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    const payload = { name, description, model, systemPrompt };
    const url    = editingAgentId ? `/api/agents/${editingAgentId}` : '/api/agents';
    const method = editingAgentId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Save failed');
    }

    closeModal();
    await loadAgents();
  } catch (err) {
    modalError.textContent = err.message;
    modalError.style.display = 'block';
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Person';
  }
}

async function confirmDeleteAgent(id, name) {
  if (!confirm(`Delete person "${name}"?`)) return;
  try {
    await fetch(`/api/agents/${id}`, { method: 'DELETE' });
    await loadAgents();
  } catch (err) {
    alert('Delete failed: ' + err.message);
  }
}

// ─── Model picker in modal ────────────────────────────────────────────────────

document.getElementById('agent-refresh-models-btn').addEventListener('click', async () => {
  const list = document.getElementById('agent-models-list');
  list.style.display = 'block';
  list.innerHTML = '<div class="model-option" style="color:var(--text-muted)">Loading…</div>';

  try {
    const { models } = await fetch('/api/config/models').then(r => r.json());
    if (!models.length) {
      list.innerHTML = '<div class="dropdown-empty">No models found</div>';
      return;
    }
    list.innerHTML = models.map(m => `
      <div class="model-option" data-model="${escapeHtml(m)}">${escapeHtml(m)}</div>
    `).join('');
    list.querySelectorAll('.model-option').forEach(el => {
      el.addEventListener('click', () => {
        document.getElementById('agent-model').value = el.dataset.model;
        list.style.display = 'none';
      });
    });
  } catch {
    list.innerHTML = '<div class="dropdown-empty">Failed to load models</div>';
  }
});

// ─── Wire up buttons ─────────────────────────────────────────────────────────

document.getElementById('new-agent-btn').addEventListener('click', () => window.showVibeCreator());
document.getElementById('new-agent-empty-btn').addEventListener('click', () => window.showVibeCreator());
document.getElementById('modal-close-btn').addEventListener('click', closeModal);
document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
document.getElementById('modal-save-btn').addEventListener('click', saveAgentFromModal);

overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

// ─── Init ─────────────────────────────────────────────────────────────────────

loadAgents();

window.agentsModule = { loadAgents, agentsList: () => agentsList, agentInitials };
