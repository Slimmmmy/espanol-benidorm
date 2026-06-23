# Español Benidorm — План 10: Задания (домашка) (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Вкладка «Задания» — наставник выдаёт практичные задачи (по слабым темам и быту Бенидорма), они копятся в списке со статусами; ученик отвечает когда удобно, наставник проверяет и отмечает «выполнено» с разбором. Хранение в `settings.assignments` (синхронизируется, без миграции БД).

**Architecture:** Поверх Планов 1–9. Новый экран через реестр. AI: `generateAssignment(profile, topic)` и `checkAssignment(task, answer)` поверх `callClaude`+`extractJson`. Чистая `partitionAssignments` (open/done) с тестом; хранилище в `profile.js`.

**Tech Stack:** HTML/CSS/JS (ES-модули, без сборки), IndexedDB, Claude API, Node 20 `node --test`.

## Global Constraints

- Интерфейс на русском; без сборки; без бэкенда; ключи не коммитить.
- Любой текст (пользователь/модель) — в DOM только через `escapeHtml`; значения модели в class — через `!!` при необходимости.
- AI-структуры — JSON через `extractJson`; ошибки показываются; обработчики после `await` проверяют экран (`#asg-loading`/`#asg-list`).
- Двойной запуск блокируется `busy`.
- Модель по умолчанию `claude-haiku-4-5`.
- Чистые функции — тесты `node --test`; экран/AI — ручной чек-лист. Существующие 45 тестов остаются зелёными.
- `js/app.js` НЕ менять. Вкладка «Задания» — `order: 45` (попадает в «Ещё», главные 5 не меняются).
- Существующие интерфейсы:
  - `js/app.js`: `registerFeature(...)`
  - `js/claude.js`: `callClaude(...)`; `import { extractJson, recentMessages } from './util.js';`; промпты одной строкой из `./prompts.js`
  - `js/profile.js`: `buildProfile()`; использует `getSetting`/`setSetting`
  - `js/util.js`: `escapeHtml`
- Рабочая директория: `/Users/nik/Downloads/EspanolBenidorm`, ветка `plan-10-assignments`.

---

## File Structure (этот план)

- `js/profile.js` — добавить `partitionAssignments` (чистая, **тест**), `getAssignments`, `saveAssignments`
- `js/prompts.js` — добавить `ASSIGNMENT_GEN_SYSTEM`, `ASSIGNMENT_CHECK_SYSTEM`
- `js/claude.js` — добавить `generateAssignment(profile, topic)`, `checkAssignment(task, answer)`
- `js/assignments.js` — экран «Задания»
- `index.html` — подключить `assignments.js`
- `sw.js` — кэш `assignments.js` + версия `espanol-v11`
- `test/profile.test.js` — тесты `partitionAssignments`

---

## Task 1: Хранилище заданий (`js/profile.js`)

**Files:**
- Modify: `js/profile.js` (добавить функции в конец)
- Modify: `test/profile.test.js` (добавить тесты)

**Interfaces:**
- Produces:
  - `partitionAssignments(list): { open: object[], done: object[] }` — `open` = `status !== 'done'`, `done` = `status === 'done'` (чистая).
  - `getAssignments(): Promise<object[]>` — `settings.assignments` или `[]`.
  - `saveAssignments(list): Promise<void>`.

- [ ] **Step 1: Добавить тесты в конец `test/profile.test.js`**

```js
import { partitionAssignments } from '../js/profile.js';

test('partitionAssignments: делит на open/done', () => {
  const list = [{ id: 1, status: 'open' }, { id: 2, status: 'done' }, { id: 3, status: 'open' }];
  const { open, done } = partitionAssignments(list);
  assert.deepEqual(open.map((a) => a.id), [1, 3]);
  assert.deepEqual(done.map((a) => a.id), [2]);
});

test('partitionAssignments: пусто/undefined → пустые массивы', () => {
  assert.deepEqual(partitionAssignments([]), { open: [], done: [] });
  assert.deepEqual(partitionAssignments(undefined), { open: [], done: [] });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `node --test test/profile.test.js`
Expected: FAIL — `partitionAssignments` не экспортирован.

- [ ] **Step 3: Добавить функции в конец `js/profile.js`**

```js
export function partitionAssignments(list) {
  const arr = Array.isArray(list) ? list : [];
  return {
    open: arr.filter((a) => a.status !== 'done'),
    done: arr.filter((a) => a.status === 'done'),
  };
}

