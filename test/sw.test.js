import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

// Если файл не попал в оболочку — офлайн приложение не загрузится. Ловим это до выкладки.
test('sw.js кэширует все модули и шрифты', () => {
  const files = [
    ...readdirSync(new URL('../js', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => `./js/${f}`),
    ...readdirSync(new URL('../fonts', import.meta.url)).map((f) => `./fonts/${f}`),
  ];
  for (const f of files) assert.ok(sw.includes(`'${f}'`), `нет в SHELL: ${f}`);
});

test('sw.js сохраняет кэш озвучки при обновлении', () => {
  assert.match(sw, /'espanol-tts'/);
});
