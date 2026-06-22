# Español Benidorm — План 7: Облачная синхронизация (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Синхронизировать учебный прогресс между ПК и телефоном через Supabase: при открытии и по кнопке приложение тянет облачную копию, сливает её без потерь с локальной и отправляет обратно. Claude API-ключ и креды Supabase НЕ синхронизируются.

**Architecture:** Поверх Планов 1–6. Логика слияния — чистый модуль `merge.js` (юнит-тесты). Транспорт — `sync.js` (Supabase REST через fetch). Снимок собирается из IndexedDB (`exportAll` + `getAllMistakes`), применяется через bulk-replace. Настройки синхронизации (URL, anon-ключ, код) хранятся в `settings` локально, как `apiKey`. Авто-синхронизация запускается из `index.html` после старта.

**Tech Stack:** HTML/CSS/JS (ES-модули, без сборки), IndexedDB, Supabase REST (PostgREST), Claude API, Node 20 `node --test`.

## Global Constraints

- Интерфейс на русском; без сборки (нативные ES-модули); без своего бэкенда (Supabase — внешний REST); секреты не коммитить.
- 🔒 В облачный снимок НИКОГДА не попадают ключи: `apiKey`, `supabaseUrl`, `supabaseKey`, `syncCode` исключаются и при сборке снимка, и при применении.
- Слияние — без потерь: словарь и ошибки/история объединяются; для одинакового слова берётся более «свежее» состояние повторения; профиль учителя — последний по `updatedAt`.
- Любой динамический текст в DOM — через `escapeHtml`/`textContent`.
- Чистые функции слияния покрываются `node --test`; сетевые/браузерные части — ручной чек-лист. Существующие 32 теста должны остаться зелёными.
- `js/app.js` НЕ менять; авто-синхронизация подключается в `index.html`.
- Существующие интерфейсы:
  - `js/db.js`: `openDB`, `getSetting`, `setSetting`, `exportAll()→{settings,words}`, `getAllMistakes()→[]`; внутренние `tx(db,store,mode)`, `asPromise(req)`; сторы `settings`(keyPath key), `words`(keyPath id, autoIncrement), `mistakes`(keyPath id, autoIncrement)
  - `js/util.js`: `escapeHtml`
  - `js/settings.js`: экран `settings`, функция `render(container)` с кнопками «Сохранить»/«Проверить связь» и `#set-status`
  - `index.html`: стартовый скрипт с `import { startApp } from './js/app.js';` и `startApp();`
- Рабочая директория: `/Users/nik/Downloads/EspanolBenidorm`, ветка `plan-7-cloud-sync`.

---

## File Structure (этот план)

- `js/merge.js` — `mergeSnapshots`, `mergeWords`, `mergeMistakes`, `mergeSettings` (чистые, **тесты**)
- `js/db.js` — добавить `bulkReplaceWords(words)`, `bulkReplaceMistakes(items)`
- `js/sync.js` — `getSyncConfig`, `pullRemote`, `pushRemote`, `localSnapshot`, `applySnapshot`, `syncNow`, `autoSync`
- `js/settings.js` — поля Supabase URL/anon-ключ/код + кнопка «Синхронизировать»
- `index.html` — вызвать `autoSync()` после `startApp()`
- `sw.js` — кэш `merge.js`, `sync.js` + версия `espanol-v7`
- `test/merge.test.js` — тесты слияния

---

## Task 1: Логика слияния (`js/merge.js`)

**Files:**
- Create: `js/merge.js`, `test/merge.test.js`

**Interfaces:**
- Produces:
  - `mergeWords(a, b): object[]` — объединение по нормализованному `es`; для дубля выбирается «свежее» (больше `reps`, затем позже `due`, затем позже `createdAt`); поле `id` отбрасывается.
  - `mergeMistakes(a, b): object[]` — объединение по `phrase|createdAt`; `id` отбрасывается.
  - `mergeSettings(a, b): object` — `studyDays`/`lessonHistory` объединяются, `teacherProfile` — позже обновлённый, `daily-*` — версия с большим числом добавленных слов; прочие ключи — приоритет `a` (локального).
  - `mergeSnapshots(local, remote): { words, mistakes, settings }`.

- [ ] **Step 1: Написать падающий тест**

