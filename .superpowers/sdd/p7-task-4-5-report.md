# Plan 7: Tasks 4-5 Implementation Report

## Files Modified

### Task 4: Sync Settings Fields and Manual Sync Button
**File:** `js/settings.js`
- Added import: `import { syncNow } from './sync.js';`
- Added state reads at start of `render()`:
  - `const supabaseUrl = (await getSetting('supabaseUrl')) || '';`
  - `const supabaseKey = (await getSetting('supabaseKey')) || '';`
  - `const syncCode = (await getSetting('syncCode')) || '';`
- Added sync section markup with 3 input fields (Supabase URL, anon-key, sync code) and sync button, inserted before `<p id="set-status">`
- Updated `#set-save` onclick handler to save the 3 new fields
- Added `#set-sync` onclick handler for manual synchronization with status reporting

### Task 5: Auto-Sync Integration and Cache Update
**Files:** `index.html`, `sw.js`

**index.html:**
- Added import: `import { autoSync } from './js/sync.js';`
- Added call: `autoSync();` after `startApp();`

**sw.js:**
- Bumped `CACHE` from `'espanol-v6'` to `'espanol-v7'`
- Added to `SHELL` array: `'./js/merge.js', './js/sync.js'`

## Test Results

```
npm test
TAP version 13
...
1..38
# tests 38
# suites 0
# pass 38
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 199.787223
```

All 38 tests pass:
- 6 new merge tests (mergeWords, mergeMistakes, mergeSettings, mergeSnapshots)
- 32 existing tests (lang, util, srs, stats, profile)
- 0 failures

## Commit Hashes

- Task 4: `7b99fae` — feat: sync settings fields and manual sync button
- Task 5: `61b0b8c` — feat: auto-sync on startup, cache v7

## Summary

Tasks 4 and 5 of Plan 7 (Cloud Sync) implemented successfully. Settings screen now has Supabase configuration fields and manual sync button. Auto-sync runs silently on app startup. Service worker caches new sync modules for offline availability. All 38 tests pass with 0 failures.

---

## Code-Review Fixes (post-implementation)

### Fix 1 (Important) — `js/settings.js`: escape sync fields via post-render value assignment

Removed `value="${...}"` interpolation from the three sync input fields in the innerHTML template to eliminate potential XSS via stored settings values. Instead, set values after render using the same safe pattern already used for `#set-key`:

```js
container.querySelector('#set-surl').value = supabaseUrl;
container.querySelector('#set-skey').value = supabaseKey;
container.querySelector('#set-scode').value = syncCode;
```

### Fix 2 (Minor, correctness) — `js/db.js`: atomic `bulkReplaceWords` and `bulkReplaceMistakes`

Replaced sequential per-operation transactions (clear + individual adds each in separate transactions) with a single transaction wrapping the entire clear+add sequence. A crash mid-sync can no longer leave the store empty. Both functions now use a single `db.transaction(...)` with `t.oncomplete`/`t.onerror`/`t.onabort` handlers to await the full atomic operation.

### Test Results After Fixes

```
npm test
TAP version 13
...
1..38
# tests 38
# suites 0
# pass 38
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 210.787881
```

All 38 tests pass (0 failures).
