// Интервальное повторение (SM-2-lite). Чистые функции, без побочных эффектов.
export const DAY = 24 * 60 * 60 * 1000;
const MIN_EASE = 1.3;

export function newCard(now) {
  return { due: now, interval: 0, ease: 2.5, reps: 0, lapses: 0 };
}

export function schedule(card, grade, now) {
  const c = { ...card };
  if (grade === 'again') {
    c.reps = 0;
    c.lapses = card.lapses + 1;
    c.ease = Math.max(MIN_EASE, card.ease - 0.2);
    c.interval = 0;
    c.due = now + 10 * 60 * 1000;
    return c;
  }
  c.reps = card.reps + 1;
  if (grade === 'easy') c.ease = card.ease + 0.15;
  let interval;
  if (c.reps === 1) interval = grade === 'easy' ? 2 : 1;
  else if (c.reps === 2) interval = grade === 'easy' ? 4 : 3;
  // для 'easy' ease уже повышен выше — намеренно более крутой рост интервала
  else interval = Math.round(card.interval * c.ease * (grade === 'easy' ? 1.3 : 1));
  c.interval = interval;
  c.due = now + interval * DAY;
  return c;
}

export function dueCards(cards, now) {
  return cards.filter((c) => (c.due ?? 0) <= now);
}
