// Единый журнал ошибок: грамматика, уроки, задания, чат, сценки, «5 слов».
// Все ошибки попадают в «слабые темы», по которым Учитель подбирает уроки.
import { addMistake, getAllWords, putWord } from './db.js';
import { newCard } from './srs.js';
import { normalizeText } from './util.js';
import { wordKey } from './wordkey.js';

const clip = (s, n = 300) => String(s ?? '').trim().slice(0, n);

export function normalizeMistake(m, source, now = Date.now()) {
  if (!m) return null;
  const phrase = clip(m.phrase ?? m.wrong);
  const topic = clip(m.topic, 80);
  if (!phrase && !topic) return null;
  return { phrase, corrected: clip(m.corrected ?? m.right), topic, source, createdAt: now };
}

// Неверно выполненные упражнения урока → ошибки по теме урока.
export function mistakesFromLesson(lesson, answers, results, now = Date.now()) {
  const exercises = (lesson && lesson.exercises) || [];
  const out = [];
  exercises.forEach((ex, i) => {
    const r = (results || [])[i];
    if (!r || r.correct) return;
    const expected = ex.type === 'choice' ? (ex.options || [])[ex.answer] : ex.expected;
    let phrase = (answers || [])[i] || '(без ответа)';
    let corrected = expected || '';
    // Выбор варианта в предложении с пропуском: сохраняем целую фразу — так из неё выйдет карточка.
    const gap = /_{2,}|…/;
    if (ex.type === 'choice' && (answers || [])[i] && gap.test(ex.prompt || '')) {
      phrase = ex.prompt.replace(gap, phrase);
      corrected = ex.prompt.replace(gap, corrected);
    }
    const m = normalizeMistake({
      phrase,
      corrected,
      topic: lesson.topic,
    }, 'lesson', now + i);
    if (m) out.push(m);
  });
  return out;
}

// Ошибка → карточка «Исправьте фразу» в общей очереди FSRS: через дни вы вспоминаете исправление.
export function makeFixCard(m) {
  if (!m) return null;
  const wrong = String(m.phrase || '').trim();
  const right = String(m.corrected || '').trim();
  if (!wrong || !right || wrong.length > 160 || right.length > 160) return null;
  if (!/[a-záéíóúñü]/i.test(right) || wrong === '(без ответа)') return null;
  if (right.split(/\s+/).length < 2) return null; // одно слово без контекста — плохая карточка
  if (normalizeText(wrong) === normalizeText(right)) return null;
  return { kind: 'fix', es: right, wrong, ru: m.topic || '', topic: m.topic || '', source: m.source || '', createdAt: m.createdAt || Date.now() };
}

export async function logMistakes(list, source) {
  const now = Date.now();
  let n = 0;
  const cards = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const m = raw && raw.source ? raw : normalizeMistake(raw, source, now + n);
    if (!m) continue;
    await addMistake(m);
    const card = makeFixCard(m);
    if (card) cards.push(card);
    n++;
  }
  if (cards.length) {
    const have = new Set((await getAllWords()).map(wordKey));
    for (const c of cards) {
      if (have.has(wordKey(c))) continue;
      have.add(wordKey(c));
      await putWord({ ...c, ...newCard(c.createdAt) });
    }
  }
  return n;
}
