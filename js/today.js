import { registerFeature } from './app.js';
import { getStats, dayKey } from './stats.js';
import { getAssignments } from './profile.js';
import { nextLessonTitle } from './teacher.js';
import { getSetting, getAllWords } from './db.js';
import { escapeHtml } from './util.js';
import { buildQueue } from './queue.js';
import { getActivity, dailyGoal } from './activity.js';
import { getLimits, refreshBadge } from './reminders.js';
import { icon } from './icons.js';
import { loadSession, startSession, planSession, totalMinutes } from './session.js';
import { renderOnboarding, needsOnboarding } from './onboarding.js';

export function summarizeToday({ stats, nextLesson = '', assignments, daily } = {}) {
  const dw = (daily && daily.words) || [];
  const dailyTotal = dw.length || 5;
  const dailyAdded = dw.filter((w) => w.added).length;
  const open = (Array.isArray(assignments) ? assignments : []).filter((a) => a.status !== 'done').length;
  return {
    streak: (stats && stats.streak) || 0,
    due: (stats && stats.due) || 0,
    dailyAdded,
    dailyTotal,
    nextUnitTitle: nextLesson || '',
    openAssignments: open,
  };
}

// Приветствие по времени суток — по-испански.
export function greeting(hour) {
  if (hour >= 6 && hour < 14) return '¡Buenos días!';
  if (hour >= 14 && hour < 21) return '¡Buenas tardes!';
  return '¡Buenas noches!';
}

export function dayWord(n) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'день';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'дня';
  return 'дней';
}

function card(ic, title, sub, btn, hash, done) {
  const e = escapeHtml;
  return `<button class="td-card${done ? ' td-done' : ''}" data-go="${e(hash)}">
    <span class="td-icon">${icon(done ? 'check' : ic)}</span>
    <span class="td-text"><span class="td-title">${e(title)}</span><span class="td-sub">${e(sub)}</span></span>
    <span class="td-cta">${e(btn)}${icon('arrow', 'ic ic-sm')}</span>
  </button>`;
}

function ringSvg(done, total) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const frac = total ? done / total : 0;
  return `<svg class="goal-ring" viewBox="0 0 64 64" aria-hidden="true">
    <circle class="ring-track" cx="32" cy="32" r="${r}"/>
    <circle class="ring-fill" cx="32" cy="32" r="${r}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - frac)).toFixed(2)}"/>
  </svg>`;
}

function sessionCta(session, goal, plan) {
  if (session) {
    const st = session.steps[session.idx];
    return `<button class="session-cta" data-go="${escapeHtml(st.hash)}">
      <span class="cta-icon">${icon('play')}</span>
      <span class="cta-text"><b>Продолжить занятие</b><span>Шаг ${session.idx + 1} из ${session.steps.length}: ${escapeHtml(st.title)}</span></span>
    </button>`;
  }
  const mins = totalMinutes(plan);
  return `<button class="session-cta${goal.complete ? ' quiet' : ''}" id="td-start">
    <span class="cta-icon">${icon('play')}</span>
    <span class="cta-text"><b>${goal.complete ? 'Ещё одно занятие' : 'Начать занятие'}</b><span>${plan.map((x) => escapeHtml(x.title)).filter((t) => t !== 'Итог').join(' → ')} · ~${mins} мин</span></span>
  </button>`;
}

function goalHtml(goal) {
  const e = escapeHtml;
  const left = goal.total - goal.done;
  // Шаги цели — одной строкой: подробный маршрут теперь в кнопке «Начать занятие».
  const steps = goal.steps.map((st) => `<span class="goal-pill${st.done ? ' done' : ''}">${st.done ? icon('check', 'ic ic-sm') : ''}${e(st.title)}</span>`).join('');
  const head = goal.complete
    ? '<div class="goal-title">Цель дня выполнена</div><div class="goal-sub es">¡Muy bien! Hasta mañana.</div>'
    : `<div class="goal-title">Цель дня</div><div class="goal-sub">${left === 1 ? 'Остался один шаг' : `Осталось шагов: ${left}`}</div>`;
  return `<section class="goal${goal.complete ? ' goal-complete' : ''}">
    <div class="goal-head">
      <div class="goal-ringbox" role="img" aria-label="Выполнено ${goal.done} из ${goal.total}">${ringSvg(goal.done, goal.total)}<span class="goal-count">${goal.done}<small>/${goal.total}</small></span></div>
      <div>${head}</div>
    </div>
    <div class="goal-pills">${steps}</div>
  </section>`;
}

