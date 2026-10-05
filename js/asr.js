// Распознавание речи. Два движка:
//  • Google Cloud Speech-to-Text (тот же ключ Google, что и для голоса) — точнее с акцентом, стабильно на iPhone:
//    запись идёт через микрофон браузера, конец фразы определяется по тишине, видна громкость;
//  • распознавание телефона (Web Speech API) — без ключа; показывает текст прямо во время речи.
// Во время записи внизу экрана — панель «Слушаю»: громкость/текст, «Готово» и «Отмена».
import { getSetting } from './db.js';
import { similarity } from './util.js';

const STT_URL = 'https://speech.googleapis.com/v1/speech:recognize';
const RATE = 16000;

// ── Чистые функции (покрыты тестами) ────────────────

// Понижение частоты (среднее по окну) до 16 кГц — так требует Google и так меньше трафика.
export function downsample(input, inRate, outRate = RATE) {
  if (inRate === outRate) return Float32Array.from(input);
  const ratio = inRate / outRate;
  const n = Math.floor(input.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const from = Math.floor(i * ratio);
    const to = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let k = from; k < to; k++) sum += input[k];
    out[i] = sum / Math.max(1, to - from);
  }
  return out;
}

export function floatTo16(input) {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function bytesToBase64(bytes) {
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
}

export function rms(buf) {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / Math.max(1, buf.length));
}

// Детектор речи по громкости: подстраивается под фоновый шум, ждёт речь, затем паузу.
// push(уровень, мс) → 'wait' | 'speech' | 'done' | 'nospeech' | 'max'.
export function createVad({ silenceMs = 1100, noSpeechMs = 7000, maxMs = 15000, minLevel = 0.012 } = {}) {
  let t = 0;
  let floor = null;
  let calib = [];
  let spoke = false;
  let loud = 0;
  let quietFor = 0;
  return {
    get spoke() { return spoke; },
    push(level, ms) {
      t += ms;
      if (t <= 300) { calib.push(level); return 'wait'; }
      if (floor === null) floor = calib.length ? calib.reduce((a, b) => a + b, 0) / calib.length : 0;
      const thr = Math.max(minLevel, floor * 2.5);
      if (level > thr) { loud += ms; quietFor = 0; if (loud >= 120) spoke = true; } else { loud = 0; if (spoke) quietFor += ms; }
      if (t >= maxMs) return 'max';
      if (!spoke && t >= noSpeechMs) return 'nospeech';
      if (spoke && quietFor >= silenceMs) return 'done';
      return spoke ? 'speech' : 'wait';
    },
  };
}

// Запрос к Google Speech-to-Text. expected — ожидаемая фраза (подсказка распознавателю).
export function buildSttRequest(b64, lang = 'es-ES', expected = '', model = 'latest_short') {
  const config = { encoding: 'LINEAR16', sampleRateHertz: RATE, languageCode: lang, maxAlternatives: 3, enableAutomaticPunctuation: true };
  if (model) config.model = model;
  if (expected) config.speechContexts = [{ phrases: [String(expected).slice(0, 100)] }];
  return { config, audio: { content: b64 } };
}

// Лучший вариант: если известна ожидаемая фраза — самый похожий на неё, иначе первый.
export function pickBest(alternatives, expected = '') {
  const list = (alternatives || []).map((a) => (typeof a === 'string' ? a : a && a.transcript) || '').map((t) => t.trim()).filter(Boolean);
  if (!list.length) return '';
  if (!expected) return list[0];
  return list.slice().sort((a, b) => similarity(expected, b) - similarity(expected, a))[0];
}

// Ответ Google → текст: склеиваем куски фразы, для первого куска выбираем лучший вариант.
export function sttText(body, expected = '') {
  const results = (body && body.results) || [];
  return results.map((r, i) => (i === 0 ? pickBest(r.alternatives, expected) : ((r.alternatives || [])[0] || {}).transcript || ''))
    .map((t) => String(t).trim()).filter(Boolean).join(' ');
}

const DEVICE_ERRORS = {
  'no-speech': 'Не услышал речь. Нажмите на микрофон и говорите сразу.',
  'audio-capture': 'Микрофон недоступен. Проверьте, не занят ли он другим приложением.',
  'not-allowed': 'Нет доступа к микрофону. Разрешите его: Настройки iPhone → Safari → Микрофон (или в настройках сайта).',
  'service-not-allowed': 'Распознавание телефона здесь недоступно. Включите распознавание Google в «Голос и микрофон».',
  network: 'Нет сети для распознавания речи.',
  aborted: 'Запись отменена.',
};

