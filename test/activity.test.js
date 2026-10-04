import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyGoal, mergeActivity, lastNDays } from '../js/activity.js';
import { normalizeMistake, mistakesFromLesson } from '../js/mistakes.js';
import { computeStreakInfo } from '../js/stats.js';
import { mergeSettings } from '../js/merge.js';
import { buildReminderIcs } from '../js/reminders.js';
import { buildRequest, resolveModel } from '../js/claude.js';
import { recentMessages } from '../js/util.js';

test('dailyGoal: пустой день — 0 из 3', () => {
  const g = dailyGoal({ queueLeft: 12, activity: {}, dailyAdded: 0, dailyTotal: 5 });
  assert.equal(g.done, 0);
  assert.equal(g.complete, false);
});

test('dailyGoal: всё сделано', () => {
  const g = dailyGoal({ queueLeft: 0, activity: { roleplay: 1 }, dailyAdded: 5, dailyTotal: 5 });
  assert.equal(g.done, 3);
  assert.equal(g.complete, true);
});

test('dailyGoal: 20 повторений засчитывают шаг даже при остатке; чат — от 3 сообщений', () => {
  assert.equal(dailyGoal({ queueLeft: 40, activity: { review: 20 } }).steps[0].done, true);
  assert.equal(dailyGoal({ activity: { chat: 2 } }).steps[2].done, false);
  assert.equal(dailyGoal({ activity: { chat: 3 } }).steps[2].done, true);
});

test('mergeActivity: максимум по каждому счётчику', () => {
  assert.deepEqual(mergeActivity({ review: 5, chat: 1 }, { review: 3, lesson: 1 }), { review: 5, chat: 1, lesson: 1 });
});

test('lastNDays: n дней по возрастанию до сегодня', () => {
  const now = new Date(2026, 9, 4, 15).getTime();
  const days = lastNDays((k) => (k === 'activity-2026-10-04' ? { review: 7 } : undefined), now, 3);
  assert.deepEqual(days.map((d) => d.key), ['2026-10-02', '2026-10-03', '2026-10-04']);
  assert.equal(days[2].activity.review, 7);
  assert.deepEqual(days[0].activity, {});
});

test('normalizeMistake: wrong/right из чата и пустые записи', () => {
  const m = normalizeMistake({ wrong: 'yo soy cansado', right: 'estoy cansado', topic: 'ser/estar' }, 'chat', 5);
  assert.deepEqual(m, { phrase: 'yo soy cansado', corrected: 'estoy cansado', topic: 'ser/estar', source: 'chat', createdAt: 5 });
  assert.equal(normalizeMistake({ wrong: ' ', topic: '' }, 'chat'), null);
});

test('mistakesFromLesson: только неверные упражнения', () => {
  const lesson = { topic: 'Pretérito', exercises: [
    { type: 'choice', options: ['fui', 'iba'], answer: 0 },
    { type: 'open', expected: 'Ayer comí paella' },
  ] };
  const out = mistakesFromLesson(lesson, ['iba', ''], [{ correct: false }, { correct: true }], 100);
  assert.equal(out.length, 1);
  assert.equal(out[0].corrected, 'fui');
  assert.equal(out[0].topic, 'Pretérito');
  assert.equal(out[0].source, 'lesson');
});

test('computeStreakInfo: 7 дней дают заморозку, она спасает один пропуск', () => {
  const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-09'];
  const info = computeStreakInfo(days, '2026-10-09');
  assert.equal(info.streak, 8);
  assert.equal(info.freezes, 0);
});

test('computeStreakInfo: без заморозки пропуск обрывает серию', () => {
  const info = computeStreakInfo(['2026-10-01', '2026-10-02', '2026-10-04'], '2026-10-04');
  assert.equal(info.streak, 1);
});

test('computeStreakInfo: вчерашний пропуск при наличии заморозки — серия жива', () => {
  const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'];
  const info = computeStreakInfo(days, '2026-10-09');
  assert.equal(info.streak, 7);
  assert.equal(info.atRisk, true);
});

test('mergeSettings: activity и roleplayHistory объединяются', () => {
  const out = mergeSettings(
    { 'activity-2026-10-04': { review: 3 }, roleplayHistory: [{ scene: 'bar', date: 1, score: 7 }] },
    { 'activity-2026-10-04': { review: 9, chat: 2 }, roleplayHistory: [{ scene: 'bar', date: 1, score: 7 }, { scene: 'tram', date: 2, score: 5 }] },
  );
  assert.deepEqual(out['activity-2026-10-04'], { review: 9, chat: 2 });
  assert.equal(out.roleplayHistory.length, 2);
});

test('buildReminderIcs: ежедневное событие с напоминанием', () => {
  const ics = buildReminderIcs({ time: '20:30', url: 'https://x.github.io/app/', now: new Date(2026, 9, 4, 9).getTime() });
  assert.ok(ics.includes('DTSTART:20261004T203000\r\n'));
  assert.ok(ics.includes('DTEND:20261004T204000\r\n'));
  assert.ok(ics.includes('RRULE:FREQ=DAILY'));
  assert.ok(ics.includes('BEGIN:VALARM'));
  assert.ok(ics.includes('URL:https://x.github.io/app/'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
});

test('buildRequest: Sonnet 5.5 без размышлений, с кэшем и запасной моделью; Haiku — без лишних полей', () => {
  const s = buildRequest({ model: 'claude-sonnet-5-5', system: 'S', messages: [], maxTokens: 500, cache: true });
  assert.deepEqual(s.body.thinking, { type: 'between_tools' });
  assert.deepEqual(s.body.output_config, { effort: 'low' });
  assert.equal(s.body.fallbacks, 'default');
  assert.deepEqual(s.body.cache_control, { type: 'ephemeral' });
  assert.equal(s.headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  const h = buildRequest({ model: 'claude-haiku-4-5', system: 'S', messages: [], maxTokens: 500 });
  assert.deepEqual(Object.keys(h.body).sort(), ['max_tokens', 'messages', 'model', 'system']);
  assert.equal(h.headers['anthropic-beta'], undefined);
  const m = buildRequest({ model: 'claude-sonnet-5-5', system: 'S', messages: [], maxTokens: 500, minimal: true });
  assert.equal(m.body.thinking, undefined);
});

test('resolveModel: устаревший id заменяется', () => {
  assert.equal(resolveModel('claude-sonnet-4-6', 'x'), 'claude-sonnet-5-5');
  assert.equal(resolveModel(undefined, 'claude-haiku-4-5'), 'claude-haiku-4-5');
});

test('recentMessages со ступенькой: начало окна стабильно 10 сообщений подряд', () => {
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'm' + i }));
  const firsts = [];
  for (let n = 41; n <= 50; n++) firsts.push(recentMessages(mk(n), 30, 10)[0].content);
  assert.equal(new Set(firsts).size, 1);
  assert.ok(recentMessages(mk(50), 30, 10).length <= 30);
});
