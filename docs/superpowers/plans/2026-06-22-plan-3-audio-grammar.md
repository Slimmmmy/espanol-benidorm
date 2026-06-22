# Español Benidorm — План 3: Аудио + Грамматика (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Экран «Аудио» — AI генерит короткий диалог с местным колоритом, проигрывает озвучкой по ролям, показывает транскрипт и вопрос на понимание. Экран «Грамматика» — пользователь пишет фразу по-испански, AI исправляет с объяснением по-русски и логирует ошибку в «слабые темы».

**Architecture:** Поверх Фундамента (План 1) и Словаря/SRS (План 2). Новые экраны регистрируются через существующий реестр. AI-вызовы через существующий `callClaude` + `extractJson`. Озвучка по ролям добавляется в `js/tts.js`. Лог ошибок грамматики хранится в новом сторе IndexedDB `mistakes` (миграция схемы до версии 2).

**Tech Stack:** HTML/CSS/JS (ES-модули, без сборки), IndexedDB, Web Speech API (`speechSynthesis`), Claude Messages API, Node 20 `node --test`. Целевой браузер сейчас — Chrome (десктоп).

## Global Constraints

- Интерфейс на русском; без шага сборки (нативные ES-модули); без бэкенда; ключи не коммитить.
- Любой динамический текст (пользователь/модель) — в DOM только через `escapeHtml`/`textContent`.
- AI-ответы со структурой приходят как JSON и разбираются через `extractJson` (бросает понятную ошибку, она показывается в статусе экрана).
- Модель по умолчанию `claude-haiku-4-5` (берётся внутри `callClaude`).
- Чистые функции — тесты `node --test`; браузер/AI — ручной чек-лист.
- Каждый модуль — одна задача; экраны регистрируются через реестр; `js/app.js` НЕ менять.
- Порядок вкладок (`order`): Учить(10), Словарь(20), **Аудио(30)**, **Грамматика(40)**, Настройки(90).
- Существующие интерфейсы (использовать как есть):
  - `js/app.js`: `registerFeature({ id, title, icon, order, render })`
  - `js/claude.js`: `callClaude({ system, messages, model, maxTokens })→string`
  - `js/util.js`: `escapeHtml(str)`, `extractJson(text)`
  - `js/tts.js`: `speak(text, lang='es-ES')→boolean`
  - `js/db.js`: `openDB`, `getAllWords`, `putWord`, ... ; внутренние `tx(db,store,mode)`, `asPromise(req)`; текущая `DB_VERSION = 1`, сторы `settings`, `words` (миграция `if (e.oldVersion < 1) {...}`)
  - `js/prompts.js`: `DIALECT_SYSTEM`, `WORD_ENRICH_SYSTEM`
- Рабочая директория: `/Users/nik/Downloads/EspanolBenidorm`, ветка `plan-3-audio-grammar`.

---

## File Structure (этот план)

- `js/prompts.js` — добавить `DIALOGUE_SYSTEM`, `GRAMMAR_SYSTEM`
- `js/claude.js` — добавить `generateDialogue(topic, level)`, `checkGrammar(text)`
- `js/db.js` — миграция до версии 2: стор `mistakes`; добавить `addMistake(m)`, `getAllMistakes()`
- `js/tts.js` — добавить `speakSequence(lines, lang)`, `stopSpeaking()`
- `js/listening.js` — экран «Аудио»
- `js/grammar.js` — экран «Грамматика»
- `index.html` — подключить `listening.js`, `grammar.js`
- `sw.js` — кэш новых файлов + версия `espanol-v3`
- `css/styles.css` — стили диалога и грамматики

Новой чистой логики, требующей юнит-тестов, в этом плане нет; существующий набор тестов (`lang`, `util`, `srs`) должен остаться зелёным. Новые модули проверяются ручным чек-листом (Task 7).

---

## Task 1: Промпты диалога и грамматики (`js/prompts.js`)

**Files:**
- Modify: `js/prompts.js` (добавить две константы в конец)

