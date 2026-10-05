import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../js/schemas.js';
import { buildRequest, normalizeLesson, applyLessonCheck } from '../js/claude.js';

// Требования structured outputs: у каждого объекта все поля обязательны и нет лишних.
function checkStrict(schema, path) {
  if (schema.type === 'object') {
    assert.equal(schema.additionalProperties, false, `${path}: additionalProperties`);
    assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort(), `${path}: required`);
    for (const [k, v] of Object.entries(schema.properties)) checkStrict(v, `${path}.${k}`);
  }
  if (schema.type === 'array') checkStrict(schema.items, `${path}[]`);
  for (const bad of ['minLength', 'maxLength', 'minimum', 'maximum', 'minItems', 'maxItems']) {
    assert.ok(!(bad in schema), `${path}: ${bad} не поддерживается`);
  }
}

test('все схемы строгие', () => {
  const names = Object.keys(S).filter((k) => k !== 'obj');
  assert.ok(names.length >= 16);
  for (const n of names) checkStrict(S[n], n);
});

test('buildRequest: схема попадает в output_config.format', () => {
  const haiku = buildRequest({ model: 'claude-haiku-4-5', system: 's', messages: [], maxTokens: 10, schema: S.GRAMMAR });
  assert.deepEqual(haiku.body.output_config, { format: { type: 'json_schema', schema: S.GRAMMAR } });
  const sonnet = buildRequest({ model: 'claude-sonnet-5-5', system: 's', messages: [], maxTokens: 10, schema: S.GRAMMAR });
  assert.equal(sonnet.body.output_config.effort, 'low');
  assert.equal(sonnet.body.output_config.format.type, 'json_schema');
  const minimal = buildRequest({ model: 'claude-sonnet-5-5', system: 's', messages: [], maxTokens: 10, schema: S.GRAMMAR, minimal: true });
  assert.equal(minimal.body.output_config, undefined);
});

test('normalizeLesson: чистит поля по типу упражнения', () => {
  const l = normalizeLesson({ topic: 't', exercises: [
    { type: 'choice', prompt: 'a', options: ['x', 'y'], answer: 5, expected: '' },
    { type: 'open', prompt: 'b', options: [], answer: 0, expected: 'hola' },
    { type: 'choice', prompt: '', options: ['x', 'y'], answer: 0, expected: '' },
  ] });
  assert.equal(l.exercises.length, 2);
  assert.deepEqual(l.exercises[0], { type: 'choice', prompt: 'a', options: ['x', 'y'], answer: 0 });
  assert.deepEqual(l.exercises[1], { type: 'open', prompt: 'b', expected: 'hola' });
});

test('applyLessonCheck: исправляет неверные ключи', () => {
  const lesson = { topic: 't', exercises: [
    { type: 'choice', prompt: 'a', options: ['soy', 'estoy', 'es'], answer: 0 },
    { type: 'open', prompt: 'b', expected: 'Yo es cansado' },
    { type: 'choice', prompt: 'c', options: ['x', 'y'], answer: 1 },
  ] };
  const out = applyLessonCheck(lesson, { exercises: [
    { ok: false, answer: 1, expected: '', note: '' },
    { ok: false, answer: 0, expected: 'Estoy cansado', note: '' },
    { ok: false, answer: 9, expected: '', note: '' },
  ] });
  assert.equal(out.exercises[0].answer, 1);
  assert.equal(out.exercises[1].expected, 'Estoy cansado');
  assert.equal(out.exercises[2].answer, 1);
});
