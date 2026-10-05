import { registerFeature } from './app.js';
import { detectLang } from './lang.js';
import { enrichWord } from './claude.js';
import { putWord, getVocab, deleteWord, addTombstone } from './db.js';
import { wordKey } from './wordkey.js';
import { newCard } from './srs.js';
import { isNewCard, intervalLabel } from './fsrs.js';
import { recordActivity } from './activity.js';
import { speak } from './tts.js';
import { escapeHtml } from './util.js';
import { icon } from './icons.js';
import { nounGender, bareNoun } from './exercises.js';

export const SOURCES = {
  street: 'Улица', book: 'Книга', scene: 'Сценка', daily: 'Слово дня', tap: 'Из текста', manual: 'Вручную', story: 'История', set: 'Набор',
};
export const HARD_LAPSES = 4;

// Откуда слово. У старых слов источника нет — угадываем по заметке.
export function wordSource(w) {
  if (w.source && SOURCES[w.source]) return w.source;
  const local = String(w.local || '');
  if (local.startsWith('Из книги')) return 'book';
  if (local.includes('Услышал')) return 'street';
  return '';
}

export const isHard = (w) => (w.lapses || 0) >= HARD_LAPSES;

export const FILTERS = [
  { id: 'all', title: 'Все', test: () => true },
  { id: 'hard', title: 'Трудные', test: isHard },
  { id: 'new', title: 'Новые', test: (w) => isNewCard(w) },
  { id: 'street', title: 'Улица', test: (w) => wordSource(w) === 'street' },
  { id: 'book', title: 'Книга', test: (w) => wordSource(w) === 'book' },
  { id: 'scene', title: 'Сценки', test: (w) => wordSource(w) === 'scene' },
];

// Для поиска: нижний регистр, без ударений и диакритики (á→a, ñ→n, ё→е), кириллица сохраняется.
export const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// Поиск по испанскому и русскому без учёта регистра и ударений. Чистая функция.
export function filterWords(words, { q = '', filter = 'all' } = {}) {
  const f = FILTERS.find((x) => x.id === filter) || FILTERS[0];
  const needle = fold(q);
  return (words || [])
    .filter(f.test)
    .filter((w) => !needle || fold(`${w.es} ${w.ru}`).includes(needle))
    .sort((a, b) => (isHard(b) - isHard(a)) || ((b.createdAt || 0) - (a.createdAt || 0)));
}

const PAGE = 60;
const state = { q: '', filter: 'all', limit: PAGE, editing: null };

function statusLine(w, now) {
  if (isNewCard(w)) return 'новое';
  const due = (w.due || 0) <= now ? 'повторить сегодня' : `повтор через ${intervalLabel(w, now)}`;
  return isHard(w) ? `трудное · ${due}` : due;
}

function previewHtml(w) {
  const e = escapeHtml;
  return `
    <div class="word-card">
      <div class="word-main"><b>${e(w.es)}</b> ${w.gender ? `<span class="muted">(${e(w.gender)})</span>` : ''} — ${e(w.ru)}</div>
      ${w.example ? `<div class="word-ex">${e(w.example)}${w.exampleRu ? `<br><span class="muted">${e(w.exampleRu)}</span>` : ''}</div>` : ''}
      ${w.local ? `<div class="word-local">${e(w.local)}</div>` : ''}
      <div class="word-actions">
        <button id="dic-save" class="primary">Сохранить в словарь</button>
        <button id="dic-say" class="icon-btn" aria-label="Озвучить ${e(w.es)}">${icon('sound')}</button>
      </div>
    </div>`;
}

