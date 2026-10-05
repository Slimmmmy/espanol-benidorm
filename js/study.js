import { registerFeature } from './app.js';
import { getAllWords, putWord, getSetting } from './db.js';
import { fsrsSchedule, intervalLabel } from './fsrs.js';
import { buildQueue } from './queue.js';
import { pickCardType, makeCloze, checkAnswer, checkNounAnswer, nounGender, bareNoun, withArticle, CARD_TYPES } from './exercises.js';
import { conjugate, conjugationTable, checkForm, tenseById, PERSONS } from './verbs.js';
import { speak, canSpeak } from './tts.js';
import { recognizeOnce, canRecognize } from './asr.js';
import { escapeHtml } from './util.js';
import { recordStudyDay } from './stats.js';
import { recordActivity } from './activity.js';
import { getLimits, refreshBadge } from './reminders.js';
import { icon } from './icons.js';

let queue = [];
let current = null;
let currentType = 'ru-es';
let held = 0;
let mode = 'mixed';
let busy = false;
let person = 0; // лицо для карточки глагола (выбирается при каждом показе)

const GRADE_BTNS = [
  { g: 'again', label: 'Не помню', cls: 'danger' },
  { g: 'hard', label: 'Трудно', cls: 'hard' },
  { g: 'good', label: 'Помню', cls: '' },
  { g: 'easy', label: 'Легко', cls: 'ok' },
];

function renderEmpty(container) {
  const more = held > 0
    ? `<p class="status">Дневной лимит выполнен. Ещё ${held} карточек ждут — можно продолжить, но лучше вернуться завтра.</p>
       <button id="study-more">Позаниматься ещё</button>`
    : '<p class="status">На сегодня всё повторено.<br>Новые слова — в «Словаре» и в «5 словах дня» на вкладке «Сегодня».</p>';
  container.innerHTML = `<h1>Повторение</h1>${more}${drillsLink()}`;
  const btn = container.querySelector('#study-more');
  if (btn) btn.onclick = () => loadQueue(container, true);
  refreshBadge(0);
}

function gradeRowHtml(suggest) {
  const now = Date.now();
  return `<div class="grade-row grade-4">${GRADE_BTNS.map((b) => {
    const label = intervalLabel(fsrsSchedule(current, b.g, now), now);
    const hl = suggest === b.g ? ' suggested' : '';
    const key = GRADE_BTNS.indexOf(b) + 1;
    return `<button class="${b.cls}${hl}" data-g="${b.g}" aria-label="${b.label}, следующий повтор через ${label}" aria-keyshortcuts="${key}">${b.label}<small>${label}</small></button>`;
  }).join('')}</div>`;
}

function drillsLink() {
  return `<a class="drills-link" href="#drills">${icon('grammar', 'ic ic-sm')}<span>Тренажёры: глаголы, ser/estar, por/para, род, ложные друзья</span>${icon('arrow', 'ic ic-sm')}</a>`;
}

const verbForm = (w) => conjugate(w.verb, w.tense, person);

// Испанское слово с цветным артиклем (el — бирюзовый, la — апельсиновый): род запоминается глазами.
export function nounHtml(w) {
  const e = escapeHtml;
  const g = nounGender(w);
  if (!g) return `<b>${e(w.es)}</b>`;
  return `<span class="art art-${g}">${g}</span> <b>${e(bareNoun(w.es))}</b>`;
}