**Interfaces:**
- Produces: `DIALOGUE_SYSTEM: string`, `GRAMMAR_SYSTEM: string`.

- [ ] **Step 1: Добавить в конец `js/prompts.js`**

```js
export const DIALOGUE_SYSTEM = `Ты — преподаватель испанского для русскоязычного ученика A2–B1, живущего рядом с Бенидормом (Валенсийское сообщество).
Сгенерируй короткий бытовой диалог (4–6 реплик) на заданную тему, с естественным местным колоритом района Бенидорма/Валенсии.
Верни СТРОГО один JSON-объект, без markdown и без пояснений:
{
  "title": "короткое название сцены по-русски",
  "lines": [ { "speaker": "имя/роль на испанском", "es": "реплика на испанском", "ru": "перевод на русский" } ],
  "question": "один вопрос на понимание по-русски",
  "options": ["вариант 1", "вариант 2", "вариант 3"],
  "answer": 0,
  "notes": "1-3 местных словечка/выражения из диалога с пояснением, по-русски"
}
Поле "answer" — индекс правильного варианта в "options" (0,1,2). Только валидный JSON.`;

export const GRAMMAR_SYSTEM = `Ты — проверяющий грамматику испанского для русскоязычного ученика A2–B1.
Тебе дают фразу на испанском. Проверь её.
Верни СТРОГО один JSON-объект, без markdown и без пояснений:
{
  "ok": true|false,
  "corrected": "исправленная фраза на испанском (если ошибок нет — та же фраза)",
  "explanation": "объяснение по-русски: что не так и почему; если всё верно — короткая похвала",
  "topic": "краткая тема ошибки по-русски (напр. 'согласование рода', 'спряжение в pretérito'); если ошибок нет — пустая строка"
}
Учитывай местный узус района Бенидорма, но исправляй по нормам стандартного испанского. Только валидный JSON.`;
```

- [ ] **Step 2: Commit**

```bash
git add js/prompts.js
git commit -m "feat: dialogue and grammar system prompts"
```

---

## Task 2: AI-функции диалога и грамматики (`js/claude.js`)

**Files:**
- Modify: `js/claude.js` (добавить импорт промптов и две функции)

**Interfaces:**
- Consumes: `callClaude`, `extractJson` (уже импортирован в claude.js из Плана 2), `DIALOGUE_SYSTEM`, `GRAMMAR_SYSTEM`.
- Produces:
  - `generateDialogue(topic: string, level = 'A2-B1'): Promise<{title, lines:[{speaker,es,ru}], question, options:string[], answer:number, notes}>`
  - `checkGrammar(text: string): Promise<{ok:boolean, corrected, explanation, topic}>`

- [ ] **Step 1: Обновить импорт промптов вверху `js/claude.js`**

Сейчас в файле есть строка (из Плана 2):
```js
import { WORD_ENRICH_SYSTEM } from './prompts.js';
```
Заменить её на:
```js
import { WORD_ENRICH_SYSTEM, DIALOGUE_SYSTEM, GRAMMAR_SYSTEM } from './prompts.js';
```

- [ ] **Step 2: Добавить функции в конец `js/claude.js`**

```js
export async function generateDialogue(topic, level = 'A2-B1') {
  const text = await callClaude({
    system: DIALOGUE_SYSTEM,
    messages: [{ role: 'user', content: `Тема: ${topic}. Уровень: ${level}.` }],
    maxTokens: 900,
  });
  return extractJson(text);
}

export async function checkGrammar(text) {
  const out = await callClaude({
    system: GRAMMAR_SYSTEM,
    messages: [{ role: 'user', content: text }],
    maxTokens: 500,
  });
  return extractJson(out);
}
```

- [ ] **Step 3: Проверка импорта в Node**

Run: `node --input-type=module -e "import('./js/claude.js').then(m=>console.log(typeof m.generateDialogue, typeof m.checkGrammar))"`
Expected: `function function`.

- [ ] **Step 4: Commit**

