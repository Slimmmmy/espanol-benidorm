import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cropRect, looksLikeSpread, analyzeGray, photoWarnings, levelsTable } from '../js/photo.js';

function image(w, h, fn) {
  const g = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = fn(x, y);
  return g;
}

test('разворот: половины с запасом у корешка', () => {
  assert.ok(looksLikeSpread(4000, 3000));
  assert.ok(!looksLikeSpread(3000, 4000));
  assert.deepEqual(cropRect(1000, 800, 'left'), { x: 0, y: 0, w: 530, h: 800 });
  assert.deepEqual(cropRect(1000, 800, 'right'), { x: 470, y: 0, w: 530, h: 800 });
  assert.deepEqual(cropRect(1000, 800), { x: 0, y: 0, w: 1000, h: 800 });
});

test('резкий текст и размытое фото различаются', () => {
  const sharp = analyzeGray(image(100, 100, (x, y) => ((x % 4 < 2) !== (y % 6 < 3) ? 20 : 230)), 100, 100);
  const blurry = analyzeGray(image(100, 100, (x) => 120 + Math.round(10 * Math.sin(x / 15))), 100, 100);
  assert.ok(sharp.sharpness > 1000);
  assert.ok(blurry.sharpness < 40);
  assert.ok(photoWarnings(blurry).some((w) => w.includes('размыто')));
  assert.deepEqual(photoWarnings(sharp, { w: 1500, h: 2000 }), []);
});

test('тёмное фото: подсказка и растяжка уровней', () => {
  const dark = analyzeGray(image(50, 50, (x, y) => 30 + ((x + y) % 3) * 15), 50, 50);
  assert.ok(dark.mean < 70);
  assert.ok(photoWarnings(dark).some((w) => w.includes('Темновато')));
  const lut = levelsTable(dark);
  assert.ok(lut);
  assert.equal(lut[dark.hi + 5], 255);
  assert.equal(levelsTable({ contrast: 200, lo: 10, hi: 210 }), null);
});
