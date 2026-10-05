import { getSetting, setSetting, getAllWords, getAllMistakes } from './db.js';

export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const dayNum = (key) => Math.round(Date.parse(key + 'T00:00:00Z') / 86400000);
export const MAX_FREEZES = 2;
export const FREEZE_EVERY = 7;

// Серия занятий. С заморозками: каждые 7 дней серии дают ❄️ (максимум 2),
// и один пропущенный день «съедает» заморозку вместо того, чтобы обнулить серию.
export function computeStreakInfo(days, today, { allowFreeze = true } = {}) {
  const nums = [...new Set(days || [])].map(dayNum).filter(Number.isFinite).sort((a, b) => a - b);
  let streak = 0;
  let freezes = 0;
  let prev = null;
  for (const d of nums) {
    if (prev === null) streak = 1;
    else {
      const missed = d - prev - 1;
      if (missed <= 0) streak++;
      else if (allowFreeze && missed <= freezes) { freezes -= missed; streak++; }
      else { streak = 1; freezes = 0; }
    }
    if (allowFreeze && streak % FREEZE_EVERY === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
    prev = d;
  }
  if (prev === null) return { streak: 0, freezes: 0, atRisk: false };
  const missedNow = dayNum(today) - prev - 1;
  if (missedNow <= 0) return { streak, freezes, atRisk: missedNow === 0 };
  if (allowFreeze && missedNow <= freezes) return { streak, freezes: freezes - missedNow, atRisk: true };
  return { streak: 0, freezes: 0, atRisk: false };
}

export function computeStreak(days, today) {
  return computeStreakInfo(days, today, { allowFreeze: false }).streak;
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
  const vocab = words.filter((w) => !w.kind);
  const learned = vocab.filter((w) => (w.reps || 0) >= 3).length;
  const topicMap = {};
  for (const m of mistakes) {
    const t = (m.topic || '').trim();
    if (t) topicMap[t] = (topicMap[t] || 0) + 1;
  }
  const weak = Object.entries(topicMap)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({ topic, count }));
  const info = computeStreakInfo(days, dayKey(now));
  return { words: vocab.length, learned, due, streak: info.streak, freezes: info.freezes, streakAtRisk: info.atRisk, weak };
}
