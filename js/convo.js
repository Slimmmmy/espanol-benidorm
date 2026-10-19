// «Переписка» (Наставник): скриншоты чатов с испанцами → разбор каждого своего сообщения
// (верно / неточность / ошибка, исправление, как написал бы испанец), сленг собеседника,
// вариант ответа и проверка черновика перед отправкой. Скриншоты не сохраняются; разборы
// хранятся только на этом телефоне (не синхронизируются — там чужие сообщения).
import { registerFeature } from './app.js';
import { reviewConversation, checkDraft } from './claude.js';
import { loadImage, scaleToFit, MAX_SIDE } from './photo.js';
import { logMistakes } from './mistakes.js';
import { recordActivity } from './activity.js';
import { recordStudyDay } from './stats.js';
import { getSetting, setSetting, getVocab, putWord } from './db.js';
import { newCard } from './srs.js';
import { findExistingWord, enableWordPick } from './wordpick.js';
import { speak } from './tts.js';
import { escapeHtml, stagedStatus } from './util.js';
import { icon } from './icons.js';

export const MAX_IMAGES = 8;
export const HISTORY = 15;

// Длинный скриншот (прокрутка) → куски с небольшим перекрытием, чтобы текст не стал мелким.
export function tallSlices(w, h, maxRatio = 2.2, overlap = 0.06) {
  if (!w || !h || h / w <= maxRatio * 1.15) return [{ y: 0, h }];
  const step = Math.round(w * maxRatio * (1 - overlap));
  const sliceH = Math.round(w * maxRatio);
  const out = [];
  for (let y = 0; y < h; y += step) {
    const sh = Math.min(sliceH, h - y);
    if (out.length && sh < w * 0.3) { out[out.length - 1].h = h - out[out.length - 1].y; break; }
    out.push({ y, h: sh });
    if (y + sh >= h) break;
  }
  return out;
}

// Счёт по своим сообщениям.
export function convoStats(review) {
  const mine = ((review && review.messages) || []).filter((m) => m.from === 'me');
  const by = (v) => mine.filter((m) => m.verdict === v).length;
  return { mine: mine.length, ok: by('ok'), minor: by('minor'), error: by('error'), other: by('not_spanish') };
}

// Ошибки из переписки → общий журнал ошибок и карточки «Исправьте фразу».
export function mistakesFromConvo(review) {
  return ((review && review.messages) || [])
    .filter((m) => m.from === 'me' && (m.verdict === 'error' || (m.verdict === 'minor' && m.topic)) && m.corrected && m.corrected !== m.text)
    .map((m) => ({ phrase: m.text, corrected: m.corrected, topic: m.topic || '' }));
}

// Переписка текстом — для проверки черновика в контексте.
export function convoText(review) {
  return ((review && review.messages) || []).slice(-14)
    .map((m) => `${m.from === 'me' ? 'Я' : 'Собеседник'}: ${m.text}`).join('\n');
}

const e = escapeHtml;
let shots = [];    // [{ b64, preview }]
let review = null; // текущий разбор
let busy = false;

async function fileToImages(file) {
  const src = await loadImage(file);
  const out = [];
  for (const s of tallSlices(src.width, src.height)) {
    const { w, h } = scaleToFit(src.width, s.h, MAX_SIDE);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(src, 0, s.y, src.width, s.h, 0, 0, w, h);
    out.push({ b64: c.toDataURL('image/jpeg', 0.85).split(',')[1], preview: c.toDataURL('image/jpeg', 0.4) });
  }
  return out;
}

const VERDICT = {
  ok: ['ok', '✓ верно'],
  minor: ['minor', '≈ неточность'],
  error: ['error', '✗ ошибка'],
  not_spanish: ['minor', 'не по-испански'],
};

