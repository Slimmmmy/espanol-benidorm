// «Книга»: фото страницы → распознанный текст с переводом по абзацам, смысл, новые слова, грамматика,
// вопросы по тексту. Любое слово в тексте можно нажать (перевод + «в словарь»).
import { registerFeature } from './app.js';
import { getSetting, setSetting, getAllWords } from './db.js';
import { readBookPage, askAboutPage } from './claude.js';
import { enableWordPick, saveWord, findExistingWord } from './wordpick.js';
import { speak, stopSpeaking } from './tts.js';
import { escapeHtml, renderMarkdown } from './util.js';
import { recordActivity } from './activity.js';
import { recordStudyDay } from './stats.js';
import { autoSync } from './sync.js';

const MAX_SIDE = 1600;
const MAX_PAGES = 30;

let current = null; // открытая страница
let busy = false;

// Размер картинки для отправки: длинная сторона не больше max. Чистая функция.
export function scaleToFit(w, h, max = MAX_SIDE) {
  if (!w || !h) return { w: 0, h: 0 };
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

// Приводит ответ модели к надёжной форме: выровненные абзацы и переводы, пустые поля по умолчанию.
export function normalizeReading(r) {
  const paragraphs = (Array.isArray(r && r.paragraphs) ? r.paragraphs : []).map((p) => String(p || '').trim()).filter(Boolean);
  const tr = Array.isArray(r && r.translation) ? r.translation : [];
  return {
    title: String((r && r.title) || 'Страница').trim(),
    paragraphs,
    translation: paragraphs.map((_, i) => String(tr[i] || '').trim()),
    summary: String((r && r.summary) || '').trim(),
    words: (Array.isArray(r && r.words) ? r.words : []).filter((w) => w && w.es).map((w) => ({
      es: String(w.es).trim(), ru: String(w.ru || '').trim(), inText: String(w.inText || '').trim(),
      example: String(w.example || '').trim(), exampleRu: String(w.exampleRu || '').trim(),
    })),
    grammar: (Array.isArray(r && r.grammar) ? r.grammar : []).filter((g) => g && g.fragment).map((g) => ({
      fragment: String(g.fragment).trim(), explanation: String(g.explanation || '').trim(),
    })),
    level: String((r && r.level) || '').trim(),
  };
}

async function getPages() { return (await getSetting('readerPages')) || []; }
async function savePages(list) { await setSetting('readerPages', list.slice(-MAX_PAGES)); }

async function savePage(page) {
  const list = (await getPages()).filter((p) => p.id !== page.id);
  list.push(page);
  await savePages(list);
}

// Фото → JPEG (base64) не больше MAX_SIDE по длинной стороне, с учётом поворота камеры.
async function fileToJpegB64(file) {
  let src;
  try {
    src = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (e) {
    src = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Не получилось открыть фото. Попробуйте другое.'));
      img.src = URL.createObjectURL(file);
    });
  }
  const { w, h } = scaleToFit(src.width, src.height);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(src, 0, 0, w, h);
  const url = canvas.toDataURL('image/jpeg', 0.85);
  return { b64: url.split(',')[1], preview: canvas.toDataURL('image/jpeg', 0.5) };
}

// «1 слово», «2 слова», «5 слов».
export function wordsLabel(n) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} слово`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} слова`;
  return `${n} слов`;
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

// ── Список страниц и съёмка ──────────────────────────
async function renderHome(container) {
  const e = escapeHtml;
  const pages = (await getPages()).slice().reverse();
  const book = (await getSetting('readerBook')) || '';
  container.innerHTML = `
    <h1>Книга</h1>
    <div class="study-card rd-intro">
      <p>Сфотографируйте страницу испанской книги. Я распознаю текст, переведу по абзацам, объясню смысл и выберу новые для вас слова.</p>
      <label>Что читаете (необязательно)
        <input id="rd-book" type="text" placeholder="напр. La sombra del viento" value="${e(book)}">
      </label>
      <div class="rd-shoot">
        <label class="rd-btn rd-btn-main" for="rd-camera">📷 Сфотографировать страницу</label>
        <label class="rd-btn" for="rd-gallery">Выбрать из фото</label>
      </div>
      <input id="rd-camera" class="sr-only" type="file" accept="image/*" capture="environment">
      <input id="rd-gallery" class="sr-only" type="file" accept="image/*">
      <p class="muted rd-tip">Совет: страница целиком, ровно и при хорошем свете — так текст распознаётся точнее.</p>
    </div>
    <div id="rd-progress"></div>
    ${pages.length ? `<h2 class="section-label">Прочитанные страницы</h2>
      <div class="rd-list">${pages.map((p) => `
        <button class="rd-item" data-open="${e(p.id)}">
          <span class="rd-item-title">${e(p.title)}</span>
          <span class="muted">${e([p.book, fmtDate(p.date), wordsLabel(p.words.length)].filter(Boolean).join(' · '))}</span>
        </button>`).join('')}</div>` : ''}
  `;
  const bookEl = container.querySelector('#rd-book');
  bookEl.addEventListener('change', () => setSetting('readerBook', bookEl.value.trim()));
  ['#rd-camera', '#rd-gallery'].forEach((sel) => {
    container.querySelector(sel).addEventListener('change', (ev) => {
      const file = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (file) processPhoto(container, file, bookEl.value.trim());
    });
  });
  container.querySelectorAll('[data-open]').forEach((b) => {
    b.onclick = async () => {
      current = (await getPages()).find((p) => p.id === b.dataset.open) || null;
      if (current) renderPage(container);
    };
  });
}

