# Plan 5 Implementation Report

## Task Execution Summary

All three tasks of Plan 5 («5 слов в день») completed successfully.

## Files Created/Modified

### Created
- `js/daily.js` — Screen for daily 5-word picker with add-to-dictionary and grammar-check functionality

### Modified
- `js/prompts.js` — Added `DAILY_WORDS_SYSTEM` prompt constant
- `js/claude.js` — Extended prompts import, added `generateDailyWords(knownEs)` function
- `index.html` — Added import for `./js/daily.js` in correct position
- `sw.js` — Bumped CACHE to `espanol-v5`, added `./js/daily.js` to SHELL array
- `css/styles.css` — Added daily-words screen styles (progress indicator, added badge, apply box, feedback)

## Node Import Check

```
generateDailyWords: function checkGrammar: function
```

Both functions successfully imported and callable.

## Test Results

```
TAP version 13
# tests 28
# pass 28
# fail 0
```

All 28 existing unit tests pass (0 failures). New screen is browser/AI-tested per manual checklist.

## Commit History

| Task | Hash | Message |
|------|------|---------|
| Task 1 | 3894fee | feat: generateDailyWords AI daily vocabulary picker |
| Task 2 | 9f88761 | feat: daily 5-words screen (AI picks, add to SRS, apply with check) |
| Task 3 | 7e0cf35 | feat: wire daily-words screen, cache v5, styles |

## Spec Compliance

✓ 5 new daily words with exclusion of known words (via `getAllWords().es`)
✓ Practical Benidorm/Valencia vocabulary with local context via prompt
✓ Translation, example, sound playback (🔊 button)
✓ Add-to-dictionary button integrates with SRS (`newCard`) and marks progress
✓ Apply button reveals textarea for custom sentence
✓ Grammar check via `checkGrammar()` with AI feedback (ok/corrected/explanation)
✓ Daily progress counter (N/5 added)
✓ Daily set stored in settings by `daily-<dayKey>`, persists across page reload on same day
✓ New set generated on next day via `loadOrCreate` logic
✓ Screen registered via `registerFeature` with order 15 (between Study and Dictionary)
✓ All dynamic text safely escaped via `escapeHtml`
✓ Guards after `await` to check container state before DOM updates
✓ Offline cache via service worker v5

## Status

**DONE** — All tasks complete, tests passing, commits in place.

---

## Code-Review Fix Pass (2026-06-22)

### Changes Applied to `js/daily.js`

**Fix 1 (Critical) — `r.ok` coerced to boolean before use in class/label expressions**

Introduced `const isOk = !!r.ok;` in the `data-check` click handler and replaced both usages of `r.ok` in the template literal with `isOk`.

**Fix 2 (Important) — Full canonical word shape including `pos` and `gender`**

Added `pos: '', gender: ''` to the `putWord(...)` call in the `data-add` handler so the stored word object matches the canonical schema.

**Fix 3 (Important) — Double-click guard on "Добавить в словарь"**

Reworked `data-add` handler to check `if (w.added) return;` and set `b.disabled = true` before the first `await`. Wrapped the async body in `try/catch` so on error the button is re-enabled and the error message is shown in `#dly-status`.

**Fix 4 (Important) — Progress counter via `textContent` instead of `innerHTML`**

Replaced `status.innerHTML = '<span class="daily-progress">...</span>'` with:
```js
status.className = 'status daily-progress';
status.textContent = `Добавлено ${added}/5`;
```

### Test Results After Fixes

```
TAP version 13
# tests 28
# suites 0
# pass 28
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 153.121053
```

All 28 tests pass (0 failures).
