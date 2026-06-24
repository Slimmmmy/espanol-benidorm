# Español Benidorm — План 13: Голос в чате (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** В чате наставника появляется микрофон: ученик говорит по-испански → речь распознаётся (Web Speech, es-ES) → отправляется как голосовое сообщение → наставник отвечает И даёт разбор произношения (звуки, ударения, как сказать правильно). На каждом ответе наставника — кнопка 🔊, чтобы услышать его озвучку.

**Architecture:** Поверх Планов 1–12. Переиспользуем `recognizeOnce` (asr.js) и `speak` (tts.js). Голосовые сообщения помечаются флагом; `chatReply` получает `opts.voice` и добавляет в системный промпт инструкцию-коучинг по произношению. Без новых хранилищ и без миграций.

**Tech Stack:** HTML/CSS/JS (ES-модули, без сборки), Web Speech API (распознавание + синтез), Claude API, Node 20 `node --test`. Целевой браузер — Chrome.

## Global Constraints

- Интерфейс на русском; без сборки; без бэкенда; ключи не коммитить.
- Любой текст в DOM — через `escapeHtml`.
- Ошибки распознавания/озвучки показываются мягко (пузырь/статус), не ломают чат; `busy`/disabled от двойного запуска.
- Модель по умолчанию `claude-haiku-4-5`.
- Существующие тесты (55) остаются зелёными; новой чистой логики нет → юнит-тесты не добавляются (проверка ручная в Chrome).
- `js/app.js` НЕ менять.
- Существующие интерфейсы:
  - `js/asr.js`: `recognizeOnce(lang='es-ES'): Promise<string>` (reject с понятным сообщением, если нет поддержки/ошибка)
  - `js/tts.js`: `speak(text, lang='es-ES'): boolean`
  - `js/claude.js`: `chatReply(history, profile)` — расширим до `chatReply(history, profile, opts)`; `recentMessages` маппит сообщения к `{role,content}` (лишние поля игнорируются)
  - `js/prompts.js`: `CHAT_TUTOR_SYSTEM`
  - `js/chat.js`: `send(container)`, `getHistory`, `renderLog`, `bubblesHtml`, `busy`; уже импортирует `escapeHtml`, `autoSync`, `buildProfile`, `chatReply`, `getMemory`/`saveMemory`, `extractMemory`
- Рабочая директория: `/Users/nik/Downloads/EspanolBenidorm`, ветка `plan-13-voice-chat`.

---

## File Structure (этот план)

- `js/prompts.js` — добавить `VOICE_COACH_HINT`
- `js/claude.js` — `chatReply(history, profile, opts)` добавляет голосовой коучинг при `opts.voice`
- `js/chat.js` — кнопка 🎤 (голосовой ввод es-ES) + отметка голосовых сообщений + кнопки 🔊 на ответах
- `css/styles.css` — стили микрофона и кнопки озвучки
- `sw.js` — версия `espanol-v16`

---

## Task 1: Голосовой коучинг в ответе (`js/prompts.js`, `js/claude.js`)

**Files:**
- Modify: `js/prompts.js` (добавить константу)
- Modify: `js/claude.js` (расширить импорт + сигнатуру `chatReply`)

**Interfaces:**
- Consumes: `CHAT_TUTOR_SYSTEM`, `VOICE_COACH_HINT`, `recentMessages`, `callClaude`.
- Produces: `chatReply(history, profile, opts = {}): Promise<string>` — при `opts.voice === true` добавляет в систему инструкцию по разбору произношения.

- [ ] **Step 1: Добавить в конец `js/prompts.js`**

```js
export const VOICE_COACH_HINT = `Последнее сообщение ученик произнёс ВСЛУХ по-испански (текст получен распознаванием речи, поэтому возможны неточности). Сначала кратко разбери произношение: на какие звуки и ударения обратить внимание, типичные ошибки русскоязычных; покажи, КАК сказать правильно (по слогам, с ударением). Затем коротко ответь по сути сказанного. Будь краток и доброжелателен.`;
```

- [ ] **Step 2: Расширить импорт промптов в `js/claude.js`**

В строке `import { ... } from './prompts.js';` добавить в конец списка: `VOICE_COACH_HINT`.

- [ ] **Step 3: Заменить функцию `chatReply` в `js/claude.js`**

