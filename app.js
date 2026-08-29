// ==========================================================================
// FrançaisFacile • Main JavaScript Engine
// ==========================================================================

// Global Application State
const state = {
  currentView: 'dashboard',
  theme: 'light',
  audioSpeed: 1.0,
  xp: 0,
  streak: 1,
  lastActiveDate: new Date().toDateString(),
  masteredIds: new Set(),
  savedIds: new Set(),
  quizzesCompleted: 0,
  quizAccuracyHistory: [],
  bestMatchRecord: 0,
  openRouterKey: '',
  openRouterModel: 'openai/gpt-4o-mini',
  custom: { vocab: [], sentences: [] },
  aiVisuals: {},
  book: {
    currentPage: 1,
    totalPages: 153,
    zoom: 1.0,
    fitWidth: true,
    currentTrack: 1,
    isPlaying: false,
    trackSpeed: 1.0,
    sideDockTab: 'ai'
  },
  aiPageExplanations: {},
  activityDates: [],
  quizLog: [],
  lastQuizType: 'mcq',

  flashcards: {
    deck: [],
    currentIndex: 0,
    isFlipped: false,
    direction: 'fa-fr',
    category: 'all',
    deckId: null,
    screen: 'browser',
    reviews: {},
    sessionDone: 0,
    sessionTotal: 0
  },

  quiz: {
    type: 'mcq',
    questions: [],
    currentIndex: 0,
    score: 0,
    streak: 0,
    selectedOption: null,
    scramblePicked: []
  },

  game: {
    tiles: [],
    selectedTile: null,
    matchedPairs: 0,
    moves: 0,
    timer: 0,
    timerInterval: null,
    category: 'all'
  },

  vocab: {
    category: 'all',
    gender: 'all',
    searchQuery: '',
    viewMode: 'grid'
  },

  sentences: {
    topic: 'all',
    searchQuery: '',
    hideTranslations: false
  }
};

window.FFGetCustom = () => state.custom;

// ==========================================================================
// Sound Effects & Web Speech API Synthesis
// ==========================================================================
class SoundFX {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
  }

  playCorrect() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.2); // G5

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.warn('Audio FX error', e);
    }
  }

  playWrong() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now); // A3
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.25);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {
      console.warn('Audio FX error', e);
    }
  }

  playFlip() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {
      console.warn('Audio FX error', e);
    }
  }

  playFanfare() {
    try {
      this.init();
      if (!this.ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const now = this.ctx.currentTime + (idx * 0.12);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      });
    } catch (e) {
      console.warn('Audio FX error', e);
    }
  }
}

const sfx = new SoundFX();

// Speak French text using Web Speech API
function speakFrench(text, rate = state.audioSpeed) {
  if (!('speechSynthesis' in window)) {
    showToast('مرورگر شما از قابلیت تلفظ صوتی پشتیبانی نمی‌کند.');
    return;
  }

  window.speechSynthesis.cancel(); // Cancel any ongoing speech

  // Clean text from punctuation if needed
  const cleanText = text.replace(/[\/]/g, ' ');
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'fr-FR';
  utterance.rate = rate;

  // Try to find a high quality French voice
  const voices = window.speechSynthesis.getVoices();
  const frVoice = voices.find(v => v.lang.startsWith('fr') && (v.name.includes('Google') || v.name.includes('Thomas') || v.name.includes('Amélie') || v.name.includes('Natural') || v.name.includes('Premium')));
  if (frVoice) {
    utterance.voice = frVoice;
  }

  window.speechSynthesis.speak(utterance);
}

// Pre-load voices
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

// ==========================================================================
// State Storage Helpers
// ==========================================================================
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function markActivity() {
  const day = todayISO();
  if (!state.activityDates.includes(day)) {
    state.activityDates.push(day);
    if (state.activityDates.length > 120) {
      state.activityDates = state.activityDates.slice(-120);
    }
  }
}

function saveState() {
  markActivity();
  updateHeaderStats();
  if (window.FFStorage) {
    window.FFStorage.scheduleSave(window.FFStorage.buildSnapshot(state));
  }
}

function addXP(amount, reason = '') {
  state.xp += amount;
  saveState();
  if (reason) {
    showToast(`+${amount} XP ${reason}`);
  }
}

function updateStreak() {
  const today = new Date().toDateString();
  if (state.lastActiveDate !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (state.lastActiveDate === yesterday.toDateString()) {
      state.streak += 1;
    } else {
      // If broken by more than 1 day
      const diffDays = Math.round((new Date() - new Date(state.lastActiveDate)) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) {
        state.streak = 1;
      }
    }
    state.lastActiveDate = today;
    saveState();
  }
}

// ==========================================================================
// UI Helpers & Toasts
// ==========================================================================
function showToast(message, duration = 2800) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>💬</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function triggerConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  }
}

// ==========================================================================
// View Routing & Navigation
// ==========================================================================
function switchView(viewName) {
  state.currentView = viewName;
  
  // Toggle body layout class for Book view (widescreen, compact margins)
  document.body.classList.toggle('view-is-book', viewName === 'book');

  // Hide all views, show target
  document.querySelectorAll('.app-view').forEach(view => {
    view.classList.remove('active');
  });

  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.classList.add('active');
  }

  // Update Sidebar & Mobile Nav active states
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });
  document.querySelectorAll('.mobile-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Close mobile sidebar if open
  document.getElementById('appSidebar').classList.remove('open');

  // Specific view initializer triggers
  if (viewName === 'dashboard') renderDashboard();
  if (viewName === 'book') initBookView();
  if (viewName === 'vocab') renderVocabGrid();
  if (viewName === 'flashcards') initFlashcardsView();
  if (viewName === 'quiz') resetQuizView();
  if (viewName === 'sentences') renderSentences();
  if (viewName === 'grammar') renderGrammarLab();
  if (viewName === 'matchgame') startMatchGame();
  if (viewName === 'progress') renderProgressStats();
  if (viewName === 'importer') setupImporterView();

  window.scrollTo({ top: 0, behavior: 'smooth' });
  saveState();
}

// ==========================================================================
// 1. DASHBOARD VIEW
// ==========================================================================
function renderDashboard() {
  const allVocab = getAllVocabItems();
  const totalCount = allVocab.length;
  const masteredCount = state.masteredIds.size;
  const percent = totalCount > 0 ? Math.round((masteredCount / totalCount) * 100) : 0;

  updateContentCounts();

  // Stats
  document.getElementById('dashOverallPercent').textContent = `${percent}%`;
  document.getElementById('dashMasteredCount').textContent = masteredCount;
  document.getElementById('dashQuizzesTaken').textContent = state.quizzesCompleted;
  document.getElementById('dashSavedCount').textContent = state.savedIds.size;

  // Conic gradient circle
  const circle = document.getElementById('dashOverallCircle');
  if (circle) {
    circle.style.background = `conic-gradient(var(--french-blue) ${percent * 3.6}deg, var(--bg-secondary) 0deg)`;
  }

  // Category progress bars on Dashboard
  const catProgressMap = {
    verbs: { fill: 'catProgVerbs', count: 'catCountVerbs', items: APP_DATA.categories.verbs },
    nouns: { fill: 'catProgNouns', count: 'catCountNouns', items: APP_DATA.categories.nouns },
    adjectives: { fill: 'catProgAdj', count: 'catCountAdjectives', items: APP_DATA.categories.adjectives },
    expressions: { fill: 'catProgExpr', count: 'catCountExpr', items: APP_DATA.categories.expressions }
  };

  for (const [key, conf] of Object.entries(catProgressMap)) {
    const masteredInCat = conf.items.filter(item => state.masteredIds.has(item.id)).length;
    const catPercent = Math.round((masteredInCat / conf.items.length) * 100);
    const fillEl = document.getElementById(conf.fill);
    if (fillEl) fillEl.style.width = `${catPercent}%`;
  }

  // Render Word of the Day
  renderWordOfTheDay();
}

function renderWordOfTheDay() {
  const container = document.getElementById('wotdContainer');
  const allVocab = getAllVocabItems();
  
  // Pick deterministic word of the day based on day of year
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  const wotd = allVocab[dayOfYear % allVocab.length];

  container.innerHTML = `
    <div class="wotd-word" dir="ltr">${wotd.word} <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: normal;">(${wotd.categoryNameFr})</span></div>
    <div class="wotd-trans">${wotd.translation}</div>
    ${wotd.example ? `
      <div class="wotd-example">
        <div class="wotd-example-fr" dir="ltr">${wotd.example}</div>
        <div class="wotd-example-fa">${getTranslationForExample(wotd.example) || ''}</div>
      </div>
    ` : ''}
  `;

  // Attach audio button
  const audioBtn = document.getElementById('wotdAudioBtn');
  if (audioBtn) {
    audioBtn.onclick = () => speakFrench(wotd.word);
  }
}

function getTranslationForExample(exampleFr) {
  const match = getAllSentences().find(s => s.fr.toLowerCase() === exampleFr.toLowerCase());
  return match ? match.fa : '';
}

// ==========================================================================
// 2. VOCABULARY VIEW
// ==========================================================================
function renderVocabGrid() {
  const grid = document.getElementById('vocabCardsGrid');
  const emptyState = document.getElementById('vocabEmptyState');
  const filteredCountEl = document.getElementById('vocabFilteredCount');
  
  let items = getAllVocabItems();

  // Category Filter
  if (state.vocab.category === 'saved') {
    items = items.filter(item => state.savedIds.has(item.id));
  } else if (state.vocab.category === 'mastered') {
    items = items.filter(item => state.masteredIds.has(item.id));
  } else if (state.vocab.category === 'custom') {
    items = items.filter(item => item.custom);
  } else if (state.vocab.category !== 'all') {
    items = items.filter(item => item.categoryKey === state.vocab.category);
  }

  // Gender Filter
  if (state.vocab.gender !== 'all') {
    items = items.filter(item => item.gender === state.vocab.gender);
  }

  // Search Filter
  if (state.vocab.searchQuery.trim()) {
    const q = state.vocab.searchQuery.trim().toLowerCase();
    items = items.filter(item => 
      item.word.toLowerCase().includes(q) || 
      item.translation.toLowerCase().includes(q) ||
      (item.example && item.example.toLowerCase().includes(q))
    );
  }

  filteredCountEl.textContent = `نمایش ${items.length} مورد`;

  if (items.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  grid.className = `vocab-cards-grid ${state.vocab.viewMode === 'list' ? 'list-view' : ''}`;

  grid.innerHTML = items.map(item => {
    const isSaved = state.savedIds.has(item.id);
    const isMastered = state.masteredIds.has(item.id);
    const breakdown = getAiBreakdown(item.id);

    // Gender/Type tag format
    let genderBadgeHtml = '';
    if (item.gender === 'masculine') {
      genderBadgeHtml = `<span class="vocab-gender-badge masculine">le / un (مذکر)</span>`;
    } else if (item.gender === 'feminine') {
      genderBadgeHtml = `<span class="vocab-gender-badge feminine">la / une (مؤنث)</span>`;
    } else if (item.gender === 'feminine_plural' || item.gender === 'plural') {
      genderBadgeHtml = `<span class="vocab-gender-badge plural">les / des (جمع)</span>`;
    } else if (item.gender === 'common') {
      genderBadgeHtml = `<span class="vocab-gender-badge common">مشترک</span>`;
    } else if (item.type) {
      genderBadgeHtml = `<span class="vocab-gender-badge verb">${item.type === 'reflexive_verb' ? 'فعل انعکاسی' : 'فعل'}</span>`;
    } else if (item.fem) {
      genderBadgeHtml = `<span class="vocab-gender-badge common">مؤنث: ${item.fem}</span>`;
    }

    return `
      <div class="vocab-card ${isMastered ? 'is-mastered' : ''}" data-id="${item.id}">
        <div class="vocab-card-header">
          <div class="vocab-word-info">
            <div class="vocab-word-fr" dir="ltr">
              ${item.word}
            </div>
            <div style="margin-top: 4px;">
              ${genderBadgeHtml}
            </div>
          </div>

          <div class="vocab-actions-row">
            <button class="vocab-action-icon-btn speak-btn" data-word="${item.word}" title="پخش تلفظ">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            </button>
            <button class="vocab-action-icon-btn ai-visual-btn ${breakdown ? 'has-visual' : ''}" data-id="${item.id}" title="${breakdown ? 'مشاهده ترجمه و تجزیه AI' : 'ترجمه و تجزیه با AI'}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"></path></svg>
            </button>
            <button class="vocab-action-icon-btn save-btn ${isSaved ? 'is-saved' : ''}" data-id="${item.id}" title="${isSaved ? 'حذف از نشان‌شده‌ها' : 'نشان کردن لغت'}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </button>
            <button class="vocab-action-icon-btn is-mastered-btn ${isMastered ? 'active' : ''}" data-id="${item.id}" title="${isMastered ? 'مسلط شده (کلیک برای لغو)' : 'علامت‌گذاری به عنوان مسلط شده'}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </button>
          </div>
        </div>

        <div class="vocab-translation">${item.translation}</div>

        ${item.example ? `
          <div class="vocab-example-snippet">
            <div class="snippet-fr" dir="ltr">${item.example}</div>
            <div class="snippet-fa">${getTranslationForExample(item.example) || ''}</div>
          </div>
        ` : ''}

        ${item.note ? `
          <div class="vocab-note-tag">💡 ${item.note}</div>
        ` : ''}

        ${breakdown ? `
          <div class="vocab-ai-visual-snippet" data-id="${item.id}">
            <div class="vocab-ai-info">
              <div class="vocab-ai-desc">${escapeHtml(formatBreakdownMeaning(breakdown))}</div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Attach card event listeners
  grid.querySelectorAll('.speak-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      speakFrench(btn.dataset.word);
    };
  });

  grid.querySelectorAll('.ai-visual-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const item = items.find(x => x.id === id);
      if (!item) return;

      const existing = getAiBreakdown(id);
      if (existing) {
        openBreakdownLightbox(existing, item);
      } else {
        btn.innerHTML = `<span style="display:inline-block;width:14px;height:14px;border:2px solid var(--purple);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></span>`;
        btn.disabled = true;
        try {
          await generateAiBreakdownForItem(item);
          showToast('ترجمه و تجزیه آماده شد ✨');
          renderVocabGrid();
        } catch (err) {
          console.error(err);
          if (err.message !== 'کلید OpenRouter تنظیم نشد') {
            showToast(err.message || 'خطا در ترجمه AI');
          }
          renderVocabGrid();
        }
      }
    };
  });

  grid.querySelectorAll('.vocab-ai-visual-snippet').forEach(el => {
    el.onclick = (e) => {
      e.stopPropagation();
      const id = el.dataset.id;
      const item = items.find(x => x.id === id);
      const breakdown = getAiBreakdown(id);
      if (!item || !breakdown) return;
      openBreakdownLightbox(breakdown, item);
    };
  });

  grid.querySelectorAll('.save-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (state.savedIds.has(id)) {
        state.savedIds.delete(id);
        showToast('از نشان‌شده‌ها حذف شد');
      } else {
        state.savedIds.add(id);
        showToast('به نشان‌شده‌ها اضافه شد ⭐');
      }
      saveState();
      renderVocabGrid();
    };
  });

  grid.querySelectorAll('.is-mastered-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (state.masteredIds.has(id)) {
        setManualFlashcardMastery(id, false);
        showToast('از لیست لغات مسلط شده حذف شد');
      } else {
        setManualFlashcardMastery(id, true);
        addXP(10, 'برای تسلط بر لغت');
        sfx.playCorrect();
      }
      saveState();
      renderVocabGrid();
    };
  });

  grid.querySelectorAll('.vocab-card').forEach(card => {
    card.onclick = () => {
      const id = card.dataset.id;
      const item = allVocab.find(x => x.id === id);
      if (item) openWordModal(item);
    };
  });
}

// ==========================================================================
// 3. FLASHCARDS ENGINE (Anki-style decks by lesson)
// ==========================================================================
const ANKI_MINUTE_MS = 60 * 1000;
const ANKI_DAY_MS = 24 * 60 * 60 * 1000;
const ANKI_DEFAULTS = {
  learningStepsMinutes: [1, 10],
  relearningStepsMinutes: [10],
  graduatingIntervalDays: 1,
  easyIntervalDays: 4,
  minimumIntervalDays: 1,
  startingEase: 2.5,
  minimumEase: 1.3,
  hardInterval: 1.2,
  easyBonus: 1.3,
  intervalModifier: 1,
  newInterval: 0,
  maxIntervalDays: 36500,
  learnAheadMinutes: 20
};

function ensureFlashcardReviewMap() {
  if (!state.flashcards.reviews || typeof state.flashcards.reviews !== 'object' || Array.isArray(state.flashcards.reviews)) {
    state.flashcards.reviews = {};
  }
  return state.flashcards.reviews;
}

