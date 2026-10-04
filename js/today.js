import { registerFeature } from './app.js';
import { getStats, dayKey } from './stats.js';
import { getCourse, getAssignments } from './profile.js';
import { getSetting, getAllWords } from './db.js';
import { escapeHtml } from './util.js';
import { buildQueue } from './queue.js';
import { getActivity, dailyGoal } from './activity.js';
import { getLimits, refreshBadge } from './reminders.js';

export function summarizeToday({ stats, course, assignments, daily } = {}) {
  const dw = (daily && daily.words) || [];
  const dailyTotal = dw.length || 5;
  const dailyAdded = dw.filter((w) => w.added).length;
  const next = (course && course.units) ? (course.units.find((u) => u.status !== 'done') || null) : null;
  const open = (Array.isArray(assignments) ? assignments : []).filter((a) => a.status !== 'done').length;
  return {
    streak: (stats && stats.streak) || 0,
    due: (stats && stats.due) || 0,
    dailyAdded,
    dailyTotal,
    nextUnitTitle: next ? next.title : '',
    hasCourse: !!course,
    openAssignments: open,
  };
}

function card(icon, title, sub, btn, hash, done) {
  const e = escapeHtml;
  return `<div class="word-card td-card${done ? ' td-done' : ''}">
    <div class="td-row">
      <span class="td-icon">${icon}</span>
      <div class="td-text"><div class="word-main">${e(title)}</div><div class="muted">${e(sub)}</div></div>
      <button data-go="${e(hash)}">${e(btn)}</button>
    </div>
  </div>`;
}

function goalHtml(goal) {
  const e = escapeHtml;
  const pct = Math.round((goal.done / goal.total) * 100);
  const steps = goal.steps.map((st) => `
    <button class="goal-step${st.done ? ' done' : ''}" data-go="${e(st.hash)}">
      <span class="goal-check">${st.done ? '✓' : ''}</span>
      <span class="goal-text"><b>${e(st.title)}</b><span class="muted">${e(st.hint)}</span></span>
    </button>`).join('');
  const head = goal.complete
    ? '<div class="goal-title">🎉 ¡Muy bien! Цель дня выполнена</div>'
    : `<div class="goal-title">Цель дня: ${goal.done} из ${goal.total}</div>`;
  return `<div class="study-card goal${goal.complete ? ' goal-complete' : ''}">
    ${head}
    <div class="goal-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${goal.total}" aria-valuenow="${goal.done}"><span style="width:${pct}%"></span></div>
    ${steps}
  </div>`;
}

function streakHtml(stats) {
  const freezes = stats.freezes || 0;
  const ice = freezes ? ` · ${'❄️'.repeat(freezes)} заморозк${freezes === 1 ? 'а' : 'и'}` : '';
  const risk = stats.streakAtRisk && stats.streak > 0 ? '<div class="muted">Позанимайся сегодня, чтобы не потерять серию</div>' : '';
  return `<div class="study-card"><div class="daily-progress">🔥 Серия: ${stats.streak} дн.${ice}</div>${risk}
    <div class="muted streak-note">Каждые 7 дней подряд дают ❄️ — она спасёт серию, если пропустишь день.</div></div>`;
}

async function render(container) {
  container.innerHTML = '<h1>Сегодня</h1><p class="status" id="td-loading">Загрузка…</p>';
  const [stats, course, assignments, daily, words, limits, activity] = await Promise.all([
    getStats(),
    getCourse(),
    getAssignments(),
    getSetting(`daily-${dayKey(Date.now())}`),
    getAllWords(),
    getLimits(),
    getActivity(),
  ]);
  if (!container.querySelector('#td-loading')) return;
  const queueLeft = buildQueue(words, Date.now(), limits).queue.length;
  const s = summarizeToday({ stats: { ...stats, due: queueLeft }, course, assignments, daily });
  const goal = dailyGoal({ queueLeft, activity, dailyAdded: s.dailyAdded, dailyTotal: (daily && daily.words && daily.words.length) || 5 });
  refreshBadge(queueLeft);

  const dailyDone = s.dailyTotal > 0 && s.dailyAdded >= s.dailyTotal;
  const courseCard = s.nextUnitTitle
    ? card('👨‍🏫', 'Урок курса', s.nextUnitTitle, 'Начать', '#teacher', false)
    : card('👨‍🏫', 'Курс', s.hasCourse ? 'Курс пройден 🎉' : 'Программа ещё не создана', s.hasCourse ? 'Открыть' : 'Создать', '#teacher', s.hasCourse);

  container.innerHTML = `
    <h1>Сегодня</h1>
    ${goalHtml(goal)}
    ${streakHtml(stats)}
    ${card('🎓', 'Повторение', s.due > 0 ? `Карточек на сегодня: ${s.due}` : 'На сегодня всё повторено', s.due > 0 ? 'Повторять' : 'Открыть', '#study', s.due === 0)}
    ${card('🗓️', '5 слов дня', dailyDone ? `Готово: ${s.dailyAdded}/${s.dailyTotal}` : `Добавлено ${s.dailyAdded}/${s.dailyTotal}`, dailyDone ? 'Открыть' : 'Учить', '#daily', dailyDone)}
    ${card('🎭', 'Сценка', 'Поговори в роли: бар, Mercadona, хозяин квартиры…', 'Играть', '#roleplay', (activity.roleplay || 0) > 0)}
    ${courseCard}
    ${card('📝', 'Задания', s.openAssignments > 0 ? `Активных: ${s.openAssignments}` : 'Нет активных заданий', s.openAssignments > 0 ? 'Выполнить' : 'Получить', '#assignments', s.openAssignments === 0)}
  `;
  container.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => { location.hash = b.dataset.go; }; });
}

registerFeature({ id: 'today', title: 'Сегодня', icon: '☀️', order: 4, render });
