import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickBestVoice, listEsVoices } from '../js/tts.js';

const voices = [
  { name: 'Google US English', lang: 'en-US', voiceURI: 'en1', localService: false },
  { name: 'Mónica', lang: 'es-ES', voiceURI: 'es-monica', localService: true },
  { name: 'Paulina', lang: 'es-MX', voiceURI: 'es-paulina', localService: true },
  { name: 'Jorge', lang: 'es-ES', voiceURI: 'es-jorge', localService: true },
];

test('pickBestVoice: предпочитает улучшенный es-ES голос', () => {
  assert.equal(pickBestVoice(voices, null).voiceURI, 'es-monica');
});

test('pickBestVoice: уважает выбранный голос', () => {
  assert.equal(pickBestVoice(voices, 'es-jorge').voiceURI, 'es-jorge');
});

test('pickBestVoice: нет испанских → null', () => {
  assert.equal(pickBestVoice([{ name: 'X', lang: 'en-US', voiceURI: 'x' }], null), null);
});

test('listEsVoices: только испанские, улучшенный первый', () => {
  const l = listEsVoices(voices);
  assert.equal(l.length, 3);
  assert.equal(l[0].voiceURI, 'es-monica');
});

import { buildGoogleRequest, googleVoiceName, spanishSegments, GOOGLE_VOICES } from '../js/tts.js';

test('pickBestVoice: голос из Испании важнее «улучшенного» мексиканского', () => {
  const voices = [
    { name: 'Paulina (Enhanced)', lang: 'es-MX', voiceURI: 'p' },
    { name: 'Google español', lang: 'es-ES', voiceURI: 'g' },
  ];
  assert.equal(pickBestVoice(voices, null).voiceURI, 'g');
});

test('buildGoogleRequest: голос Chirp 3 HD для es-ES, MP3', () => {
  assert.equal(googleVoiceName('Kore'), 'es-ES-Chirp3-HD-Kore');
  assert.deepEqual(buildGoogleRequest('Hola', 'Charon'), {
    input: { text: 'Hola' },
    voice: { languageCode: 'es-ES', name: 'es-ES-Chirp3-HD-Charon' },
    audioConfig: { audioEncoding: 'MP3' },
  });
});

test('GOOGLE_VOICES: по четыре женских и мужских голоса', () => {
  assert.equal(GOOGLE_VOICES.filter((v) => v.gender === 'f').length, 4);
  assert.equal(GOOGLE_VOICES.filter((v) => v.gender === 'm').length, 4);
});

test('spanishSegments: из ответа наставника берутся только испанские фразы', () => {
  const text = 'Отлично! Скажи так: **¿Dónde está la playa?** А в баре: «Ponme un café con leche, porfa». Слово *coche* значит машина.';
  assert.deepEqual(spanishSegments(text), ['¿Dónde está la playa?', '«Ponme un café con leche, porfa».']);
});

test('spanishSegments: чисто русский текст — пусто', () => {
  assert.deepEqual(spanishSegments('Привет! Как дела?'), []);
});
