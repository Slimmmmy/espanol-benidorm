import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FREQ, freqCoverage, nextFrequent, freqRank } from '../js/freq.js';
import { MISTAKE_TOPICS, topicsForLevel, levelOfTopic } from '../js/curriculum.js';
import { TEST, scorePlacement } from '../js/placement.js';
import { phoneticTips, pairQuestion, PAIR_GROUPS, SHADOW } from '../js/phonetics.js';
import { normalizeStory, knownForStory } from '../js/stories.js';
import { tenseSkills } from '../js/profile.js';
import { mergeStories } from '../js/merge.js';
import * as S from '../js/schemas.js';

test('частотный словарь: 1000 уникальных слов без служебных', () => {
  assert.equal(FREQ.length, 1000);
  assert.equal(new Set(FREQ).size, 1000);
  for (const w of ['de', 'que', 'el', 'la', 'en', 'y']) assert.ok(!FREQ.includes(w), w);
  assert.equal(freqRank('ser'), 0);
  assert.ok(freqRank('la casa') >= 0);
  assert.equal(freqRank('xilófono'), -1);
});

test('покрытие: слова и глаголы из тренажёра, без дублей', () => {
  const cov = freqCoverage([
    { es: 'la casa', reps: 5 }, { es: 'Casa', reps: 0 }, { es: 'xilófono' },
    { kind: 'verb', es: 'tener · presente', verb: 'tener', reps: 1 }, { kind: 'fix', es: 'Estoy en casa' },
  ]);
  assert.equal(cov.inDict, 2);
  assert.equal(cov.learned, 1);
  assert.equal(cov.bands.reduce((a, b) => a + b.total, 0), 1000);
  assert.deepEqual(nextFrequent([{ es: 'ser' }, { es: 'estar' }], 2), ['tener', 'hacer']);
});

test('темы: единый перечень и уровни', () => {
  assert.equal(new Set(MISTAKE_TOPICS).size, MISTAKE_TOPICS.length);
  assert.ok(MISTAKE_TOPICS.length >= 35);
  assert.deepEqual(topicsForLevel('A0-A1').map((l) => l.level), ['A1', 'A2']);
  assert.deepEqual(topicsForLevel('B2+').map((l) => l.level), ['B1', 'B2']);
  assert.equal(levelOfTopic('ser и estar'), 'A1');
  assert.deepEqual(S.GRAMMAR.properties.topic.enum.slice(-1), ['']);
  assert.ok(S.MEMORY_EXTRACT.properties.mistakes.items.properties.topic.enum.includes('por и para'));
});

test('тест уровня: 24 вопроса, верные индексы, подсчёт', () => {
  assert.equal(TEST.length, 24);
  for (const q of TEST) { assert.ok(q.s.includes('___')); assert.ok(q.a >= 0 && q.a < q.o.length); }
  const all = TEST.map((q) => q.a);
  assert.deepEqual(scorePlacement(all), { by: { A1: 6, A2: 6, B1: 6, B2: 6 }, cefr: 'B2', level: 'B2+' });
  const a2 = TEST.map((q) => (q.level === 'A1' || q.level === 'A2' ? q.a : -1));
  assert.equal(scorePlacement(a2).cefr, 'A2');
  assert.equal(scorePlacement(a2).level, 'A2-B1');
  assert.equal(scorePlacement([]).cefr, 'A0');
  // пробел: B1 пройден, но A2 провален → уровень A1
  const gap = TEST.map((q) => (q.level === 'A2' ? -1 : q.a));
  assert.equal(scorePlacement(gap).cefr, 'A1');
});

test('фонетика: подсказки под русскоязычного', () => {
  const tips = phoneticTips('El perro de mi vecino');
  assert.ok(tips.some((t) => t.startsWith('rr')));
  assert.ok(tips.length <= 3);
  assert.ok(phoneticTips('cerca de la plaza').some((t) => t.includes('межзубный')));
  assert.ok(phoneticTips('pero').some((t) => t.startsWith('Одиночное r')));
  assert.deepEqual(phoneticTips(''), []);
  const q = pairQuestion(PAIR_GROUPS[0], () => 0.99);
  assert.equal(q.word, q.pair[q.answer]);
  for (const g of PAIR_GROUPS) for (const [a, b] of g.pairs) { assert.ok(g.ru[a], a); assert.ok(g.ru[b], b); }
  assert.ok(SHADOW.length >= 15);
});

test('истории: нормализация и знакомые слова', () => {
  const s = normalizeStory({ title: 'Hola', paragraphs: ['Uno.', 'Dos.'], translation: ['Раз.'], options: ['a', 'b'], answer: 5 });
  assert.deepEqual(s.translation, ['Раз.', '']);
  assert.equal(s.answer, 0);
  assert.deepEqual(knownForStory([{ es: 'la casa', reps: 1 }, { es: 'perro', reps: 9 }]), ['perro', 'casa']);
  const merged = mergeStories([{ id: 'a', answered: null, date: 1 }], [{ id: 'a', answered: 2, date: 1 }, { id: 'b', date: 2 }]);
  assert.deepEqual(merged.map((x) => [x.id, x.answered]), [['a', 2], ['b', undefined]]);
});

test('модель ученика: уверенность во временах', () => {
  const words = [
    { kind: 'verb', tense: 'presente', reps: 4, lapses: 0 },
    { kind: 'verb', tense: 'presente', reps: 1 },
    { kind: 'verb', tense: 'indefinido', reps: 5, lapses: 4 },
  ];
  assert.deepEqual(tenseSkills(words), ['Presente: 1 из 2 глаголов уверенно', 'Pretérito indefinido: 0 из 1 глаголов уверенно']);
});
