# Español Benidorm — План 1: Фундамент (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать устанавливаемый на iPhone PWA-каркас с хранилищем (IndexedDB), экраном Настроек (ввод/сохранение API-ключа) и рабочим клиентом Claude API, проверяющим связь.

**Architecture:** Чистый клиентский PWA из статичных файлов, без сборки. Нативные ES-модули в браузере; те же модули с чистыми функциями импортируются в Node для тестов. Экраны и навигация строятся из реестра модулей (`registerFeature`). Хранилище — IndexedDB с версионированной схемой. Claude API вызывается напрямую из браузера ключом пользователя.

**Tech Stack:** HTML/CSS/JS (ES-модули, без бандлера), IndexedDB, Service Worker, Web App Manifest, Claude Messages API, Node 20 `node --test` для юнит-тестов.

## Global Constraints

- Интерфейс приложения — на русском языке.
- Без шага сборки: только нативные ES-модули, загружаемые через `<script type="module">`.
- Без бэкенда: API-ключ хранится только на устройстве (IndexedDB), никогда не коммитится.
- Claude API: endpoint `https://api.anthropic.com/v1/messages`; заголовки `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`.
- Модель по умолчанию: `claude-haiku-4-5`. Опция диалогов: `claude-sonnet-4-6`.
- Тесты пишутся для чистых функций и запускаются `node --test`. Браузерные/AI части проверяются ручным чек-листом.
- Каждый модуль — отдельный файл с одной задачей; экраны регистрируются через реестр, не правя ядро (требование расширяемости §9 спецификации).
- Рабочая директория проекта: `/Users/nik/Downloads/EspanolBenidorm` (git-репозиторий уже инициализирован).

---

## File Structure (этот план)

- `index.html` — оболочка приложения, мета-теги iOS, контейнеры, подключение модулей
- `manifest.webmanifest` — манифест PWA
- `sw.js` — service worker (кэш оболочки для офлайна)
- `css/styles.css` — базовые мобильные стили + нижняя навигация
- `js/lang.js` — чистая утилита определения языка ввода (RU/ES) — **юнит-тест**
- `js/db.js` — обёртка IndexedDB: версии/миграции, settings, words, экспорт/импорт
- `js/prompts.js` — базовый системный промпт (диалект Бенидорма)
- `js/claude.js` — клиент Claude API: `callClaude`, `testConnection`
- `js/app.js` — реестр модулей `registerFeature`, hash-роутер, рендер навигации
- `js/settings.js` — экран Настроек (ключ, модель, уровень), регистрируется в реестре
- `test/lang.test.js` — тесты для `js/lang.js`
- `icons/icon-192.png`, `icons/icon-512.png` — иконки PWA

---

## Task 1: Утилита определения языка (`js/lang.js`)

Начинаем с чистой, легко тестируемой логики, которая понадобится словарю.

**Files:**
- Create: `js/lang.js`
- Test: `test/lang.test.js`

**Interfaces:**
- Produces: `detectLang(text: string): 'ru' | 'es'` — `'ru'` если в строке есть кириллица, иначе `'es'`. Пустая/нерелевантная строка → `'es'`.

- [ ] **Step 1: Написать падающий тест**

`test/lang.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectLang } from '../js/lang.js';

test('кириллица → ru', () => {
  assert.equal(detectLang('привет'), 'ru');
  assert.equal(detectLang('дом большой'), 'ru');
});

test('латиница → es', () => {
  assert.equal(detectLang('hola'), 'es');
  assert.equal(detectLang('la casa'), 'es');
});

test('смешанное с кириллицей → ru', () => {
  assert.equal(detectLang('casa дом'), 'ru');
});

test('пустая строка → es', () => {
  assert.equal(detectLang(''), 'es');
  assert.equal(detectLang('   '), 'es');
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `node --test test/lang.test.js`
Expected: FAIL — `Cannot find module '../js/lang.js'` (модуля ещё нет).

- [ ] **Step 3: Реализовать `js/lang.js`**

```js
// Определение языка ввода по наличию кириллицы.
const CYRILLIC = /[Ѐ-ӿ]/;

