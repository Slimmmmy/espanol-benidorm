import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newItem, decide, needsChoice, mergeInbox } from '../js/capture.js';

test('newItem: сохраняет запись как есть, статус pending', () => {
  const it = newItem('  vэнга ', ' бар ', 100);
  assert.equal(it.raw, 'vэнга');
  assert.equal(it.context, 'бар');
  assert.equal(it.status, 'pending');
  assert.equal(it.createdAt, 100);
});

test('decide: уверенный ответ или один вариант — добавить сразу', () => {
  assert.equal(decide({ confident: true, candidates: [{ es: 'venga' }, { es: 'vengo' }] }).action, 'auto');
  assert.equal(decide({ confident: false, candidates: [{ es: 'venga' }] }).action, 'auto');
});

test('decide: несколько вариантов без уверенности — спросить; пусто — не поняли', () => {
  const d = decide({ confident: false, candidates: [{ es: 'a' }, { es: 'b' }, { es: 'c' }, { es: 'd' }, { ru: 'нет es' }] });
  assert.equal(d.action, 'choose');
  assert.equal(d.candidates.length, 3);
  assert.equal(decide({ candidates: [] }).action, 'empty');
  assert.equal(decide(null).action, 'empty');
});

test('needsChoice считает только ждущие выбора', () => {
  assert.equal(needsChoice([{ status: 'choose' }, { status: 'added' }, { status: 'choose' }]), 2);
});

test('mergeInbox: побеждает продвинутый статус', () => {
  const out = mergeInbox(
    [{ id: 'x', createdAt: 1, status: 'pending' }, { id: 'y', createdAt: 2, status: 'added' }],
    [{ id: 'x', createdAt: 1, status: 'added' }, { id: 'y', createdAt: 2, status: 'choose' }],
  );
  assert.deepEqual(out.map((i) => i.status), ['added', 'added']);
});