Найти существующую `export async function chatReply(history, profile) { ... }` и заменить целиком на:
```js
export async function chatReply(history, profile, opts = {}) {
  const messages = recentMessages(history, 20);
  let system = `${CHAT_TUTOR_SYSTEM}\nПрофиль ученика: ${JSON.stringify(profile)}`;
  if (opts && opts.voice) system += `\n${VOICE_COACH_HINT}`;
  return callClaude({ system, messages, maxTokens: 700 });
}
```

- [ ] **Step 4: Проверка импорта в Node**

Run: `node --input-type=module -e "import('./js/claude.js').then(m=>console.log(typeof m.chatReply))"`
Expected: `function`.

- [ ] **Step 5: Commit**

```bash
git add js/prompts.js js/claude.js
git commit -m "feat: voice coaching hint for spoken chat messages"
```

---

## Task 2: Микрофон и озвучка в чате (`js/chat.js`)

**Files:**
- Modify: `js/chat.js`

**Interfaces:**
- Consumes: `recognizeOnce` (asr.js), `speak` (tts.js).
- Produces: голосовой ввод (es-ES) → отправка как `{voice:true}`; кнопки 🔊 на ответах наставника; пометка 🎤 на голосовых репликах ученика.

- [ ] **Step 1: Добавить импорты вверху `js/chat.js`**

Рядом с существующими импортами добавить:
```js
import { recognizeOnce } from './asr.js';
import { speak } from './tts.js';
```

- [ ] **Step 2: Помечать голосовые реплики и добавить 🔊 к ответам — заменить `bubblesHtml`**

Заменить существующую функцию `bubblesHtml` целиком на:
```js
function bubblesHtml(history) {
  const e = escapeHtml;
  if (!history.length) {
    return '<p class="status">Привет! Я твой наставник по испанскому. Спроси что угодно — объясню, помогу, потренирую. Можешь писать или говорить (🎤) по-испански.</p>';
  }
  return history.map((m, i) => {
    if (m.role === 'user') {
      return `<div class="chat-msg chat-me">${m.voice ? '🎤 ' : ''}${e(m.content)}</div>`;
    }
    return `<div class="chat-msg chat-bot">${e(m.content)}<button class="chat-say" data-say="${i}" title="Озвучить">🔊</button></div>`;
  }).join('');
}
```

- [ ] **Step 3: Озвучивать ответ по кнопке — заменить `renderLog`**

Заменить существующую функцию `renderLog` целиком на:
```js
function renderLog(container, history, typing) {
  const log = container.querySelector('#chat-log');
  if (!log) return;
  log.innerHTML = bubblesHtml(history) + (typing ? '<div class="chat-msg chat-bot chat-typing">…</div>' : '');
  log.querySelectorAll('[data-say]').forEach((b) => {
    b.onclick = () => { const m = history[Number(b.dataset.say)]; if (m) speak(m.content); };
  });
  scrollBottom();
}
```

- [ ] **Step 4: Принять флаг голоса в `send` — заменить сигнатуру и две строки**

В функции `send`:
- заменить заголовок `async function send(container) {` на `async function send(container, opts = {}) {`
- заменить строку добавления реплики пользователя
  `history.push({ role: 'user', content: text, ts: Date.now() });`
  на
  `history.push({ role: 'user', content: text, ts: Date.now(), ...(opts.voice ? { voice: true } : {}) });`
- заменить вызов `const reply = await chatReply(history, profile);`
  на
  `const reply = await chatReply(history, profile, opts);`

- [ ] **Step 5: Добавить функцию голосового ввода (перед `send`)**

```js
async function voiceInput(container) {
  if (busy) return;
  const mic = container.querySelector('#chat-mic');
  const input = container.querySelector('#chat-input');
  if (mic) mic.disabled = true;
  const prevPh = input ? input.placeholder : '';
  if (input) input.placeholder = '🎤 Говори по-испански…';
  try {
    const heard = await recognizeOnce('es-ES');
    if (input) { input.value = heard; input.placeholder = prevPh; }
    if (mic) mic.disabled = false;
    await send(container, { voice: true });
  } catch (err) {
    if (input) input.placeholder = prevPh;
    if (mic) mic.disabled = false;
    const log = container.querySelector('#chat-log');
    if (log) {
      const h = await getHistory();
      renderLog(container, h.concat([{ role: 'assistant', content: '⚠️ ' + err.message, ts: Date.now() }]), false);
    }
  }
}
```

- [ ] **Step 6: Добавить кнопку 🎤 в разметку и обработчик — заменить блок `chat-bar` в `render`**

