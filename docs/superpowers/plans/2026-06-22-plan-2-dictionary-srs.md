# Español Benidorm — План 2: Словарь + SRS (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Двусторонний словарь (RU→ES и ES→RU) с AI-автозаполнением карточки и сохранением слов, плюс экран «Учить» с интервальным повторением (SRS) сохранённых слов и озвучкой.

**Architecture:** Поверх Фундамента (План 1). Новые экраны регистрируются через существующий реестр (`registerFeature`) без правки ядра. Чистая логика (SRS, парсинг JSON, экранирование HTML) вынесена в модули с юнит-тестами `node --test`. AI-обогащение слова идёт через существующий `callClaude`. Слова и их SRS-состояние хранятся в уже существующем сторе `words` (IndexedDB).

**Tech Stack:** HTML/CSS/JS (ES-модули, без сборки), IndexedDB, Web Speech API (`speechSynthesis`), Claude Messages API, Node 20 `node --test`.

## Global Constraints

- Интерфейс приложения — на русском языке.
- Без шага сборки: только нативные ES-модули (`<script type="module">`).
- Без бэкенда: API-ключ только на устройстве; ничего не коммитить с ключами.
- Любой динамический текст (от пользователя или от модели) вставляется в DOM
  только через `escapeHtml(...)` либо через `textContent` — никогда «сырым» в `innerHTML`.
- Claude API: уже реализован в `js/claude.js` (`callClaude`). Модель по умолчанию `claude-haiku-4-5`.
- Чистые функции покрываются тестами `node --test`; браузерные/AI части — ручным чек-листом.
- Каждый модуль — одна задача; экраны регистрируются через реестр, ядро не трогаем.
- Порядок вкладок (`order`): Учить (10), Словарь (20), Настройки (90, уже есть).
- Существующие интерфейсы Плана 1 (использовать как есть):
  - `js/app.js`: `registerFeature({ id, title, icon, order, render })`, `startApp()`
  - `js/db.js`: `openDB`, `getSetting`, `setSetting`, `putWord(word)→id`, `getAllWords()→[]`, `exportAll`, `importAll`; внутренние хелперы `tx(db,store,mode)`, `asPromise(req)`
  - `js/claude.js`: `callClaude({ system, messages, model, maxTokens })→string`, `DEFAULT_MODEL`
  - `js/lang.js`: `detectLang(text)→'ru'|'es'`
  - `js/prompts.js`: `DIALECT_SYSTEM`
- Рабочая директория: `/Users/nik/Downloads/EspanolBenidorm`, ветка `plan-2-dictionary-srs`.

---

## File Structure (этот план)

- `js/util.js` — чистые утилиты: `escapeHtml(str)`, `extractJson(text)` — **тесты**
- `js/srs.js` — интервальное повторение: `newCard`, `schedule`, `dueCards`, `DAY` — **тесты**
- `js/db.js` — расширить: добавить `getWord(id)`, `deleteWord(id)`
- `js/prompts.js` — добавить `WORD_ENRICH_SYSTEM`
- `js/claude.js` — добавить `enrichWord(input)`
- `js/tts.js` — `speak(text, lang)` через Web Speech API
- `js/dictionary.js` — экран «Словарь» (поиск/автозаполнение/сохранение + список слов)
- `js/study.js` — экран «Учить» (очередь SRS, оценка, обновление расписания)
- `index.html` — подключить `study.js` и `dictionary.js`
- `sw.js` — добавить новые файлы в кэш, поднять версию кэша
- `css/styles.css` — стили карточек слова и экрана повторения
- `test/util.test.js`, `test/srs.test.js` — юнит-тесты

---

## Task 1: Чистые утилиты (`js/util.js`)

**Files:**
- Create: `js/util.js`, `test/util.test.js`