async function processPhoto(container, file, book) {
  if (busy) return;
  busy = true;
  const box = container.querySelector('#rd-progress');
  const setBox = (html) => { if (box && container.contains(box)) box.innerHTML = html; };
  try {
    await setSetting('readerBook', book);
    setBox('<p class="status">Готовлю фото…</p>');
    const { b64, preview } = await fileToJpegB64(file);
    setBox(`<div class="study-card rd-working"><img class="rd-thumb" src="${preview}" alt="Фото страницы">
      <div><b>Читаю страницу…</b><div class="muted">Распознаю текст, перевожу и выбираю слова. Обычно 15–40 секунд.</div></div></div>`);
    const known = (await getAllWords()).map((w) => w.es).filter(Boolean);
    const r = normalizeReading(await readBookPage(b64, known, book));
    if (!r.paragraphs.length) {
      setBox(`<p class="status">${escapeHtml(r.summary || 'Не удалось найти на фото испанский текст. Попробуйте сфотографировать ровнее и ближе.')}</p>`);
      return;
    }
    const page = { id: `p${Date.now()}`, date: Date.now(), book, ...r, qa: [] };
    await savePage(page);
    await recordActivity('reading');
    await recordStudyDay();
    autoSync();
    if (!container.contains(box)) return; // ушли на другой экран — страница сохранена в списке
    current = page;
    renderPage(container);
  } catch (err) {
    setBox(`<p class="status">${escapeHtml(err.message)}</p>`);
  } finally {
    busy = false;
  }
}

// ── Страница ─────────────────────────────────────────
function pageText(page) {
  return page.paragraphs.join('\n\n');
}

