import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, STEPS, stepById, nextStep, recordResult, mergeTextbook, lessonBrief, startFor, LESSON_COUNT, unitStats } from '../js/textbook.js';
import { MISTAKE_TOPICS } from '../js/curriculum.js';
import { TEXTBOOK_EXERCISES, TEXTBOOK_THEORY } from '../js/schemas.js';
import { normalizeLesson } from '../js/claude.js';
import { mistakesFromLesson } from '../js/mistakes.js';

test('учебник: id уникальны, уроки пронумерованы по порядку, темы — из единого перечня', () => {
  const ids = STEPS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  const lessons = STEPS.filter((s) => s.kind === 'lesson');
  assert.equal(lessons.length, LESSON_COUNT);
  lessons.forEach((l, i) => assert.equal(l.id, `l${i + 1}`));
  for (const s of STEPS) {
    assert.ok(MISTAKE_TOPICS.includes(s.topic), `${s.id}: ${s.topic}`);
    assert.ok(s.points.length >= 3, s.id);
    assert.ok(s.goal && s.title && s.es, s.id);
  }
  assert.equal(STEPS.filter((s) => s.kind === 'repaso').length, UNITS.length);
});

test('учебник: уровни идут A1 → B2, повторение в конце каждого блока', () => {
  const order = ['A1', 'A2', 'B1', 'B2'];
  for (let i = 1; i < UNITS.length; i++) assert.ok(order.indexOf(UNITS[i].level) >= order.indexOf(UNITS[i - 1].level));
  for (const u of UNITS) {
    const st = STEPS.filter((s) => s.unit === u.n);
    assert.equal(st[st.length - 1].kind, 'repaso');
    assert.deepEqual(st[st.length - 1].lessonIds, u.lessons.map((l) => l.id));
  }
});

test('nextStep: старт по уровню, потом пропущенные', () => {
  assert.equal(nextStep({ done: {} }, 'A0-A1').id, 'l1');
  assert.equal(nextStep({ done: {} }, 'A2-B1').id, startFor('A2-B1'));
  assert.equal(stepById(startFor('A2-B1')).level, 'A2');
  assert.equal(stepById(startFor('B2+')).level, 'B1');
  // всё после старта пройдено → возвращаемся к первому непройденному
  const done = {};
  const from = STEPS.findIndex((s) => s.id === 'l14');
  STEPS.slice(from).forEach((s) => { done[s.id] = { passed: true }; });
  assert.equal(nextStep({ done }, 'A2-B1').id, 'l1');
  STEPS.forEach((s) => { done[s.id] = { passed: true }; });
  assert.equal(nextStep({ done }, 'A2-B1'), null);
  // явный старт с урока 1
  assert.equal(nextStep({ start: 'l1', done: {} }, 'B2+').id, 'l1');
});

test('recordResult: 70% — пройдено, лучший результат и «пройдено» не теряются', () => {
  let p = recordResult(null, 'l1', 5, 8, 100);
  assert.equal(p.done.l1.passed, false);
  assert.equal(p.done.l1.score, '5/8');
  p = recordResult(p, 'l1', 6, 8, 200);
  assert.equal(p.done.l1.passed, true);
  assert.equal(p.done.l1.tries, 2);
  p = recordResult(p, 'l1', 2, 8, 300);
  assert.equal(p.done.l1.passed, true);
  assert.equal(p.done.l1.score, '6/8');
  assert.equal(nextStep(p, 'A0-A1').id, 'l2');
  assert.deepEqual(unitStats(p, UNITS[0]), { passed: 1, total: 5 });
});

test('mergeTextbook: объединяет уроки с двух устройств', () => {
  const a = { start: 'l14', done: { l1: { pct: 0.5, passed: false, tries: 1, date: 1 }, l2: { pct: 1, passed: true, date: 5 } }, updatedAt: 10 };
  const b = { start: 'l1', done: { l1: { pct: 0.75, passed: true, tries: 2, date: 3 }, l3: { pct: 0.9, passed: true } }, updatedAt: 5 };
  const m = mergeTextbook(a, b);
  assert.equal(m.start, 'l14');
  assert.equal(m.done.l1.passed, true);
  assert.equal(m.done.l1.pct, 0.75);
  assert.equal(m.done.l1.tries, 2);
  assert.ok(m.done.l2.passed && m.done.l3.passed);
  assert.equal(mergeTextbook(null, b), b);
});

test('lessonBrief: передаёт ИИ все опорные пункты', () => {
  const s = stepById('l9');
  const brief = lessonBrief(s);
  s.points.forEach((p) => assert.ok(brief.includes(p)));
  assert.ok(lessonBrief(stepById('r3')).includes('ser и estar'));
});

test('схемы учебника: тема упражнения — из перечня, все поля обязательны', () => {
  const ex = TEXTBOOK_EXERCISES.properties.exercises.items;
  assert.deepEqual(ex.properties.topic.enum, MISTAKE_TOPICS);
  assert.deepEqual(ex.required.sort(), Object.keys(ex.properties).sort());
  assert.ok(TEXTBOOK_THEORY.required.includes('traps'));
});

test('упражнения учебника: why/stage/topic сохраняются, ошибка пишется по теме упражнения', () => {
  const l = normalizeLesson({ topic: 'ser и estar', exercises: [
    { stage: 'узнать', type: 'choice', prompt: 'La tienda ___ cerrada.', options: ['es', 'está'], answer: 1, expected: '', why: 'состояние', topic: 'ser и estar' },
    { stage: 'применить', type: 'open', prompt: 'Переведи: аптека рядом с банком', options: [], answer: 0, expected: 'La farmacia está al lado del banco.', why: '', topic: 'hay и está / están' },
  ] });
  assert.equal(l.exercises[0].why, 'состояние');
  assert.equal(l.exercises[0].stage, 'узнать');
  const m = mistakesFromLesson(l, ['es', 'Hay la farmacia'], [{ correct: false }, { correct: false }], 1);
  assert.equal(m[0].topic, 'ser и estar');
  assert.equal(m[0].phrase, 'La tienda es cerrada.');
  assert.equal(m[1].topic, 'hay и está / están');
});
