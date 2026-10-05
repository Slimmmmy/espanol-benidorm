// Подготовка фото страницы для распознавания: поворот, выбор страницы на развороте, проверка света и резкости,
// автоконтраст. Отправляем не больше 1568 px по длинной стороне — больше Claude всё равно уменьшает.

export const MAX_SIDE = 1568;
const WORK_SIDE = 2600; // промежуточный размер после поворота (запас для выреза половины разворота)

export function scaleToFit(w, h, max = MAX_SIDE) {
  if (!w || !h) return { w: 0, h: 0 };
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

// Область кадра: вся страница или половина разворота (с небольшим запасом у корешка).
export function cropRect(w, h, part = 'all') {
  if (part === 'left') return { x: 0, y: 0, w: Math.round(w * 0.53), h };
  if (part === 'right') { const x = Math.round(w * 0.47); return { x, y: 0, w: w - x, h }; }
  return { x: 0, y: 0, w, h };
}

export const looksLikeSpread = (w, h) => w > h * 1.2;

// Яркость, контраст (2–98 перцентили) и резкость (дисперсия лапласиана) по серому изображению 0–255.
export function analyzeGray(gray, w, h) {
  const hist = new Array(256).fill(0);
  let sum = 0;
  for (let i = 0; i < gray.length; i++) { hist[gray[i]]++; sum += gray[i]; }
  const n = gray.length || 1;
  const pct = (p) => { let acc = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * p) return v; } return 255; };
  let lsum = 0;
  let lsq = 0;
  let cnt = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4 * gray[i];
      lsum += lap; lsq += lap * lap; cnt++;
    }
  }
  const mean = sum / n;
  const lmean = cnt ? lsum / cnt : 0;
  return { mean, lo: pct(0.02), hi: pct(0.98), contrast: pct(0.98) - pct(0.02), sharpness: cnt ? lsq / cnt - lmean * lmean : 0 };
}

// Подсказки по качеству фото (пусто — всё хорошо).
export function photoWarnings(stats, size = {}) {
  const out = [];
  if (stats.mean < 70) out.push('Темновато — включите свет или подойдите к окну.');
  if (stats.mean > 235) out.push('Слишком светло или блик — уберите вспышку, наклоните книгу.');
  if (stats.sharpness < 40) out.push('Фото размыто — держите телефон ровно и коснитесь текста на экране для фокуса.');
  if (size.w && Math.min(size.w, size.h) < 700) out.push('Маленькое фото — текст может не прочитаться.');
  return out;
}

// Растяжка уровней для тусклых фото: таблица 0–255. Если контраст и так хороший — null.
export function levelsTable(stats) {
  if (stats.contrast >= 150) return null;
  const lo = Math.max(0, stats.lo - 5);
  const hi = Math.min(255, stats.hi + 5);
  if (hi - lo < 20) return null;
  const t = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) t[v] = Math.round(((v - lo) / (hi - lo)) * 255);
  return t;
}

// ── Работа с изображением (браузер) ─────────────────
export async function loadImage(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (e) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Не получилось открыть фото. Попробуйте другое.'));
      img.src = URL.createObjectURL(file);
    });
  }
}

// Повёрнутая рабочая копия (rot — 0/90/180/270).
export function rotated(src, rot = 0) {
  const sw = src.width;
  const sh = src.height;
  const k = Math.min(1, WORK_SIDE / Math.max(sw, sh));
  const w = Math.round(sw * k);
  const h = Math.round(sh * k);
  const side = rot % 180 !== 0;
  const c = document.createElement('canvas');
  c.width = side ? h : w;
  c.height = side ? w : h;
  const g = c.getContext('2d');
  g.translate(c.width / 2, c.height / 2);
  g.rotate((rot * Math.PI) / 180);
  g.drawImage(src, -w / 2, -h / 2, w, h);
  return c;
}

export function grayOf(canvas, max = 640) {
  const { w, h } = scaleToFit(canvas.width, canvas.height, max);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.drawImage(canvas, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) gray[j] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
  return { gray, w, h };
}

// Вырез + уменьшение + автоконтраст → JPEG (base64) для отправки и превью.
export function prepare(work, part = 'all') {
  const r = cropRect(work.width, work.height, part);
  const { w, h } = scaleToFit(r.w, r.h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.drawImage(work, r.x, r.y, r.w, r.h, 0, 0, w, h);
  const { gray, w: gw, h: gh } = grayOf(c);
  const stats = analyzeGray(gray, gw, gh);
  const lut = levelsTable(stats);
  if (lut) {
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; }
    g.putImageData(img, 0, 0);
  }
  const url = c.toDataURL('image/jpeg', 0.9);
  return { b64: url.split(',')[1], preview: c.toDataURL('image/jpeg', 0.5), stats, size: { w, h }, enhanced: !!lut };
}