**Interfaces:**
- Produces:
  - `escapeHtml(str: string): string` — заменяет `& < > " '` на HTML-сущности; не-строку приводит к строке; `null/undefined` → `''`.
  - `extractJson(text: string): object` — достаёт первый JSON-объект из текста (срезает ```json … ``` и текст вокруг), парсит; бросает `Error` с понятным сообщением, если JSON не найден.

- [ ] **Step 1: Написать падающий тест**

`test/util.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, extractJson } from '../js/util.js';

test('escapeHtml экранирует спецсимволы', () => {
  assert.equal(escapeHtml('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
  assert.equal(escapeHtml("a & b ' c"), 'a &amp; b &#39; c');
});

test('escapeHtml: null/undefined → пустая строка', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('extractJson: чистый JSON', () => {
  assert.deepEqual(extractJson('{"es":"perro","ru":"собака"}'), { es: 'perro', ru: 'собака' });
});

test('extractJson: в ограждении ```json', () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
});

test('extractJson: с текстом вокруг', () => {
  assert.deepEqual(extractJson('Вот ответ: {"a":1} спасибо'), { a: 1 });
});

test('extractJson: нет JSON → ошибка', () => {
  assert.throws(() => extractJson('нет данных'), /JSON/);
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `node --test test/util.test.js`
Expected: FAIL — `Cannot find module '../js/util.js'`.

- [ ] **Step 3: Реализовать `js/util.js`**

```js
// Чистые утилиты, используемые в нескольких экранах.

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function extractJson(text) {
  if (!text) throw new Error('Пустой ответ модели (нет JSON).');
  let s = String(text).trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('В ответе модели не найден JSON.');
  }
  return JSON.parse(s.slice(start, end + 1));
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `node --test test/util.test.js`
Expected: PASS — 6 тестов зелёные.

- [ ] **Step 5: Commit**

```bash
git add js/util.js test/util.test.js
git commit -m "feat: escapeHtml and extractJson utils with tests"
```

---

## Task 2: Движок интервального повторения (`js/srs.js`)

**Files:**
- Create: `js/srs.js`, `test/srs.test.js`

**Interfaces:**
- Produces:
  - `DAY: number` — миллисекунд в сутках.
  - `newCard(now: number): { due, interval, ease, reps, lapses }` — стартовое состояние карточки (due=now, interval=0, ease=2.5, reps=0, lapses=0).
  - `schedule(card, grade: 'again'|'good'|'easy', now: number): card` — новое состояние (чистая, не мутирует вход).
  - `dueCards(cards: object[], now: number): object[]` — карточки с `due <= now`.

- [ ] **Step 1: Написать падающий тест**

`test/srs.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCard, schedule, dueCards, DAY } from '../js/srs.js';

const NOW = 1_000_000_000_000;

test('newCard: стартовые значения', () => {
  const c = newCard(NOW);
  assert.deepEqual(c, { due: NOW, interval: 0, ease: 2.5, reps: 0, lapses: 0 });
});

test('schedule good: первый раз → интервал 1 день', () => {
  const c = schedule(newCard(NOW), 'good', NOW);
  assert.equal(c.reps, 1);
  assert.equal(c.interval, 1);
  assert.equal(c.due, NOW + DAY);
});

test('schedule good: второй раз → 3 дня', () => {
  let c = schedule(newCard(NOW), 'good', NOW);
  c = schedule(c, 'good', NOW);
  assert.equal(c.reps, 2);
  assert.equal(c.interval, 3);
});

test('schedule good: третий раз → round(3 * ease)', () => {
  let c = schedule(newCard(NOW), 'good', NOW);
  c = schedule(c, 'good', NOW);
  c = schedule(c, 'good', NOW);
  assert.equal(c.reps, 3);
  assert.equal(c.interval, Math.round(3 * 2.5)); // 8
});

test('schedule again: сброс reps, +lapse, ease вниз, due через 10 минут', () => {
  const c = schedule(newCard(NOW), 'again', NOW);
  assert.equal(c.reps, 0);
  assert.equal(c.lapses, 1);
  assert.equal(c.ease, 2.3);
  assert.equal(c.due, NOW + 10 * 60 * 1000);
});

test('schedule again: ease не опускается ниже 1.3', () => {
  let c = newCard(NOW);
  for (let i = 0; i < 20; i++) c = schedule(c, 'again', NOW);
  assert.equal(c.ease, 1.3);
});

test('schedule не мутирует входную карточку', () => {
  const c = newCard(NOW);
  schedule(c, 'good', NOW);
  assert.equal(c.reps, 0);
});

test('dueCards: только просроченные', () => {
  const cards = [{ id: 1, due: NOW - 1 }, { id: 2, due: NOW + DAY }, { id: 3, due: NOW }];
  const due = dueCards(cards, NOW).map((c) => c.id);
  assert.deepEqual(due, [1, 3]);
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `node --test test/srs.test.js`
Expected: FAIL — `Cannot find module '../js/srs.js'`.

- [ ] **Step 3: Реализовать `js/srs.js`**

```js
// Интервальное повторение (SM-2-lite). Чистые функции, без побочных эффектов.
export const DAY = 24 * 60 * 60 * 1000;
const MIN_EASE = 1.3;

export function newCard(now) {
  return { due: now, interval: 0, ease: 2.5, reps: 0, lapses: 0 };
}

export function schedule(card, grade, now) {
  const c = { ...card };
  if (grade === 'again') {
    c.reps = 0;
    c.lapses = card.lapses + 1;
    c.ease = Math.max(MIN_EASE, card.ease - 0.2);
    c.interval = 0;
    c.due = now + 10 * 60 * 1000;
    return c;
  }
  c.reps = card.reps + 1;
  if (grade === 'easy') c.ease = card.ease + 0.15;
  let interval;
  if (c.reps === 1) interval = grade === 'easy' ? 2 : 1;
  else if (c.reps === 2) interval = grade === 'easy' ? 4 : 3;
  else interval = Math.round(card.interval * c.ease * (grade === 'easy' ? 1.3 : 1));
  c.interval = interval;
  c.due = now + interval * DAY;
  return c;
}

export function dueCards(cards, now) {
  return cards.filter((c) => (c.due ?? 0) <= now);
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `node --test test/srs.test.js`
Expected: PASS — 8 тестов зелёные.

- [ ] **Step 5: Commit**

```bash
git add js/srs.js test/srs.test.js
git commit -m "feat: SRS scheduling engine with tests"
```

---

## Task 3: Расширение слоя данных (`js/db.js`)

**Files:**
- Modify: `js/db.js` (добавить две функции в конец файла)

**Interfaces:**
- Consumes: внутренние `openDB`, `tx`, `asPromise` (уже есть в файле).
- Produces:
  - `getWord(id: number): Promise<object|undefined>`
  - `deleteWord(id: number): Promise<void>`

- [ ] **Step 1: Добавить функции в конец `js/db.js`**

```js
export async function getWord(id) {
  const db = await openDB();
  return asPromise(tx(db, 'words', 'readonly').get(id));
}

export async function deleteWord(id) {
  const db = await openDB();
  await asPromise(tx(db, 'words', 'readwrite').delete(id));
}
```

- [ ] **Step 2: Проверка синтаксиса (импорт модуля в Node)**

Run: `node --input-type=module -e "import('./js/db.js').then(m=>console.log(typeof m.getWord, typeof m.deleteWord))"`
Expected: `function function` (модуль импортируется без ошибок; IndexedDB-вызовы не выполняются).

- [ ] **Step 3: Commit**

```bash
git add js/db.js
git commit -m "feat: add getWord and deleteWord to data layer"
```

---

## Task 4: Промпт и AI-обогащение слова (`js/prompts.js`, `js/claude.js`)

**Files:**
- Modify: `js/prompts.js` (добавить константу)
- Modify: `js/claude.js` (добавить импорты и функцию)

**Interfaces:**
- Consumes: `callClaude` (claude.js), `extractJson` (util.js), `WORD_ENRICH_SYSTEM` (prompts.js).
- Produces: `enrichWord(input: string): Promise<{ es, ru, example, exampleRu, pos, gender, local }>` — отправляет слово/фразу модели и возвращает разобранный JSON.

- [ ] **Step 1: Добавить промпт в конец `js/prompts.js`**

```js
export const WORD_ENRICH_SYSTEM = `Ты — двуязычный словарь (русский↔испанский) для ученика уровня A2–B1, живущего рядом с Бенидормом (Валенсийское сообщество, провинция Аликанте).
Тебе дают слово или короткую фразу на русском или на испанском.
Верни СТРОГО один JSON-объект, без markdown и без пояснений, с полями:
{
  "es": "слово/фраза на испанском (база — стандартный кастильский)",
  "ru": "перевод на русский",
  "example": "одно короткое предложение-пример на испанском",
  "exampleRu": "перевод примера на русский",
  "pos": "часть речи по-русски (например: существительное, глагол, прилагательное)",
  "gender": "для существительного артикль el или la, иначе пустая строка",
  "local": "как это слово/выражение используют именно в районе Бенидорма/Валенсии, или местный синоним; по-русски; если особенностей нет — пустая строка"
}
Только валидный JSON.`;
```

- [ ] **Step 2: Добавить импорты вверху `js/claude.js`**

В начало файла, рядом с существующим `import { getSetting } from './db.js';`, добавить:
```js
import { extractJson } from './util.js';
import { WORD_ENRICH_SYSTEM } from './prompts.js';
```

- [ ] **Step 3: Добавить функцию в конец `js/claude.js`**

```js
export async function enrichWord(input) {
  const text = await callClaude({
    system: WORD_ENRICH_SYSTEM,
    messages: [{ role: 'user', content: input }],
    maxTokens: 400,
  });
  return extractJson(text);
}
```

- [ ] **Step 4: Проверка синтаксиса (импорт в Node)**

Run: `node --input-type=module -e "import('./js/claude.js').then(m=>console.log(typeof m.enrichWord, typeof m.callClaude))"`
Expected: `function function`.

- [ ] **Step 5: Commit**

```bash
git add js/prompts.js js/claude.js
git commit -m "feat: enrichWord AI dictionary lookup with local-dialect prompt"
```

---

## Task 5: Озвучка (`js/tts.js`)

**Files:**
- Create: `js/tts.js`

**Interfaces:**
- Produces: `speak(text: string, lang = 'es-ES'): boolean` — произносит текст голосом `es`, возвращает `false`, если синтез недоступен.

- [ ] **Step 1: Реализовать `js/tts.js`**

```js
// Озвучка текста через Web Speech API (SpeechSynthesis).
export function speak(text, lang = 'es-ES') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  const esVoice = speechSynthesis.getVoices().find((v) => v.lang && v.lang.startsWith('es'));
  if (esVoice) u.voice = esVoice;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  return true;
}
```

- [ ] **Step 2: Commit**

```bash
git add js/tts.js
git commit -m "feat: Spanish text-to-speech helper"
```

---

## Task 6: Экран «Словарь» (`js/dictionary.js`)

**Files:**
- Create: `js/dictionary.js`

**Interfaces:**
- Consumes: `registerFeature` (app.js), `detectLang` (lang.js), `enrichWord` (claude.js), `putWord`/`getAllWords`/`deleteWord` (db.js), `newCard` (srs.js), `speak` (tts.js), `escapeHtml` (util.js).
- Produces: регистрирует экран `dictionary` (Словарь, `order: 20`). Сохранённое слово = объект enrichWord + `createdAt: Date.now()` + поля `newCard(Date.now())`.

- [ ] **Step 1: Реализовать `js/dictionary.js`**

```js
import { registerFeature } from './app.js';
import { detectLang } from './lang.js';
import { enrichWord } from './claude.js';
import { putWord, getAllWords, deleteWord } from './db.js';
import { newCard } from './srs.js';
import { speak } from './tts.js';
import { escapeHtml } from './util.js';

function wordHtml(w, withSave) {
  const e = escapeHtml;
  return `
    <div class="word-card">
      <div class="word-main"><b>${e(w.es)}</b> ${w.gender ? `<span class="muted">(${e(w.gender)})</span>` : ''} — ${e(w.ru)}</div>
      ${w.example ? `<div class="word-ex">${e(w.example)}${w.exampleRu ? `<br><span class="muted">${e(w.exampleRu)}</span>` : ''}</div>` : ''}
      ${w.local ? `<div class="word-local">📍 ${e(w.local)}</div>` : ''}
      <div class="word-actions">
        ${withSave ? '<button id="dic-save">Сохранить в словарь</button>' : `<button class="danger" data-del="${e(w.id)}">Удалить</button>`}
        <button ${withSave ? 'id="dic-say"' : `data-say="${e(w.id)}"`}>🔊</button>
      </div>
    </div>`;
}

async function renderList(container) {
  const listEl = container.querySelector('#dic-list');
  const words = (await getAllWords()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (words.length === 0) {
    listEl.innerHTML = '<p class="status">Словарь пуст. Добавь первое слово выше.</p>';
    return;
  }
  listEl.innerHTML = words.map((w) => wordHtml(w, false)).join('');
  listEl.querySelectorAll('[data-say]').forEach((b) => {
    b.onclick = () => { const w = words.find((x) => String(x.id) === b.dataset.say); if (w) speak(w.es); };
  });
  listEl.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => { await deleteWord(Number(b.dataset.del)); renderList(container); };
  });
}

async function render(container) {
  container.innerHTML = `
    <h1>Словарь</h1>
    <label>Слово или фраза (RU или ES)
      <input id="dic-input" type="text" placeholder="напр. собака или perro" autocapitalize="off">
    </label>
    <button id="dic-lookup">Найти и заполнить</button>
    <p id="dic-status" class="status"></p>
    <div id="dic-preview"></div>
    <h2>Мои слова</h2>
    <div id="dic-list"></div>
  `;
  const status = container.querySelector('#dic-status');
  const preview = container.querySelector('#dic-preview');
  const inputEl = container.querySelector('#dic-input');

  container.querySelector('#dic-lookup').onclick = async () => {
    const input = inputEl.value.trim();
    if (!input) return;
    status.textContent = `Запрашиваю (${detectLang(input) === 'ru' ? 'RU→ES' : 'ES→RU'})…`;
    preview.innerHTML = '';
    try {
      const w = await enrichWord(input);
      status.textContent = '';
      preview.innerHTML = wordHtml(w, true);
      preview.querySelector('#dic-say').onclick = () => speak(w.es);
      preview.querySelector('#dic-save').onclick = async () => {
        const now = Date.now();
        await putWord({ ...w, createdAt: now, ...newCard(now) });
        preview.innerHTML = '';
        inputEl.value = '';
        status.textContent = 'Сохранено в словарь.';
        renderList(container);
      };
    } catch (e) {
      status.textContent = e.message;
    }
  };

  await renderList(container);
}

registerFeature({ id: 'dictionary', title: 'Словарь', icon: '📖', order: 20, render });
```

- [ ] **Step 2: Commit**

```bash
git add js/dictionary.js
git commit -m "feat: dictionary screen (bidirectional lookup, autofill, save, list, TTS)"
```

---

## Task 7: Экран «Учить» (`js/study.js`)

**Files:**
- Create: `js/study.js`

**Interfaces:**
- Consumes: `registerFeature` (app.js), `getAllWords`/`putWord` (db.js), `dueCards`/`schedule` (srs.js), `speak` (tts.js), `escapeHtml` (util.js).
- Produces: регистрирует экран `study` (Учить, `order: 10`). Карточка: лицо — русский перевод, ответ — испанское слово + пример. Оценки: `again`/`good`/`easy`.

- [ ] **Step 1: Реализовать `js/study.js`**

```js
import { registerFeature } from './app.js';
import { getAllWords, putWord } from './db.js';
import { dueCards, schedule } from './srs.js';
import { speak } from './tts.js';
import { escapeHtml } from './util.js';

let queue = [];
let current = null;

function renderEmpty(container) {
  container.innerHTML = `<h1>Учить</h1>
    <p class="status">На сегодня всё повторено 🎉<br>Добавь слова во вкладке «Словарь» или вернись позже.</p>`;
}

async function grade(container, g) {
  const updated = { ...current, ...schedule(current, g, Date.now()) };
  await putWord(updated);
  queue = queue.filter((w) => w.id !== current.id);
  if (g === 'again') queue.push(updated); // вернуть в конец очереди на сегодня
  renderCard(container);
}

function renderCard(container) {
  if (queue.length === 0) { renderEmpty(container); return; }
  current = queue[0];
  const e = escapeHtml;
  container.innerHTML = `
    <h1>Учить <span class="muted">(осталось ${queue.length})</span></h1>
    <div class="study-card">
      <div class="study-front"><b>${e(current.ru)}</b></div>
      <button id="study-reveal">Показать ответ</button>
      <div id="study-back" class="hidden">
        <div class="study-es"><b>${e(current.es)}</b> ${current.gender ? `<span class="muted">(${e(current.gender)})</span>` : ''}</div>
        ${current.example ? `<div class="word-ex">${e(current.example)}</div>` : ''}
        <button id="study-say">🔊 Озвучить</button>
        <div class="grade-row">
          <button class="danger" data-g="again">Не помню</button>
          <button data-g="good">Помню</button>
          <button data-g="easy">Легко</button>
        </div>
      </div>
    </div>`;
  container.querySelector('#study-reveal').onclick = () => {
    container.querySelector('#study-back').classList.remove('hidden');
    container.querySelector('#study-reveal').classList.add('hidden');
  };
  container.querySelector('#study-say').onclick = () => speak(current.es);
  container.querySelectorAll('[data-g]').forEach((b) => { b.onclick = () => grade(container, b.dataset.g); });
}

async function render(container) {
  queue = dueCards(await getAllWords(), Date.now());
  renderCard(container);
}

registerFeature({ id: 'study', title: 'Учить', icon: '🎓', order: 10, render });
```

- [ ] **Step 2: Commit**

```bash
git add js/study.js
git commit -m "feat: study screen with spaced-repetition queue"
```

---

## Task 8: Интеграция, кэш, стили, проверка

**Files:**
- Modify: `index.html` (подключить новые экраны)
- Modify: `sw.js` (кэш новых файлов + версия)
- Modify: `css/styles.css` (стили карточек)

**Interfaces:**
- Consumes: все модули выше.

- [ ] **Step 1: Подключить экраны в `index.html`**

Найти в `index.html` блок:
```js
    import { startApp } from './js/app.js';
    import './js/settings.js';
    startApp();
```
Заменить на:
```js
    import { startApp } from './js/app.js';
    import './js/study.js';
    import './js/dictionary.js';
    import './js/settings.js';
    startApp();
```

- [ ] **Step 2: Обновить кэш в `sw.js`**

Поднять версию кэша: заменить `const CACHE = 'espanol-v1';` на `const CACHE = 'espanol-v2';`.
В массив `SHELL` добавить новые файлы (после строки `'./js/lang.js', './js/settings.js',`):
```js
  './js/util.js', './js/srs.js', './js/tts.js', './js/dictionary.js', './js/study.js',
```

- [ ] **Step 3: Добавить стили в конец `css/styles.css`**

```css
h2 { font-size:18px; margin:24px 0 8px; }
.hidden { display:none; }
.muted { color:var(--muted); font-weight:400; }
.word-card, .study-card { background:var(--card); border:1px solid #334155; border-radius:12px; padding:14px; margin:10px 0; }
.word-main { font-size:17px; line-height:1.4; }
.word-ex { margin-top:6px; color:#cbd5e1; font-style:italic; }
.word-local { margin-top:6px; color:#fbbf24; font-size:14px; }
.word-actions, .grade-row { display:flex; gap:8px; margin-top:10px; flex-wrap:wrap; }
button.danger { background:#ef4444; color:#fff; }
.study-front, .study-es { font-size:22px; text-align:center; margin:12px 0; }
.grade-row { margin-top:14px; }
.grade-row button { flex:1; }
```

- [ ] **Step 4: Прогнать все тесты**

Run: `npm test`
Expected: PASS — тесты `lang`, `util`, `srs` зелёные, 0 провалов.

- [ ] **Step 5: Ручная проверка в браузере**

Run: `npm start` (http://localhost:3000), затем проверить:
- Внизу три вкладки: 🎓 Учить · 📖 Словарь · ⚙️ Настройки.
- Словарь: ввести «собака» → «Найти и заполнить» → статус «Запрашиваю (RU→ES)…» → появляется карточка `perro — собака`, пример, местная заметка. 🔊 произносит по-испански.
- «Сохранить в словарь» → карточка уходит, появляется в «Мои слова».
- Ввести `gracias` → статус «(ES→RU)» → перевод на русский.
- Учить: открыть вкладку → показывается русское слово → «Показать ответ» → испанское + пример + 🔊 → кнопки «Не помню/Помню/Легко» → счётчик «осталось N» уменьшается; «Не помню» возвращает карточку в очередь.
- Удаление слова в Словаре убирает его из списка.
- DevTools → Application → IndexedDB → `espanol` → `words`: у сохранённого слова есть поля `due, interval, ease, reps, lapses`.

- [ ] **Step 6: Commit**

```bash
git add index.html sw.js css/styles.css
git commit -m "feat: wire dictionary and study screens, cache v2, card styles"
```

---

## Self-Review

**Spec coverage (План 2 = пункты спецификации «Словарь RU↔ES» + «SRS-повторение (A)» + «Автозаполнение карточки (F)» + озвучка по тапу):**
- Двусторонний словарь RU→ES и ES→RU → Task 6 (detectLang + enrichWord). ✔
- Автозаполнение карточки (перевод, пример, род, часть речи, местный вариант) → Tasks 4, 6. ✔
- Сохранение слов в личную базу (IndexedDB) → Task 6 (putWord) поверх Плана 1. ✔
- Удаление слов → Tasks 3, 6. ✔
- SRS-повторение → Tasks 2, 7. ✔
- Озвучка слова по тапу (TTS) → Tasks 5, 6, 7. ✔
- Расширяемость: новые экраны через реестр, ядро не тронуто → Tasks 6, 7. ✔
- Безопасная вставка в DOM (escapeHtml) → Task 1 + использование в 6, 7. ✔
- Офлайн-кэш новых файлов → Task 8. ✔
- (Аудио-диалоги, грамматика, логопед, напоминания, прогресс — Планы 3–4.)

**Placeholder scan:** Полный код во всех шагах. Нет TODO/«добавьте обработку ошибок» без кода. enrichWord-ошибки ловятся в Task 6 и показываются в статусе.

**Type consistency:** `escapeHtml`/`extractJson` (Task 1) используются в 4, 6, 7; `newCard`/`schedule`/`dueCards` (Task 2) — в 6, 7; `getWord`/`deleteWord` (Task 3) — `deleteWord` в 6; `enrichWord` (Task 4) — в 6; `speak` (Task 5) — в 6, 7; форма слова (`es, ru, example, exampleRu, pos, gender, local` + `createdAt` + SRS-поля) согласована между Task 6 (сохранение) и Task 7 (чтение). ✔
