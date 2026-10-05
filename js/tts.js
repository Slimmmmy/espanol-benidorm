// Озвучка испанского. Два движка:
//  • Google Cloud Text-to-Speech, голоса Chirp 3 HD (es-ES) — живой кастильский испанский;
//  • голос устройства (Web Speech API) — запасной вариант, если нет ключа или сети.
// Озвученные фразы кэшируются (Cache Storage): повтор бесплатный и работает офлайн.
import { getSetting } from './db.js';

// ── Голос устройства ─────────────────────────────────
const ENHANCED = /enhanced|premium|siri|m[oó]nica|paulina|marisol|lucia|sergio|jorge|carlos/i;

let preferredVoiceURI = null;
let voiceRate = 1;

// Испанский из Испании (es-ES) важнее «улучшенного» латиноамериканского голоса.
function voiceScore(v) {
  let s = 0;
  if ((v.lang || '').toLowerCase().replace('_', '-') === 'es-es') s += 20;
  if (ENHANCED.test(v.name || '')) s += 10;
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

function currentVoice() {
  return pickBestVoice(speechSynthesis.getVoices(), preferredVoiceURI);
}

function deviceSpeakAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function deviceUtterance(text, lang, opts, pitch = 1) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  const v = currentVoice();
  if (v) u.voice = v;
  u.rate = opts.slow ? Math.max(0.5, voiceRate * 0.7) : voiceRate;
  u.pitch = pitch;
  return u;
}

// ── Google Chirp 3 HD ────────────────────────────────
export const GOOGLE_VOICES = [
  { id: 'Kore', gender: 'f', label: 'Kore — женский, тёплый' },
  { id: 'Aoede', gender: 'f', label: 'Aoede — женский, лёгкий' },
  { id: 'Leda', gender: 'f', label: 'Leda — женский, молодой' },
  { id: 'Zephyr', gender: 'f', label: 'Zephyr — женский, яркий' },
  { id: 'Charon', gender: 'm', label: 'Charon — мужской, спокойный' },
  { id: 'Puck', gender: 'm', label: 'Puck — мужской, бодрый' },
  { id: 'Fenrir', gender: 'm', label: 'Fenrir — мужской, энергичный' },
  { id: 'Orus', gender: 'm', label: 'Orus — мужской, низкий' },
];
const GOOGLE_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const TTS_CACHE = 'espanol-tts';
const SLOW_RATE = 0.75;

const cfg = { engine: 'device', key: '', female: 'Kore', male: 'Charon', main: 'f' };
let lastError = '';

export function googleVoiceName(id) {
  return `es-ES-Chirp3-HD-${id}`;
}

// Тело запроса к Google TTS. Чистая функция.
export function buildGoogleRequest(text, voiceId) {
  return {
    input: { text },
    voice: { languageCode: 'es-ES', name: googleVoiceName(voiceId) },
    audioConfig: { audioEncoding: 'MP3' },
  };
}

function voiceFor(gender) {
  const g = gender || cfg.main;
  return g === 'm' ? cfg.male : cfg.female;
}

const cloudOn = () => cfg.engine === 'google' && !!cfg.key;

async function cacheGet(url) {
  try {
    if (typeof caches === 'undefined') return null;
    const res = await (await caches.open(TTS_CACHE)).match(url);
    return res ? res.blob() : null;
  } catch (e) { return null; }
}

// Кэш озвучки ограничен: самые старые фразы удаляются, чтобы не занимать память телефона.
export const TTS_CACHE_MAX = 500;
let putsSinceTrim = TTS_CACHE_MAX; // первая запись в сессии сразу проверяет размер

async function cachePut(url, blob) {
  try {
    if (typeof caches === 'undefined') return;
    const cache = await caches.open(TTS_CACHE);
    await cache.put(url, new Response(blob, { headers: { 'content-type': 'audio/mpeg' } }));
    if (++putsSinceTrim >= 25) {
      putsSinceTrim = 0;
      const keys = await cache.keys(); // в порядке добавления
      for (const req of keys.slice(0, Math.max(0, keys.length - TTS_CACHE_MAX))) await cache.delete(req);
    }
  } catch (e) { /* кэш — необязателен */ }
}