export function detectLang(text) {
  if (text && CYRILLIC.test(text)) return 'ru';
  return 'es';
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `node --test test/lang.test.js`
Expected: PASS — 4 теста зелёные.

- [ ] **Step 5: Commit**

```bash
git add js/lang.js test/lang.test.js
git commit -m "feat: language detection util with tests"
```

---

## Task 2: Слой данных (`js/db.js`)

Обёртка IndexedDB с версионированной схемой, доступом к настройкам и словам, экспорт/импорт (точка расширения §9).

**Files:**
- Create: `js/db.js`

**Interfaces:**
- Produces:
  - `openDB(): Promise<IDBDatabase>` — открывает/мигрирует БД `espanol`, версия `1`.
  - `getSetting(key: string): Promise<any>` — значение из стора `settings` или `undefined`.
  - `setSetting(key: string, value: any): Promise<void>`.
  - `putWord(word: object): Promise<number>` — добавить/обновить слово, возвращает id.
  - `getAllWords(): Promise<object[]>`.
  - `exportAll(): Promise<object>` — `{ settings: {...}, words: [...] }`.
  - `importAll(data: object): Promise<void>`.
  - Сторы версии 1: `settings` (keyPath `key`), `words` (keyPath `id`, autoIncrement).

- [ ] **Step 1: Реализовать `js/db.js`**

```js
// Обёртка IndexedDB с версионированной схемой и миграциями.
const DB_NAME = 'espanol';
const DB_VERSION = 1;

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      // Миграции по возрастанию версии. Новые версии добавляют свои блоки.
      if (e.oldVersion < 1) {
        db.createObjectStore('settings', { keyPath: 'key' });
        db.createObjectStore('words', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store);
}

function asPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getSetting(key) {
  const db = await openDB();
  const row = await asPromise(tx(db, 'settings', 'readonly').get(key));
  return row ? row.value : undefined;
}

export async function setSetting(key, value) {
  const db = await openDB();
  await asPromise(tx(db, 'settings', 'readwrite').put({ key, value }));
}

export async function putWord(word) {
  const db = await openDB();
  return asPromise(tx(db, 'words', 'readwrite').put(word));
}

export async function getAllWords() {
  const db = await openDB();
  return asPromise(tx(db, 'words', 'readonly').getAll());
}

export async function exportAll() {
  const db = await openDB();
  const words = await asPromise(tx(db, 'words', 'readonly').getAll());
  const settingsRows = await asPromise(tx(db, 'settings', 'readonly').getAll());
  const settings = {};
  for (const row of settingsRows) settings[row.key] = row.value;
  return { settings, words };
}

export async function importAll(data) {
  const db = await openDB();
  for (const [key, value] of Object.entries(data.settings || {})) {
    await asPromise(tx(db, 'settings', 'readwrite').put({ key, value }));
  }
  for (const word of data.words || []) {
    await asPromise(tx(db, 'words', 'readwrite').put(word));
  }
}
```

- [ ] **Step 2: Проверка вручную (браузер)**

Этот модуль зависит от IndexedDB и проверяется в браузере на Task 8 (после запуска приложения). Здесь только коммит — поведение покрыто ручным чек-листом в конце плана.

- [ ] **Step 3: Commit**

```bash
git add js/db.js
git commit -m "feat: IndexedDB data layer (settings, words, export/import)"
```

---

## Task 3: Базовые промпты (`js/prompts.js`)

**Files:**
- Create: `js/prompts.js`

**Interfaces:**
- Produces: `DIALECT_SYSTEM: string` — системный промпт с акцентом на диалект Бенидорма/Валенсии и уровень A2–B1.

- [ ] **Step 1: Реализовать `js/prompts.js`**

```js
// Системные промпты. Новые AI-сценарии добавляют свои строки здесь (§9).
export const DIALECT_SYSTEM = `Ты — преподаватель испанского для русскоязычного ученика уровня A2–B1.
Ученик живёт в Валенсийском сообществе рядом с Бенидормом (провинция Аликанте).
База — стандартный кастильский испанский, но всегда подсвечивай местные
валенсийские/аликантийские словечки и выражения, которые реально используют в
районе Бенидорма, и помечай отличия от стандарта. Объяснения давай по-русски,
примеры — на испанском. Будь кратким и практичным.`;
```

- [ ] **Step 2: Commit**

```bash
git add js/prompts.js
git commit -m "feat: base dialect system prompt"
```

---

## Task 4: Клиент Claude API (`js/claude.js`)

**Files:**
- Create: `js/claude.js`

**Interfaces:**
- Consumes: `getSetting` из `js/db.js`.
- Produces:
  - `callClaude({ system, messages, model, maxTokens }): Promise<string>` — возвращает текст первого text-блока ответа. Бросает понятную ошибку, если нет ключа или API вернул ошибку.
  - `testConnection(): Promise<{ ok: boolean, message: string }>`.
  - `DEFAULT_MODEL = 'claude-haiku-4-5'`.

- [ ] **Step 1: Реализовать `js/claude.js`**

```js
import { getSetting } from './db.js';

export const DEFAULT_MODEL = 'claude-haiku-4-5';
const API_URL = 'https://api.anthropic.com/v1/messages';

export async function callClaude({ system, messages, model, maxTokens = 1024 }) {
  const apiKey = await getSetting('apiKey');
  if (!apiKey) {
    throw new Error('Не задан API-ключ. Откройте Настройки и вставьте ключ.');
  }
  const chosenModel = model || (await getSetting('model')) || DEFAULT_MODEL;

  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: chosenModel,
        max_tokens: maxTokens,
        system,
        messages,
      }),
    });
  } catch (e) {
    throw new Error('Нет сети. AI-функции недоступны офлайн.');
  }

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error?.message || ''; } catch {}
    if (res.status === 401) throw new Error('Неверный API-ключ. Проверьте Настройки.');
    if (res.status === 429) throw new Error('Превышен лимит запросов. Попробуйте позже.');
    throw new Error(`Ошибка API (${res.status}). ${detail}`);
  }

  const data = await res.json();
  const block = (data.content || []).find((b) => b.type === 'text');
  return block ? block.text : '';
}

export async function testConnection() {
  try {
    const text = await callClaude({
      messages: [{ role: 'user', content: 'Responde solo con la palabra: OK' }],
      maxTokens: 16,
    });
    return { ok: true, message: `Связь есть. Ответ: ${text.trim()}` };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/claude.js
git commit -m "feat: Claude API client with connection test"
```

---

## Task 5: Реестр модулей и роутер (`js/app.js`)

Ядро расширяемости: экраны регистрируются, навигация и роутинг строятся автоматически.

**Files:**
- Create: `js/app.js`

**Interfaces:**
- Produces:
  - `registerFeature({ id, title, icon, order, render })` — `render(container: HTMLElement)` рисует экран.
  - `startApp()` — строит нижнюю навигацию из зарегистрированных модулей (по `order`), включает hash-роутинг (`#<id>`), рендерит активный экран в `#screen`. По умолчанию открывает модуль с наименьшим `order`.

- [ ] **Step 1: Реализовать `js/app.js`**

```js
// Реестр экранов + hash-роутер. Новые блоки регистрируются, ядро не меняется (§9).
const features = [];

export function registerFeature(feature) {
  features.push(feature);
}

function sorted() {
  return [...features].sort((a, b) => a.order - b.order);
}

function renderNav(activeId) {
  const nav = document.getElementById('nav');
  nav.innerHTML = '';
  for (const f of sorted()) {
    const btn = document.createElement('a');
    btn.className = 'nav-btn' + (f.id === activeId ? ' active' : '');
    btn.href = `#${f.id}`;
    btn.innerHTML = `<span class="nav-icon">${f.icon}</span><span class="nav-label">${f.title}</span>`;
    nav.appendChild(btn);
  }
}