async function renderPage(container) {
  const e = escapeHtml;
  const p = current;
  const words = await getAllWords();
  container.innerHTML = `
    <button id="rd-back" class="ghost rd-back">← Все страницы</button>
    <h1>${e(p.title)}</h1>
    <div class="rd-meta muted">${e([p.book, fmtDate(p.date)].filter(Boolean).join(' · '))}${p.level ? ` <span class="chip rd-level">${e(p.level)}</span>` : ''}</div>

    ${p.summary ? `<section class="study-card rd-summary"><h2>Смысл</h2><p>${e(p.summary)}</p></section>` : ''}

    <section>
      <div class="rd-head"><h2>Текст</h2>
        <span><button id="rd-all-tr" class="mini">Весь перевод</button><button id="rd-read-all" class="mini">🔊 Читать</button><button id="rd-stop" class="mini">⏹</button></span>
      </div>
      <p class="muted rd-hint">Нажмите на любое слово — перевод и «＋ в словарь».</p>
      <div class="rd-text">${p.paragraphs.map((para, i) => `
        <div class="rd-par">
          <p class="rd-es">${e(para)}</p>
          <div class="rd-tools" data-nopick><button class="mini" data-say="${i}">🔊</button><button class="mini" data-slow="${i}">🐢</button><button class="mini" data-tr="${i}">RU</button></div>
          <p class="rd-ru muted hidden" data-ru="${i}">${e(p.translation[i] || '')}</p>
        </div>`).join('')}</div>
    </section>

    ${p.words.length ? `<section>
      <div class="rd-head"><h2>Новые слова</h2><button id="rd-add-all" class="mini">＋ Все в словарь</button></div>
      <div class="rd-words">${p.words.map((w, i) => {
        const have = !!findExistingWord(words, w.es);
        return `<div class="rd-word">
          <div class="rd-word-main"><b>${e(w.es)}</b> — ${e(w.ru)}
            ${w.example ? `<div class="word-ex">${e(w.example)}${w.exampleRu ? `<br><span class="muted">${e(w.exampleRu)}</span>` : ''}</div>` : ''}</div>
          <div class="rd-word-act"><button class="mini" data-wsay="${i}">🔊</button>${have ? '<span class="daily-added">✓</span>' : `<button class="mini" data-wadd="${i}">＋</button>`}</div>
        </div>`;
      }).join('')}</div>
    </section>` : ''}

    ${p.grammar.length ? `<section><h2>Грамматика на странице</h2>${p.grammar.map((g) => `
      <div class="lesson-ex"><div class="rd-gr es">«${e(g.fragment)}»</div><div class="word-ex">${e(g.explanation)}</div></div>`).join('')}</section>` : ''}

    <section>
      <h2>Вопрос по тексту</h2>
      <div id="rd-qa" class="chat-log">${(p.qa || []).map((m) => (m.role === 'user'
        ? `<div class="chat-msg chat-me">${e(m.content)}</div>`
        : `<div class="chat-msg chat-bot">${renderMarkdown(m.content)}</div>`)).join('')}</div>
      <div class="rd-ask">
        <input id="rd-q" type="text" placeholder="напр. Почему здесь subjuntivo?">
        <button id="rd-ask">➤</button>
      </div>
      <p id="rd-qstatus" class="status"></p>
    </section>

    <div class="rd-foot">
      <label class="rd-btn rd-btn-main" for="rd-next">📷 Следующая страница</label>
      <input id="rd-next" class="sr-only" type="file" accept="image/*" capture="environment">
      <button id="rd-del" class="danger">Удалить страницу</button>
    </div>
    <div id="rd-progress"></div>
  `;
  const q = (s) => container.querySelector(s);
  container.querySelectorAll('.rd-es').forEach((el) => enableWordPick(el));
  enableWordPick(q('#rd-qa'));
  q('#rd-back').onclick = () => { stopSpeaking(); current = null; renderHome(container); };
  q('#rd-stop').onclick = () => stopSpeaking();
  q('#rd-read-all').onclick = () => {
    import('./tts.js').then((t) => t.speakSequence(p.paragraphs.map((es) => ({ es, speaker: '' }))));
  };
  q('#rd-all-tr').onclick = () => {
    const hidden = container.querySelector('.rd-ru.hidden');
    container.querySelectorAll('.rd-ru').forEach((el) => el.classList.toggle('hidden', !hidden));
  };
  container.querySelectorAll('[data-say]').forEach((b) => { b.onclick = () => speak(p.paragraphs[Number(b.dataset.say)]); });
  container.querySelectorAll('[data-slow]').forEach((b) => { b.onclick = () => speak(p.paragraphs[Number(b.dataset.slow)], 'es-ES', { slow: true }); });
  container.querySelectorAll('[data-tr]').forEach((b) => { b.onclick = () => q(`[data-ru="${b.dataset.tr}"]`).classList.toggle('hidden'); });
  container.querySelectorAll('[data-wsay]').forEach((b) => { b.onclick = () => speak(p.words[Number(b.dataset.wsay)].es); });

  const addWord = async (i, btn) => {
    const w = p.words[i];
    btn.disabled = true;
    try {
      await saveWord({ es: w.es, ru: w.ru, example: w.example, exampleRu: w.exampleRu, local: p.book ? `Из книги: ${p.book}` : '' });
      btn.outerHTML = '<span class="daily-added">✓</span>';
    } catch (err) { btn.disabled = false; }
  };
  container.querySelectorAll('[data-wadd]').forEach((b) => { b.onclick = () => addWord(Number(b.dataset.wadd), b); });
  const addAll = q('#rd-add-all');
  if (addAll) {
    addAll.onclick = async () => {
      addAll.disabled = true;
      for (const b of [...container.querySelectorAll('[data-wadd]')]) await addWord(Number(b.dataset.wadd), b);
      addAll.textContent = '✓ Добавлены';
    };
  }

  const ask = async () => {
    const input = q('#rd-q');
    const text = input.value.trim();
    if (!text || busy) return;
    busy = true;
    input.value = '';
    p.qa = [...(p.qa || []), { role: 'user', content: text }];
    q('#rd-qa').insertAdjacentHTML('beforeend', `<div class="chat-msg chat-me">${e(text)}</div><div class="chat-msg chat-bot chat-typing">…</div>`);
    try {
      const reply = await askAboutPage(pageText(p), p.qa);
      p.qa.push({ role: 'assistant', content: reply });
      await savePage(p);
      if (!container.contains(input)) return;
      const typing = container.querySelector('#rd-qa .chat-typing');
      if (typing) typing.outerHTML = `<div class="chat-msg chat-bot">${renderMarkdown(reply)}</div>`;
      enableWordPick(q('#rd-qa'));
    } catch (err) {
      p.qa.pop();
      const typing = container.querySelector('#rd-qa .chat-typing');
      if (typing) typing.remove();
      const st = q('#rd-qstatus');
      if (st) st.textContent = err.message;
    } finally {
      busy = false;
    }
  };
  q('#rd-ask').onclick = ask;
  q('#rd-q').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); ask(); } });

  q('#rd-next').addEventListener('change', (ev) => {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (file) processPhoto(container, file, p.book || '');
  });
  q('#rd-del').onclick = async () => {
    const btn = q('#rd-del');
    if (btn.dataset.confirm !== '1') { btn.dataset.confirm = '1'; btn.textContent = 'Точно удалить?'; return; }
    await savePages((await getPages()).filter((x) => x.id !== p.id));
    current = null;
    renderHome(container);
  };
}

async function render(container) {
  if (current) await renderPage(container);
  else await renderHome(container);
}

registerFeature({ id: 'reader', title: 'Книга', icon: '📖', order: 22, render });