function localDateISO(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function localDayStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateFromLocalISO(iso) {
  if (!iso || typeof iso !== 'string') return localDayStart();
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return localDayStart();
  return new Date(year, month - 1, day);
}

function addDaysISO(days, from = new Date()) {
  const d = localDayStart(from);
  d.setDate(d.getDate() + Math.max(0, Math.round(days)));
  return localDateISO(d);
}

function daysUntilLocalISO(iso, from = new Date()) {
  return Math.round((dateFromLocalISO(iso).getTime() - localDayStart(from).getTime()) / ANKI_DAY_MS);
}

function addMinutesISO(minutes, from = new Date()) {
  return new Date(from.getTime() + Math.max(0, minutes) * ANKI_MINUTE_MS).toISOString();
}

function clampEase(ease) {
  const value = Number(ease) || ANKI_DEFAULTS.startingEase;
  return Math.max(ANKI_DEFAULTS.minimumEase, Number(value.toFixed(2)));
}

function normalizeFlashcardReview(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const validStatuses = new Set(['learning', 'relearning', 'review']);
  const status = validStatuses.has(raw.status) ? raw.status : null;
  if (!status) return null;

  const review = {
    status,
    step: Math.max(0, Number(raw.step) || 0),
    interval: Math.max(0, Number(raw.interval) || 0),
    ease: clampEase(raw.ease),
    reps: Math.max(0, Number(raw.reps) || 0),
    lapses: Math.max(0, Number(raw.lapses) || 0),
    lastReviewedAt: raw.lastReviewedAt || null,
    lastRating: raw.lastRating || null
  };

  if (status === 'review') {
    review.interval = Math.max(ANKI_DEFAULTS.minimumIntervalDays, Math.round(review.interval) || ANKI_DEFAULTS.minimumIntervalDays);
    review.dueDate = raw.dueDate || addDaysISO(review.interval);
  } else {
    review.dueAt = raw.dueAt || addMinutesISO(getLearningSteps(status)[review.step] || getLearningSteps(status)[0] || 0);
  }

  return review;
}

function getFlashcardReview(id) {
  const reviews = ensureFlashcardReviewMap();
  const normalized = normalizeFlashcardReview(reviews[id]);
  if (!normalized) {
    delete reviews[id];
    return null;
  }
  reviews[id] = normalized;
  return normalized;
}

function getLearningSteps(status) {
  return status === 'relearning'
    ? ANKI_DEFAULTS.relearningStepsMinutes
    : ANKI_DEFAULTS.learningStepsMinutes;
}

function isLearningStatus(status) {
  return status === 'learning' || status === 'relearning';
}

function isLearningDue(review, now = new Date(), lookaheadMinutes = 0) {
  if (!review || !isLearningStatus(review.status) || !review.dueAt) return false;
  const dueTime = new Date(review.dueAt).getTime();
  if (!Number.isFinite(dueTime)) return true;
  return dueTime <= now.getTime() + lookaheadMinutes * ANKI_MINUTE_MS;
}

function isReviewDue(review, now = new Date()) {
  if (!review || review.status !== 'review') return false;
  return daysUntilLocalISO(review.dueDate, now) <= 0;
}

function createReviewSchedule(intervalDays, now = new Date(), ease = ANKI_DEFAULTS.startingEase, current = {}) {
  current = current || {};
  const interval = Math.min(
    ANKI_DEFAULTS.maxIntervalDays,
    Math.max(ANKI_DEFAULTS.minimumIntervalDays, Math.round(intervalDays) || ANKI_DEFAULTS.minimumIntervalDays)
  );
  return {
    status: 'review',
    interval,
    ease: clampEase(ease),
    dueDate: addDaysISO(interval, now),
    reps: Math.max(0, Number(current.reps) || 0),
    lapses: Math.max(0, Number(current.lapses) || 0),
    lastReviewedAt: current.lastReviewedAt || null,
    lastRating: current.lastRating || null
  };
}

function createLearningSchedule(status, step, delayMinutes, now = new Date(), current = {}) {
  current = current || {};
  return {
    status,
    step: Math.max(0, step),
    interval: Math.max(0, Number(current.interval) || 0),
    ease: clampEase(current.ease),
    dueAt: addMinutesISO(delayMinutes, now),
    reps: Math.max(0, Number(current.reps) || 0),
    lapses: Math.max(0, Number(current.lapses) || 0),
    lastReviewedAt: current.lastReviewedAt || null,
    lastRating: current.lastRating || null
  };
}

function hardLearningDelay(steps) {
  if (steps.length > 1) return (steps[0] + steps[1]) / 2;
  const onlyStep = steps[0] || 0;
  return Math.min(onlyStep * 1.5, onlyStep + 1440);
}

function constrainReviewInterval(rawInterval, previousInterval = 0) {
  const rounded = Math.round(rawInterval * ANKI_DEFAULTS.intervalModifier);
  return Math.min(
    ANKI_DEFAULTS.maxIntervalDays,
    Math.max(1, previousInterval + 1, rounded)
  );
}

function daysLateForReview(review, now = new Date()) {
  if (!review || review.status !== 'review') return 0;
  return Math.max(0, -daysUntilLocalISO(review.dueDate, now));
}

function scheduleLearningCard(current, rating, now = new Date()) {
  const status = current?.status === 'relearning' ? 'relearning' : 'learning';
  const steps = getLearningSteps(status);
  const step = Math.min(Math.max(0, Number(current?.step) || 0), Math.max(0, steps.length - 1));
  const carriedInterval = Math.max(ANKI_DEFAULTS.minimumIntervalDays, Math.round(Number(current?.interval) || ANKI_DEFAULTS.minimumIntervalDays));

  if (!steps.length) {
    return createReviewSchedule(
      status === 'relearning' ? carriedInterval : ANKI_DEFAULTS.graduatingIntervalDays,
      now,
      current?.ease || ANKI_DEFAULTS.startingEase,
      current
    );
  }

  if (rating === 'again') {
    return createLearningSchedule(status, 0, steps[0], now, current);
  }

  if (rating === 'hard') {
    const delay = step === 0 ? hardLearningDelay(steps) : (steps[step] || steps[0]);
    return createLearningSchedule(status, step, delay, now, current);
  }

  if (rating === 'easy') {
    return createReviewSchedule(
      status === 'relearning' ? carriedInterval : ANKI_DEFAULTS.easyIntervalDays,
      now,
      current?.ease || ANKI_DEFAULTS.startingEase,
      current
    );
  }

  const nextStep = step + 1;
  if (nextStep < steps.length) {
    return createLearningSchedule(status, nextStep, steps[nextStep], now, current);
  }

  return createReviewSchedule(
    status === 'relearning' ? carriedInterval : ANKI_DEFAULTS.graduatingIntervalDays,
    now,
    current?.ease || ANKI_DEFAULTS.startingEase,
    current
  );
}

function scheduleReviewCard(current, rating, now = new Date()) {
  const interval = Math.max(ANKI_DEFAULTS.minimumIntervalDays, Math.round(Number(current.interval) || ANKI_DEFAULTS.minimumIntervalDays));
  const ease = clampEase(current.ease);
  const daysLate = daysLateForReview(current, now);

  if (rating === 'again') {
    const nextEase = clampEase(ease - 0.2);
    const lapseInterval = Math.max(
      ANKI_DEFAULTS.minimumIntervalDays,
      Math.round(interval * ANKI_DEFAULTS.newInterval)
    );

    if (ANKI_DEFAULTS.relearningStepsMinutes.length) {
      return createLearningSchedule('relearning', 0, ANKI_DEFAULTS.relearningStepsMinutes[0], now, {
        ...current,
        interval: lapseInterval,
        ease: nextEase,
        lapses: (Number(current.lapses) || 0) + 1
      });
    }

    return createReviewSchedule(lapseInterval, now, nextEase, {
      ...current,
      lapses: (Number(current.lapses) || 0) + 1
    });
  }

  const hardBase = (interval + Math.floor(daysLate / 4)) * ANKI_DEFAULTS.hardInterval;
  const hardInterval = constrainReviewInterval(hardBase, interval);

  if (rating === 'hard') {
    return createReviewSchedule(hardInterval, now, ease - 0.15, current);
  }

  const goodBase = (interval + Math.floor(daysLate / 2)) * ease;
  const goodInterval = constrainReviewInterval(goodBase, hardInterval);

  if (rating === 'good') {
    return createReviewSchedule(goodInterval, now, ease, current);
  }

  const easyBase = (interval + daysLate) * ease * ANKI_DEFAULTS.easyBonus;
  const easyInterval = constrainReviewInterval(easyBase, goodInterval);
  return createReviewSchedule(easyInterval, now, ease + 0.15, current);
}

function getNextFlashcardSchedule(card, rating, now = new Date()) {
  const current = getFlashcardReview(card.id);
  return current?.status === 'review'
    ? scheduleReviewCard(current, rating, now)
    : scheduleLearningCard(current, rating, now);
}

function applyFlashcardRating(card, rating) {
  const now = new Date();
  const current = getFlashcardReview(card.id);
  const next = getNextFlashcardSchedule(card, rating, now);
  next.reps = (Number(current?.reps) || 0) + 1;
  next.lastReviewedAt = now.toISOString();
  next.lastRating = rating;
  ensureFlashcardReviewMap()[card.id] = next;

  if (next.status === 'review') {
    state.masteredIds.add(card.id);
  } else {
    state.masteredIds.delete(card.id);
  }

  return next;
}

function setManualFlashcardMastery(id, mastered) {
  const reviews = ensureFlashcardReviewMap();
  if (mastered) {
    state.masteredIds.add(id);
    const existing = getFlashcardReview(id);
    if (existing?.status !== 'review') {
      const now = new Date();
      reviews[id] = {
        ...createReviewSchedule(ANKI_DEFAULTS.easyIntervalDays, now),
        reps: 1,
        lastReviewedAt: now.toISOString(),
        lastRating: 'easy'
      };
    }
    return;
  }

  state.masteredIds.delete(id);
  delete reviews[id];
}

function syncMasteredIdsFromFlashcardReviews() {
  Object.keys(ensureFlashcardReviewMap()).forEach((id) => {
    const review = getFlashcardReview(id);
    if (review?.status === 'review') {
      state.masteredIds.add(id);
    } else if (review) {
      state.masteredIds.delete(id);
    }
  });
}

function migrateMasteredFlashcardsToReviews() {
  const reviews = ensureFlashcardReviewMap();
  let changed = false;
  state.masteredIds.forEach((id) => {
    if (!reviews[id]) {
      const now = new Date();
      reviews[id] = {
        ...createReviewSchedule(ANKI_DEFAULTS.easyIntervalDays, now),
        reps: 1,
        lastReviewedAt: now.toISOString(),
        lastRating: 'easy',
        migratedFromMastered: true
      };
      changed = true;
    }
  });
  return changed;
}

function getFlashcardQueueInfo(card, now = new Date(), { includeNew = true, lookaheadMinutes = 0 } = {}) {
  const review = getFlashcardReview(card.id);
  if (!review) {
    return includeNew ? { bucket: 3, dueTime: Number.MAX_SAFE_INTEGER } : null;
  }

  if (isLearningStatus(review.status)) {
    if (isLearningDue(review, now, lookaheadMinutes)) {
      return { bucket: 0, dueTime: new Date(review.dueAt).getTime() || 0 };
    }
    return null;
  }

  if (isReviewDue(review, now)) {
    return { bucket: 2, dueTime: dateFromLocalISO(review.dueDate).getTime() };
  }

  return null;
}

function buildFlashcardStudyQueue(deckId, { includeNew = true, lookaheadMinutes = 0 } = {}) {
  const now = new Date();
  const cards = getFlashcardDeck(deckId);
  let queue = cards
    .map((card, index) => {
      const info = getFlashcardQueueInfo(card, now, { includeNew, lookaheadMinutes: 0 });
      return info ? { card, index, ...info } : null;
    })
    .filter(Boolean);

  if (!queue.length && lookaheadMinutes > 0) {
    queue = cards
      .map((card, index) => {
        const info = getFlashcardQueueInfo(card, now, { includeNew: false, lookaheadMinutes });
        return info ? { card, index, ...info } : null;
      })
      .filter(Boolean);
  }

  return queue
    .sort((a, b) => a.bucket - b.bucket || a.dueTime - b.dueTime || a.index - b.index)
    .map(entry => entry.card);
}

function addDueCardsToActiveQueue() {
  const deckId = state.flashcards.deckId || 'all-lessons';
  const activeDeck = state.flashcards.deck || [];
  const queuedIds = new Set(activeDeck.map(card => card.id));
  const lookaheadMinutes = activeDeck.length ? 0 : ANKI_DEFAULTS.learnAheadMinutes;
  const dueCards = buildFlashcardStudyQueue(deckId, { includeNew: false, lookaheadMinutes })
    .filter(card => !queuedIds.has(card.id));

  if (dueCards.length) {
    activeDeck.push(...dueCards);
    state.flashcards.sessionTotal += dueCards.length;
  }
}

function getNextDueForDeck(deckId) {
  const now = new Date();
  return getFlashcardDeck(deckId)
    .map((card) => {
      const review = getFlashcardReview(card.id);
      if (!review) return null;
      if (isLearningStatus(review.status) && review.dueAt) return new Date(review.dueAt).getTime();
      if (review.status === 'review' && review.dueDate) return dateFromLocalISO(review.dueDate).getTime();
      return null;
    })
    .filter(time => Number.isFinite(time) && time > now.getTime())
    .sort((a, b) => a - b)[0] || null;
}

function formatAnkiDelay(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return 'now';
  const minutes = Math.max(1, Math.round(value / ANKI_MINUTE_MS));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.max(1, Math.round(hours / 24))}d`;
}

function formatReviewInterval(review, now = new Date()) {
  if (!review) return '';
  if (review.dueAt) return formatAnkiDelay(new Date(review.dueAt).getTime() - now.getTime());
  if (review.dueDate) {
    const days = Math.max(0, daysUntilLocalISO(review.dueDate, now));
    return days === 0 ? 'today' : `${days}d`;
  }
  return '';
}

function updateAnswerButtonIntervals(card) {
  const now = new Date();
  [
    ['again', 'fcAgainInterval'],
    ['hard', 'fcHardInterval'],
    ['good', 'fcGoodInterval'],
    ['easy', 'fcEasyInterval']
  ].forEach(([rating, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = formatReviewInterval(getNextFlashcardSchedule(card, rating, now), now);
  });
}

function finishFlashcardSession() {
  const deckId = state.flashcards.deckId || 'all-lessons';
  const nextDue = getNextDueForDeck(deckId);
  const message = nextDue
    ? `مرور فعلی تمام شد؛ کارت بعدی حدود ${formatAnkiDelay(nextDue - Date.now())} دیگر موعد دارد.`
    : 'کارت‌های موعد این دک تمام شد.';
  showToast(message);
  backToFlashcardDecks();
}

function getLessonMeta(num) {
  const lessons = APP_DATA.lessons || {};
  return lessons[num] || { titleFa: 'درس', topic: 'other' };
}

function sentenceToFlashcard(s) {
  const lesson = s.lesson || (s.custom ? '00' : '00');
  const meta = getLessonMeta(lesson);
  return {
    id: s.id,
    word: s.fr,
    translation: s.fa,
    kind: 'sentence',
    lesson,
    custom: Boolean(s.custom),
    categoryNameFr: s.custom ? 'Phrase AI' : (lesson !== '00' ? `Leçon ${lesson}` : 'Phrase'),
    categoryNameFa: s.custom ? 'افزوده‌شده با AI' : meta.titleFa
  };
}

function getAnkiLessonCards(lessonNum) {
  const sentences = getAllSentences()
    .filter(s => s.lesson === lessonNum)
    .map(sentenceToFlashcard);
  const vocab = getAllVocabItems().filter(v => v.lesson === lessonNum);
  return [...sentences, ...vocab];
}

function getAllAnkiCards() {
  return [
    ...getAllSentences().filter(s => s.lesson || s.custom).map(sentenceToFlashcard),
    ...getAllVocabItems().filter(v => v.lesson)
  ];
}

function getFlashcardDeck(deckId) {
  if (!deckId || deckId === 'all-lessons') return getAllAnkiCards();
  if (deckId.startsWith('lesson-')) return getAnkiLessonCards(deckId.slice('lesson-'.length));
  if (deckId === 'sentences-custom') {
    return getAllSentences().filter(s => s.custom).map(sentenceToFlashcard);
  }
  if (deckId === 'vocab-all') return getAllVocabItems();
  if (deckId === 'vocab-saved') return getAllVocabItems().filter(item => state.savedIds.has(item.id));
  if (deckId === 'vocab-unmastered') return getAllVocabItems().filter(item => !state.masteredIds.has(item.id));
  if (deckId === 'vocab-custom') return getAllVocabItems().filter(item => item.custom);
  if (deckId.startsWith('vocab-')) {
    const cat = deckId.slice('vocab-'.length);
    return getAllVocabItems().filter(item => item.categoryKey === cat);
  }
  return getAllAnkiCards();
}

function countDeckStats(cards) {
  const now = new Date();
  const stats = {
    total: cards.length,
    newCards: 0,
    learning: 0,
    due: 0,
    graduated: 0
  };

  cards.forEach((card) => {
    const review = getFlashcardReview(card.id);
    if (!review) {
      stats.newCards++;
    } else if (isLearningStatus(review.status)) {
      if (isLearningDue(review, now, ANKI_DEFAULTS.learnAheadMinutes)) stats.learning++;
    } else if (review.status === 'review') {
      stats.graduated++;
      if (isReviewDue(review, now)) stats.due++;
    }
  });

  return stats;
}

function deckRowHtml({ id, title, sub, stats, parent = false }) {
  return `
    <button type="button" class="anki-deck-row${parent ? ' is-parent' : ''}" data-deck-id="${id}">
      <span class="anki-deck-name">
        <span class="anki-deck-title">${title}</span>
        <span class="anki-deck-sub">${sub}</span>
      </span>
      <span class="anki-count-new">${stats.newCards}</span>
      <span class="anki-count-learning">${stats.learning}</span>
      <span class="anki-count-due">${stats.due}</span>
      <span class="anki-count-total">${stats.total}</span>
    </button>
  `;
}

function renderFlashcardDeckBrowser() {
  const list = document.getElementById('flashcardDeckList');
  if (!list) return;

  const lessonNums = Object.keys(APP_DATA.lessons || {}).sort((a, b) => Number(a) - Number(b));
  const parts = [
    deckRowHtml({
      id: 'all-lessons',
      title: 'Communication essentielle A1',
      sub: 'همه درس‌های کتاب',
      stats: countDeckStats(getAllAnkiCards()),
      parent: true
    }),
    '<div class="anki-deck-section-label">درس‌ها · Leçons</div>'
  ];

  lessonNums.forEach((num) => {
    const cards = getAnkiLessonCards(num);
    if (!cards.length) return;
    const meta = getLessonMeta(num);
    parts.push(deckRowHtml({
      id: `lesson-${num}`,
      title: `Leçon ${num}`,
      sub: meta.titleFa,
      stats: countDeckStats(cards)
    }));
  });

  const vocabDecks = [
    { id: 'vocab-all', title: 'Vocabulaire', sub: 'همه واژگان' },
    { id: 'vocab-verbs', title: 'Verbes', sub: 'فعل‌ها' },
    { id: 'vocab-nouns', title: 'Noms', sub: 'اسم‌ها' },
    { id: 'vocab-adjectives', title: 'Adjectifs', sub: 'صفت‌ها' },
    { id: 'vocab-numbers', title: 'Nombres', sub: 'اعداد' },
    { id: 'vocab-expressions', title: 'Expressions', sub: 'اصطلاحات' },
    { id: 'vocab-custom', title: 'AI', sub: 'واژگان افزوده‌شده با AI' },
    { id: 'vocab-saved', title: 'Signets', sub: 'نشان‌شده‌ها ⭐' },
    { id: 'vocab-unmastered', title: 'À revoir', sub: 'فقط لغات یاد نگرفته' }
  ];

  const customSentenceCards = getFlashcardDeck('sentences-custom');
  if (customSentenceCards.length) {
    parts.push('<div class="anki-deck-section-label">جملات افزوده‌شده</div>');
    parts.push(deckRowHtml({
      id: 'sentences-custom',
      title: 'Phrases AI',
      sub: 'کارت جمله ساخته‌شده با AI',
      stats: countDeckStats(customSentenceCards)
    }));
  }

  parts.push('<div class="anki-deck-section-label">واژگان دسته‌ای</div>');
  vocabDecks.forEach((deck) => {
    const cards = getFlashcardDeck(deck.id);
    if (!cards.length && deck.id !== 'vocab-all') return;
    parts.push(deckRowHtml({
      id: deck.id,
      title: deck.title,
      sub: deck.sub,
      stats: countDeckStats(cards)
    }));
  });

  list.innerHTML = parts.join('');
  list.querySelectorAll('[data-deck-id]').forEach((btn) => {
    btn.onclick = () => openFlashcardDeck(btn.dataset.deckId, { reset: true });
  });
}

function showFlashcardScreen(screen) {
  state.flashcards.screen = screen;
  const browser = document.getElementById('flashcardDeckBrowser');
  const study = document.getElementById('flashcardStudyScreen');
  if (browser) browser.style.display = screen === 'browser' ? 'block' : 'none';
  if (study) study.style.display = screen === 'study' ? 'block' : 'none';
}

function updateStudyHeading(deckId) {
  const title = document.getElementById('flashcardStudyTitle');
  const desc = document.getElementById('flashcardStudyDesc');
  if (!title || !desc) return;

  if (deckId === 'all-lessons') {
    title.textContent = 'همه درس‌ها';
    desc.textContent = 'Communication essentielle A1';
    return;
  }
  if (deckId && deckId.startsWith('lesson-')) {
    const num = deckId.slice('lesson-'.length);
    title.textContent = `Leçon ${num}`;
    desc.textContent = getLessonMeta(num).titleFa;
    return;
  }
  if (deckId === 'sentences-custom') {
    title.textContent = 'جملات AI';
    desc.textContent = 'کارت‌های جمله افزوده‌شده با هوش مصنوعی';
    return;
  }
  title.textContent = 'واژگان';
  desc.textContent = 'مرور کارت‌های این دسته';
}

function setFlashcardAnswerVisible(visible) {
  state.flashcards.isFlipped = visible;
  const cardEl = document.getElementById('mainFlashcard');
  if (cardEl) cardEl.classList.toggle('flipped', visible);
  const showBar = document.getElementById('fcShowAnswerBar');
  const rateBar = document.getElementById('fcRateBar');
  if (showBar) showBar.style.display = visible ? 'none' : 'flex';
  if (rateBar) rateBar.style.display = visible ? 'flex' : 'none';
}

function initFlashcardsView() {
  if (state.flashcards.screen === 'study' && state.flashcards.deckId) {
    showFlashcardScreen('study');
    setupFlashcards({ reset: false });
    return;
  }
  showFlashcardScreen('browser');
  renderFlashcardDeckBrowser();
}

function openFlashcardDeck(deckId, { reset = true } = {}) {
  state.flashcards.deckId = deckId;
  showFlashcardScreen('study');
  setupFlashcards({ reset });
  saveState();
}

function backToFlashcardDecks() {
  showFlashcardScreen('browser');
  renderFlashcardDeckBrowser();
  saveState();
}

function setupFlashcards({ reset = true } = {}) {
  const deckId = state.flashcards.deckId || 'all-lessons';
  const sourceDeck = getFlashcardDeck(deckId);

  if (sourceDeck.length === 0) {
    showToast('این دک کارتی ندارد.');
    backToFlashcardDecks();
    return;
  }

  updateStudyHeading(deckId);

  const queue = buildFlashcardStudyQueue(deckId, {
    includeNew: true,
    lookaheadMinutes: ANKI_DEFAULTS.learnAheadMinutes
  });

  if (!queue.length) {
    finishFlashcardSession();
    return;
  }

  state.flashcards.deck = queue;
  state.flashcards.currentIndex = 0;
  state.flashcards.sessionDone = 0;
  state.flashcards.sessionTotal = queue.length;

  renderCurrentFlashcard();
}

function renderCurrentFlashcard() {
  const deck = state.flashcards.deck;
  const index = state.flashcards.currentIndex;
  const cardEl = document.getElementById('mainFlashcard');

  if (!deck.length || !cardEl) return;

  const item = deck[index];
  setFlashcardAnswerVisible(false);
  cardEl.classList.toggle('is-sentence', item.kind === 'sentence');

  const sessionTotal = Math.max(state.flashcards.sessionTotal || deck.length, deck.length);
  const sessionPosition = Math.min(sessionTotal, (state.flashcards.sessionDone || 0) + 1);
  document.getElementById('flashcardCounter').textContent = `کارت ${sessionPosition} از ${sessionTotal}`;
  const deckStats = countDeckStats(getFlashcardDeck(state.flashcards.deckId || 'all-lessons'));
  document.getElementById('flashcardMasteryRatio').textContent = `${deckStats.learning} یادگیری • ${deckStats.due} مرور • ${deckStats.graduated} یادگرفته`;
  const pct = sessionTotal ? Math.round((sessionPosition / sessionTotal) * 100) : 100;
  document.getElementById('flashcardProgressFill').style.width = `${pct}%`;

  // Always force Persian on FRONT, French on BACK
  state.flashcards.direction = 'fa-fr';

  const frontHint = item.kind === 'sentence'
    ? 'معادل فرانسوی این جمله چیست؟'
    : (item.gender
      ? `جنسیت: ${item.gender === 'masculine' ? 'مذکر (le / un)' : item.gender === 'feminine' ? 'مؤنث (la / une)' : item.gender}`
      : (item.categoryNameFa ? `دسته: ${item.categoryNameFa}` : 'معادل فرانسوی این واژه چیست؟'));

  const frontCategory = item.categoryNameFa || item.categoryNameFr || 'واژگان';
  const backCategory = item.categoryNameFr || 'Français';

  const frontTextEl = document.getElementById('fcFrontText');
  const backTextEl = document.getElementById('fcBackTranslation');
  const flipHintEl = document.getElementById('fcFlipHintText');

  document.getElementById('fcFrontCategory').textContent = frontCategory;
  document.getElementById('fcBackCategory').textContent = backCategory;

  // FRONT: Always Persian
  frontTextEl.textContent = item.translation;
  frontTextEl.dir = 'rtl';
  frontTextEl.style.fontFamily = 'var(--font-fa)';

  // BACK: Always French
  backTextEl.textContent = item.word;
  backTextEl.dir = 'ltr';
  backTextEl.style.fontFamily = 'var(--font-fr)';

  if (flipHintEl) {
    flipHintEl.textContent = 'کلیک کنید یا Space را بزنید تا معادل فرانسوی را ببینید';
  }

  document.getElementById('fcFrontHint').textContent = frontHint;

  const exampleBox = document.getElementById('fcBackExampleBox');
  if (item.example) {
    exampleBox.style.display = 'block';
    document.getElementById('fcBackExampleFr').textContent = item.example;
    document.getElementById('fcBackExampleFa').textContent = getTranslationForExample(item.example) || '';
  } else {
    exampleBox.style.display = 'none';
  }

  const detailsEl = document.getElementById('fcBackDetails');
  detailsEl.textContent = item.note ? `نکته: ${item.note}` : (item.fem ? `فرم مؤنث: ${item.fem}` : '');

  renderFlashcardAiBreakdown(item);

  const frontAudioBtn = document.getElementById('fcFrontAudioBtn');
  if (frontAudioBtn) {
    frontAudioBtn.style.display = 'none'; // Never spoil French audio on front of card
  }

  const backAudioBtn = document.getElementById('fcBackAudioBtn');
  if (backAudioBtn) {
    backAudioBtn.onclick = (e) => {
    e.stopPropagation();
    speakFrench(item.word);
  };
  }

  updateAnswerButtonIntervals(item);
}

function flipFlashcard() {
  const nextVisible = !state.flashcards.isFlipped;
  setFlashcardAnswerVisible(nextVisible);
  sfx.playFlip();

  if (nextVisible) {
    const item = state.flashcards.deck[state.flashcards.currentIndex];
    if (item && item.word) {
      speakFrench(item.word);
    }
  }
}

function rateFlashcard(rating) {
  if (!state.flashcards.isFlipped) {
    flipFlashcard();
    return;
  }

  const deck = state.flashcards.deck;
  const currentItem = deck[state.flashcards.currentIndex];
  if (!currentItem) return;

  const nextSchedule = applyFlashcardRating(currentItem, rating);
  if (rating === 'again') {
    sfx.playWrong();
  } else if (rating === 'easy') {
    addXP(10);
    sfx.playCorrect();
  } else if (rating === 'good') {
    addXP(7);
    sfx.playCorrect();
  } else {
    addXP(3);
    sfx.playCorrect();
  }

  deck.splice(state.flashcards.currentIndex, 1);
  state.flashcards.sessionDone += 1;
  addDueCardsToActiveQueue();

  if (nextSchedule.status === 'review') {
    const label = formatReviewInterval(nextSchedule);
    showToast(`مرور بعدی این کارت: ${label}`);
  }

  if (deck.length) {
    state.flashcards.currentIndex = Math.min(state.flashcards.currentIndex, deck.length - 1);
    saveState();
    renderCurrentFlashcard();
    return;
  }

  saveState();
  triggerConfetti();
  finishFlashcardSession();
}

function nextFlashcard(knowsIt) {
  rateFlashcard(knowsIt ? 'easy' : 'again');
}

function shuffleFlashcardDeck() {
  const deck = state.flashcards.deck;
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  state.flashcards.currentIndex = 0;
  saveState();
  renderCurrentFlashcard();
  showToast('کارت‌ها بر زده شدند 🔀');
}

function isFlashcardStudyActive() {
  return state.currentView === 'flashcards' && state.flashcards.screen === 'study';
}

// ==========================================================================
// 4. QUIZ ARENA ENGINE
// ==========================================================================
function resetQuizView() {
  document.getElementById('quizSelectionScreen').style.display = 'block';
  document.getElementById('activeQuizPlayScreen').style.display = 'none';
}

function startQuiz(type) {
  state.quiz.type = type;
  state.lastQuizType = type;
  saveState();
  state.quiz.currentIndex = 0;
  state.quiz.score = 0;
  state.quiz.streak = 0;
  state.quiz.questions = generateQuizQuestions(type, 10);

  document.getElementById('quizSelectionScreen').style.display = 'none';
  document.getElementById('activeQuizPlayScreen').style.display = 'block';

  renderQuizQuestion();
}

function generateQuizQuestions(type, count = 10) {
  const allVocab = getAllVocabItems();
  const questions = [];

  if (type === 'mcq') {
    const shuffled = [...allVocab].sort(() => 0.5 - Math.random()).slice(0, count);
    shuffled.forEach(item => {
      const isFrToFa = Math.random() > 0.4;
      // Pick 3 distractors
      const distractors = allVocab
        .filter(x => x.id !== item.id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);
      
      const options = [item, ...distractors].sort(() => 0.5 - Math.random());

      questions.push({
        type: 'mcq',
        promptFr: isFrToFa ? item.word : item.translation,
        promptLabel: isFrToFa ? 'معادل فارسی این واژه چیست؟' : 'معادل فرانسوی این واژه چیست؟',
        correctText: isFrToFa ? item.translation : item.word,
        isAudio: false,
        speakText: item.word,
        options: options.map(opt => isFrToFa ? opt.translation : opt.word)
      });
    });
  } else if (type === 'listening') {
    const shuffled = [...allVocab].sort(() => 0.5 - Math.random()).slice(0, count);
    shuffled.forEach(item => {
      const distractors = allVocab
        .filter(x => x.id !== item.id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);
      
      const options = [item, ...distractors].sort(() => 0.5 - Math.random());

      questions.push({
        type: 'listening',
        promptFr: '🎧 به صدا گوش دهید',
        promptLabel: 'کلمه یا عبارت شنیده‌شده را انتخاب نمایید:',
        correctText: item.word,
        isAudio: true,
        speakText: item.word,
        translationHint: item.translation,
        options: options.map(opt => opt.word)
      });
    });
  } else if (type === 'gender') {
    const nouns = getAllVocabItems().filter(n => n.categoryKey === 'nouns' && (n.gender === 'masculine' || n.gender === 'feminine'));
    const shuffled = [...nouns].sort(() => 0.5 - Math.random()).slice(0, count);
    shuffled.forEach(item => {
      const isMasc = item.gender === 'masculine';
      questions.push({
        type: 'gender',
        promptFr: item.word,
        promptLabel: `جنسیت اسم «${item.word}» (${item.translation}) چیست؟`,
        correctText: isMasc ? 'Un / Le (مذکر - Masculin)' : 'Une / La (مؤنث - Féminin)',
        speakText: item.word,
        options: ['Un / Le (مذکر - Masculin)', 'Une / La (مؤنث - Féminin)']
      });
    });
  } else if (type === 'scramble') {
    const sentences = [...getAllSentences()].sort(() => 0.5 - Math.random()).slice(0, 8);
    sentences.forEach(s => {
      // Split into clean words
      const words = s.fr.trim().split(/\s+/);
      questions.push({
        type: 'scramble',
        promptFr: s.fa,
        promptLabel: 'کلمات را به ترتیب صحیح فرانسوی انتخاب کنید:',
        correctSentence: s.fr,
        wordsPool: [...words].sort(() => 0.5 - Math.random()),
        targetWords: words,
        speakText: s.fr
      });
    });
  } else if (type === 'grammar') {
    const notes = APP_DATA.grammar_notes;
    notes.forEach(g => {
      if (g.drill) {
        questions.push({
          type: 'grammar',
          promptFr: g.pattern,
          promptLabel: g.drill.question,
          correctText: g.drill.options[g.drill.correct],
          options: g.drill.options,
          speakText: g.example
        });
      }
    });
  }

  return questions;
}

function renderQuizQuestion() {
  const q = state.quiz.questions[state.quiz.currentIndex];
  const total = state.quiz.questions.length;
  const container = document.getElementById('quizQuestionContainer');
  const feedbackBar = document.getElementById('quizFeedbackBar');

  feedbackBar.style.display = 'none';
  state.quiz.selectedOption = null;

  // Progress and Streak
  const pct = Math.round(((state.quiz.currentIndex) / total) * 100);
  document.getElementById('quizActiveProgressFill').style.width = `${pct}%`;
  document.getElementById('quizStreakCount').textContent = state.quiz.streak;

  if (q.type === 'scramble') {
    state.quiz.scramblePicked = [];
    container.innerHTML = `
      <div class="quiz-question-box">
        <div class="quiz-prompt-label">${q.promptLabel}</div>
        <div class="quiz-main-prompt" style="font-family: var(--font-fa); font-size: 1.5rem;">${q.promptFr}</div>
        
        <div class="scramble-slots-area" id="scrambleSlotsArea">
          <span style="color: var(--text-muted); font-size: 0.85rem;">برای ساخت جمله، روی کلمات پایین کلیک کنید...</span>
        </div>

        <div class="scramble-pool-area" id="scramblePoolArea">
          ${q.wordsPool.map((w, idx) => `
            <button class="scramble-tile" data-word="${w}" data-idx="${idx}">${w}</button>
          `).join('')}
        </div>

        <div style="margin-top: 16px;">
          <button class="btn btn-primary btn-sm" id="checkScrambleBtn" style="display: none;">تأیید و بررسی جمله</button>
        </div>
      </div>
    `;

    setupScrambleInteractions(q);
    return;
  }

  // Regular Choice Questions (MCQ, Listening, Gender, Grammar)
  container.innerHTML = `
    <div class="quiz-question-box">
      <div class="quiz-prompt-label">${q.promptLabel}</div>
      
      ${q.isAudio ? `
        <div>
          <button class="quiz-audio-trigger-btn" id="quizPlayAudioBtn">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            <span>پخش مجدد تلفظ</span>
          </button>
        </div>
      ` : `
        <div class="quiz-main-prompt" dir="auto">${q.promptFr}</div>
      `}

      <div class="quiz-options-grid">
        ${q.options.map(opt => `
          <button class="quiz-option-btn" data-opt="${opt}">${opt}</button>
        `).join('')}
      </div>
    </div>
  `;

  // Auto-play audio for listening questions
  if (q.speakText) {
    setTimeout(() => speakFrench(q.speakText), 200);
  }

  const playBtn = document.getElementById('quizPlayAudioBtn');
  if (playBtn) {
    playBtn.onclick = () => speakFrench(q.speakText);
  }

  // Handle Option Click
  container.querySelectorAll('.quiz-option-btn').forEach(btn => {
    btn.onclick = () => {
      if (state.quiz.selectedOption !== null) return; // Prevent double click
      handleQuizAnswer(btn, btn.dataset.opt, q.correctText);
    };
  });
}

function handleQuizAnswer(clickedBtn, selectedText, correctText) {
  state.quiz.selectedOption = selectedText;
  const isCorrect = selectedText === correctText;
  const feedbackBar = document.getElementById('quizFeedbackBar');
  const feedbackContent = document.getElementById('quizFeedbackContent');

  // Disable all buttons
  document.querySelectorAll('.quiz-option-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.opt === correctText) {
      btn.classList.add('correct');
    }
  });

  if (isCorrect) {
    clickedBtn.classList.add('correct');
    state.quiz.score += 1;
    state.quiz.streak += 1;
    sfx.playCorrect();
    addXP(10 + (state.quiz.streak > 2 ? 5 : 0));
    feedbackContent.className = 'feedback-content success';
    feedbackContent.innerHTML = `<span>✅ عالی! کاملاً درست است.</span>`;
  } else {
    clickedBtn.classList.add('wrong');
    state.quiz.streak = 0;
    sfx.playWrong();
    feedbackContent.className = 'feedback-content error';
    feedbackContent.innerHTML = `<span>❌ پاسخ صحیح: <b>${correctText}</b></span>`;
  }

  feedbackBar.style.display = 'flex';
  document.getElementById('quizStreakCount').textContent = state.quiz.streak;
}

function setupScrambleInteractions(q) {
  const poolArea = document.getElementById('scramblePoolArea');
  const slotsArea = document.getElementById('scrambleSlotsArea');
  const checkBtn = document.getElementById('checkScrambleBtn');

  poolArea.querySelectorAll('.scramble-tile').forEach(tile => {
    tile.onclick = () => {
      const word = tile.dataset.word;
      const idx = tile.dataset.idx;
      state.quiz.scramblePicked.push({ word, idx });
      tile.style.visibility = 'hidden';
      updateScrambleSlots();
    };
  });

  function updateScrambleSlots() {
    if (state.quiz.scramblePicked.length === 0) {
      slotsArea.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85rem;">برای ساخت جمله، روی کلمات پایین کلیک کنید...</span>`;
      checkBtn.style.display = 'none';
      return;
    }

    slotsArea.innerHTML = state.quiz.scramblePicked.map((item, pIdx) => `
      <button class="scramble-tile" data-pidx="${pIdx}" style="background: var(--french-blue-light); border-color: var(--french-blue);">${item.word}</button>
    `).join('');

    // Clicking slot item removes it
    slotsArea.querySelectorAll('.scramble-tile').forEach(btn => {
      btn.onclick = () => {
        const pIdx = parseInt(btn.dataset.pidx);
        const removed = state.quiz.scramblePicked.splice(pIdx, 1)[0];
        const originalTile = poolArea.querySelector(`.scramble-tile[data-idx="${removed.idx}"]`);
        if (originalTile) originalTile.style.visibility = 'visible';
        updateScrambleSlots();
      };
    });

    if (state.quiz.scramblePicked.length === q.targetWords.length) {
      checkBtn.style.display = 'inline-block';
    } else {
      checkBtn.style.display = 'none';
    }
  }

  checkBtn.onclick = () => {
    const builtSentence = state.quiz.scramblePicked.map(x => x.word).join(' ');
    const isCorrect = builtSentence.toLowerCase().replace(/[\.,!]/g, '') === q.correctSentence.toLowerCase().replace(/[\.,!]/g, '');
    
    const feedbackBar = document.getElementById('quizFeedbackBar');
    const feedbackContent = document.getElementById('quizFeedbackContent');

    if (isCorrect) {
      state.quiz.score += 1;
      state.quiz.streak += 1;
      sfx.playCorrect();
      addXP(15);
      feedbackContent.className = 'feedback-content success';
      feedbackContent.innerHTML = `<span>✅ آفرین! جمله دقیقاً ساخته شد.</span>`;
    } else {
      state.quiz.streak = 0;
      sfx.playWrong();
      feedbackContent.className = 'feedback-content error';
      feedbackContent.innerHTML = `<span>❌ ساختار صحیح: <b>${q.correctSentence}</b></span>`;
    }

    speakFrench(q.correctSentence);
    checkBtn.disabled = true;
    feedbackBar.style.display = 'flex';
  };
}

