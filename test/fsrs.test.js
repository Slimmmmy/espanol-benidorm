import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fsrsSchedule, isNewCard, withMemoryState, intervalLabel, retrievability } from '../js/fsrs.js';
import { newCard, DAY } from '../js/srs.js';
import { buildQueue, forecastDue } from '../js/queue.js';

const NOW = Date.UTC(2026, 9, 4, 10);

test('fsrs: новая карточка — новая', () => {
  assert.equal(isNewCard(newCard(NOW)), true);
});

test('fsrs: первая оценка — интервалы растут again < hard < good < easy', () => {
  const c = newCard(NOW);
  const again = fsrsSchedule(c, 'again', NOW);
  const hard = fsrsSchedule(c, 'hard', NOW);
  const good = fsrsSchedule(c, 'good', NOW);
  const easy = fsrsSchedule(c, 'easy', NOW);
  assert.equal(again.due, NOW + 10 * 60 * 1000);
  assert.equal(again.interval, 0);
  assert.ok(hard.interval >= 1);
  assert.ok(good.interval > hard.interval);
  assert.ok(easy.interval > good.interval);
  assert.equal(good.reps, 1);
  assert.equal(good.firstReviewedAt, NOW);
  assert.equal(isNewCard(again), false, 'после «Не помню» карточка уже не новая');
});

test('fsrs: повтор в срок с «Помню» увеличивает интервал', () => {
  let c = fsrsSchedule(newCard(NOW), 'good', NOW);
  const t2 = c.due;
  const c2 = fsrsSchedule(c, 'good', t2);
  assert.ok(c2.interval > c.interval);
  assert.ok(c2.s > c.s);
});

test('fsrs: «Не помню» после долгого интервала снижает стабильность и считает провал', () => {
  let c = fsrsSchedule(newCard(NOW), 'good', NOW);
  c = fsrsSchedule(c, 'good', c.due);
  const lapsed = fsrsSchedule(c, 'again', c.due);
  assert.ok(lapsed.s < c.s);
  assert.equal(lapsed.lapses, 1);
  assert.equal(lapsed.reps, 0);
  assert.ok(lapsed.d > c.d, 'сложность растёт после провала');
});

test('fsrs: интервал ограничен maxInterval', () => {
  let c = newCard(NOW);
  let t = NOW;
  for (let i = 0; i < 12; i++) { c = fsrsSchedule(c, 'easy', t, { maxInterval: 365 }); t = c.due; }
  assert.ok(c.interval <= 365);
});

test('fsrs: старая карточка SM-2 конвертируется без потери интервала', () => {
  const legacy = { es: 'perro', reps: 3, interval: 8, ease: 2.5, lapses: 0, due: NOW };
  const m = withMemoryState(legacy);
  assert.equal(m.s, 8);
  assert.equal(m.d, 5);
  assert.equal(m.lastReview, NOW - 8 * DAY);
  const next = fsrsSchedule(legacy, 'good', NOW);
  assert.ok(next.interval > 8);
});

test('fsrs: retrievability = 0.9 когда прошло S дней', () => {
  assert.ok(Math.abs(retrievability(10, 10) - 0.9) < 1e-9);
});

test('intervalLabel: минуты, дни, месяцы', () => {
  assert.equal(intervalLabel({ due: NOW + 10 * 60000 }, NOW), '10 мин');
  assert.equal(intervalLabel({ due: NOW + 3 * DAY }, NOW), '3 дн');
  assert.equal(intervalLabel({ due: NOW + 60 * DAY }, NOW), '2 мес');
});

function reviewed(id, dueOffsetDays, lastReview = NOW - 5 * DAY) {
  return { id, es: 'w' + id, reps: 2, s: 5, d: 5, lastReview, firstReviewedAt: NOW - 20 * DAY, due: NOW + dueOffsetDays * DAY, createdAt: id };
}

test('buildQueue: лимит новых карточек в день', () => {
  const words = Array.from({ length: 15 }, (_, i) => ({ id: i, es: 'n' + i, ...newCard(NOW - 1000), createdAt: i }));
  const r = buildQueue(words, NOW, { maxNew: 10, maxReviews: 50 });
  assert.equal(r.counts.fresh, 10);
  assert.equal(r.held, 5);
  assert.equal(r.queue[0].id, 0, 'сначала самые старые');
});

test('buildQueue: уже изученные сегодня новые уменьшают лимит', () => {
  const words = [
    ...Array.from({ length: 4 }, (_, i) => ({ id: 100 + i, es: 'x' + i, reps: 1, s: 3, d: 5, lastReview: NOW - 1000, firstReviewedAt: NOW - 1000, due: NOW + 3 * DAY })),
    ...Array.from({ length: 10 }, (_, i) => ({ id: i, es: 'n' + i, ...newCard(NOW - 1000), createdAt: i })),
  ];
  const r = buildQueue(words, NOW, { maxNew: 10, maxReviews: 50 });
  assert.equal(r.counts.fresh, 6);
});

test('buildQueue: повторения по лимиту, самые просроченные первыми; «доучивание» без лимита', () => {
  const words = [reviewed(1, -1), reviewed(2, -3), reviewed(3, -2), reviewed(4, 2),
    { ...reviewed(5, 0), due: NOW - 60000, lastReview: NOW - 11 * 60000, reps: 0 }];
  // Карточка 5 уже повторялась сегодня — она занимает один слот лимита и показывается вне лимита.
  const r = buildQueue(words, NOW, { maxNew: 10, maxReviews: 3 });
  assert.deepEqual(r.queue.map((w) => w.id), [2, 3, 5]);
  assert.equal(r.counts.learning, 1);
  assert.equal(r.held, 1);
});

test('forecastDue: просроченные попадают в сегодня, новые не считаются', () => {
  const words = [reviewed(1, -2), reviewed(2, 0), reviewed(3, 1), reviewed(4, 6), reviewed(5, 9), { id: 6, ...newCard(NOW) }];
  const f = forecastDue(words, NOW, 7);
  assert.equal(f.length, 7);
  assert.equal(f[0], 2);
  assert.equal(f[1], 1);
  assert.equal(f[6], 1);
  assert.equal(f.reduce((a, b) => a + b, 0), 4);
});
