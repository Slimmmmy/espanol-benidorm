# Plan 13 Implementation Report: Voice Chat

## Summary

All three tasks completed successfully. Voice input (es-ES speech recognition) and tutor reply playback (🔊) integrated into chat. All 55 tests pass.

## Files Modified

### Task 1: Voice Coaching Hint
- `js/prompts.js` — Added `VOICE_COACH_HINT` constant
- `js/claude.js` — Updated import list, replaced `chatReply` function with 3-arg version

### Task 2: Voice Input & Reply Playback
- `js/chat.js` — Added voice input/recognition + speaker playback:
  - Added imports: `recognizeOnce` (asr.js), `speak` (tts.js)
  - Updated `bubblesHtml` to mark voice messages with 🎤 and add 🔊 button to bot replies
  - Updated `renderLog` to attach onclick handlers to 🔊 buttons
  - Changed `send` signature to `(container, opts = {})` with voice flag propagation
  - Added `voiceInput` function for es-ES speech recognition
  - Updated `render` to add 🎤 button and handler

### Task 3: Styles & Cache
- `css/styles.css` — Added voice/speaker button styles (#chat-mic, .chat-say)
- `sw.js` — Bumped CACHE from `espanol-v15` to `espanol-v16`

## Verification

### Import Check (Task 1)
```
node --input-type=module -e "import('./js/claude.js').then(m=>console.log(typeof m.chatReply))"
```
Output: `function` ✓

### Import Check (Task 2)
```
node --input-type=module -e "import('./js/chat.js').then(()=>console.log('chat ok')).catch(e=>console.log('ERR',e.message))"
```
Output: `chat ok` ✓

### Test Results (Task 3)
```
npm test
```
Output: **55 pass, 0 fail** ✓

## Commit Hashes

1. Task 1: `57fe7a4` — feat: voice coaching hint for spoken chat messages
2. Task 2: `4b2228a` — feat: voice input (es-ES) and reply playback in tutor chat
3. Task 3: `a81c848` — feat: chat voice/speaker styles, cache v16

## Architecture Notes

- Voice messages flagged with `voice: true` in history; `recentMessages` extracts only role/content for API
- `chatReply` appends `VOICE_COACH_HINT` when `opts.voice === true`, triggering pronunciation analysis
- `voiceInput` catches recognition errors gracefully (renders as soft warning bubble)
- 🔊 buttons attached dynamically in `renderLog` (not hardcoded in bubblesHtml)
- All new text escaped via `escapeHtml`
- No build step, no new dependencies, ES modules only
