import { registerFeature } from './app.js';
import { getStats } from './stats.js';
import { exportAll, getAllMistakes } from './db.js';
import { lastNDays } from './activity.js';
import { forecastDue } from './queue.js';
import { escapeHtml } from './util.js';

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

// Столбиковая диаграмма (inline SVG): тонкие столбики со скруглённым верхом, подписи — текстом,
// подсказка по наведению/нажатию через <title>, крупные невидимые зоны нажатия.
export function barChartSvg(values, labels, { height = 120, unit = '' } = {}) {
  const n = values.length;
  const w = 320;
  const top = 18;
  const bottom = 20;
  const plotH = height - top - bottom;
  const max = Math.max(1, ...values);
  const slot = w / n;
  const barW = Math.max(6, Math.min(22, slot - 2));
  const peak = values.indexOf(Math.max(...values));
  const bars = values.map((v, i) => {
    const x = i * slot + (slot - barW) / 2;
    const h = v > 0 ? Math.max(3, (v / max) * plotH) : 0;
    const y = top + plotH - h;
    const r = Math.min(4, barW / 2, h);
    const path = h > 0
      ? `M${x},${top + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${top + plotH} Z`
      : '';
    const tip = `${escapeHtml(labels[i].full || labels[i].short)}: ${v}${unit}`;
    const showLabel = n <= 7 || i % 2 === (n - 1) % 2;
    return `<g class="bar-g"><title>${tip}</title>
      <rect class="bar-hit" x="${i * slot}" y="0" width="${slot}" height="${height}"></rect>
      ${path ? `<path class="bar" d="${path}"></path>` : ''}
      ${i === peak && v > 0 ? `<text class="bar-val" x="${x + barW / 2}" y="${y - 5}">${v}</text>` : ''}
      ${showLabel ? `<text class="bar-lbl" x="${x + barW / 2}" y="${height - 5}">${escapeHtml(labels[i].short)}</text>` : ''}
    </g>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${w} ${height}" role="img">
    <line class="chart-base" x1="0" x2="${w}" y1="${top + plotH}" y2="${top + plotH}"></line>${bars}</svg>`;
}

function tableHtml(rows, headA, headB) {
  const e = escapeHtml;
  return `<details class="tch-extra"><summary>Таблица</summary><table class="mini-table">
    <tr><th>${e(headA)}</th><th>${e(headB)}</th></tr>
    ${rows.map(([a, b]) => `<tr><td>${e(a)}</td><td>${e(b)}</td></tr>`).join('')}</table></details>`;
}

const SOURCE_LABEL = { grammar: 'грамматика', lesson: 'урок', assignment: 'задание', chat: 'чат', roleplay: 'сценка', daily: '5 слов' };

async function render(container) {
  container.innerHTML = '<h1>Прогресс</h1><p class="status" id="prog-loading">Загрузка…</p>';
  const [s, snap, mistakes] = await Promise.all([getStats(), exportAll(), getAllMistakes()]);
  if (!container.querySelector('#prog-loading')) return;
  const e = escapeHtml;
  const now = Date.now();

  const days = lastNDays((k) => snap.settings[k], now, 14);
  const reviews = days.map((d) => d.activity.review || 0);
  const dayLabels = days.map((d) => {
    const dt = new Date(d.key + 'T12:00:00');
    return { short: String(dt.getDate()), full: `${WEEKDAYS[dt.getDay()]}, ${dt.getDate()}.${dt.getMonth() + 1}` };
  });
  const totalReviews = reviews.reduce((a, b) => a + b, 0);
  const totalAgain = days.reduce((a, d) => a + (d.activity.again || 0), 0);
  const accuracy = totalReviews ? Math.round((1 - totalAgain / totalReviews) * 100) : null;
  const activeDays = reviews.filter((v) => v > 0).length;

  const forecast = forecastDue(snap.words, now, 7);
  const fLabels = forecast.map((_, i) => {
    const dt = new Date(now + i * 86400000);
    const short = i === 0 ? 'сег' : WEEKDAYS[dt.getDay()];
    return { short, full: i === 0 ? 'сегодня (с просроченными)' : `${WEEKDAYS[dt.getDay()]}, ${dt.getDate()}.${dt.getMonth() + 1}` };
  });

  const sources = {};
  for (const m of mistakes) {
    const t = (m.topic || '').trim();
    if (!t) continue;
    (sources[t] = sources[t] || new Set()).add(SOURCE_LABEL[m.source] || 'грамматика');
  }
  const weakHtml = s.weak.length
    ? s.weak.slice(0, 12).map((w) => `<div class="word-local">📌 ${e(w.topic)} — ${w.count}<span class="muted"> · ${e([...(sources[w.topic] || [])].join(', '))}</span></div>`).join('')
    : '<p class="status">Пока ошибок не замечено — так держать!</p>';

  container.innerHTML = `
    <h1>Прогресс</h1>
    <div class="stats-grid">
      <div class="stat"><div class="stat-num">${s.streak}</div><div class="stat-lbl">дней подряд 🔥${s.freezes ? ` · ${'❄️'.repeat(s.freezes)}` : ''}</div></div>
      <div class="stat"><div class="stat-num">${s.words}</div><div class="stat-lbl">слов в словаре</div></div>
      <div class="stat"><div class="stat-num">${s.learned}</div><div class="stat-lbl">выучено</div></div>
      <div class="stat"><div class="stat-num">${accuracy === null ? '—' : accuracy + '%'}</div><div class="stat-lbl">вспоминаешь (14 дн.)</div></div>
    </div>

    <h2>Повторения за 14 дней</h2>
    <div class="study-card chart-card">
      <div class="muted">${totalReviews} карточек · занимался ${activeDays} из 14 дней</div>
      ${barChartSvg(reviews, dayLabels)}
      ${tableHtml(days.map((d, i) => [dayLabels[i].full, String(reviews[i])]), 'День', 'Карточек')}
    </div>

    <h2>Прогноз на неделю</h2>
    <div class="study-card chart-card">
      <div class="muted">Сколько карточек придёт на повтор</div>
      ${barChartSvg(forecast, fLabels)}
      ${tableHtml(forecast.map((v, i) => [fLabels[i].full, String(v)]), 'День', 'Карточек')}
    </div>

    <h2>Слабые темы</h2>
    <p class="muted">Собираются из грамматики, уроков, заданий, чата и сценок. Учитель подбирает уроки по ним.</p>
    ${weakHtml}
  `;
}

registerFeature({ id: 'progress', title: 'Прогресс', icon: '📊', order: 50, render });