function bubble(m, i) {
  const mine = m.from === 'me';
  const v = VERDICT[m.verdict];
  const details = mine
    ? `${m.corrected && m.corrected !== m.text ? `<div class="cv-fix"><span class="muted">Правильно:</span> <b class="tb-es">${e(m.corrected)}</b></div>` : ''}
       ${m.natural ? `<div class="cv-fix"><span class="muted">Как написал бы испанец:</span> <span class="tb-es">${e(m.natural)}</span> <button type="button" class="tb-say" data-say="${e(m.natural)}" aria-label="Послушать">${icon('sound', 'ic ic-sm')}</button></div>` : ''}
       ${m.explanation ? `<div class="cv-why">${e(m.explanation)}</div>` : ''}`
    : `${m.translation ? `<div class="cv-tr">${e(m.translation)}</div>` : ''}${m.explanation ? `<div class="cv-why">${e(m.explanation)}</div>` : ''}`;
  return `<div class="cv-msg ${mine ? 'cv-me' : 'cv-them'}${v ? ` cv-${v[0]}` : ''}" data-i="${i}">
    <div class="cv-bubble"><span class="tb-es">${e(m.text)}</span>${v && mine ? `<span class="cv-badge">${v[1]}</span>` : ''}</div>
    ${mine && m.translation && m.verdict !== 'not_spanish' ? `<div class="cv-tr">${e(m.translation)}</div>` : ''}
    <div class="cv-details">${details}</div>
  </div>`;
}

function reviewHtml(r) {
  const st = convoStats(r);
  return `
    <div class="study-card">
      <div class="word-ex">${r.app ? `<b>${e(r.app)}</b> · ` : ''}${e(r.context || '')}</div>
      ${r.register ? `<div class="word-local">🗣 ${e(r.register)}</div>` : ''}
      ${st.mine ? `<div class="cv-score"><span class="cv-s-ok">${st.ok} верно</span><span class="cv-s-minor">${st.minor + st.other} неточн.</span><span class="cv-s-error">${st.error} ошиб.</span></div>` : '<div class="muted">Своих сообщений на скриншотах не нашёл — ваши пузыри должны быть справа.</div>'}
    </div>
    <div class="cv-log">${(r.messages || []).map(bubble).join('')}</div>
    ${r.overall ? `<section class="tb-section"><h2>Разбор</h2><div class="tb-text"><p>${e(r.overall)}</p></div>
      ${(r.tips || []).length ? `<ul class="tb-list">${r.tips.map((t) => `<li>${e(t)}</li>`).join('')}</ul>` : ''}</section>` : ''}
    ${(r.slang || []).length ? `<section class="tb-section"><h2>Сокращения и сленг</h2>${r.slang.map((s, i) => `
      <div class="tb-example"><div style="flex:1"><b class="tb-es">${e(s.es)}</b> — ${e(s.meaning)}</div><button type="button" class="ghost cv-add" data-slang="${i}" aria-label="В словарь">${icon('plus', 'ic ic-sm')}</button></div>`).join('')}</section>` : ''}
    ${r.reply && r.reply.es ? `<section class="tb-section"><h2>Можно ответить так</h2>
      <div class="tb-example"><button type="button" class="tb-say" data-say="${e(r.reply.es)}" aria-label="Послушать">${icon('sound', 'ic ic-sm')}</button><div style="flex:1"><div class="tb-es">${e(r.reply.es)}</div><div class="muted">${e(r.reply.ru)}</div></div></div>
      <button type="button" class="ghost wide" id="cv-copy-reply">Скопировать ответ</button></section>` : ''}
    <section class="tb-section"><h2>Проверить мой ответ</h2>
      <p class="status">Напишите, что хотите отправить, — проверю с учётом этой переписки.</p>
      <textarea id="cv-draft" rows="3" placeholder="напр. vale, nos vemos mañana a las 10" autocapitalize="off"></textarea>
      <button type="button" id="cv-check">Проверить перед отправкой</button>
      <div id="cv-draft-out"></div>
    </section>`;
}

async function saveHistory(r, note) {
  const list = (await getSetting('chatReviews')) || [];
  list.unshift({ id: Date.now(), date: Date.now(), note, review: r });
  await setSetting('chatReviews', list.slice(0, HISTORY));
}

