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
