# Español Benidorm — План 5: «5 слов в день» (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Вкладка «5 слов» — каждый день AI подбирает 5 новых практичных разговорных слов для жизни в Бенидорме (исключая уже известные), пользователь добавляет их в словарь (→ в SRS) и применяет в своём предложении с AI-проверкой.

**Architecture:** Поверх Планов 1–4. Новый экран через существующий реестр. Слова дня генерит существующий `callClaude` + `extractJson`. Набор дня хранится в сторе `settings` по ключу `daily-<dayKey>` (без миграции БД). Добавление слова переиспользует `putWord`+`newCard` (как Словарь), «применить» — существующий `checkGrammar`. День засчитывается в стрик через `recordStudyDay`.

**Tech Stack:** HTML/CSS/JS (ES-модули, без сборки), IndexedDB, Web Speech API, Claude Messages API, Node 20 `node --test`. Целевой браузер — Chrome.

## Global Constraints

- Интерфейс на русском; без сборки (нативные ES-модули); без бэкенда; ключи не коммитить.
- Любой динамический текст (пользователь/модель) — в DOM только через `escapeHtml`/`textContent`.
- AI-структуры приходят JSON и разбираются через `extractJson`; ошибки показываются в статусе; обработчики после `await` проверяют, что экран ещё на месте (guard).
- Модель по умолчанию `claude-haiku-4-5` (внутри `callClaude`).
- Чистой логики, требующей новых юнит-тестов, в плане нет; существующие 28 тестов (`npm test`) должны остаться зелёными. Экран проверяется ручным чек-листом (Chrome).
- Экран регистрируется через реестр; `js/app.js` НЕ менять.
- Порядок вкладок (`order`): Учить(10), **5 слов(15)**, Словарь(20), Аудио(30), Логопед(35), Грамматика(40), Прогресс(50), Настройки(90).
- Существующие интерфейсы (использовать как есть):
  - `js/app.js`: `registerFeature({ id, title, icon, order, render })`
  - `js/claude.js`: `callClaude(...)`; `extractJson` уже импортирован; `checkGrammar(text)→{ok,corrected,explanation,topic}`; импорт промптов: `import { WORD_ENRICH_SYSTEM, DIALOGUE_SYSTEM, GRAMMAR_SYSTEM, SPEECH_COACH_SYSTEM } from './prompts.js';`
  - `js/db.js`: `getSetting(key)`, `setSetting(key,value)`, `getAllWords()`, `putWord(word)→id`
  - `js/srs.js`: `newCard(now)`
  - `js/stats.js`: `dayKey(ts)→'YYYY-MM-DD'`, `recordStudyDay(now?)`
  - `js/tts.js`: `speak(text, lang='es-ES')`
  - `js/util.js`: `escapeHtml(str)`
  - форма слова в `words`: `{ es, ru, example, exampleRu, pos, gender, local, createdAt }` + SRS-поля из `newCard`
- Рабочая директория: `/Users/nik/Downloads/EspanolBenidorm`, ветка `plan-5-daily-words`.

---

## File Structure (этот план)

- `js/prompts.js` — добавить `DAILY_WORDS_SYSTEM`
- `js/claude.js` — добавить `generateDailyWords(knownEs)`
- `js/daily.js` — экран «5 слов»
- `index.html` — подключить `daily.js`
- `sw.js` — кэш `daily.js` + версия `espanol-v5`
- `css/styles.css` — стили прогресса дня и блока «применить»

---

## Task 1: Промпт и генерация слов дня (`js/prompts.js`, `js/claude.js`)

**Files:**
- Modify: `js/prompts.js` (добавить константу в конец)
- Modify: `js/claude.js` (расширить импорт промптов + добавить функцию)

**Interfaces:**
- Consumes: `callClaude`, `extractJson`, `DAILY_WORDS_SYSTEM`.
- Produces: `generateDailyWords(knownEs: string[] = []): Promise<{ words: {es,ru,example,exampleRu,local}[] }>`.

- [ ] **Step 1: Добавить в конец `js/prompts.js`**

