import { registerFeature } from './app.js';
import { getStats, dayKey } from './stats.js';
import { getCourse, getAssignments } from './profile.js';
import { getSetting } from './db.js';
import { escapeHtml } from './util.js';

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

async function render(container) {
  container.innerHTML = '<h1>Сегодня</h1><p class="status" id="td-loading">Загрузка…</p>';
  const [stats, course, assignments, daily] = await Promise.all([
    getStats(),
    getCourse(),
    getAssignments(),
    getSetting(`daily-${dayKey(Date.now())}`),
  ]);
  if (!container.querySelector('#td-loading')) return;
  const s = summarizeToday({ stats, course, assignments, daily });

  const dailyDone = s.dailyTotal > 0 && s.dailyAdded >= s.dailyTotal;
  const courseCard = s.nextUnitTitle
    ? card('👨‍🏫', 'Урок курса', s.nextUnitTitle, 'Начать', '#teacher', false)
    : card('👨‍🏫', 'Курс', s.hasCourse ? 'Курс пройден 🎉' : 'Программа ещё не создана', s.hasCourse ? 'Открыть' : 'Создать', '#teacher', s.hasCourse);

  container.innerHTML = `
    <h1>Сегодня</h1>
    <div class="study-card"><div class="daily-progress">🔥 Стрик: ${s.streak} дн. · на повтор: ${s.due}</div></div>
    ${card('🗓️', '5 слов дня', dailyDone ? `Готово: ${s.dailyAdded}/${s.dailyTotal}` : `Добавлено ${s.dailyAdded}/${s.dailyTotal}`, dailyDone ? 'Открыть' : 'Учить', '#daily', dailyDone)}
    ${card('🎓', 'Повторение', s.due > 0 ? `Карточек на сегодня: ${s.due}` : 'На сегодня всё повторено', s.due > 0 ? 'Повторять' : 'Открыть', '#study', s.due === 0)}
    ${courseCard}
    ${card('📝', 'Задания', s.openAssignments > 0 ? `Активных: ${s.openAssignments}` : 'Нет активных заданий', s.openAssignments > 0 ? 'Выполнить' : 'Получить', '#assignments', s.openAssignments === 0)}
  `;
  container.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => { location.hash = b.dataset.go; }; });
}

registerFeature({ id: 'today', title: 'Сегодня', icon: '☀️', order: 4, render });
