import { registerFeature } from './app.js';
import { generateDialogue } from './claude.js';
import { speakSequence, stopSpeaking, speak } from './tts.js';
import { escapeHtml } from './util.js';

const TOPICS = [
  'В баре заказать кофе и тапас',
  'На рынке купить фрукты',
  'Разговор с соседом по дому',
  'У врача / в аптеке',
  'На пляже в Бенидорме',
  'Снять квартиру у хозяина',
  'В супермаркете Mercadona',
  'Спросить дорогу в городе',
];

let dialogue = null;
let answered = false;

function dialogueHtml(d) {
  const e = escapeHtml;
  const lines = d.lines.map((l) => `
    <div class="dlg-line"><span class="dlg-speaker">${e(l.speaker)}:</span>
      <span class="dlg-es">${e(l.es)}</span>
      <span class="dlg-ru muted hidden">${e(l.ru)}</span></div>`).join('');
  const opts = (d.options || []).map((o, i) =>
    `<button class="opt" data-i="${i}">${e(o)}</button>`).join('');
  return `
    <div class="study-card">
      <h2>${e(d.title)}</h2>
      <div class="dlg-controls">
        <button id="lst-play">▶︎ Прослушать</button>
        <button id="lst-stop">⏹</button>
        <button id="lst-trans">Показать перевод</button>
      </div>
      <div id="lst-lines">${lines}</div>
      ${d.question ? `<div class="dlg-q"><b>${e(d.question)}</b><div class="grade-row">${opts}</div><p id="lst-verdict" class="status"></p></div>` : ''}
      ${d.notes ? `<div class="word-local">📍 ${e(d.notes)}</div>` : ''}
    </div>`;
}

function wireDialogue(container, d) {
  container.querySelector('#lst-play').onclick = () => speakSequence(d.lines);
  container.querySelector('#lst-stop').onclick = () => stopSpeaking();
  const trans = container.querySelector('#lst-trans');
  trans.onclick = () => {
    const hidden = container.querySelector('.dlg-ru.hidden');
    const show = !!hidden;
    container.querySelectorAll('.dlg-ru').forEach((el) => el.classList.toggle('hidden', !show));
    trans.textContent = show ? 'Скрыть перевод' : 'Показать перевод';
  };
  container.querySelectorAll('.opt').forEach((b) => {
    b.onclick = () => {
      if (answered) return;
      answered = true;
      const chosen = Number(b.dataset.i);
      const verdict = container.querySelector('#lst-verdict');
      if (chosen === d.answer) { b.classList.add('ok'); verdict.textContent = '✅ Верно!'; }
      else {
        b.classList.add('danger');
        const right = container.querySelector(`.opt[data-i="${d.answer}"]`);
        if (right) right.classList.add('ok');
        verdict.textContent = '❌ Не совсем. Правильный вариант подсвечен.';
      }
    };
  });
}

async function generate(container) {
  const status = container.querySelector('#lst-status');
  const topic = container.querySelector('#lst-topic').value;
  status.textContent = 'Генерирую диалог…';
  container.querySelector('#lst-out').innerHTML = '';
  try {
    dialogue = await generateDialogue(topic);
    answered = false;
    if (!container.querySelector('#lst-out')) return; // ушли на другой экран
    status.textContent = '';
    container.querySelector('#lst-out').innerHTML = dialogueHtml(dialogue);
    wireDialogue(container, dialogue);
  } catch (err) {
    status.textContent = err.message;
  }
}

async function render(container) {
  const opts = TOPICS.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  container.innerHTML = `
    <h1>Аудио</h1>
    <label>Тема диалога
      <select id="lst-topic">${opts}</select>
    </label>
    <button id="lst-gen">Сгенерировать и слушать</button>
    <p id="lst-status" class="status"></p>
    <div id="lst-out"></div>
  `;
  container.querySelector('#lst-gen').onclick = () => generate(container);
}

registerFeature({ id: 'listening', title: 'Аудио', icon: '🎧', order: 30, render });
