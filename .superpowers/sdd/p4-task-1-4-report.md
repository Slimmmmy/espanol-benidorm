# Plan 4 Tasks 1–4 Implementation Report

## Summary
All four tasks completed successfully with 28 unit tests passing (0 failures). Four new modules created/extended, tests implemented, all functions exported correctly.

## Files Created/Modified

### Created Files:
- `js/stats.js` — Statistics module with streak computation, study day recording, and stats aggregation
- `test/stats.test.js` — 5 unit tests for stats functions
- `js/asr.js` — One-shot speech recognition wrapper over Web Speech API

### Modified Files:
- `js/util.js` — Added `normalizeText()` and `similarity()` functions with internal Levenshtein
- `test/util.test.js` — Added 5 new tests (6 old + 5 new = 11 total)
- `js/prompts.js` — Added `SPEECH_COACH_SYSTEM` constant
- `js/claude.js` — Extended prompts import, added `gradeSpeech()` function

## Test Results

### Task 1: Intelligibility & Normalization
**Command:** `node --test test/util.test.js`
**Result:** 11 tests PASS (6 old + 5 new)
- normalizeText: регистр, диакритика, пунктуация ✓
- similarity: идентичные (с учётом регистра/акцентов) = 1 ✓
- similarity: совсем разное → низкое ✓
- similarity: обе пустые = 1, одна пустая = 0 ✓
- similarity: близкое произношение → высокое ✓

### Task 2: Stats Module
**Command:** `node --test test/stats.test.js`
**Result:** 5 tests PASS
- computeStreak: три дня подряд по сегодня = 3 ✓
- computeStreak: серия по вчера (сегодня ещё не занимался) считается ✓
- computeStreak: пусто = 0 ✓
- computeStreak: разрыв обрывает серию ✓
- computeStreak: ни сегодня, ни вчера = 0 ✓

### Task 3: AI Coaching & Prompts
**Command:** `node --input-type=module -e "import('./js/claude.js').then(m=>console.log(typeof m.gradeSpeech))"`
**Result:** `function` ✓

### Task 4: Speech Recognition
**File:** `js/asr.js` created with `recognizeOnce(lang)` function ✓

### Full Test Suite
**Command:** `npm test`
**Result:** 28 tests PASS, 0 failures
- lang.test.js: 4 tests ✓
- srs.test.js: 8 tests ✓
- stats.test.js: 5 tests ✓
- util.test.js: 11 tests ✓

## Commit History

1. **c8d5d77** — feat: normalizeText and similarity (intelligibility scoring) with tests
2. **4dc088b** — feat: stats module with streak computation and tests
3. **8683e80** — feat: gradeSpeech AI pronunciation coaching
4. **d0a0602** — feat: one-shot speech recognition wrapper

## Implementation Notes

### Task 1 (normalizeText/similarity)
- Implemented exact Unicode combining-marks regex `[̀-ͯ]` as specified in plan
- Levenshtein distance algorithm for similarity scoring (0–1 range)
- Handles edge cases: empty strings, identical after normalization, partial matches

### Task 2 (stats.js)
- `dayKey()`: ISO date format from timestamp (handles timezone via UTC)
- `computeStreak()`: Pure function with Set-based lookup; handles series ending today or yesterday
- `recordStudyDay()`: Idempotent append to `studyDays` setting
- `getStats()`: Aggregates words count, learned (reps ≥ 3), due (now), streak, weak topics from mistakes

### Task 3 (SPEECH_COACH_SYSTEM/gradeSpeech)
- Prompt tuned for Russian speakers (typical pronunciation issues: rr, c/z, ll/y, b/v)
- `gradeSpeech()` calls Claude with target phrase + recognized text, extracts JSON
- Response shape: `{ sounds, rhythm, exercise }`

### Task 4 (asr.js)
- Web Speech API wrapper; uses `window.SpeechRecognition` or `window.webkitSpeechRecognition`
- Error handling: browser compatibility, recognition errors, silent/no-speech cases
- Language-aware (defaults to `'es-ES'`)

## Status
✓ DONE — All tasks completed, all tests passing, ready for Tasks 5–7 (speech.js, progress.js, integration)