```bash
git add js/claude.js
git commit -m "feat: generateDialogue and checkGrammar AI calls"
```

---

## Task 3: Стор ошибок грамматики (`js/db.js`, миграция v2)

**Files:**
- Modify: `js/db.js` (поднять версию, добавить миграцию и две функции)

**Interfaces:**
- Consumes: внутренние `openDB`, `tx`, `asPromise`.
- Produces:
  - `addMistake(m: { phrase, corrected, topic, createdAt }): Promise<number>`
  - `getAllMistakes(): Promise<object[]>`
  - Новый стор `mistakes` (keyPath `id`, autoIncrement), версия БД `2`.

- [ ] **Step 1: Поднять версию БД**

В `js/db.js` заменить:
```js
const DB_VERSION = 1;
```
на:
```js
const DB_VERSION = 2;
```

- [ ] **Step 2: Добавить миграцию v2**

В `js/db.js` внутри `req.onupgradeneeded`, сразу ПОСЛЕ существующего блока
```js
      if (e.oldVersion < 1) {
        db.createObjectStore('settings', { keyPath: 'key' });
        db.createObjectStore('words', { keyPath: 'id', autoIncrement: true });
      }
```
добавить:
```js
      if (e.oldVersion < 2) {
        db.createObjectStore('mistakes', { keyPath: 'id', autoIncrement: true });
      }
```

- [ ] **Step 3: Добавить функции в конец `js/db.js`**

```js
export async function addMistake(m) {
  const db = await openDB();
  return asPromise(tx(db, 'mistakes', 'readwrite').put(m));
}

export async function getAllMistakes() {
  const db = await openDB();
  return asPromise(tx(db, 'mistakes', 'readonly').getAll());
}
```

- [ ] **Step 4: Проверка импорта в Node**

Run: `node --input-type=module -e "import('./js/db.js').then(m=>console.log(typeof m.addMistake, typeof m.getAllMistakes))"`
Expected: `function function`.

- [ ] **Step 5: Commit**

```bash
git add js/db.js
git commit -m "feat: mistakes store (db v2) with addMistake/getAllMistakes"
```

---

## Task 4: Озвучка диалога по ролям (`js/tts.js`)

**Files:**
- Modify: `js/tts.js` (добавить две функции)

**Interfaces:**
- Produces:
  - `speakSequence(lines: {es:string, speaker?:string}[], lang='es-ES'): void` — произносит реплики по очереди; чередует высоту тона по говорящему (разные роли звучат по-разному).
  - `stopSpeaking(): void` — останавливает воспроизведение.

- [ ] **Step 1: Добавить в конец `js/tts.js`**

```js
export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
}

export function speakSequence(lines, lang = 'es-ES') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const esVoice = speechSynthesis.getVoices().find((v) => v.lang && v.lang.startsWith('es'));
  const speakers = [];
  const pitchFor = (speaker) => {
    if (!speaker) return 1.0;
    let i = speakers.indexOf(speaker);
    if (i === -1) { speakers.push(speaker); i = speakers.length - 1; }
    return i % 2 === 0 ? 1.05 : 0.8;
  };
  for (const line of lines) {
    const u = new SpeechSynthesisUtterance(line.es);
    u.lang = lang;
    if (esVoice) u.voice = esVoice;
    u.pitch = pitchFor(line.speaker);
    speechSynthesis.speak(u);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/tts.js
git commit -m "feat: role-based dialogue playback (speakSequence, stopSpeaking)"
```

---

## Task 5: Экран «Аудио» (`js/listening.js`)

**Files:**
- Create: `js/listening.js`

**Interfaces:**
- Consumes: `registerFeature` (app.js), `generateDialogue` (claude.js), `speakSequence`/`stopSpeaking`/`speak` (tts.js), `escapeHtml` (util.js).
- Produces: регистрирует экран `listening` (Аудио, `order: 30`).

- [ ] **Step 1: Реализовать `js/listening.js`**