function b64ToBlob(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'audio/mpeg' });
}

function googleError(status, body) {
  const reason = JSON.stringify(body || '');
  if (status === 400 && /API_KEY_INVALID|API key not valid/.test(reason)) return 'Неверный ключ Google. Проверьте его в Настройках.';
  if (status === 401 || /API keys are not supported|ACCESS_TOKEN_TYPE_UNSUPPORTED/.test(reason)) {
    return 'Этот ключ не подходит для озвучки: похоже, он из Google AI Studio (для Gemini). Нужен ключ из Google Cloud Console → APIs & Services → Credentials (начинается с AIza).';
  }
  if (status === 403 && /SERVICE_DISABLED|has not been used|disabled/i.test(reason)) return 'В проекте Google не включён Cloud Text-to-Speech API.';
  if (status === 403 && /billing/i.test(reason)) return 'В проекте Google не подключён платёжный аккаунт (нужен даже для бесплатного лимита).';
  if (status === 403) return 'Google отклонил запрос: проверьте ограничения ключа (сайт и API).';
  if (status === 429) return 'Превышен лимит запросов Google. Попробуйте позже.';
  return `Ошибка Google TTS (${status}). ${body?.error?.message || ''}`.trim();
}

async function synthesize(text, voiceId) {
  const cacheUrl = `https://tts.cache/${voiceId}/${encodeURIComponent(text)}`;
  const cached = await cacheGet(cacheUrl);
  if (cached) return cached;
  let res;
  try {
    res = await fetch(`${GOOGLE_URL}?key=${encodeURIComponent(cfg.key)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildGoogleRequest(text, voiceId)),
    });
  } catch (e) {
    throw new Error('Нет сети — озвучиваю голосом телефона.');
  }
  let body = null;
  try { body = await res.json(); } catch (e) { /* пусто */ }
  if (!res.ok) throw new Error(googleError(res.status, body));
  if (!body || !body.audioContent) throw new Error('Google вернул пустой ответ.');
  const blob = b64ToBlob(body.audioContent);
  cachePut(cacheUrl, blob);
  return blob;
}

// ── Воспроизведение ──────────────────────────────────
let audio = null;
let playToken = 0;
let unlocked = false;
let unlockInstalled = false;

function audioEl() {
  if (!audio && typeof Audio !== 'undefined') {
    audio = new Audio();
    audio.preload = 'auto';
  }
  return audio;
}

// Короткая тишина (WAV), чтобы «разблокировать» звук на iPhone первым касанием:
// после этого фразы можно запускать и после загрузки из сети.
function silentWavUrl() {
  const n = 800;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

function installUnlock() {
  if (typeof document === 'undefined' || unlockInstalled) return;
  unlockInstalled = true;
  const unlock = () => {
    if (unlocked) return;
    const a = audioEl();
    if (!a) return;
    unlocked = true;
    a.src = silentWavUrl();
    a.play().catch(() => { unlocked = false; });
  };
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });
}

function playBlob(blob, slow, token) {
  return new Promise((resolve) => {
    const a = audioEl();
    if (!a || token !== playToken) { resolve(); return; }
    const url = URL.createObjectURL(blob);
    const done = () => { a.onended = null; a.onerror = null; URL.revokeObjectURL(url); resolve(); };
    a.onended = done;
    a.onerror = done;
    a.src = url;
    a.playbackRate = slow ? SLOW_RATE : 1;
    a.preservesPitch = true;
    a.play().catch(done);
  });
}

function stopAll() {
  playToken++;
  if (audio) { audio.pause(); audio.onended = null; }
  if (deviceSpeakAvailable()) speechSynthesis.cancel();
}

export function canSpeak() {
  return cloudOn() || deviceSpeakAvailable();
}

export function stopSpeaking() {
  stopAll();
}

export function ttsLastError() {
  return lastError;
}

function deviceSpeak(text, lang, opts) {
  if (!deviceSpeakAvailable()) return false;
  speechSynthesis.cancel();
  speechSynthesis.speak(deviceUtterance(text, lang, opts));
  return true;
}

// Озвучить фразу. opts.slow — медленнее; opts.gender — 'f' | 'm' (голос персонажа).
export async function speak(text, lang = 'es-ES', opts = {}) {
  stopAll();
  const token = playToken;
  const clean = String(text || '').trim();
  if (!clean) return false;
  if (cloudOn() && lang.startsWith('es')) {
    try {
      const blob = await synthesize(clean, voiceFor(opts.gender));
      lastError = '';
      await playBlob(blob, opts.slow, token);
      return true;
    } catch (e) {
      lastError = e.message;
      if (token !== playToken) return false;
    }
  }
  return deviceSpeak(clean, lang, opts);
}

// Озвучить диалог: у каждого персонажа свой голос (первый — основной, второй — противоположный пол).
export async function speakSequence(lines, lang = 'es-ES', opts = {}) {
  stopAll();
  const token = playToken;
  const speakers = [];
  const slot = (speaker) => {
    let i = speakers.indexOf(speaker || '');
    if (i === -1) { speakers.push(speaker || ''); i = speakers.length - 1; }
    return i % 2;
  };
  if (cloudOn()) {
    try {
      // Первую реплику запрашиваем сразу, следующие — пока звучит предыдущая.
      const other = cfg.main === 'f' ? 'm' : 'f';
      const jobs = lines.map((l) => () => synthesize(l.es, voiceFor(slot(l.speaker) === 0 ? cfg.main : other)));
      const start = (i) => { const p = jobs[i](); p.catch(() => {}); return p; };
      let next = jobs.length ? start(0) : null;
      for (let i = 0; i < jobs.length; i++) {
        const blob = await next;
        next = i + 1 < jobs.length ? start(i + 1) : null;
        if (token !== playToken) return;
        await playBlob(blob, opts.slow, token);
        if (token !== playToken) return;
      }
      lastError = '';
      return;
    } catch (e) {
      lastError = e.message;
      if (token !== playToken) return;
    }
  }
  if (!deviceSpeakAvailable()) return;
  speechSynthesis.cancel();
  speakers.length = 0;
  for (const line of lines) {
    speechSynthesis.speak(deviceUtterance(line.es, lang, opts, slot(line.speaker) === 0 ? 1.05 : 0.8));
  }
}

// Только испанские фрагменты текста (для озвучки ответов наставника, где русский вперемешку с испанским).
export function spanishSegments(text) {
  const plain = String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`#>]/g, ' ')
    .replace(/\s+/g, ' ');
  const re = /[¿¡"«]?[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9'’]*(?:[ ,;:\-–]+[¿¡"«]?[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9'’]*)*[.!?…»"]*/g;
  return (plain.match(re) || [])
    .map((s) => s.replace(/[\s,;:\-–]+$/, '').trim())
    .filter((s) => s.split(/\s+/).length >= 2 || /[áéíóúñ¿¡]/i.test(s));
}

export async function initVoice() {
  preferredVoiceURI = (await getSetting('voiceURI')) || null;
  const r = Number(await getSetting('voiceRate'));
  voiceRate = r > 0 ? r : 1;
  cfg.engine = (await getSetting('ttsEngine')) || 'google'; // без ключа всё равно звучит голос телефона
  cfg.key = ((await getSetting('googleTtsKey')) || '').trim();
  cfg.female = (await getSetting('googleVoiceF')) || 'Kore';
  cfg.male = (await getSetting('googleVoiceM')) || 'Charon';
  cfg.main = (await getSetting('googleVoiceMain')) || 'f';
  installUnlock();
}