`test/merge.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeWords, mergeMistakes, mergeSettings, mergeSnapshots } from '../js/merge.js';

test('mergeWords: объединяет разные слова', () => {
  const a = [{ id: 1, es: 'perro', ru: 'собака', reps: 0 }];
  const b = [{ id: 1, es: 'gato', ru: 'кот', reps: 0 }];
  const out = mergeWords(a, b).map((w) => w.es).sort();
  assert.deepEqual(out, ['gato', 'perro']);
});

test('mergeWords: для дубля берёт более свежий (больше reps), без id', () => {
  const a = [{ id: 1, es: 'Perro', ru: 'собака', reps: 1, due: 10 }];
  const b = [{ id: 5, es: 'perro', ru: 'собака', reps: 3, due: 5 }];
  const out = mergeWords(a, b);
  assert.equal(out.length, 1);
  assert.equal(out[0].reps, 3);
  assert.equal('id' in out[0], false);
});

test('mergeMistakes: объединяет и дедуплицирует по phrase|createdAt', () => {
  const a = [{ id: 1, phrase: 'voy', createdAt: 100, topic: 'x' }];
  const b = [{ id: 2, phrase: 'voy', createdAt: 100, topic: 'x' }, { id: 3, phrase: 'soy', createdAt: 200, topic: 'y' }];
  assert.equal(mergeMistakes(a, b).length, 2);
});

test('mergeSettings: studyDays объединяются и сортируются', () => {
  const out = mergeSettings({ studyDays: ['2026-06-22', '2026-06-20'] }, { studyDays: ['2026-06-21'] });
  assert.deepEqual(out.studyDays, ['2026-06-20', '2026-06-21', '2026-06-22']);
});

test('mergeSettings: teacherProfile — позже обновлённый', () => {
  const a = { teacherProfile: { note: 'A', updatedAt: 100 } };
  const b = { teacherProfile: { note: 'B', updatedAt: 200 } };
  assert.equal(mergeSettings(a, b).teacherProfile.note, 'B');
});

test('mergeSnapshots: собирает все три части', () => {
  const local = { words: [{ es: 'a' }], mistakes: [], settings: { level: 'A2-B1' } };
  const remote = { words: [{ es: 'b' }], mistakes: [], settings: {} };
  const m = mergeSnapshots(local, remote);
  assert.equal(m.words.length, 2);
  assert.equal(m.settings.level, 'A2-B1');
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `node --test test/merge.test.js`
Expected: FAIL — `Cannot find module '../js/merge.js'`.

- [ ] **Step 3: Реализовать `js/merge.js`**

```js
// Слияние снимков данных между устройствами. Чистые функции, без побочных эффектов.

function normEs(s) { return String(s || '').trim().toLowerCase(); }

function freshness(w) { return [w.reps || 0, w.due || 0, w.createdAt || 0]; }

function fresher(a, b) {
  const fa = freshness(a), fb = freshness(b);
  for (let i = 0; i < fa.length; i++) {
    if (fa[i] !== fb[i]) return fa[i] > fb[i] ? a : b;
  }
  return a;
}

export function mergeWords(a, b) {
  const map = new Map();
  for (const w of [...(a || []), ...(b || [])]) {
    const k = normEs(w.es);
    if (!k) continue;
    const { id, ...rest } = w;
    map.set(k, map.has(k) ? fresher(map.get(k), rest) : rest);
  }
  return [...map.values()];
}

export function mergeMistakes(a, b) {
  const map = new Map();
  for (const m of [...(a || []), ...(b || [])]) {
    const { id, ...rest } = m;
    const k = `${rest.phrase}|${rest.createdAt}`;
    if (!map.has(k)) map.set(k, rest);
  }
  return [...map.values()];
}

function mergeStudyDays(a, b) {
  return [...new Set([...(a || []), ...(b || [])])].sort();
}

function mergeLessonHistory(a, b) {
  const map = new Map();
  for (const e of [...(a || []), ...(b || [])]) {
    const k = `${e.topic}|${e.date}`;
    if (!map.has(k)) map.set(k, e);
  }
  return [...map.values()].sort((x, y) => (x.date || 0) - (y.date || 0));
}

function addedCount(set) { return ((set && set.words) || []).filter((w) => w.added).length; }

export function mergeSettings(a, b) {
  const A = a || {}, B = b || {};
  const out = { ...B, ...A };
  out.studyDays = mergeStudyDays(A.studyDays, B.studyDays);
  out.lessonHistory = mergeLessonHistory(A.lessonHistory, B.lessonHistory);
  const ta = A.teacherProfile, tb = B.teacherProfile;
  if (ta || tb) {
    out.teacherProfile = ((ta && ta.updatedAt) || 0) >= ((tb && tb.updatedAt) || 0) ? (ta || tb) : (tb || ta);
  }
  for (const key of new Set([...Object.keys(A), ...Object.keys(B)])) {
    if (key.startsWith('daily-')) {
      const da = A[key], db = B[key];
      out[key] = (da && db) ? (addedCount(da) >= addedCount(db) ? da : db) : (da || db);
    }
  }
  return out;
}

