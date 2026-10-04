// Ролевые сценки: ИИ играет персонажа из жизни Бенидорма, ученик отвечает текстом или голосом,
// в конце — разбор с оценкой, исправлениями (→ слабые темы) и новыми словами (→ словарь).
import { registerFeature } from './app.js';
import { getSetting, setSetting } from './db.js';
import { roleplayReply, debriefRoleplay } from './claude.js';
import { recognizeOnce, canRecognize } from './asr.js';
import { speak } from './tts.js';
import { escapeHtml } from './util.js';
import { enableWordPick, saveWord } from './wordpick.js';
import { logMistakes } from './mistakes.js';
import { recordActivity } from './activity.js';
import { recordStudyDay } from './stats.js';
import { autoSync } from './sync.js';

export const SCENES = [
  { id: 'mercadona', icon: '🛒', title: 'Касса в Mercadona', role: 'кассирша Mercadona, приветливая, но торопится', setting: 'вечер, очередь; у ученика карта не проходит, а наличных мелочью мало', goal: 'Оплатить покупки, попросить пакет и уточнить, можно ли оплатить частями (карта + наличные)' },
  { id: 'casero', icon: '🔧', title: 'Сломался бойлер', role: 'хозяин квартиры (casero), немного ворчливый, говорит быстро', setting: 'телефонный звонок; с утра нет горячей воды', goal: 'Объяснить проблему, договориться, когда придёт мастер (fontanero), и оставить свой номер' },
  { id: 'bar', icon: '☕', title: 'Завтрак в баре', role: 'официант в баре у пляжа Levante', setting: 'утро, бар полон местных', goal: 'Заказать кофе (café con leche / cortado) и tostada con tomate, спросить цену и попросить счёт' },
  { id: 'farmacia', icon: '💊', title: 'В аптеке', role: 'фармацевт, внимательная, задаёт уточняющие вопросы', setting: 'аптека в старом городе', goal: 'Описать симптомы (болит горло, температура), узнать, как принимать лекарство' },
  { id: 'padron', icon: '🏛️', title: 'Empadronamiento в ayuntamiento', role: 'сотрудник ayuntamiento, формальный', setting: 'окно приёма в мэрии Бенидорма', goal: 'Узнать, какие документы нужны для padrón, и записаться (pedir cita)' },
  { id: 'vecino', icon: '🏠', title: 'Сосед шумит', role: 'сосед по лестничной клетке, дружелюбный пенсионер-валенсиец', setting: 'встреча у лифта', goal: 'Вежливо попросить не шуметь после 23:00 и остаться в хороших отношениях' },
  { id: 'medico', icon: '🩺', title: 'Запись к врачу', role: 'администратор centro de salud', setting: 'звонок в поликлинику', goal: 'Записаться к врачу (médico de cabecera) на ближайший день, назвать данные tarjeta SIP' },
  { id: 'playa', icon: '⛱️', title: 'Шезлонг на пляже', role: 'работник пляжа, сдаёт hamacas y sombrillas', setting: 'пляж Poniente, жарко', goal: 'Арендовать два шезлонга и зонт на полдня, узнать цену и до скольки работают' },
  { id: 'restaurante', icon: '🥘', title: 'Ресторан и аллергия', role: 'официант ресторана с местной кухней', setting: 'ужин; в меню arroz a banda, all i pebre, fideuà', goal: 'Спросить про блюда, предупредить об аллергии на морепродукты и заказать подходящее' },
  { id: 'tram', icon: '🚋', title: 'Трамвай до Альтеа', role: 'кассир на станции TRAM', setting: 'станция Benidorm Intermodal', goal: 'Купить билет до Altea туда-обратно, узнать время отправления и с какой платформы' },
];

let scene = null;
let history = []; // [{ role, content(сырые реплики для API), es, ru, hint }]
let busy = false;
let finished = false;

async function getResults() { return (await getSetting('roleplayHistory')) || []; }

function bubblesHtml() {
  const e = escapeHtml;
  return history.map((m, i) => {
    if (m.role === 'user') return `<div class="chat-msg chat-me">${m.voice ? '🎤 ' : ''}${e(m.content)}</div>`;
    return `<div class="chat-msg chat-bot rp-bot"><div class="rp-es">${e(m.es)}</div>
      <div class="rp-tools" data-nopick>
        <button class="mini" data-say="${i}">🔊</button>
        <button class="mini" data-tr="${i}">RU</button>
        ${m.hint && i === history.length - 1 && !finished ? `<button class="mini" data-hint="${i}">💡 Подсказка</button>` : ''}
      </div>
      <div class="rp-ru muted hidden" data-ru="${i}">${e(m.ru)}</div>
      <div class="rp-hint hidden" data-hintbox="${i}">💡 ${e(m.hint || '')}</div></div>`;
  }).join('');
}

