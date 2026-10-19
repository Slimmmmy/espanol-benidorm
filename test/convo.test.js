import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tallSlices, convoStats, mistakesFromConvo, convoText } from '../js/convo.js';
import { shotsLabel } from '../js/chat.js';
import { buildConvoMessages } from '../js/claude.js';
import { CONVO_REVIEW } from '../js/schemas.js';
import { MISTAKE_TOPICS } from '../js/curriculum.js';

test('tallSlices: обычный скриншот — целиком, длинный — кусками с перекрытием', () => {
  assert.deepEqual(tallSlices(1170, 2532), [{ y: 0, h: 2532 }]);
  const s = tallSlices(1170, 9000);
  assert.ok(s.length >= 3);
  assert.equal(s[0].y, 0);
  for (let i = 1; i < s.length; i++) assert.ok(s[i].y < s[i - 1].y + s[i - 1].h, 'перекрытие');
  const last = s[s.length - 1];
  assert.equal(last.y + last.h, 9000);
  s.forEach((x) => assert.ok(x.h / 1170 <= 2.2 * 1.35));
});

const R = {
  messages: [
    { from: 'them', text: 'Hola! q tal el piso?', verdict: '', corrected: '', natural: '', topic: '' },
    { from: 'me', text: 'Muy bien, gracias', verdict: 'ok', corrected: '', natural: '', topic: '' },
    { from: 'me', text: 'El grifo es roto', verdict: 'error', corrected: 'El grifo está roto', natural: 'Se ha roto el grifo', topic: 'ser и estar' },
    { from: 'me', text: 'cuando vienes', verdict: 'minor', corrected: '¿Cuándo vienes?', natural: '', topic: 'Орфография и ударения' },
    { from: 'me', text: 'спасибо', verdict: 'not_spanish', corrected: '', natural: 'Gracias', topic: '' },
  ],
};

test('convoStats и mistakesFromConvo: считают только свои сообщения', () => {
  assert.deepEqual(convoStats(R), { mine: 4, ok: 1, minor: 1, error: 1, other: 1 });
  const m = mistakesFromConvo(R);
  assert.equal(m.length, 2);
  assert.deepEqual(m[0], { phrase: 'El grifo es roto', corrected: 'El grifo está roto', topic: 'ser и estar' });
  assert.deepEqual(convoStats(null), { mine: 0, ok: 0, minor: 0, error: 0, other: 0 });
});

test('convoText: разбор текстом для контекста наставника', () => {
  const t = convoText({ app: 'WhatsApp', context: 'хозяин квартиры', ...R, overall: 'Путаете ser/estar.' });
  assert.equal(t.split('\n')[0], 'Разбор переписки (WhatsApp): хозяин квартиры');
  assert.ok(t.includes('Собеседник: Hola! q tal el piso?'));
  assert.ok(t.includes('Я: El grifo es roto — ✗ ошибка; правильно: El grifo está roto; естественнее: Se ha roto el grifo'));
  assert.ok(t.includes('Итог: Путаете ser/estar.'));
});

test('shotsLabel: склонение', () => {
  assert.equal(shotsLabel(1), '1 скриншот переписки');
  assert.equal(shotsLabel(3), '3 скриншота переписки');
  assert.equal(shotsLabel(5), '5 скриншотов переписки');
});

test('buildConvoMessages: картинки по порядку + контекст', () => {
  const [msg] = buildConvoMessages(['AAA', 'BBB'], 'хозяин квартиры');
  const imgs = msg.content.filter((c) => c.type === 'image');
  assert.deepEqual(imgs.map((c) => c.source.data), ['AAA', 'BBB']);
  assert.equal(msg.content[0].text, 'Скриншот 1 из 2:');
  assert.ok(msg.content[msg.content.length - 1].text.includes('хозяин квартиры'));
});

test('схема разбора: тема ошибки — из единого перечня', () => {
  const t = CONVO_REVIEW.properties.messages.items.properties.topic.enum;
  assert.deepEqual(t, [...MISTAKE_TOPICS, '']);
});
