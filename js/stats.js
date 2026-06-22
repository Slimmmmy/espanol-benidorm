import { getSetting, setSetting, getAllWords, getAllMistakes } from './db.js';

export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prevKey(key) {
  const d = new Date(key + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function computeStreak(days, today) {
  const set = new Set(days);
  let cursor = today;
  if (!set.has(cursor)) {
    cursor = prevKey(cursor);
    if (!set.has(cursor)) return 0;
  }
  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    cursor = prevKey(cursor);
  }
  return streak;
}

export async function recordStudyDay(now = Date.now()) {
  const key = dayKey(now);
  const days = (await getSetting('studyDays')) || [];
  if (!days.includes(key)) {
    days.push(key);
    await setSetting('studyDays', days);
  }
}

export async function getStats() {
  const words = await getAllWords();
  const mistakes = await getAllMistakes();
  const days = (await getSetting('studyDays')) || [];
  const now = Date.now();
  const due = words.filter((w) => (w.due ?? 0) <= now).length;
  const learned = words.filter((w) => (w.reps || 0) >= 3).length;
  const topicMap = {};
  for (const m of mistakes) {
    const t = (m.topic || '').trim();
    if (t) topicMap[t] = (topicMap[t] || 0) + 1;
  }
  const weak = Object.entries(topicMap)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({ topic, count }));
  return { words: words.length, learned, due, streak: computeStreak(days, dayKey(now)), weak };
}
