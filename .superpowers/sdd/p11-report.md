# Plan 11 Report: Today Dashboard Implementation

## Files Created/Modified

### Created:
- `js/today.js` — Today dashboard screen with `summarizeToday()` export
- `test/today.test.js` — Unit tests for `summarizeToday()`

### Modified:
- `index.html` — Added `import './js/today.js';` after sync import
- `sw.js` — Bumped cache version from `espanol-v11` to `espanol-v12`; added `./js/today.js` to SHELL array
- `css/styles.css` — Added CSS rules for `.td-card`, `.td-row`, `.td-icon`, `.td-text`, `.td-done`

## Test Results

### Task 1: `node --test test/today.test.js`
```
TAP version 13
# Subtest: summarizeToday: собирает сводку
ok 1 - summarizeToday: собирает сводку
# Subtest: summarizeToday: пустые данные → дефолты
ok 2 - summarizeToday: пустые данные → дефолты
# Subtest: summarizeToday: курс пройден → nextUnitTitle пустой, hasCourse true
ok 3 - summarizeToday: курс пройден → nextUnitTitle пустой, hasCourse true
1..3
# tests 3
# pass 3
# fail 0
```

### Task 2: `npm test`
```
1..50
# tests 50
# suites 0
# pass 50
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

All 50 tests pass (47 existing + 3 new from `summarizeToday`).

## Commit Hashes

1. Task 1 commit: `4d226a0` - "feat: Today dashboard with summarizeToday and tests"
2. Task 2 commit: `fa05a01` - "feat: wire Today dashboard as home, cache v12, styles"

## Implementation Summary

- **Task 1:** Created `js/today.js` with:
  - `summarizeToday()` pure function that extracts streak, due, dailyAdded, dailyTotal, nextUnitTitle, hasCourse, openAssignments
  - `card()` helper for building dashboard cards with escapeHtml safety
  - `render()` async function that loads data from getStats, getCourse, getAssignments, getSetting, then renders dashboard
  - Feature registered with `registerFeature()` with `id: 'today'`, `order: 4` (makes it the home screen)

- **Task 2:** Integrated into app:
  - Imported `today.js` in index.html after sync
  - Updated service worker cache to v12 with today.js in SHELL
  - Added CSS styling for dashboard cards (.td-card, .td-row, .td-icon, .td-text, .td-done)

## Verification

- ✓ Task 1 tests pass (3/3)
- ✓ Task 2 full test suite passes (50/50)
- ✓ No existing functionality broken
- ✓ Today dashboard is now the home/startup screen (order: 4 is the lowest)
