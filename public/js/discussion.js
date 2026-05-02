// ─── Discussion Module ────────────────────────────────────────────────────────

const discussionState = {
  running: false,
  topic: '',
  agents: [null, null],   // [agent1, agent2]
  history: [],
  turnIndex: 0,
};

let userScrolled = false;

let timerStart    = null;
let timerInterval = null;

function elapsedString() {
  const secs = Math.floor((Date.now() - timerStart) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const p = n => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}`;
}

function startDiscussionTimer() {
  timerStart = Date.now();
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const el = document.getElementById('discussion-status');
    if (el) el.textContent = `Discussion in progress...  ${elapsedString()}`;
  }, 1000);
}

function stopDiscussionTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  return timerStart ? elapsedString() : null;
}

// ─── Agent Selector Dropdown ──────────────────────────────────────────────────

let activeDropdownSlot = null;

function openAgentDropdown(slot, selectorEl) {
  const agents = window.agentsModule?.agentsList() || [];
  const dropdown = document.getElementById('agent-dropdown');
  const list     = document.getElementById('agent-dropdown-list');

  const otherSlot  = slot === 1 ? 2 : 1;
  const otherAgent = discussionState.agents[otherSlot - 1];

  const available = agents.filter(a => !otherAgent || a.id !== otherAgent.id);

  if (!available.length) {
    list.innerHTML = '<div class="dropdown-empty">No people available. Create people first.</div>';
  } else {
    list.innerHTML = available.map(a => `
      <div class="agent-dropdown-item" data-id="${escapeHtml(a.id)}" data-slot="${slot}">
        <div class="dropdown-avatar">${escapeHtml(agentInitials(a.name))}</div>
        <div>
          <div class="dropdown-name">${escapeHtml(a.name)}</div>
          ${a.description ? `<div class="dropdown-desc">${escapeHtml(a.description)}</div>` : ''}
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.agent-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const agent = available.find(a => a.id === item.dataset.id);
        selectAgent(parseInt(item.dataset.slot), agent);
        closeDropdown();
      });
    });
  }

  const rect = selectorEl.getBoundingClientRect();
  dropdown.style.top    = `${rect.bottom + 4}px`;
  dropdown.style.left   = `${rect.left}px`;
  dropdown.style.width  = `${rect.width}px`;
  dropdown.style.display = 'block';
  activeDropdownSlot = slot;
}

function closeDropdown() {
  document.getElementById('agent-dropdown').style.display = 'none';
  activeDropdownSlot = null;
}

document.addEventListener('click', e => {
  if (!e.target.closest('.agent-selector') && !e.target.closest('#agent-dropdown')) {
    closeDropdown();
  }
});

document.getElementById('agent1-selector').addEventListener('click', function() {
  openAgentDropdown(1, this);
});

document.getElementById('agent2-selector').addEventListener('click', function() {
  openAgentDropdown(2, this);
});

function selectAgent(slot, agent) {
  discussionState.agents[slot - 1] = agent;
  const selectorEl = document.getElementById(`agent${slot}-selector`);

  if (!agent) {
    selectorEl.classList.remove('selected');
    selectorEl.innerHTML = '<div class="agent-selector-placeholder">Select a person</div>';
    return;
  }

  const avatarStyle = slot === 1
    ? 'background:var(--agent1-dim);color:var(--agent1-color);border:1px solid var(--agent1-color)'
    : 'background:var(--agent2-dim);color:var(--agent2-color);border:1px solid var(--agent2-color)';

  selectorEl.classList.add('selected');
  selectorEl.innerHTML = `
    <div class="agent-selector-selected">
      <div class="agent-selector-avatar" style="${avatarStyle}">${escapeHtml(agentInitials(agent.name))}</div>
      <span>${escapeHtml(agent.name)}</span>
    </div>
  `;
}

function refreshDiscussionDropdowns() {
  discussionState.agents.forEach((agent, i) => {
    if (agent) {
      const refreshed = (window.agentsModule?.agentsList() || []).find(a => a.id === agent.id);
      discussionState.agents[i] = refreshed || null;
      if (!refreshed) selectAgent(i + 1, null);
    }
  });
}

window.refreshDiscussionDropdowns = refreshDiscussionDropdowns;

// ─── Start Discussion ─────────────────────────────────────────────────────────