```js
export const DAILY_WORDS_SYSTEM = `Ты подбираешь ежедневную порцию из 5 новых полезных РАЗГОВОРНЫХ слов или коротких выражений на испанском для русскоязычного ученика уровня A2–B1, живущего рядом с Бенидормом (Валенсийское сообщество).
Слова должны быть практичными для повседневного общения здесь и сейчас: магазин, бар, соседи, услуги, улица, транспорт. Не повторяй слова, которые ученик уже знает.
Верни СТРОГО один JSON-объект, без markdown и без пояснений:
{
  "words": [
    { "es": "слово/выражение на испанском", "ru": "перевод на русский", "example": "короткое предложение-пример на испанском", "exampleRu": "перевод примера на русский", "local": "как используют в районе Бенидорма/Валенсии или местный нюанс, по-русски; если нет — пустая строка" }
  ]
}
Ровно 5 элементов в массиве "words". Только валидный JSON.`;
```

- [ ] **Step 2: Расширить импорт промптов в `js/claude.js`**

Заменить строку:
```js
import { WORD_ENRICH_SYSTEM, DIALOGUE_SYSTEM, GRAMMAR_SYSTEM, SPEECH_COACH_SYSTEM } from './prompts.js';
```
на:
```js
import { WORD_ENRICH_SYSTEM, DIALOGUE_SYSTEM, GRAMMAR_SYSTEM, SPEECH_COACH_SYSTEM, DAILY_WORDS_SYSTEM } from './prompts.js';
```

- [ ] **Step 3: Добавить функцию в конец `js/claude.js`**

```js
export async function generateDailyWords(knownEs = []) {
  const known = knownEs.slice(0, 200).join(', ');
  const text = await callClaude({
    system: DAILY_WORDS_SYSTEM,
    messages: [{ role: 'user', content: `Слова, которые ученик уже знает (не повторяй их): ${known || '(пока пусто)'}` }],
    maxTokens: 800,
  });
  return extractJson(text);
}
```

- [ ] **Step 4: Проверка импорта в Node**

Run: `node --input-type=module -e "import('./js/claude.js').then(m=>console.log(typeof m.generateDailyWords))"`
Expected: `function`.

- [ ] **Step 5: Commit**

```bash
git add js/prompts.js js/claude.js
git commit -m "feat: generateDailyWords AI daily vocabulary picker"
```

---

## Task 2: Экран «5 слов» (`js/daily.js`)

**Files:**
- Create: `js/daily.js`

**Interfaces:**
- Consumes: `registerFeature` (app.js), `generateDailyWords`/`checkGrammar` (claude.js), `getSetting`/`setSetting`/`getAllWords`/`putWord` (db.js), `newCard` (srs.js), `dayKey`/`recordStudyDay` (stats.js), `speak` (tts.js), `escapeHtml` (util.js).
- Produces: регистрирует экран `daily` (5 слов, `order: 15`). Набор дня в `settings` под ключом `daily-<dayKey>`: `{ date, words: [{es,ru,example,exampleRu,local, added:boolean}] }`.

- [ ] **Step 1: Реализовать `js/daily.js`**

