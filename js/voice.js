// «Голос и микрофон»: выбор голоса (все голоса Google для Испании с прослушиванием), скорость,
// голос телефона, движок распознавания и проверка микрофона. Открывается из меню профиля и Настроек.
import { registerFeature } from './app.js';
import { getSetting, setSetting } from './db.js';
import { initVoice, speak, stopSpeaking, listGoogleVoices, ttsStatus, ttsLastError, getVoicesAsync, listEsVoices, pickBestVoice, googleVoiceName } from './tts.js';
import { initAsr, recognizeOnce, asrStatus } from './asr.js';
import { escapeHtml } from './util.js';
import { icon } from './icons.js';

export const RATES = [
  { v: 0.85, label: 'Медленнее' },
  { v: 0.95, label: 'Чуть медленнее' },
  { v: 1, label: 'Обычно' },
  { v: 1.1, label: 'Быстрее' },
];
const SAMPLE = '¡Hola! Soy de Benidorm. ¿Tomamos un café en el paseo de Levante? Vale, nos vemos a las cinco.';
const LIST_TTL = 7 * 86400000;

let genderFilter = 'all';
let sample = SAMPLE;

async function loadVoices(force = false) {
  const cached = await getSetting('googleVoiceList');
  if (!force && cached && Array.isArray(cached.list) && Date.now() - (cached.at || 0) < LIST_TTL) return cached.list;
  const list = await listGoogleVoices();
  await setSetting('googleVoiceList', { at: Date.now(), list });
  return list;
}

const sameVoice = (a, b) => googleVoiceName(a) === googleVoiceName(b);
// «es-ES-Chirp3-HD-Kore» → «Kore», «es-ES-Studio-C» → «Studio C».
const niceName = (id) => googleVoiceName(id).replace(/^es-ES-Chirp3-HD-/, '').replace(/^es-ES-([A-Za-z0-9]+)-([A-Z])$/, '$1 $2');

function statusHtml(st, asr) {
  const e = escapeHtml;
  const now = st.engine === 'google' && st.hasKey
    ? `Озвучка: <b>Google</b> · женский голос — <b>${e(niceName(st.female))}</b>, мужской — <b>${e(niceName(st.male))}</b>, основной — ${st.main === 'm' ? 'мужской' : 'женский'}`
    : 'Озвучка: <b>голос телефона</b>';
  const err = st.error ? `<div class="gr-bad">Последняя ошибка Google: ${e(st.error)} — поэтому звучал голос телефона.</div>` : '';
  const mic = asr.google && !asr.blocked ? 'Google (точнее с акцентом)' : asr.device ? 'распознавание телефона' : 'недоступно';
  return `<div class="word-card voice-status">
    <div>${now}</div>${err}
    <div class="muted">Микрофон: ${e(asr.engine === 'device' ? 'распознавание телефона' : asr.engine === 'google' ? 'Google' : `авто → ${mic}`)}${asr.blocked ? ` · Google: ${e(asr.blocked)}` : ''}</div>
  </div>`;
}

function rowsHtml(list, st) {
  const e = escapeHtml;
  const shown = list.filter((v) => genderFilter === 'all' || v.gender === genderFilter);
  let fam = '';
  return shown.map((v) => {
    const head = v.family !== fam ? `<h3 class="voice-family">${e(v.family)} <span class="muted">— ${e(v.familyNote)}</span></h3>` : '';
    fam = v.family;
    const chosen = sameVoice(v.id, v.gender === 'm' ? st.male : st.female);
    return `${head}<div class="voice-row${chosen ? ' chosen' : ''}">
      <button type="button" class="icon-btn" data-play="${e(v.id)}" aria-label="Прослушать ${e(v.label || v.short)}">${icon('play')}</button>
      <div class="voice-name"><b>${e(v.label || v.short)}</b> <span class="tag">${v.gender === 'm' ? 'муж.' : 'жен.'}</span>${v.trait ? `<div class="muted">${e(v.trait)}</div>` : ''}</div>
      ${chosen ? `<span class="daily-added">${icon('check', 'ic ic-sm')} ${v.gender === 'm' ? 'мужской' : 'женский'}</span>`
        : `<button type="button" class="ghost voice-pick" data-pick="${e(v.id)}" data-g="${v.gender}">Выбрать</button>`}
    </div>`;
  }).join('');
}

