import { registerFeature } from './app.js';
import { getAllWords, putWord, getSetting } from './db.js';
import { fsrsSchedule, intervalLabel } from './fsrs.js';
import { buildQueue } from './queue.js';
import { pickCardType, makeCloze, checkAnswer, CARD_TYPES } from './exercises.js';
import { speak, canSpeak } from './tts.js';
import { recognizeOnce, canRecognize } from './asr.js';
import { escapeHtml } from './util.js';
import { recordStudyDay } from './stats.js';
import { recordActivity } from './activity.js';
import { getLimits, refreshBadge } from './reminders.js';

let queue = [];
let current = null;
let currentType = 'ru-es';
let held = 0;
let mode = 'mixed';
let busy = false;

const GRADE_BTNS = [
  { g: 'again', label: 'Не помню', cls: 'danger' },
  { g: 'hard', label: 'Трудно', cls: 'hard' },
  { g: 'good', label: 'Помню', cls: '' },
  { g: 'easy', label: 'Легко', cls: 'ok' },
];

function renderEmpty(container) {
  const more = held > 0
    ? `<p class="status">Дневной лимит выполнен 💪 Ещё ${held} карточек ждут — можно продолжить, но лучше вернуться завтра.</p>
       <button id="study-more">Позаниматься ещё</button>`
    : '<p class="status">На сегодня всё повторено 🎉<br>Добавь слова во вкладке «Словарь» или «5 слов», или вернись позже.</p>';
  container.innerHTML = `<h1>Учить</h1>${more}`;
  const btn = container.querySelector('#study-more');
  if (btn) btn.onclick = () => loadQueue(container, true);
  refreshBadge(0);
}

function gradeRowHtml(suggest) {
  const now = Date.now();
  return `<div class="grade-row grade-4">${GRADE_BTNS.map((b) => {
    const label = intervalLabel(fsrsSchedule(current, b.g, now), now);
    const hl = suggest === b.g ? ' suggested' : '';
    return `<button class="${b.cls}${hl}" data-g="${b.g}">${b.label}<small>${label}</small></button>`;
  }).join('')}</div>`;
}

function answerHtml(w, suggest) {
  const e = escapeHtml;
  const showEs = currentType !== 'es-ru'; // в карточке «Что это значит?» слово уже на лицевой стороне
  return `
    ${showEs ? `<div class="study-es"><b>${e(w.es)}</b> ${w.gender ? `<span class="muted">(${e(w.gender)})</span>` : ''}</div>` : ''}
    <div class="study-ru">${e(w.ru)}</div>
    ${w.example ? `<div class="word-ex">${e(w.example)}${w.exampleRu ? `<br><span class="muted">${e(w.exampleRu)}</span>` : ''}</div>` : ''}
    <button id="study-say">🔊 Озвучить</button>
    ${gradeRowHtml(suggest)}`;
}

function verdictHtml(result, said) {
  const e = escapeHtml;
  const label = { ok: '✅ Верно!', close: '🟡 Почти — сравни с ответом', wrong: '❌ Не совсем' }[result];
  return `<div class="${result === 'ok' ? 'gr-ok' : 'gr-bad'}">${label}</div>${said ? `<div class="word-ex">Твой ответ: «${e(said)}»</div>` : ''}`;
}

const SUGGEST = { ok: 'good', close: 'hard', wrong: 'again' };

function frontHtml(w, type) {
  const e = escapeHtml;
  switch (type) {
    case 'es-ru':
      return `<div class="study-front"><b>${e(w.es)}</b></div><button id="study-hear">🔊</button>`;
    case 'listen':
      return '<div class="study-front">🎧</div><button id="study-hear">🔊 Прослушать ещё раз</button>';
    case 'type':
      return `<div class="study-front"><b>${e(w.ru)}</b></div>
        <input id="study-input" type="text" placeholder="Напиши по-испански…" autocapitalize="off" autocomplete="off">
        <button id="study-check">Проверить</button>`;
    case 'cloze': {
      const c = makeCloze(w.example, w.es);
      return `<div class="study-cloze">${e(c.text)}</div>
        ${w.exampleRu ? `<div class="muted study-hint">${e(w.exampleRu)}</div>` : ''}
        <input id="study-input" type="text" placeholder="Какое слово пропущено?" autocapitalize="off" autocomplete="off">
        <button id="study-check">Проверить</button>`;
    }
    case 'speak':
      return `<div class="study-front"><b>${e(w.ru)}</b></div><button id="study-speak">🎤 Сказать по-испански</button>`;
    default:
      return `<div class="study-front"><b>${e(w.ru)}</b></div>`;
  }
}

