import { registerFeature } from './app.js';
import { getSetting, setSetting } from './db.js';
import { testConnection, DEFAULT_MODEL } from './claude.js';

async function render(container) {
  const apiKey = (await getSetting('apiKey')) || '';
  const model = (await getSetting('model')) || DEFAULT_MODEL;
  const level = (await getSetting('level')) || 'A2-B1';

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
    <p id="set-status" class="status"></p>
  `;
  container.querySelector('#set-model').value = model;
  container.querySelector('#set-level').value = level;
  container.querySelector('#set-key').value = apiKey;

  const status = container.querySelector('#set-status');

  container.querySelector('#set-save').onclick = async () => {
    await setSetting('apiKey', container.querySelector('#set-key').value.trim());
    await setSetting('model', container.querySelector('#set-model').value);
    await setSetting('level', container.querySelector('#set-level').value);
    status.textContent = 'Сохранено.';
  };

  container.querySelector('#set-test').onclick = async () => {
    status.textContent = 'Проверяю…';
    await setSetting('apiKey', container.querySelector('#set-key').value.trim());
    const result = await testConnection();
    status.textContent = result.message;
  };
}

registerFeature({ id: 'settings', title: 'Настройки', icon: '⚙️', order: 90, render });
