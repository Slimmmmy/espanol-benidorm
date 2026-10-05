import { getSetting, setSetting, getAllWords } from './db.js';
import { getStats } from './stats.js';
import { freqCoverage } from './freq.js';
import { TENSES } from './verbs.js';

export function pickNextTopic(weak, lastTopic) {
  if (!weak || weak.length === 0) return 'Общая практика грамматики';
  const sorted = [...weak].sort((a, b) => b.count - a.count);
  const pick = sorted.find((w) => w.topic !== lastTopic) || sorted[0];
  return pick.topic;
}

// Времена, которые ученик тренирует, и насколько уверенно (по карточкам глаголов). Чистая функция.
export function tenseSkills(words) {
  const out = [];
  for (const t of TENSES) {
    const cards = (words || []).filter((w) => w.kind === 'verb' && w.tense === t.id);
    if (!cards.length) continue;
    const solid = cards.filter((w) => (w.reps || 0) >= 3 && (w.lapses || 0) < 3).length;
    out.push(`${t.title}: ${solid} из ${cards.length} глаголов уверенно`);
  }
  return out;
}

// Модель ученика: компактный профиль, который уходит в запросы к ИИ (уроки, курс, чат, задания).
export async function buildProfile() {
  const [stats, words] = await Promise.all([getStats(), getAllWords()]);
  const level = (await getSetting('level')) || 'A2-B1';
  const tp = (await getSetting('teacherProfile')) || {};
  const history = (await getSetting('lessonHistory')) || [];
  const memory = (await getSetting('tutorMemory')) || [];
  const goal = (await getSetting('goal')) || '';
  const placement = await getSetting('placement');
  const cov = freqCoverage(words);
  return {
    level,
    placement: placement ? `${placement.cefr} по входному тесту` : '',
    goal,
    words: stats.words,
    learned: stats.learned,
    frequency: `в словаре ${cov.inDict} из 1000 самых частых слов, выучено ${cov.learned}`,
    tenses: tenseSkills(words),
    weak: stats.weak.slice(0, 8),
    note: tp.note || '',
    lastTopic: tp.lastTopic || '',
    lessonsCompleted: history.length,
    memory,
  };
}

export async function saveProfileNote(note, lastTopic) {
  const tp = (await getSetting('teacherProfile')) || {};
  tp.note = note;
  if (lastTopic !== undefined) tp.lastTopic = lastTopic;
  tp.updatedAt = Date.now();
  await setSetting('teacherProfile', tp);
}

export async function recordLesson(entry) {
  const history = (await getSetting('lessonHistory')) || [];
  history.push(entry);
  await setSetting('lessonHistory', history);
}

export async function getLessonHistory() {
  return (await getSetting('lessonHistory')) || [];
}

export function nextUnit(units) {
  return (units || []).find((u) => u.status !== 'done') || null;
}

export async function getCourse() {
  return (await getSetting('course')) || null;
}

export async function saveCourse(course) {
  await setSetting('course', course);
}

export async function markUnitDone(unitId, score) {
  const course = await getSetting('course');
  if (!course || !course.units) return;
  const u = course.units.find((x) => x.id === unitId);
  if (u) {
    u.status = 'done';
    u.score = score;
    await setSetting('course', course);
  }
}

export function partitionAssignments(list) {
  const arr = Array.isArray(list) ? list : [];
  return {
    open: arr.filter((a) => a.status !== 'done'),
    done: arr.filter((a) => a.status === 'done'),
  };
}

export async function getAssignments() {
  return (await getSetting('assignments')) || [];
}

export async function saveAssignments(list) {
  await setSetting('assignments', list);
}

export async function getMemory() {
  return (await getSetting('tutorMemory')) || [];
}

export async function saveMemory(list) {
  await setSetting('tutorMemory', list);
}