В функции `render` заменить блок панели ввода
```js
    <div class="chat-bar">
      <input id="chat-input" type="text" placeholder="Спроси наставника…" autocapitalize="sentences">
      <button id="chat-send">➤</button>
    </div>
```
на
```js
    <div class="chat-bar">
      <button id="chat-mic" title="Сказать по-испански">🎤</button>
      <input id="chat-input" type="text" placeholder="Спроси наставника…" autocapitalize="sentences">
      <button id="chat-send">➤</button>
    </div>
```
И в конце `render`, рядом с обработчиками `#chat-send`/keydown, добавить:
```js
  container.querySelector('#chat-mic').onclick = () => voiceInput(container);
```

- [ ] **Step 7: Проверка импорта в Node**

Run: `node --input-type=module -e "import('./js/chat.js').then(()=>console.log('chat ok')).catch(e=>console.log('ERR',e.message))"`
Expected: `chat ok`.

- [ ] **Step 8: Commit**

```bash
git add js/chat.js
git commit -m "feat: voice input (es-ES) and reply playback in tutor chat"
```

---

## Task 3: Стили, кэш, проверка

**Files:**
- Modify: `css/styles.css`, `sw.js`

- [ ] **Step 1: Добавить стили в конец `css/styles.css`**

```css
#chat-mic { margin: 0; padding: 12px 14px; flex-shrink: 0; background: var(--card-2); border: 1px solid var(--border); }
#chat-mic:disabled { opacity: .5; }
.chat-bar input { flex: 1; min-width: 0; }
.chat-say { margin: 0 0 0 8px; padding: 2px 7px; font-size: 13px; background: transparent; border: 1px solid var(--border); border-radius: 8px; vertical-align: middle; }
```

- [ ] **Step 2: Обновить кэш в `sw.js`**

Заменить `const CACHE = 'espanol-v15';` на `const CACHE = 'espanol-v16';`.
(Новых файлов нет — `asr.js`/`tts.js`/`chat.js` уже в `SHELL`.)

- [ ] **Step 3: Прогнать все тесты**

Run: `npm test`
Expected: PASS — 55 тестов зелёные, 0 провалов.

- [ ] **Step 4: Ручная проверка в Chrome**

Run: `npm start` (http://localhost:3000):
- 💬 Чат: в панели ввода слева кнопка 🎤.
- Нажать 🎤 → разрешить микрофон → плейсхолдер «🎤 Говори по-испански…» → сказать фразу (напр. *Quiero un café*) → распознанный текст уходит как сообщение с пометкой 🎤.
- Ответ наставника содержит разбор произношения (звуки/ударения/как сказать правильно) + ответ по сути.
- На сообщении наставника кнопка 🔊 произносит его озвучку (испанские слова — голосом es).
- В браузере без распознавания / при запрете микрофона → мягкое сообщение об ошибке в чате, приложение не падает.
- Текстовый ввод и Enter работают как прежде.

- [ ] **Step 5: Commit**

```bash
git add css/styles.css sw.js
git commit -m "feat: chat voice/speaker styles, cache v16"
```

---

## Self-Review

**Spec coverage (План 13 = «голос в чате»):**
- Голосовой ввод по-испански (распознавание es-ES) → Tasks 2 (`voiceInput`+`recognizeOnce`). ✔
- Наставник разбирает произношение спрошенного голосом → Tasks 1 (`VOICE_COACH_HINT` при `opts.voice`). ✔
- Услышать правильное произношение (🔊 озвучка ответа) → Task 2 (`speak`). ✔
- Пометка голосовых реплик (🎤) → Task 2 (`bubblesHtml`). ✔
- Ошибки мягкие, чат не ломается; защита от двойного запуска → Task 2. ✔
- `app.js` не тронут; кэш обновлён → Task 3. ✔
- (iOS-распознавание ограничено — это известное ограничение, целевой Chrome.)

**Placeholder scan:** Полный код во всех шагах. Ошибки распознавания/AI ловятся. Нет TODO без кода.

**Type consistency:** `VOICE_COACH_HINT` (Task 1) → claude импорт Task 1; `chatReply(history, profile, opts)` (Task 1) → вызывается из `send` с `opts` (Task 2); `recognizeOnce`/`speak` (Task 2) — из asr.js/tts.js; флаг `voice` в реплике пользователя игнорируется `recentMessages` (берёт только role/content) → API не ломается; `data-say` индекс → `history[i].content` в `renderLog`. ✔