function answerHtml(w, suggest) {
  const e = escapeHtml;
  if (w.kind === 'verb') {
    const t = tenseById(w.tense);
    return `
      <div class="study-es"><b>${e(verbForm(w))}</b></div>
      <div class="study-ru">${e(w.verb)} — ${e(w.ru)} · ${e(PERSONS[person])}</div>
      <table class="conj-table" lang="es"><caption>${e(t ? t.title : w.tense)}</caption>${conjugationTable(w.verb, w.tense).map((r, i) => `<tr${i === person ? ' class="cur"' : ''}><th>${e(r.person)}</th><td>${e(r.form)}</td></tr>`).join('')}</table>
      ${t ? `<div class="word-local">${e(t.hint)}</div>` : ''}
      <button id="study-say">${icon('sound', 'ic ic-sm')} Озвучить</button>
      ${gradeRowHtml(suggest)}`;
  }
  if (w.kind === 'fix') {
    return `
      <div class="fix-was"><s>${e(w.wrong)}</s></div>
      <div class="study-es fix-right"><b>${e(w.es)}</b></div>
      ${w.topic ? `<div class="study-ru">${e(w.topic)}</div>` : ''}
      <button id="study-say">${icon('sound', 'ic ic-sm')} Озвучить</button>
      ${gradeRowHtml(suggest)}`;
  }
  const showEs = currentType !== 'es-ru'; // в карточке «Что это значит?» слово уже на лицевой стороне
  return `
    ${showEs ? `<div class="study-es">${nounHtml(w)}</div>` : ''}
    <div class="study-ru">${e(w.ru)}</div>
    ${w.example ? `<div class="word-ex">${e(w.example)}${w.exampleRu ? `<br><span class="muted">${e(w.exampleRu)}</span>` : ''}</div>` : ''}
    <button id="study-say">${icon('sound', 'ic ic-sm')} Озвучить</button>
    ${gradeRowHtml(suggest)}`;
}

function verdictHtml(result, said, note = '') {
  const e = escapeHtml;
  const label = { ok: 'Верно!', close: 'Почти — сравните с ответом', wrong: 'Не совсем' }[result];
  return `<div class="${result === 'ok' ? 'gr-ok' : 'gr-bad'}" role="status">${result === 'ok' ? icon('check', 'ic ic-sm') : ''}${label}</div>${note ? `<div class="word-local">${e(note)}</div>` : ''}${said ? `<div class="word-ex">Ваш ответ: «${e(said)}»</div>` : ''}`;
}

const SUGGEST = { ok: 'good', close: 'hard', wrong: 'again' };

