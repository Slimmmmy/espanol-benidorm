# Español Benidorm — План 6: Ассистент-учитель (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Вкладка «Учитель» — ассистент строит «профиль уровня» автоматически из накопленных данных, рекомендует следующую тему по слабым местам, генерирует адаптивный урок (объяснение + 3–5 упражнений), проверяет ответы, обновляет профиль и историю уроков.

**Architecture:** Поверх Планов 1–5. Новый экран через существующий реестр. Профиль и история хранятся в `settings` (`teacherProfile`, `lessonHistory`) — без миграции БД. Слабые темы берутся из существующего `getStats().weak` (агрегат стора `mistakes`). Урок и проверка — через `callClaude` + `extractJson`. Рекомендация темы — чистая функция `pickNextTopic` (юнит-тест).

**Tech Stack:** HTML/CSS/JS (ES-модули, без сборки), IndexedDB, Claude Messages API, Node 20 `node --test`. Целевой браузер — Chrome.

## Global Constraints

- Интерфейс на русском; без сборки (нативные ES-модули); без бэкенда; ключи не коммитить.
- Любой динамический текст (пользователь/модель) — в DOM только через `escapeHtml`/`textContent`; значения модели в атрибутах (class и т.п.) приводить к ожидаемому типу (`!!`, `Number`) перед вставкой.
- AI-структуры приходят JSON и разбираются через `extractJson`; ошибки показываются в статусе; обработчики после `await` проверяют, что экран ещё на месте (guard).
- Модель по умолчанию `claude-haiku-4-5` (внутри `callClaude`).
- Чистые функции — тесты `node --test`; экран/AI — ручной чек-лист (Chrome). Существующие 28 тестов должны остаться зелёными.
- Экран регистрируется через реестр; `js/app.js` НЕ менять.
- Порядок вкладок (`order`): **Учитель(5)**, Учить(10), 5 слов(15), Словарь(20), Аудио(30), Логопед(35), Грамматика(40), Прогресс(50), Настройки(90).
- Существующие интерфейсы (использовать как есть):
  - `js/app.js`: `registerFeature({ id, title, icon, order, render })`
  - `js/claude.js`: `callClaude(...)`; `extractJson` уже импортирован; импорт промптов: `import { WORD_ENRICH_SYSTEM, DIALOGUE_SYSTEM, GRAMMAR_SYSTEM, SPEECH_COACH_SYSTEM, DAILY_WORDS_SYSTEM } from './prompts.js';`
  - `js/db.js`: `getSetting(key)`, `setSetting(key,value)`
  - `js/stats.js`: `getStats()→{ words, learned, due, streak, weak:[{topic,count}] }`
  - `js/util.js`: `escapeHtml(str)`
- Рабочая директория: `/Users/nik/Downloads/EspanolBenidorm`, ветка `plan-6-teacher`.

---

## File Structure (этот план)

- `js/profile.js` — `pickNextTopic` (чистая, **тест**), `buildProfile`, `saveProfileNote`, `recordLesson`, `getLessonHistory`
- `js/prompts.js` — добавить `LESSON_GEN_SYSTEM`, `LESSON_REVIEW_SYSTEM`
- `js/claude.js` — добавить `generateLesson(profile, topic)`, `reviewLesson(lesson, answers)`
- `js/teacher.js` — экран «Учитель»
- `index.html` — подключить `teacher.js`
- `sw.js` — кэш `profile.js`, `teacher.js` + версия `espanol-v6`
- `css/styles.css` — стили урока и упражнений
- `test/profile.test.js` — тест `pickNextTopic`

---

## Task 1: Профиль ученика (`js/profile.js`)

**Files:**
- Create: `js/profile.js`, `test/profile.test.js`

**Interfaces:**
- Consumes: `getSetting`/`setSetting` (db.js), `getStats` (stats.js).
- Produces:
  - `pickNextTopic(weak: {topic,count}[], lastTopic: string): string` — тема с наибольшим `count`, не равная `lastTopic`; если все равны/пусто — `weak[0]` или `'Общая практика грамматики'` (чистая).
  - `buildProfile(): Promise<{ level, words, learned, weak, note, lastTopic, lessonsCompleted }>`
  - `saveProfileNote(note: string, lastTopic?: string): Promise<void>` — пишет в `settings.teacherProfile`.
  - `recordLesson(entry: { topic, date, score }): Promise<void>` — добавляет в `settings.lessonHistory`.
  - `getLessonHistory(): Promise<object[]>`

- [ ] **Step 1: Написать падающий тест**

