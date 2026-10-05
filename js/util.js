// Чистые утилиты, используемые в нескольких экранах.

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function extractJson(text) {
  if (!text) throw new Error('Пустой ответ модели (нет JSON).');
  let s = String(text).trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('В ответе модели не найден JSON.');
  }
  return JSON.parse(s.slice(start, end + 1));
}

export function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let cur = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

export function similarity(a, b) {
  const x = normalizeText(a), y = normalizeText(b);
  if (!x && !y) return 1;
  if (!x || !y) return 0;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

// Окно последних сообщений для API. step > 1 сдвигает начало окна «ступеньками»,
// чтобы начало запроса долго не менялось и срабатывал кэш промпта.
export function recentMessages(history, max = 20, step = 1) {
  const all = Array.isArray(history) ? history : [];
  const s = Math.max(1, Math.min(step, max));
  const start = all.length > max ? Math.ceil((all.length - max) / s) * s : 0;
  const arr = all
    .slice(start)
    .map((m) => ({ role: m.role, content: m.content }));
  while (arr.length && arr[0].role !== 'user') arr.shift();
  const out = [];
  for (const m of arr) {
    if (out.length && out[out.length - 1].role === m.role) out[out.length - 1] = m;
    else out.push(m);
  }
  return out;
}

// Безопасный рендер лёгкого markdown: сначала экранируем, потом размечаем.
function mdInline(s) {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
}

export function renderMarkdown(text) {
  const lines = escapeHtml(text).split('\n');
  const out = [];
  let list = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { closeList(); out.push('<hr>'); continue; }
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h) { closeList(); out.push(`<div class="md-h">${mdInline(h[1])}</div>`); continue; }
    const ul = line.match(/^[-*•]\s+(.*)$/);
    if (ul) {
      if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
      out.push(`<li>${mdInline(ul[1])}</li>`);
      continue;
    }
    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    if (ol) {
      if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; }
      out.push(`<li>${mdInline(ol[1])}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${mdInline(line)}</p>`);
  }
  closeList();
  return out.join('');
}

// Долгие запросы ИИ: вместо одной строки — сменяющиеся шаги («распознаю → перевожу → выбираю слова»).
// Возвращает функцию остановки. Последний шаг остаётся, пока запрос не закончится.
export function stagedStatus(el, steps, everyMs = 6000) {
  let i = 0;
  const started = Date.now();
  const paint = () => {
    if (!el || !el.isConnected) { clearInterval(timer); return; }
    const sec = Math.round((Date.now() - started) / 1000);
    el.textContent = `${steps[i]}${sec >= 5 ? ` · ${sec} с` : ''}`;
  };
  const timer = setInterval(() => {
    if (i < steps.length - 1 && Date.now() - started >= (i + 1) * everyMs) i++;
    paint();
  }, 1000);
  paint();
  return () => clearInterval(timer);
}
