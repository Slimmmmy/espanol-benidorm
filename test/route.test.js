import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TABS, tabOf, backTarget } from '../js/app.js';
import { planSession, stepStatus, cardsWord, totalMinutes } from '../js/session.js';

test('5 вкладок, каждый экран принадлежит вкладке', () => {
  assert.equal(TABS.length, 5);
  for (const id of ['today', 'session', 'daily', 'study', 'practice', 'roleplay', 'reader', 'listening', 'speech', 'assignments', 'chat', 'teacher', 'grammar', 'dictionary']) {
    assert.ok(tabOf(id), id);
  }
  assert.equal(tabOf('settings'), null);
});

test('backTarget: вложенные экраны ведут к своей вкладке', () => {
  assert.equal(backTarget('today'), null);
  assert.equal(backTarget('practice'), null);
  assert.deepEqual(backTarget('roleplay'), { hash: '#practice', title: 'Практика' });
  assert.deepEqual(backTarget('daily'), { hash: '#today', title: 'Сегодня' });
  assert.equal(backTarget('chat'), null); // у Наставника — переключатель
  assert.equal(backTarget('settings').hash, '');
});

test('planSession: повторение, слова, практика, итог', () => {
  const steps = planSession({ queueLeft: 35, dailyAdded: 1, dailyTotal: 5, dayNum: 0 });
  assert.deepEqual(steps.map((s) => s.id), ['review', 'words', 'practice', 'summary']);
  assert.equal(steps[0].target, 20);
  assert.equal(steps[2].hash, '#roleplay');
  assert.ok(totalMinutes(steps) >= 10 && totalMinutes(steps) <= 20);
});

test('planSession: пропускает сделанное и чередует практику', () => {
  const steps = planSession({ queueLeft: 0, dailyAdded: 5, dailyTotal: 5, dayNum: 1 });
  assert.deepEqual(steps.map((s) => s.id), ['practice', 'summary']);
  assert.equal(steps[0].hash, '#listening');
  const withCourse = planSession({ dayNum: 3, nextUnit: 'ser y estar' });
  assert.equal(withCourse.find((s) => s.id === 'practice').hash, '#teacher');
});

test('stepStatus считает от начала занятия', () => {
  const [review, , practice] = planSession({ queueLeft: 8, dailyAdded: 0, dailyTotal: 5, dayNum: 0 });
  const base = { review: 10, roleplay: 1 };
  assert.deepEqual(stepStatus(review, base, { activity: { review: 14 }, queueLeft: 4 }), { done: false, progress: '4/8' });
  assert.equal(stepStatus(review, base, { activity: { review: 18 }, queueLeft: 0 }).done, true);
  assert.equal(stepStatus(practice, base, { activity: { roleplay: 1 } }).done, false);
  assert.equal(stepStatus(practice, base, { activity: { roleplay: 2 } }).done, true);
});

test('cardsWord', () => {
  assert.equal(cardsWord(1), 'карточка');
  assert.equal(cardsWord(3), 'карточки');
  assert.equal(cardsWord(12), 'карточек');
  assert.equal(cardsWord(20), 'карточек');
});
