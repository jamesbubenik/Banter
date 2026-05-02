// ─── Vibe Creator ─────────────────────────────────────────────────────────────

let vibeHistory     = [];
let vibeDraft       = { name: '', description: '', systemPrompt: '' };
let vibeManualEdits = new Set();
let vibeStreaming    = false;
let vibeUserScrolled = false;

// ─── Show / Hide ──────────────────────────────────────────────────────────────

function showVibeCreator() {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-title').textContent = 'New Person';
  document.getElementById('vibe-creator-view').style.display = 'flex';

  resetVibe();
  appendAssistantMessage(
    "Hey! Describe the person you want to create — their personality, background, expertise, how they speak. I'll help design them for your discussions."
  );
  document.getElementById('vibe-input').focus();
}

function hideVibeCreator() {
  document.getElementById('vibe-creator-view').style.display = 'none';
  window.appUtils.showView('agents');
}

function resetVibe() {
  vibeHistory     = [];
  vibeDraft       = { name: '', description: '', systemPrompt: '' };
  vibeManualEdits = new Set();
  vibeStreaming     = false;
  vibeUserScrolled  = false;

  document.getElementById('vibe-jump-btn').style.display = 'none';
  document.getElementById('vibe-chat-messages').innerHTML = '';
  document.getElementById('vibe-name').value          = '';
  document.getElementById('vibe-description').value   = '';
  document.getElementById('vibe-system-prompt').value = '';
  document.getElementById('vibe-error').style.display = 'none';
  document.getElementById('vibe-input').value         = '';
  setSendState(false);
}

// ─── Chat Rendering ───────────────────────────────────────────────────────────

function appendUserMessage(text) {
  const feed = document.getElementById('vibe-chat-messages');
  const el = document.createElement('div');
  el.className = 'vibe-msg vibe-msg-user';
  el.textContent = text;
  feed.appendChild(el);
  scrollVibe();
}

function appendAssistantMessage(text) {
  const feed = document.getElementById('vibe-chat-messages');
  const el = document.createElement('div');
  el.className = 'vibe-msg vibe-msg-assistant';
  el.textContent = text;
  feed.appendChild(el);
  scrollVibe();
  return el;
}

function createStreamingMessage() {
  const feed = document.getElementById('vibe-chat-messages');
  const el = document.createElement('div');
  el.className = 'vibe-msg vibe-msg-assistant';
  el.innerHTML = '<span class="vibe-typing"><span></span><span></span><span></span></span>';
  feed.appendChild(el);
  scrollVibe();
  return el;
}

function scrollVibe() {
  if (vibeUserScrolled) return;
  const feed = document.getElementById('vibe-chat-messages');
  feed.scrollTop = feed.scrollHeight;
}

// ─── Draft Application ────────────────────────────────────────────────────────

function applyDraft(draft) {
  if (!draft) return;
  vibeDraft = { ...vibeDraft, ...draft };

  if (!vibeManualEdits.has('name') && draft.name !== undefined)
    document.getElementById('vibe-name').value = draft.name;
  if (!vibeManualEdits.has('description') && draft.description !== undefined)
    document.getElementById('vibe-description').value = draft.description;
  if (!vibeManualEdits.has('systemPrompt') && draft.systemPrompt !== undefined)
    document.getElementById('vibe-system-prompt').value = draft.systemPrompt;
}

// ─── Send Message ─────────────────────────────────────────────────────────────

