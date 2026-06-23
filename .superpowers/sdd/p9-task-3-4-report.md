# Plan 9: Tasks 3–4 Report

## Files Created/Modified

### Task 3: Chat Screen Module
- **Created**: `js/chat.js` (76 lines)
  - Implements chat UI with persistent history (IndexedDB via `settings.chatHistory`)
  - Handles user input, chat bubbles, typing indicator, error messages
  - Integrates `chatReply()` for AI responses, `buildProfile()` for context
  - Registers as feature with order 6 (Чат), icon 💬
  - Stores up to 60 recent messages

### Task 4: Integration & Styling
- **Modified**: `index.html`
  - Added `import './js/chat.js';` after `import './js/teacher.js';`
  
- **Modified**: `sw.js`
  - Bumped cache version: `espanol-v9` → `espanol-v10`
  - Added `./js/chat.js` to SHELL array (after `./js/teacher.js`)
  
- **Modified**: `css/styles.css`
  - Added 11 lines of chat styling:
    - `.chat-log` — flex column with gaps
    - `.chat-msg`, `.chat-me`, `.chat-bot` — message bubbles
    - `.chat-typing` — typing indicator (opaque)
    - `.chat-bar` — sticky input + send button bar

## Tests

**Command**: `npm test`

**Results**:
```
1..44
# tests 44
# suites 0
# pass 44
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 228.004375
```

All 44 tests pass (41 existing + 3 new `recentMessages` tests from Task 1).

## Commits

| Task | Hash | Message |
|------|------|---------|
| 3 | a444abf | feat: tutor chat screen with persistent history |
| 4 | 823ac1f | feat: wire chat screen, cache v10, chat styles |

## Notes

- Both commits follow the exact plan specification (verbatim code blocks).
- No modifications to other files (e.g., `js/app.js` untouched per plan constraint).
- Chat UI in Russian; all user/AI text sanitized via `escapeHtml`.
- Error handling catches API failures and displays them in chat.
- Offline-first: history stored locally; service worker updated to cache the new module.
- Tab order updated implicitly: `registerFeature()` with `order: 6` places "Чат" between Teacher (5) and Study (10).

---

## Code-Review Fixes (plan-9-chat branch)

### Changes Applied

**Fix 1 — `js/util.js`: `recentMessages` strict alternation**
Added a deduplication pass after the initial trim: consecutive messages with the same role are collapsed to keep the last one. This guarantees the history array passed to the API always strictly alternates user/assistant.

**Fix 2 — `test/util.test.js`: new collapse test**
Added test `recentMessages: схлопывает подряд идущие одинаковые роли` verifying that `[user:a, user:b, assistant:c]` → `[user:b, assistant:c]`.

**Fix 3 — `js/chat.js`: try/finally wraps entire send body + input focus**
Moved `let history = []` declaration before try, moved all async work (getHistory, saveHistory, chatReply) inside try block. Added `input.focus()` after clearing the field. `busy = false` in finally now reliably resets even if IndexedDB throws before history is populated.

**Fix 4 — `js/chat.js`: robust `scrollBottom`**
Replaced `window.scrollTo(0, document.body.scrollHeight)` with `const el = document.scrollingElement || document.documentElement; el.scrollTop = el.scrollHeight` for cross-browser compatibility (iOS Safari, etc.).

### npm test output

```
1..45
# tests 45
# suites 0
# pass 45
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 218.052122
```

All 45 tests pass (44 existing + 1 new collapse test). 0 failures.
