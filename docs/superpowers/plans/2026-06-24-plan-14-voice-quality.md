# Español Benidorm — План 14: Качественный испанский голос (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Озвучка использует лучший доступный испанский системный голос (приоритет улучшенным/es-ES, напр. Mónica). В Настройках — выбор конкретного голоса и скорости с кнопкой проверки. Бесплатно, офлайн, без новых сервисов.

**Architecture:** Поверх Планов 1–13. `tts.js` получает чистые `pickBestVoice`/`listEsVoices` (тесты), асинхронный `getVoicesAsync`, и `initVoice` (читает выбор из `settings`). `speak`/`speakSequence` используют выбранный голос и скорость. Выбор хранится в `settings.voiceURI`/`settings.voiceRate` (синхронизируется).

**Tech Stack:** HTML/CSS/JS (ES-модули, без сборки), Web Speech API (синтез), Node 20 `node --test`.

## Global Constraints

- Интерфейс на русском; без сборки; без бэкенда; ключи не коммитить.
- Любой динамический текст в DOM — через `escapeHtml`.
- Голоса загружаются асинхронно (`voiceschanged`) — учесть, что `getVoices()` сначала пуст.
- Существующие 55 тестов остаются зелёными; новые чистые функции покрыты тестами.
- `js/app.js` НЕ менять.
- Существующие интерфейсы (сохранить сигнатуры): `tts.js` экспортирует `speak(text, lang)`, `stopSpeaking()`, `speakSequence(lines, lang)` (используются в speech/listening/dictionary/study/chat).
  - `js/db.js`: `getSetting`, `setSetting`
  - `js/settings.js`: экран Настроек, `render`, `status`, обработчик `#set-save`
  - `index.html`: стартовый скрипт с `startApp();`
- Рабочая директория: `/Users/nik/Downloads/EspanolBenidorm`, ветка `plan-14-voice-quality`.

---

## File Structure (этот план)

- `js/tts.js` — переписать: выбор лучшего голоса + скорость + `initVoice`/`getVoicesAsync` (+ чистые `pickBestVoice`/`listEsVoices`)
- `js/settings.js` — раздел «Голос озвучки» (выбор голоса/скорости + проверка)
- `index.html` — `initVoice()` при старте
- `sw.js` — версия `espanol-v17`
- `test/tts.test.js` — тесты выбора голоса

---

## Task 1: Выбор голоса в `tts.js`

**Files:**
- Overwrite: `js/tts.js`
- Create: `test/tts.test.js`

**Interfaces:**
- Produces (новое): `pickBestVoice(voices, preferredURI)`, `listEsVoices(voices)`, `getVoicesAsync()`, `initVoice()`.
- Сохраняет: `speak(text, lang='es-ES')`, `stopSpeaking()`, `speakSequence(lines, lang='es-ES')`.

- [ ] **Step 1: Написать падающий тест**

`test/tts.test.js`:
```js
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
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `node --test test/tts.test.js`
Expected: FAIL — `pickBestVoice`/`listEsVoices` не экспортированы.

- [ ] **Step 3: Переписать `js/tts.js` целиком**

```js
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
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `node --test test/tts.test.js`
Expected: PASS — 4 теста зелёные.

- [ ] **Step 5: Commit**

```bash
git add js/tts.js test/tts.test.js
git commit -m "feat: best-Spanish-voice selection and rate in TTS with tests"
```

---

## Task 2: Раздел «Голос» в Настройках (`js/settings.js`)

**Files:**
- Modify: `js/settings.js`

**Interfaces:**
- Consumes: `getVoicesAsync`/`listEsVoices`/`initVoice`/`speak` (tts.js), `escapeHtml` (util.js).

- [ ] **Step 1: Добавить импорты вверху `js/settings.js`**

```js
import { getVoicesAsync, listEsVoices, initVoice, speak } from './tts.js';
import { escapeHtml } from './util.js';
```

- [ ] **Step 2: Прочитать голоса и выбор в начале `render`**

Рядом с чтением прочих настроек добавить:
```js
  const voices = await getVoicesAsync();
  const esVoices = listEsVoices(voices);
  const voiceURI = (await getSetting('voiceURI')) || '';
  const voiceRate = String((await getSetting('voiceRate')) || '1');
```

- [ ] **Step 3: Добавить разметку перед `<p id="set-status" class="status"></p>`**

```js
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
```

- [ ] **Step 4: Подставить значения после рендера**