`test/profile.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickNextTopic } from '../js/profile.js';

test('pickNextTopic: пусто → общая практика', () => {
  assert.equal(pickNextTopic([], ''), 'Общая практика грамматики');
});

test('pickNextTopic: самая частая слабая тема', () => {
  const weak = [{ topic: 'согласование рода', count: 3 }, { topic: 'спряжение', count: 1 }];
  assert.equal(pickNextTopic(weak, ''), 'согласование рода');
});

test('pickNextTopic: пропускает только что пройденную тему', () => {
  const weak = [{ topic: 'согласование рода', count: 3 }, { topic: 'спряжение', count: 1 }];
  assert.equal(pickNextTopic(weak, 'согласование рода'), 'спряжение');
});

test('pickNextTopic: единственная тема = последняя → всё равно возвращается', () => {
  const weak = [{ topic: 'спряжение', count: 2 }];
  assert.equal(pickNextTopic(weak, 'спряжение'), 'спряжение');
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `node --test test/profile.test.js`
Expected: FAIL — `Cannot find module '../js/profile.js'`.

- [ ] **Step 3: Реализовать `js/profile.js`**

```js
import { getSetting, setSetting } from './db.js';
import { getStats } from './stats.js';

export function pickNextTopic(weak, lastTopic) {
  if (!weak || weak.length === 0) return 'Общая практика грамматики';
  const sorted = [...weak].sort((a, b) => b.count - a.count);
  const pick = sorted.find((w) => w.topic !== lastTopic) || sorted[0];
  return pick.topic;
}

export async function buildProfile() {
  const stats = await getStats();
  const level = (await getSetting('level')) || 'A2-B1';
  const tp = (await getSetting('teacherProfile')) || {};
  const history = (await getSetting('lessonHistory')) || [];
  return {
    level,
    words: stats.words,
    learned: stats.learned,
    weak: stats.weak,
    note: tp.note || '',
    lastTopic: tp.lastTopic || '',
    lessonsCompleted: history.length,
  };
}

export async function saveProfileNote(note, lastTopic) {
  const tp = (await getSetting('teacherProfile')) || {};
  tp.note = note;
  if (lastTopic) tp.lastTopic = lastTopic;
  tp.updatedAt = Date.now();
  await setSetting('teacherProfile', tp);
}

export async function recordLesson(entry) {
  const history = (await getSetting('lessonHistory')) || [];
  history.push(entry);
  await setSetting('lessonHistory', history);
}

