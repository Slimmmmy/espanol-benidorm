import { test } from 'node:test';
import assert from 'node:assert/strict';
import { downsample, floatTo16, bytesToBase64, rms, createVad, buildSttRequest, pickBest, sttText, googleSttError } from '../js/asr.js';

test('downsample: 48 кГц → 16 кГц втрое короче', () => {
  const out = downsample(new Float32Array(4800).fill(0.5), 48000);
  assert.equal(out.length, 1600);
  assert.ok(Math.abs(out[10] - 0.5) < 1e-6);
});

test('floatTo16 и base64', () => {
  const pcm = floatTo16(Float32Array.from([0, 1, -1, 2]));
  assert.deepEqual([...pcm], [0, 32767, -32768, 32767]);
  assert.equal(bytesToBase64(new Uint8Array([104, 111, 108, 97])), 'aG9sYQ==');
  assert.ok(rms(Float32Array.from([0.5, -0.5])) - 0.5 < 1e-9);
});

test('VAD: ждёт речь, останавливается после паузы', () => {
  const v = createVad({ silenceMs: 500 });
  const step = (level, n) => { let st; for (let i = 0; i < n; i++) st = v.push(level, 100); return st; };
  assert.equal(step(0.003, 3), 'wait');       // калибровка шума
  assert.equal(step(0.003, 5), 'wait');       // тишина — ждём
  assert.equal(step(0.1, 5), 'speech');       // говорит
  assert.equal(step(0.003, 4), 'speech');     // короткая пауза
  assert.equal(step(0.003, 2), 'done');       // пауза 500 мс — конец фразы
});

test('VAD: без речи — nospeech', () => {
  const v = createVad({ noSpeechMs: 1000 });
  let st;
  for (let i = 0; i < 12; i++) st = v.push(0.001, 100);
  assert.equal(st, 'nospeech');
});

test('запрос Google: LINEAR16 16 кГц, подсказка ожидаемой фразы', () => {
  const r = buildSttRequest('QUJD', 'es-ES', 'El perro');
  assert.equal(r.config.encoding, 'LINEAR16');
  assert.equal(r.config.sampleRateHertz, 16000);
  assert.equal(r.config.model, 'latest_short');
  assert.deepEqual(r.config.speechContexts, [{ phrases: ['El perro'] }]);
  assert.equal(buildSttRequest('x', 'es-ES', '', '').config.model, undefined);
});

test('выбор варианта: ближе к ожидаемой фразе', () => {
  assert.equal(pickBest(['el pero', 'el perro'], 'el perro'), 'el perro');
  assert.equal(pickBest(['hola'], ''), 'hola');
  assert.equal(sttText({ results: [{ alternatives: [{ transcript: 'Quiero un café' }] }, { alternatives: [{ transcript: 'con leche' }] }] }), 'Quiero un café con leche');
  assert.equal(sttText({}), '');
});

test('ошибки Google переводятся на понятный язык', () => {
  assert.match(googleSttError(403, { error: { status: 'PERMISSION_DENIED', details: [{ reason: 'SERVICE_DISABLED' }] } }), /Speech-to-Text API/);
  assert.match(googleSttError(403, { error: { message: 'Requests to this API speech.googleapis.com are blocked.' } }), /ограничен/);
});