export function googleSttError(status, body) {
  const reason = JSON.stringify(body || '');
  if (status === 403 && /SERVICE_DISABLED|has not been used|disabled/i.test(reason)) return 'В проекте Google не включён Cloud Speech-to-Text API. Включите его (как Text-to-Speech) — или выберите распознавание телефона.';
  if (status === 403 && /blocked|API_KEY_SERVICE_BLOCKED|restrict/i.test(reason)) return 'Ключ Google ограничен: добавьте Cloud Speech-to-Text API в список разрешённых API ключа.';
  if (status === 403 && /billing/i.test(reason)) return 'В проекте Google не подключён платёжный аккаунт.';
  if (status === 400 && /API key not valid|API_KEY_INVALID/.test(reason)) return 'Неверный ключ Google.';
  if (status === 403) return 'Google отклонил распознавание: проверьте ограничения ключа.';
  return `Ошибка распознавания Google (${status}).`;
}

// ── Выбор движка ─────────────────────────────────────
const hasDeviceSR = () => typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
const hasMic = () => typeof navigator !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

const asrCfg = { engine: 'auto', key: '' };
let googleBlocked = ''; // причина, если Google-распознавание не сработало в этой сессии
let lastEngine = '';
let inited = false;

export async function initAsr() {
  inited = true;
  asrCfg.engine = (await getSetting('asrEngine')) || 'auto';
  asrCfg.key = ((await getSetting('googleTtsKey')) || '').trim();
  googleBlocked = '';
}

export function asrStatus() {
  return { engine: asrCfg.engine, google: !!asrCfg.key && hasMic(), device: hasDeviceSR(), blocked: googleBlocked, last: lastEngine };
}

function engineFor() {
  const google = !!asrCfg.key && hasMic() && !googleBlocked;
  if (asrCfg.engine === 'device') return hasDeviceSR() ? 'device' : (google ? 'google' : '');
  if (asrCfg.engine === 'google') return google ? 'google' : (hasDeviceSR() ? 'device' : '');
  return google ? 'google' : (hasDeviceSR() ? 'device' : '');
}

export function canRecognize() {
  return !!engineFor() || hasDeviceSR() || hasMic();
}

// ── Панель «Слушаю» ──────────────────────────────────
function panel() {
  if (typeof document === 'undefined') return null;
  let p = document.getElementById('asr-panel');
  if (!p) {
    p = document.createElement('div');
    p.id = 'asr-panel';
    p.setAttribute('role', 'status');
    p.innerHTML = `<div class="asr-inner">
      <div class="asr-mic" aria-hidden="true"><span class="asr-ring"></span></div>
      <div class="asr-body"><b class="asr-title">Слушаю…</b><div class="asr-text muted">Говорите по-испански</div>
        <div class="asr-meter" aria-hidden="true"><span></span></div></div>
      <div class="asr-btns"><button type="button" class="asr-done">Готово</button><button type="button" class="asr-cancel ghost" aria-label="Отмена">✕</button></div>
    </div>`;
    document.body.appendChild(p);
  }
  return p;
}

function showPanel(title, text) {
  const p = panel();
  if (!p) return null;
  p.querySelector('.asr-title').textContent = title;
  p.querySelector('.asr-text').textContent = text;
  p.querySelector('.asr-meter span').style.width = '0%';
  p.classList.add('open');
  return p;
}
function hidePanel() {
  const p = typeof document !== 'undefined' && document.getElementById('asr-panel');
  if (p) p.classList.remove('open');
}

// iOS: режим аудиосессии — запись или воспроизведение (иначе голос после микрофона звучит тихо, «в трубку»).
export function setAudioSession(type) {
  try { if (typeof navigator !== 'undefined' && navigator.audioSession) navigator.audioSession.type = type; } catch (e) { /* не поддерживается */ }
}

// ── Движок телефона ──────────────────────────────────
function deviceRecognize(lang, { expected = '', title } = {}) {
  return new Promise((resolve, reject) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = lang;
    r.interimResults = true;
    r.maxAlternatives = 3;
    r.continuous = false;
    let finalAlts = null;
    let interim = '';
    let settled = false;
    const p = showPanel(title || 'Слушаю…', 'Говорите по-испански');
    const finish = (fn, v) => { if (settled) return; settled = true; hidePanel(); setAudioSession('playback'); fn(v); };
    if (p) {
      p.querySelector('.asr-done').onclick = () => r.stop();
      p.querySelector('.asr-cancel').onclick = () => { r.abort(); finish(reject, new Error(DEVICE_ERRORS.aborted)); };
      p.querySelector('.asr-meter').classList.add('hidden');
    }
    r.onresult = (e) => {
      interim = '';
      for (let i = e.resultIndex || 0; i < e.results.length; i++) {
        const res = e.results[i];
        // isFinal нет у некоторых старых реализаций — тогда результат считается окончательным.
        if (res.isFinal || res.isFinal === undefined) finalAlts = Array.from(res, (a) => a.transcript);
        else interim += res[0].transcript;
      }
      if (p) p.querySelector('.asr-text').textContent = interim || (finalAlts && finalAlts[0]) || '…';
      if (finalAlts) finish(resolve, pickBest(finalAlts, expected));
    };
    r.onerror = (e) => finish(reject, new Error(DEVICE_ERRORS[e.error] || `Ошибка распознавания: ${e.error || 'неизвестно'}`));
    r.onend = () => {
      if (finalAlts) finish(resolve, pickBest(finalAlts, expected));
      else if (interim.trim()) finish(resolve, interim.trim());
      else finish(reject, new Error(DEVICE_ERRORS['no-speech']));
    };
    setAudioSession('play-and-record');
    try { r.start(); } catch (e) { finish(reject, new Error('Не удалось включить микрофон.')); }
  });
}

