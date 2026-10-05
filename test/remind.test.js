import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localParts, shouldSend, summarize, buildMessage, parsePushConfig, toMinutes } from '../scripts/remind-core.mjs';
import { b64url, fromB64url, buildPushConfig } from '../js/notify.js';

// 5 октября 2026, 06:40 UTC = 08:40 в Мадриде (летнее время, UTC+2)
const NOW = Date.UTC(2026, 9, 5, 6, 40);
const cfg = { morning: '08:30', evening: '20:30', eveningOn: true, tz: 'Europe/Madrid' };

test('местное время в часовом поясе ученика', () => {
  assert.deepEqual(localParts(NOW, 'Europe/Madrid'), { date: '2026-10-05', minutes: 8 * 60 + 40 });
  assert.equal(toMinutes('20:30'), 1230);
  assert.equal(toMinutes('x'), null);
});

test('утро: шлём один раз в окне после выбранного времени', () => {
  assert.equal(shouldSend('morning', cfg, {}, NOW), true);
  assert.equal(shouldSend('morning', cfg, { last_morning: '2026-10-05' }, NOW), false);
  assert.equal(shouldSend('morning', { ...cfg, morning: '09:00' }, {}, NOW), false);
  assert.equal(shouldSend('morning', { ...cfg, morning: '05:00' }, {}, NOW), false); // окно 3 часа прошло
  assert.equal(shouldSend('evening', cfg, {}, NOW), false);
  assert.equal(shouldSend('evening', { ...cfg, evening: '08:00', eveningOn: false }, {}, NOW), false);
});

test('сводка: карточки, серия, занимался ли сегодня', () => {
  const snap = {
    words: [{ reps: 2, due: NOW - 1 }, { reps: 1, due: NOW + 1e9 }, { es: 'nuevo' }, { es: 'otro' }],
    settings: { studyDays: ['2026-10-02', '2026-10-03', '2026-10-04'], maxNew: 1 },
  };
  const s = summarize(snap, NOW, 'Europe/Madrid');
  assert.deepEqual([s.due, s.fresh, s.streak, s.studiedToday, s.dailyLeft], [1, 1, 3, false, 5]);
  const done = summarize({ ...snap, settings: { ...snap.settings, 'activity-2026-10-05': { review: 4 } } }, NOW);
  assert.equal(done.studiedToday, true);
});

test('тексты уведомлений', () => {
  const m = buildMessage('morning', { due: 13, fresh: 1, streak: 5, dailyLeft: 5, studiedToday: false }, 0);
  assert.match(m.title, /Buenos días/);
  assert.match(m.body, /Серия: 5 дней/);
  assert.match(m.body, /14 карточек на сегодня/);
  assert.match(m.body, /Фраза дня/);
  assert.equal(buildMessage('evening', { studiedToday: true }), null);
  assert.match(buildMessage('evening', { studiedToday: false, streak: 2, due: 3 }).title, /Серия 2 дня под угрозой/);
  assert.match(buildMessage('test', {}).title, /работают/);
});

test('конфигурация push: проверка полей и формат из приложения', () => {
  const raw = buildPushConfig({ url: 'https://x.supabase.co/', key: 'k', code: 'c' }, { publicKey: 'P', privateKey: 'D' });
  const c = parsePushConfig(raw);
  assert.equal(c.url, 'https://x.supabase.co');
  assert.equal(c.vapid.privateKey, 'D');
  assert.throws(() => parsePushConfig('{"url":"u"}'), /нет поля key/);
  assert.throws(() => parsePushConfig('nope'), /не JSON/);
});

test('base64url туда и обратно', () => {
  const bytes = Uint8Array.from([0, 251, 255, 62, 63, 1]);
  assert.equal(b64url(bytes), 'APv_Pj8B');
  assert.deepEqual([...fromB64url('APv_Pj8B')], [...bytes]);
});