function renderLog(container, typing = false) {
  const log = container.querySelector('#rp-log');
  if (!log) return;
  log.innerHTML = bubblesHtml() + (typing ? '<div class="chat-msg chat-bot chat-typing">…</div>' : '');
  log.querySelectorAll('[data-say]').forEach((b) => { b.onclick = () => speak(history[Number(b.dataset.say)].es); });
  log.querySelectorAll('[data-tr]').forEach((b) => { b.onclick = () => log.querySelector(`[data-ru="${b.dataset.tr}"]`).classList.toggle('hidden'); });
  log.querySelectorAll('[data-hint]').forEach((b) => { b.onclick = () => log.querySelector(`[data-hintbox="${b.dataset.hint}"]`).classList.toggle('hidden'); });
  log.querySelectorAll('.rp-es').forEach((el) => enableWordPick(el));
  const el = document.scrollingElement || document.documentElement;
  el.scrollTop = el.scrollHeight;
}

async function aiTurn(container) {
  renderLog(container, true);
  const r = await roleplayReply(scene, history.map((m) => ({ role: m.role, content: m.content })));
  const msg = { role: 'assistant', content: JSON.stringify(r), es: r.es || '', ru: r.ru || '', hint: r.hint || '' };
  history.push(msg);
  if ((await getSetting('rpAutoSpeak')) !== false) speak(msg.es);
  if (r.end) finished = true;
}

function setStatus(container, text) {
  const s = container.querySelector('#rp-status');
  if (s) s.textContent = text;
}

async function send(container, text, voice = false) {
  if (busy || finished || !text) return;
  busy = true;
  history.push({ role: 'user', content: text, voice });
  try {
    await aiTurn(container);
    if (!container.querySelector('#rp-log')) return;
    renderLog(container);
    if (finished) showFinish(container);
  } catch (err) {
    history.pop();
    if (container.querySelector('#rp-log')) { renderLog(container); setStatus(container, err.message); }
  } finally {
    busy = false;
  }
}

function showFinish(container) {
  ['#rp-bar', '#rp-end'].forEach((sel) => { const el = container.querySelector(sel); if (el) el.classList.add('hidden'); });
  setStatus(container, '🎬 Сцена завершена.');
}

async function debrief(container) {
  if (busy) return;
  const userLines = history.filter((m) => m.role === 'user');
  if (!userLines.length) { setStatus(container, 'Скажи хотя бы одну реплику — тогда будет что разобрать.'); return; }
  busy = true;
  finished = true;
  showFinish(container);
  setStatus(container, 'Разбираю, как ты справился…');
  try {
    const transcript = history.map((m) => (m.role === 'user' ? `Ученик: ${m.content}` : `${scene.role}: ${m.es}`)).join('\n');
    const r = await debriefRoleplay(scene, transcript);
    const corrections = Array.isArray(r.corrections) ? r.corrections : [];
    await logMistakes(corrections.map((c) => ({ wrong: c.wrong, right: c.right, topic: c.topic })), 'roleplay');
    const results = await getResults();
    results.push({ scene: scene.id, date: Date.now(), score: Number(r.score) || 0 });
    await setSetting('roleplayHistory', results.slice(-100));
    await recordActivity('roleplay');
    await recordStudyDay();
    autoSync();
    if (!container.querySelector('#rp-debrief')) return;
    setStatus(container, '');
    renderDebrief(container, r, corrections);
  } catch (err) {
    finished = false;
    ['#rp-bar', '#rp-end'].forEach((sel) => { const el = container.querySelector(sel); if (el) el.classList.remove('hidden'); });
    setStatus(container, err.message);
  } finally {
    busy = false;
  }
}

