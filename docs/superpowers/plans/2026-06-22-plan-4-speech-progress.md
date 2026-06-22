# Español Benidorm — План 4: Логопед + Прогресс (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Экран «Логопед» — чтение фразы вслух, оценка разборчивости через распознавание речи (Web Speech, Chrome) + AI-коучинг по звукам/ударениям/темпу с упражнениями. Экран «Прогресс» — стрик занятий, число слов/выученных/на повтор и слабые темы грамматики из накопленных ошибок.

**Architecture:** Поверх Планов 1–3. Новые экраны через существующий реестр. Чистая логика (similarity для разборчивости, computeStreak для стрика) вынесена в модули с юнит-тестами. Распознавание речи — тонкая обёртка над Web Speech `SpeechRecognition`. Статистика читается из существующих сторов `words` и `mistakes`; дни занятий пишутся в `settings`.

**Tech Stack:** HTML/CSS/JS (ES-модули, без сборки), IndexedDB, Web Speech API (`speechSynthesis` + `SpeechRecognition`), Claude Messages API, Node 20 `node --test`. Целевой браузер — Chrome (десктоп).

## Global Constraints

- Интерфейс на русском; без сборки (нативные ES-модули); без бэкенда; ключи не коммитить.
- Любой динамический текст (пользователь/модель) — в DOM только через `escapeHtml`/`textContent`.
- AI-структуры приходят JSON и разбираются через `extractJson`; ошибки показываются в статусе экрана; обработчики после `await` проверяют, что экран ещё на месте (guard).
- Модель по умолчанию `claude-haiku-4-5` (внутри `callClaude`).
- Чистые функции — тесты `node --test`; браузер/AI/распознавание — ручной чек-лист (Chrome).
- Каждый модуль — одна задача; экраны регистрируются через реестр; `js/app.js` НЕ менять.
- Порядок вкладок (`order`): Учить(10), Словарь(20), Аудио(30), **Логопед(35)**, Грамматика(40), **Прогресс(50)**, Настройки(90).
- Существующие интерфейсы (использовать как есть):
  - `js/app.js`: `registerFeature({ id, title, icon, order, render })`
  - `js/claude.js`: `callClaude(...)`, `extractJson` уже импортирован
  - `js/util.js`: `escapeHtml(str)`, `extractJson(text)`
  - `js/tts.js`: `speak(text, lang='es-ES')`
  - `js/db.js`: `getSetting`, `setSetting`, `getAllWords`, `getAllMistakes` (есть); внутренние `tx`, `asPromise`
  - `js/prompts.js`: `DIALECT_SYSTEM`, `WORD_ENRICH_SYSTEM`, `DIALOGUE_SYSTEM`, `GRAMMAR_SYSTEM`
  - `js/study.js`: содержит `async function grade(container, g)` с `await putWord(updated)` (сюда добавим запись дня занятий)
  - слово в `words` имеет SRS-поля `due, interval, ease, reps, lapses`; запись в `mistakes`: `{ phrase, corrected, topic, createdAt }`
- Рабочая директория: `/Users/nik/Downloads/EspanolBenidorm`, ветка `plan-4-speech-progress`.

---

## File Structure (этот план)

- `js/util.js` — добавить `normalizeText(s)`, `similarity(a,b)` (внутр. Левенштейн) — **тесты**
- `js/stats.js` — `dayKey(ts)`, `computeStreak(days, today)` (чистая, **тест**), `recordStudyDay(now)`, `getStats()`
- `js/prompts.js` — добавить `SPEECH_COACH_SYSTEM`
- `js/claude.js` — добавить `gradeSpeech(target, heard)`
- `js/asr.js` — `recognizeOnce(lang)` поверх Web Speech `SpeechRecognition`
- `js/speech.js` — экран «Логопед»
- `js/progress.js` — экран «Прогресс»
- `js/study.js` — записывать день занятия при оценке карточки
- `index.html` — подключить `speech.js`, `progress.js`
- `sw.js` — кэш новых файлов + версия `espanol-v4`
- `css/styles.css` — стили статистики и логопеда
- `test/util.test.js` — дополнить; `test/stats.test.js` — новый

---

## Task 1: Разборчивость речи (`js/util.js`)

