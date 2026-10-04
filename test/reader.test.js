import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaleToFit, normalizeReading, wordsLabel } from '../js/reader.js';
import { buildReaderMessages } from '../js/claude.js';
import { mergeReaderPages } from '../js/merge.js';

test('scaleToFit: уменьшает длинную сторону до 1600, маленькие не трогает', () => {
  assert.deepEqual(scaleToFit(3024, 4032), { w: 1200, h: 1600 });
  assert.deepEqual(scaleToFit(800, 600), { w: 800, h: 600 });
  assert.deepEqual(scaleToFit(0, 100), { w: 0, h: 0 });
});

test('normalizeReading: выравнивает переводы по абзацам и чистит пустое', () => {
  const r = normalizeReading({
    paragraphs: ['Era una noche oscura.', '', 'Llovía.'],
    translation: ['Была тёмная ночь.'],
    words: [{ es: 'oscuro', ru: 'тёмный' }, { ru: 'без слова' }],
    grammar: [{ fragment: 'Llovía', explanation: 'imperfecto' }, {}],
  });
  assert.deepEqual(r.paragraphs, ['Era una noche oscura.', 'Llovía.']);
  assert.deepEqual(r.translation, ['Была тёмная ночь.', '']);
  assert.equal(r.words.length, 1);
  assert.equal(r.grammar.length, 1);
  assert.equal(r.title, 'Страница');
});

test('normalizeReading: пустой ответ не ломает', () => {
  const r = normalizeReading(null);
  assert.deepEqual(r.paragraphs, []);
  assert.deepEqual(r.words, []);
});

test('buildReaderMessages: картинка перед текстом, известные слова и книга в подсказке', () => {
  const m = buildReaderMessages('AAAA', ['perro', 'gato'], 'Marina');
  assert.equal(m[0].role, 'user');
  assert.deepEqual(m[0].content[0], { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } });
  assert.match(m[0].content[1].text, /Книга: Marina/);
  assert.match(m[0].content[1].text, /perro, gato/);
});

test('mergeReaderPages: объединяет по id, берёт версию с вопросами', () => {
  const out = mergeReaderPages(
    [{ id: 'a', date: 1, qa: [] }],
    [{ id: 'a', date: 1, qa: [{ role: 'user', content: '?' }] }, { id: 'b', date: 2, qa: [] }],
  );
  assert.equal(out.length, 2);
  assert.equal(out[0].qa.length, 1);
});

test('wordsLabel: склонение', () => {
  assert.equal(wordsLabel(1), '1 слово');
  assert.equal(wordsLabel(2), '2 слова');
  assert.equal(wordsLabel(5), '5 слов');
  assert.equal(wordsLabel(11), '11 слов');
  assert.equal(wordsLabel(22), '22 слова');
});
