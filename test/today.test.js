import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeToday } from '../js/today.js';

test('summarizeToday: собирает сводку', () => {
  const out = summarizeToday({
    stats: { streak: 3, due: 5 },
    nextLesson: 'Урок 2: B',
    assignments: [{ status: 'open' }, { status: 'done' }, { status: 'open' }],
    daily: { words: [{ added: true }, { added: false }, { added: true }] },
  });
  assert.equal(out.streak, 3);
  assert.equal(out.due, 5);
  assert.equal(out.dailyAdded, 2);
  assert.equal(out.dailyTotal, 3);
  assert.equal(out.nextUnitTitle, 'Урок 2: B');
  assert.equal(out.openAssignments, 2);
});

test('summarizeToday: пустые данные → дефолты', () => {
  const out = summarizeToday({});
  assert.equal(out.streak, 0);
  assert.equal(out.due, 0);
  assert.equal(out.dailyAdded, 0);
  assert.equal(out.dailyTotal, 5);
  assert.equal(out.nextUnitTitle, '');
  assert.equal(out.openAssignments, 0);
});

test('summarizeToday: учебник пройден → nextUnitTitle пустой', () => {
  assert.equal(summarizeToday({ nextLesson: '' }).nextUnitTitle, '');
});