document.getElementById('start-discussion-btn').addEventListener('click', async () => {
  const topic  = document.getElementById('discussion-topic').value.trim();
  const errEl  = document.getElementById('setup-error');
  const [a1, a2] = discussionState.agents;

  errEl.style.display = 'none';

  if (!topic) { showSetupError('Please enter discussion context.'); return; }
  if (!a1)    { showSetupError('Please select Person 1.'); return; }
  if (!a2)    { showSetupError('Please select Person 2.'); return; }
  if (a1.id === a2.id) { showSetupError('Please select two different people.'); return; }

  startDiscussion(topic, a1, a2);
});

function showSetupError(msg) {
  const errEl = document.getElementById('setup-error');
  errEl.textContent = msg;
  errEl.style.display = 'block';
}

// ─── Discussion Arena ─────────────────────────────────────────────────────────

function startDiscussion(topic, agent1, agent2) {
  discussionState.topic     = topic;
  discussionState.agents    = [agent1, agent2];
  discussionState.history   = [];
  discussionState.turnIndex = 0;
  discussionState.running   = true;

  document.getElementById('arena-topic-text').textContent = topic;
  document.getElementById('arena-agent1-badge').textContent = agent1.name;
  document.getElementById('arena-agent2-badge').textContent = agent2.name;
  userScrolled = false;
  document.getElementById('discussion-jump-btn').style.display = 'none';
  document.getElementById('discussion-feed').innerHTML = '';
  document.getElementById('discussion-status').textContent = '';
  document.getElementById('discussion-status').className = 'discussion-status';

  document.getElementById('discussion-setup').style.display = 'none';
  document.getElementById('discussion-arena').style.display = 'flex';

  startDiscussionTimer();
  runTurn();
}

document.getElementById('stop-discussion-btn').addEventListener('click', () => {
  discussionState.running = false;
  const elapsed = stopDiscussionTimer();
  setDiscussionStatus('stopped', `Discussion stopped.  ${elapsed}`);
});

async function runTurn() {
  if (!discussionState.running) return;

  const idx          = discussionState.turnIndex % 2;
  const currentAgent = discussionState.agents[idx];
  const otherAgent   = discussionState.agents[1 - idx];

  const dividerEl = addTurnDivider(discussionState.turnIndex + 1);
  const msgEl     = addMessageBubble(currentAgent, idx === 0 ? 'agent1-msg' : 'agent2-msg', true);

  try {
    const response = await fetch('/api/discussion/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic:          discussionState.topic,
        history:        discussionState.history,
        agentId:        currentAgent.id,
        otherAgentName: otherAgent.name,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const err = new Error(errData.error || `HTTP ${response.status}`);
      if (response.status === 413 || isContextError(err.message)) err.isContextError = true;
      throw err;
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    let reasoning = '';
    let buffer = '';
    let streamError = null;

    // Replace typing indicator with empty content container
    const bubbleEl = msgEl.querySelector('.msg-bubble');
    bubbleEl.innerHTML = `
      <details class="reasoning-panel" style="display:none">
        <summary>Thinking</summary>
        <div class="reasoning-content"></div>
      </details>
      <div class="final-content"></div>
    `;
    const reasoningPanel = bubbleEl.querySelector('.reasoning-panel');
    const reasoningEl = bubbleEl.querySelector('.reasoning-content');
    const finalEl = bubbleEl.querySelector('.final-content');

    const handleStreamLine = (line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) return;
      let obj;
      try { obj = JSON.parse(trimmed.slice(6)); } catch { return; }

      if (obj.type === 'error') {
        const err = new Error(obj.message);
        if (isContextError(obj.message)) err.isContextError = true;
        streamError = err;
        return;
      }
      if (obj.type === 'reasoning' && obj.content) {
        reasoning += obj.content;
        reasoningPanel.style.display = '';
        reasoningEl.textContent = reasoning;
        scrollFeed();
        return;
      }
      if (obj.type === 'chunk' && obj.content) {
        full += obj.content;
        finalEl.textContent = full;
        scrollFeed();
      }
    };

    while (true) {
      if (!discussionState.running) {
        reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        handleStreamLine(line);
        if (streamError) break;
      }

      if (streamError) break;
    }

    if (buffer.trim() && !streamError) handleStreamLine(buffer);
    if (streamError) throw streamError;

    if (!full.trim()) {
      if (reasoning.trim()) {
        throw new Error('LM Studio returned reasoning but no final answer. The model may need a larger token limit or a shorter thinking phase.');
      }
      throw new Error('LM Studio returned no response content.');
    }

    discussionState.history.push({
      agentId:   currentAgent.id,
      agentName: currentAgent.name,
      content:   full,
    });
    discussionState.turnIndex++;

  } catch (err) {
    // Context too large — condense history and retry this turn invisibly
    if (err.isContextError) {
      dividerEl.remove();
      msgEl.remove();
      setDiscussionStatus('running', 'Condensing context…');
      await condenseHistory();
      if (discussionState.running) runTurn();
      return;
    }

    const bubbleEl = msgEl.querySelector('.msg-bubble');
    const finalEl  = msgEl.querySelector('.final-content') || bubbleEl;
    finalEl.textContent = `Error: ${err.message}`;
    bubbleEl.style.borderColor = 'var(--danger)';
    discussionState.running = false;
    const elapsed = stopDiscussionTimer();
    setDiscussionStatus('error', `⚠ Error: ${err.message}  ${elapsed}`);
    return;
  }

  if (discussionState.running) {
    await sleep(800);
    runTurn();
  }
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

function addTurnDivider(turnNum) {
  const feed = document.getElementById('discussion-feed');
  const el = document.createElement('div');
  el.className = 'turn-divider';
  el.textContent = `${formatTimestamp()} - Turn ${turnNum}`;
  feed.appendChild(el);
  scrollFeed();
  return el;
}

function isContextError(msg) {
  const m = (msg || '').toLowerCase();
  return (
    m.includes('413') ||
    m.includes('too large') ||
    m.includes('payloadtoolarge') ||
    (m.includes('context') && m.includes('length')) ||
    (m.includes('token') && m.includes('limit'))
  );
}

async function condenseHistory() {
  const [a1, a2] = discussionState.agents;
  try {
    const res = await fetch('/api/discussion/condense', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic:      discussionState.topic,
        history:    discussionState.history,
        agent1Name: a1.name,
        agent2Name: a2.name,
      }),
    });
    if (!res.ok) throw new Error('Condense request failed');
    const { summary } = await res.json();
    const recent = discussionState.history.slice(-4);
    discussionState.history = [
      { agentId: '__summary__', agentName: 'Discussion Summary', content: summary },
      ...recent,
    ];
  } catch {
    // Fallback: keep only the most recent exchanges
    discussionState.history = discussionState.history.slice(-4);
  }
}

