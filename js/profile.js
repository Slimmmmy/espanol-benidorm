import { getSetting, setSetting } from './db.js';
import { getStats } from './stats.js';

export function pickNextTopic(weak, lastTopic) {
  if (!weak || weak.length === 0) return 'Общая практика грамматики';
  const sorted = [...weak].sort((a, b) => b.count - a.count);
  const pick = sorted.find((w) => w.topic !== lastTopic) || sorted[0];
  return pick.topic;
}

export async function buildProfile() {
  const stats = await getStats();
  const level = (await getSetting('level')) || 'A2-B1';
  const tp = (await getSetting('teacherProfile')) || {};
  const history = (await getSetting('lessonHistory')) || [];
  return {
    level,
    words: stats.words,
    learned: stats.learned,
    weak: stats.weak,
    note: tp.note || '',
    lastTopic: tp.lastTopic || '',
    lessonsCompleted: history.length,
  };
}

export async function saveProfileNote(note, lastTopic) {
  const tp = (await getSetting('teacherProfile')) || {};
  tp.note = note;
  if (lastTopic) tp.lastTopic = lastTopic;
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