function rowHtml(w, now) {
  const e = escapeHtml;
  const src = wordSource(w);
  if (state.editing === w.id) {
    return `<form class="word-card word-edit" data-form="${e(w.id)}">
      <label>По-испански<input name="es" value="${e(w.es)}" autocapitalize="off" required></label>
      <label>Перевод<input name="ru" value="${e(w.ru)}" required></label>
      <label>Артикль
        <select name="gender">${['', 'el', 'la'].map((g) => `<option value="${g}"${(w.gender || '') === g ? ' selected' : ''}>${g || '—'}</option>`).join('')}</select>
      </label>
      <label>Пример<input name="example" value="${e(w.example || '')}" autocapitalize="off"></label>
      <label>Перевод примера<input name="exampleRu" value="${e(w.exampleRu || '')}"></label>
      <label>Заметка<input name="local" value="${e(w.local || '')}"></label>
      <div class="word-actions">
        <button type="submit" class="primary">Сохранить</button>
        <button type="button" data-cancel="1">Отмена</button>
        <button type="button" class="danger" data-del="${e(w.id)}">${icon('trash', 'ic ic-sm')} Удалить</button>
      </div>
    </form>`;
  }
  return `<div class="word-card word-row${isHard(w) ? ' hard' : ''}">
    <div class="word-row-main">
      <div class="word-main">${nounGender(w) ? `<span class="art art-${nounGender(w)}">${nounGender(w)}</span> <b>${e(bareNoun(w.es))}</b>` : `<b>${e(w.es)}</b>`} — ${e(w.ru)}</div>
      <div class="word-meta">${src ? `<span class="tag">${e(SOURCES[src])}</span>` : ''}<span>${e(statusLine(w, now))}</span></div>
    </div>
    <div class="word-row-actions">
      <button class="icon-btn" data-say="${e(w.id)}" aria-label="Озвучить ${e(w.es)}">${icon('sound')}</button>
      <button class="icon-btn" data-edit="${e(w.id)}" aria-label="Изменить ${e(w.es)}">${icon('edit')}</button>
    </div>
  </div>`;
}

async function renderList(container) {
  const listEl = container.querySelector('#dic-list');
  if (!listEl) return;
  const all = await getVocab();
  if (!container.querySelector('#dic-list')) return;
  const now = Date.now();
  container.querySelector('#dic-count').textContent = all.length ? `(${all.length})` : '';
  container.querySelector('#dic-filters').innerHTML = FILTERS.map((f) => {
    const n = all.filter(f.test).length;
    if (f.id !== 'all' && n === 0 && state.filter !== f.id) return '';
    return `<button type="button" class="chip-btn${state.filter === f.id ? ' active' : ''}" data-filter="${f.id}" aria-pressed="${state.filter === f.id}">${f.title} <span class="muted">${n}</span></button>`;
  }).join('');
  container.querySelectorAll('[data-filter]').forEach((b) => {
    b.onclick = () => { state.filter = b.dataset.filter; state.limit = PAGE; renderList(container); };
  });

  if (all.length === 0) {
    listEl.innerHTML = '<p class="status">Словарь пуст. Добавьте первое слово выше или нажмите «＋ слово», когда услышите новое.</p>';
    return;
  }
  const words = filterWords(all, state);
  if (words.length === 0) {
    listEl.innerHTML = `<p class="status">${state.q ? `Ничего не найдено по «${escapeHtml(state.q)}».` : 'В этом списке пока пусто.'}</p>`;
    return;
  }
  const shown = words.slice(0, state.limit);
  listEl.innerHTML = shown.map((w) => rowHtml(w, now)).join('')
    + (words.length > shown.length ? `<button type="button" id="dic-more" class="ghost wide">Показать ещё (${words.length - shown.length})</button>` : '');
  const byId = (id) => all.find((x) => String(x.id) === String(id));
  listEl.querySelectorAll('[data-say]').forEach((b) => { b.onclick = () => { const w = byId(b.dataset.say); if (w) speak(w.es); }; });
  listEl.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => { state.editing = Number(b.dataset.edit); renderList(container); }; });
  const more = listEl.querySelector('#dic-more');
  if (more) more.onclick = () => { state.limit += PAGE; renderList(container); };
  const form = listEl.querySelector('[data-form]');
  if (form) {
    form.querySelector('input').focus();
    form.querySelector('[data-cancel]').onclick = () => { state.editing = null; renderList(container); };
    form.querySelector('[data-del]').onclick = async () => {
      const w = byId(form.dataset.form);
      if (!w || !confirm(`Удалить «${w.es}» из словаря?`)) return;
      await deleteWord(w.id);
      state.editing = null;
      renderList(container);
    };
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const w = byId(form.dataset.form);
      const fd = new FormData(form);
      const val = (k) => String(fd.get(k) || '').trim();
      if (!w || !val('es') || !val('ru')) return;
      // Слово переименовали: старое написание помечаем удалённым, чтобы оно не вернулось с другого устройства.
      if (val('es').toLowerCase() !== String(w.es).trim().toLowerCase()) await addTombstone(wordKey(w), w.uid, Date.now() - 1);
      await putWord({ ...w, es: val('es'), ru: val('ru'), gender: val('gender'), example: val('example'), exampleRu: val('exampleRu'), local: val('local') });
      state.editing = null;
      renderList(container);
    };
  }
}

