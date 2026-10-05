// Дневная активность (что и сколько сделано за день) + цель дня. Хранится в settings по ключу activity-YYYY-MM-DD.
import { getSetting, setSetting } from './db.js';
import { dayKey } from './stats.js';

export const activityKey = (ts = Date.now()) => `activity-${dayKey(ts)}`;

export async function recordActivity(kind, n = 1, now = Date.now()) {
  const key = activityKey(now);
  const a = (await getSetting(key)) || {};
  a[kind] = (a[kind] || 0) + n;
  await setSetting(key, a);
  // Сообщаем открытым экранам (полоска «Занятия», цель дня), что прогресс изменился.
  if (typeof window !== 'undefined' && window.dispatchEvent) window.dispatchEvent(new CustomEvent('es-activity', { detail: { kind } }));
  return a;
}

export async function getActivity(ts = Date.now()) {
  return (await getSetting(activityKey(ts))) || {};
}

// Слияние активности двух устройств: по каждому счётчику берём максимум (данные не задваиваются).
export function mergeActivity(a, b) {
  const out = { ...(b || {}) };
  for (const [k, v] of Object.entries(a || {})) out[k] = Math.max(v || 0, out[k] || 0);
  return out;
}

const PRACTICE_KINDS = ['lesson', 'assignment', 'roleplay', 'listening', 'dictation', 'speech', 'grammar', 'reading'];
export const REVIEW_GOAL = 20;

// Цель дня из трёх шагов: повторение, 5 слов, живая практика.
export function dailyGoal({ queueLeft = 0, activity = {}, dailyAdded = 0, dailyTotal = 5 } = {}) {
  const reviewed = activity.review || 0;
  const practiced = PRACTICE_KINDS.some((k) => (activity[k] || 0) > 0) || (activity.chat || 0) >= 3;
  const steps = [
    { id: 'review', title: 'Повторить карточки', hint: queueLeft > 0 ? `осталось ${queueLeft}` : `повторено ${reviewed}`, done: queueLeft === 0 || reviewed >= REVIEW_GOAL, hash: '#study' },
    { id: 'words', title: '5 новых слов', hint: `${dailyAdded}/${dailyTotal}`, done: dailyTotal > 0 && dailyAdded >= dailyTotal, hash: '#daily' },
    { id: 'practice', title: 'Живая практика', hint: practiced ? 'сделано' : 'сценка, книга, урок, аудио или 3 сообщения в чате', done: practiced, hash: '#practice' },
  ];
  const done = steps.filter((s) => s.done).length;
  return { steps, done, total: steps.length, complete: done === steps.length };
}

// Последние n дней (по возрастанию) для графиков: [{ key, activity }].
export function lastNDays(getByKey, now, n) {
  const out = [];
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - (n - 1));
  for (let i = 0; i < n; i++) {
    const key = dayKey(d.getTime());
    out.push({ key, activity: getByKey(`activity-${key}`) || {} });
    d.setDate(d.getDate() + 1);
  }
  return out;
}
