// ─── Navigation ────────────────────────────────────────────────────────────

const VIEWS = { agents: 'People', discussion: 'Discussion', settings: 'Settings' };

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const view = document.getElementById(`${name}-view`);
  const navBtn = document.querySelector(`.nav-item[data-view="${name}"]`);
  if (view) view.classList.add('active');
  if (navBtn) navBtn.classList.add('active');

  document.getElementById('page-title').textContent = VIEWS[name] || name;
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    showView(view);
    if (view === 'discussion') window.refreshDiscussionDropdowns?.();
  });
});

async function checkHealth() {}
async function loadHealthHost() {}

// ─── Utility ────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.appUtils = { showView, checkHealth, loadHealthHost, escapeHtml };
