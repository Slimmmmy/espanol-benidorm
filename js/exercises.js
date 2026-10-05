// Типы карточек для повторения и проверка ответов. Чистые функции (без DOM).
import { normalizeText, similarity } from './util.js';

export const CARD_TYPES = {
  'ru-es': 'Вспомни по-испански',
  'es-ru': 'Что это значит?',
  listen: 'Послушай и вспомни',
  type: 'Напиши по-испански',
  cloze: 'Вставь слово',
  speak: 'Скажи вслух',
  gender: 'El или la?',
  verb: 'Глагол',
  fix: 'Исправьте ошибку',
};

const ARTICLES = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas']);

export function stripArticle(s) {
  const words = normalizeText(s).split(' ');
  if (words.length > 1 && ARTICLES.has(words[0])) words.shift();
  return words.join(' ');
}

// Пропуск в примере: ищем слово (или его форму — по общему началу) и заменяем на «＿＿＿».
export function makeCloze(example, es) {
  if (!example || !es) return null;
  const target = stripArticle(es);
  if (!target) return null;
  const parts = String(example).split(/(\s+)/);
  const norm = parts.map((p) => normalizeText(p));
  const targetWords = target.split(' ');

  if (targetWords.length === 1) {
    const stem = target.length > 4 ? target.slice(0, Math.max(4, target.length - 2)) : target;
    const i = norm.findIndex((n) => n === target || (target.length > 4 && n.startsWith(stem)));
    if (i === -1) return null;
    const answer = parts[i].replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
    parts[i] = parts[i].replace(answer, '＿＿＿');
    return { text: parts.join(''), answer };
  }

  // Фраза из нескольких слов: ищем подряд идущие токены.
  const wordIdx = parts.map((p, i) => (/\S/.test(p) ? i : -1)).filter((i) => i !== -1);
  for (let k = 0; k + targetWords.length <= wordIdx.length; k++) {
    const slice = wordIdx.slice(k, k + targetWords.length);
    if (slice.every((pi, j) => norm[pi] === targetWords[j])) {
      const first = slice[0];
      const last = slice[slice.length - 1];
      const answer = parts.slice(first, last + 1).join('').replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
      const replaced = parts.slice(first, last + 1).join('').replace(answer, '＿＿＿');
      return { text: [...parts.slice(0, first), replaced, ...parts.slice(last + 1)].join(''), answer };
    }
  }
  return null;
}

const GENDERS = new Set(['el', 'la']);
export const nounGender = (w) => (w && !w.kind && GENDERS.has(String(w.gender || '').trim().toLowerCase()) ? String(w.gender).trim().toLowerCase() : '');

// Существительное без артикля (для вопроса «el или la?»), с сохранением ударений.
export function bareNoun(es) {
  return String(es || '').trim().replace(/^(el|la|los|las|un|una)\s+/i, '');
}

// Полная форма с артиклем: «perro» + el → «el perro».
export function withArticle(w) {
  const g = nounGender(w);
  if (!g) return w.es;
  return /^(el|la|los|las)\s/i.test(String(w.es).trim()) ? w.es : `${g} ${w.es}`;
}

export function availableTypes(word, caps = {}) {
  const types = ['ru-es', 'es-ru', 'type'];
  if (nounGender(word)) types.push('gender');
  if (caps.tts) types.push('listen');
  if (makeCloze(word.example, word.es)) types.push('cloze');
  if (caps.asr) types.push('speak');
  return types;
}

// Новое слово сначала знакомим классической карточкой, дальше — чередуем типы.
export function pickCardType(word, caps = {}, mode = 'mixed', rnd = Math.random) {
  if (word.kind === 'verb') return 'verb';
  if (word.kind === 'fix') return 'fix';
  if (mode === 'classic' || !(word.reps > 0)) return 'ru-es';
  const types = availableTypes(word, caps);
  return types[Math.min(types.length - 1, Math.floor(rnd() * types.length))];
}

// Оценка введённого/сказанного ответа: 'ok' | 'close' | 'wrong'.
export function checkAnswer(expected, got) {
  if (!normalizeText(got)) return 'wrong';
  const score = Math.max(similarity(expected, got), similarity(stripArticle(expected), stripArticle(got)));
  if (score >= 0.85) return 'ok';
  if (score >= 0.6) return 'close';
  return 'wrong';
}

// Ответ на «Напиши по-испански» для существительного: без верного артикля — «почти».
// Возвращает { result, note }.
export function checkNounAnswer(word, got) {
  const g = nounGender(word);
  const expected = withArticle(word);
  const result = checkAnswer(expected, got);
  if (!g || result === 'wrong') return { result, note: '' };
  const first = normalizeText(got).split(' ')[0];
  const said = { el: 'el', un: 'el', la: 'la', una: 'la' }[first] || '';
  if (!said) return { result: 'close', note: `Не забудьте артикль: ${expected}` };
  if (said !== g) return { result: 'close', note: `Род: ${expected}` };
  return { result, note: '' };
}

// Пословное сравнение для диктанта: какие слова эталона ученик написал верно (LCS).
export function diffWords(expected, got) {
  const exp = String(expected || '').split(/\s+/).filter(Boolean);
  const a = exp.map((w) => normalizeText(w));
  const b = normalizeText(got).split(' ').filter(Boolean);
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] && a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ok = new Array(a.length).fill(false);
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] && a[i] === b[j]) { ok[i] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  // Токены из одной пунктуации (напр. «—») считаем верными, чтобы не портить счёт.
  const tokens = exp.map((w, k) => ({ w, ok: ok[k] || !a[k] }));
  const scored = tokens.filter((t, k) => a[k]);
  const correct = scored.filter((t) => t.ok).length;
  return { tokens, correct, total: scored.length };
}