function wire(container) {
  container.querySelectorAll('[data-say]').forEach((b) => { b.onclick = () => speak(b.dataset.say).catch(() => {}); });
  container.querySelectorAll('.cv-bubble .tb-es, .cv-details').forEach((el) => enableWordPick(el));
  container.querySelectorAll('[data-slang]').forEach((b) => {
    b.onclick = async () => {
      const s = review.slang[Number(b.dataset.slang)];
      const vocab = await getVocab();
      if (!findExistingWord(vocab, s.es)) {
        const now = Date.now();
        await putWord({ es: s.es, ru: s.meaning, example: '', exampleRu: '', gender: '', pos: '', local: 'из переписки', source: 'convo', createdAt: now, ...newCard(now) });
      }
      b.disabled = true;
      b.innerHTML = icon('check', 'ic ic-sm');
    };
  });
  const cr = container.querySelector('#cv-copy-reply');
  if (cr) cr.onclick = async () => { try { await navigator.clipboard.writeText(review.reply.es); cr.textContent = 'Скопировано'; } catch (err) { cr.textContent = review.reply.es; } };
  const ck = container.querySelector('#cv-check');
  if (ck) ck.onclick = () => draft(container);
}

async function draft(container) {
  const ta = container.querySelector('#cv-draft');
  const text = ta.value.trim();
  const out = container.querySelector('#cv-draft-out');
  if (!text || busy) return;
  busy = true;
  out.innerHTML = '<p class="status">Проверяю…</p>';
  try {
    const r = await checkDraft(text, convoText(review));
    const best = r.natural || r.corrected || text;
    out.innerHTML = `<div class="study-card">
      <div class="${r.ok ? 'gr-ok' : 'gr-bad'}">${r.ok ? '✅ Можно отправлять' : '✏️ Лучше поправить'}</div>
      ${r.corrected && r.corrected !== text ? `<div class="cv-fix"><span class="muted">Правильно:</span> <b class="tb-es">${e(r.corrected)}</b></div>` : ''}
      ${r.natural ? `<div class="cv-fix"><span class="muted">Естественнее:</span> <span class="tb-es">${e(r.natural)}</span></div>` : ''}
      ${r.explanation ? `<div class="cv-why">${e(r.explanation)}</div>` : ''}
      <button type="button" class="ghost wide" id="cv-copy-draft">Скопировать: ${e(best)}</button></div>`;
    out.querySelector('#cv-copy-draft').onclick = async (ev) => { try { await navigator.clipboard.writeText(best); ev.currentTarget.textContent = 'Скопировано'; } catch (err) { /* показан текст */ } };
    if (!r.ok && r.corrected && r.corrected !== text) await logMistakes([{ phrase: text, corrected: r.corrected, topic: r.topic || '' }], 'convo');
    await recordActivity('grammar');
  } catch (err) {
    out.innerHTML = `<p class="status">${e(err.message)}</p>`;
  } finally {
    busy = false;
  }
}

function showReview(container, r, saved = false) {
  review = r;
  container.innerHTML = `<p class="tb-kicker">Разбор переписки${saved ? ' · из истории' : ''}</p><h1>Как вы пишете</h1>
    ${reviewHtml(r)}
    <button type="button" id="cv-new" class="big">${icon('plus', 'ic ic-sm')} Разобрать другую переписку</button>`;
  wire(container);
  container.querySelector('#cv-new').onclick = () => { shots = []; review = null; render(container); };
  window.scrollTo(0, 0);
}

async function analyze(container) {
  if (busy || !shots.length) return;
  busy = true;
  const note = container.querySelector('#cv-note').value.trim();
  const status = container.querySelector('#cv-status');
  const go = container.querySelector('#cv-go');
  go.disabled = true;
  const stop = stagedStatus(status, ['Читаю скриншоты…', 'Разбираю ваши сообщения…', 'Ищу, как написал бы испанец…', 'Собираю советы…'], 8000);
  try {
    const r = await reviewConversation(shots.map((s) => s.b64), note);
    stop();
    if (!container.querySelector('#cv-status')) return;
    await saveHistory(r, note);
    await logMistakes(mistakesFromConvo(r), 'convo');
    await recordActivity('grammar');
    await recordStudyDay();
    shots = [];
    showReview(container, r);
  } catch (err) {
    stop();
    if (status.isConnected) status.textContent = err.message;
    go.disabled = false;
  } finally {
    busy = false;
  }
}

