import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCloze, pickCardType, availableTypes, checkAnswer, diffWords, stripArticle } from '../js/exercises.js';
import { tokenizeEs, findExistingWord } from '../js/wordpick.js';

test('stripArticle убирает артикль', () => {
  assert.equal(stripArticle('La playa'), 'playa');
  assert.equal(stripArticle('el'), 'el');
});

test('makeCloze: точное совпадение слова', () => {
  const c = makeCloze('Voy a la playa por la mañana.', 'la playa');
  assert.equal(c.answer, 'playa');
  assert.equal(c.text, 'Voy a la ＿＿＿ por la mañana.');
});

test('makeCloze: форма глагола по общему началу', () => {
  const c = makeCloze('Compramos pan en Mercadona.', 'comprar');
  assert.equal(c.answer, 'Compramos');
  assert.ok(c.text.startsWith('＿＿＿ pan'));
});

test('makeCloze: фраза из нескольких слов', () => {
  const c = makeCloze('¿Me pones un café con leche, por favor?', 'café con leche');
  assert.equal(c.answer, 'café con leche');
  assert.equal(c.text, '¿Me pones un ＿＿＿, por favor?');
});

test('makeCloze: нет слова в примере → null', () => {
  assert.equal(makeCloze('Hace calor hoy.', 'perro'), null);
  assert.equal(makeCloze('', 'perro'), null);
});

test('pickCardType: новое слово и classic → ru-es', () => {
  assert.equal(pickCardType({ reps: 0 }, { tts: true }, 'mixed', () => 0.99), 'ru-es');
  assert.equal(pickCardType({ reps: 5 }, { tts: true }, 'classic', () => 0.99), 'ru-es');
});

test('pickCardType: учитывает возможности устройства', () => {
  const w = { reps: 3, es: 'perro', example: 'El perro ladra.' };
  assert.deepEqual(availableTypes(w, {}), ['ru-es', 'es-ru', 'type', 'cloze']);
  assert.deepEqual(availableTypes(w, { tts: true, asr: true }), ['ru-es', 'es-ru', 'type', 'listen', 'cloze', 'speak']);
  assert.equal(pickCardType(w, { tts: true, asr: true }, 'mixed', () => 0.999), 'speak');
  assert.equal(pickCardType(w, {}, 'mixed', () => 0.5), 'type');
});

test('checkAnswer: акценты и артикль не важны, опечатка — «почти»', () => {
  assert.equal(checkAnswer('la mañana', 'manana'), 'ok');
  assert.equal(checkAnswer('el perro', 'perro'), 'ok');
  assert.equal(checkAnswer('aparcamiento', 'aparcamento'), 'ok');
  assert.equal(checkAnswer('aparcamiento', 'aparcmento'), 'close');
  assert.equal(checkAnswer('aparcamiento', 'coche'), 'wrong');
  assert.equal(checkAnswer('perro', ''), 'wrong');
});

test('diffWords: отмечает расслышанные слова', () => {
  const r = diffWords('¿Me pones un café, por favor?', 'me pones cafe por favor');
  assert.deepEqual(r.tokens.map((t) => t.ok), [true, true, false, true, true, true]);
  assert.equal(r.correct, 5);
  assert.equal(r.total, 6);
});

test('diffWords: пустой ответ', () => {
  const r = diffWords('Hola amigo', '');
  assert.equal(r.correct, 0);
  assert.equal(r.total, 2);
});

test('tokenizeEs: выделяет испанские слова, русский текст не трогает', () => {
  const t = tokenizeEs('Скажи: ¡Qué guapa está la niña!');
  const words = t.filter((x) => x.word).map((x) => x.t);
  assert.deepEqual(words, ['Qué', 'guapa', 'está', 'la', 'niña']);
  assert.equal(t.map((x) => x.t).join(''), 'Скажи: ¡Qué guapa está la niña!');
});

test('findExistingWord: без учёта артикля и акцентов', () => {
  const words = [{ es: 'la playa' }, { es: 'café' }];
  assert.ok(findExistingWord(words, 'playa'));
  assert.ok(findExistingWord(words, 'el cafe'));
  assert.equal(findExistingWord(words, 'perro'), null);
});
