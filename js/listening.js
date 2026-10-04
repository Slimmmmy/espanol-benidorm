import { registerFeature } from './app.js';
import { generateDialogue } from './claude.js';
import { speak, speakSequence, stopSpeaking } from './tts.js';
import { escapeHtml } from './util.js';
import { diffWords } from './exercises.js';
import { enableWordPick } from './wordpick.js';
import { recordActivity } from './activity.js';
import { getSetting } from './db.js';

const TOPICS = [
  'В баре заказать кофе и тапас',
  'На рынке купить фрукты',
  'Разговор с соседом по дому',
  'У врача / в аптеке',
  'На пляже в Бенидорме',
  'Снять квартиру у хозяина',
  'В супермаркете Mercadona',
  'Спросить дорогу в городе',
  'Записаться к врачу в centro de salud',
  'Сломался бойлер — звонок хозяину',
  'Заказать arroz a banda в ресторане',
  'Поездка на трамвае TRAM в Альтеа',
];

let dialogue = null;
let answered = false;
let generating = false;

function linesHtml(d) {
  const e = escapeHtml;
  return d.lines.map((l, i) => `
    <div class="dlg-line">
      <span class="dlg-speaker">${e(l.speaker)}:</span>
      <span class="dlg-es">${e(l.es)}</span>
      <span class="dlg-btns" data-nopick><button class="mini" data-line="${i}" title="Повторить фразу">🔊</button><button class="mini" data-slow="${i}" title="Медленно">🐢</button></span>
      <span class="dlg-ru muted hidden">${e(l.ru)}</span></div>`).join('');
}

function dialogueHtml(d) {
  const e = escapeHtml;
  const opts = (d.options || []).map((o, i) =>
    `<button class="opt" data-i="${i}">${e(o)}</button>`).join('');
  return `
    <div class="study-card">
      <h2>${e(d.title)}</h2>
      <div class="dlg-controls">
        <button id="lst-play">▶︎ Прослушать</button>
        <button id="lst-slow">🐢 Медленно</button>
        <button id="lst-stop">⏹</button>
        <button id="lst-trans">Показать перевод</button>
        <button id="lst-dict">✍️ Диктант</button>
      </div>
      <p class="muted">Нажми на любое слово — перевод и «＋ в словарь».</p>
      <div id="lst-lines">${linesHtml(d)}</div>
      ${d.question ? `<div class="dlg-q"><b>${e(d.question)}</b><div class="grade-row">${opts}</div><p id="lst-verdict" class="status"></p></div>` : ''}
      ${d.notes ? `<div class="word-local">📍 ${e(d.notes)}</div>` : ''}
    </div>`;
}

function dictationHtml(d) {
  const e = escapeHtml;
  return `
    <div class="study-card">
      <h2>✍️ Диктант: ${e(d.title)}</h2>
      <p class="muted">Слушай фразу (можно медленно) и записывай. Акценты и знаки препинания не важны.</p>
      ${d.lines.map((l, i) => `
        <div class="dict-row">
          <div><span class="dlg-speaker">${e(l.speaker)}:</span>
            <button class="mini" data-line="${i}">🔊</button><button class="mini" data-slow="${i}">🐢</button></div>
          <input data-dict="${i}" type="text" autocapitalize="off" autocomplete="off" placeholder="Что ты услышал?">
          <div class="dict-res" data-res="${i}"></div>
        </div>`).join('')}
      <button id="dict-check">Проверить</button>
      <button id="dict-back" class="ghost">К тексту</button>
      <p id="dict-score" class="status"></p>
    </div>`;
}

// Тот же голос, что и при прослушивании всего диалога: первый персонаж — основной голос, второй — другой.
async function lineGender(d, i) {
  const speakers = [];
  for (const l of d.lines) if (!speakers.includes(l.speaker)) speakers.push(l.speaker);
  const main = (await getSetting('googleVoiceMain')) || 'f';
  const other = main === 'f' ? 'm' : 'f';
  return speakers.indexOf(d.lines[i].speaker) % 2 === 0 ? main : other;
}

function wireLineButtons(root, d) {
  root.querySelectorAll('[data-line]').forEach((b) => {
    b.onclick = async () => { const i = Number(b.dataset.line); speak(d.lines[i].es, 'es-ES', { gender: await lineGender(d, i) }); };
  });
  root.querySelectorAll('[data-slow]').forEach((b) => {
    b.onclick = async () => { const i = Number(b.dataset.slow); speak(d.lines[i].es, 'es-ES', { slow: true, gender: await lineGender(d, i) }); };
  });
}

