# Plan 8 — Tasks 1 & 2 Completion Report

## Summary
Tasks 1 and 2 completed successfully. All tests pass (41 total: 38 prior + 3 new nextUnit tests).

## Files Modified

### Task 1: Course Storage Helpers
- **js/profile.js** — Added 4 exports:
  - `nextUnit(units)` — Pure function; returns first unit with `status !== 'done'` or null
  - `getCourse()` — Async; returns `settings.course` or null
  - `saveCourse(course)` — Async; persists course to settings
  - `markUnitDone(unitId, score)` — Async; marks unit done and writes score

- **test/profile.test.js** — Added 3 tests:
  - `nextUnit: первый невыполненный юнит`
  - `nextUnit: все выполнены → null`
  - `nextUnit: пусто/undefined → null`

### Task 2: Course Generation Prompt & Function
- **js/prompts.js** — Added `COURSE_GEN_SYSTEM` export
  - System prompt for 10–12 unit personal course generation
  - Targets Benidorm region, respects weak topics, JSON-only output

- **js/claude.js** — Extended imports and added function:
  - Updated import line to include `COURSE_GEN_SYSTEM`
  - Added `generateCourse(profile, goal)` export
  - Calls Claude API with `maxTokens: 1100`, extracts JSON

## Test Execution

### Profile Tests (`node --test test/profile.test.js`)
```
1..7
# tests 7
# pass 7
# fail 0
```
✓ All 7 tests pass (4 pickNextTopic + 3 nextUnit)

### Import Check (`node --input-type=module -e "import('./js/claude.js').then(m=>console.log(typeof m.generateCourse))"`)
```
function
```
✓ `generateCourse` is correctly exported as a function

### Full Test Suite (`npm test`)
```
1..41
# tests 41
# pass 41
# fail 0
```
✓ All 41 tests pass (38 prior + 3 new nextUnit)

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 | `c1b2413` | feat: course storage helpers and nextUnit with tests |
| Task 2 | `f1d480f` | feat: generateCourse AI syllabus generator |

## Verification Checklist
- ✓ Profile.js exports: `nextUnit`, `getCourse`, `saveCourse`, `markUnitDone`
- ✓ Tests added to profile.test.js (3 nextUnit tests)
- ✓ COURSE_GEN_SYSTEM added to prompts.js
- ✓ claude.js imports COURSE_GEN_SYSTEM
- ✓ generateCourse function added to claude.js
- ✓ Import check confirms generateCourse is a function
- ✓ All 41 tests pass (node --test and npm test)
- ✓ No unrelated code altered
- ✓ Commits created with exact messages from plan

## Status
**DONE** — All requirements met, tests passing, code ready for Task 3.
