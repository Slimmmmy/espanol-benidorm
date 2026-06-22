import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, extractJson, normalizeText, similarity } from '../js/util.js';

test('escapeHtml экранирует спецсимволы', () => {
  assert.equal(escapeHtml('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
  assert.equal(escapeHtml("a & b ' c"), 'a &amp; b &#39; c');
});

test('escapeHtml: null/undefined → пустая строка', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('extractJson: чистый JSON', () => {
  assert.deepEqual(extractJson('{"es":"perro","ru":"собака"}'), { es: 'perro', ru: 'собака' });
});

test('extractJson: в ограждении ```json', () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
});

test('extractJson: с текстом вокруг', () => {
  assert.deepEqual(extractJson('Вот ответ: {"a":1} спасибо'), { a: 1 });
});

test('extractJson: нет JSON → ошибка', () => {
  assert.throws(() => extractJson('нет данных'), /JSON/);
});

test('normalizeText: регистр, диакритика, пунктуация', () => {
  assert.equal(normalizeText('  ¡Hólá, Múndo!  '), 'hola mundo');
});

test('similarity: идентичные (с учётом регистра/акцентов) = 1', () => {
  assert.equal(similarity('Está bien', 'esta bien'), 1);
});

test('similarity: совсем разное → низкое', () => {
  assert.ok(similarity('hola', 'xyzqw') < 0.5);
});

test('similarity: обе пустые = 1, одна пустая = 0', () => {
  assert.equal(similarity('', ''), 1);
  assert.equal(similarity('hola', ''), 0);
});

test('similarity: близкое произношение → высокое', () => {
  assert.ok(similarity('el perro', 'el pero') > 0.8);
});