**Files:**
- Modify: `js/util.js` (добавить функции в конец)
- Modify: `test/util.test.js` (добавить тесты в конец)

**Interfaces:**
- Produces:
  - `normalizeText(s: string): string` — нижний регистр, без диакритики, без пунктуации, схлопнутые пробелы.
  - `similarity(a: string, b: string): number` — 0..1 на основе расстояния Левенштейна по нормализованным строкам (1 = идентично).

- [ ] **Step 1: Добавить тесты в конец `test/util.test.js`**

```js
import { normalizeText, similarity } from '../js/util.js';

test('normalizeText: регистр, диакритика, пунктуация', () => {
  assert.equal(normalizeText('  ¡Hólá, Múndo!  '), 'hola mundo');
});

test('similarity: идентичные (с учётом регистра/акцентов) = 1', () => {
  assert.equal(similarity('Está bien', 'esta bien'), 1);
});

test('similarity: совсем разное → низкое', () => {
  assert.ok(similarity('hola', 'xyzqw') < 0.5);
});

test('similarity: обе пустые = 1, одна пустая = 0', () => {
  assert.equal(similarity('', ''), 1);
  assert.equal(similarity('hola', ''), 0);
});

test('similarity: близкое произношение → высокое', () => {
  assert.ok(similarity('el perro', 'el pero') > 0.8);
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `node --test test/util.test.js`
Expected: FAIL — `normalizeText`/`similarity` не экспортированы.

- [ ] **Step 3: Добавить функции в конец `js/util.js`**

```js
export function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let cur = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

