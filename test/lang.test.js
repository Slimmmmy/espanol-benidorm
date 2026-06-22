import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectLang } from '../js/lang.js';

test('кириллица → ru', () => {
  assert.equal(detectLang('привет'), 'ru');
  assert.equal(detectLang('дом большой'), 'ru');
});

test('латиница → es', () => {
  assert.equal(detectLang('hola'), 'es');
  assert.equal(detectLang('la casa'), 'es');
});

test('смешанное с кириллицей → ru', () => {
  assert.equal(detectLang('casa дом'), 'ru');
});

test('пустая строка → es', () => {
  assert.equal(detectLang(''), 'es');
  assert.equal(detectLang('   '), 'es');
});