function nextQuizQuestion() {
  if (state.quiz.currentIndex < state.quiz.questions.length - 1) {
    state.quiz.currentIndex++;
    renderQuizQuestion();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  state.quizzesCompleted += 1;
  const total = state.quiz.questions.length;
  const score = state.quiz.score;
  const accuracy = Math.round((score / total) * 100);
  state.quizAccuracyHistory.push(accuracy);
  state.quizLog.push({
    date: new Date().toISOString(),
    type: state.quiz.type,
    score,
    total,
    accuracy
  });
  if (state.quizLog.length > 50) state.quizLog = state.quizLog.slice(-50);

  const bonusXP = 40 + (score * 5);
  addXP(bonusXP);
  saveState();

  sfx.playFanfare();
  triggerConfetti();

  // Populate Result Modal
  document.getElementById('quizResultScore').textContent = `${score} / ${total}`;
  document.getElementById('quizResultXP').textContent = `+${bonusXP} XP`;
  document.getElementById('quizResultAccuracy').textContent = `${accuracy}%`;

  if (accuracy >= 80) {
    document.getElementById('quizResultTitle').textContent = '🎉 فوق‌العاده بود! Très bien!';
    document.getElementById('quizResultSubtitle').textContent = 'تسلط شما بر این مبحث عالی است.';
  } else {
    document.getElementById('quizResultTitle').textContent = '👍 تلاش خوبی بود!';
    document.getElementById('quizResultSubtitle').textContent = 'با مرور مجدد فلش‌کارت‌ها می‌توانید به ۱۰۰٪ برسید.';
  }

  document.getElementById('quizResultModalOverlay').style.display = 'flex';
}

// ==========================================================================
// 5. SENTENCES LIBRARY
// ==========================================================================
function renderSentences() {
  const container = document.getElementById('sentencesListContainer');
  let items = [...getAllSentences()];

  // Topic filter
  if (state.sentences.topic !== 'all') {
    items = items.filter(s => s.topic === state.sentences.topic);
  }

  // Search filter
  if (state.sentences.searchQuery.trim()) {
    const q = state.sentences.searchQuery.trim().toLowerCase();
    items = items.filter(s => s.fr.toLowerCase().includes(q) || s.fa.toLowerCase().includes(q));
  }

  container.innerHTML = items.map(s => {
    // Format interactive words in French sentence
    const wordsHtml = s.fr.split(' ').map(word => {
      const cleanWord = word.replace(/['’\.,!]/g, '');
      return `<span class="sentence-interactive-word" data-word="${cleanWord}">${word}</span>`;
    }).join(' ');

    return `
      <div class="sentence-card">
        <div class="sentence-card-top">
          <div class="sentence-fr-box" dir="ltr">
            ${wordsHtml}
          </div>
          <button class="icon-btn-sm sentence-speak-btn" data-sentence="${s.fr}" title="پخش تلفظ جمله">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          </button>
        </div>

        <div class="sentence-fa-box ${state.sentences.hideTranslations ? 'blurred' : ''}">
          ${s.fa}
        </div>
      </div>
    `;
  }).join('');

  // Audio Buttons
  container.querySelectorAll('.sentence-speak-btn').forEach(btn => {
    btn.onclick = () => speakFrench(btn.dataset.sentence);
  });

  // Clickable interactive words
  container.querySelectorAll('.sentence-interactive-word').forEach(el => {
    el.onclick = () => {
      const word = el.dataset.word.toLowerCase();
      const allVocab = getAllVocabItems();
      const match = allVocab.find(v => v.word.toLowerCase() === word || word.startsWith(v.word.toLowerCase()));
      if (match) {
        openWordModal(match);
      } else {
        speakFrench(word);
        showToast(`تلفظ: «${word}»`);
      }
    };
  });

  // Unblur on click when hidden
  container.querySelectorAll('.sentence-fa-box.blurred').forEach(box => {
    box.onclick = () => box.classList.toggle('blurred');
  });
}

// ==========================================================================
// 6. GRAMMAR LAB
// ==========================================================================
function renderGrammarLab() {
  const container = document.getElementById('grammarRulesList');
  const notes = APP_DATA.grammar_notes;

  container.innerHTML = notes.map((rule, rIdx) => `
    <div class="grammar-rule-card">
      <div class="rule-header">
        <div class="rule-pattern">${rule.pattern}</div>
        <button class="icon-btn-sm rule-audio-btn" data-example="${rule.example}" title="پخش مثال صوتی">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
        </button>
      </div>

      <div class="rule-title-fa">${rule.title || rule.meaning}</div>
      <div class="rule-explanation">${rule.explanation || rule.meaning}</div>

      <div class="rule-examples-box">
        <div style="font-size: 0.76rem; color: var(--text-muted); font-weight: 700; margin-bottom: 6px;">نمونه‌های کاربردی:</div>
        ${rule.examples ? rule.examples.map(ex => `<div class="rule-example-item">${ex}</div>`).join('') : `<div class="rule-example-item">${rule.example}</div>`}
      </div>

      ${rule.drill ? `
        <div class="rule-drill-box" data-ridx="${rIdx}">
          <div class="rule-drill-q">💡 تمرین سریع: ${rule.drill.question}</div>
          <div class="rule-drill-options">
            ${rule.drill.options.map((opt, optIdx) => `
              <button class="drill-opt-btn" data-ridx="${rIdx}" data-correct="${rule.drill.correct === optIdx}">${opt}</button>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `).join('');

  // Audio Buttons in Grammar
  container.querySelectorAll('.rule-audio-btn').forEach(btn => {
    btn.onclick = () => speakFrench(btn.dataset.example);
  });

  // Drill buttons
  container.querySelectorAll('.drill-opt-btn').forEach(btn => {
    btn.onclick = () => {
      const isCorrect = btn.dataset.correct === 'true';
      if (isCorrect) {
        btn.style.background = 'var(--success)';
        btn.style.color = '#fff';
        sfx.playCorrect();
        addXP(5, 'پاسخ صحیح به تمرین گرامر');
      } else {
        btn.style.background = 'var(--danger)';
        btn.style.color = '#fff';
        sfx.playWrong();
      }
    };
  });

  // Render Interactive Adjective Agreement Tool
  setupAdjectiveTool();
}

function setupAdjectiveTool() {
  const btnCarousel = document.getElementById('adjToolButtons');
  const display = document.getElementById('adjComparisonDisplay');
  
  const sampleAdjs = APP_DATA.categories.adjectives.filter(a => a.fem);

  btnCarousel.innerHTML = sampleAdjs.slice(0, 10).map((a, idx) => `
    <button class="adj-btn ${idx === 0 ? 'active' : ''}" data-word="${a.word}">${a.word} (${a.translation})</button>
  `).join('');

  function updateDisplay(adj) {
    display.innerHTML = `
      <div class="adj-gender-col masc">
        <div class="adj-col-label">👦 مفرد مذکر (Masculin)</div>
        <div class="adj-col-word">${adj.word}</div>
        <button class="icon-btn-sm speak-masc" style="margin: 0 auto;" title="پخش تلفظ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon></svg>
        </button>
      </div>

      <div class="adj-gender-col fem">
        <div class="adj-col-label">👧 مفرد مؤنث (Féminin)</div>
        <div class="adj-col-word" style="color: #db2777;">${adj.fem}</div>
        <button class="icon-btn-sm speak-fem" style="margin: 0 auto;" title="پخش تلفظ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon></svg>
        </button>
      </div>
    `;

    display.querySelector('.speak-masc').onclick = () => speakFrench(adj.word);
    display.querySelector('.speak-fem').onclick = () => speakFrench(adj.fem);
  }

  updateDisplay(sampleAdjs[0]);

  btnCarousel.querySelectorAll('.adj-btn').forEach(btn => {
    btn.onclick = () => {
      btnCarousel.querySelectorAll('.adj-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const item = sampleAdjs.find(x => x.word === btn.dataset.word);
      if (item) updateDisplay(item);
    };
  });
}

// ==========================================================================
// 7. SPEED MATCH GAME (Jeu d'association)
// ==========================================================================
function startMatchGame() {
  clearInterval(state.game.timerInterval);

  state.game.moves = 0;
  state.game.timer = 0;
  state.game.matchedPairs = 0;
  state.game.selectedTile = null;

  document.getElementById('gameMovesText').textContent = '0';
  document.getElementById('gameTimerText').textContent = '00:00';
  document.getElementById('gameBestRecord').textContent = state.bestMatchRecord ? `${state.bestMatchRecord}s` : '--';

  // Pick 6 random items
  const allVocab = getAllVocabItems();
  let pool = [...allVocab];
  if (state.game.category !== 'all') {
    pool = pool.filter(x => x.categoryKey === state.game.category);
    if (!pool.length) pool = [...allVocab];
  }

  const selected = pool.sort(() => 0.5 - Math.random()).slice(0, 6);

  // Create 12 tiles
  const tiles = [];
  selected.forEach(item => {
    tiles.push({ id: item.id, text: item.word, lang: 'fr', word: item.word });
    tiles.push({ id: item.id, text: item.translation, lang: 'fa', word: item.word });
  });

  // Shuffle
  state.game.tiles = tiles.sort(() => 0.5 - Math.random());

  const grid = document.getElementById('gameBoardGrid');
  grid.innerHTML = state.game.tiles.map((tile, idx) => `
    <div class="game-tile" data-idx="${idx}" data-id="${tile.id}" data-lang="${tile.lang}">
      ${tile.text}
    </div>
  `).join('');

  // Start Timer
  state.game.timerInterval = setInterval(() => {
    state.game.timer++;
    const mins = String(Math.floor(state.game.timer / 60)).padStart(2, '0');
    const secs = String(state.game.timer % 60).padStart(2, '0');
    document.getElementById('gameTimerText').textContent = `${mins}:${secs}`;
  }, 1000);

  // Attach Tile clicks
  grid.querySelectorAll('.game-tile').forEach(tile => {
    tile.onclick = () => handleTileClick(tile);
  });
}

function handleTileClick(tile) {
  if (tile.classList.contains('matched') || tile.classList.contains('selected')) return;

  if (tile.dataset.lang === 'fr') {
    speakFrench(tile.textContent.trim());
  }

  if (!state.game.selectedTile) {
    state.game.selectedTile = tile;
    tile.classList.add('selected');
    sfx.playFlip();
    return;
  }

  // Second tile selected
  const firstTile = state.game.selectedTile;
  state.game.moves++;
  document.getElementById('gameMovesText').textContent = state.game.moves;

  if (firstTile.dataset.id === tile.dataset.id && firstTile.dataset.lang !== tile.dataset.lang) {
    // Match!
    firstTile.classList.remove('selected');
    firstTile.classList.add('matched');
    tile.classList.add('matched');
    state.game.matchedPairs++;
    state.game.selectedTile = null;
    sfx.playCorrect();

    if (state.game.matchedPairs === 6) {
      clearInterval(state.game.timerInterval);
      sfx.playFanfare();
      triggerConfetti();

      const timeTaken = state.game.timer;
      if (!state.bestMatchRecord || timeTaken < state.bestMatchRecord) {
        state.bestMatchRecord = timeTaken;
        saveState();
        showToast(`🏆 رکورد جدید ثبت شد: ${timeTaken} ثانیه!`);
      } else {
        showToast(`🎉 بازی تمام شد در ${timeTaken} ثانیه!`);
      }
      addXP(40);
    }
  } else {
    // No match
    tile.classList.add('selected');
    sfx.playWrong();
    setTimeout(() => {
      firstTile.classList.remove('selected');
      tile.classList.remove('selected');
      state.game.selectedTile = null;
    }, 500);
  }
}

// ==========================================================================
// 8. PROGRESS & STATS VIEW
// ==========================================================================
function renderProgressStats() {
  const allVocab = getAllVocabItems();
  const total = allVocab.length;
  const mastered = state.masteredIds.size;

  document.getElementById('statsTotalXP').textContent = state.xp;
  document.getElementById('statsCurrentStreak').textContent = state.streak;
  document.getElementById('statsMasteredVocab').textContent = `${mastered} / ${total}`;

  // Calculate average accuracy
  let avgAcc = 0;
  if (state.quizAccuracyHistory.length > 0) {
    const sum = state.quizAccuracyHistory.reduce((a, b) => a + b, 0);
    avgAcc = Math.round(sum / state.quizAccuracyHistory.length);
  }
  document.getElementById('statsQuizAccuracy').textContent = `${avgAcc}%`;

  // Category Breakdown List
  const breakdownList = document.getElementById('categoryBreakdownList');
  const cats = [
    { name: 'فعل‌ها (Verbes)', items: APP_DATA.categories.verbs },
    { name: 'اسم‌ها (Noms)', items: APP_DATA.categories.nouns },
    { name: 'صفت‌ها (Adjectifs)', items: APP_DATA.categories.adjectives },
    { name: 'قیدها و حروف اضافه', items: [...APP_DATA.categories.adverbs, ...APP_DATA.categories.prepositions] },
    { name: 'اعداد (Nombres)', items: APP_DATA.categories.numbers || [] },
    { name: 'اصطلاحات و عبارات (Expressions)', items: APP_DATA.categories.expressions }
  ];

  breakdownList.innerHTML = cats.map(cat => {
    const catMastered = cat.items.filter(x => state.masteredIds.has(x.id)).length;
    const catPct = Math.round((catMastered / cat.items.length) * 100);

    return `
      <div class="breakdown-row">
        <div class="breakdown-labels">
          <span>${cat.name}</span>
          <span>${catMastered} از ${cat.items.length} (${catPct}%)</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-fill" style="width: ${catPct}%;"></div>
        </div>
      </div>
    `;
  }).join('');

  renderActivityCalendar();
  renderQuizLog();
}

const QUIZ_TYPE_LABELS = {
  mcq: 'چندگزینه‌ای',
  listening: 'شنیداری',
  gender: 'جنسیت اسم',
  scramble: 'مرتب‌سازی حروف',
  grammar: 'دستور زبان'
};

function renderActivityCalendar() {
  const calendar = document.getElementById('activityCalendar');
  if (!calendar) return;

  const active = new Set(state.activityDates || []);
  const today = todayISO();
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({
      iso,
      label: d.toLocaleDateString('fa-IR', { day: 'numeric' }),
      weekday: d.toLocaleDateString('fa-IR', { weekday: 'short' }),
      active: active.has(iso),
      today: iso === today
    });
  }

  calendar.innerHTML = days.map(day => `
    <div class="activity-day${day.active ? ' active' : ''}${day.today ? ' today' : ''}" title="${day.iso}">
      <span class="activity-weekday">${day.weekday}</span>
      <span class="activity-num">${day.label}</span>
    </div>
  `).join('');
}

function renderQuizLog() {
  const list = document.getElementById('quizLogList');
  if (!list) return;
  const log = (state.quizLog || []).slice().reverse().slice(0, 8);
  if (!log.length) {
    list.innerHTML = '<div class="quiz-log-empty">هنوز آزمونی ثبت نشده است.</div>';
    return;
  }
  list.innerHTML = log.map(entry => {
    const when = entry.date
      ? new Date(entry.date).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '—';
    const type = QUIZ_TYPE_LABELS[entry.type] || entry.type || 'آزمون';
    return `
      <div class="quiz-log-row">
        <div>
          <div class="quiz-log-type">${type}</div>
          <div class="quiz-log-date">${when}</div>
        </div>
        <div class="quiz-log-score">${entry.score}/${entry.total} • ${entry.accuracy}%</div>
      </div>
    `;
  }).join('');
}

// ==========================================================================
// 9. MODALS & GLOBAL SEARCH
// ==========================================================================
function openWordModal(item) {
  const modal = document.getElementById('wordModalOverlay');
  const content = document.getElementById('wordModalContent');

  const breakdown = getAiBreakdown(item.id);

  let aiBoxHtml = '';
  if (breakdown) {
    aiBoxHtml = `
      <div class="modal-ai-box">
        <div class="ai-title-row">
          <span class="ai-tag">✨ ترجمه و تجزیه AI</span>
          <button class="fc-ai-refresh-btn" id="modalAiRefreshBtn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            <span>تولید مجدد</span>
          </button>
        </div>
        ${renderAiBreakdownInner(breakdown)}
      </div>
    `;
  } else {
    aiBoxHtml = `
      <div style="margin-bottom: 16px;" id="modalAiGenContainer">
        <button class="btn btn-outline btn-sm fc-ai-generate-btn" id="modalAiGenerateBtn" style="width: 100%; justify-content: center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"></path></svg>
          <span>ترجمه و تجزیه با AI</span>
        </button>
      </div>
    `;
  }

  content.innerHTML = `
    <div style="text-align: center; padding: 20px 10px 10px;">
      <div class="badge-tag" style="margin-bottom: 12px;">${item.categoryNameFr || 'Vocabulaire'} • ${item.categoryNameFa || ''}</div>
      <div style="font-family: var(--font-fr); font-size: 2.2rem; font-weight: 800; color: var(--text-primary); margin-bottom: 6px;" dir="ltr">
        ${item.word}
      </div>
      <div style="font-size: 1.35rem; font-weight: 700; color: var(--french-blue); margin-bottom: 20px;">
        ${item.translation}
      </div>

      <button class="btn btn-primary" id="modalSpeakBtn" style="margin-bottom: 20px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
        <span>پخش تلفظ صوتی</span>
      </button>

      ${item.example ? `
        <div class="card" style="text-align: right; background: var(--bg-secondary); margin-bottom: 16px;">
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; margin-bottom: 4px;">مثال در جمله:</div>
          <div style="font-family: var(--font-fr); font-weight: 600; font-size: 1rem; margin-bottom: 4px;" dir="ltr">${item.example}</div>
          <div style="font-size: 0.88rem; color: var(--text-secondary);">${getTranslationForExample(item.example) || ''}</div>
        </div>
      ` : ''}

      ${item.note ? `
        <div class="vocab-note-tag" style="text-align: right; margin-bottom: 16px;">💡 ${item.note}</div>
      ` : ''}

      ${aiBoxHtml}

      <div style="display: flex; gap: 10px; justify-content: center; margin-top: 10px;">
        <button class="btn btn-secondary btn-sm" id="modalBookmarkBtn">
          ${state.savedIds.has(item.id) ? '⭐ حذف از نشان‌شده‌ها' : '⭐ نشان کردن'}
        </button>
        <button class="btn btn-outline btn-sm" id="modalMasterBtn">
          ${state.masteredIds.has(item.id) ? '✅ مسلط شده' : 'علامت به عنوان مسلط'}
        </button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';

  document.getElementById('modalSpeakBtn').onclick = () => speakFrench(item.word);

  if (breakdown) {
    const refBtn = document.getElementById('modalAiRefreshBtn');
    if (refBtn) {
      refBtn.onclick = async () => {
        refBtn.disabled = true;
        try {
          await generateAiBreakdownForItem(item, { forceRefresh: true });
          showToast('ترجمه مجدد آماده شد ✨');
          openWordModal(item);
        } catch (err) {
          console.error(err);
          if (err.message !== 'کلید OpenRouter تنظیم نشد') {
            showToast(err.message || 'خطا در ترجمه');
          }
          openWordModal(item);
        }
      };
    }
  } else {
    const genBtn = document.getElementById('modalAiGenerateBtn');
    if (genBtn) {
      genBtn.onclick = async () => {
        const c = document.getElementById('modalAiGenContainer');
        if (c) {
          c.innerHTML = `
            <div class="fc-ai-loading">
              <div class="fc-ai-spinner"></div>
              <span>در حال ترجمه و تجزیه با AI...</span>
            </div>
          `;
        }
        try {
          await generateAiBreakdownForItem(item);
          showToast('ترجمه و تجزیه آماده شد ✨');
          openWordModal(item);
        } catch (err) {
          console.error(err);
          if (err.message !== 'کلید OpenRouter تنظیم نشد') {
            showToast(err.message || 'خطا در ترجمه');
          }
          openWordModal(item);
        }
      };
    }
  }

  document.getElementById('modalBookmarkBtn').onclick = () => {
    if (state.savedIds.has(item.id)) {
      state.savedIds.delete(item.id);
    } else {
      state.savedIds.add(item.id);
    }
    saveState();
    openWordModal(item);
  };

  document.getElementById('modalMasterBtn').onclick = () => {
    if (state.masteredIds.has(item.id)) {
      setManualFlashcardMastery(item.id, false);
    } else {
      setManualFlashcardMastery(item.id, true);
      addXP(10);
    }
    saveState();
    openWordModal(item);
  };
}

function setupGlobalSearch() {
  const trigger = document.getElementById('globalSearchTrigger');
  const overlay = document.getElementById('searchModalOverlay');
  const input = document.getElementById('globalSearchInput');
  const resultsEl = document.getElementById('globalSearchResults');
  const closeBtn = document.getElementById('searchModalCloseBtn');

  function openSearch() {
    overlay.style.display = 'flex';
    input.value = '';
    input.focus();
    performSearch('');
  }

  function closeSearch() {
    overlay.style.display = 'none';
  }

  trigger.onclick = openSearch;
  closeBtn.onclick = closeSearch;

  overlay.onclick = (e) => {
    if (e.target === overlay) closeSearch();
  };

  // Keyboard shortcut: Cmd+K / Ctrl+K & Escape
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openSearch();
    }
    if (e.key === 'Escape') {
      closeSearch();
      document.getElementById('wordModalOverlay').style.display = 'none';
      document.getElementById('quizResultModalOverlay').style.display = 'none';
      closeAiKeyModal(true);
      closeImageLightbox();
    }
  });

  input.oninput = () => {
    performSearch(input.value);
  };

  function performSearch(q) {
    const allVocab = getAllVocabItems();
    const cleanQ = q.trim().toLowerCase();

    let matches = allVocab;
    if (cleanQ) {
      matches = allVocab.filter(v => v.word.toLowerCase().includes(cleanQ) || v.translation.toLowerCase().includes(cleanQ));
    }

    resultsEl.innerHTML = matches.slice(0, 20).map(item => `
      <div class="search-result-item" data-id="${item.id}">
        <div>
          <span class="search-result-fr" dir="ltr">${item.word}</span>
          <span style="font-size: 0.75rem; color: var(--text-muted); margin-right: 8px;">(${item.categoryNameFr})</span>
        </div>
        <div class="search-result-fa">${item.translation}</div>
      </div>
    `).join('');

    resultsEl.querySelectorAll('.search-result-item').forEach(itemEl => {
      itemEl.onclick = () => {
        const item = allVocab.find(x => x.id === itemEl.dataset.id);
        if (item) {
          closeSearch();
          openWordModal(item);
        }
      };
    });
  }
}

// ==========================================================================
// 10. EVENT LISTENERS & INITIALIZATION
// ==========================================================================
function updateHeaderStats() {
  document.getElementById('headerStreak').textContent = state.streak;
  document.getElementById('headerXP').textContent = state.xp;
  document.getElementById('speedIndicatorText').textContent = `${state.audioSpeed}x`;
}

function updateContentCounts() {
  const vocab = getAllVocabItems();
  const sents = getAllSentences();
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setText('sidebarVocabCount', vocab.length);
  setText('sidebarSentencesCount', sents.length);
  setText('statsMasteredVocab', `${state.masteredIds.size} / ${vocab.length}`);
  setText('catCountVerbs', `${(APP_DATA.categories.verbs || []).length} فعل`);
  setText('catCountNouns', `${(APP_DATA.categories.nouns || []).length} اسم`);
  setText('catCountAdjectives', `${(APP_DATA.categories.adjectives || []).length} صفت`);
  setText('catCountExpr', `${(APP_DATA.categories.expressions || []).length} اصطلاح`);
  setText('catCountSentences', `${sents.length} جمله`);
}

function getCustomData() {
  if (!state.custom) state.custom = { vocab: [], sentences: [] };
  return state.custom;
}

function saveCustomData(data) {
  state.custom = data;
  saveState();
}

function getOpenRouterKey() {
  return state.openRouterKey || window.FF_OPENROUTER_KEY || '';
}

let pendingKeyResolve = null;
let pendingKeyReject = null;

function openAiKeyModal() {
  const modal = document.getElementById('aiKeyModalOverlay');
  const input = document.getElementById('modalOpenRouterKeyInput');
  const modelSelect = document.getElementById('modalOpenRouterModelSelect');
  if (modal) {
    if (input) input.value = state.openRouterKey || '';
    if (modelSelect) modelSelect.value = state.openRouterModel || 'openai/gpt-4o-mini';
    modal.style.display = 'flex';
    if (input) input.focus();
  }
}

function closeAiKeyModal(cancelled = true) {
  const modal = document.getElementById('aiKeyModalOverlay');
  if (modal) modal.style.display = 'none';
  if (cancelled && pendingKeyReject) {
    pendingKeyReject(new Error('کلید OpenRouter تنظیم نشد'));
  }
  pendingKeyResolve = null;
  pendingKeyReject = null;
}

function saveAiKeyFromModal() {
  const input = document.getElementById('modalOpenRouterKeyInput');
  const modelSelect = document.getElementById('modalOpenRouterModelSelect');
  const key = (input ? input.value : '').trim();
  const model = modelSelect ? modelSelect.value : (state.openRouterModel || 'openai/gpt-4o-mini');

  if (!key) {
    showToast('لطفاً کلید OpenRouter را وارد کنید');
    return;
  }

  state.openRouterKey = key;
  state.openRouterModel = model;
  saveState();

  const importerKey = document.getElementById('openRouterKeyInput');
  if (importerKey) importerKey.value = key;
  const importerModel = document.getElementById('openRouterModelSelect');
  if (importerModel) importerModel.value = model;

  showToast('کلید OpenRouter با موفقیت ذخیره شد');

  if (pendingKeyResolve) {
    pendingKeyResolve(key);
    pendingKeyResolve = null;
    pendingKeyReject = null;
  }
  closeAiKeyModal(false);
}

function ensureOpenRouterKey() {
  const currentKey = getOpenRouterKey();
  if (currentKey) {
    return Promise.resolve(currentKey);
  }

  return new Promise((resolve, reject) => {
    pendingKeyResolve = resolve;
    pendingKeyReject = reject;
    openAiKeyModal();
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getAiBreakdown(itemId) {
  const record = state.aiVisuals ? state.aiVisuals[itemId] : null;
  if (!record || !Array.isArray(record.chunks)) return null;
  return record;
}

function formatBreakdownMeaning(breakdown) {
  const meaning = (breakdown.meaningFa || '').replace(/^یعنی[:：]\s*/, '');
  const emojis = breakdown.emojis ? ` ${breakdown.emojis}` : '';
  return meaning ? `یعنی: ${meaning}${emojis}` : '';
}

function renderAiBreakdownInner(breakdown) {
  const chunks = (breakdown.chunks || [])
    .filter(chunk => chunk && (chunk.fr || chunk.fa))
    .map(chunk => `
      <div class="ai-breakdown-chunk">
        <span class="ai-breakdown-chunk-fr" dir="ltr">${escapeHtml(chunk.fr)}</span>
        <span class="ai-breakdown-eq">=</span>
        <span class="ai-breakdown-chunk-fa">${escapeHtml(chunk.fa)}</span>
      </div>
    `).join('');

  const notes = (breakdown.notes || [])
    .filter(note => note && (note.fr || note.fa))
    .map(note => `
      <div class="ai-breakdown-note">📌 ${escapeHtml(note.fr)} = ${escapeHtml(note.fa)}</div>
    `).join('');

  const exampleFr = breakdown.exampleFr || '';
  const exampleFa = breakdown.exampleFa || '';

  return `
    <div class="ai-breakdown">
      ${breakdown.fr ? `<div class="ai-breakdown-fr" dir="ltr">${escapeHtml(breakdown.fr)}</div>` : ''}
      ${formatBreakdownMeaning(breakdown) ? `<div class="ai-breakdown-meaning">${escapeHtml(formatBreakdownMeaning(breakdown))}</div>` : ''}
      ${chunks ? `<div class="ai-breakdown-chunks">${chunks}</div>` : ''}
      ${notes ? `<div class="ai-breakdown-notes">${notes}</div>` : ''}
      ${exampleFr ? `
        <div class="ai-breakdown-example">
          <div class="ai-breakdown-example-label">مثلاً:</div>
          <div class="ai-breakdown-example-fr" dir="ltr">${escapeHtml(exampleFr)}</div>
          ${exampleFa ? `<div class="ai-breakdown-example-fa">= ${escapeHtml(exampleFa)}</div>` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

function openBreakdownLightbox(breakdown, item) {
  const modal = document.getElementById('imageLightboxOverlay');
  const body = document.getElementById('lightboxBreakdownBody');
  if (!modal || !body || !breakdown) return;

  body.innerHTML = `
    <div class="lightbox-info">
      <div class="lightbox-word-title" dir="ltr">${escapeHtml(item?.word || breakdown.fr || '')}</div>
      ${renderAiBreakdownInner(breakdown)}
    </div>
  `;
  modal.style.display = 'flex';
}

function closeImageLightbox() {
  const modal = document.getElementById('imageLightboxOverlay');
  if (modal) modal.style.display = 'none';
}

function getBreakdownSource(item) {
  const word = item.word || item.expression || item.fr || '';
  const translation = item.translation || item.fa || '';
  const example = item.example || '';
  const exampleFa = example ? (getTranslationForExample(example) || '') : '';

  if (item.kind === 'sentence' || (word && /\s/.test(word))) {
    return { fr: word, fa: translation, focus: word };
  }
  if (example) {
    return { fr: example, fa: exampleFa || translation, focus: word };
  }
  return { fr: word, fa: translation, focus: word };
}

async function generateAiBreakdownForItem(item, { forceRefresh = false } = {}) {
  if (!item || !item.id) {
    throw new Error('کارت معتبر نیست');
  }

  const existing = getAiBreakdown(item.id);
  if (!forceRefresh && existing) {
    return existing;
  }

  const key = await ensureOpenRouterKey();
  const model = state.openRouterModel || 'openai/gpt-4o-mini';
  const source = getBreakdownSource(item);
  const category = item.categoryNameFa || item.categoryKey || item.type || '';
  const gender = item.gender
    ? (item.gender === 'masculine' ? 'masculine (le/un)' : item.gender === 'feminine' ? 'feminine (la/une)' : item.gender)
    : '';

  const systemPrompt = `You are a patient A1 French teacher for Persian (Farsi) learners.
Break the French sentence or phrase into small, useful pieces so the learner sees what each part means.

Return ONLY a valid JSON object:
{
  "fr": "the French sentence or phrase being explained",
  "meaningFa": "natural Persian translation without the word یعنی",
  "emojis": "1 to 3 relevant emojis, or empty string",
  "chunks": [{"fr":"Je bois","fa":"من می‌نوشم"}],
  "notes": [{"fr":"boire","fa":"نوشیدن"}],
  "exampleFr": "one similar A1 sentence with a small substitution",
  "exampleFa": "Persian translation of that example"
}

Rules:
- chunks must be meaningful groups (subject+verb, article+noun, preposition+noun), not every isolated letter.
- Keep 3 to 6 chunks when possible.
- notes: 1 to 3 key vocabulary or grammar points.
- exampleFr should reuse the same pattern with one changed word.
- Persian must be natural and simple.
- If a focus word is given, include it in notes.
- Do NOT output markdown or extra text.`;

  const userPrompt = [
    `French: "${source.fr}"`,
    `Persian: "${source.fa}"`,
    source.focus && source.focus !== source.fr ? `Focus word: "${source.focus}"` : '',
    category ? `Category: ${category}` : '',
    gender ? `Gender: ${gender}` : '',
    item.note ? `Note: ${item.note}` : ''
  ].filter(Boolean).join('\n');

  const body = {
    model,
    temperature: 0.4,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  };

  let response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin || 'http://localhost',
      'X-Title': 'FrancaisFacile'
    },
    body: JSON.stringify({ ...body, response_format: { type: 'json_object' } })
  });

  let payload = await response.json();
  if (!response.ok && /response_format|json_object/i.test(payload.error?.message || '')) {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin || 'http://localhost',
        'X-Title': 'FrancaisFacile'
      },
      body: JSON.stringify(body)
    });
    payload = await response.json();
  }

  if (!response.ok && /insufficient credits|purchase more|never purchased credits/i.test(payload.error?.message || '')) {
    const freeBody = { ...body, model: 'openrouter/free' };
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin || 'http://localhost',
        'X-Title': 'FrancaisFacile'
      },
      body: JSON.stringify(freeBody)
    });
    payload = await response.json();
  }

  if (!response.ok) {
    throw new Error(payload.error?.message || 'خطا در ارتباط با OpenRouter');
  }

  const raw = payload.choices?.[0]?.message?.content || '';
  let parsed;
  try {
    parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''));
  } catch (err) {
    throw new Error('پاسخ نامعتبر از مدل ترجمه');
  }

  const record = {
    kind: 'breakdown',
    fr: parsed.fr || source.fr,
    meaningFa: parsed.meaningFa || source.fa,
    emojis: parsed.emojis || '',
    chunks: Array.isArray(parsed.chunks) ? parsed.chunks : [],
    notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    exampleFr: parsed.exampleFr || '',
    exampleFa: parsed.exampleFa || '',
    createdAt: new Date().toISOString()
  };

  if (!state.aiVisuals) state.aiVisuals = {};
  state.aiVisuals[item.id] = record;
  saveState();

  return record;
}

function renderFlashcardAiBreakdown(item) {
  const container = document.getElementById('fcBackAiVisual');
  if (!container || !item) return;

  const breakdown = getAiBreakdown(item.id);

  if (breakdown) {
    container.innerHTML = `
      <div class="fc-ai-visual-card ai-breakdown-card">
        <div class="ai-breakdown-toolbar">
          <div class="fc-ai-visual-title">✨ ترجمه و تجزیه</div>
          <button class="fc-ai-refresh-btn" id="fcAiRefreshBtn" title="تولید مجدد ترجمه">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            <span>تولید مجدد</span>
          </button>
        </div>
        ${renderAiBreakdownInner(breakdown)}
      </div>
    `;

    const refreshBtn = document.getElementById('fcAiRefreshBtn');
    if (refreshBtn) {
      refreshBtn.onclick = (e) => {
        e.stopPropagation();
        handleGenerateFlashcardBreakdown(item, true);
      };
    }
  } else {
    container.innerHTML = `
      <div class="fc-ai-placeholder">
        <button class="btn btn-outline btn-sm fc-ai-generate-btn" id="fcGenerateAiBtn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"></path></svg>
          <span>ترجمه و تجزیه با AI</span>
        </button>
      </div>
    `;

    const genBtn = document.getElementById('fcGenerateAiBtn');
    if (genBtn) {
      genBtn.onclick = (e) => {
        e.stopPropagation();
        handleGenerateFlashcardBreakdown(item, false);
      };
    }
  }
}

async function handleGenerateFlashcardBreakdown(item, forceRefresh = false) {
  const container = document.getElementById('fcBackAiVisual');
  if (container) {
    container.innerHTML = `
      <div class="fc-ai-loading">
        <div class="fc-ai-spinner"></div>
        <span>در حال ترجمه و تجزیه با AI...</span>
      </div>
    `;
  }

  try {
    await generateAiBreakdownForItem(item, { forceRefresh });
    renderFlashcardAiBreakdown(item);
    showToast('ترجمه و تجزیه آماده شد ✨');
  } catch (err) {
    console.error(err);
    renderFlashcardAiBreakdown(item);
    if (err.message !== 'کلید OpenRouter تنظیم نشد') {
      showToast(err.message || 'خطا در ترجمه');
    }
  }
}

function setupImporterView() {
  const keyInput = document.getElementById('openRouterKeyInput');
  if (keyInput && !keyInput.value) {
    keyInput.value = getOpenRouterKey();
  }
}

let importerDraft = null;

async function analyzeImportedSentence() {
  const input = document.getElementById('importerInput');
  const status = document.getElementById('importerStatus');
  const btn = document.getElementById('importerAnalyzeBtn');
  const preview = document.getElementById('importerPreview');
  const text = (input.value || '').trim();
  const keyInput = document.getElementById('openRouterKeyInput');
  const key = (keyInput.value || '').trim() || getOpenRouterKey();
  const model = document.getElementById('openRouterModelSelect').value;

  if (!text) {
    showToast('ابتدا جمله فرانسوی را وارد کنید');
    return;
  }
  if (!key) {
    showToast('کلید OpenRouter را وارد کنید');
    return;
  }

  state.openRouterKey = key;
  state.openRouterModel = model;
  saveState();
  btn.disabled = true;
  status.textContent = 'در حال تحلیل جمله...';
  preview.style.display = 'none';

  const systemPrompt = `You are a patient A1 French teacher for Persian (Farsi) learners.
Split the user's French text into complete teaching sentences and break each sentence into meaningful chunks.

Return ONLY valid JSON:
{
  "sentences": [
    {
      "fr": "complete French sentence",
      "fa": "natural Persian translation",
      "topic": "food|work|family|health|travel|housing|routine|culture|other",
      "emojis": "1 to 3 relevant emojis or empty string",
      "chunks": [{"fr":"Je pense que","fa":"من فکر می‌کنم که"}],
      "notes": [{"fr":"avoir de la fièvre","fa":"تب داشتن"}],
      "exampleFr": "one similar A1 sentence with a small substitution",
      "exampleFa": "Persian translation of that example"
    }
  ]
}

Rules:
- One object per complete sentence. If the user pasted several sentences, return several objects.
- chunks must be useful groups (subject+verb, article+noun, connector+clause), not every isolated word.
- 3 to 8 chunks per sentence.
- notes: 1 to 3 key vocabulary or grammar points.
- Persian must be natural and simple.
- Do not extract standalone vocabulary cards.
- Do NOT output markdown.`;

  try {
    const body = {
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ]
    };

    let response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin || 'http://localhost',
        'X-Title': 'FrancaisFacile'
      },
      body: JSON.stringify({ ...body, response_format: { type: 'json_object' } })
    });

    let payload = await response.json();
    if (!response.ok && /response_format|json_object/i.test(payload.error?.message || '')) {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin || 'http://localhost',
          'X-Title': 'FrancaisFacile'
        },
        body: JSON.stringify(body)
      });
      payload = await response.json();
    }
    if (!response.ok && /insufficient credits|purchase more|never purchased credits/i.test(payload.error?.message || '')) {
      const freeBody = { ...body, model: 'openrouter/free' };
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin || 'http://localhost',
          'X-Title': 'FrancaisFacile'
        },
        body: JSON.stringify(freeBody)
      });
      payload = await response.json();
    }

    if (!response.ok) {
      throw new Error(payload.error?.message || 'خطای OpenRouter');
    }

    const raw = payload.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''));
    importerDraft = normalizeImporterDraft(parsed, text);
    if (!importerDraft.sentences.length) {
      throw new Error('جمله‌ای برای ساخت کارت پیدا نشد');
    }
    renderImporterPreview(importerDraft);
    status.textContent = 'تحلیل آماده است. کارت‌های جمله را انتخاب و به انکی اضافه کنید.';
  } catch (err) {
    console.error(err);
    status.textContent = '';
    showToast(err.message || 'تحلیل ناموفق بود');
  } finally {
    btn.disabled = false;
  }
}

function normalizeImporterDraft(parsed, originalText) {
  const rawSentences = Array.isArray(parsed?.sentences) && parsed.sentences.length
    ? parsed.sentences
    : (parsed?.sentence ? [parsed.sentence] : []);

  const sentences = rawSentences
    .map((item) => {
      const fr = (item.fr || item.word || '').trim();
      const fa = (item.fa || item.meaningFa || item.translation || '').trim();
      if (!fr) return null;
      return {
        fr,
        fa,
        topic: item.topic || 'other',
        emojis: item.emojis || '',
        chunks: Array.isArray(item.chunks) ? item.chunks : [],
        notes: Array.isArray(item.notes) ? item.notes : [],
        exampleFr: item.exampleFr || '',
        exampleFa: item.exampleFa || ''
      };
    })
    .filter(Boolean);

  if (!sentences.length && originalText) {
    sentences.push({
      fr: originalText,
      fa: parsed?.sentence?.fa || '',
      topic: 'other',
      emojis: '',
      chunks: [],
      notes: [],
      exampleFr: '',
      exampleFa: ''
    });
  }

  return { sentences };
}

function renderImporterPreview(data) {
  const preview = document.getElementById('importerPreview');
  const grid = document.getElementById('importerSentenceGrid');
  if (!preview || !grid) return;

  const items = data.sentences || [];
  grid.innerHTML = items.map((item, idx) => `
    <label class="card importer-sentence-card">
      <div class="importer-sentence-card-top">
        <span class="badge-tag">کارت جمله ${idx + 1}</span>
        <input type="checkbox" class="importer-item-check" data-idx="${idx}" checked>
      </div>
      ${renderAiBreakdownInner({
        fr: item.fr,
        meaningFa: item.fa,
        emojis: item.emojis,
        chunks: item.chunks,
        notes: item.notes,
        exampleFr: item.exampleFr,
        exampleFa: item.exampleFa
      })}
    </label>
  `).join('');
  preview.style.display = 'block';
}

function saveImportedItems() {
  if (!importerDraft || !importerDraft.sentences?.length) {
    showToast('ابتدا جمله را تحلیل کنید');
    return;
  }

  const extra = getCustomData();
  const selected = [...document.querySelectorAll('.importer-item-check:checked')].map(el => Number(el.dataset.idx));
  const now = Date.now();
  let added = 0;

  if (!state.aiVisuals) state.aiVisuals = {};

  selected.forEach((idx, i) => {
    const item = importerDraft.sentences[idx];
    if (!item || !item.fr) return;

    if (extra.sentences.some(existing => (existing.fr || '').trim() === item.fr.trim())) {
      return;
    }

    const id = `cs-${now}-${i}`;
    extra.sentences.push({
      id,
      fr: item.fr,
      fa: item.fa || '',
      topic: item.topic || 'other',
      lesson: '00',
      custom: true
    });

    if (item.chunks?.length || item.fa) {
      state.aiVisuals[id] = {
        kind: 'breakdown',
        fr: item.fr,
        meaningFa: item.fa || '',
        emojis: item.emojis || '',
        chunks: item.chunks || [],
        notes: item.notes || [],
        exampleFr: item.exampleFr || '',
        exampleFa: item.exampleFa || '',
        createdAt: new Date().toISOString()
      };
    }
    added += 1;
  });

  if (!added) {
    showToast(selected.length ? 'این جمله‌ها از قبل در انکی هستند' : 'حداقل یک جمله را انتخاب کنید');
    return;
  }

  saveCustomData(extra);
  updateContentCounts();
  addXP(15 * added, 'برای افزودن کارت جمله');
  showToast(`${added} کارت جمله به انکی اضافه شد`);
  if (typeof renderFlashcardDeckBrowser === 'function') {
    renderFlashcardDeckBrowser();
  }
}

function restoreUiFromState() {
  document.body.className = state.theme === 'dark' ? 'theme-dark' : 'theme-light';

  const speedText = document.getElementById('speedIndicatorText');
  if (speedText) speedText.textContent = `${state.audioSpeed}x`;
  const speedBtn = document.getElementById('audioSpeedBtn');
  if (speedBtn) speedBtn.title = `سرعت تلفظ صوتی (فعلی: ${state.audioSpeed}x)`;

  const dirLabel = document.getElementById('flashcardDirectionLabel');
  if (dirLabel) {
    dirLabel.textContent = state.flashcards.direction === 'fr-fa' ? 'فرانسوی ➔ فارسی' : 'فارسی ➔ فرانسوی';
  }

  document.querySelectorAll('#vocabCategoryTabs .tab-chip').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.cat === state.vocab.category);
  });
  const genderSelect = document.getElementById('vocabGenderFilter');
  if (genderSelect) genderSelect.value = state.vocab.gender;
  const gridBtn = document.getElementById('vocabViewGridBtn');
  const listBtn = document.getElementById('vocabViewListBtn');
  if (gridBtn && listBtn) {
    gridBtn.classList.toggle('active', state.vocab.viewMode !== 'list');
    listBtn.classList.toggle('active', state.vocab.viewMode === 'list');
  }

  document.querySelectorAll('#sentenceTopicTabs .tab-chip').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.topic === state.sentences.topic);
  });
  const hideTrans = document.getElementById('hideTransText');
  if (hideTrans) {
    hideTrans.textContent = state.sentences.hideTranslations ? 'نمایش مجدد ترجمه‌ها' : 'مخفی‌سازی ترجمه برای تست';
  }

  const gameCat = document.getElementById('gameCatSelect');
  if (gameCat) gameCat.value = state.game.category;

  const keyInput = document.getElementById('openRouterKeyInput');
  if (keyInput) keyInput.value = state.openRouterKey || '';
  const modelSelect = document.getElementById('openRouterModelSelect');
  if (modelSelect && state.openRouterModel) modelSelect.value = state.openRouterModel;

  updateHeaderStats();
}

function applyImportedSnapshot(parsed) {
  if (window.FFStorage) {
    window.FFStorage.applyToState(parsed, state);
  }
  if (!state.custom) state.custom = { vocab: [], sentences: [] };
  syncMasteredIdsFromFlashcardReviews();
  migrateMasteredFlashcardsToReviews();
  document.body.className = state.theme === 'dark' ? 'theme-dark' : 'theme-light';
  updateHeaderStats();
  updateContentCounts();
}

// ==========================================================================
// 10. LIVRE & AUDIO ENGINE (PDF Book Viewer, AI Vision Teacher, Audio Player)
// ==========================================================================
const ARVAN_AUDIO_BASE = 'https://france.s3.ir-thr-at1.arvanstorage.ir/Communication_essentielle_du_franc%CC%A7ais_A1_Audio%2F';
const TOTAL_AUDIO_TRACKS = 233;

let bookPdfDoc = null;
let isPdfRendering = false;
let pendingPdfPage = null;
let bookAudio = null;
let bookAudioDuration = 0;

const BOOK_LESSON_PAGES = [
  { page: 1, label: 'جلد کتاب (Couverture)' },
  { page: 4, label: 'فهرست مطالب (Sommaire)' },
  { page: 6, label: 'Leçon 1: هویت، اعداد، ملیت و شغل' },
  { page: 10, label: 'Leçon 2: خانواده و توصیف افراد' },
  { page: 14, label: 'Leçon 3: روزها، ماه‌ها، ساعت و میز غذا' },
  { page: 18, label: 'Leçon 4: شهر، آدرس و خانه' },
  { page: 22, label: 'Leçon 5: تأسیسات خانه و تعمیرات' },
  { page: 26, label: 'Leçon 6: ساختمان، همسایه و حیوانات' },
  { page: 30, label: 'Leçon 7: دانشگاه و درس' },
  { page: 34, label: 'Leçon 8: برنامه روزانه' },
  { page: 38, label: 'Leçon 9: محیط کار و اداره' },
  { page: 42, label: 'Leçon 10: رنگ‌ها، لباس و جنس' },
  { page: 46, label: 'Leçon 11: میوه، سبزی و رستوران' },
  { page: 50, label: 'Leçon 12: نانوایی و آشپزی' },
  { page: 54, label: 'Leçon 13: بدن و بیماری' },
  { page: 58, label: 'Leçon 14: داروخانه و درمان' },
  { page: 62, label: 'Leçon 15: حمل‌ونقل شهری' },
  { page: 66, label: 'Leçon 16: قطار و رانندگی' },
  { page: 70, label: 'Leçon 17: فرودگاه و مدارک سفر' },
  { page: 74, label: 'Leçon 18: هتل و رزرو اتاق' },
  { page: 78, label: 'Leçon 19: اوقات فراغت، آب‌وهوا و ورزش' },
  { page: 82, label: 'Leçon 20: فرهنگ، سینما، موزه و خرید' },
  { page: 86, label: 'Corrigés & Transcriptions (پاسخ‌نامه و متن فایل‌های صوتی)' }
];

function initBookView() {
  if (!state.book) {
    state.book = {
      currentPage: 1,
      totalPages: 153,
      zoom: 1.0,
      fitWidth: true,
      currentTrack: 1,
      isPlaying: false,
      trackSpeed: 1.0,
      sideDockTab: 'ai'
    };
  }

  populateLessonJumpSelect();
  renderAudioTracksList();
  setupBookAudio();
  setupBookSideDock();
  loadBookPdf();
}

function populateLessonJumpSelect() {
  const select = document.getElementById('pdfLessonJumpSelect');
  if (!select || select.options.length > 1) return;

  BOOK_LESSON_PAGES.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.page;
    opt.textContent = `صفحه ${item.page}: ${item.label}`;
    select.appendChild(opt);
  });
}

const ARVAN_PDF_URL = 'https://france.s3.ir-thr-at1.arvanstorage.ir/Communication%20essentielle%20du%20franc%CC%A7ais%20A1.pdf?versionId=';
const IDB_PDF_DB = 'FrancaisFacilePDF_DB';
const IDB_PDF_STORE = 'files';
const IDB_PDF_KEY = 'a1_book_data';

let currentPdfRenderTask = null;

function openPdfIdb() {
  if (!('indexedDB' in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_PDF_DB, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_PDF_STORE)) {
          db.createObjectStore(IDB_PDF_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

async function getSavedPdfFromIdb() {
  const db = await openPdfIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_PDF_STORE, 'readonly');
      const store = tx.objectStore(IDB_PDF_STORE);
      const req = store.get(IDB_PDF_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

async function savePdfToIdb(data) {
  const db = await openPdfIdb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_PDF_STORE, 'readwrite');
      const store = tx.objectStore(IDB_PDF_STORE);
      store.put(data, IDB_PDF_KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

async function loadBookPdf() {
  if (bookPdfDoc) {
    renderBookPage(state.book.currentPage || 1);
    return;
  }

  const overlay = document.getElementById('pdfLoadingOverlay');
  if (overlay) {
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div class="fc-ai-spinner" style="width: 36px; height: 36px; border-width: 3px;"></div>
      <div class="pdf-loading-text" id="pdfLoadingText">در حال بررسی و بارگذاری کتاب فرانسوی...</div>
    `;
  }
  const loadingText = document.getElementById('pdfLoadingText');

  if (typeof pdfjsLib === 'undefined') {
    showPdfError('کتابخانه PDF.js بارگذاری نشد. لطفاً اتصال اینترنت خود را بررسی کنید.');
    return;
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  // 1. Check if already stored in IndexedDB (Ultra fast offline)
  try {
    const cachedData = await getSavedPdfFromIdb();
    if (cachedData) {
      if (loadingText) loadingText.textContent = 'در حال باز کردن کتاب از حافظه آفلاین مرورگر...';
      const loadingTask = pdfjsLib.getDocument({
        data: cachedData,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true
      });
      bookPdfDoc = await loadingTask.promise;
      finishPdfLoading();
      return;
    }
  } catch (errIdb) {
    console.warn('IDB PDF check failed:', errIdb);
  }

  // 2. Try URL sources
  const sources = [
    { name: 'سرور ابری آروان', url: ARVAN_PDF_URL },
    { name: 'فایل محلی book.pdf', url: './book.pdf' },
    { name: 'فایل اصلی کتاب', url: encodeURI('Communication essentielle du français A1.pdf') }
  ];

  let lastErr = null;

  for (const src of sources) {
    try {
      if (loadingText) loadingText.textContent = `در حال دریافت کتاب از ${src.name}...`;

      const response = await fetch(src.url);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);

      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer && arrayBuffer.byteLength > 1000) {
        // Cache in IDB for instant future access
        savePdfToIdb(arrayBuffer).catch(() => {});

        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
          cMapPacked: true
        });
        bookPdfDoc = await loadingTask.promise;
        finishPdfLoading();
        return;
      }
    } catch (err) {
      console.warn(`Load from ${src.name} failed:`, err);
      lastErr = err;
    }
  }

  showPdfError(lastErr?.message || 'عدم امکان دریافت خودکار به دلیل تنظیمات CORS سرور یا آفلاین بودن');
}

function showPdfError(errMsg) {
  const overlay = document.getElementById('pdfLoadingOverlay');
  if (!overlay) return;

  overlay.innerHTML = `
    <div style="text-align: center; padding: 28px 22px; max-width: 480px; color: #ffffff;">
      <div style="font-size: 2.8rem; margin-bottom: 12px;">📖✨</div>
      <div style="font-weight: 800; font-size: 1.2rem; margin-bottom: 8px; color: #f87171;">بارگذاری فایل کتاب PDF</div>
      <div style="font-size: 0.88rem; color: #cbd5e1; line-height: 1.6; margin-bottom: 20px;">
        برای اجرای بدون محدودیت و کارکرد ۱۰۰٪ آفلاین، لطفاً فایل PDF کتاب را یک‌بار از روی سیستم انتخاب نمایید (به صورت دائمی در مرورگر ذخیره خواهد شد).
      </div>
      <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
        <button class="btn btn-primary" id="manualSelectPdfBtn" style="padding: 12px 20px; font-weight: 700; font-size: 0.95rem;">
          📁 انتخاب فایل کتاب (PDF) از سیستم
        </button>
        <button class="btn btn-secondary btn-sm" id="retryPdfBtn">
          🔄 تلاش مجدد از سرور آروان
        </button>
        <input type="file" id="manualPdfFileInput" accept="application/pdf,.pdf" hidden>
      </div>
    </div>
  `;

  const retryBtn = document.getElementById('retryPdfBtn');
  if (retryBtn) retryBtn.onclick = () => loadBookPdf();

  const manualBtn = document.getElementById('manualSelectPdfBtn');
  const fileInput = document.getElementById('manualPdfFileInput');
  if (manualBtn && fileInput) {
    manualBtn.onclick = () => fileInput.click();
    fileInput.onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (overlay) {
        overlay.innerHTML = `
          <div class="fc-ai-spinner" style="width: 36px; height: 36px; border-width: 3px;"></div>
          <div class="pdf-loading-text">در حال پردازش و ذخیره کتاب در حافظه مرورگر...</div>
        `;
      }
      try {
        const arrayBuffer = await file.arrayBuffer();
        await savePdfToIdb(arrayBuffer);
        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
          cMapPacked: true
        });
        bookPdfDoc = await loadingTask.promise;
        finishPdfLoading();
        showToast('کتاب با موفقیت در حافظه مرورگر ذخیره شد ✨');
      } catch (err) {
        console.error('Manual PDF load error:', err);
        showPdfError(err.message || 'فایل انتخابی نامعتبر است');
      }
    };
  }
}