```js
import { registerFeature } from './app.js';
import { generateDialogue } from './claude.js';
import { speakSequence, stopSpeaking, speak } from './tts.js';
import { escapeHtml } from './util.js';

const TOPICS = [
  'В баре заказать кофе и тапас',
  'На рынке купить фрукты',
  'Разговор с соседом по дому',
  'У врача / в аптеке',
  'На пляже в Бенидорме',
  'Снять квартиру у хозяина',
  'В супермаркете Mercadona',
  'Спросить дорогу в городе',
];

let dialogue = null;
let answered = false;

function dialogueHtml(d) {
  const e = escapeHtml;
  const lines = d.lines.map((l) => `
    <div class="dlg-line"><span class="dlg-speaker">${e(l.speaker)}:</span>
      <span class="dlg-es">${e(l.es)}</span>
      <span class="dlg-ru muted hidden">${e(l.ru)}</span></div>`).join('');
  const opts = (d.options || []).map((o, i) =>
    `<button class="opt" data-i="${i}">${e(o)}</button>`).join('');
  return `
    <div class="study-card">
      <h2>${e(d.title)}</h2>
      <div class="dlg-controls">
        <button id="lst-play">▶︎ Прослушать</button>
        <button id="lst-stop">⏹</button>
        <button id="lst-trans">Показать перевод</button>
      </div>
      <div id="lst-lines">${lines}</div>
      ${d.question ? `<div class="dlg-q"><b>${e(d.question)}</b><div class="grade-row">${opts}</div><p id="lst-verdict" class="status"></p></div>` : ''}
      ${d.notes ? `<div class="word-local">📍 ${e(d.notes)}</div>` : ''}
    </div>`;
}

function wireDialogue(container, d) {
  container.querySelector('#lst-play').onclick = () => speakSequence(d.lines);
  container.querySelector('#lst-stop').onclick = () => stopSpeaking();
  const trans = container.querySelector('#lst-trans');
  trans.onclick = () => {
    const hidden = container.querySelector('.dlg-ru.hidden');
    const show = !!hidden;
    container.querySelectorAll('.dlg-ru').forEach((el) => el.classList.toggle('hidden', !show));
    trans.textContent = show ? 'Скрыть перевод' : 'Показать перевод';
  };
  container.querySelectorAll('.opt').forEach((b) => {
    b.onclick = () => {
      if (answered) return;
      answered = true;
      const chosen = Number(b.dataset.i);
      const verdict = container.querySelector('#lst-verdict');
      if (chosen === d.answer) { b.classList.add('ok'); verdict.textContent = '✅ Верно!'; }
      else {
        b.classList.add('danger');
        const right = container.querySelector(`.opt[data-i="${d.answer}"]`);
        if (right) right.classList.add('ok');
        verdict.textContent = '❌ Не совсем. Правильный вариант подсвечен.';
      }
    };
  });
}

async function generate(container) {
  const status = container.querySelector('#lst-status');
  const topic = container.querySelector('#lst-topic').value;
  status.textContent = 'Генерирую диалог…';
  container.querySelector('#lst-out').innerHTML = '';
  try {
    dialogue = await generateDialogue(topic);
    answered = false;
    if (!container.querySelector('#lst-out')) return; // ушли на другой экран
    status.textContent = '';
    container.querySelector('#lst-out').innerHTML = dialogueHtml(dialogue);
    wireDialogue(container, dialogue);
  } catch (err) {
    status.textContent = err.message;
  }
}

async function render(container) {
  const opts = TOPICS.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  container.innerHTML = `
    <h1>Аудио</h1>
    <label>Тема диалога
      <select id="lst-topic">${opts}</select>
    </label>
    <button id="lst-gen">Сгенерировать и слушать</button>
    <p id="lst-status" class="status"></p>
    <div id="lst-out"></div>
  `;
  container.querySelector('#lst-gen').onclick = () => generate(container);
}

registerFeature({ id: 'listening', title: 'Аудио', icon: '🎧', order: 30, render });
```

- [ ] **Step 2: Commit**

