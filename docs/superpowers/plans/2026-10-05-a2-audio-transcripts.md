# A1/A2 Audio Filter & Synchronized Transcripts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an A1/A2 audio filter switch in the book audio dock, structured storage for A2 transcripts in `a2-transcripts.json`, and dual-language (French/Persian) synchronized transcript display beneath the player.

**Architecture:** Transcripts are stored in `a2-transcripts.json` with structured track metadata, dialogue lines, vocabulary sections, and grammar items. In `app.js`, audio dock state tracks the current level (`A1` vs `A2`) and current track per level. In `index.html` and `style.css`, level tabs and a collapsible, scrollable transcript section are integrated directly below the audio player card.

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5 Audio API, CSS3 Flexbox/Grid, PWA Service Worker caching.

## Global Constraints
- French text always formatted LTR with French typography font (`var(--font-fr)`).
- Persian text RTL with clean Persian readability font.
- Vocabulary sections render clear category dividers.
- Audio file naming for A2 is `piste_001.mp3` through `piste_012.mp3` (with 3-digit zero-padding).
- Must work seamlessly even if local MP3 files have not yet been placed in the folder.

---

### Task 1: Create Structured `a2-transcripts.json` with Tracks 1–12

**Files:**
- Create: `a2-transcripts.json`

**Interfaces:**
- Produces: `tracks` object keyed by `piste_001` .. `piste_012`, each containing `id`, `track`, `filename`, `title`, `category`, and `lines`.

- [ ] **Step 1: Write `a2-transcripts.json` with all 12 tracks parsed**
Create `a2-transcripts.json` with clean structure for tracks 1 through 12 including all dialogue lines, vocabulary sections (Comparer, Acheter, Payer, Recevoir, Réparer, Louer une voiture, En voiture, En transports en commun), and exercises.

- [ ] **Step 2: Validate JSON syntax**
Run: `node -e "const d = JSON.parse(require('fs').readFileSync('a2-transcripts.json', 'utf8')); console.log('Loaded tracks:', Object.keys(d.tracks).length);"`
Expected: `Loaded tracks: 12`

- [ ] **Step 3: Commit**
```bash
git add a2-transcripts.json
git commit -m "feat: add structured transcripts for A2 tracks 1 to 12"
```

---

### Task 2: Update HTML Structure in Audio Dock (`index.html`)

**Files:**
- Modify: `index.html:1165-1215`

**Interfaces:**
- Produces: `#audioLevelTabs` with buttons for A1 and A2.
- Produces: `#audioTranscriptSection` with `#audioTranscriptHeader`, `#audioTranscriptToggleBtn`, and `#audioTranscriptBody`.

- [ ] **Step 1: Add Level Filter Tabs and Transcript Section to `index.html`**
Inside `#dockPaneAudio`:
1. Add level filter chips at the top:
   ```html
   <div class="dock-audio-level-tabs" id="audioLevelTabs">
     <button class="tab-chip active" data-level="A1">سطح A1 (۲۳۳ فایل)</button>
     <button class="tab-chip" data-level="A2">سطح A2 (با ترجمه فارسی)</button>
   </div>
   ```
2. Below `.book-audio-player-card`, insert the transcript section:
   ```html
   <div class="book-audio-transcript-card" id="audioTranscriptSection">
     <div class="transcript-header" id="audioTranscriptHeader">
       <div class="transcript-title-wrap">
         <span class="transcript-badge">متن و ترجمه</span>
         <span class="transcript-track-title" id="transcriptTrackTitle">درس ۱ - Document A</span>
       </div>
       <button class="transcript-toggle-btn" id="transcriptToggleBtn" title="بستن / باز کردن متن">
         <svg class="toggle-icon-down" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
       </button>
     </div>
     <div class="transcript-body" id="audioTranscriptBody">
       <!-- Dynamically populated lines -->
     </div>
   </div>
   ```

- [ ] **Step 2: Commit**
```bash
git add index.html
git commit -m "feat: add audio level tabs and transcript container to index.html"
```

