# Plan 3 Tasks 5-7 Implementation Report

## Summary
Successfully implemented Tasks 5, 6, and 7 of Plan 3 (Audio + Grammar screens) for Español Benidorm PWA.

## Files Created

### Task 5
- **js/listening.js** (100 lines)
  - Registers "Аудио" (Audio) screen with order=30
  - Generates AI dialogue via `generateDialogue()`
  - Displays dialogue transcript with speaker names and Spanish/Russian text
  - Controls: Play dialogue (role-based TTS via `speakSequence`), Stop, Show/Hide translation
  - Comprehension question with multiple-choice options
  - Visual feedback for correct/incorrect answers
  - Local notes/vocabulary display

### Task 6
- **js/grammar.js** (46 lines)
  - Registers "Грамматика" (Grammar) screen with order=40
  - Textarea input for user's Spanish phrases
  - AI grammar check via `checkGrammar()`
  - Displays corrected phrase, Russian explanation, and grammar topic
  - Automatic logging of mistakes to IndexedDB (only when `ok === false`)
  - Visual indicators: ✅ for correct, ✏️ for needs correction

## Files Modified

### Task 7

#### index.html
- Added imports for `./js/listening.js` and `./js/grammar.js`
- Placed correctly between `dictionary.js` and `settings.js`
- Maintains existing import structure

#### sw.js
- Updated cache version: `espanol-v2` → `espanol-v3`
- Added to SHELL array:
  - `'./js/listening.js'`
  - `'./js/grammar.js'`
- Ensures offline cache contains new modules

#### css/styles.css
- Added 13 new CSS rules for dialogue and grammar screens:
  - `textarea`: styled input field
  - `.dlg-controls`: flex container for playback buttons
  - `.dlg-line`: dialogue line spacing
  - `.dlg-speaker`: speaker name styling (accent color, bold)
  - `.dlg-ru`: Russian translation block
  - `.dlg-q`: question container
  - `.opt`: option button (flex: 1)
  - `.opt.ok`: success state styling (#22c55e)
  - `button.ok`: button success state
  - `.gr-ok`: grammar correct text (green)
  - `.gr-bad`: grammar error text (amber)

## Test Results

```
TAP version 13
# tests 18
# suites 0
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 130.246803
```

All existing unit tests pass (lang, util, srs modules). No test failures.
Tests cover: language detection, SRS scheduling, HTML escaping, JSON extraction.

## Commits

| Hash | Message |
|------|---------|
| 0b4c263 | feat: audio screen (AI dialogue, role playback, transcript, comprehension) |
| a0b481b | feat: grammar screen (AI check, Russian explanation, mistake logging) |
| fb3743a | feat: wire audio and grammar screens, cache v3, styles |

## Verification Checklist

✅ Task 5: `js/listening.js` created and committed
✅ Task 6: `js/grammar.js` created and committed
✅ Task 7: `index.html` modified with new imports
✅ Task 7: `sw.js` cache version bumped, new files added
✅ Task 7: `css/styles.css` extended with dialogue/grammar styles
✅ Task 7: `npm test` passes 18/18 tests
✅ Tab order: Аудио (order:30), Грамматика (order:40) positioned correctly
✅ All escapeHtml() calls present for dynamic content
✅ Guards in place to check DOM exists after async operations

## Architecture Validation

- **Module isolation**: Each screen registers independently via `registerFeature()`
- **API integration**: Uses existing `generateDialogue()`, `checkGrammar()` from claude.js
- **Data persistence**: Mistakes logged to IndexedDB v2 store
- **Offline support**: Cache v3 includes all new modules
- **Security**: Dynamic text routed through `escapeHtml()`
- **Error handling**: Status messages display API/parsing errors to user

---

## Code-Review Fixes (Plan 3 Review Pass)

Applied all 6 findings from the code-review on branch `plan-3-audio-grammar`.

### Fix 1 — Dead import removed (`js/listening.js`)
Removed `speak` from the import: `import { speakSequence, stopSpeaking } from './tts.js';`

### Fix 2 — `d.answer` coerced to integer (`js/listening.js`)
In `wireDialogue` opt click handler, added `const answerIdx = Number(d.answer);` and used `answerIdx` for both the `===` comparison and the `querySelector` selector, replacing direct use of `d.answer`.

### Fix 3 — Error display after navigation (`js/listening.js`, `js/grammar.js`)
Changed both `catch` blocks to re-query the status element via `container.querySelector(...)` with a null guard, so errors still display even if the user navigated away and back.

### Fix 4 — Double-click guard (`js/listening.js`)
Added module-level `let generating = false;`. `generate()` now returns early if `generating` is true, sets it at entry, and resets it in a `finally` block so both success and error paths clear the flag.

### Fix 5 — `.add()` for append-only log (`js/db.js`)
Changed `tx(db, 'mistakes', 'readwrite').put(m)` to `.add(m)` to prevent overwriting existing mistake records (store uses `autoIncrement` key).

### Fix 6 — Clarifying comment in `speakSequence` (`js/tts.js`)
Added comment above the `for` loop:
```
// Реплики ставятся в очередь синтеза синхронно — полагаемся на очередь Chrome (целевой браузер).
```

### Test Results After Review Fixes

```
TAP version 13
# tests 18
# suites 0
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 126.595514
```

All 18 tests pass. 0 failures.
