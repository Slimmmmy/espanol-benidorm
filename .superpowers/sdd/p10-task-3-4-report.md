# Plan 10 Tasks 3 & 4 — Report

## Tasks Completed

**Task 3: Create `js/assignments.js`**
- Created new file with assignments screen module
- Exports: `registerFeature` call registering "Задания" tab with order 45
- Functions: `openHtml`, `doneHtml`, `newAssignment`, `submit`, `render`
- State: assignment list with `{ id, text, topic, status, createdAt, answer, feedback, ok, doneAt }`
- Features:
  - "Получить задание" button calls `generateAssignment(profile, topic)`
  - Textarea for student answer, "Сдать на проверку" calls `checkAssignment(task, answer)`
  - Results: partitions open/done; done assignments in collapsible details
  - Safe: all user/model text via `escapeHtml`, `busy` flag prevents double-submit
  - Guards: checks screen exists after each `await`

**Task 4: Integration and Testing**
- Modified `index.html`: added `import './js/assignments.js';` after grammar.js import
- Modified `sw.js`: bumped CACHE to `'espanol-v11'`, added `'./js/assignments.js',` to SHELL after grammar.js
- Ran full test suite: **all 47 tests pass, 0 failures**

## Files Created/Modified

| File | Change |
|------|--------|
| `js/assignments.js` | Created (99 lines) |
| `index.html` | Added assignments.js import |
| `sw.js` | Cache v11, assignments.js in SHELL |

## npm test Output

```
# tests 47
# suites 0
# pass 47
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 223.809839
```

## Commit Hashes

- **Task 3**: `1123325` — "feat: assignments screen (issue, answer, AI check, statuses)"
- **Task 4**: `680780b` — "feat: wire assignments screen, cache v11"

## Verification

- Tests: All 47 pass (45 existing + 2 new partitionAssignments tests)
- No changes to `js/app.js` (as required)
- Plan constraints met:
  - UI in Russian ✓
  - ES modules, no build ✓
  - Dynamic text via `escapeHtml` ✓
  - Node 20 `node --test` passing ✓
  - Offline caching via service worker ✓
  - No untracked files or uncommitted changes