export function similarity(a, b) {
  const x = normalizeText(a), y = normalizeText(b);
  if (!x && !y) return 1;
  if (!x || !y) return 0;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `node --test test/util.test.js`
Expected: PASS — прежние 6 + новые 5 тестов зелёные.

- [ ] **Step 5: Commit**

```bash
git add js/util.js test/util.test.js
git commit -m "feat: normalizeText and similarity (intelligibility scoring) with tests"
```

---

## Task 2: Статистика и стрик (`js/stats.js`)

**Files:**
- Create: `js/stats.js`, `test/stats.test.js`

**Interfaces:**
- Consumes: `getSetting`/`setSetting`/`getAllWords`/`getAllMistakes` (db.js).
- Produces:
  - `dayKey(ts: number): string` — локальная дата `YYYY-MM-DD`.
  - `computeStreak(days: string[], today: string): number` — длина текущей серии последовательных дней, заканчивающейся сегодня или вчера (чистая).
  - `recordStudyDay(now = Date.now()): Promise<void>` — добавляет сегодняшний день в настройку `studyDays` (без дублей).
  - `getStats(): Promise<{ words, learned, due, streak, weak: {topic,count}[] }>` — `learned` = слова с `reps >= 3`; `due` = слова с `due <= now`; `weak` = темы из `mistakes`, отсортированы по убыванию частоты.

- [ ] **Step 1: Написать падающий тест**

`test/stats.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStreak } from '../js/stats.js';

test('computeStreak: три дня подряд по сегодня = 3', () => {
  assert.equal(computeStreak(['2026-06-20', '2026-06-21', '2026-06-22'], '2026-06-22'), 3);
});

test('computeStreak: серия по вчера (сегодня ещё не занимался) считается', () => {
  assert.equal(computeStreak(['2026-06-20', '2026-06-21'], '2026-06-22'), 2);
});

test('computeStreak: пусто = 0', () => {
  assert.equal(computeStreak([], '2026-06-22'), 0);
});

test('computeStreak: разрыв обрывает серию', () => {
  assert.equal(computeStreak(['2026-06-22', '2026-06-20'], '2026-06-22'), 1);
});

test('computeStreak: ни сегодня, ни вчера = 0', () => {
  assert.equal(computeStreak(['2026-06-19'], '2026-06-22'), 0);
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `node --test test/stats.test.js`
Expected: FAIL — `Cannot find module '../js/stats.js'`.

- [ ] **Step 3: Реализовать `js/stats.js`**

```js
import { getSetting, setSetting, getAllWords, getAllMistakes } from './db.js';

export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prevKey(key) {
  const d = new Date(key + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function computeStreak(days, today) {
  const set = new Set(days);
  let cursor = today;
  if (!set.has(cursor)) {
    cursor = prevKey(cursor);
    if (!set.has(cursor)) return 0;
  }
  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    cursor = prevKey(cursor);
  }
  return streak;
}

export async function recordStudyDay(now = Date.now()) {
  const key = dayKey(now);
  const days = (await getSetting('studyDays')) || [];
  if (!days.includes(key)) {
    days.push(key);
    await setSetting('studyDays', days);
  }
}

export async function getStats() {
  const words = await getAllWords();
  const mistakes = await getAllMistakes();
  const days = (await getSetting('studyDays')) || [];
  const now = Date.now();
  const due = words.filter((w) => (w.due ?? 0) <= now).length;
  const learned = words.filter((w) => (w.reps || 0) >= 3).length;
  const topicMap = {};
  for (const m of mistakes) {
    const t = (m.topic || '').trim();
    if (t) topicMap[t] = (topicMap[t] || 0) + 1;
  }
  const weak = Object.entries(topicMap)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({ topic, count }));
  return { words: words.length, learned, due, streak: computeStreak(days, dayKey(now)), weak };
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `node --test test/stats.test.js`
Expected: PASS — 5 тестов зелёные.

- [ ] **Step 5: Commit**

```bash
git add js/stats.js test/stats.test.js
git commit -m "feat: stats module with streak computation and tests"
```

---

## Task 3: Промпт и AI-коучинг речи (`js/prompts.js`, `js/claude.js`)

**Files:**
- Modify: `js/prompts.js` (добавить константу)
- Modify: `js/claude.js` (расширить импорт промптов + добавить функцию)

**Interfaces:**
- Consumes: `callClaude`, `extractJson`, `SPEECH_COACH_SYSTEM`.
- Produces: `gradeSpeech(target: string, heard: string): Promise<{ sounds, rhythm, exercise }>`.

- [ ] **Step 1: Добавить в конец `js/prompts.js`**

```js
export const SPEECH_COACH_SYSTEM = `Ты — логопед-преподаватель испанского для русскоязычного ученика A2–B1, живущего рядом с Бенидормом.
Тебе дают эталонную фразу на испанском и текст, распознанный из речи ученика.
По расхождениям оцени вероятные проблемы произношения и верни СТРОГО один JSON-объект, без markdown:
{
  "sounds": "какие звуки вероятно произнесены неточно и как их правильно артикулировать, по-русски; учитывай типичные трудности русскоязычных: раскатистое rr, межзубные c/z, мягкие ll/y, различие b/v, отсутствие смягчения согласных",
  "rhythm": "советы по ударениям, темпу и паузам именно для этой фразы, по-русски",
  "exercise": "одно короткое упражнение или скороговорка (trabalenguas) на проблемный звук: испанский текст и перевод"
}
Только валидный JSON.`;
```

- [ ] **Step 2: Расширить импорт промптов в `js/claude.js`**

Сейчас в файле строка (из Плана 3):
```js
import { WORD_ENRICH_SYSTEM, DIALOGUE_SYSTEM, GRAMMAR_SYSTEM } from './prompts.js';
```
Заменить на:
```js
import { WORD_ENRICH_SYSTEM, DIALOGUE_SYSTEM, GRAMMAR_SYSTEM, SPEECH_COACH_SYSTEM } from './prompts.js';
```

- [ ] **Step 3: Добавить функцию в конец `js/claude.js`**

```js
export async function gradeSpeech(target, heard) {
  const text = await callClaude({
    system: SPEECH_COACH_SYSTEM,
    messages: [{ role: 'user', content: `Эталон: ${target}\nРаспозналось: ${heard}` }],
    maxTokens: 500,
  });
  return extractJson(text);
}
```

- [ ] **Step 4: Проверка импорта в Node**

Run: `node --input-type=module -e "import('./js/claude.js').then(m=>console.log(typeof m.gradeSpeech))"`
Expected: `function`.

- [ ] **Step 5: Commit**

```bash
git add js/prompts.js js/claude.js
git commit -m "feat: gradeSpeech AI pronunciation coaching"
```

---

## Task 4: Распознавание речи (`js/asr.js`)

**Files:**
- Create: `js/asr.js`

**Interfaces:**
- Produces: `recognizeOnce(lang = 'es-ES'): Promise<string>` — распознаёт одну фразу; reject с понятным сообщением, если API нет / ошибка / ничего не распознано.

- [ ] **Step 1: Реализовать `js/asr.js`**

```js
// Однократное распознавание речи через Web Speech API (лучше всего в Chrome).
export function recognizeOnce(lang = 'es-ES') {
  return new Promise((resolve, reject) => {
    const SR = (typeof window !== 'undefined') && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) {
      reject(new Error('Распознавание речи недоступно в этом браузере. Открой приложение в Chrome.'));
      return;
    }
    const r = new SR();
    r.lang = lang;
    r.interimResults = false;
    r.maxAlternatives = 1;
    let got = false;
    r.onresult = (e) => { got = true; resolve(e.results[0][0].transcript); };
    r.onerror = (e) => reject(new Error('Ошибка распознавания: ' + (e.error || 'неизвестно')));
    r.onend = () => { if (!got) reject(new Error('Речь не распознана. Попробуй ещё раз, ближе к микрофону.')); };
    r.start();
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add js/asr.js
git commit -m "feat: one-shot speech recognition wrapper"
```

---

## Task 5: Экран «Логопед» (`js/speech.js`)

**Files:**
- Create: `js/speech.js`

**Interfaces:**
- Consumes: `registerFeature` (app.js), `recognizeOnce` (asr.js), `gradeSpeech` (claude.js), `speak` (tts.js), `similarity`/`escapeHtml` (util.js).
- Produces: регистрирует экран `speech` (Логопед, `order: 35`).

- [ ] **Step 1: Реализовать `js/speech.js`**

```js
import { registerFeature } from './app.js';
import { recognizeOnce } from './asr.js';
import { gradeSpeech } from './claude.js';
import { speak } from './tts.js';
import { similarity, escapeHtml } from './util.js';

const PHRASES = [
  'El perro de San Roque no tiene rabo.',
  'Tres tristes tigres tragaban trigo en un trigal.',
  'Quiero una caña y una tapa, por favor.',
  'La zapatería está cerca de la plaza.',
  'Me llamo Pablo y vivo cerca de Benidorm.',
  'El cielo está despejado y hace calor.',
];
let idx = 0;

function scoreLabel(s) {
  if (s >= 0.85) return '🟢 Отлично';
  if (s >= 0.6) return '🟡 Неплохо';
  return '🔴 Стоит поработать';
}

async function render(container) {
  const e = escapeHtml;
  container.innerHTML = `
    <h1>Логопед</h1>
    <div class="study-card">
      <div class="study-es"><b id="sp-phrase">${e(PHRASES[idx])}</b></div>
      <div class="dlg-controls">
        <button id="sp-listen">🔊 Образец</button>
        <button id="sp-rec">🎤 Говорить</button>
        <button id="sp-next">Другая фраза</button>
      </div>
      <p id="sp-status" class="status"></p>
      <div id="sp-result"></div>
    </div>
    <p class="status">Распознавание речи лучше всего работает в Chrome. Разреши доступ к микрофону.</p>
  `;
  const phraseEl = container.querySelector('#sp-phrase');
  const status = container.querySelector('#sp-status');
  const result = container.querySelector('#sp-result');

  container.querySelector('#sp-listen').onclick = () => speak(PHRASES[idx]);
  container.querySelector('#sp-next').onclick = () => {
    idx = (idx + 1) % PHRASES.length;
    phraseEl.textContent = PHRASES[idx];
    status.textContent = '';
    result.innerHTML = '';
  };
  container.querySelector('#sp-rec').onclick = async () => {
    status.textContent = 'Слушаю… говори сейчас';
    result.innerHTML = '';
    try {
      const heard = await recognizeOnce();
      const target = PHRASES[idx];
      const s = similarity(target, heard);
      if (!container.querySelector('#sp-result')) return;
      status.textContent = '';
      result.innerHTML = `
        <div class="sp-score">${scoreLabel(s)} — разборчивость ${Math.round(s * 100)}%</div>
        <div class="word-ex">Распозналось: «${e(heard)}»</div>
        <button id="sp-coach">Разбор от логопеда</button>
        <div id="sp-coaching"></div>`;
      result.querySelector('#sp-coach').onclick = async () => {
        const coaching = container.querySelector('#sp-coaching');
        coaching.innerHTML = '<p class="status">Анализирую…</p>';
        try {
          const c = await gradeSpeech(target, heard);
          const box = container.querySelector('#sp-coaching');
          if (!box) return;
          box.innerHTML = `
            ${c.sounds ? `<div class="word-ex">🗣️ ${e(c.sounds)}</div>` : ''}
            ${c.rhythm ? `<div class="word-ex">🎵 ${e(c.rhythm)}</div>` : ''}
            ${c.exercise ? `<div class="word-local">🏋️ ${e(c.exercise)}</div>` : ''}`;
        } catch (err) {
          const box = container.querySelector('#sp-coaching');
          if (box) box.innerHTML = `<p class="status">${e(err.message)}</p>`;
        }
      };
    } catch (err) {
      const s2 = container.querySelector('#sp-status');
      if (s2) s2.textContent = err.message;
    }
  };
}

registerFeature({ id: 'speech', title: 'Логопед', icon: '🗣️', order: 35, render });
```

- [ ] **Step 2: Commit**

```bash
git add js/speech.js
git commit -m "feat: speech coach screen (intelligibility score + AI coaching + drills)"
```

---

## Task 6: Экран «Прогресс» + учёт дней занятий (`js/progress.js`, `js/study.js`)

**Files:**
- Create: `js/progress.js`
- Modify: `js/study.js` (записывать день занятия при оценке карточки)

**Interfaces:**
- Consumes: `registerFeature` (app.js), `getStats` (stats.js), `escapeHtml` (util.js); `recordStudyDay` (stats.js) — в study.js.
- Produces: регистрирует экран `progress` (Прогресс, `order: 50`).

- [ ] **Step 1: Реализовать `js/progress.js`**

```js
import { registerFeature } from './app.js';
import { getStats } from './stats.js';
import { escapeHtml } from './util.js';

async function render(container) {
  container.innerHTML = '<h1>Прогресс</h1><p class="status">Загрузка…</p>';
  const s = await getStats();
  if (!container.isConnected && !container.querySelector) return;
  const e = escapeHtml;
  const weakHtml = s.weak.length
    ? s.weak.map((w) => `<div class="word-local">📌 ${e(w.topic)} — ${w.count}</div>`).join('')
    : '<p class="status">Пока нет ошибок в грамматике — так держать!</p>';
  container.innerHTML = `
    <h1>Прогресс</h1>
    <div class="stats-grid">
      <div class="stat"><div class="stat-num">${s.streak}</div><div class="stat-lbl">дней подряд 🔥</div></div>
      <div class="stat"><div class="stat-num">${s.words}</div><div class="stat-lbl">слов в словаре</div></div>
      <div class="stat"><div class="stat-num">${s.learned}</div><div class="stat-lbl">выучено</div></div>
      <div class="stat"><div class="stat-num">${s.due}</div><div class="stat-lbl">на повтор сегодня</div></div>
    </div>
    <h2>Слабые темы (грамматика)</h2>
    ${weakHtml}
  `;
}

registerFeature({ id: 'progress', title: 'Прогресс', icon: '📊', order: 50, render });
```

- [ ] **Step 2: Записывать день занятия в `js/study.js`**

Вверху `js/study.js`, рядом с другими импортами, добавить:
```js
import { recordStudyDay } from './stats.js';
```
В функции `grade(container, g)`, сразу ПОСЛЕ строки `await putWord(updated);` добавить:
```js
  await recordStudyDay();
```

- [ ] **Step 3: Commit**

```bash
git add js/progress.js js/study.js
git commit -m "feat: progress screen and study-day tracking for streak"
```

---

## Task 7: Интеграция, кэш, стили, проверка

**Files:**
- Modify: `index.html`, `sw.js`, `css/styles.css`

- [ ] **Step 1: Подключить экраны в `index.html`**

Найти блок импортов (из Плана 3):
```js
    import { startApp } from './js/app.js';
    import './js/study.js';
    import './js/dictionary.js';
    import './js/listening.js';
    import './js/grammar.js';
    import './js/settings.js';
    startApp();
```
Заменить на:
```js
    import { startApp } from './js/app.js';
    import './js/study.js';
    import './js/dictionary.js';
    import './js/listening.js';
    import './js/speech.js';
    import './js/grammar.js';
    import './js/progress.js';
    import './js/settings.js';
    startApp();
```

- [ ] **Step 2: Обновить кэш в `sw.js`**

Заменить `const CACHE = 'espanol-v3';` на `const CACHE = 'espanol-v4';`.
В массив `SHELL` добавить (после строки с `'./js/listening.js', './js/grammar.js',`):
```js
  './js/stats.js', './js/asr.js', './js/speech.js', './js/progress.js',
```

- [ ] **Step 3: Добавить стили в конец `css/styles.css`**

```css
.stats-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:12px 0; }
.stat { background:var(--card); border:1px solid #334155; border-radius:12px; padding:16px; text-align:center; }
.stat-num { font-size:30px; font-weight:700; color:var(--accent); }
.stat-lbl { color:var(--muted); font-size:13px; margin-top:4px; }
.sp-score { font-size:18px; font-weight:600; margin:10px 0; }
```

- [ ] **Step 4: Прогнать все тесты**

Run: `npm test`
Expected: PASS — `lang`, `util` (с новыми), `srs`, `stats` зелёные, 0 провалов.

- [ ] **Step 5: Ручная проверка в Chrome**

Run: `npm start` (http://localhost:3000), затем:
- Внизу семь вкладок: 🎓 Учить · 📖 Словарь · 🎧 Аудио · 🗣️ Логопед · ✍️ Грамматика · 📊 Прогресс · ⚙️ Настройки.
- Логопед: «🔊 Образец» произносит фразу. «🎤 Говорить» → разрешить микрофон → произнести фразу → показывается «разборчивость N%» и распознанный текст. «Другая фраза» меняет фразу. «Разбор от логопеда» → AI-советы по звукам/ритму + упражнение.
- В браузере без распознавания (или при запрете микрофона) — понятное сообщение об ошибке в статусе, приложение не падает.
- Прогресс: показывает 4 плитки (стрик, слов, выучено, на повтор) и список слабых тем. После проверки неверной фразы в Грамматике соответствующая тема появляется в «Слабые темы». После оценки карточки в «Учить» стрик становится ≥ 1.

- [ ] **Step 6: Commit**

```bash
git add index.html sw.js css/styles.css
git commit -m "feat: wire speech and progress screens, cache v4, styles"
```

---

## Self-Review

**Spec coverage (План 4 = «Логопед/фонетика» + «Прогресс»; напоминания исключены из scope):**
- Чтение вслух с оценкой разборчивости (Web Speech + similarity) → Tasks 1, 4, 5. ✔
- AI-коучинг: звуки, ударения, темп, паузы + упражнения/скороговорки → Tasks 3, 5. ✔
- Образец произношения (TTS) по кнопке → Task 5. ✔
- Прогресс: стрик, слова, выучено, на повтор → Tasks 2, 6. ✔
- Слабые темы из накопленных ошибок грамматики (`mistakes`) → Tasks 2, 6. ✔
- Учёт дней занятий для стрика → Task 6 (study.js). ✔
- Расширяемость: экраны через реестр, `app.js` не тронут → Tasks 5, 6. ✔
- Безопасная вставка в DOM + guard после await → Tasks 5, 6. ✔
- Офлайн-кэш новых файлов → Task 7. ✔
- Напоминания (web-push) намеренно НЕ реализуются (исключены из scope, §13 спецификации). ✔

**Placeholder scan:** Полный код во всех шагах. Ошибки распознавания/AI ловятся и показываются. Нет TODO без кода.

**Type consistency:** `normalizeText`/`similarity` (Task 1) → `similarity` в Task 5; `computeStreak`/`getStats`/`recordStudyDay` (Task 2) → `getStats` в Task 6 (progress), `recordStudyDay` в Task 6 (study.js); `SPEECH_COACH_SYSTEM` (Task 3) → claude в Task 3; `gradeSpeech` (Task 3) → Task 5; `recognizeOnce` (Task 4) → Task 5; форма коучинга (`sounds, rhythm, exercise`) согласована между Task 3 и Task 5; форма статистики (`words, learned, due, streak, weak[{topic,count}]`) — между Task 2 и Task 6. ✔
