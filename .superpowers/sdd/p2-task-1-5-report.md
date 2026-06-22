# Plan 2 — Tasks 1–5 Implementation Report

**Date:** 2026-06-22  
**Branch:** `plan-2-dictionary-srs`  
**Status:** DONE

---

## Files Created

### Task 1: Utilities
- **`js/util.js`** — HTML escaping and JSON extraction
- **`test/util.test.js`** — Unit tests (6 passing)

### Task 2: SRS Engine
- **`js/srs.js`** — Spaced repetition scheduling
- **`test/srs.test.js`** — Unit tests (8 passing)

### Task 5: Text-to-Speech
- **`js/tts.js`** — Web Speech API wrapper for Spanish

## Files Modified

### Task 3: Data Layer
- **`js/db.js`** — Added `getWord(id)` and `deleteWord(id)` functions

### Task 4: AI Integration
- **`js/prompts.js`** — Added `WORD_ENRICH_SYSTEM` constant
- **`js/claude.js`** — Added imports and `enrichWord(input)` function

---

## Test Results

### Task 1: `node --test test/util.test.js`
```
TAP version 13
# Subtest: escapeHtml экранирует спецсимволы
ok 1 - escapeHtml экранирует спецсимволы
# Subtest: escapeHtml: null/undefined → пустая строка
ok 2 - escapeHtml: null/undefined → пустая строка
# Subtest: extractJson: чистый JSON
ok 3 - extractJson: чистый JSON
# Subtest: extractJson: в ограждении ```json
ok 4 - extractJson: в ограждении ```json
# Subtest: extractJson: с текстом вокруг
ok 5 - extractJson: с текстом вокруг
# Subtest: extractJson: нет JSON → ошибка
ok 6 - extractJson: нет JSON → ошибка
1..6
# tests 6
# suites 0
# pass 6
# fail 0
```

### Task 2: `node --test test/srs.test.js`
```
TAP version 13
# Subtest: newCard: стартовые значения
ok 1 - newCard: стартовые значения
# Subtest: schedule good: первый раз → интервал 1 день
ok 2 - schedule good: первый раз → интервал 1 день
# Subtest: schedule good: второй раз → 3 дня
ok 3 - schedule good: второй раз → 3 дня
# Subtest: schedule good: третий раз → round(3 * ease)
ok 4 - schedule good: третий раз → round(3 * ease)
# Subtest: schedule again: сброс reps, +lapse, ease вниз, due через 10 минут
ok 5 - schedule again: сброс reps, +lapse, ease вниз, due через 10 минут
# Subtest: schedule again: ease не опускается ниже 1.3
ok 6 - schedule again: ease не опускается ниже 1.3
# Subtest: schedule не мутирует входную карточку
ok 7 - schedule не мутирует входную карточку
# Subtest: dueCards: только просроченные
ok 8 - dueCards: только просроченные
1..8
# tests 8
# suites 0
# pass 8
# fail 0
```

### Task 3: Node Import Check
```
$ node --input-type=module -e "import('./js/db.js').then(m=>console.log(typeof m.getWord, typeof m.deleteWord))"
function function
```

### Task 4: Node Import Check
```
$ node --input-type=module -e "import('./js/claude.js').then(m=>console.log(typeof m.enrichWord, typeof m.callClaude))"
function function
```

---

## Commit Hashes

| Task | Commit | Message |
|------|--------|---------|
| 1 | `aa4d222` | feat: escapeHtml and extractJson utils with tests |
| 2 | `198e201` | feat: SRS scheduling engine with tests |
| 3 | `428252f` | feat: add getWord and deleteWord to data layer |
| 4 | `3ed8ef6` | feat: enrichWord AI dictionary lookup with local-dialect prompt |
| 5 | `e6ff7be` | feat: Spanish text-to-speech helper |

---

## Summary

All five tasks completed successfully:

- **Task 1:** 6 tests passing (escapeHtml, extractJson)
- **Task 2:** 8 tests passing (newCard, schedule, dueCards, DAY)
- **Task 3:** Data layer extended with getWord/deleteWord (syntax verified)
- **Task 4:** AI enrichment pipeline with WORD_ENRICH_SYSTEM prompt and enrichWord function (syntax verified)
- **Task 5:** TTS helper module created (speak function with Web Speech API)

All code follows plan specification exactly. No build step required; pure ES modules verified with Node 20.

No concerns. Ready for Tasks 6–8 (dictionary and study screens integration).
