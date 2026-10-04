// «Слово по нажатию»: любое испанское слово в диалогах, чате, уроках и разборах можно тронуть —
// увидеть перевод, послушать и одним нажатием добавить в словарь (→ в повторение).
import { enrichWord } from './claude.js';
import { getAllWords, putWord } from './db.js';
import { newCard } from './srs.js';
import { recordActivity } from './activity.js';
import { speak } from './tts.js';
import { escapeHtml } from './util.js';
import { stripArticle } from './exercises.js';

const WORD_RE = /([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:['’][A-Za-z]+)?)/;
const LATIN = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/;

// Разбивает текст на слова (латиница, включая испанские буквы) и всё остальное.
export function tokenizeEs(text) {
  return String(text || '').split(WORD_RE).filter((t) => t !== '').map((t) => ({ t, word: WORD_RE.test(t) && t.length > 1 }));
}

export function findExistingWord(words, es) {
  const key = stripArticle(es);
  if (!key) return null;
  return (words || []).find((w) => stripArticle(w.es) === key) || null;
}

// Сохранить слово в словарь, если его там ещё нет. Возвращает { status: 'added' | 'exists', id }.
export async function saveWordWithId(data) {
  if (!data || !data.es) throw new Error('Пустое слово.');
  const existing = findExistingWord(await getAllWords(), data.es);
  if (existing) return { status: 'exists', id: existing.id };
  const now = Date.now();
  const id = await putWord({
    es: data.es, ru: data.ru || '', example: data.example || '', exampleRu: data.exampleRu || '',
    pos: data.pos || '', gender: data.gender || '', local: data.local || '', createdAt: now, ...newCard(now),
  });
  await recordActivity('newWord');
  return { status: 'added', id };
}

// Сохранить слово в словарь, если его там ещё нет. Возвращает 'added' | 'exists'.
export async function saveWord(data) {
  return (await saveWordWithId(data)).status;
}

const SKIP = new Set(['BUTTON', 'TEXTAREA', 'INPUT', 'SELECT', 'SCRIPT', 'STYLE']);
const cache = new Map();

function closePopup() {
  const pop = document.getElementById('wp-pop');
  if (pop) pop.classList.remove('open');
}

function popupEl() {
  let pop = document.getElementById('wp-pop');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = 'wp-pop';
    document.body.appendChild(pop);
    pop.addEventListener('click', (e) => { if (e.target === pop) closePopup(); });
    window.addEventListener('hashchange', closePopup);
  }
  return pop;
}

async function openPopup(word, context) {
  const e = escapeHtml;
  const pop = popupEl();
  pop.innerHTML = `<div class="wp-panel">
    <div class="wp-head"><b>${e(word)}</b><button class="wp-x" data-wp="close">✕</button></div>
    <div class="wp-body"><p class="status">Перевожу…</p></div>
  </div>`;
  pop.classList.add('open');
  pop.querySelector('[data-wp="close"]').onclick = closePopup;
  const body = pop.querySelector('.wp-body');
  const key = word.toLowerCase();
  try {
    let w = cache.get(key);
    if (!w) {
      w = await enrichWord(context ? `${word} (контекст: ${context.slice(0, 200)})` : word);
      cache.set(key, w);
    }
    if (!pop.classList.contains('open') || !pop.contains(body)) return;
    const exists = !!findExistingWord(await getAllWords(), w.es);
    body.innerHTML = `
      <div class="word-main"><b>${e(w.es)}</b> ${w.gender ? `<span class="muted">(${e(w.gender)})</span>` : ''} — ${e(w.ru)}</div>
      ${w.example ? `<div class="word-ex">${e(w.example)}${w.exampleRu ? `<br><span class="muted">${e(w.exampleRu)}</span>` : ''}</div>` : ''}
      ${w.local ? `<div class="word-local">📍 ${e(w.local)}</div>` : ''}
      <div class="word-actions">
        <button data-wp="say">🔊</button>
        ${exists ? '<span class="daily-added">✓ уже в словаре</span>' : '<button data-wp="add">＋ В словарь</button>'}
      </div>`;
    body.querySelector('[data-wp="say"]').onclick = () => speak(w.es);
    const add = body.querySelector('[data-wp="add"]');
    if (add) {
      add.onclick = async () => {
        add.disabled = true;
        try {
          const r = await saveWord(w);
          add.outerHTML = `<span class="daily-added">${r === 'added' ? '✓ добавлено — появится в повторении' : '✓ уже в словаре'}</span>`;
        } catch (err) {
          add.disabled = false;
          body.insertAdjacentHTML('beforeend', `<p class="status">${e(err.message)}</p>`);
        }
      };
    }
  } catch (err) {
    if (pop.contains(body)) body.innerHTML = `<p class="status">${e(err.message)}</p>`;
  }
}

function wrapTextNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      for (let el = node.parentElement; el && el !== root.parentElement; el = el.parentElement) {
        if (SKIP.has(el.tagName) || el.classList.contains('wp') || el.hasAttribute('data-nopick')) return NodeFilter.FILTER_REJECT;
      }
      return LATIN.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const frag = document.createDocumentFragment();
    for (const tok of tokenizeEs(node.nodeValue)) {
      if (tok.word) {
        const span = document.createElement('span');
        span.className = 'wp';
        span.textContent = tok.t;
        frag.appendChild(span);
      } else {
        frag.appendChild(document.createTextNode(tok.t));
      }
    }
    node.parentNode.replaceChild(frag, node);
  }
}

// Делает испанские слова внутри root «трогательными». Выделенная фраза (до 60 символов) тоже работает.
// Можно вызывать повторно после перерисовки: уже обработанные слова не трогаются.
export function enableWordPick(root) {
  if (!root) return;
  wrapTextNodes(root);
  if (root.dataset.wpReady) return;
  root.dataset.wpReady = '1';
  root.addEventListener('click', (ev) => {
    const span = ev.target.closest && ev.target.closest('.wp');
    if (!span || !root.contains(span)) return;
    const sel = (window.getSelection && String(window.getSelection())).trim();
    const phrase = sel && sel.length > 1 && sel.length <= 60 && LATIN.test(sel) ? sel : span.textContent;
    const block = span.closest('p, li, .dlg-line, .chat-msg, .word-ex, .study-card, div');
    openPopup(phrase, block ? block.textContent.trim() : '');
  });
}