```js
import { registerFeature } from './app.js';
import { generateDailyWords, checkGrammar } from './claude.js';
import { getSetting, setSetting, getAllWords, putWord } from './db.js';
import { newCard } from './srs.js';
import { dayKey, recordStudyDay } from './stats.js';
import { speak } from './tts.js';
import { escapeHtml } from './util.js';

function todayKey() { return `daily-${dayKey(Date.now())}`; }

async function loadOrCreate(statusEl) {
  const k = todayKey();
  const existing = await getSetting(k);
  if (existing && Array.isArray(existing.words) && existing.words.length) return existing;
  statusEl.textContent = 'Подбираю 5 новых слов на сегодня…';
  const known = (await getAllWords()).map((w) => w.es).filter(Boolean);
  const data = await generateDailyWords(known);
  const words = (data.words || []).slice(0, 5).map((w) => ({
    es: w.es || '', ru: w.ru || '', example: w.example || '',
    exampleRu: w.exampleRu || '', local: w.local || '', added: false,
  }));
  const set = { date: dayKey(Date.now()), words };
  await setSetting(k, set);
  statusEl.textContent = '';
  return set;
}

function cardHtml(w, i) {
  const e = escapeHtml;
  return `
    <div class="word-card" data-i="${i}">
      <div class="word-main"><b>${e(w.es)}</b> — ${e(w.ru)}</div>
      ${w.example ? `<div class="word-ex">${e(w.example)}${w.exampleRu ? `<br><span class="muted">${e(w.exampleRu)}</span>` : ''}</div>` : ''}
      ${w.local ? `<div class="word-local">📍 ${e(w.local)}</div>` : ''}
      <div class="word-actions">
        <button data-say="${i}">🔊</button>
        ${w.added ? '<span class="daily-added">✓ в словаре</span>' : `<button data-add="${i}">Добавить в словарь</button>`}
        <button data-apply="${i}">Применить</button>
      </div>
      <div class="daily-apply hidden" data-applybox="${i}">
        <textarea data-sent="${i}" rows="2" placeholder="Составь предложение с этим словом…"></textarea>
        <button data-check="${i}">Проверить</button>
        <div class="daily-feedback" data-fb="${i}"></div>
      </div>
    </div>`;
}

async function render(container) {
  container.innerHTML = `<h1>5 слов на сегодня</h1><p id="dly-status" class="status">Загрузка…</p><div id="dly-list"></div>`;
  const status = container.querySelector('#dly-status');
  let set;
  try {
    set = await loadOrCreate(status);
  } catch (err) {
    const s = container.querySelector('#dly-status');
    if (s) s.textContent = err.message;
    return;
  }
  if (!container.querySelector('#dly-list')) return;

  function paint() {
    const added = set.words.filter((w) => w.added).length;
    status.innerHTML = `<span class="daily-progress">Добавлено ${added}/5</span>`;
    container.querySelector('#dly-list').innerHTML = set.words.map((w, i) => cardHtml(w, i)).join('');
    wire();
  }

  function wire() {
    const list = container.querySelector('#dly-list');
    list.querySelectorAll('[data-say]').forEach((b) => {
      b.onclick = () => speak(set.words[Number(b.dataset.say)].es);
    });
    list.querySelectorAll('[data-add]').forEach((b) => {
      b.onclick = async () => {
        const i = Number(b.dataset.add);
        const w = set.words[i];
        const now = Date.now();
        await putWord({ es: w.es, ru: w.ru, example: w.example, exampleRu: w.exampleRu, local: w.local, createdAt: now, ...newCard(now) });
        await recordStudyDay();
        w.added = true;
        await setSetting(todayKey(), set);
        if (!container.querySelector('#dly-list')) return;
        paint();
      };
    });
    list.querySelectorAll('[data-apply]').forEach((b) => {
      b.onclick = () => {
        const box = list.querySelector(`[data-applybox="${b.dataset.apply}"]`);
        if (box) box.classList.toggle('hidden');
      };
    });
    list.querySelectorAll('[data-check]').forEach((b) => {
      b.onclick = async () => {
        const i = b.dataset.check;
        const ta = list.querySelector(`[data-sent="${i}"]`);
        const fb = list.querySelector(`[data-fb="${i}"]`);
        const sentence = ta.value.trim();
        if (!sentence) return;
        fb.textContent = 'Проверяю…';
        try {
          const r = await checkGrammar(sentence);
          const box = list.querySelector(`[data-fb="${i}"]`);
          if (!box) return;
          const e = escapeHtml;
          box.innerHTML = `
            <div class="${r.ok ? 'gr-ok' : 'gr-bad'}">${r.ok ? '✅ Верно' : '✏️ Поправим'}</div>
            ${r.corrected ? `<div class="word-ex"><b>${e(r.corrected)}</b></div>` : ''}
            ${r.explanation ? `<div class="word-ex">${e(r.explanation)}</div>` : ''}`;
        } catch (err) {
          const box = list.querySelector(`[data-fb="${i}"]`);
          if (box) box.textContent = err.message;
        }
      };
    });
  }

  paint();
}

registerFeature({ id: 'daily', title: '5 слов', icon: '🗓️', order: 15, render });
```

- [ ] **Step 2: Commit**

