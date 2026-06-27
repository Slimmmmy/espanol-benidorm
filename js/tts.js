// Озвучка через Web Speech API + выбор лучшего испанского голоса.
import { getSetting } from './db.js';

const ENHANCED = /enhanced|premium|siri|m[oó]nica|paulina|marisol|lucia|sergio/i;

let preferredVoiceURI = null;
let voiceRate = 1;

function voiceScore(v) {
  let s = 0;
  if (ENHANCED.test(v.name || '')) s += 10;
  if ((v.lang || '').toLowerCase() === 'es-es') s += 3;
  if (v.localService) s += 1;
  return s;
}

export function pickBestVoice(voices, preferredURI) {
  const list = Array.isArray(voices) ? voices : [];
  if (preferredURI) {
    const exact = list.find((v) => v.voiceURI === preferredURI);
    if (exact) return exact;
  }
  const es = list.filter((v) => (v.lang || '').toLowerCase().startsWith('es'));
  if (es.length === 0) return null;
  return es.slice().sort((a, b) => voiceScore(b) - voiceScore(a))[0];
}

export function listEsVoices(voices) {
  const es = (Array.isArray(voices) ? voices : []).filter((v) => (v.lang || '').toLowerCase().startsWith('es'));
  return es.slice().sort((a, b) => voiceScore(b) - voiceScore(a));
}

export function getVoicesAsync() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) { resolve([]); return; }
    const ready = speechSynthesis.getVoices();
    if (ready.length) { resolve(ready); return; }
    speechSynthesis.addEventListener('voiceschanged', () => resolve(speechSynthesis.getVoices()), { once: true });
    setTimeout(() => resolve(speechSynthesis.getVoices()), 1200);
  });
}

export async function initVoice() {
  preferredVoiceURI = (await getSetting('voiceURI')) || null;
  const r = Number(await getSetting('voiceRate'));
  voiceRate = r > 0 ? r : 1;
}

function currentVoice() {
  return pickBestVoice(speechSynthesis.getVoices(), preferredVoiceURI);
}

export function speak(text, lang = 'es-ES') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  const v = currentVoice();
  if (v) u.voice = v;
  u.rate = voiceRate;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  return true;
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) speechSynthesis.cancel();
}

export function speakSequence(lines, lang = 'es-ES') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const voice = currentVoice();
  const speakers = [];
  const pitchFor = (speaker) => {
    if (!speaker) return 1.0;
    let i = speakers.indexOf(speaker);
    if (i === -1) { speakers.push(speaker); i = speakers.length - 1; }
    return i % 2 === 0 ? 1.05 : 0.8;
  };
  // Реплики ставятся в очередь синтеза синхронно — полагаемся на очередь Chrome (целевой браузер).
  for (const line of lines) {
    const u = new SpeechSynthesisUtterance(line.es);
    u.lang = lang;
    if (voice) u.voice = voice;
    u.rate = voiceRate;
    u.pitch = pitchFor(line.speaker);
    speechSynthesis.speak(u);
  }
}
