import { registerFeature } from './app.js';
import { getSetting, setSetting } from './db.js';
import { testConnection, DEFAULT_MODEL, DEFAULT_CHAT_MODEL, MODELS, resolveModel } from './claude.js';
import { downloadReminder, refreshBadge } from './reminders.js';
import { DEFAULT_LIMITS } from './queue.js';
import { syncNow, localSnapshot, applySnapshot } from './sync.js';
import { mergeSnapshots } from './merge.js';
import { getMemory, saveMemory } from './profile.js';
import { getVoicesAsync, listEsVoices, initVoice, speak, GOOGLE_VOICES, ttsLastError } from './tts.js';
import { escapeHtml } from './util.js';

async function render(container) {
  const apiKey = (await getSetting('apiKey')) || '';
  const model = resolveModel(await getSetting('model'), DEFAULT_MODEL);
  const chatModel = resolveModel(await getSetting('chatModel'), DEFAULT_CHAT_MODEL);
  const cardMode = (await getSetting('cardMode')) || 'mixed';
  const maxNew = String((await getSetting('maxNew')) || DEFAULT_LIMITS.maxNew);
  const maxReviews = String((await getSetting('maxReviews')) || DEFAULT_LIMITS.maxReviews);
  const remindTime = (await getSetting('remindTime')) || '19:00';
  const badge = (await getSetting('badge')) !== false;
  const rpAutoSpeak = (await getSetting('rpAutoSpeak')) !== false;
  const modelOptions = (current) => {
    const list = MODELS.some((m) => m.id === current) ? MODELS : [...MODELS, { id: current, label: `${current} (текущая)` }];
    return list.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.label)}</option>`).join('');
  };
  const level = (await getSetting('level')) || 'A2-B1';
  const supabaseUrl = (await getSetting('supabaseUrl')) || '';
  const supabaseKey = (await getSetting('supabaseKey')) || '';
  const syncCode = (await getSetting('syncCode')) || '';
  const memory = (await getMemory()).join('\n');
  const voices = await getVoicesAsync();
  const esVoices = listEsVoices(voices);
  const voiceURI = (await getSetting('voiceURI')) || '';
  const voiceRate = String((await getSetting('voiceRate')) || '1');
  const ttsEngine = (await getSetting('ttsEngine')) || 'google';
  const googleKey = (await getSetting('googleTtsKey')) || '';
  const voiceF = (await getSetting('googleVoiceF')) || 'Kore';
  const voiceM = (await getSetting('googleVoiceM')) || 'Charon';
  const voiceMain = (await getSetting('googleVoiceMain')) || 'f';
  const gOptions = (g) => GOOGLE_VOICES.filter((v) => v.gender === g).map((v) => `<option value="${escapeHtml(v.id)}">${escapeHtml(v.label)}</option>`).join('');

  container.innerHTML = `
    <h1>Настройки</h1>
    <label>API-ключ Claude
      <input id="set-key" type="password" placeholder="sk-ant-...">
    </label>
    <label>Модель для быстрых задач (словарь, проверки, диалоги)
      <select id="set-model">${modelOptions(model)}</select>
    </label>
    <label>Модель для разговора (наставник, сценки, уроки)
      <select id="set-chatmodel">${modelOptions(chatModel)}</select>
    </label>
    <label>Уровень
      <select id="set-level">
        <option value="A0-A1">A0–A1</option>
        <option value="A2-B1">A2–B1</option>
        <option value="B2+">B2+</option>
      </select>
    </label>
    <h2>Повторение</h2>
    <label>Карточки
      <select id="set-cardmode">
        <option value="mixed">Разные типы: на слух, ввод, пропуск, вслух</option>
        <option value="classic">Только классические (слово → перевод)</option>
      </select>
    </label>
    <label>Новых карточек в день
      <select id="set-maxnew">
        <option value="5">5</option><option value="10">10</option><option value="15">15</option><option value="20">20</option><option value="30">30</option>
      </select>
    </label>
    <label>Повторений в день (максимум)
      <select id="set-maxrev">
        <option value="30">30</option><option value="50">50</option><option value="100">100</option><option value="200">200</option>
      </select>
    </label>
    <label class="check-row"><input id="set-rpspeak" type="checkbox"> Сценки: сразу озвучивать реплики персонажа</label>
    <button id="set-save">Сохранить</button>
    <button id="set-test">Проверить связь</button>
    <h2>Напоминание</h2>
    <label>Время ежедневного напоминания
      <input id="set-remind" type="time">
    </label>
    <button id="set-ics">📅 Добавить в календарь</button>
    <p class="status">Скачается файл события — открой его, и календарь будет каждый день напоминать о занятии (на iPhone: «Добавить все»).</p>
    <label class="check-row"><input id="set-badge" type="checkbox"> Число карточек на иконке приложения</label>
    <h2>Синхронизация (между устройствами)</h2>
    <label>Supabase URL
      <input id="set-surl" type="text" placeholder="https://xxxx.supabase.co">
    </label>
    <label>Supabase anon-ключ
      <input id="set-skey" type="password">
    </label>
    <label>Код синхронизации (одинаковый на всех устройствах)
      <input id="set-scode" type="text">
    </label>
    <button id="set-sync">Синхронизировать сейчас</button>
    <h2>Резервная копия</h2>
    <p class="status">Все слова, ошибки, уроки и история в одном файле (без ключей). Сохрани его в «Файлы» или iCloud — восстановление не стирает текущие данные, а объединяет их с копией.</p>
    <div class="word-actions">
      <button id="set-backup">⬇︎ Скачать копию</button>
      <button id="set-restore">⬆︎ Восстановить из файла</button>
      <input id="set-restore-file" type="file" accept="application/json,.json" hidden>
    </div>
    <p id="set-backupstatus" class="status"></p>
    <h2>Память наставника</h2>
    <label>Что наставник о тебе знает (по факту в строке)
      <textarea id="set-memory" rows="6" placeholder="напр. Зовут Ник&#10;Друзья: Иван, Аня&#10;Цель: разговорный для жизни в Бенидорме"></textarea>
    </label>
    <button id="set-memclear" class="danger">Очистить память</button>
    <h2>Голос озвучки</h2>
    <label>Озвучка
      <select id="set-engine">
        <option value="google">Google Chirp 3 HD — живой испанский из Испании</option>
        <option value="device">Голос телефона</option>
      </select>
    </label>
    <div id="set-google">
      <label>API-ключ Google Cloud
        <input id="set-gkey" type="password" placeholder="AIza…" autocomplete="off">
      </label>
      <label>Женский голос
        <select id="set-vf">${gOptions('f')}</select>
      </label>
      <label>Мужской голос
        <select id="set-vm">${gOptions('m')}</select>
      </label>
      <label>Основной голос (карточки, слова, чат)
        <select id="set-vmain">
          <option value="f">Женский</option>
          <option value="m">Мужской</option>
        </select>
      </label>
      <div class="word-actions">
        <button id="set-voicesave" class="primary">Сохранить голос</button>
        <button id="set-test-f">▶︎ Женский</button>
        <button id="set-test-m">▶︎ Мужской</button>
      </div>
      <p id="set-voicestatus" class="status"></p>
      <details class="tch-extra"><summary>Как получить ключ Google (5 минут)</summary>
        <ol class="howto">
          <li>Откройте console.cloud.google.com и создайте проект.</li>
          <li>Подключите платёжный аккаунт (Billing). Первый миллион символов в месяц для голосов Chirp 3 HD бесплатный, это очень много.</li>
          <li>В «APIs &amp; Services → Library» найдите <b>Cloud Text-to-Speech API</b> и нажмите Enable.</li>
          <li>В «APIs &amp; Services → Credentials» нажмите Create credentials → API key. Ключ должен начинаться с <b>AIza</b>. Ключи из Google AI Studio (для Gemini) для озвучки не подходят.</li>
          <li>Ограничьте ключ: API restrictions → только Cloud Text-to-Speech API; Website restrictions → адрес вашего приложения.</li>
          <li>Вставьте ключ сюда и нажмите «Сохранить».</li>
        </ol>
        <p class="status">В диалогах и сценках персонажи говорят разными голосами. Озвученные фразы сохраняются на телефоне: повтор не тратит лимит и работает без интернета.</p>
      </details>
    </div>
    <h2>Голос телефона</h2>
    <p class="status">Используется, если выбран «Голос телефона», нет ключа Google или нет интернета.</p>
    <label>Испанский голос
      <select id="set-voice">${esVoices.length
        ? esVoices.map((v) => `<option value="${escapeHtml(v.voiceURI)}">${escapeHtml(v.name)} (${escapeHtml(v.lang)})</option>`).join('')
        : '<option value="">(испанские голоса не найдены)</option>'}</select>
    </label>
    <label>Скорость
      <select id="set-rate">
        <option value="1">Обычная</option>
        <option value="0.9">Чётче (чуть медленнее)</option>
        <option value="0.8">Медленно</option>
      </select>
    </label>
    <button id="set-voicetest">▶︎ Проверить голос телефона</button>
    <p class="status">Совет: на iPhone скачай «улучшенный» испанский голос в Настройках iOS → Универсальный доступ → Устный контент → Голоса → Испанский.</p>
    <p id="set-status" class="status"></p>
  `;
  container.querySelector('#set-model').value = model;
  container.querySelector('#set-chatmodel').value = chatModel;
  container.querySelector('#set-cardmode').value = cardMode;
  container.querySelector('#set-maxnew').value = maxNew;
  container.querySelector('#set-maxrev').value = maxReviews;
  container.querySelector('#set-remind').value = remindTime;
  container.querySelector('#set-badge').checked = badge;
  container.querySelector('#set-rpspeak').checked = rpAutoSpeak;
  container.querySelector('#set-level').value = level;
  container.querySelector('#set-key').value = apiKey;
  container.querySelector('#set-surl').value = supabaseUrl;
  container.querySelector('#set-skey').value = supabaseKey;
  container.querySelector('#set-scode').value = syncCode;
  container.querySelector('#set-memory').value = memory;
  container.querySelector('#set-voice').value = voiceURI;
  container.querySelector('#set-engine').value = ttsEngine;
  container.querySelector('#set-gkey').value = googleKey;
  container.querySelector('#set-vf').value = voiceF;
  container.querySelector('#set-vm').value = voiceM;
  container.querySelector('#set-vmain').value = voiceMain;
  const syncEngine = () => container.querySelector('#set-google').classList.toggle('hidden', container.querySelector('#set-engine').value !== 'google');
  container.querySelector('#set-engine').onchange = syncEngine;
  syncEngine();
  container.querySelector('#set-rate').value = voiceRate;

  const status = container.querySelector('#set-status');

  container.querySelector('#set-save').onclick = async () => {
    await setSetting('apiKey', container.querySelector('#set-key').value.trim());
    await setSetting('model', container.querySelector('#set-model').value);
    await setSetting('chatModel', container.querySelector('#set-chatmodel').value);
    await setSetting('cardMode', container.querySelector('#set-cardmode').value);
    await setSetting('maxNew', Number(container.querySelector('#set-maxnew').value));
    await setSetting('maxReviews', Number(container.querySelector('#set-maxrev').value));
    await setSetting('remindTime', container.querySelector('#set-remind').value || '19:00');
    await setSetting('badge', container.querySelector('#set-badge').checked);
    await setSetting('rpAutoSpeak', container.querySelector('#set-rpspeak').checked);
    refreshBadge();
    await setSetting('level', container.querySelector('#set-level').value);
    await setSetting('supabaseUrl', container.querySelector('#set-surl').value.trim().replace(/\/+$/, ''));
    await setSetting('supabaseKey', container.querySelector('#set-skey').value.trim());
    await setSetting('syncCode', container.querySelector('#set-scode').value.trim());
    await saveMemory(container.querySelector('#set-memory').value.split('\n').map((s) => s.trim()).filter(Boolean));
    await saveVoice();
    status.textContent = 'Сохранено.';
  };

  container.querySelector('#set-ics').onclick = async () => {
    const t = container.querySelector('#set-remind').value || '19:00';
    await setSetting('remindTime', t);
    downloadReminder(t);
    status.textContent = `Файл напоминания на ${t} скачан — открой его, чтобы добавить в календарь.`;
  };

  container.querySelector('#set-test').onclick = async () => {
    status.textContent = 'Проверяю…';
    await setSetting('apiKey', container.querySelector('#set-key').value.trim());
    const result = await testConnection();
    status.textContent = result.message;
  };

  container.querySelector('#set-sync').onclick = async () => {
    await setSetting('supabaseUrl', container.querySelector('#set-surl').value.trim().replace(/\/+$/, ''));
    await setSetting('supabaseKey', container.querySelector('#set-skey').value.trim());
    await setSetting('syncCode', container.querySelector('#set-scode').value.trim());
    status.textContent = 'Синхронизирую…';
    try {
      await syncNow();
      status.textContent = 'Готово — данные синхронизированы.';
    } catch (e) {
      status.textContent = e.message;
    }
  };

  const bstatus = container.querySelector('#set-backupstatus');
  const wordsN = (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'слово' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'слова' : 'слов'}`;
  container.querySelector('#set-backup').onclick = async () => {
    const snap = await localSnapshot();
    const blob = new Blob([JSON.stringify({ app: 'espanol-benidorm', version: 1, createdAt: Date.now(), ...snap })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `espanol-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    bstatus.textContent = `Копия скачана: ${wordsN(snap.words.length)}.`;
  };
  const fileInput = container.querySelector('#set-restore-file');
  container.querySelector('#set-restore').onclick = () => fileInput.click();
  fileInput.onchange = async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.words) || typeof data.settings !== 'object') throw new Error('Это не файл копии Español Benidorm.');
      const merged = mergeSnapshots(await localSnapshot(), { words: data.words, mistakes: data.mistakes || [], settings: data.settings || {} });
      await applySnapshot(merged);
      bstatus.textContent = `Восстановлено: в словаре ${wordsN(merged.words.length)}.`;
    } catch (e) {
      bstatus.textContent = e instanceof SyntaxError ? 'Файл повреждён или это не JSON.' : e.message;
    }
    fileInput.value = '';
  };

  container.querySelector('#set-memclear').onclick = async () => {
    await saveMemory([]);
    container.querySelector('#set-memory').value = '';
    status.textContent = 'Память наставника очищена.';
  };

  async function saveVoice() {
    await setSetting('voiceURI', container.querySelector('#set-voice').value);
    await setSetting('voiceRate', container.querySelector('#set-rate').value);
    await setSetting('ttsEngine', container.querySelector('#set-engine').value);
    await setSetting('googleTtsKey', container.querySelector('#set-gkey').value.trim());
    await setSetting('googleVoiceF', container.querySelector('#set-vf').value);
    await setSetting('googleVoiceM', container.querySelector('#set-vm').value);
    await setSetting('googleVoiceMain', container.querySelector('#set-vmain').value);
    await initVoice();
  }

  const vstatus = container.querySelector('#set-voicestatus');
  async function testVoice(gender, text) {
    await saveVoice();
    vstatus.textContent = 'Воспроизвожу…';
    await speak(text, 'es-ES', { gender });
    const err = ttsLastError();
    vstatus.textContent = err ? `${err} Прозвучал голос телефона.` : '';
  }

  container.querySelector('#set-voicesave').onclick = async () => {
    await saveVoice();
    vstatus.textContent = 'Голос сохранён.';
  };

  container.querySelector('#set-test-f').onclick = () => testVoice('f', '¡Hola! ¿Qué tal? Soy de Benidorm. Vale, vamos a practicar un poquito, ¿te parece?');
  container.querySelector('#set-test-m').onclick = () => testVoice('m', '¡Buenas! ¿Qué te pongo? Hoy tenemos un arroz a banda buenísimo, tío.');

  container.querySelector('#set-voicetest').onclick = async () => {
    await saveVoice();
    status.textContent = 'Воспроизвожу…';
    if (window.speechSynthesis) {
      const { pickBestVoice } = await import('./tts.js');
      const u = new SpeechSynthesisUtterance('Hola, soy tu profesor de español. Vamos a practicar la pronunciación.');
      u.lang = 'es-ES';
      const v = pickBestVoice(speechSynthesis.getVoices(), container.querySelector('#set-voice').value);
      if (v) u.voice = v;
      u.rate = Number(container.querySelector('#set-rate').value) || 1;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }
    status.textContent = '';
  };
}

registerFeature({ id: 'settings', title: 'Настройки', icon: '⚙️', order: 90, render });