```bash
git add js/daily.js
git commit -m "feat: daily 5-words screen (AI picks, add to SRS, apply with check)"
```

---

## Task 3: Интеграция, кэш, стили, проверка

**Files:**
- Modify: `index.html`, `sw.js`, `css/styles.css`

- [ ] **Step 1: Подключить экран в `index.html`**

Найти блок импортов (из Плана 4):
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
Заменить на (добавлена строка `./js/daily.js`):
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

- [ ] **Step 2: Обновить кэш в `sw.js`**

Заменить `const CACHE = 'espanol-v4';` на `const CACHE = 'espanol-v5';`.
В массив `SHELL` добавить (после строки с `'./js/stats.js', './js/asr.js', './js/speech.js', './js/progress.js',`):
```js
  './js/daily.js',
```

- [ ] **Step 3: Добавить стили в конец `css/styles.css`**

```css
.daily-progress { color:var(--accent); font-weight:700; font-size:16px; }
.daily-added { color:var(--accent); align-self:center; font-size:14px; }
.daily-apply { margin-top:10px; }
.daily-feedback { margin-top:8px; }
```

- [ ] **Step 4: Прогнать тесты**

Run: `npm test`
Expected: PASS — 28 тестов зелёные, 0 провалов (новый экран — браузерный/AI, юнит-тестов не добавляет).

- [ ] **Step 5: Ручная проверка в Chrome**

Run: `npm start` (http://localhost:3000), затем:
- Внизу появилась вкладка 🗓️ «5 слов» (вторая после «Учить»).
- Первый заход: статус «Подбираю 5 новых слов…», затем 5 карточек (слово — перевод, пример, местная заметка). 🔊 озвучивает.
- «Добавить в словарь»: кнопка меняется на «✓ в словаре», счётчик «Добавлено N/5» растёт; слово появляется во вкладке «Словарь» и в «Учить» (SRS).
- «Применить» раскрывает поле; ввод предложения → «Проверить» → AI-фидбек (верно/исправление/объяснение).
- Перезагрузка страницы в тот же день: те же 5 слов, отметки «✓ в словаре» сохранены (DevTools → Application → IndexedDB → `espanol` → `settings` → ключ `daily-<сегодня>`).
- На «Прогрессе» стрик стал ≥ 1 после добавления слова.

- [ ] **Step 6: Commit**

```bash
git add index.html sw.js css/styles.css
git commit -m "feat: wire daily-words screen, cache v5, styles"
```

---

## Self-Review

**Spec coverage (План 5 = §14 «5 слов в день»):**
- 5 новых разговорных слов каждый день, исключая известные → Tasks 1, 2 (передаём `getAllWords().es`). ✔
- Практичные слова для Бенидорма с местной заметкой → Task 1 (промпт). ✔
- Перевод, пример, озвучка → Task 2. ✔
- «Добавить в словарь» → попадает в SRS (`newCard`) → Task 2. ✔
- «Применить»: своё предложение + AI-проверка → Task 2 (`checkGrammar`). ✔
- Прогресс дня «N/5», набор сохраняется по дате, день в стрик → Task 2 (`setSetting`+`recordStudyDay`). ✔
- Тот же набор при повторном заходе в тот же день, новый — назавтра → Task 2 (`loadOrCreate` по `daily-<dayKey>`). ✔
- Расширяемость: экран через реестр, `app.js` не тронут → Task 2. ✔
- Безопасная вставка (escapeHtml) + guard после await → Task 2. ✔
- Офлайн-кэш → Task 3. ✔

**Placeholder scan:** Полный код во всех шагах. Ошибки AI/проверки ловятся и показываются. Нет TODO без кода.

**Type consistency:** `DAILY_WORDS_SYSTEM` (Task 1) → claude импорт в Task 1; `generateDailyWords` (Task 1) → Task 2; `dayKey`/`recordStudyDay` (stats.js, Планы 2/4) → Task 2; `newCard` (srs.js) → Task 2; форма слова дня (`es,ru,example,exampleRu,local,added`) согласована между `loadOrCreate`, `cardHtml`, обработчиком «Добавить»; сохраняемое в `words` слово совпадает по форме со Словарём (Плана 2). ✔
