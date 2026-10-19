import { registerFeature } from './app.js';
import { getSetting, setSetting } from './db.js';
import { buildProfile, getMemory, saveMemory } from './profile.js';
import { chatReply, extractMemory, reviewConversation } from './claude.js';
import { fileToImages, reviewCardHtml, wireReviewCard, convoText, mistakesFromConvo, MAX_IMAGES } from './convo.js';
import { recordStudyDay } from './stats.js';
import { autoSync } from './sync.js';
import { escapeHtml, renderMarkdown } from './util.js';
import { recognizeOnce } from './asr.js';
import { speakSequence, spanishSegments } from './tts.js';
import { enableWordPick } from './wordpick.js';
import { logMistakes } from './mistakes.js';
import { recordActivity } from './activity.js';
import { getStats } from './stats.js';
import { icon } from './icons.js';

let busy = false;
let profileSnapshot = null; // профиль фиксируется на время беседы — стабильное начало запроса для кэша
let pending = [];           // скриншоты, прикреплённые к следующему сообщению (в историю не сохраняются)

async function getHistory() { return (await getSetting('chatHistory')) || []; }
// Обрезаем историю «ступенькой» (до 60, когда набралось 80): начало окна для API меняется редко.
async function saveHistory(h) { await setSetting('chatHistory', h.length > 80 ? h.slice(-60) : h); }

function bubblesHtml(history) {
  const e = escapeHtml;
  if (!history.length) {
    return '<p class="status">Привет! Я твой наставник по испанскому. Спроси что угодно — объясню, помогу, потренирую. Можешь писать или говорить (🎤) по-испански. Пришли скриншоты своей переписки (📎) — разберу, как ты пишешь. Нажми на испанское слово в моём ответе — покажу перевод и добавлю в словарь.</p>';
  }
  return history.map((m, i) => {
    if (m.role === 'user') {
      if (m.shots) return `<div class="chat-msg chat-me">📎 ${shotsLabel(m.shots)}${m.note ? `<br>${e(m.note)}` : ''}</div>`;
      return `<div class="chat-msg chat-me">${m.voice ? '🎤 ' : ''}${e(m.content)}</div>`;
    }
    if (m.review) return `<div class="chat-msg chat-bot chat-wide" data-convo="${i}">${reviewCardHtml(m.review)}</div>`;
    return `<div class="chat-msg chat-bot">${renderMarkdown(m.content)}${m.noSpeak ? '' : `<button class="chat-say" data-say="${i}" aria-label="Озвучить">${icon('sound', 'ic ic-sm')}</button>`}</div>`;
  }).join('');
}

export function shotsLabel(n) {
  const m10 = n % 10, m100 = n % 100;
  const w = m10 === 1 && m100 !== 11 ? 'скриншот' : (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'скриншота' : 'скриншотов');
  return `${n} ${w} переписки`;
}

function scrollBottom() {
  const el = document.scrollingElement || document.documentElement;
  el.scrollTop = el.scrollHeight;
}

function renderLog(container, history, typing) {
  const log = container.querySelector('#chat-log');
  if (!log) return;
  log.innerHTML = bubblesHtml(history) + (typing ? '<div class="chat-msg chat-bot chat-typing">…</div>' : '');
  log.querySelectorAll('[data-say]').forEach((b) => {
    b.onclick = () => {
      const m = history[Number(b.dataset.say)];
      if (!m) return;
      // Озвучиваем только испанские фразы — русские объяснения испанским голосом звучат плохо.
      const parts = spanishSegments(m.content);
      if (parts.length) speakSequence(parts.map((es) => ({ es, speaker: '' })));
    };
  });
  log.querySelectorAll('.chat-bot:not([data-convo])').forEach((el) => enableWordPick(el));
  log.querySelectorAll('[data-convo]').forEach((el) => { const m = history[Number(el.dataset.convo)]; if (m && m.review) wireReviewCard(el, m.review); });
  scrollBottom();
}

async function refreshMemory(userMsg, assistantMsg) {
  try {
    const existing = await getMemory();
    const topics = (await getStats()).weak.slice(0, 15).map((w) => w.topic);
    const r = await extractMemory(existing, userMsg, assistantMsg, topics);
    if (r && Array.isArray(r.mistakes) && r.mistakes.length) await logMistakes(r.mistakes, 'chat');
    if (r && Array.isArray(r.notes)) await saveMemory(r.notes);
    autoSync();
  } catch (e) { /* тихо: память и журнал ошибок — необязательные функции */ }
}

async function voiceInput(container) {
  if (busy) return;
  const mic = container.querySelector('#chat-mic');
  const input = container.querySelector('#chat-input');
  if (mic) mic.disabled = true;
  const prevPh = input ? input.placeholder : '';
  if (input) input.placeholder = '🎤 Говори по-испански…';
  try {
    const heard = await recognizeOnce('es-ES');
    if (input) { input.value = heard; input.placeholder = prevPh; }
    if (mic) mic.disabled = false;
    await send(container, { voice: true });
  } catch (err) {
    if (input) input.placeholder = prevPh;
    if (mic) mic.disabled = false;
    const log = container.querySelector('#chat-log');
    if (log) {
      const h = await getHistory();
      renderLog(container, h.concat([{ role: 'assistant', content: '⚠️ ' + err.message, ts: Date.now(), noSpeak: true }]), false);
    }
  }
}

