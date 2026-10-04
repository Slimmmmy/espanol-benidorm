// Быстрая запись услышанного слова: кнопка «＋ слово» на любом экране.
// Запись сохраняется мгновенно во «Входящие», ИИ разбирается в фоне: уверен — сам кладёт слово в словарь
// (с «Отменить» и «Не то?»), сомневается — предлагает 2–3 варианта. Без сети — разберёт позже.
import { getSetting, setSetting, deleteWord } from './db.js';
import { resolveHeardWord } from './claude.js';
import { saveWordWithId } from './wordpick.js';
import { recognizeOnce, canRecognize } from './asr.js';
import { speak } from './tts.js';
import { icon } from './icons.js';
import { escapeHtml } from './util.js';
import { autoSync } from './sync.js';

const MAX_ITEMS = 50;
const HIDE_ON = new Set(['chat', 'roleplay']); // там своё поле ввода внизу экрана
const DONE = new Set(['added', 'exists', 'empty', 'dismissed']);

// ── Чистые функции ───────────────────────────────────
export function newItem(raw, context = '', now = Date.now()) {
  return { id: `c${now}${Math.floor(Math.random() * 1000)}`, raw: String(raw).trim(), context: String(context || '').trim(), createdAt: now, status: 'pending', candidates: [], chosen: null, wordId: null };
}

// Что делать с ответом модели: 'empty' — не поняли; 'auto' — уверены, сохраняем первый вариант; 'choose' — спросить.
export function decide(result) {
  const candidates = (Array.isArray(result && result.candidates) ? result.candidates : []).filter((c) => c && c.es).slice(0, 3);
  if (!candidates.length) return { action: 'empty', candidates };
  if (result.confident || candidates.length === 1) return { action: 'auto', candidates };
  return { action: 'choose', candidates };
}

export function needsChoice(list) {
  return (list || []).filter((i) => i.status === 'choose').length;
}

const RANK = { dismissed: 5, added: 4, exists: 4, empty: 4, choose: 3, offline: 2, pending: 1 };

// Слияние «Входящих» двух устройств: по id, побеждает более продвинутый статус.
export function mergeInbox(a, b) {
  const map = new Map();
  for (const it of [...(a || []), ...(b || [])]) {
    const prev = map.get(it.id);
    if (!prev || (RANK[it.status] || 0) > (RANK[prev.status] || 0)) map.set(it.id, it);
  }
  return [...map.values()].sort((x, y) => x.createdAt - y.createdAt).slice(-MAX_ITEMS);
}

// ── Хранилище ────────────────────────────────────────
async function getInbox() { return (await getSetting('inbox')) || []; }
async function saveInbox(list) { await setSetting('inbox', list.slice(-MAX_ITEMS)); }

async function updateItem(id, patch) {
  const list = await getInbox();
  const it = list.find((x) => x.id === id);
  if (!it) return null;
  Object.assign(it, patch);
  await saveInbox(list);
  return it;
}

// ── Разбор в фоне ────────────────────────────────────
let processing = false;

async function addCandidate(item, idx) {
  const c = item.candidates[idx];
  const r = await saveWordWithId({ ...c, local: [c.local, item.context ? `Услышал: ${item.context}` : ''].filter(Boolean).join(' · ') });
  return updateItem(item.id, { status: r.status === 'added' ? 'added' : 'exists', chosen: idx, wordId: r.status === 'added' ? r.id : null });
}

export async function processQueue() {
  if (processing) return;
  processing = true;
  try {
    for (;;) {
      const item = (await getInbox()).find((i) => i.status === 'pending' || i.status === 'offline');
      if (!item) break;
      let result;
      try {
        result = await resolveHeardWord(item.raw, item.context);
      } catch (e) {
        await updateItem(item.id, { status: 'offline', error: e.message });
        break; // нет сети или ключа — попробуем позже
      }
      const d = decide(result);
      if (d.action === 'empty') await updateItem(item.id, { status: 'empty', candidates: [] });
      else if (d.action === 'choose') await updateItem(item.id, { status: 'choose', candidates: d.candidates });
      else {
        const it = await updateItem(item.id, { candidates: d.candidates });
        const done = await addCandidate(it, 0);
        if (done) toastAdded(done);
      }
      refresh();
    }
  } finally {
    processing = false;
    refresh();
    autoSync();
  }
}

