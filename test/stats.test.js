import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStreak } from '../js/stats.js';

test('computeStreak: три дня подряд по сегодня = 3', () => {
  assert.equal(computeStreak(['2026-06-20', '2026-06-21', '2026-06-22'], '2026-06-22'), 3);
});

test('computeStreak: серия по вчера (сегодня ещё не занимался) считается', () => {
  assert.equal(computeStreak(['2026-06-20', '2026-06-21'], '2026-06-22'), 2);
});

test('computeStreak: пусто = 0', () => {
  assert.equal(computeStreak([], '2026-06-22'), 0);
});

test('computeStreak: разрыв обрывает серию', () => {
  assert.equal(computeStreak(['2026-06-22', '2026-06-20'], '2026-06-22'), 1);
});

test('computeStreak: ни сегодня, ни вчера = 0', () => {
  assert.equal(computeStreak(['2026-06-19'], '2026-06-22'), 0);
});