```bash
git add js/listening.js
git commit -m "feat: audio screen (AI dialogue, role playback, transcript, comprehension)"
```

---

## Task 6: Экран «Грамматика» (`js/grammar.js`)

**Files:**
- Create: `js/grammar.js`

**Interfaces:**
- Consumes: `registerFeature` (app.js), `checkGrammar` (claude.js), `addMistake` (db.js), `escapeHtml` (util.js).
- Produces: регистрирует экран `grammar` (Грамматика, `order: 40`). При `ok === false` сохраняет запись в `mistakes`: `{ phrase, corrected, topic, createdAt }`.

- [ ] **Step 1: Реализовать `js/grammar.js`**

```js
import { registerFeature } from './app.js';
import { checkGrammar } from './claude.js';
import { addMistake } from './db.js';
import { escapeHtml } from './util.js';

async function check(container) {
  const input = container.querySelector('#gr-input').value.trim();
  if (!input) return;
  const status = container.querySelector('#gr-status');
  const out = container.querySelector('#gr-out');
  status.textContent = 'Проверяю…';
  out.innerHTML = '';
  try {
    const r = await checkGrammar(input);
    if (!container.querySelector('#gr-out')) return; // ушли на другой экран
    status.textContent = '';
    const e = escapeHtml;
    out.innerHTML = `
      <div class="study-card">
        <div class="${r.ok ? 'gr-ok' : 'gr-bad'}">${r.ok ? '✅ Верно' : '✏️ Есть что поправить'}</div>
        ${r.corrected ? `<div class="study-es"><b>${e(r.corrected)}</b></div>` : ''}
        ${r.explanation ? `<div class="word-ex">${e(r.explanation)}</div>` : ''}
        ${r.topic ? `<div class="word-local">📌 Тема: ${e(r.topic)}</div>` : ''}
      </div>`;
    if (r.ok === false) {
      await addMistake({ phrase: input, corrected: r.corrected || '', topic: r.topic || '', createdAt: Date.now() });
    }
  } catch (err) {
    status.textContent = err.message;
  }
}

async function render(container) {
  container.innerHTML = `
    <h1>Грамматика</h1>
    <label>Напиши фразу на испанском — проверю
      <textarea id="gr-input" rows="3" placeholder="напр. Ayer yo voy a la playa"></textarea>
    </label>
    <button id="gr-check">Проверить</button>
    <p id="gr-status" class="status"></p>
    <div id="gr-out"></div>
  `;
  container.querySelector('#gr-check').onclick = () => check(container);
}

registerFeature({ id: 'grammar', title: 'Грамматика', icon: '✍️', order: 40, render });
```

- [ ] **Step 2: Commit**

```bash
git add js/grammar.js
git commit -m "feat: grammar screen (AI check, Russian explanation, mistake logging)"
```

---

## Task 7: Интеграция, кэш, стили, проверка

**Files:**
- Modify: `index.html`, `sw.js`, `css/styles.css`

**Interfaces:**
- Consumes: все модули выше.

- [ ] **Step 1: Подключить экраны в `index.html`**

Найти блок импортов (из Плана 2):
```js
    import { startApp } from './js/app.js';
    import './js/study.js';
    import './js/dictionary.js';
    import './js/settings.js';
    startApp();
```
Заменить на:
```js
    import { startApp } from './js/app.js';
    import './js/study.js';
    import './js/dictionary.js';
    import './js/listening.js';
    import './js/grammar.js';
    import './js/settings.js';
    startApp();
```

- [ ] **Step 2: Обновить кэш в `sw.js`**

Заменить `const CACHE = 'espanol-v2';` на `const CACHE = 'espanol-v3';`.
В массив `SHELL` добавить (после строки с `'./js/dictionary.js', './js/study.js',`):
```js
  './js/listening.js', './js/grammar.js',
```

- [ ] **Step 3: Добавить стили в конец `css/styles.css`**