async function render(container) {
  state.editing = null;
  state.limit = PAGE;
  container.innerHTML = `
    <h1>Словарь</h1>
    <button id="dic-quick" class="ghost wide">${icon('plus', 'ic ic-sm')} Услышал слово — записать быстро</button>
    <label>Новое слово или фраза (RU или ES)
      <input id="dic-input" type="text" placeholder="напр. собака или perro" autocapitalize="off" enterkeyhint="search">
    </label>
    <button id="dic-lookup">Найти и заполнить</button>
    <p id="dic-status" class="status" role="status"></p>
    <div id="dic-preview"></div>
    <h2>Мои слова <span id="dic-count" class="muted"></span></h2>
    <div class="search-box">${icon('search', 'ic ic-sm')}<input id="dic-search" type="search" placeholder="Поиск по словарю" aria-label="Поиск по словарю" autocapitalize="off" autocomplete="off" value="${escapeHtml(state.q)}"></div>
    <div id="dic-filters" class="chip-row" role="group" aria-label="Фильтр"></div>
    <div id="dic-list"></div>
  `;
  container.querySelector('#dic-quick').onclick = () => import('./capture.js').then((m) => m.openCapture());
  const status = container.querySelector('#dic-status');
  const preview = container.querySelector('#dic-preview');
  const inputEl = container.querySelector('#dic-input');
  let t = null;
  container.querySelector('#dic-search').addEventListener('input', (ev) => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = ev.target.value; state.limit = PAGE; renderList(container); }, 150);
  });

  const lookup = async () => {
    const input = inputEl.value.trim();
    if (!input) return;
    status.textContent = `Запрашиваю (${detectLang(input) === 'ru' ? 'RU→ES' : 'ES→RU'})…`;
    preview.innerHTML = '';
    try {
      const w = await enrichWord(input);
      status.textContent = '';
      preview.innerHTML = previewHtml(w);
      preview.querySelector('#dic-say').onclick = () => speak(w.es);
      preview.querySelector('#dic-save').onclick = async () => {
        const now = Date.now();
        await putWord({ ...w, source: 'manual', createdAt: now, ...newCard(now) });
        await recordActivity('newWord');
        if (!container.querySelector('#dic-preview')) return; // ушли на другой экран
        preview.innerHTML = '';
        inputEl.value = '';
        status.textContent = 'Сохранено в словарь.';
        renderList(container);
      };
    } catch (e) {
      status.textContent = e.message;
    }
  };
  container.querySelector('#dic-lookup').onclick = lookup;
  inputEl.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); lookup(); } });

  await renderList(container);
}

registerFeature({ id: 'dictionary', title: 'Словарь', icon: '📖', order: 20, render });