// ── Интерфейс ────────────────────────────────────────
let sheetOpen = false;

function el(id) { return document.getElementById(id); }

function itemHtml(it) {
  const e = escapeHtml;
  const c = it.chosen != null ? it.candidates[it.chosen] : null;
  const head = `<div class="cap-raw">«${e(it.raw)}»${it.context ? `<span class="muted"> · ${e(it.context)}</span>` : ''}</div>`;
  switch (it.status) {
    case 'pending':
      return `<div class="cap-item">${head}<div class="muted">Ищу, что это…</div></div>`;
    case 'offline':
      return `<div class="cap-item">${head}<div class="muted">Сохранено. Разберу, когда будет интернет.</div>
        <button class="mini" data-retry="${e(it.id)}">Попробовать сейчас</button></div>`;
    case 'empty':
      return `<div class="cap-item">${head}<div class="muted">Не удалось понять, что это за слово. Попробуйте записать иначе или добавить, где услышали.</div>
        <button class="mini" data-dismiss="${e(it.id)}">Убрать</button></div>`;
    case 'choose':
      return `<div class="cap-item cap-choose">${head}<div class="cap-q">Что из этого вы услышали?</div>
        ${it.candidates.map((x, i) => `<button class="cap-cand" data-pick="${e(it.id)}" data-i="${i}"><b class="es">${e(x.es)}</b> — ${e(x.ru)}</button>`).join('')}
        <button class="mini" data-dismiss="${e(it.id)}">Ничего из этого</button></div>`;
    case 'added':
    case 'exists':
      return `<div class="cap-item cap-done">${head}
        <div><b class="es">${e(c ? c.es : '')}</b> — ${e(c ? c.ru : '')} <span class="daily-added">${it.status === 'added' ? '✓ в словаре' : '✓ уже было в словаре'}</span></div>
        ${c && c.example ? `<div class="word-ex es">${e(c.example)}</div>` : ''}
        <div class="cap-acts">
          <button class="mini" data-say="${e(it.id)}">🔊</button>
          ${it.candidates.length > 1 ? `<button class="mini" data-other="${e(it.id)}">Не то?</button>` : ''}
          ${it.status === 'added' ? `<button class="mini" data-undo="${e(it.id)}">Отменить</button>` : ''}
        </div></div>`;
    default:
      return '';
  }
}

async function renderList() {
  const box = el('cap-list');
  if (!box) return;
  const list = (await getInbox()).filter((i) => i.status !== 'dismissed').slice(-8).reverse();
  box.innerHTML = list.length
    ? `<div class="section-label">Последние записи</div>${list.map(itemHtml).join('')}`
    : '<p class="muted cap-empty">Записанные слова появятся здесь.</p>';
}

async function refreshFab() {
  const fab = el('cap-fab');
  if (!fab) return;
  const screen = (location.hash.slice(1) || 'today');
  fab.classList.toggle('hidden', HIDE_ON.has(screen) || sheetOpen);
  fab.classList.toggle('cap-alert', needsChoice(await getInbox()) > 0);
}

function refresh() {
  refreshFab();
  if (sheetOpen) renderList();
}

let toastTimer = null;
function toastAdded(it) {
  const t = el('cap-toast');
  const c = it.candidates[it.chosen];
  if (!t || !c || sheetOpen) return;
  t.innerHTML = `<span>${it.status === 'added' ? '✓' : '•'} <b class="es">${escapeHtml(c.es)}</b> — ${escapeHtml(c.ru)}</span>
    ${it.status === 'added' ? `<button class="mini" data-undo="${escapeHtml(it.id)}">Отменить</button>` : ''}`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 5000);
}

function openSheet() {
  sheetOpen = true;
  el('cap-sheet').classList.add('open');
  renderList();
  refreshFab();
  setTimeout(() => { const i = el('cap-input'); if (i && !canRecognize()) i.focus(); }, 250);
}