function reveal(container, suggest, verdict = '') {
  const back = container.querySelector('#study-back');
  back.innerHTML = verdict + answerHtml(current, suggest);
  back.classList.remove('hidden');
  ['#study-reveal', '#study-check', '#study-speak'].forEach((s) => {
    const el = container.querySelector(s);
    if (el) el.classList.add('hidden');
  });
  back.querySelector('#study-say').onclick = () => speak(current.es);
  back.querySelectorAll('[data-g]').forEach((b) => { b.onclick = () => grade(container, b.dataset.g); });
}

async function grade(container, g) {
  if (busy) return;
  busy = true;
  try {
    const updated = fsrsSchedule(current, g, Date.now());
    await putWord(updated);
    await recordStudyDay();
    await recordActivity('review');
    if (g === 'again') await recordActivity('again');
    if (!container.querySelector('.study-card')) return; // ушли на другой экран
    queue = queue.filter((w) => w.id !== current.id);
    if (g === 'again') queue.push(updated); // вернуть в конец очереди на сегодня
    refreshBadge(queue.length);
    renderCard(container);
  } finally {
    busy = false;
  }
}

function renderCard(container) {
  if (queue.length === 0) { renderEmpty(container); return; }
  current = queue[0];
  const caps = { tts: canSpeak(), asr: canRecognize() };
  currentType = pickCardType(current, caps, mode);
  if (currentType === 'cloze' && !makeCloze(current.example, current.es)) currentType = 'ru-es';
  const needsReveal = ['ru-es', 'es-ru', 'listen'].includes(currentType);
  container.innerHTML = `
    <h1>Учить <span class="muted">(осталось ${queue.length})</span></h1>
    <div class="study-card">
      <div class="study-type">${escapeHtml(CARD_TYPES[currentType])}</div>
      ${frontHtml(current, currentType)}
      ${needsReveal ? '<button id="study-reveal">Показать ответ</button>' : '<button id="study-giveup" class="ghost">Не знаю — показать</button>'}
      <p id="study-status" class="status"></p>
      <div id="study-back" class="hidden"></div>
    </div>`;

  const q = (s) => container.querySelector(s);
  if (q('#study-reveal')) q('#study-reveal').onclick = () => reveal(container, null);
  if (q('#study-giveup')) q('#study-giveup').onclick = () => { q('#study-giveup').classList.add('hidden'); reveal(container, 'again'); };
  if (q('#study-hear')) q('#study-hear').onclick = () => speak(current.es);
  if (currentType === 'listen' || currentType === 'es-ru') speak(current.es);

  const input = q('#study-input');
  if (input) {
    const expected = currentType === 'cloze' ? makeCloze(current.example, current.es).answer : current.es;
    const check = () => {
      const said = input.value.trim();
      if (!said) return;
      input.disabled = true;
      const r = checkAnswer(expected, said);
      if (q('#study-giveup')) q('#study-giveup').classList.add('hidden');
      reveal(container, SUGGEST[r], verdictHtml(r, said));
    };
    q('#study-check').onclick = check;
    input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); check(); } });
    input.focus();
  }

  if (q('#study-speak')) {
    q('#study-speak').onclick = async () => {
      const status = q('#study-status');
      status.textContent = 'Слушаю… говори сейчас';
      try {
        const heard = await recognizeOnce('es-ES');
        if (!container.querySelector('#study-back')) return;
        status.textContent = '';
        const r = checkAnswer(current.es, heard);
        if (q('#study-giveup')) q('#study-giveup').classList.add('hidden');
        reveal(container, SUGGEST[r], verdictHtml(r, heard));
      } catch (err) {
        const s = container.querySelector('#study-status');
        if (s) s.textContent = `${err.message} Можно нажать «Не знаю — показать».`;
      }
    };
  }
}

async function loadQueue(container, ignoreLimits = false) {
  const limits = ignoreLimits ? { maxNew: Infinity, maxReviews: Infinity } : await getLimits();
  const words = await getAllWords();
  const r = buildQueue(words, Date.now(), limits);
  queue = r.queue;
  held = r.held;
  if (!container.querySelector('#study-loading, h1')) return;
  refreshBadge(queue.length);
  renderCard(container);
}

async function render(container) {
  current = null;
  container.innerHTML = '<h1>Учить</h1><p class="status" id="study-loading">Загрузка…</p>';
  mode = (await getSetting('cardMode')) || 'mixed';
  await loadQueue(container);
}

registerFeature({ id: 'study', title: 'Учить', icon: '🎓', order: 10, render });