function addMessageBubble(agent, cssClass, showTyping) {
  const feed = document.getElementById('discussion-feed');

  const wrapper = document.createElement('div');
  wrapper.className = `discussion-message ${cssClass}`;

  wrapper.innerHTML = `
    <div class="msg-header">
      <div class="msg-avatar">${escapeHtml(agentInitials(agent.name))}</div>
      <span class="msg-name">${escapeHtml(agent.name)}</span>
    </div>
    <div class="msg-bubble">
      ${showTyping ? `
        <div class="typing-bubble">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      ` : ''}
    </div>
  `;

  feed.appendChild(wrapper);
  scrollFeed();
  return wrapper;
}

function formatTimestamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function scrollFeed() {
  if (userScrolled) return;
  const feed = document.getElementById('discussion-feed');
  feed.scrollTop = feed.scrollHeight;
}

function setDiscussionStatus(type, msg) {
  const el = document.getElementById('discussion-status');
  el.className = `discussion-status ${type}`;
  el.textContent = msg;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Scroll Tracking ─────────────────────────────────────────────────────────

document.getElementById('discussion-feed').addEventListener('scroll', () => {
  const feed = document.getElementById('discussion-feed');
  const atBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
  userScrolled = !atBottom;
  document.getElementById('discussion-jump-btn').style.display = userScrolled ? 'flex' : 'none';
});

document.getElementById('discussion-jump-btn').addEventListener('click', () => {
  userScrolled = false;
  const feed = document.getElementById('discussion-feed');
  feed.scrollTop = feed.scrollHeight;
  document.getElementById('discussion-jump-btn').style.display = 'none';
});

// ─── Back to Setup ────────────────────────────────────────────────────────────

// Allow re-opening setup by re-clicking Discussion nav while stopped
document.querySelector('.nav-item[data-view="discussion"]').addEventListener('click', () => {
  if (!discussionState.running) {
    document.getElementById('discussion-setup').style.display = 'flex';
    document.getElementById('discussion-arena').style.display = 'none';
  }
});