// ── Google ───────────────────────────────────────────
let ctx = null;
function audioCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!ctx && AC) ctx = new AC();
  return ctx;
}

async function recordUtterance({ title } = {}) {
  setAudioSession('play-and-record');
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
  } catch (e) {
    setAudioSession('playback');
    throw new Error(e && e.name === 'NotAllowedError' ? DEVICE_ERRORS['not-allowed'] : 'Микрофон недоступен.');
  }
  const ac = audioCtx();
  if (ac.state !== 'running') { try { await ac.resume(); } catch (e) { /* ниже проверим */ } }
  const src = ac.createMediaStreamSource(stream);
  const proc = ac.createScriptProcessor(4096, 1, 1);
  const chunks = [];
  const vad = createVad();
  const p = showPanel(title || 'Слушаю…', 'Говорите по-испански — остановлюсь сам после паузы');
  if (p) p.querySelector('.asr-meter').classList.remove('hidden');
  return new Promise((resolve, reject) => {
    let done = false;
    const stop = (fn, v) => {
      if (done) return;
      done = true;
      proc.onaudioprocess = null;
      try { src.disconnect(); proc.disconnect(); } catch (e) { /* уже отключено */ }
      stream.getTracks().forEach((t) => t.stop());
      setAudioSession('playback');
      fn(v);
    };
    if (p) {
      p.querySelector('.asr-done').onclick = () => (vad.spoke || chunks.length > 8 ? stop(resolve, chunks) : stop(reject, new Error(DEVICE_ERRORS['no-speech'])));
      p.querySelector('.asr-cancel').onclick = () => { hidePanel(); stop(reject, new Error(DEVICE_ERRORS.aborted)); };
    }
    proc.onaudioprocess = (ev) => {
      const data = ev.inputBuffer.getChannelData(0);
      chunks.push(downsample(data, ac.sampleRate));
      const level = rms(data);
      if (p) {
        p.querySelector('.asr-meter span').style.width = `${Math.min(100, Math.round(level * 900))}%`;
        if (vad.spoke) p.querySelector('.asr-text').textContent = 'Слышу вас… сделайте паузу, когда закончите';
      }
      const st = vad.push(level, (data.length / ac.sampleRate) * 1000);
      if (st === 'done' || st === 'max') stop(resolve, chunks);
      else if (st === 'nospeech') { hidePanel(); stop(reject, new Error(DEVICE_ERRORS['no-speech'])); }
    };
    src.connect(proc);
    proc.connect(ac.destination);
  });
}

async function googleRecognize(lang, opts = {}) {
  const chunks = await recordUtterance(opts);
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const pcm = new Float32Array(total);
  let off = 0;
  for (const c of chunks) { pcm.set(c, off); off += c.length; }
  const b64 = bytesToBase64(new Uint8Array(floatTo16(pcm).buffer));
  const p = showPanel('Распознаю…', '');
  if (p) p.querySelector('.asr-meter').classList.add('hidden');
  try {
    const call = async (model) => {
      let res;
      try {
        res = await fetch(`${STT_URL}?key=${encodeURIComponent(asrCfg.key)}`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(buildSttRequest(b64, lang, opts.expected, model)),
        });
      } catch (e) { throw new Error('Нет сети для распознавания речи.'); }
      let body = null;
      try { body = await res.json(); } catch (e) { /* пусто */ }
      return { res, body };
    };
    let { res, body } = await call('latest_short');
    if (res.status === 400 && /model/i.test(JSON.stringify(body || ''))) ({ res, body } = await call(''));
    if (!res.ok) {
      const msg = googleSttError(res.status, body);
      if (res.status === 403 || res.status === 400) googleBlocked = msg;
      throw new Error(hasDeviceSR() ? `${msg} Переключаюсь на распознавание телефона — скажите ещё раз.` : msg);
    }
    const text = sttText(body, opts.expected);
    if (!text) throw new Error('Не разобрал слова. Скажите ещё раз чуть громче и ближе к телефону.');
    return text;
  } finally {
    hidePanel();
  }
}

// Распознать одну фразу. opts.expected — ожидаемая фраза (точнее распознаётся), opts.title — заголовок панели.
export async function recognizeOnce(lang = 'es-ES', opts = {}) {
  if (!inited) await initAsr().catch(() => {});
  const engine = engineFor();
  if (!engine) throw new Error('Распознавание речи недоступно в этом браузере.');
  lastEngine = engine;
  return engine === 'google' ? googleRecognize(lang, opts) : deviceRecognize(lang, opts);
}

