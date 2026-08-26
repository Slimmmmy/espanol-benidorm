import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, extractJson, normalizeText, similarity, recentMessages } from '../js/util.js';

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

test('recentMessages: берёт последние max и только role/content', () => {
  const h = [];
  for (let i = 0; i < 25; i++) h.push({ role: i % 2 ? 'assistant' : 'user', content: 'm' + i, ts: i });
  const out = recentMessages(h, 10);
  assert.equal(out.length <= 10, true);
  assert.deepEqual(Object.keys(out[0]).sort(), ['content', 'role']);
});

test('recentMessages: первый элемент всегда user', () => {
  const h = [{ role: 'assistant', content: 'a' }, { role: 'user', content: 'b' }, { role: 'assistant', content: 'c' }];
  const out = recentMessages(h, 10);
  assert.equal(out[0].role, 'user');
  assert.equal(out[0].content, 'b');
});

test('recentMessages: пустая история → []', () => {
  assert.deepEqual(recentMessages([], 10), []);
  assert.deepEqual(recentMessages(undefined, 10), []);
});

test('recentMessages: схлопывает подряд идущие одинаковые роли', () => {
  const h = [{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }, { role: 'assistant', content: 'c' }];
  assert.deepEqual(recentMessages(h, 10), [{ role: 'user', content: 'b' }, { role: 'assistant', content: 'c' }]);
});

import { renderMarkdown } from '../js/util.js';

test('renderMarkdown: жирный и курсив', () => {
  assert.equal(renderMarkdown('**СОВЕТ:** это *важно*'), '<p><strong>СОВЕТ:</strong> это <em>важно</em></p>');
});

test('renderMarkdown: маркированный список', () => {
  assert.equal(renderMarkdown('- один\n- два'), '<ul><li>один</li><li>два</li></ul>');
});

test('renderMarkdown: нумерованный список', () => {
  assert.equal(renderMarkdown('1. первый\n2. второй'), '<ol><li>первый</li><li>второй</li></ol>');
});

test('renderMarkdown: разделитель и заголовок', () => {
  assert.equal(renderMarkdown('---'), '<hr>');
  assert.equal(renderMarkdown('### Тема'), '<div class="md-h">Тема</div>');
});

test('renderMarkdown: код', () => {
  assert.equal(renderMarkdown('пиши `hola`'), '<p>пиши <code>hola</code></p>');
});

test('renderMarkdown: HTML экранируется (без XSS)', () => {
  const out = renderMarkdown('<img src=x onerror=alert(1)>');
  assert.ok(!out.includes('<img'));
  assert.ok(out.includes('&lt;img'));
});

test('renderMarkdown: пустой текст → пусто', () => {
  assert.equal(renderMarkdown(''), '');
  assert.equal(renderMarkdown(null), '');
});
