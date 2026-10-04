// Интервальное повторение FSRS-5 (Free Spaced Repetition Scheduler). Чистые функции.
// Модель памяти: стабильность S (через сколько дней вероятность вспомнить упадёт до 90%)
// и сложность D (1..10). Параметры — стандартные веса FSRS-5 по умолчанию.
import { DAY } from './srs.js';

const W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192,
  1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
const DECAY = -0.5;
const FACTOR = 19 / 81;
const RELEARN_MS = 10 * 60 * 1000;
export const GRADES = { again: 1, hard: 2, good: 3, easy: 4 };

const clampD = (d) => Math.min(10, Math.max(1, d));

export function retrievability(elapsedDays, s) {
  return Math.pow(1 + FACTOR * elapsedDays / s, DECAY);
}

function intervalFor(s, retention, maxInterval) {
  const days = (s / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
  return Math.min(maxInterval, Math.max(1, Math.round(days)));
}

function initDifficulty(g) {
  return clampD(W[4] - Math.exp(W[5] * (g - 1)) + 1);
}

function nextDifficulty(d, g) {
  const delta = -W[6] * (g - 3);
  const d1 = d + delta * (10 - d) / 9;
  return clampD(W[7] * initDifficulty(4) + (1 - W[7]) * d1);
}

function recallStability(s, d, r, g) {
  const hard = g === 2 ? W[15] : 1;
  const easy = g === 4 ? W[16] : 1;
  return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy);
}

function forgetStability(s, d, r) {
  const f = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
  return Math.min(f, s);
}

function shortTermStability(s, g) {
  return s * Math.exp(W[17] * (g - 3 + W[18]));
}

// Карточка ещё ни разу не повторялась (только добавлена в словарь).
export function isNewCard(card) {
  return !card.s && !(card.reps > 0) && !card.lastReview;
}

// Перевод карточек старого формата (SM-2: interval/ease) в состояние FSRS без потери прогресса.
export function withMemoryState(card) {
  if (card.s || isNewCard(card)) return card;
  const interval = card.interval > 0 ? card.interval : 1;
  const ease = card.ease || 2.5;
  const due = card.due || 0;
  return {
    ...card,
    s: interval,
    d: clampD(5 + (2.5 - ease) * 5),
    lastReview: card.lastReview || (card.interval > 0 ? due - card.interval * DAY : due - RELEARN_MS),
  };
}

export function fsrsSchedule(card, grade, now, opts = {}) {
  const retention = opts.retention || 0.9;
  const maxInterval = opts.maxInterval || 365;
  const g = GRADES[grade];
  if (!g) throw new Error(`Неизвестная оценка: ${grade}`);
  const c = withMemoryState(card);
  let s;
  let d;
  if (isNewCard(c)) {
    s = W[g - 1];
    d = initDifficulty(g);
  } else {
    const elapsed = Math.max(0, (now - c.lastReview) / DAY);
    if (elapsed < 1) {
      s = shortTermStability(c.s, g);
    } else {
      const r = retrievability(elapsed, c.s);
      s = g === 1 ? forgetStability(c.s, c.d, r) : recallStability(c.s, c.d, r, g);
    }
    d = nextDifficulty(c.d, g);
  }
  const out = {
    ...c,
    s: Math.max(0.1, s),
    d,
    lastReview: now,
    firstReviewedAt: c.firstReviewedAt || now,
    reps: g === 1 ? 0 : (c.reps || 0) + 1,
    lapses: (c.lapses || 0) + (g === 1 && !isNewCard(c) ? 1 : 0),
  };
  if (g === 1) {
    out.interval = 0;
    out.due = now + RELEARN_MS;
  } else {
    out.interval = intervalFor(out.s, retention, maxInterval);
    out.due = now + out.interval * DAY;
  }
  return out;
}

// Подпись интервала для кнопки оценки: «10 мин», «3 дн», «2 мес».
export function intervalLabel(card, now) {
  const ms = (card.due || now) - now;
  if (ms < DAY) return `${Math.max(1, Math.round(ms / 60000))} мин`;
  const days = Math.round(ms / DAY);
  if (days < 30) return `${days} дн`;
  if (days < 365) return `${Math.round(days / 30)} мес`;
  return `${(days / 365).toFixed(1)} г`;
}