async function addFiles(container, files) {
  const status = container.querySelector('#cv-status');
  status.textContent = 'Готовлю скриншоты…';
  try {
    for (const f of files) {
      if (shots.length >= MAX_IMAGES) break;
      for (const img of await fileToImages(f)) if (shots.length < MAX_IMAGES) shots.push(img);
    }
    status.textContent = shots.length >= MAX_IMAGES ? `Не больше ${MAX_IMAGES} картинок за раз.` : '';
  } catch (err) {
    status.textContent = err.message;
  }
  paintShots(container);
}

function paintShots(container) {
  const box = container.querySelector('#cv-shots');
  box.innerHTML = shots.map((s, i) => `<div class="cv-thumb"><img src="${s.preview}" alt="Скриншот ${i + 1}"><button type="button" data-rm="${i}" aria-label="Убрать">${icon('close', 'ic ic-sm')}</button></div>`).join('');
  box.querySelectorAll('[data-rm]').forEach((b) => { b.onclick = () => { shots.splice(Number(b.dataset.rm), 1); paintShots(container); }; });
  container.querySelector('#cv-go').disabled = !shots.length;
  container.querySelector('#cv-step2').hidden = !shots.length;
}

async function render(container) {
  if (review) { showReview(container, review); return; }
  const history = (await getSetting('chatReviews')) || [];
  container.innerHTML = `
    <h1>Переписка</h1>
    <p class="lead">Пришлите скриншоты переписки с испанцами — разберу каждое ваше сообщение: верно или нет, как поправить и как написал бы испанец. И объясню, что пишут вам.</p>
    <div class="cv-pick">
      <label class="cv-pick-btn" for="cv-gallery">${icon('image', 'ic')}<span>Выбрать скриншоты</span></label>
      <label class="cv-pick-btn" for="cv-camera">${icon('camera', 'ic')}<span>Сфотографировать экран</span></label>
    </div>
    <input id="cv-gallery" class="sr-only" type="file" accept="image/*" multiple>
    <input id="cv-camera" class="sr-only" type="file" accept="image/*" capture="environment">
    <div id="cv-shots" class="cv-shots"></div>
    <div id="cv-step2" hidden>
      <label>С кем и о чём (необязательно)
        <input id="cv-note" type="text" placeholder="напр. хозяин квартиры, договариваемся о ремонте">
      </label>
      <button id="cv-go" class="big" disabled>Разобрать переписку</button>
    </div>
    <p id="cv-status" class="status" role="status"></p>
    <p class="status">Длинную переписку можно прислать несколькими скриншотами по порядку (до ${MAX_IMAGES}). Ваши сообщения — пузыри справа. Скриншоты отправляются Claude только для разбора и не сохраняются; сам разбор хранится лишь на этом телефоне.</p>
    ${history.length ? `<details class="tch-extra"><summary>Прошлые разборы (${history.length})</summary>
      ${history.map((h, i) => { const st = convoStats(h.review); return `<button class="unit-row tb-row" data-h="${i}"><span class="unit-title">${e(new Date(h.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }))} · ${e(h.note || h.review.context || 'переписка')}</span><span class="unit-score">${st.ok}/${st.mine}</span></button>`; }).join('')}
    </details>` : ''}`;
  const onPick = (input) => { input.onchange = () => { const files = [...input.files]; input.value = ''; if (files.length) addFiles(container, files); }; };
  onPick(container.querySelector('#cv-gallery'));
  onPick(container.querySelector('#cv-camera'));
  container.querySelector('#cv-go').onclick = () => analyze(container);
  container.querySelectorAll('[data-h]').forEach((b) => { b.onclick = () => showReview(container, history[Number(b.dataset.h)].review, true); });
  paintShots(container);
}

registerFeature({ id: 'convo', title: 'Переписка', icon: '💬', order: 42, render });
