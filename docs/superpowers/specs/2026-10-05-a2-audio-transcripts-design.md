# Design Spec: A1/A2 Audio Filter, Transcripts Schema & Synchronized Translation UI

## 1. Overview & Purpose
This document specifies the architecture and implementation design for introducing level filtering (A1 / A2) in the audio dock of the application, structured storage of A2 audio transcripts in JSON (`a2-transcripts.json`), and displaying dual-language (French/Persian) transcripts synchronously with audio playback.

## 2. Data Schema (`a2-transcripts.json`)
Transcripts are stored in `a2-transcripts.json` in the workspace root. The file maps a unique track key (e.g. `piste_001`) to track metadata and parsed lines:

```json
{
  "tracks": {
    "piste_001": {
      "id": "piste_001",
      "track": 1,
      "filename": "piste_001.mp3",
      "title": "درس ۱ - Document A",
      "category": "dialogue",
      "lines": [
        { "fr": "– Allô ?", "fa": "– الو؟" },
        { "fr": "– Allô, Raphaël ? C'est Jules. Comment ça va ?", "fa": "– الو، رافائل؟ ژول هستم. چطوری؟" },
        { "fr": "– Très bien ! Et toi ?", "fa": "– خیلی خوب! تو چطوری؟" }
      ]
    },
    "piste_002": {
      "id": "piste_002",
      "track": 2,
      "filename": "piste_002.mp3",
      "title": "صفحه ۱۲ - Vocabulaire : Faire des achats",
      "category": "vocab",
      "lines": [
        { "section": "Comparer / مقایسه کردن" },
        { "fr": "Neuf / Neuve", "fa": "نو / جدید (مردانه / زنانه)" },
        { "fr": "D'occasion", "fa": "دست‌‌دوم" }
      ]
    }
  }
}
```

### Initial Data Ingestion
Tracks 1 to 12 provided by the user will be loaded into `a2-transcripts.json`:
- `piste_001.mp3`: درس ۱ - Document A (dialogue)
- `piste_002.mp3`: صفحه ۱۲ - Vocabulaire : Faire des achats (vocabulary with categories: Comparer, Acheter, Payer, Recevoir, Réparer)
- `piste_003.mp3`: صفحه ۱۵ - Exercice 2 (dialogue)
- `piste_004.mp3`: صفحه ۱۳ - Grammaire : La place de l'adjectif (grammar)
- `piste_005.mp3`: تکرار فایل piste_001.mp3 (dialogue)
- `piste_006.mp3`: تکرار فایل piste_002.mp3 (vocabulary)
- `piste_007.mp3`: درس ۲ - Se déplacer / Document A (dialogue)
- `piste_008.mp3`: صفحه ۱۳ - Pour communiquer (dialogue/communication)
- `piste_009.mp3`: صفحه ۱۵ - Exercice 1 (announcement/exercise)
- `piste_010.mp3`: صفحه ۱۸ - Vocabulaire : Se déplacer (vocabulary with categories: Louer une voiture, En voiture, En transports en commun)
- `piste_011.mp3`: صفحه ۱۵ - Exercice 3 (dialogue/SAV)
- `piste_012.mp3`: صفحه ۱۵ - Exercice 4 (dialogue/voicemail)

Subsequent 10-track batches can be appended to `tracks` without changing the schema.

## 3. UI Layout & User Experience
The Audio Dock (`#dockPaneAudio`) is organized into the following vertically-stacked components:

1. **Audio Level Filter Tabs (`#audioLevelTabs`):**
   - Placed at the top of the audio dock.
   - Includes two pill/chip buttons:
     - `A1 (۲۳۳ فایل صوتی)`
     - `A2 (فایل‌های ترجمه‌دار)`
   - Switching level dynamically re-renders the track list, updates total count, and selects the current track for that level.

2. **Integrated Player Card (`.book-audio-player-card`):**
   - Displays active track filename (e.g. `piste_001.mp3` or `piste1.mp3`), title, and playback status.
   - Seek slider, time indicators (`00:00`), 5-second rewind/forward, play/pause, and cycle playback rate.

3. **Transcript Display Section (`#audioTranscriptSection`):**
   - Positioned directly below the player card.
   - Header with toggle to collapse/expand (defaults to expanded when transcripts exist).
   - Scrollable container (max-height ~280px) with custom scrollbar.
   - Line items render French text on top (LTR) with Persian translation below (RTL).
   - Section headers (e.g. `Comparer / مقایسه کردن`) render as stylish dividers.
   - If a track does not have transcripts (e.g. A1 tracks without transcript data), shows a clean informative message: "متن و ترجمه برای این فایل صوتی هنوز اضافه نشده است."

4. **Search Input & Track Playlist:**
   - Search input filters tracks by track number, filename, or Persian title.
   - Track items display track number, file name, lesson title, and active/playing states.

## 4. Audio Playback Logic & Sources
- **Level A1:**
  - Base URL: `https://france.s3.ir-thr-at1.arvanstorage.ir/Communication_essentielle_du_franc%CC%A7ais_A1_Audio/piste{trackNum}.mp3`
  - Fallback: `./audio/piste{trackNum}.mp3`
- **Level A2:**
  - File format: `piste_{String(trackNum).padStart(3, '0')}.mp3` (e.g. `piste_001.mp3`)
  - Base URLs: `./audio/a2/piste_{pad3}.mp3` and fallback to `./audio/piste_{pad3}.mp3`
  - If local file cannot be found, displays user-friendly toast: "فایل صوتی piste_001.mp3 در پوشه محلی یافت نشد. لطفاً فایل صوتی را در پوشه audio/a2 قرار دهید."

## 5. State Management & Persistence
In `state.book`:
- `audioLevel`: `'A1'` or `'A2'` (default: `'A1'`).
- `currentTrackA1`: Number (1..233, default: 1).
- `currentTrackA2`: Number (1..N, default: 1).
- `isTranscriptCollapsed`: Boolean (default: false).
All saved to `localStorage` via existing `saveState()`.

## 6. Verification Plan
- Verify JSON syntax of `a2-transcripts.json`.
- Verify UI rendering of A1 and A2 level tabs in the book audio dock.
- Test switching between A1 and A2 levels and confirm the track list and counters update accordingly.
- Test selecting track `piste_001.mp3` through `piste_012.mp3` and verify the French and Persian transcripts appear properly formatted.
- Test search filtering for both levels.
- Verify collapsing and expanding the transcript card.