function showDialogue(container, d) {
  const out = container.querySelector('#lst-out');
  out.innerHTML = dialogueHtml(d);
  wireDialogue(container, d);
}

function showDictation(container, d) {
  stopSpeaking();
  const out = container.querySelector('#lst-out');
  out.innerHTML = dictationHtml(d);
  wireLineButtons(out, d);
  out.querySelector('#dict-back').onclick = () => showDialogue(container, d);
  out.querySelector('#dict-check').onclick = async () => {
    let correct = 0;
    let total = 0;
    d.lines.forEach((l, i) => {
      const got = out.querySelector(`[data-dict="${i}"]`).value;
      const r = diffWords(l.es, got);
      correct += r.correct;
      total += r.total;
      out.querySelector(`[data-res="${i}"]`).innerHTML = r.tokens
        .map((t) => `<span class="${t.ok ? 'dict-ok' : 'dict-miss'}">${escapeHtml(t.w)}</span>`).join(' ');
    });
    const pct = total ? Math.round((correct / total) * 100) : 0;
    out.querySelector('#dict-score').textContent = `Верно ${correct} из ${total} слов (${pct}%). Зелёным — расслышано, оранжевым — пропущено.`;
    await recordActivity('dictation');
  };
}

function wireDialogue(container, d) {
  container.querySelector('#lst-play').onclick = () => speakSequence(d.lines);
  container.querySelector('#lst-slow').onclick = () => speakSequence(d.lines, 'es-ES', { slow: true });
  container.querySelector('#lst-stop').onclick = () => stopSpeaking();
  container.querySelector('#lst-dict').onclick = () => showDictation(container, d);
  const trans = container.querySelector('#lst-trans');
  trans.onclick = () => {
    const hidden = container.querySelector('.dlg-ru.hidden');
    const show = !!hidden;
    container.querySelectorAll('.dlg-ru').forEach((el) => el.classList.toggle('hidden', !show));
    trans.textContent = show ? 'Скрыть перевод' : 'Показать перевод';
  };
  const lines = container.querySelector('#lst-lines');
  wireLineButtons(lines, d);
  lines.querySelectorAll('.dlg-es').forEach((el) => enableWordPick(el));
  container.querySelectorAll('.opt').forEach((b) => {
    b.onclick = () => {
      if (answered) return;
      answered = true;
      const chosen = Number(b.dataset.i);
      const answerIdx = Number(d.answer);
      const verdict = container.querySelector('#lst-verdict');
      if (chosen === answerIdx) { b.classList.add('ok'); verdict.textContent = '✅ Верно!'; }
      else {
        b.classList.add('danger');
        const right = container.querySelector(`.opt[data-i="${answerIdx}"]`);
        if (right) right.classList.add('ok');
        verdict.textContent = '❌ Не совсем. Правильный вариант подсвечен.';
      }
      recordActivity('listening');
    };
  });
}

async function generate(container) {
  if (generating) return;
  generating = true;
  const status = container.querySelector('#lst-status');
  const own = container.querySelector('#lst-own').value.trim();
  const topic = own || container.querySelector('#lst-topic').value;
  status.textContent = 'Генерирую диалог…';
  container.querySelector('#lst-out').innerHTML = '';
  try {
    dialogue = await generateDialogue(topic);
    answered = false;
    if (!container.querySelector('#lst-out')) return; // ушли на другой экран
    status.textContent = '';
    showDialogue(container, dialogue);
  } catch (err) {
    const s = container.querySelector('#lst-status');
    if (s) s.textContent = err.message;
  } finally {
    generating = false;
  }
}

async function render(container) {
  const opts = TOPICS.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  container.innerHTML = `
    <h1>Аудио</h1>
    <label>Тема диалога
      <select id="lst-topic">${opts}</select>
    </label>
    <label>…или своя тема
      <input id="lst-own" type="text" placeholder="напр. записаться в спортзал">
    </label>
    <button id="lst-gen">Сгенерировать и слушать</button>
    <p id="lst-status" class="status"></p>
    <div id="lst-out"></div>
  `;
  container.querySelector('#lst-gen').onclick = () => generate(container);
  if (dialogue) showDialogue(container, dialogue);
}

registerFeature({ id: 'listening', title: 'Аудио', icon: '🎧', order: 30, render });
