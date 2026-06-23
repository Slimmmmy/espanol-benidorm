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