async function renderRoute() {
  const list = sorted();
  if (list.length === 0) return;
  const id = location.hash.slice(1) || list[0].id;
  const feature = list.find((f) => f.id === id) || list[0];
  renderNav(feature.id);
  const screen = document.getElementById('screen');
  screen.innerHTML = '';
  await feature.render(screen);
}

export function startApp() {
  window.addEventListener('hashchange', renderRoute);
  renderRoute();
}
```

- [ ] **Step 2: Commit**

```bash
git add js/app.js
git commit -m "feat: feature registry and hash router"
```

---

## Task 6: Экран Настроек (`js/settings.js`)

**Files:**
- Create: `js/settings.js`

**Interfaces:**
- Consumes: `registerFeature` (app.js), `getSetting`/`setSetting` (db.js), `testConnection` (claude.js), `DEFAULT_MODEL` (claude.js).
- Produces: регистрирует модуль `settings` (`order: 90`). Поля: API-ключ (password), модель (select: `claude-haiku-4-5`, `claude-sonnet-4-6`), уровень (select A2–B1 по умолчанию), кнопка «Проверить связь», статус.

- [ ] **Step 1: Реализовать `js/settings.js`**

```js
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
      <input id="set-key" type="password" placeholder="sk-ant-..." value="${apiKey}">
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
```

- [ ] **Step 2: Commit**

```bash
git add js/settings.js
git commit -m "feat: settings screen (api key, model, level, connection test)"
```

---

## Task 7: Оболочка, манифест, стили, иконки

**Files:**
- Create: `index.html`, `manifest.webmanifest`, `css/styles.css`, `icons/icon-192.png`, `icons/icon-512.png`

**Interfaces:**
- Consumes: `startApp` (app.js); подключает `js/settings.js` (регистрирует экран).

- [ ] **Step 1: Создать иконки**

Run (создаёт простые иконки-заглушки без внешних зависимостей):
```bash
mkdir -p icons && node -e '
const fs=require("fs");
// 1x1 синий PNG, отмасштабируется системой; заменим позже на дизайн.
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC","base64");
fs.writeFileSync("icons/icon-192.png",png);
fs.writeFileSync("icons/icon-512.png",png);
console.log("icons written");
'
```
Expected: `icons written`. (Заметка: заменить на нормальные иконки 192/512 в финале проекта.)

- [ ] **Step 2: Создать `manifest.webmanifest`**

```json
{
  "name": "Español Benidorm",
  "short_name": "Español",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#0f172a",
  "lang": "ru",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 3: Создать `css/styles.css`**

```css
:root { --bg:#0f172a; --card:#1e293b; --fg:#e2e8f0; --accent:#22c55e; --muted:#94a3b8; }
* { box-sizing: border-box; }
body { margin:0; font-family:-apple-system,system-ui,sans-serif; background:var(--bg); color:var(--fg); }
#screen { padding:16px 16px 88px; max-width:680px; margin:0 auto; }
h1 { font-size:22px; margin:8px 0 16px; }
label { display:block; margin:12px 0; color:var(--muted); font-size:14px; }
input, select { width:100%; padding:12px; margin-top:6px; border-radius:10px; border:1px solid #334155;
  background:var(--card); color:var(--fg); font-size:16px; }
button { margin:8px 8px 0 0; padding:12px 16px; border:none; border-radius:10px;
  background:var(--accent); color:#06210f; font-size:16px; font-weight:600; }
.status { margin-top:12px; color:var(--muted); }
#nav { position:fixed; bottom:0; left:0; right:0; display:flex; justify-content:space-around;
  background:var(--card); border-top:1px solid #334155; padding:6px 0; }
.nav-btn { flex:1; text-align:center; text-decoration:none; color:var(--muted); font-size:11px; padding:4px; }
.nav-btn.active { color:var(--accent); }
.nav-icon { display:block; font-size:20px; }
```

- [ ] **Step 4: Создать `index.html`**

```html
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Español">
  <meta name="theme-color" content="#0f172a">
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="apple-touch-icon" href="icons/icon-192.png">
  <link rel="stylesheet" href="css/styles.css">
  <title>Español Benidorm</title>
</head>
<body>
  <main id="screen"></main>
  <nav id="nav"></nav>
  <script type="module">
    import { startApp } from './js/app.js';
    import './js/settings.js';
    startApp();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  </script>
</body>
</html>
```

- [ ] **Step 5: Создать `sw.js`**

```js
// Service worker: кэш оболочки для офлайна. Версию бампать при изменении файлов.
const CACHE = 'espanol-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/app.js', './js/db.js', './js/claude.js', './js/prompts.js',
  './js/lang.js', './js/settings.js',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // К API всегда сеть, его не кэшируем.
  if (url.hostname.endsWith('anthropic.com')) return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
```

- [ ] **Step 6: Commit**

```bash
git add index.html manifest.webmanifest sw.js css/styles.css icons/
git commit -m "feat: PWA shell, manifest, service worker, base styles"
```

---

## Task 8: Локальный запуск и ручная проверка

**Files:**
- Create: `package.json` (скрипты запуска и тестов), `.gitignore`

**Interfaces:**
- Consumes: всё, что выше.

- [ ] **Step 1: Создать `.gitignore`**

```
node_modules/
.DS_Store
```

- [ ] **Step 2: Создать `package.json`**

```json
{
  "name": "espanol-benidorm",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "start": "npx --yes serve -l 3000 .",
    "test": "node --test"
  }
}
```

- [ ] **Step 3: Запустить тесты**

Run: `npm test`
Expected: PASS — тесты `test/lang.test.js` зелёные.

- [ ] **Step 4: Запустить сервер и проверить в браузере**

Run: `npm start` (откроется на http://localhost:3000)
Проверить вручную (десктопный Safari/Chrome, DevTools → Application):
- Открывается экран Настроек, внизу — навигация с вкладкой «⚙️ Настройки».
- Ввести API-ключ → «Сохранить» → перезагрузить страницу → ключ сохранён (IndexedDB → `espanol` → `settings`).
- «Проверить связь» с валидным ключом → статус «Связь есть. Ответ: OK».
- Без сети → «Проверить связь» даёт понятную ошибку про сеть.
- Application → Manifest распознан; Service Worker зарегистрирован; офлайн-перезагрузка показывает оболочку.

- [ ] **Step 5: Проверка установки на iPhone (по возможности)**

Отдать сайт по сети (или задеплоить на GitHub Pages), открыть в Safari на iPhone:
- «Поделиться» → «На экран Домой» → иконка появляется.
- Запуск с домашнего экрана открывается в полноэкранном standalone-режиме.

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore
git commit -m "chore: dev server and test scripts; manual verification"
```

---

## Self-Review

**Spec coverage (План 1 покрывает фундамент из спецификации):**
- PWA-установка на iPhone → Task 7 (manifest, apple-meta, standalone) + Task 8 проверка. ✔
- Хранение API-ключа на телефоне → Task 2 (settings store) + Task 6 (ввод). ✔
- Claude-клиент с нужными заголовками и моделью по умолчанию → Task 4. ✔
- Реестр модулей / расширяемость (§9) → Task 5; версионирование схемы → Task 2; промпты вынесены → Task 3. ✔
- Офлайн-оболочка → Task 7 (sw.js). ✔
- Юнит-тесты чистых функций (`node --test`) → Task 1. ✔
- Определение языка ввода для будущего двустороннего словаря → Task 1. ✔
- (Словарь, SRS, аудио, грамматика, логопед, напоминания, прогресс — в Планах 2–4.)

**Placeholder scan:** Код приведён полностью в каждом шаге; иконки — намеренная заглушка с явной пометкой заменить (не логический плейсхолдер). Нет TODO/«добавьте обработку ошибок» без кода.

**Type consistency:** Имена согласованы между задачами: `getSetting/setSetting/putWord/getAllWords/exportAll/importAll` (Task 2) используются в Tasks 4, 6; `registerFeature/startApp` (Task 5) — в Tasks 6, 7; `callClaude/testConnection/DEFAULT_MODEL` (Task 4) — в Task 6; `detectLang` (Task 1) зарезервирована для Плана 2. ✔