function heroHtml(stats) {
  const e = escapeHtml;
  const date = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const freezes = stats.freezes || 0;
  const ice = Array.from({ length: freezes }, () => `<span class="chip chip-ice" title="Заморозка: спасёт серию, если пропустишь день">${icon('snow', 'ic ic-sm')}</span>`).join('');
  const risk = stats.streakAtRisk && stats.streak > 0 ? '<p class="hero-note">Позанимайся сегодня, чтобы не потерять серию.</p>' : '';
  const streak = stats.streak > 0
    ? `<span class="chip chip-streak">${icon('flame', 'ic ic-sm')}<b>${stats.streak}</b>&nbsp;${dayWord(stats.streak)} подряд</span>`
    : `<span class="chip">${icon('flame', 'ic ic-sm')}Начни серию сегодня</span>`;
  return `<header class="hero">
    <div class="hero-date">${e(date)}</div>
    <div class="hero-hello es">${e(greeting(new Date().getHours()))}</div>
    <div class="hero-row">${streak}${ice}</div>
    ${risk}
  </header>`;
}

async function render(container) {
  if (await needsOnboarding()) { renderOnboarding(container, () => render(container)); return; }
  container.innerHTML = '<p class="status" id="td-loading">Загрузка…</p>';
  const [stats, nextLesson, assignments, daily, words, limits, activity] = await Promise.all([
    getStats(),
    nextLessonTitle(),
    getAssignments(),
    getSetting(`daily-${dayKey(Date.now())}`),
    getAllWords(),
    getLimits(),
    getActivity(),
  ]);
  if (!container.querySelector('#td-loading')) return;
  const queueLeft = buildQueue(words, Date.now(), limits).queue.length;
  const s = summarizeToday({ stats: { ...stats, due: queueLeft }, nextLesson, assignments, daily });
  const goal = dailyGoal({ queueLeft, activity, dailyAdded: s.dailyAdded, dailyTotal: (daily && daily.words && daily.words.length) || 5 });
  refreshBadge(queueLeft);

  const dailyDone = s.dailyTotal > 0 && s.dailyAdded >= s.dailyTotal;
  const plan = planSession({ queueLeft, dailyAdded: s.dailyAdded, dailyTotal: s.dailyTotal, nextUnit: nextLesson, dayNum: Math.floor(Date.now() / 86400000) });
  const session = loadSession();
  const courseCard = s.nextUnitTitle
    ? card('teacher', 'Учебник', s.nextUnitTitle, 'Учить', '#teacher', (activity.lesson || 0) > 0)
    : card('teacher', 'Учебник', 'Пройден целиком — можно повторять', 'Открыть', '#teacher', true);

  container.innerHTML = `
    <h1 class="sr-only">Сегодня</h1>
    ${heroHtml(stats)}
    ${sessionCta(session, goal, plan)}
    ${goalHtml(goal)}
    <h2 class="section-label">Или выберите сами</h2>
    <div class="td-list">
      ${card('study', 'Повторение', s.due > 0 ? `Карточек на сегодня: ${s.due}` : 'На сегодня всё повторено', s.due > 0 ? 'Повторять' : 'Открыть', '#study', s.due === 0)}
      ${card('daily', '5 слов дня', dailyDone ? `Готово: ${s.dailyAdded} из ${s.dailyTotal}` : `Добавлено ${s.dailyAdded} из ${s.dailyTotal}`, dailyDone ? 'Открыть' : 'Учить', '#daily', dailyDone)}
      ${card('reader', 'Книга', 'Сфотографируйте страницу — переведу и выберу слова', 'Читать', '#reader', (activity.reading || 0) > 0)}
      ${card('roleplay', 'Сценка', 'Бар, Mercadona, хозяин квартиры…', 'Играть', '#roleplay', (activity.roleplay || 0) > 0)}
      ${courseCard}
      ${card('assignments', 'Задания', s.openAssignments > 0 ? `Активных: ${s.openAssignments}` : 'Нет активных заданий', s.openAssignments > 0 ? 'Выполнить' : 'Получить', '#assignments', false)}
    </div>
  `;
  container.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => { location.hash = b.dataset.go; }; });
  const start = container.querySelector('#td-start');
  if (start) start.onclick = () => startSession();
}

registerFeature({ id: 'today', title: 'Сегодня', icon: '☀️', order: 4, render });
