import { registerFeature } from './app.js';
import { getStats } from './stats.js';
import { escapeHtml } from './util.js';

async function render(container) {
  container.innerHTML = '<h1>Прогресс</h1><p class="status" id="prog-loading">Загрузка…</p>';
  const s = await getStats();
  if (!container.querySelector('#prog-loading')) return;
  const e = escapeHtml;
  const weakHtml = s.weak.length
    ? s.weak.map((w) => `<div class="word-local">📌 ${e(w.topic)} — ${w.count}</div>`).join('')
    : '<p class="status">Пока нет ошибок в грамматике — так держать!</p>';
  container.innerHTML = `
    <h1>Прогресс</h1>
    <div class="stats-grid">
      <div class="stat"><div class="stat-num">${s.streak}</div><div class="stat-lbl">дней подряд 🔥</div></div>
      <div class="stat"><div class="stat-num">${s.words}</div><div class="stat-lbl">слов в словаре</div></div>
      <div class="stat"><div class="stat-num">${s.learned}</div><div class="stat-lbl">выучено</div></div>
      <div class="stat"><div class="stat-num">${s.due}</div><div class="stat-lbl">на повтор сегодня</div></div>
    </div>
    <h2>Слабые темы (грамматика)</h2>
    ${weakHtml}
  `;
}

registerFeature({ id: 'progress', title: 'Прогресс', icon: '📊', order: 50, render });
