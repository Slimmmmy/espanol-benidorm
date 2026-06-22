import { registerFeature } from './app.js';
import { getAllWords, putWord } from './db.js';
import { dueCards, schedule } from './srs.js';
import { speak } from './tts.js';
import { escapeHtml } from './util.js';

let queue = [];
let current = null;

function renderEmpty(container) {
  container.innerHTML = `<h1>Учить</h1>
    <p class="status">На сегодня всё повторено 🎉<br>Добавь слова во вкладке «Словарь» или вернись позже.</p>`;
}

async function grade(container, g) {
  const updated = { ...current, ...schedule(current, g, Date.now()) };
  await putWord(updated);
  queue = queue.filter((w) => w.id !== current.id);
  if (g === 'again') queue.push(updated); // вернуть в конец очереди на сегодня
  renderCard(container);
}

function renderCard(container) {
  if (queue.length === 0) { renderEmpty(container); return; }
  current = queue[0];
  const e = escapeHtml;
  container.innerHTML = `
    <h1>Учить <span class="muted">(осталось ${queue.length})</span></h1>
    <div class="study-card">
      <div class="study-front"><b>${e(current.ru)}</b></div>
      <button id="study-reveal">Показать ответ</button>
      <div id="study-back" class="hidden">
        <div class="study-es"><b>${e(current.es)}</b> ${current.gender ? `<span class="muted">(${e(current.gender)})</span>` : ''}</div>
        ${current.example ? `<div class="word-ex">${e(current.example)}</div>` : ''}
        <button id="study-say">🔊 Озвучить</button>
        <div class="grade-row">
          <button class="danger" data-g="again">Не помню</button>
          <button data-g="good">Помню</button>
          <button data-g="easy">Легко</button>
        </div>
      </div>
    </div>`;
  container.querySelector('#study-reveal').onclick = () => {
    container.querySelector('#study-back').classList.remove('hidden');
    container.querySelector('#study-reveal').classList.add('hidden');
  };
  container.querySelector('#study-say').onclick = () => speak(current.es);
  container.querySelectorAll('[data-g]').forEach((b) => { b.onclick = () => grade(container, b.dataset.g); });
}

async function render(container) {
  queue = dueCards(await getAllWords(), Date.now());
  renderCard(container);
}

registerFeature({ id: 'study', title: 'Учить', icon: '🎓', order: 10, render });
