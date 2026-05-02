// ─── Settings ────────────────────────────────────────────────────────────────

async function loadSettings() {
  try {
    const cfg = await fetch('/api/config').then(r => r.json());
    document.getElementById('cfg-base-url').value       = cfg.baseUrl || '';
    document.getElementById('cfg-api-key').value        = cfg.apiKey  || '';
    document.getElementById('cfg-default-model').value  = cfg.model   || '';
    document.getElementById('cfg-timeout').value        = cfg.timeoutMs || 120000;
    document.getElementById('cfg-context-window').value = cfg.contextWindowTokens || 8192;
    document.getElementById('cfg-log-level').value      = cfg.logLevel || 'error';
  } catch {}
}

document.getElementById('save-config-btn').addEventListener('click', async () => {
  const btn = document.getElementById('save-config-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const msg = document.getElementById('settings-msg');
  msg.style.display = 'none';

  try {
    const model = document.getElementById('cfg-default-model').value.trim();
    if (model) btn.textContent = 'Loading model…';
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl:             document.getElementById('cfg-base-url').value.trim(),
        apiKey:              document.getElementById('cfg-api-key').value.trim(),
        model,
        timeoutMs:           parseInt(document.getElementById('cfg-timeout').value) || 120000,
        contextWindowTokens: parseInt(document.getElementById('cfg-context-window').value) || 8192,
        logLevel:            document.getElementById('cfg-log-level').value,
      }),
    });
    showSettingsMsg('success', model ? `Settings saved. Model "${model}" loaded.` : 'Settings saved.');
    window.appUtils?.loadHealthHost();
  } catch (err) {
    showSettingsMsg('error', 'Save failed: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Settings';
  }
});

document.getElementById('test-connection-btn').addEventListener('click', async () => {
  const btn = document.getElementById('test-connection-btn');
  btn.disabled = true;
  btn.textContent = 'Testing…';
  const msg = document.getElementById('settings-msg');
  msg.style.display = 'none';

  try {
    const res = await fetch('/api/config/health');
    const { ok, error, message } = await res.json();
    if (ok === null) {
      showSettingsMsg('success', message || 'Connection checks are disabled to avoid background LM Studio requests.');
      return;
    }
    if (ok) {
      showSettingsMsg('success', 'Connection successful!');
    } else {
      showSettingsMsg('error', `Connection failed: ${error || 'unknown error'}`);
    }
  } catch (err) {
    showSettingsMsg('error', 'Connection failed: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Test Connection';
  }
});

document.getElementById('refresh-models-btn').addEventListener('click', async () => {
  const list = document.getElementById('models-list');
  list.style.display = 'block';
  list.innerHTML = '<div class="model-option" style="color:var(--text-muted)">Loading…</div>';

  try {
    const { models } = await fetch('/api/config/models').then(r => r.json());
    if (!models || !models.length) {
      list.innerHTML = '<div class="dropdown-empty">No models found. Is LM Studio running?</div>';
      return;
    }
    list.innerHTML = models.map(m => `
      <div class="model-option" data-model="${escapeHtml(m)}">${escapeHtml(m)}</div>
    `).join('');
    list.querySelectorAll('.model-option').forEach(el => {
      el.addEventListener('click', async () => {
        const currentModel = document.getElementById('cfg-default-model').value.trim();
        if (currentModel && currentModel !== el.dataset.model) {
          try {
            await fetch('/api/config/models/unload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ modelId: currentModel }),
            });
          } catch { /* ignore unload errors — LM Studio may not have that model loaded */ }
        }
        document.getElementById('cfg-default-model').value = el.dataset.model;
        list.style.display = 'none';
      });
    });
  } catch {
    list.innerHTML = '<div class="dropdown-empty">Failed to load models. Check connection.</div>';
  }
});

function showSettingsMsg(type, text) {
  const el = document.getElementById('settings-msg');
  el.className = `settings-msg ${type}`;
  el.textContent = text;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

loadSettings();
