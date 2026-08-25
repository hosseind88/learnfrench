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
  activityDates: [],
  quizLog: [],
  lastQuizType: 'mcq',

  flashcards: {
    deck: [],
    currentIndex: 0,
    isFlipped: false,
    direction: 'fr-fa',
    category: 'all'
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
  if (viewName === 'vocab') renderVocabGrid();
  if (viewName === 'flashcards') setupFlashcards({ reset: false });
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
        state.masteredIds.delete(id);
        showToast('از لیست لغات مسلط شده حذف شد');
      } else {
        state.masteredIds.add(id);
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
// 3. FLASHCARDS ENGINE
// ==========================================================================
function setupFlashcards({ reset = true } = {}) {
  const allVocab = getAllVocabItems();
  let deck = [...allVocab];

  const cat = state.flashcards.category;
  if (cat === 'saved') {
    deck = deck.filter(item => state.savedIds.has(item.id));
  } else if (cat === 'unmastered') {
    deck = deck.filter(item => !state.masteredIds.has(item.id));
  } else if (cat === 'custom') {
    deck = deck.filter(item => item.custom);
  } else if (cat !== 'all') {
    deck = deck.filter(item => item.categoryKey === cat);
  }

  if (deck.length === 0) {
    deck = [...allVocab];
    showToast('دسته‌بندی انتخابی کارتی نداشت، تمام لغات لود شدند.');
  }

  const resumeIndex = Math.max(0, Number(state.flashcards.currentIndex) || 0);
  state.flashcards.deck = deck;
  state.flashcards.currentIndex = reset
    ? 0
    : Math.min(resumeIndex, Math.max(0, deck.length - 1));
  state.flashcards.isFlipped = false;

  renderCurrentFlashcard();
}

function renderCurrentFlashcard() {
  const deck = state.flashcards.deck;
  const index = state.flashcards.currentIndex;
  const cardEl = document.getElementById('mainFlashcard');

  if (!deck.length) return;

  const item = deck[index];
  state.flashcards.isFlipped = false;
  cardEl.classList.remove('flipped');

  // Update progress
  document.getElementById('flashcardCounter').textContent = `کارت ${index + 1} از ${deck.length}`;
  const masteredInDeck = deck.filter(x => state.masteredIds.has(x.id)).length;
  document.getElementById('flashcardMasteryRatio').textContent = `${masteredInDeck} یاد گرفته شده`;
  const pct = Math.round(((index + 1) / deck.length) * 100);
  document.getElementById('flashcardProgressFill').style.width = `${pct}%`;

  // Front & Back text based on direction
  const isFrToFa = state.flashcards.direction === 'fr-fa';
  
  // Front Elements
  document.getElementById('fcFrontCategory').textContent = item.categoryNameFr || 'Vocabulaire';
  document.getElementById('fcFrontText').textContent = isFrToFa ? item.word : item.translation;
  document.getElementById('fcFrontText').dir = isFrToFa ? 'ltr' : 'rtl';
  document.getElementById('fcFrontHint').textContent = isFrToFa 
    ? (item.gender ? `جنسیت: ${item.gender === 'masculine' ? 'مذکر (le)' : item.gender === 'feminine' ? 'مؤنث (la)' : item.gender}` : item.categoryNameFa) 
    : 'معادل فرانسوی این واژه چیست؟';

  // Back Elements
  document.getElementById('fcBackCategory').textContent = item.categoryNameFa || 'معنی و کاربرد';
  document.getElementById('fcBackTranslation').textContent = isFrToFa ? item.translation : item.word;
  document.getElementById('fcBackTranslation').dir = isFrToFa ? 'rtl' : 'ltr';

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

  // Front Audio trigger
  document.getElementById('fcFrontAudioBtn').onclick = (e) => {
    e.stopPropagation();
    speakFrench(item.word);
  };
}

function flipFlashcard() {
  const cardEl = document.getElementById('mainFlashcard');
  state.flashcards.isFlipped = !state.flashcards.isFlipped;
  cardEl.classList.toggle('flipped', state.flashcards.isFlipped);
  sfx.playFlip();

  if (state.flashcards.isFlipped && state.flashcards.direction === 'fa-fr') {
    const item = state.flashcards.deck[state.flashcards.currentIndex];
    speakFrench(item.word);
  }
}

function nextFlashcard(knowsIt) {
  const deck = state.flashcards.deck;
  const currentItem = deck[state.flashcards.currentIndex];

  if (knowsIt) {
    state.masteredIds.add(currentItem.id);
    addXP(10);
    sfx.playCorrect();
  } else {
    deck.push(currentItem);
    sfx.playWrong();
  }

  if (state.flashcards.currentIndex < deck.length - 1) {
    state.flashcards.currentIndex++;
    saveState();
    renderCurrentFlashcard();
  } else {
    saveState();
    showToast('🎉 تمام کارت‌های این دسته مرور شدند!');
    triggerConfetti();
    setupFlashcards({ reset: true });
  }
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

  content.innerHTML = `
    <div style="text-align: center; padding: 20px 10px 10px;">
      <div class="badge-tag" style="margin-bottom: 12px;">${item.categoryNameFr} • ${item.categoryNameFa}</div>
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
      state.masteredIds.delete(item.id);
    } else {
      state.masteredIds.add(item.id);
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

  const systemPrompt = `You are a French A1 teacher for Persian (Farsi) speakers.
Extract learning data from the user's French text.
Return ONLY valid JSON with this shape:
{
  "sentence": { "fr": "...", "fa": "...", "topic": "food|work|family|health|travel|housing|routine|culture|other" },
  "items": [
    {
      "word": "lemma in French",
      "translation": "Persian meaning",
      "categoryKey": "verbs|nouns|adjectives|adverbs|prepositions|expressions|numbers",
      "gender": "masculine|feminine|common|feminine_plural|",
      "type": "verb|reflexive_verb|noun|",
      "fem": "feminine adjective form if relevant",
      "example": "short French example using the word",
      "note": "optional Persian note"
    }
  ]
}
Rules:
- Include the full sentence even if the user pasted several sentences; pick the main one or keep them together.
- Extract useful A1 vocabulary: nouns with gender, verbs in infinitive, adjectives with feminine form, expressions.
- Skip names and very basic grammar words like je, tu, le, la unless they are the teaching point.
- Maximum 12 items.
- Persian translations must be natural.`;

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
    if (!response.ok) {
      throw new Error(payload.error?.message || 'خطای OpenRouter');
    }

    const raw = payload.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''));
    importerDraft = parsed;
    renderImporterPreview(parsed);
    status.textContent = 'تحلیل آماده است. موارد را انتخاب و ذخیره کنید.';
  } catch (err) {
    console.error(err);
    status.textContent = '';
    showToast(err.message || 'تحلیل ناموفق بود');
  } finally {
    btn.disabled = false;
  }
}

function renderImporterPreview(data) {
  const preview = document.getElementById('importerPreview');
  const grid = document.getElementById('importerVocabGrid');
  document.getElementById('importerPreviewFr').textContent = data.sentence?.fr || '';
  document.getElementById('importerPreviewFa').textContent = data.sentence?.fa || '';
  const items = data.items || [];
  grid.innerHTML = items.map((item, idx) => `
    <label class="vocab-card" style="cursor: pointer;">
      <div class="vocab-card-header">
        <div class="vocab-word-info">
          <div class="vocab-word-fr" dir="ltr">${item.word || ''}</div>
          <div style="margin-top: 4px;">
            <span class="vocab-gender-badge common">${item.categoryKey || 'word'} ${item.gender ? '• ' + item.gender : ''}</span>
          </div>
        </div>
        <input type="checkbox" class="importer-item-check" data-idx="${idx}" checked>
      </div>
      <div class="vocab-translation">${item.translation || ''}</div>
      ${item.example ? `<div class="vocab-example-snippet"><div class="snippet-fr" dir="ltr">${item.example}</div></div>` : ''}
      ${item.note ? `<div class="vocab-note-tag">💡 ${item.note}</div>` : ''}
    </label>
  `).join('');
  preview.style.display = 'block';
}

function saveImportedItems() {
  if (!importerDraft) {
    showToast('ابتدا جمله را تحلیل کنید');
    return;
  }
  const extra = getCustomData();
  const selected = [...document.querySelectorAll('.importer-item-check:checked')].map(el => Number(el.dataset.idx));
  const now = Date.now();

  selected.forEach((idx, i) => {
    const item = importerDraft.items[idx];
    if (!item || !item.word) return;
    extra.vocab.push({
      id: `c-${now}-${i}`,
      word: item.word,
      translation: item.translation,
      categoryKey: item.categoryKey || 'expressions',
      gender: item.gender || undefined,
      type: item.type || undefined,
      fem: item.fem || undefined,
      example: item.example || importerDraft.sentence?.fr,
      note: item.note || '',
      custom: true
    });
  });

  if (importerDraft.sentence?.fr) {
    extra.sentences.push({
      id: `cs-${now}`,
      fr: importerDraft.sentence.fr,
      fa: importerDraft.sentence.fa || '',
      topic: importerDraft.sentence.topic || 'other',
      custom: true
    });
  }

  saveCustomData(extra);
  updateContentCounts();
  addXP(15, 'برای افزودن جمله جدید');
  showToast('جمله و لغات انتخاب‌شده به اپ اضافه شد');
}

function restoreUiFromState() {
  document.body.className = state.theme === 'dark' ? 'theme-dark' : 'theme-light';

  const speedText = document.getElementById('speedIndicatorText');
  if (speedText) speedText.textContent = `${state.audioSpeed}x`;
  const speedBtn = document.getElementById('audioSpeedBtn');
  if (speedBtn) speedBtn.title = `سرعت تلفظ صوتی (فعلی: ${state.audioSpeed}x)`;

  const flashCat = document.getElementById('flashcardCatSelect');
  if (flashCat) flashCat.value = state.flashcards.category;
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
  document.body.className = state.theme === 'dark' ? 'theme-dark' : 'theme-light';
  updateHeaderStats();
  updateContentCounts();
}

// ==========================================================================
// 10. PWA ENGINE & FIRST-TIME INSTALL PROMPT
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
  document.getElementById('dashFlashcardsBtn').onclick = () => switchView('flashcards');

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
  document.getElementById('fcBtnFlip').onclick = flipFlashcard;
  document.getElementById('fcBtnAgain').onclick = () => nextFlashcard(false);
  document.getElementById('fcBtnKnow').onclick = () => nextFlashcard(true);

  document.getElementById('flashcardCatSelect').onchange = (e) => {
    state.flashcards.category = e.target.value;
    setupFlashcards({ reset: true });
    saveState();
  };

  document.getElementById('flashcardShuffleBtn').onclick = shuffleFlashcardDeck;

  document.getElementById('flashcardFlipDirectionBtn').onclick = () => {
    state.flashcards.direction = state.flashcards.direction === 'fr-fa' ? 'fa-fr' : 'fr-fa';
    document.getElementById('flashcardDirectionLabel').textContent = state.flashcards.direction === 'fr-fa' ? 'فرانسوی ➔ فارسی' : 'فارسی ➔ فرانسوی';
    saveState();
    renderCurrentFlashcard();
  };

  // Flashcards Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (state.currentView !== 'flashcards') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space') {
      e.preventDefault();
      flipFlashcard();
    } else if (e.code === 'ArrowLeft' || e.key === '1') {
      e.preventDefault();
      nextFlashcard(false);
    } else if (e.code === 'ArrowRight' || e.key === '2') {
      e.preventDefault();
      nextFlashcard(true);
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

  // Setup Global Search
  setupGlobalSearch();

  // Setup PWA Installation & ServiceWorker
  setupPwaEngine();

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