async function vibeSend() {
  if (vibeStreaming) return;

  const input = document.getElementById('vibe-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = '';

  appendUserMessage(text);
  vibeStreaming = true;
  setSendState(true);

  const msgEl = createStreamingMessage();
  let displayText = '';
  let fullText = '';
  let inDraft = false;
  let draftReceived = false;

  try {
    const res = await fetch('/api/creator/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: vibeHistory, message: text }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const processLine = (line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) return;

      let obj;
      try { obj = JSON.parse(trimmed.slice(6)); } catch { return; }

      if (obj.type === 'chunk') {
        fullText += obj.content;
        if (!inDraft) {
          const combined = displayText + obj.content;
          const draftIdx = combined.indexOf('<draft>');
          if (draftIdx === -1) {
            displayText = combined;
          } else {
            displayText = combined.slice(0, draftIdx);
            inDraft = true;
          }
          msgEl.textContent = displayText;
          scrollVibe();
        }
      } else if (obj.type === 'draft') {
        draftReceived = true;
        applyDraft(obj.draft);
      } else if (obj.type === 'done') {
        vibeHistory.push({ role: 'user',      content: text });
        vibeHistory.push({ role: 'assistant', content: displayText.trim() });
      } else if (obj.type === 'error') {
        throw new Error(obj.message);
      }
    };

    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        processLine(line);
      }
    }

    // Flush any remaining data in the buffer after the stream closes
    if (buffer.trim()) {
      for (const line of buffer.split('\n')) processLine(line);
    }

    // Fallback: if the backend failed to send a draft event, parse it from
    // the accumulated full text so the right panel is always populated
    if (!draftReceived) {
      const m = fullText.match(/<draft>([\s\S]*?)<\/draft>/);
      if (m) {
        try { applyDraft(JSON.parse(m[1])); } catch { /* malformed JSON from LLM */ }
      }
    }

    msgEl.classList.remove('vibe-msg-streaming');

  } catch (err) {
    msgEl.textContent = `Error: ${err.message}`;
    msgEl.style.borderColor = 'var(--danger)';
    msgEl.style.color = 'var(--danger)';
  } finally {
    vibeStreaming = false;
    setSendState(false);
    document.getElementById('vibe-input').focus();
  }
}

function setSendState(busy) {
  const btn = document.getElementById('vibe-send-btn');
  btn.disabled = busy;
  btn.textContent = busy ? '…' : 'Send';
}

// ─── Create Person ────────────────────────────────────────────────────────────

async function vibeCreate() {
  const name         = document.getElementById('vibe-name').value.trim();
  const description  = document.getElementById('vibe-description').value.trim();
  const systemPrompt = document.getElementById('vibe-system-prompt').value.trim();
  const errEl        = document.getElementById('vibe-error');

  errEl.style.display = 'none';

  if (!name)         { showVibeError('Name is required.'); return; }
  if (!systemPrompt) { showVibeError('System Prompt is required.'); return; }

  const btn = document.getElementById('vibe-create-btn');
  btn.disabled = true;
  btn.textContent = 'Creating…';

  try {
    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, systemPrompt }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create person');
    }

    await window.agentsModule.loadAgents();
    hideVibeCreator();

  } catch (err) {
    showVibeError(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ Create Person';
  }
}

function showVibeError(msg) {
  const el = document.getElementById('vibe-error');
  el.textContent = msg;
  el.style.display = 'block';
}

// ─── Manual Edit Tracking ─────────────────────────────────────────────────────

const FIELD_MAP = {
  'vibe-name':          'name',
  'vibe-description':   'description',
  'vibe-system-prompt': 'systemPrompt',
};

Object.keys(FIELD_MAP).forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    vibeManualEdits.add(FIELD_MAP[id]);
  });
});

// ─── Wire up ──────────────────────────────────────────────────────────────────

document.getElementById('vibe-back-btn').addEventListener('click', hideVibeCreator);
window.showVibeCreator = showVibeCreator;
document.getElementById('vibe-send-btn').addEventListener('click', vibeSend);
document.getElementById('vibe-create-btn').addEventListener('click', vibeCreate);

document.getElementById('vibe-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); vibeSend(); }
});

document.getElementById('vibe-input').addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// Scroll tracking — suppress auto-scroll when user has scrolled up
document.getElementById('vibe-chat-messages').addEventListener('scroll', () => {
  const feed = document.getElementById('vibe-chat-messages');
  const atBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
  vibeUserScrolled = !atBottom;
  document.getElementById('vibe-jump-btn').style.display = vibeUserScrolled ? 'flex' : 'none';
});

document.getElementById('vibe-jump-btn').addEventListener('click', () => {
  vibeUserScrolled = false;
  const feed = document.getElementById('vibe-chat-messages');
  feed.scrollTop = feed.scrollHeight;
  document.getElementById('vibe-jump-btn').style.display = 'none';
});

// Close vibe creator when navigating via sidebar
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('vibe-creator-view').style.display = 'none';
  });
});