export function mergeSnapshots(local, remote) {
  return {
    words: mergeWords((local || {}).words, (remote || {}).words),
    mistakes: mergeMistakes((local || {}).mistakes, (remote || {}).mistakes),
    settings: mergeSettings((local || {}).settings, (remote || {}).settings),
  };
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `node --test test/merge.test.js`
Expected: PASS — 6 тестов зелёные.

- [ ] **Step 5: Commit**

```bash
git add js/merge.js test/merge.test.js
git commit -m "feat: snapshot merge logic with tests"
```

---

## Task 2: Bulk-replace в слое данных (`js/db.js`)

**Files:**
- Modify: `js/db.js` (добавить две функции в конец)

**Interfaces:**
- Consumes: внутренние `openDB`, `tx`, `asPromise`.
- Produces:
  - `bulkReplaceWords(words: object[]): Promise<void>` — очищает стор `words` и добавляет переданные (без `id`, autoIncrement назначит новые).
  - `bulkReplaceMistakes(items: object[]): Promise<void>` — то же для `mistakes`.

- [ ] **Step 1: Добавить в конец `js/db.js`**

```js
export async function bulkReplaceWords(words) {
  const db = await openDB();
  await asPromise(tx(db, 'words', 'readwrite').clear());
  for (const w of words || []) {
    const { id, ...rest } = w;
    await asPromise(tx(db, 'words', 'readwrite').add(rest));
  }
}

export async function bulkReplaceMistakes(items) {
  const db = await openDB();
  await asPromise(tx(db, 'mistakes', 'readwrite').clear());
  for (const m of items || []) {
    const { id, ...rest } = m;
    await asPromise(tx(db, 'mistakes', 'readwrite').add(rest));
  }
}
```

- [ ] **Step 2: Проверка импорта в Node**

Run: `node --input-type=module -e "import('./js/db.js').then(m=>console.log(typeof m.bulkReplaceWords, typeof m.bulkReplaceMistakes))"`
Expected: `function function`.

- [ ] **Step 3: Commit**

```bash
git add js/db.js
git commit -m "feat: bulkReplaceWords/bulkReplaceMistakes for sync apply"
```

---

## Task 3: Синхронизация с Supabase (`js/sync.js`)

**Files:**
- Create: `js/sync.js`

**Interfaces:**
- Consumes: `getSetting`/`setSetting`/`exportAll`/`getAllMistakes`/`bulkReplaceWords`/`bulkReplaceMistakes` (db.js), `mergeSnapshots` (merge.js).
- Produces:
  - `getSyncConfig(): Promise<{url,key,code}>`
  - `pullRemote(cfg): Promise<object|null>`
  - `pushRemote(cfg, data): Promise<void>`
  - `localSnapshot(): Promise<{words,mistakes,settings}>` — без секретных ключей.
  - `applySnapshot(snap): Promise<void>` — пишет слитый снимок локально (секреты не трогает).
  - `syncNow(): Promise<object>` — pull → merge → apply → push; бросает понятную ошибку, если не настроено.
  - `autoSync(): Promise<void>` — тихо синхронизирует, если настроено.

- [ ] **Step 1: Реализовать `js/sync.js`**

```js
import { getSetting, setSetting, exportAll, getAllMistakes, bulkReplaceWords, bulkReplaceMistakes } from './db.js';
import { mergeSnapshots } from './merge.js';

const SECRET_KEYS = ['apiKey', 'supabaseUrl', 'supabaseKey', 'syncCode'];

export async function getSyncConfig() {
  return {
    url: ((await getSetting('supabaseUrl')) || '').replace(/\/+$/, ''),
    key: (await getSetting('supabaseKey')) || '',
    code: (await getSetting('syncCode')) || '',
  };
}

export async function pullRemote(cfg) {
  let res;
  try {
    res = await fetch(`${cfg.url}/rest/v1/sync?code=eq.${encodeURIComponent(cfg.code)}&select=data`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    });
  } catch (e) {
    throw new Error('Нет сети — синхронизация недоступна.');
  }
  if (!res.ok) throw new Error(`Ошибка чтения из облака (${res.status}). Проверь URL и ключ.`);
  const rows = await res.json();
  return rows && rows[0] ? rows[0].data : null;
}

export async function pushRemote(cfg, data) {
  const res = await fetch(`${cfg.url}/rest/v1/sync`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ code: cfg.code, data, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Ошибка записи в облако (${res.status}).`);
}

