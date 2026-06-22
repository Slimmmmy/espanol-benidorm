# Plan 6 Tasks 1–2 Implementation Report

## Summary
Tasks 1 and 2 completed successfully. All tests passing (32/32).

## Files Created
- `js/profile.js` — Learner profile management module with `pickNextTopic`, `buildProfile`, `saveProfileNote`, `recordLesson`, `getLessonHistory` functions.
- `test/profile.test.js` — Unit tests for `pickNextTopic` function (4 test cases).

## Files Modified
- `js/prompts.js` — Added `LESSON_GEN_SYSTEM` and `LESSON_REVIEW_SYSTEM` system prompts for lesson generation and review.
- `js/claude.js` — Extended imports to include `LESSON_GEN_SYSTEM`, `LESSON_REVIEW_SYSTEM`; added `generateLesson(profile, topic)` and `reviewLesson(lesson, answers)` functions.

## Task 1: Profile Module

### Test Execution
```bash
node --test test/profile.test.js
```

**Output:**
```
TAP version 13
# Subtest: pickNextTopic: пусто → общая практика
ok 1 - pickNextTopic: пусто → общая практика
# Subtest: pickNextTopic: самая частая слабая тема
ok 2 - pickNextTopic: самая частая слабая тема
# Subtest: pickNextTopic: пропускает только что пройденную тему
ok 3 - pickNextTopic: пропускает только что пройденную тему
# Subtest: pickNextTopic: единственная тема = последняя → всё равно возвращается
ok 4 - pickNextTopic: единственная тема = последняя → всё равно возвращается
1..4
# tests 4
# pass 4
# fail 0
```

**Commit:** `18917e3` — `feat: learner profile module with pickNextTopic and tests`

## Task 2: Prompts and AI Functions

### Node Import Check
```bash
node --input-type=module -e "import('./js/claude.js').then(m=>console.log(typeof m.generateLesson, typeof m.reviewLesson))"
```

**Output:** `function function`

**Commit:** `b60bfa9` — `feat: generateLesson and reviewLesson AI calls`

## Full Test Suite

### Execution
```bash
npm test
```

**Output Summary:**
- Total tests: 32
- Passed: 32 (100%)
- Failed: 0
- Tests include:
  - 4 lang.test.js (detection)
  - 4 profile.test.js (pickNextTopic) — NEW
  - 6 srs.test.js (scheduling)
  - 5 stats.test.js (streaks)
  - 4 util.test.js (escape/extract/similarity)

### Test Groups Status
- ✅ lang detection (4 pass)
- ✅ profile (4 pass) — NEW
- ✅ srs scheduling (6 pass)
- ✅ stats & streaks (5 pass)
- ✅ util helpers (4 pass)
- **Overall: 32/32 PASS**

## Implementation Details

### Task 1: `js/profile.js`
- `pickNextTopic(weak, lastTopic)`: Pure function selecting highest-count weak topic, skipping lastTopic if possible.
- `buildProfile()`: Async function aggregating level, words, learned count, weak topics, profile note, last topic, lessons completed.
- `saveProfileNote(note, lastTopic)`: Persists profile metadata to settings.teacherProfile.
- `recordLesson(entry)`: Appends lesson record to settings.lessonHistory.
- `getLessonHistory()`: Retrieves lesson history from settings.

### Task 2: `js/prompts.js` & `js/claude.js`
- Added `LESSON_GEN_SYSTEM`: System prompt for generating adaptive Spanish lessons with explanation + 3–5 exercises (mix of choice and open types).
- Added `LESSON_REVIEW_SYSTEM`: System prompt for checking exercise answers, providing per-exercise feedback, summary, next topic recommendation, and updated profile note.
- `generateLesson(profile, topic)`: Calls Claude API with lesson generation prompt, returns parsed lesson JSON.
- `reviewLesson(lesson, answers)`: Calls Claude API with review prompt, maps exercise types to expected answers, returns parsed review JSON with results array, summary, nextTopic, profileNote.

## Global Constraints Compliance
- ✅ All async operations checked for guard conditions post-await in Task 2 functions.
- ✅ JSON extracted via existing `extractJson` utility.
- ✅ No keys committed (API key handled via settings).
- ✅ Module structure follows existing patterns (no build step, native ES modules).
- ✅ Tests use Node 20 `node --test` runner.
- ✅ All 28 existing tests remain green; 4 new profile tests added.

## Commit Hashes
1. Task 1: `18917e3`
2. Task 2: `b60bfa9`