async function render(container) {
  const e = escapeHtml;
  await initVoice();
  await initAsr();
  const key = (await getSetting('googleTtsKey')) || '';
  const engine = (await getSetting('ttsEngine')) || 'google';
  const rate = Number(await getSetting('voiceRate')) || 1;
  const asrEngine = (await getSetting('asrEngine')) || 'auto';
  const deviceVoices = listEsVoices(await getVoicesAsync());
  const voiceURI = (await getSetting('voiceURI')) || '';
  const st = ttsStatus();
  const asr = asrStatus();
  container.innerHTML = `
    <h1>Голос и микрофон</h1>
    ${statusHtml(st, asr)}

    <h2>Скорость речи</h2>
    <div class="chip-row" role="group" aria-label="Скорость">${RATES.map((r) => `<button type="button" class="chip-btn${r.v === rate ? ' active' : ''}" data-rate="${r.v}" aria-pressed="${r.v === rate}">${r.label}</button>`).join('')}</div>

    <h2>Голос</h2>
    <div class="segment seg-inline" role="tablist">
      <button type="button" class="seg-btn${engine === 'google' ? ' active' : ''}" data-engine="google">Google — живой</button>
      <button type="button" class="seg-btn${engine === 'device' ? ' active' : ''}" data-engine="device">Голос телефона</button>
    </div>
    <div id="vc-google" class="${engine === 'google' ? '' : 'hidden'}">
      <label>Ключ Google Cloud
        <input id="vc-key" type="password" placeholder="AIza…" autocomplete="off" value="${e(key)}">
      </label>
      <button id="vc-keysave" class="ghost">Сохранить ключ</button>
      ${key ? `
      <label>Фраза для прослушивания
        <input id="vc-sample" type="text" value="${e(sample)}" lang="es">
      </label>
      <div class="segment seg-inline" role="tablist" aria-label="Основной голос">
        <button type="button" class="seg-btn${st.main === 'f' ? ' active' : ''}" data-main="f">Основной — женский</button>
        <button type="button" class="seg-btn${st.main === 'm' ? ' active' : ''}" data-main="m">Основной — мужской</button>
      </div>
      <p class="status">Основной голос читает карточки, слова и чат. Второй — партнёр в диалогах и сценках.</p>
      <div class="chip-row" role="group" aria-label="Фильтр">
        ${[['all', 'Все'], ['f', 'Женские'], ['m', 'Мужские']].map(([id, t]) => `<button type="button" class="chip-btn${genderFilter === id ? ' active' : ''}" data-gf="${id}">${t}</button>`).join('')}
        <button type="button" class="chip-btn" id="vc-reload">Обновить список</button>
      </div>
      <div id="vc-list"><p class="status">Загружаю голоса Google…</p></div>` : '<p class="status">Вставьте ключ — появятся все голоса Google для испанского из Испании, каждый можно прослушать.</p>'}
      <details class="tch-extra"><summary>Как получить ключ Google (5 минут)</summary>
        <ol class="howto">
          <li>Откройте console.cloud.google.com и создайте проект.</li>
          <li>Подключите платёжный аккаунт (Billing): у озвучки и распознавания есть бесплатный месячный лимит.</li>
          <li>В «APIs &amp; Services → Library» включите <b>Cloud Text-to-Speech API</b> и <b>Cloud Speech-to-Text API</b>.</li>
          <li>В «Credentials» создайте API key (начинается с <b>AIza</b>). Ключи из Google AI Studio не подходят.</li>
          <li>Ограничьте ключ: API restrictions — эти два API; Website restrictions — адрес приложения.</li>
        </ol>
      </details>
    </div>
    <div id="vc-device" class="${engine === 'device' ? '' : 'hidden'}">
      <label>Голос телефона
        <select id="vc-dvoice">${deviceVoices.length ? deviceVoices.map((v) => `<option value="${e(v.voiceURI)}"${v.voiceURI === voiceURI ? ' selected' : ''}>${e(v.name)} (${e(v.lang)})</option>`).join('') : '<option value="">(испанские голоса не найдены)</option>'}</select>
      </label>
      <button id="vc-dtest" class="ghost">${icon('play', 'ic ic-sm')} Прослушать</button>
      <p class="status">На iPhone голос можно улучшить: Настройки iOS → Универсальный доступ → Устный контент → Голоса → Испанский (Испания) → скачайте «Mónica (улучшенный)» или другой. После этого выберите его здесь.</p>
    </div>

    <h2>Микрофон</h2>
    <div class="segment seg-inline" role="tablist" aria-label="Распознавание">
      ${[['auto', 'Авто'], ['google', 'Google'], ['device', 'Телефон']].map(([id, t]) => `<button type="button" class="seg-btn${asrEngine === id ? ' active' : ''}" data-asr="${id}">${t}</button>`).join('')}
    </div>
    <p class="status">«Авто»: если есть ключ Google — распознаёт Google (лучше понимает акцент и стабильно работает в приложении на iPhone), иначе — телефон. Для Google включите Cloud Speech-to-Text API.</p>
    <button id="vc-mictest" class="big">${icon('mic', 'ic ic-sm')} Проверить микрофон</button>
    <div id="vc-micres"></div>
    <p id="vc-status" class="status" role="status"></p>`;

  const q = (s) => container.querySelector(s);
  const status = q('#vc-status');
  const rerender = () => render(container);

  container.querySelectorAll('[data-rate]').forEach((b) => {
    b.onclick = async () => {
      await setSetting('voiceRate', b.dataset.rate);
      await initVoice();
      container.querySelectorAll('[data-rate]').forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      speak(sample);
    };
  });
  container.querySelectorAll('[data-engine]').forEach((b) => {
    b.onclick = async () => { await setSetting('ttsEngine', b.dataset.engine); await initVoice(); rerender(); };
  });
  container.querySelectorAll('[data-asr]').forEach((b) => {
    b.onclick = async () => { await setSetting('asrEngine', b.dataset.asr); await initAsr(); rerender(); };
  });
  q('#vc-keysave').onclick = async () => {
    await setSetting('googleTtsKey', q('#vc-key').value.trim());
    await setSetting('googleVoiceList', null);
    await initVoice();
    await initAsr();
    rerender();
  };
  const dtest = q('#vc-dtest');
  if (dtest) {
    dtest.onclick = async () => {
      await setSetting('voiceURI', q('#vc-dvoice').value);
      await initVoice();
      if (window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(sample);
        u.lang = 'es-ES';
        const v = pickBestVoice(speechSynthesis.getVoices(), q('#vc-dvoice').value);
        if (v) u.voice = v;
        u.rate = Number(await getSetting('voiceRate')) || 1;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
      }
    };
    q('#vc-dvoice').onchange = async () => { await setSetting('voiceURI', q('#vc-dvoice').value); await initVoice(); };
  }
  container.querySelectorAll('[data-main]').forEach((b) => {
    b.onclick = async () => { await setSetting('googleVoiceMain', b.dataset.main); await initVoice(); rerender(); };
  });
  container.querySelectorAll('[data-gf]').forEach((b) => { b.onclick = () => { genderFilter = b.dataset.gf; rerender(); }; });
  const sampleEl = q('#vc-sample');
  if (sampleEl) sampleEl.onchange = () => { sample = sampleEl.value.trim() || SAMPLE; };

  q('#vc-mictest').onclick = async () => {
    const box = q('#vc-micres');
    box.innerHTML = '';
    stopSpeaking();
    const t0 = Date.now();
    try {
      const heard = await recognizeOnce('es-ES', { title: 'Скажите любую фразу по-испански' });
      const a = asrStatus();
      box.innerHTML = `<div class="word-card"><div class="gr-ok">${icon('check', 'ic ic-sm')}Микрофон работает</div>
        <div class="study-es" lang="es"><b>${e(heard)}</b></div>
        <div class="muted">Распознал: ${a.last === 'google' ? 'Google' : 'телефон'} · ${((Date.now() - t0) / 1000).toFixed(1)} с</div></div>`;
    } catch (err) {
      box.innerHTML = `<div class="word-card"><div class="gr-bad">${e(err.message)}</div></div>`;
      const a = asrStatus();
      if (a.blocked) setTimeout(rerender, 2500);
    }
  };

  const listEl = q('#vc-list');
  if (!listEl) return;
  const paint = (list) => {
    const s2 = ttsStatus();
    listEl.innerHTML = list.length ? rowsHtml(list, s2) : '<p class="status">Google не вернул голосов для es-ES.</p>';
    listEl.querySelectorAll('[data-play]').forEach((b) => {
      b.onclick = async () => {
        status.textContent = '';
        await speak(sample, 'es-ES', { voice: b.dataset.play });
        const err = ttsLastError();
        if (err) status.textContent = err;
      };
    });
    listEl.querySelectorAll('[data-pick]').forEach((b) => {
      b.onclick = async () => {
        await setSetting(b.dataset.g === 'm' ? 'googleVoiceM' : 'googleVoiceF', b.dataset.pick);
        await initVoice();
        paint(list);
        speak(sample, 'es-ES', { voice: b.dataset.pick });
      };
    });
  };
  const load = async (force) => {
    try {
      paint(await loadVoices(force));
    } catch (err) {
      if (listEl.isConnected) listEl.innerHTML = `<p class="gr-bad">${e(err.message)}</p>`;
    }
  };
  q('#vc-reload').onclick = () => { listEl.innerHTML = '<p class="status">Загружаю…</p>'; load(true); };
  load(false);
}

registerFeature({ id: 'voice', title: 'Голос и микрофон', icon: '🔊', order: 91, render });
