// Реестр экранов + hash-роутер. Новые блоки регистрируются, ядро не меняется (§9).
const features = [];

export function registerFeature(feature) {
  features.push(feature);
}

function sorted() {
  return [...features].sort((a, b) => a.order - b.order);
}

function renderNav(activeId) {
  const nav = document.getElementById('nav');
  nav.innerHTML = '';
  for (const f of sorted()) {
    const btn = document.createElement('a');
    btn.className = 'nav-btn' + (f.id === activeId ? ' active' : '');
    btn.href = `#${f.id}`;
    btn.innerHTML = `<span class="nav-icon">${f.icon}</span><span class="nav-label">${f.title}</span>`;
    nav.appendChild(btn);
  }
}

async function renderRoute() {
  const list = sorted();
  if (list.length === 0) return;
  const id = location.hash.slice(1) || list[0].id;
  const feature = list.find((f) => f.id === id) || list[0];
  renderNav(feature.id);
  const screen = document.getElementById('screen');
  screen.innerHTML = '';
  await feature.render(screen);
}

export function startApp() {
  window.addEventListener('hashchange', renderRoute);
  renderRoute();
}
