import { registerFeature } from './app.js';
import { getSetting, setSetting } from './db.js';
import { testConnection, DEFAULT_MODEL } from './claude.js';
import { syncNow } from './sync.js';
import { getMemory, saveMemory } from './profile.js';
import { getVoicesAsync, listEsVoices, initVoice, speak } from './tts.js';
import { escapeHtml } from './util.js';

async function render(container) {
  const apiKey = (await getSetting('apiKey')) || '';
  const model = (await getSetting('model')) || DEFAULT_MODEL;
  const level = (await getSetting('level')) || 'A2-B1';
  const supabaseUrl = (await getSetting('supabaseUrl')) || '';
  const supabaseKey = (await getSetting('supabaseKey')) || '';
  const syncCode = (await getSetting('syncCode')) || '';
  const memory = (await getMemory()).join('\n');
  const voices = await getVoicesAsync();
  const esVoices = listEsVoices(voices);
  const voiceURI = (await getSetting('voiceURI')) || '';
  const voiceRate = String((await getSetting('voiceRate')) || '1');

  container.innerHTML = `
    <h1>Настройки</h1>
    <label>API-ключ Claude
      <input id="set-key" type="password" placeholder="sk-ant-...">
    </label>
    <label>Модель
      <select id="set-model">
        <option value="claude-haiku-4-5">claude-haiku-4-5 (быстрая, дешёвая)</option>
        <option value="claude-sonnet-4-6">claude-sonnet-4-6 (для диалогов)</option>
      </select>
    </label>
    <label>Уровень
      <select id="set-level">
        <option value="A0-A1">A0–A1</option>
        <option value="A2-B1">A2–B1</option>
        <option value="B2+">B2+</option>
      </select>
    </label>
    <button id="set-save">Сохранить</button>
    <button id="set-test">Проверить связь</button>
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
    <h2>Память наставника</h2>
    <label>Что наставник о тебе знает (по факту в строке)
      <textarea id="set-memory" rows="6" placeholder="напр. Зовут Ник&#10;Друзья: Иван, Аня&#10;Цель: разговорный для жизни в Бенидорме"></textarea>
    </label>
    <button id="set-memclear" class="danger">Очистить память</button>
    <h2>Голос озвучки</h2>
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
    <button id="set-voicetest">▶︎ Проверить голос</button>
    <p class="status">Совет: на iPhone скачай «улучшенный» испанский голос в Настройках iOS → Универсальный доступ → Устный контент → Голоса → Испанский.</p>
    <p id="set-status" class="status"></p>
  `;
  container.querySelector('#set-model').value = model;
  container.querySelector('#set-level').value = level;
  container.querySelector('#set-key').value = apiKey;
  container.querySelector('#set-surl').value = supabaseUrl;
  container.querySelector('#set-skey').value = supabaseKey;
  container.querySelector('#set-scode').value = syncCode;
  container.querySelector('#set-memory').value = memory;
  container.querySelector('#set-voice').value = voiceURI;
  container.querySelector('#set-rate').value = voiceRate;

  const status = container.querySelector('#set-status');

  container.querySelector('#set-save').onclick = async () => {
    await setSetting('apiKey', container.querySelector('#set-key').value.trim());
    await setSetting('model', container.querySelector('#set-model').value);
    await setSetting('level', container.querySelector('#set-level').value);
    await setSetting('supabaseUrl', container.querySelector('#set-surl').value.trim().replace(/\/+$/, ''));
    await setSetting('supabaseKey', container.querySelector('#set-skey').value.trim());
    await setSetting('syncCode', container.querySelector('#set-scode').value.trim());
    await saveMemory(container.querySelector('#set-memory').value.split('\n').map((s) => s.trim()).filter(Boolean));
    await setSetting('voiceURI', container.querySelector('#set-voice').value);
    await setSetting('voiceRate', container.querySelector('#set-rate').value);
    await initVoice();
    status.textContent = 'Сохранено.';
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

  container.querySelector('#set-memclear').onclick = async () => {
    await saveMemory([]);
    container.querySelector('#set-memory').value = '';
    status.textContent = 'Память наставника очищена.';
  };

  container.querySelector('#set-voicetest').onclick = async () => {
    await setSetting('voiceURI', container.querySelector('#set-voice').value);
    await setSetting('voiceRate', container.querySelector('#set-rate').value);
    await initVoice();
    speak('Hola, soy tu profesor de español. Vamos a practicar la pronunciación.');
  };
}

registerFeature({ id: 'settings', title: 'Настройки', icon: '⚙️', order: 90, render });