function finishPdfLoading() {
  if (!bookPdfDoc) return;
  state.book.totalPages = bookPdfDoc.numPages;
  const totalEl = document.getElementById('pdfTotalPages');
  if (totalEl) totalEl.textContent = bookPdfDoc.numPages;

  const pageInput = document.getElementById('pdfPageInput');
  if (pageInput) pageInput.max = bookPdfDoc.numPages;

  const overlay = document.getElementById('pdfLoadingOverlay');
  if (overlay) overlay.style.display = 'none';

  renderBookPage(state.book.currentPage || 1);
}

async function renderBookPage(pageNum) {
  if (!bookPdfDoc) return;
  pageNum = Math.max(1, Math.min(pageNum, bookPdfDoc.numPages));
  state.book.currentPage = pageNum;
  saveState();

  const pageInput = document.getElementById('pdfPageInput');
  if (pageInput) pageInput.value = pageNum;

  const prevBtn = document.getElementById('pdfPrevPageBtn');
  const nextBtn = document.getElementById('pdfNextPageBtn');
  if (prevBtn) prevBtn.disabled = pageNum <= 1;
  if (nextBtn) nextBtn.disabled = pageNum >= bookPdfDoc.numPages;

  const zoomText = document.getElementById('pdfZoomLevel');

  // Cancel any active render task
  if (currentPdfRenderTask) {
    try {
      currentPdfRenderTask.cancel();
    } catch (e) {}
    currentPdfRenderTask = null;
  }

  try {
    const page = await bookPdfDoc.getPage(pageNum);
    const canvas = document.getElementById('pdfRenderCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const viewportWrapper = document.getElementById('bookPdfViewport');
    const containerWidth = viewportWrapper ? (viewportWrapper.clientWidth - 48) : 800;

    let scale = state.book.zoom || 1.0;
    if (state.book.fitWidth && containerWidth > 320) {
      const baseViewport = page.getViewport({ scale: 1.0 });
      scale = Math.max(0.5, containerWidth / baseViewport.width);
      state.book.zoom = scale;
    }
    if (zoomText) zoomText.textContent = `${Math.round(scale * 100)}%`;

    const dpr = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: scale * dpr });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    currentPdfRenderTask = page.render(renderContext);
    await currentPdfRenderTask.promise;
    currentPdfRenderTask = null;
  } catch (err) {
    if (err && err.name !== 'RenderingCancelledException') {
      console.error('Error during PDF rendering:', err);
    }
  }

  updateBookAiDockForPage(pageNum);
}