export async function getAssignments() {
  return (await getSetting('assignments')) || [];
}

export async function saveAssignments(list) {
  await setSetting('assignments', list);
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `node --test test/profile.test.js`
Expected: PASS — прежние + 2 новых теста зелёные.

- [ ] **Step 5: Commit**

```bash
git add js/profile.js test/profile.test.js
git commit -m "feat: assignments storage and partitionAssignments with tests"
```

---

## Task 2: Промпты и AI заданий (`js/prompts.js`, `js/claude.js`)

**Files:**
- Modify: `js/prompts.js` (добавить две константы)
- Modify: `js/claude.js` (расширить импорт промптов + добавить две функции)

**Interfaces:**
- Consumes: `callClaude`, `extractJson`, `ASSIGNMENT_GEN_SYSTEM`, `ASSIGNMENT_CHECK_SYSTEM`.
- Produces:
  - `generateAssignment(profile, topic): Promise<{ text, topic }>`
  - `checkAssignment(task, answer): Promise<{ ok, feedback }>`

- [ ] **Step 1: Добавить в конец `js/prompts.js`**

```js
export const ASSIGNMENT_GEN_SYSTEM = `Ты — преподаватель испанского. Составь ОДНО короткое практичное домашнее задание для русскоязычного ученика A2–B1 из района Бенидорма: попроси написать, перевести или составить что-то на испанском по бытовой ситуации или по слабой теме ученика.
Верни СТРОГО один JSON-объект, без markdown:
{ "text": "формулировка задания по-русски — что именно сделать", "topic": "краткая тема по-русски" }
Только валидный JSON.`;

export const ASSIGNMENT_CHECK_SYSTEM = `Ты проверяешь домашнее задание по испанскому у ученика A2–B1. Тебе дают формулировку задания и ответ ученика. Оцени, дай короткий разбор по-русски и покажи правильный/улучшенный вариант на испанском.
Верни СТРОГО один JSON-объект, без markdown:
{ "ok": true|false, "feedback": "разбор по-русски + правильный вариант на испанском" }
Только валидный JSON.`;
```

- [ ] **Step 2: Расширить импорт промптов в `js/claude.js`**

В строке `import { ... } from './prompts.js';` добавить в конец списка: `ASSIGNMENT_GEN_SYSTEM, ASSIGNMENT_CHECK_SYSTEM`.

- [ ] **Step 3: Добавить функции в конец `js/claude.js`**

```js
export async function generateAssignment(profile, topic) {
  const text = await callClaude({
    system: ASSIGNMENT_GEN_SYSTEM,
    messages: [{ role: 'user', content: `Профиль ученика: ${JSON.stringify(profile)}\nТема (если задана): ${topic || '(на твой выбор по слабым местам)'}` }],
    maxTokens: 400,
  });
  return extractJson(text);
}

export async function checkAssignment(task, answer) {
  const text = await callClaude({
    system: ASSIGNMENT_CHECK_SYSTEM,
    messages: [{ role: 'user', content: `Задание: ${task}\nОтвет ученика: ${answer}` }],
    maxTokens: 500,
  });
  return extractJson(text);
}
```

- [ ] **Step 4: Проверка импорта в Node**

Run: `node --input-type=module -e "import('./js/claude.js').then(m=>console.log(typeof m.generateAssignment, typeof m.checkAssignment))"`
Expected: `function function`.

- [ ] **Step 5: Commit**

```bash
git add js/prompts.js js/claude.js
git commit -m "feat: generateAssignment and checkAssignment AI calls"
```

---

## Task 3: Экран «Задания» (`js/assignments.js`)

**Files:**
- Create: `js/assignments.js`

**Interfaces:**
- Consumes: `registerFeature` (app.js), `buildProfile`/`getAssignments`/`saveAssignments`/`partitionAssignments` (profile.js), `generateAssignment`/`checkAssignment` (claude.js), `escapeHtml` (util.js).
- Produces: экран `assignments` (Задания, `order: 45`). Запись: `{ id, text, topic, status:'open'|'done', createdAt, answer, feedback, ok, doneAt }`.

- [ ] **Step 1: Реализовать `js/assignments.js`**

```js
import { registerFeature } from './app.js';
import { buildProfile, getAssignments, saveAssignments, partitionAssignments } from './profile.js';
import { generateAssignment, checkAssignment } from './claude.js';
import { escapeHtml } from './util.js';

let busy = false;

function openHtml(a) {
  const e = escapeHtml;
  return `<div class="word-card">
    <div class="word-main">📝 ${e(a.text)}</div>
    ${a.topic ? `<div class="word-local">📌 ${e(a.topic)}</div>` : ''}
    <textarea data-answer="${e(a.id)}" rows="3" placeholder="Твой ответ на испанском…"></textarea>
    <button data-submit="${e(a.id)}">Сдать на проверку</button>
    <div class="daily-feedback" data-fb="${e(a.id)}"></div>
  </div>`;
}

function doneHtml(a) {
  const e = escapeHtml;
  return `<div class="word-card">
    <div class="word-main">${a.ok ? '✅' : '☑️'} ${e(a.text)}</div>
    ${a.answer ? `<div class="word-ex">Твой ответ: ${e(a.answer)}</div>` : ''}
    ${a.feedback ? `<div class="word-ex">${e(a.feedback)}</div>` : ''}
  </div>`;
}

async function newAssignment(container) {
  if (busy) return;
  busy = true;
  const topicEl = container.querySelector('#asg-topic');
  const topic = topicEl ? topicEl.value.trim() : '';
  const status = container.querySelector('#asg-status');
  if (status) status.textContent = 'Готовлю задание…';
  try {
    const profile = await buildProfile();
    const a = await generateAssignment(profile, topic);
    const list = await getAssignments();
    list.push({ id: `a${Date.now()}`, text: a.text || '', topic: a.topic || topic || '', status: 'open', createdAt: Date.now() });
    await saveAssignments(list);
    if (!container.querySelector('#asg-list')) return;
    render(container);
  } catch (err) {
    const s = container.querySelector('#asg-status');
    if (s) s.textContent = err.message;
  } finally {
    busy = false;
  }
}

async function submit(container, id) {
  if (busy) return;
  const fb = container.querySelector(`[data-fb="${id}"]`);
  const ta = container.querySelector(`[data-answer="${id}"]`);
  const answer = ta ? ta.value.trim() : '';
  if (!answer) { if (fb) fb.textContent = 'Напиши ответ.'; return; }
  busy = true;
  if (fb) fb.textContent = 'Проверяю…';
  try {
    const list = await getAssignments();
    const a = list.find((x) => x.id === id);
    if (!a) return;
    const r = await checkAssignment(a.text, answer);
    a.status = 'done';
    a.answer = answer;
    a.feedback = r.feedback || '';
    a.ok = !!r.ok;
    a.doneAt = Date.now();
    await saveAssignments(list);
    if (!container.querySelector('#asg-list')) return;
    render(container);
  } catch (err) {
    const box = container.querySelector(`[data-fb="${id}"]`);
    if (box) box.textContent = err.message;
  } finally {
    busy = false;
  }
}

async function render(container) {
  container.innerHTML = '<h1>Задания</h1><p class="status" id="asg-loading">Загрузка…</p>';
  const list = await getAssignments();
  if (!container.querySelector('#asg-loading')) return;
  const { open, done } = partitionAssignments(list);
  container.innerHTML = `
    <h1>Задания</h1>
    <label>Тема (необязательно)<input id="asg-topic" type="text" placeholder="напр. заказ в баре"></label>
    <button id="asg-new">📝 Получить задание</button>
    <p id="asg-status" class="status"></p>
    <div id="asg-list">
      ${open.length ? `<h2>Текущие</h2>${open.map(openHtml).join('')}` : '<p class="status">Нет активных заданий. Нажми «Получить задание».</p>'}
      ${done.length ? `<details class="tch-extra"><summary>Выполненные (${done.length})</summary>${done.slice().reverse().map(doneHtml).join('')}</details>` : ''}
    </div>
  `;
  container.querySelector('#asg-new').onclick = () => newAssignment(container);
  container.querySelectorAll('[data-submit]').forEach((b) => { b.onclick = () => submit(container, b.dataset.submit); });
}

registerFeature({ id: 'assignments', title: 'Задания', icon: '📝', order: 45, render });
```

- [ ] **Step 2: Commit**

```bash
git add js/assignments.js
git commit -m "feat: assignments screen (issue, answer, AI check, statuses)"
```

---

## Task 4: Интеграция, кэш, проверка

**Files:**
- Modify: `index.html`, `sw.js`

- [ ] **Step 1: Подключить экран в `index.html`**

В блоке импортов после `import './js/grammar.js';` добавить:
```js
    import './js/assignments.js';
```

- [ ] **Step 2: Обновить кэш в `sw.js`**

Заменить `const CACHE = 'espanol-v10';` на `const CACHE = 'espanol-v11';`.
В массив `SHELL` добавить (после `'./js/grammar.js',`):
```js
  './js/assignments.js',
```

- [ ] **Step 3: Прогнать все тесты**

Run: `npm test`
Expected: PASS — все наборы зелёные (45 прежних + 2 новых = 47), 0 провалов.

- [ ] **Step 4: Ручная проверка в Chrome**

Run: `npm start` (http://localhost:3000):
- Вкладка «Задания» доступна через «⋯ Ещё».
- «📝 Получить задание» (можно с темой) → появляется задача в «Текущие».
- Ввести ответ → «Сдать на проверку» → приходит разбор; задание уходит в «Выполненные (N)» (раскрывается).
- DevTools → IndexedDB → `settings` → `assignments` хранит массив с `{id,text,topic,status,answer,feedback,ok,doneAt}`.
- Перезагрузка: задания на месте; без сети/ключа — понятная ошибка, не падает.

- [ ] **Step 5: Commit**

```bash
git add index.html sw.js
git commit -m "feat: wire assignments screen, cache v11"
```

---

## Self-Review

**Spec coverage (План 10 = «Задания»):**
- Наставник выдаёт задачи (по профилю/слабым темам/быту Бенидорма) → Tasks 2, 3 (`generateAssignment`). ✔
- Список со статусами open/done → Tasks 1, 3 (`partitionAssignments`). ✔
- Выполняешь когда удобно, проверка позже с разбором → Tasks 2, 3 (`checkAssignment`). ✔
- Хранение в `settings` (синхронизируется, без миграции) → Task 1. ✔
- Безопасный рендер (escapeHtml), guard после await, `busy` → Tasks 1, 3. ✔
- Новая вкладка через реестр, `app.js` не тронут; офлайн-кэш → Task 4. ✔
- (План на сегодня — План 11; он переиспользует `getAssignments`/`partitionAssignments`.)

**Placeholder scan:** Полный код во всех шагах. Ошибки AI ловятся. Нет TODO без кода.

**Type consistency:** `partitionAssignments`/`getAssignments`/`saveAssignments` (Task 1) → Task 3; `ASSIGNMENT_GEN_SYSTEM`/`ASSIGNMENT_CHECK_SYSTEM` (Task 2) → claude импорт Task 2; `generateAssignment`/`checkAssignment` (Task 2) → Task 3; форма задания (`{id,text,topic,status,createdAt,answer,feedback,ok,doneAt}`) согласована между `newAssignment`/`submit`/`openHtml`/`doneHtml`/`partitionAssignments`. ✔