function closeSheet() {
  sheetOpen = false;
  const ctx = el('cap-ctx');
  if (ctx) ctx.value = ''; // «где услышали» — только на текущую серию записей
  el('cap-sheet').classList.remove('open');
  refreshFab();
}

async function submit(raw) {
  const input = el('cap-input');
  const ctxEl = el('cap-ctx');
  const text = String(raw ?? input.value).trim();
  if (!text) return;
  input.value = '';
  const list = await getInbox();
  list.push(newItem(text, ctxEl ? ctxEl.value : ''));
  await saveInbox(list);
  renderList();
  processQueue();
}

async function onAction(ev) {
  const b = ev.target.closest('button');
  if (!b) return;
  const list = await getInbox();
  const find = (id) => list.find((x) => x.id === id);
  if (b.dataset.retry) { await updateItem(b.dataset.retry, { status: 'pending' }); processQueue(); }
  else if (b.dataset.dismiss) { await updateItem(b.dataset.dismiss, { status: 'dismissed' }); }
  else if (b.dataset.pick) { const it = find(b.dataset.pick); if (it) await addCandidate(it, Number(b.dataset.i)); }
  else if (b.dataset.say) { const it = find(b.dataset.say); if (it && it.chosen != null) speak(it.candidates[it.chosen].es); }
  else if (b.dataset.undo || b.dataset.other) {
    const it = find(b.dataset.undo || b.dataset.other);
    if (!it) return;
    if (it.wordId != null) await deleteWord(it.wordId);
    await updateItem(it.id, b.dataset.undo
      ? { status: 'dismissed', wordId: null }
      : { status: 'choose', chosen: null, wordId: null });
    const t = el('cap-toast');
    if (t) t.classList.remove('show');
  }
  refresh();
}

export function initCapture() {
  if (el('cap-fab')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <button id="cap-fab" aria-label="Быстро записать слово">${icon('plus', 'ic')}<span>слово</span></button>
    <div id="cap-toast" role="status"></div>
    <div id="cap-sheet">
      <div class="cap-panel">
        <div class="cap-head"><b>Услышали слово?</b><button class="wp-x" id="cap-close">✕</button></div>
        <p class="muted cap-help">Скажите или напишите, как услышали: с ошибками, слитно, даже русскими буквами («вэнга»). Разберусь сам.</p>
        ${canRecognize() ? `<button id="cap-mic" class="cap-mic">${icon('speech', 'ic')}<span>Сказать слово</span></button>` : ''}
        <div class="cap-row">
          <input id="cap-input" type="text" placeholder="как услышали…" autocomplete="off" autocapitalize="off" enterkeyhint="done">
          <button id="cap-add">Записать</button>
        </div>
        <input id="cap-ctx" type="text" placeholder="где услышали (необязательно): бар, рынок, сосед…" autocomplete="off">
        <p id="cap-status" class="status"></p>
        <div id="cap-list"></div>
      </div>
    </div>`);
  el('cap-fab').onclick = openSheet;
  el('cap-close').onclick = closeSheet;
  el('cap-sheet').addEventListener('click', (e) => { if (e.target.id === 'cap-sheet') closeSheet(); });
  el('cap-add').onclick = () => submit();
  el('cap-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  el('cap-list').addEventListener('click', onAction);
  el('cap-toast').addEventListener('click', onAction);
  const mic = el('cap-mic');
  if (mic) {
    mic.onclick = async () => {
      const st = el('cap-status');
      mic.disabled = true;
      mic.classList.add('listening');
      st.textContent = 'Слушаю… скажите слово по-испански';
      try {
        const heard = await recognizeOnce('es-ES');
        st.textContent = '';
        await submit(heard);
      } catch (err) {
        st.textContent = `${err.message} Можно написать как услышали.`;
      } finally {
        mic.disabled = false;
        mic.classList.remove('listening');
      }
    };
  }
  window.addEventListener('hashchange', () => {
    if (location.hash === '#capture') { history.replaceState(null, '', '#today'); openSheet(); }
    refreshFab();
  });
  window.addEventListener('online', processQueue);
  if (location.hash === '#capture') openSheet();
  refreshFab();
  processQueue();
}

export { openSheet as openCapture };
