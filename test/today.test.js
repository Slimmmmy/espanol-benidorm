import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeToday } from '../js/today.js';

test('summarizeToday: собирает сводку', () => {
  const out = summarizeToday({
    stats: { streak: 3, due: 5 },
    course: { units: [{ status: 'done', title: 'A' }, { status: 'todo', title: 'B' }] },
    assignments: [{ status: 'open' }, { status: 'done' }, { status: 'open' }],
    daily: { words: [{ added: true }, { added: false }, { added: true }] },
  });
  assert.equal(out.streak, 3);
  assert.equal(out.due, 5);
  assert.equal(out.dailyAdded, 2);
  assert.equal(out.dailyTotal, 3);
  assert.equal(out.nextUnitTitle, 'B');
  assert.equal(out.hasCourse, true);
  assert.equal(out.openAssignments, 2);
});

test('summarizeToday: пустые данные → дефолты', () => {
  const out = summarizeToday({});
  assert.equal(out.streak, 0);
  assert.equal(out.due, 0);
  assert.equal(out.dailyAdded, 0);
  assert.equal(out.dailyTotal, 5);
  assert.equal(out.nextUnitTitle, '');
  assert.equal(out.hasCourse, false);
  assert.equal(out.openAssignments, 0);
});

test('summarizeToday: курс пройден → nextUnitTitle пустой, hasCourse true', () => {
  const out = summarizeToday({ course: { units: [{ status: 'done', title: 'A' }] } });
  assert.equal(out.hasCourse, true);
  assert.equal(out.nextUnitTitle, '');
});
