import { registerFeature } from './app.js';
import { detectLang } from './lang.js';
import { enrichWord } from './claude.js';
import { putWord, getAllWords, deleteWord } from './db.js';
import { newCard } from './srs.js';
import { speak } from './tts.js';
import { escapeHtml } from './util.js';

function wordHtml(w, withSave) {
  const e = escapeHtml;
  return `
    <div class="word-card">
      <div class="word-main"><b>${e(w.es)}</b> ${w.gender ? `<span class="muted">(${e(w.gender)})</span>` : ''} — ${e(w.ru)}</div>
      ${w.example ? `<div class="word-ex">${e(w.example)}${w.exampleRu ? `<br><span class="muted">${e(w.exampleRu)}</span>` : ''}</div>` : ''}
      ${w.local ? `<div class="word-local">📍 ${e(w.local)}</div>` : ''}
      <div class="word-actions">
        ${withSave ? '<button id="dic-save">Сохранить в словарь</button>' : `<button class="danger" data-del="${e(w.id)}">Удалить</button>`}
        <button ${withSave ? 'id="dic-say"' : `data-say="${e(w.id)}"`}>🔊</button>
      </div>
    </div>`;
}

async function renderList(container) {
  const listEl = container.querySelector('#dic-list');
  const words = (await getAllWords()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (words.length === 0) {
    listEl.innerHTML = '<p class="status">Словарь пуст. Добавь первое слово выше.</p>';
    return;
  }
  listEl.innerHTML = words.map((w) => wordHtml(w, false)).join('');
  listEl.querySelectorAll('[data-say]').forEach((b) => {
    b.onclick = () => { const w = words.find((x) => String(x.id) === b.dataset.say); if (w) speak(w.es); };
  });
  listEl.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => {
      await deleteWord(Number(b.dataset.del));
      if (!container.querySelector('#dic-list')) return; // ушли на другой экран
      renderList(container);
    };
  });
}

async function render(container) {
  container.innerHTML = `
    <h1>Словарь</h1>
    <label>Слово или фраза (RU или ES)
      <input id="dic-input" type="text" placeholder="напр. собака или perro" autocapitalize="off">
    </label>
    <button id="dic-lookup">Найти и заполнить</button>
    <p id="dic-status" class="status"></p>
    <div id="dic-preview"></div>
    <h2>Мои слова</h2>
    <div id="dic-list"></div>
  `;
  const status = container.querySelector('#dic-status');
  const preview = container.querySelector('#dic-preview');
  const inputEl = container.querySelector('#dic-input');

  container.querySelector('#dic-lookup').onclick = async () => {
    const input = inputEl.value.trim();
    if (!input) return;
    status.textContent = `Запрашиваю (${detectLang(input) === 'ru' ? 'RU→ES' : 'ES→RU'})…`;
    preview.innerHTML = '';
    try {
      const w = await enrichWord(input);
      status.textContent = '';
      preview.innerHTML = wordHtml(w, true);
      preview.querySelector('#dic-say').onclick = () => speak(w.es);
      preview.querySelector('#dic-save').onclick = async () => {
        const now = Date.now();
        await putWord({ ...w, createdAt: now, ...newCard(now) });
        if (!container.querySelector('#dic-preview')) return; // ушли на другой экран
        preview.innerHTML = '';
        inputEl.value = '';
        status.textContent = 'Сохранено в словарь.';
        renderList(container);
      };
    } catch (e) {
      status.textContent = e.message;
    }
  };

  await renderList(container);
}

registerFeature({ id: 'dictionary', title: 'Словарь', icon: '📖', order: 20, render });