function changeBookPage(deltaOrNum) {
  if (!bookPdfDoc) return;
  let target;
  if (typeof deltaOrNum === 'number') {
    target = deltaOrNum;
  } else {
    target = (state.book.currentPage || 1) + (deltaOrNum === 'next' ? 1 : -1);
  }
  renderBookPage(target);
}

function zoomBookPdf(direction) {
  state.book.fitWidth = false;
  const current = state.book.zoom || 1.0;
  let next = direction === 'in' ? current + 0.15 : current - 0.15;
  next = Math.max(0.5, Math.min(next, 3.0));
  state.book.zoom = next;
  renderBookPage(state.book.currentPage || 1);
}

function fitBookPdfWidth() {
  state.book.fitWidth = true;
  renderBookPage(state.book.currentPage || 1);
}

function updateBookAiDockForPage(pageNum) {
  const heading = document.getElementById('dockAiHeading');
  const emptyBox = document.getElementById('dockAiEmpty');
  const bodyBox = document.getElementById('dockAiBody');

  if (heading) heading.textContent = `تحلیل و تدریس صفحه ${pageNum}`;

  const cached = state.aiPageExplanations ? state.aiPageExplanations[pageNum] : null;

  if (cached) {
    if (emptyBox) emptyBox.style.display = 'none';
    if (bodyBox) {
      bodyBox.style.display = 'block';
      bodyBox.innerHTML = typeof marked !== 'undefined' ? marked.parse(cached) : cached;
    }
  } else {
    if (emptyBox) emptyBox.style.display = 'flex';
    if (bodyBox) {
      bodyBox.style.display = 'none';
      bodyBox.innerHTML = '';
    }
  }
}

