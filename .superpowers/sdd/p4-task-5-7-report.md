# Plan 4 Tasks 5–7 Report

## Summary

All three tasks completed successfully. Speech coach screen (Логопед) with intelligibility scoring and AI pronunciation coaching is now available. Progress screen shows study streaks, vocabulary counts, and weak grammar topics. Study day tracking is integrated into card grading. All tests pass (28/28).

## Files Created

- `js/speech.js` — Speech coach screen component; registers feature with `order: 35`
- `js/progress.js` — Progress dashboard component; registers feature with `order: 50`

## Files Modified

- `js/study.js` — Added import of `recordStudyDay` from stats.js; calls `await recordStudyDay()` after card grading to track study days
- `index.html` — Added module imports for `./js/speech.js` and `./js/progress.js` in the correct tab order
- `sw.js` — Bumped cache version from `espanol-v3` to `espanol-v4`; added 4 new files to SHELL array: `./js/stats.js`, `./js/asr.js`, `./js/speech.js`, `./js/progress.js`
- `css/styles.css` — Appended 5 CSS rules for stats grid, stat cards, and speech score styling

## npm test Output

```
TAP version 13
# tests 28
# suites 0
# pass 28
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 144.10053
```

All tests pass:
- `lang.test.js`: 4 tests
- `srs.test.js`: 8 tests
- `stats.test.js`: 5 tests
- `util.test.js`: 11 tests (5 original + 6 new for normalizeText/similarity)

## Commit Hashes

1. **Task 5**: `6231a5e` — "feat: speech coach screen (intelligibility score + AI coaching + drills)"
2. **Task 6**: `636731a` — "feat: progress screen and study-day tracking for streak"
3. **Task 7**: `a7b3339` — "feat: wire speech and progress screens, cache v4, styles"

## Implementation Details

### Task 5: `js/speech.js`
- Exports 6 Spanish phrases (tongue twisters and conversational sentences)
- "🔊 Образец" button plays target phrase via TTS
- "🎤 Говорить" records audio and computes intelligibility score via `similarity()`
- Score-based label: ≥85% "🟢 Отлично", ≥60% "🟡 Неплохо", <60% "🔴 Стоит поработать"
- "Разбор от логопеда" button calls `gradeSpeech()` for AI coaching on sounds, rhythm, and exercises
- "Другая фраза" cycles through phrase list
- Error handling with guard clauses (checks `container.querySelector()` after async await)
- Uses `escapeHtml` for safe DOM insertion

### Task 6: `js/progress.js`
- Async render fetches stats via `getStats()` from stats.js
- Displays 4-card grid: streak (days), vocabulary count, learned count, due today count
- Shows weak grammar topics ranked by error frequency from mistakes store
- Fallback message if no grammar errors yet
- Guard check for container connection after async load

### Task 6: `js/study.js` modification
- Added `import { recordStudyDay } from './stats.js';` at top
- Added `await recordStudyDay();` immediately after `await putWord(updated);` in `grade()` function
- This ensures every card grading event logs the current day in `studyDays` setting for streak computation

### Task 7: Integration
- Index.html imports both new screens in tab order: speech (order 35) between listening (30) and grammar (40); progress (order 50) between grammar and settings (90)
- Service worker cache bumped to v4 with all new module files
- CSS grid styling for stats display and speech coach score labels

## Test Coverage

All modules with pure logic (no browser/AI/audio APIs) are tested:
- `normalizeText()` and `similarity()` — text normalization and Levenshtein distance-based intelligibility scoring
- `computeStreak()` — streak calculation handles edge cases (gap detection, yesterday's activity, etc.)
- `dayKey()` — YYYY-MM-DD date formatting
- `recordStudyDay()` and `getStats()` — async stats collection (mocked via Node test harness)

## Concerns

None. All requirements met:
- Screens render asynchronously with guard clauses
- AI errors caught and displayed without crashing app
- All dynamic text escaped for XSS safety
- Offline caching configured
- Tests 100% pass rate
- No unrelated code modified

---

## Code-Review Fixes (post-tasks 5–7)

Applied three targeted fixes on branch `plan-4-speech-progress`.

### Fix 1 (Critical) — `js/progress.js` dead-code navigation guard

`container.querySelector` is always truthy on a DOM element, so the condition `!container.isConnected && !container.querySelector` could never short-circuit on the second clause. Removed the dead clause:

```js
// Before:
if (!container.isConnected && !container.querySelector) return;
// After:
if (!container.isConnected) return;
```

### Fix 2 (Important) — `js/speech.js` capture `target` before `await`

Previously `target` was captured after `recognizeOnce()` resolved, meaning a "Другая фраза" tap mid-recognition would cause `target` to reflect the new phrase while `heard` reflected the old one. Fixed by capturing `target` before awaiting:

```js
// Before:
const heard = await recognizeOnce();
const target = PHRASES[idx];
// After:
const target = PHRASES[idx];
const heard = await recognizeOnce();
```

### Fix 3 (Minor) — `js/asr.js` prevent double rejection from `onend` after `onerror`

When the browser fires `onerror` followed by `onend`, the existing `onend` guard `if (!got)` would also reject the promise (a no-op for native Promises but noisy and semantically wrong). Setting `got = true` in `onerror` makes `onend` skip the second rejection:

```js
// Before:
r.onerror = (e) => reject(new Error('Ошибка распознавания: ' + (e.error || 'неизвестно')));
// After:
r.onerror = (e) => { got = true; reject(new Error('Ошибка распознавания: ' + (e.error || 'неизвестно'))); };
```

### npm test Output (post-fix)

```
TAP version 13
# tests 28
# suites 0
# pass 28
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 151.959679
```

All 28 tests pass. No regressions.

### Commit

`fix: Plan 4 review (progress guard, capture target before await, asr double-reject)`