---

### Task 3: Add Styling for Audio Level Tabs and Transcript Box (`style.css`)

**Files:**
- Modify: `style.css`

**Interfaces:**
- Produces: CSS rules for `.dock-audio-level-tabs`, `.book-audio-transcript-card`, `.transcript-header`, `.transcript-body`, `.transcript-line`, `.transcript-fr`, `.transcript-fa`, `.transcript-section-badge`, `.transcript-empty-state`.

- [ ] **Step 1: Add CSS rules in `style.css`**
Add styles supporting:
- Level filter tabs layout with active pill highlight.
- Transcript card styling with subtle border and gradient background.
- Clean collapsible animation (`is-collapsed`).
- Scrollable body with custom slim scrollbar.
- French text line styling (`font-family: var(--font-fr); direction: ltr; font-weight: 600;`).
- Persian translation line styling (`direction: rtl; color: var(--text-secondary); font-size: 0.85rem;`).
- Vocabulary category badges (`.transcript-section-badge`).
- Responsive adjustments for mobile screens.

- [ ] **Step 2: Commit**
```bash
git add style.css
git commit -m "style: add styles for audio level tabs and transcript display"
```

---

### Task 4: Implement Level Switching, Transcript Loading, and Sync in `app.js`

**Files:**
- Modify: `app.js`

**Interfaces:**
- Consumes: `a2-transcripts.json`
- Produces:
  - `loadA2Transcripts()`
  - `renderAudioTranscript(trackNum, level)`
  - Updated `renderAudioTracksList(filterQuery)`
  - Updated `playAudioTrack(trackNum, autoPlay)`
  - Updated `initBookView()` and `setupBookEventListeners()`

- [ ] **Step 1: Add A2 transcript state and loader in `app.js`**
Define `a2TranscriptsData` cache and `loadA2Transcripts()` that fetches `a2-transcripts.json`.

- [ ] **Step 2: Update `playAudioTrack` to handle A1 vs A2 audio paths**
- A1 path: `${ARVAN_AUDIO_BASE}piste${trackNum}.mp3` (fallback: `./audio/piste${trackNum}.mp3`).
- A2 path: `./audio/a2/piste_${String(trackNum).padStart(3, '0')}.mp3` (fallback: `./audio/piste_${String(trackNum).padStart(3, '0')}.mp3`).
- Show friendly toast if file is missing locally.

- [ ] **Step 3: Implement `renderAudioTranscript(trackNum, level)`**
Render dialogue lines, vocabulary section headers, or empty message when no transcript exists.

- [ ] **Step 4: Update `renderAudioTracksList` to switch between A1 (233 tracks) and A2 (tracks in `a2TranscriptsData`)**
Update badge counts and track list rendering according to selected level (`state.book.audioLevel`).

- [ ] **Step 5: Wire up event listeners for Level Tabs and Transcript Toggle**
Clicking A1/A2 tabs switches level, updates UI, and loads active track. Toggle button collapses/expands transcript card.

- [ ] **Step 6: Update Service Worker version in `sw.js`**
Bump cache version to `v32` and include `a2-transcripts.json` in cacheable resources.

- [ ] **Step 7: Check JavaScript syntax**
Run: `node -c app.js && node -c sw.js`
Expected: exit code 0.

- [ ] **Step 8: Commit**
```bash
git add app.js sw.js
git commit -m "feat: wire audio level switching and synchronized transcript display in app.js"
```

---

### Task 5: End-to-End Verification

- [ ] **Step 1: Verify data and JS syntax**
Run syntax checks and verify transcript counts.
- [ ] **Step 2: Test audio dock interactions**
Check that switching to A2 displays the 12 tracks, selecting track 1 displays the dialogue, selecting track 2 displays vocabulary categories, and searching filters tracks correctly.
- [ ] **Step 3: Review git status and changes**
Run `git status` and `git diff --stat` to ensure all files are cleanly committed.
