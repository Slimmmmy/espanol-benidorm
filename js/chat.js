import { registerFeature } from './app.js';
import { getSetting, setSetting } from './db.js';
import { buildProfile, getMemory, saveMemory } from './profile.js';
import { chatReply, extractMemory } from './claude.js';
import { autoSync } from './sync.js';
import { escapeHtml } from './util.js';
import { recognizeOnce } from './asr.js';
import { speak } from './tts.js';

let busy = false;

async function getHistory() { return (await getSetting('chatHistory')) || []; }
async function saveHistory(h) { await setSetting('chatHistory', h.slice(-60)); }

function bubblesHtml(history) {
  const e = escapeHtml;
  if (!history.length) {
    return '<p class="status">Привет! Я твой наставник по испанскому. Спроси что угодно — объясню, помогу, потренирую. Можешь писать или говорить (🎤) по-испански.</p>';
  }
  return history.map((m, i) => {
    if (m.role === 'user') {
      return `<div class="chat-msg chat-me">${m.voice ? '🎤 ' : ''}${e(m.content)}</div>`;
    }
    return `<div class="chat-msg chat-bot">${e(m.content)}${m.noSpeak ? '' : `<button class="chat-say" data-say="${i}" title="Озвучить">🔊</button>`}</div>`;
  }).join('');
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
    b.onclick = () => { const m = history[Number(b.dataset.say)]; if (m) speak(m.content); };
  });
  scrollBottom();
}

async function refreshMemory(userMsg, assistantMsg) {
  try {
    const existing = await getMemory();
    const r = await extractMemory(existing, userMsg, assistantMsg);
    if (r && Array.isArray(r.notes)) {
      await saveMemory(r.notes);
      autoSync();
    }
  } catch (e) { /* тихо: память — необязательная функция */ }
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

async function send(container, opts = {}) {
  if (busy) return;
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
    const profile = await buildProfile();
    const reply = await chatReply(history, profile, opts);
    history.push({ role: 'assistant', content: reply, ts: Date.now() });
    await saveHistory(history);
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
  container.innerHTML = `
    <h1>Наставник</h1>
    <div id="chat-log" class="chat-log"></div>
    <div class="chat-bar">
      <button id="chat-mic" title="Сказать по-испански">🎤</button>
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
}

registerFeature({ id: 'chat', title: 'Чат', icon: '💬', order: 6, render });
