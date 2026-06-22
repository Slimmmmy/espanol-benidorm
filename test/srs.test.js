import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCard, schedule, dueCards, DAY } from '../js/srs.js';

const NOW = 1_000_000_000_000;

test('newCard: стартовые значения', () => {
  const c = newCard(NOW);
  assert.deepEqual(c, { due: NOW, interval: 0, ease: 2.5, reps: 0, lapses: 0 });
});

test('schedule good: первый раз → интервал 1 день', () => {
  const c = schedule(newCard(NOW), 'good', NOW);
  assert.equal(c.reps, 1);
  assert.equal(c.interval, 1);
  assert.equal(c.due, NOW + DAY);
});

test('schedule good: второй раз → 3 дня', () => {
  let c = schedule(newCard(NOW), 'good', NOW);
  c = schedule(c, 'good', NOW);
  assert.equal(c.reps, 2);
  assert.equal(c.interval, 3);
});

test('schedule good: третий раз → round(3 * ease)', () => {
  let c = schedule(newCard(NOW), 'good', NOW);
  c = schedule(c, 'good', NOW);
  c = schedule(c, 'good', NOW);
  assert.equal(c.reps, 3);
  assert.equal(c.interval, Math.round(3 * 2.5)); // 8
});

test('schedule again: сброс reps, +lapse, ease вниз, due через 10 минут', () => {
  const c = schedule(newCard(NOW), 'again', NOW);
  assert.equal(c.reps, 0);
  assert.equal(c.lapses, 1);
  assert.equal(c.ease, 2.3);
  assert.equal(c.due, NOW + 10 * 60 * 1000);
});

test('schedule again: ease не опускается ниже 1.3', () => {
  let c = newCard(NOW);
  for (let i = 0; i < 20; i++) c = schedule(c, 'again', NOW);
  assert.equal(c.ease, 1.3);
});

test('schedule не мутирует входную карточку', () => {
  const c = newCard(NOW);
  schedule(c, 'good', NOW);
  assert.equal(c.reps, 0);
});

test('dueCards: только просроченные', () => {
  const cards = [{ id: 1, due: NOW - 1 }, { id: 2, due: NOW + DAY }, { id: 3, due: NOW }];
  const due = dueCards(cards, NOW).map((c) => c.id);
  assert.deepEqual(due, [1, 3]);
});
