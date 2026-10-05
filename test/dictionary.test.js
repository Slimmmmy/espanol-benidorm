import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterWords, wordSource, isHard, fold } from '../js/dictionary.js';

const W = [
  { id: 1, es: 'café', ru: 'кофе', createdAt: 1, source: 'street' },
  { id: 2, es: 'el perro', ru: 'собака', createdAt: 2, local: 'Из книги: Marina', reps: 3, s: 2, lapses: 5 },
  { id: 3, es: 'mañana', ru: 'завтра; утро', createdAt: 3, reps: 1, s: 1 },
];

test('fold: без ударений, кириллица остаётся', () => {
  assert.equal(fold('Mañana Café'), 'manana cafe');
  assert.equal(fold('Ёлка'), 'елка');
});

test('filterWords: поиск по es и ru без ударений', () => {
  assert.deepEqual(filterWords(W, { q: 'cafe' }).map((w) => w.id), [1]);
  assert.deepEqual(filterWords(W, { q: 'утро' }).map((w) => w.id), [3]);
  assert.deepEqual(filterWords(W, { q: 'MANANA' }).map((w) => w.id), [3]);
});

test('filterWords: трудные первыми, фильтры', () => {
  assert.equal(filterWords(W)[0].id, 2);
  assert.deepEqual(filterWords(W, { filter: 'hard' }).map((w) => w.id), [2]);
  assert.deepEqual(filterWords(W, { filter: 'new' }).map((w) => w.id), [1]);
  assert.deepEqual(filterWords(W, { filter: 'book' }).map((w) => w.id), [2]);
  assert.deepEqual(filterWords(W, { filter: 'street' }).map((w) => w.id), [1]);
});

test('wordSource угадывает источник старых слов', () => {
  assert.equal(wordSource({ local: 'Услышал: в баре' }), 'street');
  assert.equal(wordSource({ source: 'scene' }), 'scene');
  assert.equal(wordSource({}), '');
  assert.equal(isHard({ lapses: 4 }), true);
});
