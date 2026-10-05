# Task 4 Report: Level switching, transcript loading, sync

Status: DONE
Commit: d524aaf86e4429cfd552d4e977386a340c63f895

## Changes (app.js)
- Added `a2TranscriptsData`, `loadA2Transcripts()` (cached, de-duplicated fetch of `a2-transcripts.json`).
- Helpers: `getActiveAudioLevel`, `getCurrentTrackForLevel`, `getAudioMaxTrack`, `getAudioFileName`, `getAudioSources`, `findA2Track` (supports object-keyed `tracks`, as in the real JSON, or arrays).
- `renderAudioTranscript(trackNum, level)`: section badges, fr/fa lines, A2 not-found and A1 empty states, title from track title/filename.
- `renderAudioTracksList`: A1 (233) / A2 (from JSON, 1..12 before load); filters on number, filename, title; updates `#dockAudioCount`; A2 desc uses title.
- `playAudioTrack`: per-level state (`currentTrack`, `currentTrackA1/A2`), sources via fallback queue consumed by the audio `error` handler (A1: Arvan -> ./audio/pisteN.mp3; A2: ./a2-audio/piste_NNN.mp3 -> ./audio/a2/ -> ./audio/); friendly toast when all fail (only when playback was requested); renders transcript + active item.
- `ended` auto-advance uses per-level max; prev/next/toggle-play use per-level track.
- `initBookView`: state defaults (audioLevel, currentTrackA1/A2, isTranscriptCollapsed), tab/collapse UI sync, initial transcript render, async A2 load then re-render.
- `setupBookEventListeners`: level tabs (pauses audio, clears search, re-renders list, loads that level's track without autoplay), transcript toggle on header + button (stopPropagation to avoid double toggle), persisted.

## sw.js
- Cache bumped to `francais-facile-v32`; `./a2-transcripts.json` added to LOCAL_ASSETS.

## Verification
- `node -c app.js && node -c sw.js` -> exit 0
- Node stub smoke test of list/transcript/play logic: A2 count 12, titles rendered, not-found and A1 empty states correct, A2 src `./a2-audio/piste_003.mp3` with 2 fallbacks, A1 clamps to 233 with Arvan src + local fallback.
- Not tested in a real browser.

## Notes
- `a2-audio` symlink is untracked and intentionally not committed.

## Fix round 1 (reviewer findings)
- `getAudioSources` A2 order is now: `./audio/a2/piste_NNN.mp3` (primary) -> `./audio/piste_NNN.mp3` -> `./a2-audio/piste_NNN.mp3` (local fallback). Supersedes the order in "Changes" above.
- Added `bookAudio.audioLoadFailed` flag: reset in `playAudioTrack`, set in the `error` handler when the fallback queue is exhausted (and in `toggleAudioPlayPause` on play() rejection).
- New `showAudioLoadFailedToast(track, level)` (800ms dedupe so error event + play() rejection don't double-toast): A2 -> "فایل صوتی piste_NNN.mp3 در پوشه محلی یافت نشد. لطفاً فایل را در پوشه audio/a2 قرار دهید."; A1 -> "خطا در پخش فایل صوتی piste N".
- `toggleAudioPlayPause`: when paused, sets `autoplayRequested = true`; if `audioLoadFailed` or `bookAudio.error` with an empty queue, toasts and returns; otherwise `play().catch` toasts (ignores AbortError and cases where a fallback is still pending).
- Verification: `node -c app.js && node -c sw.js` -> exit 0. Not tested in a real browser.
