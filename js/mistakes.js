// Единый журнал ошибок: грамматика, уроки, задания, чат, сценки, «5 слов».
// Все ошибки попадают в «слабые темы», по которым Учитель подбирает уроки.
import { addMistake } from './db.js';

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
    const m = normalizeMistake({
      phrase: (answers || [])[i] || '(без ответа)',
      corrected: expected || '',
      topic: lesson.topic,
    }, 'lesson', now + i);
    if (m) out.push(m);
  });
  return out;
}

export async function logMistakes(list, source) {
  const now = Date.now();
  let n = 0;
  for (const raw of Array.isArray(list) ? list : []) {
    const m = raw && raw.source ? raw : normalizeMistake(raw, source, now + n);
    if (!m) continue;
    await addMistake(m);
    n++;
  }
  return n;
}