```css
textarea { width:100%; padding:12px; margin-top:6px; border-radius:10px; border:1px solid #334155;
  background:var(--card); color:var(--fg); font-size:16px; font-family:inherit; }
.dlg-controls { display:flex; gap:8px; margin:10px 0; flex-wrap:wrap; }
.dlg-line { margin:8px 0; line-height:1.4; }
.dlg-speaker { color:var(--accent); font-weight:600; margin-right:6px; }
.dlg-ru { display:block; margin-left:8px; }
.dlg-q { margin-top:14px; }
.opt { flex:1; }
.opt.ok { background:#22c55e; color:#06210f; }
button.ok { background:#22c55e; }
.gr-ok { color:#22c55e; font-weight:600; }
.gr-bad { color:#fbbf24; font-weight:600; }
```

- [ ] **Step 4: Прогнать тесты**

Run: `npm test`
Expected: PASS — `lang`, `util`, `srs` зелёные, 0 провалов (новые модули — браузерные/AI, юнит-тестов не добавляют).

- [ ] **Step 5: Ручная проверка в Chrome**

Run: `npm start` (http://localhost:3000), затем:
- Внизу пять вкладок: 🎓 Учить · 📖 Словарь · 🎧 Аудио · ✍️ Грамматика · ⚙️ Настройки.
- Аудио: выбрать тему «В баре…» → «Сгенерировать и слушать» → появляется диалог (реплики ES). «▶︎ Прослушать» озвучивает по ролям (разный тон), «⏹» останавливает. «Показать перевод» показывает/прячет RU. Вопрос на понимание: клик по варианту подсвечивает верный/неверный. Видна местная заметка 📍.
- Грамматика: ввести `Ayer yo voy a la playa` → «Проверить» → карточка с исправлением (`Ayer fui a la playa`), объяснением по-русски и темой. DevTools → Application → IndexedDB → `espanol` → `mistakes`: появилась запись с `phrase, corrected, topic, createdAt`.
- Ввести верную фразу (`Hola, ¿cómo estás?`) → «✅ Верно», запись в `mistakes` НЕ добавляется.

- [ ] **Step 6: Commit**

```bash
git add index.html sw.js css/styles.css
git commit -m "feat: wire audio and grammar screens, cache v3, styles"
```

---

## Self-Review

**Spec coverage (План 3 = «Аудио» + «Грамматика» из спецификации):**
- AI-диалог с местным колоритом, уровень A2–B1 → Tasks 1, 2, 5. ✔
- Озвучка диалога (TTS), воспроизведение по ролям → Tasks 4, 5. ✔
- Транскрипт по кнопке + вопрос на понимание → Task 5. ✔
- Проверка грамматики с объяснением по-русски → Tasks 1, 2, 6. ✔
- Лог ошибок в «слабые темы» (для Прогресса в Плане 4) → Tasks 3, 6. ✔
- Расширяемость: новые экраны через реестр, `app.js` не тронут → Tasks 5, 6. ✔
- Безопасная вставка в DOM (escapeHtml) и guard от навигации после await → Tasks 5, 6. ✔
- Офлайн-кэш новых файлов → Task 7. ✔
- (Логопед/фонетика и Прогресс — План 4. Напоминания убраны из scope.)

**Placeholder scan:** Полный код во всех шагах. Ошибки AI/JSON ловятся и показываются в статусе. Нет TODO без кода.

**Type consistency:** `DIALOGUE_SYSTEM`/`GRAMMAR_SYSTEM` (Task 1) → используются в Task 2; `generateDialogue`/`checkGrammar` (Task 2) → в Tasks 5, 6; `addMistake` (Task 3) → в Task 6; `speakSequence`/`stopSpeaking` (Task 4) → в Task 5; форма диалога (`title, lines[{speaker,es,ru}], question, options, answer, notes`) согласована между Task 2 и Task 5; форма ответа грамматики (`ok, corrected, explanation, topic`) — между Task 2 и Task 6; запись ошибки (`phrase, corrected, topic, createdAt`) — между Task 6 и стором из Task 3. ✔