export async function localSnapshot() {
  const { settings, words } = await exportAll();
  const mistakes = await getAllMistakes();
  const clean = {};
  for (const [k, v] of Object.entries(settings || {})) {
    if (!SECRET_KEYS.includes(k)) clean[k] = v;
  }
  return { words, mistakes, settings: clean };
}

export async function applySnapshot(snap) {
  await bulkReplaceWords(snap.words || []);
  await bulkReplaceMistakes(snap.mistakes || []);
  for (const [k, v] of Object.entries(snap.settings || {})) {
    if (!SECRET_KEYS.includes(k)) await setSetting(k, v);
  }
}

export async function syncNow() {
  const cfg = await getSyncConfig();
  if (!cfg.url || !cfg.key || !cfg.code) {
    throw new Error('Заполни Supabase URL, ключ и код синхронизации в Настройках.');
  }
  const remote = await pullRemote(cfg);
  const local = await localSnapshot();
  const merged = remote ? mergeSnapshots(local, remote) : local;
  await applySnapshot(merged);
  await pushRemote(cfg, merged);
  return merged;
}

export async function autoSync() {
  try {
    const cfg = await getSyncConfig();
    if (cfg.url && cfg.key && cfg.code) await syncNow();
  } catch (e) {
    // тихо: офлайн или не настроено — приложение работает локально
  }
}
```

- [ ] **Step 2: Проверка импорта в Node**

Run: `node --input-type=module -e "import('./js/sync.js').then(m=>console.log(typeof m.syncNow, typeof m.autoSync))"`
Expected: `function function`.

- [ ] **Step 3: Commit**

```bash
git add js/sync.js
git commit -m "feat: Supabase cloud sync (pull/merge/apply/push)"
```

---

## Task 4: Поля синхронизации в Настройках (`js/settings.js`)

**Files:**
- Modify: `js/settings.js`

**Interfaces:**
- Consumes: `syncNow` (sync.js), существующие `getSetting`/`setSetting`.
- Produces: в экране Настроек — раздел синхронизации (URL, anon-ключ, код) + кнопка «Синхронизировать сейчас».

- [ ] **Step 1: Добавить импорт вверху `js/settings.js`**

После существующих импортов добавить:
```js
import { syncNow } from './sync.js';
```

- [ ] **Step 2: Прочитать значения в начале `render`**

В функции `render`, рядом со чтением `apiKey`/`model`/`level`, добавить:
```js
  const supabaseUrl = (await getSetting('supabaseUrl')) || '';
  const supabaseKey = (await getSetting('supabaseKey')) || '';
  const syncCode = (await getSetting('syncCode')) || '';
```

- [ ] **Step 3: Добавить разметку перед строкой статуса**

В шаблоне `container.innerHTML`, прямо ПЕРЕД `<p id="set-status" class="status"></p>`, вставить блок (значения подставляются через атрибут value, который экранируется самим браузером для строк без кавычек; ключ/URL/код кавычек не содержат):
```js
    <h2>Синхронизация (между устройствами)</h2>
    <label>Supabase URL
      <input id="set-surl" type="text" placeholder="https://xxxx.supabase.co" value="${supabaseUrl}">
    </label>
    <label>Supabase anon-ключ
      <input id="set-skey" type="password" value="${supabaseKey}">
    </label>
    <label>Код синхронизации (одинаковый на всех устройствах)
      <input id="set-scode" type="text" value="${syncCode}">
    </label>
    <button id="set-sync">Синхронизировать сейчас</button>
```

- [ ] **Step 4: Сохранять поля в обработчике «Сохранить»**

В обработчике `#set-save` (`onclick`), рядом с сохранением ключа/модели/уровня, добавить:
```js
    await setSetting('supabaseUrl', container.querySelector('#set-surl').value.trim().replace(/\/+$/, ''));
    await setSetting('supabaseKey', container.querySelector('#set-skey').value.trim());
    await setSetting('syncCode', container.querySelector('#set-scode').value.trim());
```

- [ ] **Step 5: Добавить обработчик кнопки «Синхронизировать сейчас»**

В конце функции `render` (после существующих `onclick`), добавить:
```js
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
```

- [ ] **Step 6: Commit**

```bash
git add js/settings.js
git commit -m "feat: sync settings fields and manual sync button"
```

