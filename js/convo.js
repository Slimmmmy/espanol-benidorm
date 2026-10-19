// Разбор переписки по скриншотам — для чата с наставником (кнопка 📎).
// Скриншоты не сохраняются: в историю чата попадает только разбор (карточка + текст для контекста,
// чтобы наставник мог отвечать на вопросы о переписке).
import { loadImage, scaleToFit, MAX_SIDE } from './photo.js';
import { getVocab, putWord } from './db.js';
import { newCard } from './srs.js';
import { findExistingWord, enableWordPick } from './wordpick.js';
import { speak } from './tts.js';
import { escapeHtml } from './util.js';
import { icon } from './icons.js';

export const MAX_IMAGES = 8;

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

// Файл → один или несколько JPEG (base64) + превью.
export async function fileToImages(file) {
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

const MARK = { ok: '✓ верно', minor: '≈ неточность', error: '✗ ошибка', not_spanish: 'не по-испански' };

// Разбор текстом — уходит наставнику как его прошлая реплика, чтобы он помнил переписку.
export function convoText(review) {
  const r = review || {};
  const lines = (r.messages || []).map((m) => {
    if (m.from !== 'me') return `Собеседник: ${m.text}${m.translation ? ` (${m.translation})` : ''}`;
    const extra = [
      MARK[m.verdict] || '',
      m.corrected && m.corrected !== m.text ? `правильно: ${m.corrected}` : '',
      m.natural ? `естественнее: ${m.natural}` : '',
      m.explanation || '',
    ].filter(Boolean).join('; ');
    return `Я: ${m.text}${extra ? ` — ${extra}` : ''}`;
  });
  return [
    `Разбор переписки${r.app ? ` (${r.app})` : ''}${r.context ? `: ${r.context}` : ''}`,
    r.register || '',
    ...lines,
    r.overall ? `Итог: ${r.overall}` : '',
    (r.tips || []).length ? `Советы: ${r.tips.join('; ')}` : '',
    r.reply && r.reply.es ? `Вариант ответа: ${r.reply.es}` : '',
  ].filter(Boolean).join('\n');
}

const e = escapeHtml;
const VERDICT_CLASS = { ok: 'ok', minor: 'minor', error: 'error', not_spanish: 'minor' };

function bubble(m) {
  const mine = m.from === 'me';
  const cls = VERDICT_CLASS[m.verdict];
  const details = mine
    ? `${m.corrected && m.corrected !== m.text ? `<div class="cv-fix"><span class="muted">Правильно:</span> <b class="tb-es">${e(m.corrected)}</b></div>` : ''}
       ${m.natural ? `<div class="cv-fix"><span class="muted">Как написал бы испанец:</span> <span class="tb-es">${e(m.natural)}</span> <button type="button" class="tb-say" data-say="${e(m.natural)}" aria-label="Послушать">${icon('sound', 'ic ic-sm')}</button></div>` : ''}
       ${m.explanation ? `<div class="cv-why">${e(m.explanation)}</div>` : ''}`
    : `${m.translation ? `<div class="cv-tr">${e(m.translation)}</div>` : ''}${m.explanation ? `<div class="cv-why">${e(m.explanation)}</div>` : ''}`;
  return `<div class="cv-msg ${mine ? 'cv-me' : 'cv-them'}${cls ? ` cv-${cls}` : ''}">
    <div class="cv-bubble"><span class="tb-es">${e(m.text)}</span>${mine && MARK[m.verdict] ? `<span class="cv-badge">${MARK[m.verdict]}</span>` : ''}</div>
    ${mine && m.translation && m.verdict !== 'not_spanish' ? `<div class="cv-tr">${e(m.translation)}</div>` : ''}
    <div class="cv-details">${details}</div>
  </div>`;
}

// Карточка разбора внутри чата.
export function reviewCardHtml(r) {
  const st = convoStats(r);
  return `<div class="cv-card">
    <div class="cv-head">${r.app ? `<b>${e(r.app)}</b> · ` : ''}${e(r.context || 'Разбор переписки')}</div>
    ${r.register ? `<div class="word-local">🗣 ${e(r.register)}</div>` : ''}
    ${st.mine ? `<div class="cv-score"><span class="cv-s-ok">${st.ok} верно</span><span class="cv-s-minor">${st.minor + st.other} неточн.</span><span class="cv-s-error">${st.error} ошиб.</span></div>` : ''}
    <div class="cv-log">${(r.messages || []).map(bubble).join('')}</div>
    ${r.overall ? `<h3>Разбор</h3><p>${e(r.overall)}</p>${(r.tips || []).length ? `<ul class="tb-list">${r.tips.map((t) => `<li>${e(t)}</li>`).join('')}</ul>` : ''}` : ''}
    ${(r.slang || []).length ? `<h3>Сокращения и сленг</h3>${r.slang.map((s, i) => `
      <div class="cv-slang"><span><b class="tb-es">${e(s.es)}</b> — ${e(s.meaning)}</span><button type="button" class="cv-add" data-slang="${i}" aria-label="В словарь">${icon('plus', 'ic ic-sm')}</button></div>`).join('')}` : ''}
    ${r.reply && r.reply.es ? `<h3>Можно ответить так</h3>
      <div class="cv-fix"><button type="button" class="tb-say" data-say="${e(r.reply.es)}" aria-label="Послушать">${icon('sound', 'ic ic-sm')}</button><span><span class="tb-es">${e(r.reply.es)}</span><br><span class="muted">${e(r.reply.ru)}</span></span></div>
      <button type="button" class="cv-copy" data-copy="${e(r.reply.es)}">Скопировать ответ</button>` : ''}
    <p class="cv-hint">Спросите меня о переписке или пришлите свой ответ — проверю перед отправкой.</p>
  </div>`;
}

export function wireReviewCard(el, r) {
  el.querySelectorAll('[data-say]').forEach((b) => { b.onclick = () => speak(b.dataset.say).catch(() => {}); });
  el.querySelectorAll('.cv-bubble .tb-es, .cv-details').forEach((x) => enableWordPick(x));
  el.querySelectorAll('[data-slang]').forEach((b) => {
    b.onclick = async () => {
      const s = r.slang[Number(b.dataset.slang)];
      const vocab = await getVocab();
      if (!findExistingWord(vocab, s.es)) {
        const now = Date.now();
        await putWord({ es: s.es, ru: s.meaning, example: '', exampleRu: '', gender: '', pos: '', local: 'из переписки', source: 'convo', createdAt: now, ...newCard(now) });
      }
      b.disabled = true;
      b.innerHTML = icon('check', 'ic ic-sm');
    };
  });
  el.querySelectorAll('[data-copy]').forEach((b) => {
    b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Скопировано'; } catch (err) { /* текст виден выше */ } };
  });
}
