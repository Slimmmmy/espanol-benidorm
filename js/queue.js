// Очередь повторения на сегодня с дневными лимитами + прогноз нагрузки. Чистые функции.
import { isNewCard } from './fsrs.js';
import { dayKey } from './stats.js';
import { DAY } from './srs.js';

export const DEFAULT_LIMITS = { maxNew: 10, maxReviews: 50 };

const isToday = (ts, today) => !!ts && dayKey(ts) === today;

export function buildQueue(words, now, limits = {}) {
  const maxNew = limits.maxNew ?? DEFAULT_LIMITS.maxNew;
  const maxReviews = limits.maxReviews ?? DEFAULT_LIMITS.maxReviews;
  const today = dayKey(now);
  const list = Array.isArray(words) ? words : [];

  const newDone = list.filter((w) => isToday(w.firstReviewedAt, today)).length;
  const reviewsDone = list.filter((w) => isToday(w.lastReview, today) && !isToday(w.firstReviewedAt, today)).length;

  const due = list.filter((w) => !isNewCard(w) && (w.due ?? 0) <= now);
  // «Доучивание»: карточки, которые сегодня уже показывались (например, после «Не помню»). Без лимита.
  const learning = due.filter((w) => isToday(w.lastReview, today)).sort((a, b) => a.due - b.due);
  const reviewsAll = due.filter((w) => !isToday(w.lastReview, today)).sort((a, b) => (a.due ?? 0) - (b.due ?? 0));
  const newAll = list.filter(isNewCard).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  const reviews = reviewsAll.slice(0, Math.max(0, maxReviews - reviewsDone));
  const fresh = newAll.slice(0, Math.max(0, maxNew - newDone));
  return {
    queue: [...reviews, ...fresh, ...learning],
    counts: { reviews: reviews.length, fresh: fresh.length, learning: learning.length },
    // Сколько карточек отложено из-за лимитов (можно «позаниматься ещё»).
    held: (reviewsAll.length - reviews.length) + (newAll.length - fresh.length),
  };
}

// Сколько карточек придёт на повтор в каждый из ближайших дней (день 0 включает просроченные).
export function forecastDue(words, now, days = 7) {
  const out = new Array(days).fill(0);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  for (const w of Array.isArray(words) ? words : []) {
    if (isNewCard(w)) continue;
    const idx = Math.max(0, Math.floor(((w.due ?? 0) - start.getTime()) / DAY));
    if (idx < days) out[idx]++;
  }
  return out;
}
