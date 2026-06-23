import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickNextTopic, nextUnit } from '../js/profile.js';

test('pickNextTopic: пусто → общая практика', () => {
  assert.equal(pickNextTopic([], ''), 'Общая практика грамматики');
});

test('pickNextTopic: самая частая слабая тема', () => {
  const weak = [{ topic: 'согласование рода', count: 3 }, { topic: 'спряжение', count: 1 }];
  assert.equal(pickNextTopic(weak, ''), 'согласование рода');
});

test('pickNextTopic: пропускает только что пройденную тему', () => {
  const weak = [{ topic: 'согласование рода', count: 3 }, { topic: 'спряжение', count: 1 }];
  assert.equal(pickNextTopic(weak, 'согласование рода'), 'спряжение');
});

test('pickNextTopic: единственная тема = последняя → всё равно возвращается', () => {
  const weak = [{ topic: 'спряжение', count: 2 }];
  assert.equal(pickNextTopic(weak, 'спряжение'), 'спряжение');
});

test('nextUnit: первый невыполненный юнит', () => {
  const units = [{ id: 'a', status: 'done' }, { id: 'b', status: 'todo' }, { id: 'c', status: 'todo' }];
  assert.equal(nextUnit(units).id, 'b');
});

test('nextUnit: все выполнены → null', () => {
  assert.equal(nextUnit([{ id: 'a', status: 'done' }]), null);
});

test('nextUnit: пусто/undefined → null', () => {
  assert.equal(nextUnit([]), null);
  assert.equal(nextUnit(undefined), null);
});

import { partitionAssignments } from '../js/profile.js';

test('partitionAssignments: делит на open/done', () => {
  const list = [{ id: 1, status: 'open' }, { id: 2, status: 'done' }, { id: 3, status: 'open' }];
  const { open, done } = partitionAssignments(list);
  assert.deepEqual(open.map((a) => a.id), [1, 3]);
  assert.deepEqual(done.map((a) => a.id), [2]);
});

test('partitionAssignments: пусто/undefined → пустые массивы', () => {
  assert.deepEqual(partitionAssignments([]), { open: [], done: [] });
  assert.deepEqual(partitionAssignments(undefined), { open: [], done: [] });
});
