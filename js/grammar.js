import { registerFeature } from './app.js';
import { checkGrammar } from './claude.js';
import { addMistake } from './db.js';
import { escapeHtml } from './util.js';

async function check(container) {
  const input = container.querySelector('#gr-input').value.trim();
  if (!input) return;
  const status = container.querySelector('#gr-status');
  const out = container.querySelector('#gr-out');
  status.textContent = 'Проверяю…';
  out.innerHTML = '';
  try {
    const r = await checkGrammar(input);
    if (!container.querySelector('#gr-out')) return; // ушли на другой экран
    status.textContent = '';
    const e = escapeHtml;
    out.innerHTML = `
      <div class="study-card">
        <div class="${r.ok ? 'gr-ok' : 'gr-bad'}">${r.ok ? '✅ Верно' : '✏️ Есть что поправить'}</div>
        ${r.corrected ? `<div class="study-es"><b>${e(r.corrected)}</b></div>` : ''}
        ${r.explanation ? `<div class="word-ex">${e(r.explanation)}</div>` : ''}
        ${r.topic ? `<div class="word-local">📌 Тема: ${e(r.topic)}</div>` : ''}
      </div>`;
    if (r.ok === false) {
      await addMistake({ phrase: input, corrected: r.corrected || '', topic: r.topic || '', createdAt: Date.now() });
    }
  } catch (err) {
    const s = container.querySelector('#gr-status');
    if (s) s.textContent = err.message;
  }
}

async function render(container) {
  container.innerHTML = `
    <h1>Грамматика</h1>
    <label>Напиши фразу на испанском — проверю
      <textarea id="gr-input" rows="3" placeholder="напр. Ayer yo voy a la playa"></textarea>
    </label>
    <button id="gr-check">Проверить</button>
    <p id="gr-status" class="status"></p>
    <div id="gr-out"></div>
  `;
  container.querySelector('#gr-check').onclick = () => check(container);
}

registerFeature({ id: 'grammar', title: 'Грамматика', icon: '✍️', order: 40, render });
