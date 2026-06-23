// Реестр экранов + hash-роутер + нижняя навигация (5 главных + «Ещё»).
const features = [];
const PRIMARY_COUNT = 5;

export function registerFeature(feature) {
  features.push(feature);
}

function sorted() {
  return [...features].sort((a, b) => a.order - b.order);
}

function closeSheet() {
  const sheet = document.getElementById('more-sheet');
  if (sheet) sheet.classList.remove('open');
}

function navButton(f, activeId) {
  const btn = document.createElement('a');
  btn.className = 'nav-btn' + (f.id === activeId ? ' active' : '');
  btn.href = `#${f.id}`;
  btn.innerHTML = `<span class="nav-icon">${f.icon}</span><span class="nav-label">${f.title}</span>`;
  btn.addEventListener('click', closeSheet);
  return btn;
}

function renderSheet(more, activeId) {
  let sheet = document.getElementById('more-sheet');
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.id = 'more-sheet';
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
  }
  sheet.innerHTML = `<div class="more-panel"><div class="more-grip"></div>${
    more.map((f) => `<a class="more-item${f.id === activeId ? ' active' : ''}" href="#${f.id}"><span class="more-icon">${f.icon}</span><span>${f.title}</span></a>`).join('')
  }</div>`;
  sheet.querySelectorAll('.more-item').forEach((a) => a.addEventListener('click', closeSheet));
}

function renderNav(activeId) {
  const list = sorted();
  const primary = list.slice(0, PRIMARY_COUNT);
  const more = list.slice(PRIMARY_COUNT);
  const nav = document.getElementById('nav');
  nav.innerHTML = '';
  for (const f of primary) nav.appendChild(navButton(f, activeId));
  if (more.length) {
    const moreActive = more.some((f) => f.id === activeId);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-btn nav-more' + (moreActive ? ' active' : '');
    btn.innerHTML = `<span class="nav-icon">⋯</span><span class="nav-label">Ещё</span>`;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      renderSheet(more, activeId);
      document.getElementById('more-sheet').classList.toggle('open');
    });
    nav.appendChild(btn);
    renderSheet(more, activeId);
  }
}

async function renderRoute() {
  const list = sorted();
  if (list.length === 0) return;
  closeSheet();
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
