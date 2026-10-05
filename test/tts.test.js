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

import { buildGoogleRequest, googleVoiceName, spanishSegments, GOOGLE_VOICES, classifyVoices } from '../js/tts.js';

test('pickBestVoice: голос из Испании важнее «улучшенного» мексиканского', () => {
  const voices = [
    { name: 'Paulina (Enhanced)', lang: 'es-MX', voiceURI: 'p' },
    { name: 'Google español', lang: 'es-ES', voiceURI: 'g' },
  ];
  assert.equal(pickBestVoice(voices, null).voiceURI, 'g');
});

test('buildGoogleRequest: Chirp 3 HD, несжатый WAV, скорость на стороне Google', () => {
  assert.equal(googleVoiceName('Kore'), 'es-ES-Chirp3-HD-Kore');
  assert.equal(googleVoiceName('es-ES-Studio-C'), 'es-ES-Studio-C');
  assert.deepEqual(buildGoogleRequest('Hola', 'Charon'), {
    input: { text: 'Hola' },
    voice: { languageCode: 'es-ES', name: 'es-ES-Chirp3-HD-Charon' },
    audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 24000 },
  });
  assert.equal(buildGoogleRequest('Hola', 'es-ES-Studio-F', 0.8).audioConfig.speakingRate, 0.8);
  assert.equal(buildGoogleRequest('Hola', 'es-ES-Studio-F', 0.8).voice.name, 'es-ES-Studio-F');
});

test('classifyVoices: только es-ES и качественные семейства, Chirp 3 HD первыми', () => {
  const list = classifyVoices([
    { name: 'es-ES-Standard-A', languageCodes: ['es-ES'], ssmlGender: 'FEMALE' },
    { name: 'es-ES-Studio-F', languageCodes: ['es-ES'], ssmlGender: 'MALE' },
    { name: 'es-ES-Chirp3-HD-Kore', languageCodes: ['es-ES'], ssmlGender: 'FEMALE' },
    { name: 'es-US-Chirp3-HD-Puck', languageCodes: ['es-US'], ssmlGender: 'MALE' },
  ]);
  assert.deepEqual(list.map((v) => [v.id, v.gender, v.family]), [['Kore', 'f', 'Chirp 3 HD'], ['es-ES-Studio-F', 'm', 'Studio']]);
  assert.ok(list[0].trait);
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