Рядом с другими `container.querySelector('#...').value = ...;` добавить:
```js
  container.querySelector('#set-voice').value = voiceURI;
  container.querySelector('#set-rate').value = voiceRate;
```

- [ ] **Step 5: Сохранять выбор в обработчике `#set-save`**

Внутри `onclick` у `#set-save` добавить:
```js
    await setSetting('voiceURI', container.querySelector('#set-voice').value);
    await setSetting('voiceRate', container.querySelector('#set-rate').value);
    await initVoice();
```

- [ ] **Step 6: Добавить обработчик проверки голоса в конце `render`**

```js
  container.querySelector('#set-voicetest').onclick = async () => {
    await setSetting('voiceURI', container.querySelector('#set-voice').value);
    await setSetting('voiceRate', container.querySelector('#set-rate').value);
    await initVoice();
    speak('Hola, soy tu profesor de español. Vamos a practicar la pronunciación.');
  };
```

- [ ] **Step 7: Проверка импорта в Node**

Run: `node --input-type=module -e "import('./js/settings.js').then(()=>console.log('settings ok')).catch(e=>console.log('ERR',e.message))"`
Expected: `settings ok`.

- [ ] **Step 8: Commit**

```bash
git add js/settings.js
git commit -m "feat: voice and speed picker with test button in settings"
```

---

## Task 3: Инициализация при старте, кэш, проверка

**Files:**
- Modify: `index.html`, `sw.js`

- [ ] **Step 1: Инициализировать голос при старте в `index.html`**

В стартовом скрипте добавить импорт рядом с прочими и вызвать после `startApp();`:
- добавить `import { initVoice } from './js/tts.js';`
- после строки `startApp();` (или рядом с `autoSync();`) добавить `initVoice();`

- [ ] **Step 2: Обновить кэш в `sw.js`**

Заменить `const CACHE = 'espanol-v16';` на `const CACHE = 'espanol-v17';`.

- [ ] **Step 3: Прогнать все тесты**

Run: `npm test`
Expected: PASS — 55 прежних + 4 новых = 59, 0 провалов.

- [ ] **Step 4: Ручная проверка в Chrome**

Run: `npm start` (http://localhost:3000):
- ⚙️ Настройки → раздел «Голос озвучки»: в списке — испанские голоса (улучшенные/es-ES вверху). Выбрать голос, скорость «Чётче».
- «▶︎ Проверить голос» → слышно фразу выбранным голосом с выбранной скоростью.
- «Сохранить» → перезагрузка: выбор сохранён (IndexedDB → `settings` → `voiceURI`/`voiceRate`).
- Озвучка в других местах (🔊 в чате, Аудио-диалоги, слово в Словаре, Логопед) теперь использует выбранный голос/скорость.
- Если испанских голосов нет — список показывает «не найдены», озвучка использует системный по умолчанию (не падает).

- [ ] **Step 5: Commit**

```bash
git add index.html sw.js
git commit -m "feat: init voice on startup, cache v17"
```

---

## Self-Review

**Spec coverage (План 14 = «чёткий испанский голос»):**
- Авто-выбор лучшего es-голоса (улучшенный/es-ES) → Task 1 (`pickBestVoice`). ✔
- Выбор конкретного голоса и скорости в Настройках + проверка → Task 2. ✔
- Применяется во всей озвучке (`speak`/`speakSequence` используют выбор) → Task 1. ✔
- Выбор хранится и синхронизируется (`settings.voiceURI`/`voiceRate`) → Tasks 2, 3. ✔
- Асинхронная загрузка голосов учтена (`getVoicesAsync`) → Tasks 1, 2. ✔
- Подсказка про премиум-голос iOS → Task 2. ✔
- Чистые функции покрыты тестами → Task 1. ✔
- `app.js` не тронут; кэш обновлён → Task 3. ✔

**Placeholder scan:** Полный код во всех шагах. Нет TODO без кода. Опции голоса экранируются `escapeHtml`.

**Type consistency:** `pickBestVoice`/`listEsVoices` (Task 1) → `currentVoice`/`speak`/`speakSequence` (Task 1) и `listEsVoices` в Settings (Task 2); `getVoicesAsync`/`initVoice` (Task 1) → Tasks 2, 3; `voiceURI`/`voiceRate` в `settings` ↔ `initVoice` читает их же. Сигнатуры `speak`/`stopSpeaking`/`speakSequence` неизменны — существующие вызовы не ломаются. ✔