function frontHtml(w, type) {
  const e = escapeHtml;
  switch (type) {
    case 'es-ru':
      return `<div class="study-front es" lang="es"><b>${e(w.es)}</b></div><button id="study-hear">${icon('sound', 'ic ic-sm')} Послушать</button>`;
    case 'listen':
      return `<div class="study-listen" role="img" aria-label="Слово звучит — угадайте на слух">${icon('listening')}</div><button id="study-hear">${icon('sound', 'ic ic-sm')} Прослушать ещё раз</button>`;
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
    case 'verb': {
      const t = tenseById(w.tense);
      return `<div class="study-front es" lang="es"><b>${e(w.verb)}</b></div>
        <div class="muted study-hint">${e(w.ru)}</div>
        <div class="verb-ask"><span class="chip">${e(t ? t.title : w.tense)}</span><span class="chip chip-person" lang="es">${e(PERSONS[person])}</span></div>
        <input id="study-input" type="text" placeholder="Форма глагола…" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" lang="es">
        <button id="study-check">Проверить</button>`;
    }
    case 'fix':
      return `<div class="fix-wrong" lang="es">«${e(w.wrong)}»</div>
        ${w.topic ? `<div class="muted study-hint">Подсказка: ${e(w.topic)}</div>` : ''}
        <input id="study-input" type="text" placeholder="Как правильно?" autocapitalize="sentences" autocomplete="off" spellcheck="false" lang="es">
        <button id="study-check">Проверить</button>`;
    case 'gender':
      return `<div class="study-front es" lang="es"><b>${e(bareNoun(w.es))}</b></div>
        <div class="muted study-hint">${e(w.ru)}</div>
        <div class="gender-row"><button type="button" class="ghost" data-gender="el" aria-keyshortcuts="E">el</button><button type="button" class="ghost" data-gender="la" aria-keyshortcuts="L">la</button></div>`;
    case 'speak':
      return `<div class="study-front"><b>${e(w.ru)}</b></div><button id="study-speak">${icon('mic', 'ic ic-sm')} Сказать по-испански</button>`;
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
  back.querySelector('#study-say').onclick = () => speak(current.kind === 'verb' ? verbForm(current) : withArticle(current));
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
  person = Math.floor(Math.random() * PERSONS.length);
  if (currentType === 'cloze' && !makeCloze(current.example, current.es)) currentType = 'ru-es';
  const needsReveal = ['ru-es', 'es-ru', 'listen'].includes(currentType);
  container.innerHTML = `
    <h1>Повторение <span class="muted">(осталось ${queue.length})</span></h1>
    <div class="study-card">
      <div class="study-type">${escapeHtml(CARD_TYPES[currentType])}</div>
      ${frontHtml(current, currentType)}
      ${needsReveal ? '<button id="study-reveal" aria-keyshortcuts="Space">Показать ответ</button>' : '<button id="study-giveup" class="ghost">Не знаю — показать</button>'}
      <p id="study-status" class="status"></p>
      <div id="study-back" class="hidden"></div>
    </div>
    ${drillsLink()}`;

  const q = (s) => container.querySelector(s);
  if (q('#study-reveal')) q('#study-reveal').onclick = () => reveal(container, null);
  if (q('#study-giveup')) q('#study-giveup').onclick = () => { q('#study-giveup').classList.add('hidden'); reveal(container, 'again'); };
  if (q('#study-hear')) q('#study-hear').onclick = () => speak(current.es);
  if (currentType === 'listen' || currentType === 'es-ru') speak(current.es);

  container.querySelectorAll('[data-gender]').forEach((b) => {
    b.onclick = () => {
      const right = b.dataset.gender === nounGender(current);
      container.querySelectorAll('[data-gender]').forEach((x) => {
        x.disabled = true;
        if (x.dataset.gender === nounGender(current)) x.classList.add('right');
        else if (x === b) x.classList.add('wrong');
      });
      if (q('#study-giveup')) q('#study-giveup').classList.add('hidden');
      reveal(container, right ? 'good' : 'again', verdictHtml(right ? 'ok' : 'wrong', '', right ? '' : `Правильно: ${withArticle(current)}`));
    };
  });

  const input = q('#study-input');
  if (input) {
    const check = () => {
      const said = input.value.trim();
      if (!said) return;
      input.disabled = true;
      let r;
      let note = '';
      if (currentType === 'verb') r = checkForm(verbForm(current), said);
      else if (currentType === 'cloze') r = checkAnswer(makeCloze(current.example, current.es).answer, said);
      else if (currentType === 'type') ({ result: r, note } = checkNounAnswer(current, said));
      else r = checkAnswer(current.es, said);
      if (currentType === 'verb' && r === 'close') note = 'Почти: проверьте ударение.';
      if (q('#study-giveup')) q('#study-giveup').classList.add('hidden');
      reveal(container, SUGGEST[r], verdictHtml(r, said, note));
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
        const heard = await recognizeOnce('es-ES', { expected: current.es, title: 'Скажите по-испански' });
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

// Клавиатура (Mac, iPad с клавиатурой): пробел/Enter — показать ответ, 1–4 — оценка.
export function keyAction(key, { revealed, typing }) {
  if (!revealed) {
    if (typing) return null;
    if (key === ' ' || key === 'Enter') return { reveal: true };
    if (key === 'e' || key === 'l') return { gender: key === 'e' ? 'el' : 'la' };
    return null;
  }
  const i = ['1', '2', '3', '4'].indexOf(key);
  return i >= 0 ? { grade: GRADE_BTNS[i].g } : null;
}

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (ev) => {
    const container = document.querySelector('#screen[data-screen="study"]');
    if (!container || !container.querySelector('.study-card') || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const back = container.querySelector('#study-back');
    const revealed = back && !back.classList.contains('hidden');
    const t = ev.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && !t.disabled;
    const act = keyAction(ev.key, { revealed, typing });
    if (!act) return;
    if (act.gender) {
      const btn = container.querySelector(`[data-gender="${act.gender}"]:not(:disabled)`);
      if (btn) { ev.preventDefault(); btn.click(); }
    } else if (act.reveal) {
      const btn = container.querySelector('#study-reveal:not(.hidden)');
      if (!btn) return;
      ev.preventDefault();
      btn.click();
    } else if (act.grade) {
      ev.preventDefault();
      grade(container, act.grade);
    }
  });
}

async function render(container) {
  current = null;
  container.innerHTML = '<h1>Повторение</h1><p class="status" id="study-loading">Загрузка…</p>';
  mode = (await getSetting('cardMode')) || 'mixed';
  await loadQueue(container);
}

registerFeature({ id: 'study', title: 'Повторение', icon: '🎓', order: 10, render });
