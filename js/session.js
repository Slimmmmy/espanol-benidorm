// «Занятие на 15 минут»: приложение само собирает маршрут — повторение, новые слова, одна живая практика, итог.
// Шаги — обычные экраны приложения; сверху идёт полоска занятия с прогрессом и кнопкой «Дальше».
import { registerFeature, onRoute } from './app.js';
import { getActivity } from './activity.js';
import { getAllWords, getSetting } from './db.js';
import { buildQueue } from './queue.js';
import { getLimits } from './reminders.js';
import { getCourse } from './profile.js';
import { getStats, dayKey } from './stats.js';
import { dayWord } from './today.js';
import { escapeHtml } from './util.js';
import { icon } from './icons.js';

export const SESSION_MINUTES = 15;
export const REVIEW_TARGET = 20;

// Живая практика чередуется по дням, чтобы занятие не было одинаковым.
const PRACTICE_ROTATION = [
  { hash: '#roleplay', title: 'Сценка', hint: 'разговор в роли', kinds: ['roleplay'], minutes: 6 },
  { hash: '#listening', title: 'Аудио', hint: 'диалог на слух', kinds: ['listening', 'dictation'], minutes: 5 },
  { hash: '#stories', title: 'История', hint: 'рассказ из ваших слов', kinds: ['story'], minutes: 5 },
  { hash: '#reader', title: 'Книга', hint: 'одна страница', kinds: ['reading'], minutes: 6 },
];

// План занятия. Чистая функция: на вход — состояние дня, на выход — шаги.
export function planSession({ queueLeft = 0, dailyAdded = 0, dailyTotal = 5, nextUnit = '', dayNum = 0 } = {}) {
  const steps = [];
  if (queueLeft > 0) {
    const n = Math.min(queueLeft, REVIEW_TARGET);
    steps.push({ id: 'review', title: 'Повторение', hint: `${n} ${cardsWord(n)}`, hash: '#study', target: n, minutes: Math.max(2, Math.round(n / 4)) });
  }
  if (dailyTotal > 0 && dailyAdded < dailyTotal) {
    steps.push({ id: 'words', title: 'Новые слова', hint: 'слова дня', hash: '#daily', minutes: 3 });
  }
  const options = [...PRACTICE_ROTATION];
  if (nextUnit) options.push({ hash: '#teacher', title: 'Урок курса', hint: nextUnit, kinds: ['lesson'], minutes: 6 });
  const p = options[((dayNum % options.length) + options.length) % options.length];
  steps.push({ id: 'practice', title: p.title, hint: p.hint, hash: p.hash, kinds: p.kinds, minutes: p.minutes });
  steps.push({ id: 'summary', title: 'Итог', hint: 'что сделано сегодня', hash: '#session', minutes: 1 });
  return steps;
}

export function cardsWord(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'карточка';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'карточки';
  return 'карточек';
}

// Сделан ли шаг: сравниваем счётчики дня с теми, что были на старте занятия.
export function stepStatus(step, base = {}, now = {}) {
  const act = now.activity || {};
  const was = (k) => base[k] || 0;
  switch (step.id) {
    case 'review': {
      const n = Math.max(0, (act.review || 0) - was('review'));
      return { done: n >= step.target || now.queueLeft === 0, progress: `${Math.min(n, step.target)}/${step.target}` };
    }
    case 'words':
      return { done: (now.dailyTotal || 0) > 0 && (now.dailyAdded || 0) >= now.dailyTotal, progress: `${now.dailyAdded || 0}/${now.dailyTotal || 5}` };
    case 'practice': {
      const done = (step.kinds || []).some((k) => (act[k] || 0) > was(k));
      return { done, progress: done ? 'готово' : '' };
    }
    default:
      return { done: false, progress: '' };
  }
}

const KEY = 'espanol-session';
export function loadSession(today = dayKey(Date.now())) {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    return s && s.day === today ? s : null;
  } catch (e) { return null; }
}
function saveSession(s) {
  try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch (e) { /* необязательно */ }
}

async function dayState() {
  const [words, limits, activity, daily, course] = await Promise.all([
    getAllWords(), getLimits(), getActivity(), getSetting(`daily-${dayKey(Date.now())}`), getCourse(),
  ]);
  const dw = (daily && daily.words) || [];
  const next = course && course.units ? course.units.find((u) => u.status !== 'done') : null;
  return {
    queueLeft: buildQueue(words, Date.now(), limits).queue.length,
    activity,
    dailyAdded: dw.filter((w) => w.added).length,
    dailyTotal: dw.length || 5,
    nextUnit: next ? (next.topic || next.title) : '',
  };
}

