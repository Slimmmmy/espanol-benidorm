import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeWords, mergeMistakes, mergeSettings, mergeSnapshots } from '../js/merge.js';

test('mergeWords: объединяет разные слова', () => {
  const a = [{ id: 1, es: 'perro', ru: 'собака', reps: 0 }];
  const b = [{ id: 1, es: 'gato', ru: 'кот', reps: 0 }];
  const out = mergeWords(a, b).map((w) => w.es).sort();
  assert.deepEqual(out, ['gato', 'perro']);
});

test('mergeWords: для дубля берёт более свежий (больше reps), без id', () => {
  const a = [{ id: 1, es: 'Perro', ru: 'собака', reps: 1, due: 10 }];
  const b = [{ id: 5, es: 'perro', ru: 'собака', reps: 3, due: 5 }];
  const out = mergeWords(a, b);
  assert.equal(out.length, 1);
  assert.equal(out[0].reps, 3);
  assert.equal('id' in out[0], false);
});

test('mergeMistakes: объединяет и дедуплицирует по phrase|createdAt', () => {
  const a = [{ id: 1, phrase: 'voy', createdAt: 100, topic: 'x' }];
  const b = [{ id: 2, phrase: 'voy', createdAt: 100, topic: 'x' }, { id: 3, phrase: 'soy', createdAt: 200, topic: 'y' }];
  assert.equal(mergeMistakes(a, b).length, 2);
});

test('mergeSettings: studyDays объединяются и сортируются', () => {
  const out = mergeSettings({ studyDays: ['2026-06-22', '2026-06-20'] }, { studyDays: ['2026-06-21'] });
  assert.deepEqual(out.studyDays, ['2026-06-20', '2026-06-21', '2026-06-22']);
});

test('mergeSettings: teacherProfile — позже обновлённый', () => {
  const a = { teacherProfile: { note: 'A', updatedAt: 100 } };
  const b = { teacherProfile: { note: 'B', updatedAt: 200 } };
  assert.equal(mergeSettings(a, b).teacherProfile.note, 'B');
});

test('mergeSnapshots: собирает все три части', () => {
  const local = { words: [{ es: 'a' }], mistakes: [], settings: { level: 'A2-B1' } };
  const remote = { words: [{ es: 'b' }], mistakes: [], settings: {} };
  const m = mergeSnapshots(local, remote);
  assert.equal(m.words.length, 2);
  assert.equal(m.settings.level, 'A2-B1');
});