export async function getLessonHistory() {
  return (await getSetting('lessonHistory')) || [];
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `node --test test/profile.test.js`
Expected: PASS — 4 теста зелёные.

- [ ] **Step 5: Commit**

```bash
git add js/profile.js test/profile.test.js
git commit -m "feat: learner profile module with pickNextTopic and tests"
```

---

## Task 2: Промпты и AI урока (`js/prompts.js`, `js/claude.js`)

**Files:**
- Modify: `js/prompts.js` (добавить две константы)
- Modify: `js/claude.js` (расширить импорт + добавить две функции)

**Interfaces:**
- Consumes: `callClaude`, `extractJson`, `LESSON_GEN_SYSTEM`, `LESSON_REVIEW_SYSTEM`.
- Produces:
  - `generateLesson(profile: object, topic: string): Promise<{ topic, explanation, exercises:[{type:'choice'|'open', prompt, options?, answer?, expected?}] }>`
  - `reviewLesson(lesson: object, answers: string[]): Promise<{ results:[{correct,comment}], summary, nextTopic, profileNote }>`

- [ ] **Step 1: Добавить в конец `js/prompts.js`**

```js
export const LESSON_GEN_SYSTEM = `Ты — персональный преподаватель испанского для русскоязычного ученика. Тебе дают профиль ученика (уровень, выучено слов, слабые темы, заметка о прогрессе) и тему урока. Составь короткий адаптивный урок по этой теме под уровень ученика.
Верни СТРОГО один JSON-объект, без markdown:
{
  "topic": "тема урока по-русски",
  "explanation": "объяснение правила по-русски, с 2-3 примерами на испанском",
  "exercises": [
    { "type": "choice", "prompt": "предложение с пропуском или вопрос", "options": ["вариант 1", "вариант 2", "вариант 3"], "answer": 0 },
    { "type": "open", "prompt": "задание со свободным ответом (например: переведи на испанский: ...)", "expected": "эталонный ответ на испанском" }
  ]
}
Сделай 3-5 упражнений, смесь типов "choice" и "open". Для "choice" поле "answer" — индекс правильного варианта (0,1,2). Только валидный JSON.`;

export const LESSON_REVIEW_SYSTEM = `Ты проверяешь выполнение урока испанского русскоязычным учеником A2–B1. Тебе дают тему, упражнения с эталонными ответами и ответы ученика (по порядку).
Оцени каждое упражнение и верни СТРОГО один JSON-объект, без markdown:
{
  "results": [ { "correct": true, "comment": "короткий разбор по-русски" } ],
  "summary": "итог урока и что подтянуть, по-русски",
  "nextTopic": "рекомендуемая следующая тема по-русски",
  "profileNote": "обновлённая краткая заметка о текущем уровне и слабых местах ученика, 1-2 предложения по-русски"
}
Массив "results" — по числу упражнений в том же порядке. Только валидный JSON.`;
```

- [ ] **Step 2: Расширить импорт промптов в `js/claude.js`**

Заменить строку:
```js
import { WORD_ENRICH_SYSTEM, DIALOGUE_SYSTEM, GRAMMAR_SYSTEM, SPEECH_COACH_SYSTEM, DAILY_WORDS_SYSTEM } from './prompts.js';
```
на:
```js
import { WORD_ENRICH_SYSTEM, DIALOGUE_SYSTEM, GRAMMAR_SYSTEM, SPEECH_COACH_SYSTEM, DAILY_WORDS_SYSTEM, LESSON_GEN_SYSTEM, LESSON_REVIEW_SYSTEM } from './prompts.js';
```

- [ ] **Step 3: Добавить функции в конец `js/claude.js`**

```js
export async function generateLesson(profile, topic) {
  const text = await callClaude({
    system: LESSON_GEN_SYSTEM,
    messages: [{ role: 'user', content: `Профиль ученика: ${JSON.stringify(profile)}\nТема урока: ${topic}` }],
    maxTokens: 1200,
  });
  return extractJson(text);
}

export async function reviewLesson(lesson, answers) {
  const items = (lesson.exercises || []).map((ex, i) => ({
    prompt: ex.prompt,
    expected: ex.type === 'choice' ? (ex.options || [])[ex.answer] : ex.expected,
    answer: answers[i] || '',
  }));
  const text = await callClaude({
    system: LESSON_REVIEW_SYSTEM,
    messages: [{ role: 'user', content: `Тема: ${lesson.topic}\nУпражнения и ответы ученика: ${JSON.stringify(items)}` }],
    maxTokens: 900,
  });
  return extractJson(text);
}
```

- [ ] **Step 4: Проверка импорта в Node**

Run: `node --input-type=module -e "import('./js/claude.js').then(m=>console.log(typeof m.generateLesson, typeof m.reviewLesson))"`
Expected: `function function`.

- [ ] **Step 5: Commit**

```bash
git add js/prompts.js js/claude.js
git commit -m "feat: generateLesson and reviewLesson AI calls"
```

---

## Task 3: Экран «Учитель» (`js/teacher.js`)

**Files:**
- Create: `js/teacher.js`

**Interfaces:**
- Consumes: `registerFeature` (app.js), `buildProfile`/`saveProfileNote`/`recordLesson`/`pickNextTopic` (profile.js), `generateLesson`/`reviewLesson` (claude.js), `escapeHtml` (util.js).
- Produces: регистрирует экран `teacher` (Учитель, `order: 5`).

- [ ] **Step 1: Реализовать `js/teacher.js`**

```js
import { registerFeature } from './app.js';
import { buildProfile, saveProfileNote, recordLesson, pickNextTopic } from './profile.js';
import { generateLesson, reviewLesson } from './claude.js';
import { escapeHtml } from './util.js';

let lesson = null;

function exerciseHtml(ex, i) {
  const e = escapeHtml;
  if (ex.type === 'choice') {
    const opts = (ex.options || []).map((o, j) =>
      `<label class="opt-row"><input type="radio" name="ex${i}" value="${j}"> ${e(o)}</label>`).join('');
    return `<div class="lesson-ex"><div class="ex-prompt">${i + 1}. ${e(ex.prompt)}</div>${opts}</div>`;
  }
  return `<div class="lesson-ex"><div class="ex-prompt">${i + 1}. ${e(ex.prompt)}</div><textarea data-open="${i}" rows="2" placeholder="Твой ответ…"></textarea></div>`;
}

function collectAnswers(container) {
  return lesson.exercises.map((ex, i) => {
    if (ex.type === 'choice') {
      const sel = container.querySelector(`input[name="ex${i}"]:checked`);
      return sel ? ((ex.options || [])[Number(sel.value)] || '') : '';
    }
    const ta = container.querySelector(`[data-open="${i}"]`);
    return ta ? ta.value.trim() : '';
  });
}

function renderLesson(container) {
  const e = escapeHtml;
  container.innerHTML = `
    <h1>Урок: ${e(lesson.topic)}</h1>
    <div class="study-card"><div class="word-ex">${e(lesson.explanation)}</div></div>
    <div id="tch-ex">${(lesson.exercises || []).map((ex, i) => exerciseHtml(ex, i)).join('')}</div>
    <button id="tch-check">Проверить ответы</button>
    <p id="tch-status" class="status"></p>
    <div id="tch-results"></div>
  `;
  container.querySelector('#tch-check').onclick = () => checkLesson(container);
}

async function checkLesson(container) {
  const status = container.querySelector('#tch-status');
  const answers = collectAnswers(container);
  status.textContent = 'Проверяю…';
  try {
    const r = await reviewLesson(lesson, answers);
    if (!container.querySelector('#tch-results')) return;
    status.textContent = '';
    const e = escapeHtml;
    const results = (r.results || []).map((res, i) =>
      `<div class="lesson-ex"><div class="${res.correct ? 'gr-ok' : 'gr-bad'}">${res.correct ? '✅' : '❌'} ${i + 1}</div><div class="word-ex">${e(res.comment || '')}</div></div>`).join('');
    const total = (r.results || []).length;
    const correct = (r.results || []).filter((x) => x.correct).length;
    container.querySelector('#tch-results').innerHTML = `
      ${results}
      <div class="study-card"><b>Итог: ${correct}/${total}</b>
        <div class="word-ex">${e(r.summary || '')}</div>
        ${r.nextTopic ? `<div class="word-local">▶︎ Следующая тема: ${e(r.nextTopic)}</div>` : ''}
      </div>
      <button id="tch-again">К началу</button>
    `;
    await saveProfileNote(r.profileNote || '', lesson.topic);
    await recordLesson({ topic: lesson.topic, date: Date.now(), score: `${correct}/${total}` });
    const again = container.querySelector('#tch-again');
    if (again) again.onclick = () => render(container);
  } catch (err) {
    const s = container.querySelector('#tch-status');
    if (s) s.textContent = err.message;
  }
}

async function startLesson(container, topic) {
  const status = container.querySelector('#tch-status');
  status.textContent = 'Готовлю урок под твой уровень…';
  try {
    const profile = await buildProfile();
    lesson = await generateLesson(profile, topic);
    if (!container.querySelector('#tch-status')) return;
    renderLesson(container);
  } catch (err) {
    const s = container.querySelector('#tch-status');
    if (s) s.textContent = err.message;
  }
}

async function render(container) {
  container.innerHTML = '<h1>Учитель</h1><p class="status">Анализирую твой уровень…</p>';
  const profile = await buildProfile();
  if (!container.isConnected) return;
  const e = escapeHtml;
  const recommended = pickNextTopic(profile.weak, profile.lastTopic);
  container.innerHTML = `
    <h1>Учитель</h1>
    <div class="study-card">
      <div class="word-ex">Уровень: <b>${e(profile.level)}</b> · выучено слов: <b>${profile.learned}</b> · уроков пройдено: <b>${profile.lessonsCompleted}</b></div>
      ${profile.note ? `<div class="word-local">📝 ${e(profile.note)}</div>` : ''}
    </div>
    <label>Тема следующего урока (рекомендована по твоим слабым местам)
      <input id="tch-topic" type="text" value="${e(recommended)}">
    </label>
    <button id="tch-start">Начать урок</button>
    <p id="tch-status" class="status"></p>
  `;
  container.querySelector('#tch-start').onclick = () => {
    const topic = container.querySelector('#tch-topic').value.trim() || recommended;
    startLesson(container, topic);
  };
}

registerFeature({ id: 'teacher', title: 'Учитель', icon: '👨‍🏫', order: 5, render });
```

- [ ] **Step 2: Commit**

```bash
git add js/teacher.js
git commit -m "feat: teacher assistant screen (adaptive lessons, review, profile update)"
```

---

## Task 4: Интеграция, кэш, стили, проверка

**Files:**
- Modify: `index.html`, `sw.js`, `css/styles.css`

- [ ] **Step 1: Подключить экран в `index.html`**

Найти блок импортов (из Плана 5):
```js
    import { startApp } from './js/app.js';
    import './js/study.js';
    import './js/daily.js';
    import './js/dictionary.js';
    import './js/listening.js';
    import './js/speech.js';
    import './js/grammar.js';
    import './js/progress.js';
    import './js/settings.js';
    startApp();
```
Заменить на (добавлена строка `./js/teacher.js` первой):
```js
    import { startApp } from './js/app.js';
    import './js/teacher.js';
    import './js/study.js';
    import './js/daily.js';
    import './js/dictionary.js';
    import './js/listening.js';
    import './js/speech.js';
    import './js/grammar.js';
    import './js/progress.js';
    import './js/settings.js';
    startApp();
```

- [ ] **Step 2: Обновить кэш в `sw.js`**

Заменить `const CACHE = 'espanol-v5';` на `const CACHE = 'espanol-v6';`.
В массив `SHELL` добавить (после строки с `'./js/daily.js',`):
```js
  './js/profile.js', './js/teacher.js',
```

- [ ] **Step 3: Добавить стили в конец `css/styles.css`**

```css
.lesson-ex { margin:14px 0; }
.ex-prompt { font-weight:600; margin-bottom:6px; }
.opt-row { display:block; margin:5px 0; color:var(--fg); font-weight:400; cursor:pointer; }
.opt-row input { width:auto; margin-right:8px; }
```

- [ ] **Step 4: Прогнать все тесты**

Run: `npm test`
Expected: PASS — `lang`, `util`, `srs`, `stats`, `profile` зелёные (28 прежних + 4 новых = 32), 0 провалов.

- [ ] **Step 5: Ручная проверка в Chrome**

Run: `npm start` (http://localhost:3000), затем:
- Внизу первая вкладка 👨‍🏫 «Учитель».
- Открыть: «Анализирую твой уровень…» → карточка профиля (уровень, выучено слов, уроков пройдено) + поле «Тема следующего урока», предзаполненное рекомендованной темой (если есть ошибки в Грамматике — самой частой слабой темой).
- «Начать урок» → «Готовлю урок…» → объяснение по-русски + 3–5 упражнений (часть с радио-вариантами, часть со свободным ответом).
- Ответить, «Проверить ответы» → по каждому ✅/❌ с разбором, итог N/M, резюме, рекомендованная следующая тема.
- DevTools → Application → IndexedDB → `espanol` → `settings`: появились `teacherProfile` (с `note`, `lastTopic`) и `lessonHistory` (с записью урока).
- «К началу» → снова домашний экран «Учителя»; поле темы теперь учитывает пройденную тему (рекомендация может смениться).

- [ ] **Step 6: Commit**

```bash
git add index.html sw.js css/styles.css
git commit -m "feat: wire teacher screen, cache v6, lesson styles"
```

---

## Self-Review

**Spec coverage (План 6 = §14 «Ассистент-учитель»):**
- «Профиль уровня» авто из данных (уровень, выучено, слабые темы, заметка, число уроков) → Tasks 1, 3 (`buildProfile`). ✔
- Рекомендация следующей темы по слабым местам → Tasks 1, 3 (`pickNextTopic` от `getStats().weak`). ✔
- Генерация адаптивного урока (объяснение + 3–5 упражнений) → Tasks 2, 3 (`generateLesson`). ✔
- Проверка ответов с разбором → Tasks 2, 3 (`reviewLesson`). ✔
- Обновление профиля и истории уроков → Tasks 1, 3 (`saveProfileNote`, `recordLesson`). ✔
- Расширяемость: экран через реестр, `app.js` не тронут → Task 3. ✔
- Безопасная вставка (escapeHtml) + приведение `res.correct` к bool в class + guard после await → Task 3. ✔
- Без миграции БД (профиль/история в `settings`) → Task 1. ✔
- Офлайн-кэш новых файлов → Task 4. ✔

**Placeholder scan:** Полный код во всех шагах. Ошибки AI ловятся и показываются. Нет TODO без кода.

**Type consistency:** `pickNextTopic`/`buildProfile`/`saveProfileNote`/`recordLesson` (Task 1) → Task 3; `LESSON_GEN_SYSTEM`/`LESSON_REVIEW_SYSTEM` (Task 2) → claude импорт в Task 2; `generateLesson`/`reviewLesson` (Task 2) → Task 3; форма урока (`topic, explanation, exercises[{type,prompt,options,answer,expected}]`) согласована между Task 2 (`reviewLesson` маппинг) и Task 3 (`exerciseHtml`/`collectAnswers`); форма ревью (`results[{correct,comment}], summary, nextTopic, profileNote`) — между Task 2 и Task 3. ✔
