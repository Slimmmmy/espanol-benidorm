// Реестр экранов + hash-роутер + навигация: 5 вкладок внизу, сверху — «назад»/переключатель и профиль.
import { icon } from './icons.js';

const features = [];
// Испанское название раздела — показывается мелкой строкой над заголовком экрана.
const ES_NAMES = {
  today: 'Hoy', teacher: 'El profesor', chat: 'Charla', study: 'Repaso', daily: 'Palabras del día',
  roleplay: 'Escenas', dictionary: 'Diccionario', listening: 'Escuchar', speech: 'Pronunciación',
  grammar: 'Gramática', assignments: 'Deberes', progress: 'Progreso', settings: 'Ajustes', reader: 'Lectura',
  practice: 'Práctica', session: 'La sesión', drills: 'Entrenamiento', stories: 'Historias', placement: 'Nivel', voice: 'Voz',
};

// Пять вкладок вместо четырнадцати разделов. Остальные экраны живут внутри вкладок.
export const TABS = [
  { id: 'today', title: 'Сегодня', icon: 'today', home: 'today' },
  { id: 'review', title: 'Повторить', icon: 'study', home: 'study' },
  { id: 'practice', title: 'Практика', icon: 'roleplay', home: 'practice' },
  { id: 'mentor', title: 'Наставник', icon: 'teacher', home: 'chat' },
  { id: 'dictionary', title: 'Словарь', icon: 'dictionary', home: 'dictionary' },
];
const TAB_OF = {
  today: 'today', session: 'today', daily: 'today',
  study: 'review', drills: 'review',
  practice: 'practice', stories: 'practice', roleplay: 'practice', reader: 'practice', listening: 'practice', speech: 'practice', assignments: 'practice',
  chat: 'mentor', teacher: 'mentor', grammar: 'mentor',
  dictionary: 'dictionary',
};
// Наставник — один «человек»: чат, уроки курса и проверка фразы переключаются сверху.
export const MENTOR_VIEWS = [
  { id: 'chat', title: 'Чат' },
  { id: 'teacher', title: 'Уроки' },
  { id: 'grammar', title: 'Фраза' },
];

export const tabOf = (screenId) => TAB_OF[screenId] || null;

// Куда ведёт кнопка «назад» с вложенного экрана (null — экран верхнего уровня).
export function backTarget(screenId) {
  const tab = tabOf(screenId);
  if (!tab) return { hash: '', title: 'Назад' }; // профиль: настройки, прогресс → назад по истории
  if (tab === 'mentor') return null;
  const t = TABS.find((x) => x.id === tab);
  return t.home === screenId ? null : { hash: `#${t.home}`, title: t.title };
}

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* необязательно */ } },
};

const routeHooks = [];
// Модули (например, «Занятие») могут дорисовывать своё после каждой смены экрана.
export function onRoute(fn) { routeHooks.push(fn); }

export function registerFeature(feature) {
  features.push(feature);
}

export function featureTitle(id) {
  const f = features.find((x) => x.id === id);
  return f ? f.title : '';
}

function closeSheet() {
  const sheet = document.getElementById('more-sheet');
  if (sheet) sheet.classList.remove('open');
}

function tabHome(tab) {
  if (tab.id === 'mentor') {
    const last = store.get('mentorView');
    return MENTOR_VIEWS.some((v) => v.id === last) ? last : tab.home;
  }
  return tab.home;
}

function renderNav(activeId) {
  const nav = document.getElementById('nav');
  nav.setAttribute('aria-label', 'Разделы');
  const active = tabOf(activeId);
  nav.innerHTML = TABS.map((t) => `<a class="nav-btn${t.id === active ? ' active' : ''}" href="#${tabHome(t)}"${t.id === active ? ' aria-current="page"' : ''}>${icon(t.icon, 'nav-icon')}<span class="nav-label">${t.title}</span></a>`).join('');
}

function openProfile(activeId) {
  let sheet = document.getElementById('more-sheet');
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.id = 'more-sheet';
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
  }
  const items = [['progress', 'Прогресс', 'progress'], ['voice', 'Голос и микрофон', 'sound'], ['settings', 'Настройки', 'settings']];
  sheet.innerHTML = `<div class="more-panel" role="dialog" aria-label="Профиль"><div class="more-grip"></div>${
    items.map(([id, title, ic]) => `<a class="more-item${id === activeId ? ' active' : ''}" href="#${id}">${icon(ic, 'more-icon')}<span>${title}</span><span class="more-es">${ES_NAMES[id]}</span></a>`).join('')
  }</div>`;
  sheet.querySelectorAll('.more-item').forEach((a) => a.addEventListener('click', closeSheet));
  sheet.classList.add('open');
}

function renderTopbar(activeId) {
  let bar = document.getElementById('topbar');
  if (!bar) {
    bar = document.createElement('header');
    bar.id = 'topbar';
    document.body.insertBefore(bar, document.getElementById('screen'));
  }
  let left = '';
  if (tabOf(activeId) === 'mentor') {
    left = `<div class="segment" role="tablist" aria-label="Наставник">${MENTOR_VIEWS.map((v) => `<a role="tab" href="#${v.id}" class="seg-btn${v.id === activeId ? ' active' : ''}" aria-selected="${v.id === activeId}">${v.title}</a>`).join('')}</div>`;
  } else {
    const back = backTarget(activeId);
    if (back) left = `<a class="back-link" href="${back.hash || '#'}" data-back="${back.hash ? '' : '1'}">${icon('back', 'ic ic-sm')}<span>${back.title}</span></a>`;
  }
  bar.innerHTML = `<div class="topbar-row">${left}<button type="button" class="profile-btn" aria-label="Профиль: прогресс и настройки">${icon('user')}</button></div><div id="session-slot"></div>`;
  bar.querySelector('.profile-btn').onclick = () => openProfile(activeId);
  const b = bar.querySelector('[data-back="1"]');
  if (b) b.onclick = (e) => { e.preventDefault(); if (history.length > 1) history.back(); else location.hash = '#today'; };
}

async function renderRoute() {
  if (features.length === 0) return;
  closeSheet();
  const id = location.hash.slice(1) || 'today';
  const feature = features.find((f) => f.id === id) || features.find((f) => f.id === 'today') || features[0];
  if (tabOf(feature.id) === 'mentor') store.set('mentorView', feature.id);
  renderNav(feature.id);
  renderTopbar(feature.id);
  const screen = document.getElementById('screen');
  screen.innerHTML = '';
  screen.dataset.es = ES_NAMES[feature.id] || '';
  screen.dataset.screen = feature.id;
  document.title = `${feature.title} · Español`;
  screen.classList.remove('enter');
  void screen.offsetWidth; // перезапуск анимации появления
  screen.classList.add('enter');
  window.scrollTo(0, 0);
  for (const fn of routeHooks) { try { fn(feature.id); } catch (e) { /* не мешаем экрану */ } }
  await feature.render(screen);
}

// VoiceOver читает испанский текст испанским голосом, если у элемента lang="es".
const ES_SELECTOR = '.es, .study-es, .study-cloze, .word-main b, .dlg-es, .rp-es, .wp-head b, .hub-es, .more-es';
function markSpanish(root) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll(ES_SELECTOR).forEach((el) => { if (!el.lang) el.lang = 'es'; });
}

export function startApp() {
  window.addEventListener('hashchange', renderRoute);
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(() => markSpanish(document.body)).observe(document.body, { childList: true, subtree: true });
  }
  renderRoute();
}