export async function startSession() {
  const st = await dayState();
  const dayNum = Math.floor(Date.now() / 86400000);
  const steps = planSession({ ...st, dayNum });
  const s = { day: dayKey(Date.now()), steps, base: { ...st.activity }, idx: 0, startedAt: Date.now() };
  saveSession(s);
  location.hash = steps[0].hash;
  if (steps[0].hash === location.hash) refreshBar();
}

export function totalMinutes(steps) {
  return steps.reduce((sum, st) => sum + (st.minutes || 0), 0);
}

function goTo(s, idx) {
  s.idx = Math.min(idx, s.steps.length - 1);
  saveSession(s);
  const target = s.steps[s.idx].hash;
  if (location.hash === target) refreshBar(); else location.hash = target;
}

let barToken = 0;
async function refreshBar() {
  const slot = document.getElementById('session-slot');
  if (!slot) return;
  const s = loadSession();
  const screen = (document.getElementById('screen') || {}).dataset?.screen;
  if (!s || screen === 'session') { slot.innerHTML = ''; return; }
  const token = ++barToken;
  const step = s.steps[s.idx];
  const st = stepStatus(step, s.base, await dayState());
  if (token !== barToken || !document.getElementById('session-slot')) return;
  const e = escapeHtml;
  const onStep = location.hash === step.hash;
  const last = s.idx >= s.steps.length - 1;
  slot.innerHTML = `<div class="session-bar${st.done ? ' done' : ''}" role="status">
    <div class="sb-dots" aria-hidden="true">${s.steps.map((x, i) => `<span class="${i < s.idx ? 'past' : i === s.idx ? 'cur' : ''}"></span>`).join('')}</div>
    <a class="sb-text" href="${e(step.hash)}"><span class="sb-step">Занятие · шаг ${s.idx + 1} из ${s.steps.length}</span>
      <b>${e(step.title)}</b>${st.progress ? ` <span class="sb-prog">${e(st.progress)}</span>` : ''}${!onStep ? ' <span class="sb-prog">— вернуться</span>' : ''}</a>
    <button type="button" class="sb-next${st.done ? '' : ' ghost'}">${st.done ? 'Дальше' : (last ? 'Итог' : 'Пропустить')}${icon('arrow', 'ic ic-sm')}</button>
  </div>`;
  slot.querySelector('.sb-next').onclick = () => goTo(s, s.idx + 1);
}

onRoute(() => { refreshBar(); });
if (typeof window !== 'undefined') window.addEventListener('es-activity', () => refreshBar());

function fmtMinutes(ms) {
  const m = Math.max(1, Math.round(ms / 60000));
  return `${m} мин`;
}

async function render(container) {
  const e = escapeHtml;
  const s = loadSession();
  const st = await dayState();
  if (!s) {
    const steps = planSession({ ...st, dayNum: Math.floor(Date.now() / 86400000) });
    container.innerHTML = `
      <h1>Занятие на ${SESSION_MINUTES} минут</h1>
      <p class="lead">Приложение само ведёт по шагам — ничего выбирать не нужно.</p>
      <ol class="plan-list">${steps.map((x) => `<li><b>${e(x.title)}</b> <span class="muted">${e(x.hint)} · ~${x.minutes} мин</span></li>`).join('')}</ol>
      <button id="ses-start" class="big">${icon('play', 'ic ic-sm')} Начать</button>`;
    container.querySelector('#ses-start').onclick = startSession;
    return;
  }
  const stats = await getStats();
  const act = st.activity;
  const d = (k) => Math.max(0, (act[k] || 0) - (s.base[k] || 0));
  const rows = s.steps.filter((x) => x.id !== 'summary').map((x) => {
    const r = stepStatus(x, s.base, st);
    return `<li class="${r.done ? 'done' : ''}"><span class="goal-check">${r.done ? icon('check') : ''}</span><span><b>${e(x.title)}</b> <span class="muted">${e(r.done ? 'сделано' : 'пропущено')}</span></span></li>`;
  }).join('');
  container.innerHTML = `
    <h1>Итог занятия</h1>
    <section class="summary-card">
      <div class="summary-hello es">¡Buen trabajo!</div>
      <div class="summary-stats">
        <div><b>${fmtMinutes(Date.now() - s.startedAt)}</b><span>занятие</span></div>
        <div><b>${d('review')}</b><span>${cardsWord(d('review'))}</span></div>
        <div><b>${d('newWord')}</b><span>новых слов</span></div>
        <div><b>${stats.streak || 0}</b><span>${dayWord(stats.streak || 0)} подряд</span></div>
      </div>
      <ul class="summary-steps">${rows}</ul>
    </section>
    <button id="ses-finish" class="big">Завершить</button>`;
  container.querySelector('#ses-finish').onclick = () => {
    saveSession(null);
    location.hash = '#today';
  };
}

registerFeature({ id: 'session', title: 'Занятие', icon: '⏱️', order: 3, render });