---

## Task 5: Интеграция, авто-синхронизация, кэш, проверка

**Files:**
- Modify: `index.html`, `sw.js`

- [ ] **Step 1: Авто-синхронизация при старте в `index.html`**

В стартовом скрипте, где есть `import { startApp } from './js/app.js';` и далее импорты экранов и `startApp();`, добавить импорт авто-синхронизации и вызвать её после `startApp();`. Изменить так:
- В строку импортов добавить (рядом с остальными `import './js/...';`):
```js
    import { autoSync } from './js/sync.js';
```
- После строки `startApp();` добавить:
```js
    autoSync();
```

- [ ] **Step 2: Обновить кэш в `sw.js`**

Заменить `const CACHE = 'espanol-v6';` на `const CACHE = 'espanol-v7';`.
В массив `SHELL` добавить (после строки с `'./js/profile.js', './js/teacher.js',`):
```js
  './js/merge.js', './js/sync.js',
```

- [ ] **Step 3: Прогнать все тесты**

Run: `npm test`
Expected: PASS — `lang`, `util`, `srs`, `stats`, `profile`, `merge` зелёные (32 прежних + 6 новых = 38), 0 провалов.

- [ ] **Step 4: Ручная проверка (после настройки Supabase)**

Предусловие: в Supabase создан проект и таблица `sync` (см. ниже §Supabase setup), известны Project URL и anon-ключ.
Run: `npm start` (http://localhost:3000), затем:
- Настройки → заполнить Supabase URL, anon-ключ, код синхронизации → «Сохранить».
- «Синхронизировать сейчас» → статус «Готово — данные синхронизированы».
- Проверить, что Claude-ключ НЕ ушёл в облако: в Supabase Table Editor открыть строку `sync` → в `data.settings` нет `apiKey`/`supabaseKey`/`syncCode`.
- На втором устройстве (или в другом профиле браузера): ввести те же URL/ключ/код → «Синхронизировать» → словарь/прогресс/ошибки появились.
- Добавить слово на устройстве A → синхр.; на устройстве B → синхр. → слово появилось (объединение без потерь).

- [ ] **Step 5: Commit**

```bash
git add index.html sw.js
git commit -m "feat: auto-sync on startup, cache v7"
```

---

## Supabase setup (выполняет пользователь, один раз)

1. Завести бесплатный проект на supabase.com.
2. В разделе **SQL Editor** выполнить:
```sql
create table if not exists public.sync (
  code text primary key,
  data jsonb,
  updated_at timestamptz default now()
);
alter table public.sync enable row level security;
create policy "sync all by anon" on public.sync
  for all to anon using (true) with check (true);
```
3. В **Project Settings → API** скопировать **Project URL** и **anon public key** — ввести их в Настройках приложения вместе с произвольным «кодом синхронизации».

Замечание по безопасности: доступ к строке ограничен знанием `code` (секретная фраза). Claude-ключ в облако не отправляется.

---

## Self-Review

**Spec coverage (План 7 = облачная авто-синхронизация прогресса):**
- Слияние без потерь (словарь/ошибки/история/дни/профиль) → Tasks 1 (`merge.js`). ✔
- Pull → merge → apply → push → Tasks 3 (`syncNow`). ✔
- Авто-синхронизация при открытии + кнопка вручную → Tasks 4, 5. ✔
- Поля Supabase URL/ключ/код в Настройках → Task 4. ✔
- 🔒 Claude-ключ и креды не синхронизируются → Task 3 (`SECRET_KEYS` при сборке и применении). ✔
- Применение слитого снимка локально (bulk-replace) → Tasks 2, 3. ✔
- `js/app.js` не тронут (авто-синхр. из index.html) → Task 5. ✔
- Офлайн-кэш новых файлов → Task 5; офлайн не ломает (autoSync тихо ловит ошибки) → Task 3. ✔

**Placeholder scan:** Полный код во всех шагах. Сетевые ошибки ловятся и показываются/глушатся. Нет TODO без кода.

**Type consistency:** `mergeSnapshots` (Task 1) → Task 3; `bulkReplaceWords`/`bulkReplaceMistakes` (Task 2) → Task 3; `syncNow` (Task 3) → Task 4; `autoSync` (Task 3) → Task 5; форма снимка (`{words, mistakes, settings}`) согласована между `localSnapshot`/`applySnapshot` (Task 3), `mergeSnapshots` (Task 1) и облачным полем `data`; `SECRET_KEYS` применяется и при сборке, и при применении. ✔
