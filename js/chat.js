import { registerFeature } from './app.js';
import { getSetting, setSetting } from './db.js';
import { buildProfile, getMemory, saveMemory } from './profile.js';
import { chatReply, extractMemory } from './claude.js';
import { autoSync } from './sync.js';
import { escapeHtml } from './util.js';

let busy = false;

async function getHistory() { return (await getSetting('chatHistory')) || []; }
async function saveHistory(h) { await setSetting('chatHistory', h.slice(-60)); }

function bubblesHtml(history) {
  const e = escapeHtml;
  if (!history.length) {
    return '<p class="status">Привет! Я твой наставник по испанскому. Спроси что угодно — объясню, помогу, потренирую. Можешь писать по-русски или по-испански.</p>';
  }
  return history.map((m) => `<div class="chat-msg chat-${m.role === 'user' ? 'me' : 'bot'}">${e(m.content)}</div>`).join('');
}

function scrollBottom() {
  const el = document.scrollingElement || document.documentElement;
  el.scrollTop = el.scrollHeight;
}

function renderLog(container, history, typing) {
  const log = container.querySelector('#chat-log');
  if (!log) return;
  log.innerHTML = bubblesHtml(history) + (typing ? '<div class="chat-msg chat-bot chat-typing">…</div>' : '');
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

async function send(container) {
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
    history.push({ role: 'user', content: text, ts: Date.now() });
    await saveHistory(history);
    renderLog(container, history, true);
    const profile = await buildProfile();
    const reply = await chatReply(history, profile);
    history.push({ role: 'assistant', content: reply, ts: Date.now() });
    await saveHistory(history);
    autoSync(); // тихо отправить новую переписку в облако (если синхронизация настроена)
    refreshMemory(text, reply);
    if (!container.querySelector('#chat-log')) return;
    renderLog(container, history, false);
  } catch (err) {
    if (container.querySelector('#chat-log')) {
      renderLog(container, history.concat([{ role: 'assistant', content: '⚠️ ' + err.message, ts: Date.now() }]), false);
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
}

registerFeature({ id: 'chat', title: 'Чат', icon: '💬', order: 6, render });
