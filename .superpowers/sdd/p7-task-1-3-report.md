# Plan 7 Tasks 1–3 Implementation Report

## Summary
Successfully implemented Tasks 1–3 of the cloud sync plan. All code created and committed; all 38 tests passing (32 prior + 6 new merge tests, 0 failures).

## Files Created/Modified

### Created
- `js/merge.js` — snapshot merge logic with 4 exported functions (mergeWords, mergeMistakes, mergeSettings, mergeSnapshots)
- `test/merge.test.js` — unit tests for merge logic (6 tests)
- `js/sync.js` — Supabase cloud sync integration with 7 exported functions (getSyncConfig, pullRemote, pushRemote, localSnapshot, applySnapshot, syncNow, autoSync)

### Modified
- `js/db.js` — added 2 new functions (bulkReplaceWords, bulkReplaceMistakes) at end of file

## Test Results

### Task 1: `node --test test/merge.test.js`
```
1..6
# tests 6
# suites 0
# pass 6
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

**Tests passing:**
1. mergeWords: объединяет разные слова
2. mergeWords: для дубля берёт более свежий (больше reps), без id
3. mergeMistakes: объединяет и дедуплицирует по phrase|createdAt
4. mergeSettings: studyDays объединяются и сортируются
5. mergeSettings: teacherProfile — позже обновлённый
6. mergeSnapshots: собирает все три части

### Task 2: Node import check
```
node --input-type=module -e "import('./js/db.js').then(m=>console.log(typeof m.bulkReplaceWords, typeof m.bulkReplaceMistakes))"
Output: function function
```

### Task 3: Node import check
```
node --input-type=module -e "import('./js/sync.js').then(m=>console.log(typeof m.syncNow, typeof m.autoSync))"
Output: function function
```

### Full Test Suite: `npm test`
```
1..38
# tests 38
# suites 0
# pass 38
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

**Summary:** 38/38 tests passing (32 prior tests + 6 new merge tests)

## Commit Hashes

| Task | Hash | Message |
|------|------|---------|
| Task 1 | fbfaa3a | feat: snapshot merge logic with tests |
| Task 2 | be2e397 | feat: bulkReplaceWords/bulkReplaceMistakes for sync apply |
| Task 3 | a3ad945 | feat: Supabase cloud sync (pull/merge/apply/push) |

## Implementation Details

### Task 1: Merge Logic (js/merge.js)
- **mergeWords**: Deduplicates by normalized Spanish word (case-insensitive, trimmed); picks "fresher" copy (higher reps, then due, then createdAt); strips `id` from output
- **mergeMistakes**: Deduplicates by phrase|createdAt key; strips `id`
- **mergeSettings**: Preserves studyDays/lessonHistory union with sorting; teaches teacherProfile to use most recently updated; selects daily-* set with more added words; all other keys prefer local (first argument)
- **mergeSnapshots**: Orchestrates merging of all three data sections (words, mistakes, settings)

### Task 2: Bulk Operations (js/db.js additions)
- **bulkReplaceWords**: Clears words store and adds array of words (strips `id` to let autoIncrement assign new IDs)
- **bulkReplaceMistakes**: Clears mistakes store and adds array of mistake items (same `id` stripping)

### Task 3: Cloud Sync (js/sync.js)
- **getSyncConfig**: Reads Supabase URL, anon key, sync code from settings
- **pullRemote**: Fetches remote snapshot via Supabase REST API with sync code filter
- **pushRemote**: Sends merged snapshot back to Supabase (handles conflict resolution via Prefer header)
- **localSnapshot**: Exports current state, strips secret keys (apiKey, supabaseUrl, supabaseKey, syncCode) before transmission
- **applySnapshot**: Writes merged snapshot locally via bulk operations; skips secret keys to prevent overwriting credentials
- **syncNow**: Orchestrates pull → merge → apply → push; throws user-friendly errors if not configured
- **autoSync**: Silently syncs if configured, otherwise quietly fails (no interruption to offline-first app)

## Architecture Notes

- All merge functions are pure (no side effects, no external I/O)
- SECRET_KEYS filter (`['apiKey', 'supabaseUrl', 'supabaseKey', 'syncCode']`) applied in both `localSnapshot` (build) and `applySnapshot` (apply) to prevent credentials leaking to cloud
- Sync operations are async, using native fetch for HTTP
- Tests confirm no `id` fields remain in merged output (IndexedDB autoIncrement will assign new ones on apply)
- Full test suite runs successfully with no failures; merge tests are isolated and fast (~100ms total)