// Скриншоты переписки → разбор карточкой в чате. В историю идёт разбор (и его текст — для контекста
// наставника), сами картинки не сохраняются.
async function sendShots(container) {
  const input = container.querySelector('#chat-input');
  const note = input.value.trim();
  const shots = pending;
  busy = true;
  pending = [];
  input.value = '';
  paintPending(container);
  let history = [];
  try {
    history = await getHistory();
    history.push({ role: 'user', content: `[Ученик прислал ${shotsLabel(shots.length)}]${note ? ` ${note}` : ''}`, shots: shots.length, note, ts: Date.now() });
    await saveHistory(history);
    renderLog(container, history, true);
    const review = await reviewConversation(shots.map((s) => s.b64), note);
    history.push({ role: 'assistant', content: convoText(review), review, ts: Date.now(), noSpeak: true });
    await saveHistory(history);
    await logMistakes(mistakesFromConvo(review), 'convo');
    await recordActivity('grammar');
    await recordStudyDay();
    autoSync();
    if (!container.querySelector('#chat-log')) return;
    renderLog(container, history, false);
  } catch (err) {
    pending = shots; // не потерять скриншоты — можно отправить ещё раз
    if (container.querySelector('#chat-log')) {
      paintPending(container);
      renderLog(container, history.concat([{ role: 'assistant', content: '⚠️ ' + err.message, ts: Date.now(), noSpeak: true }]), false);
    }
  } finally {
    busy = false;
  }
}

function paintPending(container) {
  const box = container.querySelector('#chat-shots');
  if (!box) return;
  box.hidden = !pending.length;
  box.innerHTML = pending.map((s, i) => `<div class="cv-thumb"><img src="${s.preview}" alt="Скриншот ${i + 1}"><button type="button" data-rm="${i}" aria-label="Убрать">${icon('close', 'ic ic-sm')}</button></div>`).join('')
    + (pending.length ? `<span class="chat-shots-hint">Напишите, с кем переписка (необязательно), и нажмите ➤</span>` : '');
  box.querySelectorAll('[data-rm]').forEach((b) => { b.onclick = () => { pending.splice(Number(b.dataset.rm), 1); paintPending(container); }; });
  const input = container.querySelector('#chat-input');
  if (input) input.placeholder = pending.length ? 'С кем переписка? (необязательно)' : 'Спроси наставника…';
  if (pending.length) scrollBottom();
}

async function attach(container, files) {
  const input = container.querySelector('#chat-input');
  try {
    for (const f of files) {
      if (pending.length >= MAX_IMAGES) break;
      for (const img of await fileToImages(f)) if (pending.length < MAX_IMAGES) pending.push(img);
    }
  } catch (err) {
    if (input) input.placeholder = err.message;
  }
  paintPending(container);
}

async function send(container, opts = {}) {
  if (busy) return;
  if (pending.length) { await sendShots(container); return; }
  const input = container.querySelector('#chat-input');
  const text = input.value.trim();
  if (!text) return;
  busy = true;
  input.value = '';
  input.focus();
  let history = [];
  try {
    history = await getHistory();
    history.push({ role: 'user', content: text, ts: Date.now(), ...(opts.voice ? { voice: true } : {}) });
    await saveHistory(history);
    renderLog(container, history, true);
    if (!profileSnapshot) profileSnapshot = await buildProfile();
    const reply = await chatReply(history, profileSnapshot, opts);
    history.push({ role: 'assistant', content: reply, ts: Date.now() });
    await saveHistory(history);
    await recordActivity('chat');
    autoSync(); // тихо отправить новую переписку в облако (если синхронизация настроена)
    refreshMemory(text, reply);
    if (!container.querySelector('#chat-log')) return;
    renderLog(container, history, false);
  } catch (err) {
    if (container.querySelector('#chat-log')) {
      renderLog(container, history.concat([{ role: 'assistant', content: '⚠️ ' + err.message, ts: Date.now(), noSpeak: true }]), false);
    }
  } finally {
    busy = false;
  }
}

async function render(container) {
  profileSnapshot = null;
  container.innerHTML = `
    <h1>Наставник</h1>
    <div id="chat-log" class="chat-log"></div>
    <div id="chat-shots" class="cv-shots chat-shots" hidden></div>
    <div class="chat-bar">
      <button id="chat-attach" aria-label="Прислать скриншоты переписки">${icon('image')}</button>
      <input id="chat-file" class="sr-only" type="file" accept="image/*" multiple>
      <button id="chat-mic" aria-label="Сказать по-испански">${icon('mic')}</button>
      <input id="chat-input" type="text" placeholder="Спроси наставника…" autocapitalize="sentences">
      <button id="chat-send">➤</button>
    </div>
  `;
  const history = await getHistory();
  if (!container.querySelector('#chat-log')) return;
  renderLog(container, history, false);
  container.querySelector('#chat-send').onclick = () => send(container);
  container.querySelector('#chat-input').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); send(container); }
  });
  container.querySelector('#chat-mic').onclick = () => voiceInput(container);
  const file = container.querySelector('#chat-file');
  container.querySelector('#chat-attach').onclick = () => file.click();
  file.onchange = () => { const files = [...file.files]; file.value = ''; if (files.length) attach(container, files); };
  paintPending(container);
}

registerFeature({ id: 'chat', title: 'Чат', icon: '💬', order: 6, render });