function renderDebrief(container, r, corrections) {
  const e = escapeHtml;
  const words = Array.isArray(r.newWords) ? r.newWords : [];
  const box = container.querySelector('#rp-debrief');
  box.innerHTML = `<div class="study-card">
    <div class="rp-score">${r.goalReached ? '🎯 Цель достигнута' : '🎯 Цель пока не достигнута'} · ${e(r.score)}/10</div>
    <div class="word-ex">${e(r.summary || '')}</div>
    ${corrections.length ? `<h2>Исправления</h2>${corrections.map((c) => `
      <div class="lesson-ex"><div class="gr-bad">✏️ ${e(c.wrong)}</div>
      <div class="gr-ok">→ ${e(c.right)}</div><div class="word-ex">${e(c.why || '')}</div></div>`).join('')}` : '<p class="gr-ok">Ошибок не нашлось — отлично!</p>'}
    ${words.length ? `<h2>Пригодится в этой ситуации</h2>${words.map((w, i) => `
      <div class="rp-word"><span><b>${e(w.es)}</b> — ${e(w.ru)}</span>
      <span><button class="mini" data-wsay="${i}">🔊</button><button class="mini" data-wadd="${i}">＋</button></span></div>`).join('')}` : ''}
    ${r.tip ? `<div class="word-local">💡 ${e(r.tip)}</div>` : ''}
    <button id="rp-again">Сыграть ещё раз</button>
    <button id="rp-list" class="ghost">Другие сценки</button>
  </div>`;
  box.querySelectorAll('[data-wsay]').forEach((b) => { b.onclick = () => speak(words[Number(b.dataset.wsay)].es); });
  box.querySelectorAll('[data-wadd]').forEach((b) => {
    b.onclick = async () => {
      b.disabled = true;
      try {
        const res = await saveWord(words[Number(b.dataset.wadd)]);
        b.textContent = res === 'added' ? '✓' : '✓ уже есть';
      } catch (err) { b.disabled = false; }
    };
  });
  box.querySelector('#rp-again').onclick = () => startScene(container, scene.id);
  box.querySelector('#rp-list').onclick = () => { scene = null; render(container); };
}

// Разметка экрана сцены и обработчики (без запроса к ИИ).
function mountScene(container) {
  const e = escapeHtml;
  container.innerHTML = `
    <h1>${e(scene.icon)} ${e(scene.title)}</h1>
    <div class="study-card"><div class="word-ex">🎯 <b>Твоя цель:</b> ${e(scene.goal)}</div>
      <div class="muted">Говори или пиши по-испански. Нажми на слово — перевод. Ошибки разберём в конце.</div></div>
    <div id="rp-log" class="chat-log"></div>
    <p id="rp-status" class="status"></p>
    <div id="rp-bar" class="chat-bar">
      ${canRecognize() ? '<button id="rp-mic" title="Сказать по-испански">🎤</button>' : ''}
      <input id="rp-input" type="text" placeholder="Tu respuesta…" autocapitalize="sentences">
      <button id="rp-send">➤</button>
    </div>
    <button id="rp-end" class="ghost">🏁 Завершить и получить разбор</button>
    <div id="rp-debrief"></div>`;
  const input = container.querySelector('#rp-input');
  const go = () => { const t = input.value.trim(); input.value = ''; send(container, t); };
  container.querySelector('#rp-send').onclick = go;
  input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); go(); } });
  const mic = container.querySelector('#rp-mic');
  if (mic) {
    mic.onclick = async () => {
      if (busy) return;
      mic.disabled = true;
      setStatus(container, '🎤 Говори по-испански…');
      try {
        const heard = await recognizeOnce('es-ES');
        setStatus(container, '');
        await send(container, heard, true);
      } catch (err) { setStatus(container, err.message); }
      finally { mic.disabled = false; }
    };
  }
  container.querySelector('#rp-end').onclick = () => debrief(container);
}

async function startScene(container, id) {
  scene = SCENES.find((s) => s.id === id);
  history = [];
  finished = false;
  mountScene(container);
  busy = true;
  try {
    await aiTurn(container);
    if (container.querySelector('#rp-log')) renderLog(container);
  } catch (err) {
    if (container.querySelector('#rp-log')) { renderLog(container); setStatus(container, err.message); }
  } finally {
    busy = false;
  }
}

async function render(container) {
  if (scene && history.length) {
    // Вернулись на вкладку посреди сцены — продолжаем с того же места.
    mountScene(container);
    renderLog(container);
    if (finished) showFinish(container);
    return;
  }
  const results = await getResults();
  const best = {};
  for (const r of results) best[r.scene] = Math.max(best[r.scene] || 0, r.score || 0);
  const e = escapeHtml;
  container.innerHTML = `
    <h1>Сценки</h1>
    <p class="muted">Живой разговор в роли: ИИ играет местного жителя, ты добиваешься цели. В конце — оценка, исправления и полезные слова.</p>
    <div class="rp-grid">${SCENES.map((s) => `
      <button class="rp-scene" data-scene="${e(s.id)}">
        <span class="rp-icon">${e(s.icon)}</span>
        <span class="rp-title">${e(s.title)}</span>
        <span class="muted rp-best">${best[s.id] ? `лучший результат: ${best[s.id]}/10` : 'ещё не играл'}</span>
      </button>`).join('')}</div>`;
  container.querySelectorAll('[data-scene]').forEach((b) => { b.onclick = () => startScene(container, b.dataset.scene); });
}

registerFeature({ id: 'roleplay', title: 'Сценки', icon: '🎭', order: 25, render });