async function explainCurrentBookPageWithAi({ forceRefresh = false } = {}) {
  const pageNum = state.book.currentPage || 1;
  const emptyBox = document.getElementById('dockAiEmpty');
  const bodyBox = document.getElementById('dockAiBody');

  if (!forceRefresh && state.aiPageExplanations && state.aiPageExplanations[pageNum]) {
    updateBookAiDockForPage(pageNum);
    switchBookDockTab('ai');
    return;
  }

  // Switch to AI tab
  switchBookDockTab('ai');

  const key = await ensureOpenRouterKey();
  const model = state.openRouterModel || 'openai/gpt-4o-mini';

  if (emptyBox) {
    emptyBox.style.display = 'flex';
    emptyBox.innerHTML = `
      <div class="fc-ai-spinner" style="width: 32px; height: 32px; border-width: 3px;"></div>
      <h4 style="margin-top: 14px;">در حال تحلیل تصویر صفحه ${pageNum} و تدریس هوشمند با AI...</h4>
      <p style="font-size: 0.85rem; color: var(--text-muted);">لطفاً چند لحظه صبر کنید تا درس‌نامه، مکالمات، گرامر و پاسخ تمرینات آماده شود.</p>
    `;
  }
  if (bodyBox) bodyBox.style.display = 'none';

  try {
    const canvas = document.getElementById('pdfRenderCanvas');
    if (!canvas) throw new Error('صفحه کتاب هنوز رندر نشده است');

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

    const systemPrompt = `You are a master French professor and native pedagogical tutor explaining the textbook "Communication essentielle du français A1" for Persian (Farsi) native speakers.
Analyze the provided high-resolution book page image in detail.

Generate a comprehensive, clear, beautifully structured study guide in Persian (Farsi) using clean Markdown:
1. 🎯 **موضوع و هدف درس (Sujet & Objectif):** خلاصه عنوان، درس و هدف آموزشی این صفحه.
2. 💬 **داستان مکالمات و ترجمه روان (Dialogues & Traduction):** اگر مکالمه یا متنی در صفحه است، متن فرانسوی را آورده و ترجمه سلیس و دقیق فارسی آن را همراه با نکات تلفظی یا فرهنگی توضیح دهید.
3. 📐 **نکات و قواعد گرامری (Grammaire & Règles):** قواعد دستوری مطرح شده در صفحه (صرف افعال، حروف اضافه، مذکر/مؤنث، ساختار جملات) را با مثال‌های شفاف شرح دهید.
4. 📚 **واژگان و اصطلاحات کلیدی (Vocabulaire Essentiel):** جدول یا لیست واژگان مهم صفحه همراه با ترجمه فارسی و جنسیت (le/la).
5. ✏️ **حل و توضیح تمرینات (Exercices & Solutions):** اگر تمرینی در صفحه وجود دارد، نحوه حل و پاسخ درست آن را توضیح دهید.

Rules:
- Write in warm, encouraging, fluent Persian.
- Format with clear Markdown headings (###), bullet points, and clean tables or blockquotes.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: `لطفاً صفحه ${pageNum} از کتاب Communication essentielle du français A1 را با جزئیات کامل برای من تدریس و تشریح کنید.` },
          { type: 'image_url', image_url: { url: dataUrl } }
        ]
      }
    ];

    let response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin || 'http://localhost',
        'X-Title': 'FrancaisFacile'
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages
      })
    });

    let payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error?.message || 'خطا در ارتباط با هوش مصنوعی');
    }

    const explanation = payload.choices?.[0]?.message?.content || '';
    if (!state.aiPageExplanations) state.aiPageExplanations = {};
    state.aiPageExplanations[pageNum] = explanation;
    saveState();

    updateBookAiDockForPage(pageNum);
    showToast(`تدریس صفحه ${pageNum} با موفقیت آماده شد ✨`);
  } catch (err) {
    console.error('AI Page Analysis failed:', err);
    updateBookAiDockForPage(pageNum);
    if (err.message !== 'کلید OpenRouter تنظیم نشد') {
      showToast(err.message || 'خطا در تحلیل صفحه با AI');
    }
  }
}

// ---------------------------------------------------------------------------
// Book Audio Engine & Playlist
// ---------------------------------------------------------------------------
function setupBookAudio() {
  if (!bookAudio) {
    bookAudio = new Audio();
    bookAudio.preload = 'metadata';

    bookAudio.addEventListener('timeupdate', () => {
      if (!bookAudioDuration && bookAudio.duration) {
        bookAudioDuration = bookAudio.duration;
      }
      const cur = bookAudio.currentTime || 0;
      const dur = bookAudio.duration || bookAudioDuration || 0;

      const curEl = document.getElementById('playerCurrentTime');
      const totalEl = document.getElementById('playerTotalTime');
      const seek = document.getElementById('playerSeekSlider');

      if (curEl) curEl.textContent = formatAudioTime(cur);
      if (totalEl) totalEl.textContent = formatAudioTime(dur);
      if (seek && dur > 0) {
        seek.value = (cur / dur) * 100;
      }
    });

    bookAudio.addEventListener('play', () => {
      state.book.isPlaying = true;
      updatePlayPauseButtonUi(true);
      updateActiveTrackInList(state.book.currentTrack);
    });

    bookAudio.addEventListener('pause', () => {
      state.book.isPlaying = false;
      updatePlayPauseButtonUi(false);
    });

    bookAudio.addEventListener('ended', () => {
      state.book.isPlaying = false;
      updatePlayPauseButtonUi(false);
      // Auto play next track
      if (state.book.currentTrack < TOTAL_AUDIO_TRACKS) {
        playAudioTrack(state.book.currentTrack + 1, true);
      }
    });

    bookAudio.addEventListener('error', (e) => {
      console.warn('Audio playback error, trying local fallback...', e);
      const track = state.book.currentTrack;
      if (!bookAudio.src.includes('/audio/')) {
        bookAudio.src = `./audio/piste${track}.mp3`;
        bookAudio.play().catch(() => {});
      } else {
        showToast(`خطا در پخش فایل صوتی piste ${track}`);
      }
    });
  }
}

function formatAudioTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updatePlayPauseButtonUi(isPlaying) {
  const playIcon = document.querySelector('#playerPlayPauseBtn .play-icon');
  const pauseIcon = document.querySelector('#playerPlayPauseBtn .pause-icon');
  if (playIcon) playIcon.style.display = isPlaying ? 'none' : 'block';
  if (pauseIcon) pauseIcon.style.display = isPlaying ? 'block' : 'none';

  const subEl = document.getElementById('currentTrackSub');
  if (subEl) {
    subEl.textContent = isPlaying ? 'در حال پخش...' : 'متوقف شد';
  }
}

function renderAudioTracksList(filterQuery = '') {
  const list = document.getElementById('audioTracksList');
  if (!list) return;

  const q = (filterQuery || '').trim().toLowerCase();
  const current = state.book.currentTrack || 1;

  let tracks = [];
  for (let i = 1; i <= TOTAL_AUDIO_TRACKS; i++) {
    const name = `piste ${i}`;
    const file = `piste${i}.mp3`;
    if (!q || name.includes(q) || String(i) === q || file.includes(q)) {
      tracks.push(i);
    }
  }

  const countEl = document.getElementById('dockAudioCount');
  if (countEl) countEl.textContent = tracks.length;

  if (tracks.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:0.85rem;">هیچ تراک صوتی با این شماره یافت نشد.</div>`;
    return;
  }

  list.innerHTML = tracks.map(num => {
    const isActive = num === current;
    const isPlaying = isActive && state.book.isPlaying;
    return `
      <div class="audio-track-item ${isActive ? 'is-active' : ''} ${isPlaying ? 'is-playing' : ''}" data-track="${num}">
        <div class="track-num-badge">#${num}</div>
        <div class="track-info-col">
          <div class="track-title" dir="ltr">piste${num}.mp3</div>
          <div class="track-desc">فایل صوتی شماره ${num} کتاب A1</div>
        </div>
        <button class="track-play-btn" data-track="${num}" title="پخش این فایل">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </button>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.audio-track-item').forEach(item => {
    item.onclick = () => {
      const num = parseInt(item.dataset.track, 10);
      playAudioTrack(num, true);
    };
  });
}

function updateActiveTrackInList(trackNum) {
  document.querySelectorAll('.audio-track-item').forEach(item => {
    const num = parseInt(item.dataset.track, 10);
    const isActive = num === trackNum;
    item.classList.toggle('is-active', isActive);
    item.classList.toggle('is-playing', isActive && state.book.isPlaying);
  });
}

function playAudioTrack(trackNum, autoPlay = true) {
  trackNum = Math.max(1, Math.min(trackNum, TOTAL_AUDIO_TRACKS));
  state.book.currentTrack = trackNum;
  saveState();

  setupBookAudio();

  const titleEl = document.getElementById('currentTrackName');
  if (titleEl) titleEl.textContent = `piste${trackNum}.mp3`;

  const audioUrl = `${ARVAN_AUDIO_BASE}piste${trackNum}.mp3`;
  bookAudio.src = audioUrl;
  bookAudio.playbackRate = state.book.trackSpeed || 1.0;

  updateActiveTrackInList(trackNum);

  if (autoPlay) {
    bookAudio.play().then(() => {
      updatePlayPauseButtonUi(true);
    }).catch(err => {
      console.warn('AutoPlay blocked or failed, trying fallback...', err);
    });
  }
}

function toggleAudioPlayPause() {
  setupBookAudio();
  if (!bookAudio.src || bookAudio.src.endsWith('/')) {
    playAudioTrack(state.book.currentTrack || 1, true);
    return;
  }

  if (bookAudio.paused) {
    bookAudio.play().catch(() => {});
  } else {
    bookAudio.pause();
  }
}

function seekAudioTrack(percent) {
  if (!bookAudio || !bookAudio.duration) return;
  bookAudio.currentTime = (percent / 100) * bookAudio.duration;
}

function skipAudioSeconds(delta) {
  if (!bookAudio) return;
  bookAudio.currentTime = Math.max(0, Math.min(bookAudio.currentTime + delta, bookAudio.duration || 9999));
}

function cycleAudioSpeed() {
  const speeds = [0.8, 1.0, 1.2, 1.5];
  const cur = state.book.trackSpeed || 1.0;
  const idx = (speeds.indexOf(cur) + 1) % speeds.length;
  const next = speeds[idx];
  state.book.trackSpeed = next;
  saveState();

  if (bookAudio) bookAudio.playbackRate = next;

  const badge = document.getElementById('playerSpeedBadge');
  const label = document.getElementById('playerSpeedLabel');
  if (badge) badge.textContent = `${next}x`;
  if (label) label.textContent = `${next}x`;
  showToast(`سرعت پخش صوت: ${next}x`);
}

function switchBookDockTab(tabName) {
  state.book.sideDockTab = tabName;
  saveState();

  document.querySelectorAll('.dock-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.dock === tabName);
  });
  document.querySelectorAll('.dock-pane').forEach(p => {
    p.classList.toggle('active', p.id === (tabName === 'ai' ? 'dockPaneAi' : 'dockPaneAudio'));
  });
}

function setupBookSideDock() {
  document.querySelectorAll('.dock-tab').forEach(t => {
    t.onclick = () => switchBookDockTab(t.dataset.dock);
  });
}

function toggleBookFullscreen(forceState) {
  const pane = document.querySelector('.book-pdf-pane');
  if (!pane) return;

  const isCurrentlyFs = pane.classList.contains('is-fullscreen');
  const targetFs = typeof forceState === 'boolean' ? forceState : !isCurrentlyFs;

  pane.classList.toggle('is-fullscreen', targetFs);

  const enterIcon = document.querySelector('#pdfFullscreenBtn .fs-enter-icon');
  const exitIcon = document.querySelector('#pdfFullscreenBtn .fs-exit-icon');
  const label = document.getElementById('pdfFullscreenLabel');
  if (enterIcon) enterIcon.style.display = targetFs ? 'none' : 'block';
  if (exitIcon) exitIcon.style.display = targetFs ? 'block' : 'none';
  if (label) label.textContent = targetFs ? 'خروج' : 'تمام‌صفحه';

  // Request/exit native browser fullscreen
  if (targetFs) {
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    showToast('حالت تمام‌صفحه فعال شد (کلید F یا Esc برای خروج)');
  } else {
    if (document.exitFullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  // Smoothly adjust zoom to new dimensions
  setTimeout(() => {
    fitBookPdfWidth();
  }, 120);
}

function setupBookEventListeners() {
  const prevBtn = document.getElementById('pdfPrevPageBtn');
  const nextBtn = document.getElementById('pdfNextPageBtn');
  const pageInput = document.getElementById('pdfPageInput');
  const lessonSelect = document.getElementById('pdfLessonJumpSelect');
  const zoomInBtn = document.getElementById('pdfZoomInBtn');
  const zoomOutBtn = document.getElementById('pdfZoomOutBtn');
  const fitWidthBtn = document.getElementById('pdfFitWidthBtn');
  const fullscreenBtn = document.getElementById('pdfFullscreenBtn');
  const analyzeBtn = document.getElementById('bookAiAnalyzePageBtn');
  const dockAnalyzeBtn = document.getElementById('dockAiAnalyzeBtn');
  const refreshAiBtn = document.getElementById('dockAiRefreshBtn');
  const copyAiBtn = document.getElementById('dockAiCopyBtn');
  const toggleAudioPanelBtn = document.getElementById('toggleBookAudioPanelBtn');

  if (prevBtn) prevBtn.onclick = () => changeBookPage('prev');
  if (nextBtn) nextBtn.onclick = () => changeBookPage('next');
  if (pageInput) {
    pageInput.onchange = () => {
      const p = parseInt(pageInput.value, 10);
      if (!isNaN(p)) changeBookPage(p);
    };
  }
  if (lessonSelect) {
    lessonSelect.onchange = () => {
      const p = parseInt(lessonSelect.value, 10);
      if (!isNaN(p)) {
        changeBookPage(p);
        lessonSelect.value = '';
      }
    };
  }
  if (zoomInBtn) zoomInBtn.onclick = () => zoomBookPdf('in');
  if (zoomOutBtn) zoomOutBtn.onclick = () => zoomBookPdf('out');
  if (fitWidthBtn) fitWidthBtn.onclick = fitBookPdfWidth;
  if (fullscreenBtn) fullscreenBtn.onclick = () => toggleBookFullscreen();

  if (analyzeBtn) analyzeBtn.onclick = () => explainCurrentBookPageWithAi();
  if (dockAnalyzeBtn) dockAnalyzeBtn.onclick = () => explainCurrentBookPageWithAi();
  if (refreshAiBtn) refreshAiBtn.onclick = () => explainCurrentBookPageWithAi({ forceRefresh: true });

  if (copyAiBtn) {
    copyAiBtn.onclick = () => {
      const pageNum = state.book.currentPage || 1;
      const text = state.aiPageExplanations ? state.aiPageExplanations[pageNum] : '';
      if (text) {
        navigator.clipboard.writeText(text).then(() => {
          showToast('متن تدریس کپی شد 📋');
        }).catch(() => {
          showToast('کپی انجام نشد');
        });
      }
    };
  }

  if (toggleAudioPanelBtn) {
    toggleAudioPanelBtn.onclick = () => {
      switchBookDockTab('audio');
    };
  }

  // Audio Player Controls
  const playPauseBtn = document.getElementById('playerPlayPauseBtn');
  const prevTrackBtn = document.getElementById('playerPrevTrackBtn');
  const nextTrackBtn = document.getElementById('playerNextTrackBtn');
  const rewind5Btn = document.getElementById('playerRewind5Btn');
  const forward5Btn = document.getElementById('playerForward5Btn');
  const speedBtn = document.getElementById('playerSpeedCycleBtn');
  const seekSlider = document.getElementById('playerSeekSlider');
  const audioSearch = document.getElementById('audioTrackSearchInput');

  if (playPauseBtn) playPauseBtn.onclick = toggleAudioPlayPause;
  if (prevTrackBtn) prevTrackBtn.onclick = () => playAudioTrack((state.book.currentTrack || 1) - 1, true);
  if (nextTrackBtn) nextTrackBtn.onclick = () => playAudioTrack((state.book.currentTrack || 1) + 1, true);
  if (rewind5Btn) rewind5Btn.onclick = () => skipAudioSeconds(-5);
  if (forward5Btn) forward5Btn.onclick = () => skipAudioSeconds(5);
  if (speedBtn) speedBtn.onclick = cycleAudioSpeed;
  if (seekSlider) {
    seekSlider.oninput = () => seekAudioTrack(parseFloat(seekSlider.value));
  }
  if (audioSearch) {
    audioSearch.oninput = () => renderAudioTracksList(audioSearch.value);
  }

  // Window resize handler for PDF fit width
  window.addEventListener('resize', () => {
    if (state.currentView === 'book' && state.book.fitWidth) {
      renderBookPage(state.book.currentPage || 1);
    }
  });

  // Native fullscreen exit sync
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      const pane = document.querySelector('.book-pdf-pane');
      if (pane && pane.classList.contains('is-fullscreen')) {
        toggleBookFullscreen(false);
      }
    }
  });

  // Keyboard navigation for PDF reader (Left/Right arrow, F for fullscreen, Esc to exit)
  window.addEventListener('keydown', (e) => {
    if (state.currentView !== 'book') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      changeBookPage('next');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      changeBookPage('prev');
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      toggleBookFullscreen();
    } else if (e.key === 'Escape') {
      const pane = document.querySelector('.book-pdf-pane');
      if (pane && pane.classList.contains('is-fullscreen')) {
        e.preventDefault();
        toggleBookFullscreen(false);
      }
    }
  });
}

// ==========================================================================
// 11. PWA ENGINE & FIRST-TIME INSTALL PROMPT
// ==========================================================================
let deferredInstallPrompt = null;

function setupPwaEngine() {
  // 1. Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          console.log('PWA ServiceWorker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('PWA ServiceWorker registration failed:', err);
        });
    });
  }

  const installModal = document.getElementById('pwaInstallModalOverlay');
  const installBtn = document.getElementById('pwaInstallActionBtn');
  const dismissBtn = document.getElementById('pwaInstallDismissBtn');
  const closeBtn = document.getElementById('pwaInstallCloseBtn');
  const sidebarBtn = document.getElementById('sidebarInstallPwaBtn');
  const iosInstruct = document.getElementById('pwaIosInstructions');

  const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator.standalone === true);

  if (isStandalone) {
    if (sidebarBtn) sidebarBtn.style.display = 'none';
    return;
  }

  if (isIos && iosInstruct) {
    iosInstruct.style.display = 'block';
    if (installBtn) installBtn.style.display = 'none';
  }

  function showInstallModal() {
    if (installModal) {
      installModal.style.display = 'flex';
    }
  }

  function hideInstallModal() {
    if (installModal) {
      installModal.style.display = 'none';
    }
    sessionStorage.setItem('ff_pwa_dismissed', 'true');
  }

  if (closeBtn) closeBtn.onclick = hideInstallModal;
  if (dismissBtn) dismissBtn.onclick = hideInstallModal;
  if (installModal) {
    installModal.onclick = (e) => {
      if (e.target === installModal) hideInstallModal();
    };
  }

  if (sidebarBtn) {
    sidebarBtn.onclick = () => {
      showInstallModal();
    };
  }

  if (installBtn) {
    installBtn.onclick = async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const choiceResult = await deferredInstallPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          localStorage.setItem('ff_pwa_installed', 'true');
          showToast('🎉 در حال نصب اپلیکیشن...');
          triggerConfetti();
        }
        deferredInstallPrompt = null;
      } else {
        showToast('برای نصب، از منوی مرورگر (سه نقطه) گزینه Install یا Add to Home screen را بزنید.');
      }
      hideInstallModal();
    };
  }

  // Capture beforeinstallprompt (Android / Chrome / Edge)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;

    const alreadyInstalled = localStorage.getItem('ff_pwa_installed') === 'true';
    const dismissedThisSession = sessionStorage.getItem('ff_pwa_dismissed') === 'true';

    // Show popup on first open (with smooth 1.8s delay)
    if (!alreadyInstalled && !dismissedThisSession && !isStandalone) {
      setTimeout(() => {
        showInstallModal();
      }, 1800);
    }
  });

  // If on iOS or browsers without beforeinstallprompt, trigger first-time guide once
  const firstVisitSeen = localStorage.getItem('ff_first_visit_prompt_seen');
  if (!firstVisitSeen && !isStandalone && isIos) {
    localStorage.setItem('ff_first_visit_prompt_seen', 'true');
    setTimeout(() => {
      showInstallModal();
    }, 2000);
  }

  // App Installed Celebration
  window.addEventListener('appinstalled', () => {
    localStorage.setItem('ff_pwa_installed', 'true');
    if (sidebarBtn) sidebarBtn.style.display = 'none';
    hideInstallModal();
    showToast('🎉 FrançaisFacile با موفقیت روی دستگاه شما نصب شد!');
    triggerConfetti();
  });
}

function initApp() {
  document.body.className = state.theme === 'dark' ? 'theme-dark' : 'theme-light';
  restoreUiFromState();

  if (!state.openRouterKey && window.FF_OPENROUTER_KEY) {
    state.openRouterKey = window.FF_OPENROUTER_KEY;
  }

  updateStreak();
  updateHeaderStats();
  updateContentCounts();

  // Navigation click listeners
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.view);
    });
  });

  // Mobile Menu Toggle
  document.getElementById('mobileMenuBtn').onclick = () => {
    document.getElementById('appSidebar').classList.add('open');
  };
  document.getElementById('closeSidebarBtn').onclick = () => {
    document.getElementById('appSidebar').classList.remove('open');
  };

  // Theme Toggle Button
  document.getElementById('themeToggleBtn').onclick = () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    document.body.className = state.theme === 'dark' ? 'theme-dark' : 'theme-light';
    saveState();
    showToast(state.theme === 'dark' ? 'حالت شب فعال شد 🌙' : 'حالت روز فعال شد ☀️');
  };

  // Audio Speed Toggle Button
  const speedBtn = document.getElementById('audioSpeedBtn');
  const speeds = [0.8, 1.0, 1.2];
  speedBtn.onclick = () => {
    const currentIdx = speeds.indexOf(state.audioSpeed);
    const nextIdx = (currentIdx + 1) % speeds.length;
    state.audioSpeed = speeds[nextIdx];
    saveState();
    showToast(`سرعت تلفظ صوتی: ${state.audioSpeed}x`);
  };

  // Dashboard Buttons
  document.getElementById('dashStartDailyBtn').onclick = () => {
    switchView('quiz');
    startQuiz('mcq');
  };
  document.getElementById('dashFlashcardsBtn').onclick = () => {
    state.flashcards.screen = 'browser';
    switchView('flashcards');
  };
  const dashBookBtn = document.getElementById('dashBookBtn');
  if (dashBookBtn) {
    dashBookBtn.onclick = () => switchView('book');
  }

  // Dashboard Category Cards
  document.querySelectorAll('.cat-enter-btn, .category-card').forEach(el => {
    el.onclick = () => {
      const cat = el.dataset.cat;
      if (cat === 'sentences') {
        switchView('sentences');
      } else if (cat === 'grammar') {
        switchView('grammar');
      } else {
        state.vocab.category = cat;
        switchView('vocab');
        // sync category tab
        document.querySelectorAll('#vocabCategoryTabs .tab-chip').forEach(t => {
          t.classList.toggle('active', t.dataset.cat === cat);
        });
      }
    };
  });

  // Dashboard Quick Modes
  document.getElementById('quickModeListening').onclick = () => {
    switchView('quiz');
    startQuiz('listening');
  };
  document.getElementById('quickModeGender').onclick = () => {
    switchView('quiz');
    startQuiz('gender');
  };
  document.getElementById('quickModeMatch').onclick = () => switchView('matchgame');

  // Vocab Category Filter Tabs
  document.querySelectorAll('#vocabCategoryTabs .tab-chip').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('#vocabCategoryTabs .tab-chip').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.vocab.category = tab.dataset.cat;
      saveState();
      renderVocabGrid();
    };
  });

  // Vocab Search & Gender Filter
  const vocabSearch = document.getElementById('vocabSearchInput');
  const clearSearchBtn = document.getElementById('vocabClearSearch');
  vocabSearch.oninput = () => {
    state.vocab.searchQuery = vocabSearch.value;
    clearSearchBtn.style.display = vocabSearch.value ? 'block' : 'none';
    renderVocabGrid();
  };
  clearSearchBtn.onclick = () => {
    vocabSearch.value = '';
    state.vocab.searchQuery = '';
    clearSearchBtn.style.display = 'none';
    renderVocabGrid();
  };

  document.getElementById('vocabGenderFilter').onchange = (e) => {
    state.vocab.gender = e.target.value;
    saveState();
    renderVocabGrid();
  };

  document.getElementById('vocabResetFiltersBtn').onclick = () => {
    state.vocab.category = 'all';
    state.vocab.gender = 'all';
    state.vocab.searchQuery = '';
    vocabSearch.value = '';
    document.getElementById('vocabGenderFilter').value = 'all';
    document.querySelectorAll('#vocabCategoryTabs .tab-chip').forEach(t => t.classList.toggle('active', t.dataset.cat === 'all'));
    saveState();
    renderVocabGrid();
  };

  // Vocab Layout Toggle
  const gridBtn = document.getElementById('vocabViewGridBtn');
  const listBtn = document.getElementById('vocabViewListBtn');
  gridBtn.onclick = () => {
    gridBtn.classList.add('active');
    listBtn.classList.remove('active');
    state.vocab.viewMode = 'grid';
    saveState();
    renderVocabGrid();
  };
  listBtn.onclick = () => {
    listBtn.classList.add('active');
    gridBtn.classList.remove('active');
    state.vocab.viewMode = 'list';
    saveState();
    renderVocabGrid();
  };

  // Flashcards Interactions
  document.getElementById('mainFlashcard').onclick = flipFlashcard;
  document.getElementById('fcBtnFlip').onclick = (e) => {
    e.stopPropagation();
    flipFlashcard();
  };
  document.getElementById('fcBtnAgain').onclick = () => rateFlashcard('again');
  document.getElementById('fcBtnHard').onclick = () => rateFlashcard('hard');
  document.getElementById('fcBtnGood').onclick = () => rateFlashcard('good');
  document.getElementById('fcBtnKnow').onclick = () => rateFlashcard('easy');
  document.getElementById('flashcardBackToDecksBtn').onclick = backToFlashcardDecks;

  document.getElementById('flashcardShuffleBtn').onclick = shuffleFlashcardDeck;

  document.getElementById('flashcardFlipDirectionBtn').onclick = () => {
    state.flashcards.direction = state.flashcards.direction === 'fa-fr' ? 'fr-fa' : 'fa-fr';
    document.getElementById('flashcardDirectionLabel').textContent = state.flashcards.direction === 'fa-fr' ? 'فارسی ➔ فرانسوی' : 'فرانسوی ➔ فارسی';
    saveState();
    renderCurrentFlashcard();
  };

  // Flashcards Keyboard Shortcuts (Anki: Space, 1-4)
  window.addEventListener('keydown', (e) => {
    if (state.currentView !== 'flashcards') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if (e.key === 'Escape') {
      e.preventDefault();
      backToFlashcardDecks();
      return;
    }
    if (!isFlashcardStudyActive()) return;

    if (e.code === 'Space' || e.key === 'Enter') {
      e.preventDefault();
      if (!state.flashcards.isFlipped) flipFlashcard();
      else rateFlashcard('good');
    } else if (e.key === '1') {
      e.preventDefault();
      rateFlashcard('again');
    } else if (e.key === '2') {
      e.preventDefault();
      rateFlashcard('hard');
    } else if (e.key === '3') {
      e.preventDefault();
      rateFlashcard('good');
    } else if (e.key === '4') {
      e.preventDefault();
      rateFlashcard('easy');
    } else if (e.key.toLowerCase() === 's') {
      const item = state.flashcards.deck[state.flashcards.currentIndex];
      if (item) speakFrench(item.word);
    }
  });

  // Quiz Arena Buttons
  document.querySelectorAll('.start-quiz-btn').forEach(btn => {
    btn.onclick = () => startQuiz(btn.dataset.quizType);
  });
  document.getElementById('quizExitBtn').onclick = resetQuizView;
  document.getElementById('quizNextQuestionBtn').onclick = nextQuizQuestion;

  document.getElementById('quizResultRetryBtn').onclick = () => {
    document.getElementById('quizResultModalOverlay').style.display = 'none';
    startQuiz(state.quiz.type);
  };
  document.getElementById('quizResultDoneBtn').onclick = () => {
    document.getElementById('quizResultModalOverlay').style.display = 'none';
    resetQuizView();
  };

  // Sentence Topic Tabs
  document.querySelectorAll('#sentenceTopicTabs .tab-chip').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('#sentenceTopicTabs .tab-chip').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.sentences.topic = tab.dataset.topic;
      saveState();
      renderSentences();
    };
  });

  document.getElementById('sentenceSearchInput').oninput = (e) => {
    state.sentences.searchQuery = e.target.value;
    renderSentences();
  };

  document.getElementById('toggleHideTranslationsBtn').onclick = () => {
    state.sentences.hideTranslations = !state.sentences.hideTranslations;
    document.getElementById('hideTransText').textContent = state.sentences.hideTranslations ? 'نمایش مجدد ترجمه‌ها' : 'مخفی‌سازی ترجمه برای تست';
    saveState();
    renderSentences();
  };

  // Game Controls
  document.getElementById('gameRestartBtn').onclick = startMatchGame;
  document.getElementById('gameCatSelect').onchange = (e) => {
    state.game.category = e.target.value;
    saveState();
    startMatchGame();
  };

  const analyzeBtn = document.getElementById('importerAnalyzeBtn');
  const saveImportedBtn = document.getElementById('importerSaveBtn');
  const keyInput = document.getElementById('openRouterKeyInput');
  if (analyzeBtn) analyzeBtn.onclick = analyzeImportedSentence;
  if (saveImportedBtn) saveImportedBtn.onclick = saveImportedItems;
  if (keyInput) {
    keyInput.value = getOpenRouterKey();
    keyInput.onchange = () => {
      state.openRouterKey = keyInput.value.trim();
      saveState();
    };
  }

  const modelSelect = document.getElementById('openRouterModelSelect');
  if (modelSelect) {
    modelSelect.value = state.openRouterModel || modelSelect.value;
    modelSelect.onchange = () => {
      state.openRouterModel = modelSelect.value;
      saveState();
    };
  }

  // Export / Reset Progress
  document.getElementById('exportProgressBtn').onclick = () => {
    const snapshot = window.FFStorage.buildSnapshot(state);
    const safe = { ...snapshot, openRouterKey: snapshot.openRouterKey ? '[saved locally]' : '' };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(safe, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `francais_progress_${todayISO()}.json`);
    dlAnchor.click();
    showToast('فایل پشتیبان دانلود شد');
  };

  const importBtn = document.getElementById('importProgressBtn');
  const importFile = document.getElementById('importProgressFile');
  if (importBtn && importFile) {
    importBtn.onclick = () => importFile.click();
    importFile.onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        if (parsed.openRouterKey === '[saved locally]') delete parsed.openRouterKey;
        applyImportedSnapshot(parsed);
        await window.FFStorage.flush(state);
        restoreUiFromState();
        switchView('progress');
        showToast('پشتیبان با موفقیت بازیابی شد');
      } catch (err) {
        showToast('فایل پشتیبان معتبر نیست');
      }
      importFile.value = '';
    };
  }

  document.getElementById('resetProgressBtn').onclick = async () => {
    if (confirm('آیا مطمئن هستید که می‌خواهید تمام پیشرفت، امتیازات و لغات نشان‌شده را ریست کنید؟')) {
      await window.FFStorage.clearLearning(state);
      saveState();
      switchView('dashboard');
      showToast('اطلاعات با موفقیت ریست شد.');
    }
  };

  // Word Modal Close
  document.getElementById('wordModalCloseBtn').onclick = () => {
    document.getElementById('wordModalOverlay').style.display = 'none';
  };
  document.getElementById('wordModalOverlay').onclick = (e) => {
    if (e.target === document.getElementById('wordModalOverlay')) {
      document.getElementById('wordModalOverlay').style.display = 'none';
    }
  };

  // AI Key Modal Handlers
  const aiKeyCloseBtn = document.getElementById('aiKeyModalCloseBtn');
  const modalCancelAiKeyBtn = document.getElementById('modalCancelAiKeyBtn');
  const modalSaveAiKeyBtn = document.getElementById('modalSaveAiKeyBtn');
  const aiKeyModalOverlay = document.getElementById('aiKeyModalOverlay');
  if (aiKeyCloseBtn) aiKeyCloseBtn.onclick = () => closeAiKeyModal(true);
  if (modalCancelAiKeyBtn) modalCancelAiKeyBtn.onclick = () => closeAiKeyModal(true);
  if (modalSaveAiKeyBtn) modalSaveAiKeyBtn.onclick = saveAiKeyFromModal;
  if (aiKeyModalOverlay) {
    aiKeyModalOverlay.onclick = (e) => {
      if (e.target === aiKeyModalOverlay) closeAiKeyModal(true);
    };
  }

  // Image Lightbox Handlers
  const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');
  const imageLightboxOverlay = document.getElementById('imageLightboxOverlay');
  if (lightboxCloseBtn) lightboxCloseBtn.onclick = closeImageLightbox;
  if (imageLightboxOverlay) {
    imageLightboxOverlay.onclick = (e) => {
      if (e.target === imageLightboxOverlay) closeImageLightbox();
    };
  }

  // Setup Global Search
  setupGlobalSearch();

  // Setup Book & Audio Player Listeners
  setupBookEventListeners();

  // Setup PWA Installation & ServiceWorker
  setupPwaEngine();

  syncMasteredIdsFromFlashcardReviews();
  if (migrateMasteredFlashcardsToReviews()) {
    saveState();
  }

  const restoredView = state.currentView && state.currentView !== 'dashboard' ? state.currentView : 'dashboard';
  if (restoredView === 'dashboard') {
    renderDashboard();
  } else {
    switchView(restoredView);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (window.FFStorage) {
    await window.FFStorage.hydrate(state);
  }
  initApp();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && window.FFStorage) {
    window.FFStorage.flush(state);
  }
});

window.addEventListener('pagehide', () => {
  if (window.FFStorage) window.FFStorage.flush(state);
});

window.addEventListener('beforeunload', () => {
  if (window.FFStorage) window.FFStorage.flush(state);
});
