// Storage & Persistence Layer for FrançaisFacile
// Tier 1: OPFS (Origin Private File System) -> /francais-facile/state.json
// Tier 2: IndexedDB (Structured asynchronous database) -> FrancaisFacileDB
// Tier 3: localStorage snapshot fallback (for restricted contexts)

const FF_LS_SNAPSHOT = 'ff_app_snapshot';
const FF_LS_LEGACY_KEYS = [
  'ff_theme', 'ff_audio_speed', 'ff_xp', 'ff_streak', 'ff_last_active',
  'ff_mastered_ids', 'ff_saved_ids', 'ff_quizzes_count', 'ff_accuracy_hist',
  'ff_best_match', 'ff_custom_data', 'ff_openrouter_key', 'ff_ai_visuals'
];

const IDB_DB_NAME = 'FrancaisFacileDB';
const IDB_STORE_NAME = 'snapshots';
const IDB_SNAPSHOT_KEY = 'latest';

const VALID_VIEWS = new Set([
  'dashboard', 'vocab', 'flashcards', 'quiz', 'sentences',
  'grammar', 'matchgame', 'progress', 'importer'
]);

window.FFStorage = {
  engine: 'memory',
  hasOpfs: false,
  hasIdb: false,
  persistent: false,
  lastSavedAt: null,
  saveTimer: null,
  dirHandle: null,
  idbDb: null,
  pendingSnapshot: null,
  writing: false,
  ready: false,
  quotaLabel: ''
};

function emptyCustom() {
  return { vocab: [], sentences: [] };
}

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// 1. IndexedDB Engine Helpers
// ---------------------------------------------------------------------------
function openIdb() {
  if (!('indexedDB' in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_DB_NAME, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => {
        console.warn('IndexedDB open error:', e);
        resolve(null);
      };
      request.onblocked = () => {
        console.warn('IndexedDB open blocked');
        resolve(null);
      };
    } catch (err) {
      console.warn('IndexedDB unavailable:', err);
      resolve(null);
    }
  });
}

async function readIdbSnapshot() {
  const db = await openIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.get(IDB_SNAPSHOT_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

async function writeIdbSnapshot(snapshot) {
  const db = await openIdb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.put(snapshot, IDB_SNAPSHOT_KEY);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
      tx.onerror = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

async function clearIdbSnapshot() {
  const db = await openIdb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch (e) {
      resolve();
    }
  });
}

// ---------------------------------------------------------------------------
// 2. localStorage Helpers
// ---------------------------------------------------------------------------
function readLegacyLocalStorage() {
  const customRaw = localStorage.getItem('ff_custom_data');
  let custom = emptyCustom();
  try {
    custom = customRaw ? JSON.parse(customRaw) : emptyCustom();
  } catch (e) {
    custom = emptyCustom();
  }

  return {
    version: 1,
    theme: localStorage.getItem('ff_theme') || 'light',
    audioSpeed: parseFloat(localStorage.getItem('ff_audio_speed')) || 1.0,
    xp: parseInt(localStorage.getItem('ff_xp') || '0', 10) || 0,
    streak: parseInt(localStorage.getItem('ff_streak') || '1', 10) || 1,
    lastActiveDate: localStorage.getItem('ff_last_active') || new Date().toDateString(),
    masteredIds: JSON.parse(localStorage.getItem('ff_mastered_ids') || '[]'),
    savedIds: JSON.parse(localStorage.getItem('ff_saved_ids') || '[]'),
    quizzesCompleted: parseInt(localStorage.getItem('ff_quizzes_count') || '0', 10) || 0,
    quizAccuracyHistory: JSON.parse(localStorage.getItem('ff_accuracy_hist') || '[]'),
    bestMatchRecord: parseInt(localStorage.getItem('ff_best_match') || '0', 10) || 0,
    currentView: 'dashboard',
    flashcards: { category: 'all', direction: 'fr-fa', currentIndex: 0, deckId: null, screen: 'browser', reviews: {} },
    vocab: { category: 'all', gender: 'all', viewMode: 'grid' },
    sentences: { topic: 'all', hideTranslations: false },
    gameCategory: 'all',
    lastQuizType: 'mcq',
    openRouterKey: localStorage.getItem('ff_openrouter_key') || '',
    openRouterModel: 'openai/gpt-4o-mini',
    custom,
    aiVisuals: JSON.parse(localStorage.getItem('ff_ai_visuals') || '{}'),
    activityDates: [],
    quizLog: []
  };
}

function readLocalSnapshot() {
  const raw = localStorage.getItem(FF_LS_SNAPSHOT);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }
  if (localStorage.getItem('ff_xp') || localStorage.getItem('ff_custom_data')) {
    return readLegacyLocalStorage();
  }
  return null;
}

// ---------------------------------------------------------------------------
// 3. OPFS Engine Helpers
// ---------------------------------------------------------------------------
async function getOpfsDir() {
  if (!navigator.storage || !navigator.storage.getDirectory) return null;
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle('francais-facile', { create: true });
}

async function readOpfsSnapshot(dir) {
  try {
    const fileHandle = await dir.getFileHandle('state.json');
    const file = await fileHandle.getFile();
    const text = await file.text();
    return text ? JSON.parse(text) : null;
  } catch (e) {
    return null;
  }
}

async function writeOpfsSnapshot(dir, snapshot) {
  const json = JSON.stringify(snapshot);
  const tmp = await dir.getFileHandle('state.json.tmp', { create: true });
  const writable = await tmp.createWritable();
  await writable.write(json);
  await writable.close();

  try {
    if (typeof tmp.move === 'function') {
      await tmp.move('state.json');
      return;
    }
  } catch (e) {
    /* browsers without atomic rename fall through */
  }

  const dest = await dir.getFileHandle('state.json', { create: true });
  let destWritable;
  try {
    destWritable = await dest.createWritable({ keepExistingData: false });
  } catch (e) {
    destWritable = await dest.createWritable();
  }
  await destWritable.write(json);
  await destWritable.close();
  try {
    await dir.removeEntry('state.json.tmp');
  } catch (e) {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// 4. State Hydration & Mapping
// ---------------------------------------------------------------------------
function applySnapshotToState(snapshot, state) {
  if (!snapshot) return;
  state.theme = snapshot.theme || 'light';
  state.audioSpeed = Number(snapshot.audioSpeed) || 1.0;
  state.xp = Number(snapshot.xp) || 0;
  state.streak = Number(snapshot.streak) || 1;
  state.lastActiveDate = snapshot.lastActiveDate || new Date().toDateString();
  state.masteredIds = new Set(snapshot.masteredIds || []);
  state.savedIds = new Set(snapshot.savedIds || []);
  state.quizzesCompleted = Number(snapshot.quizzesCompleted) || 0;
  state.quizAccuracyHistory = Array.isArray(snapshot.quizAccuracyHistory) ? snapshot.quizAccuracyHistory : [];
  state.bestMatchRecord = Number(snapshot.bestMatchRecord) || 0;
  state.currentView = VALID_VIEWS.has(snapshot.currentView) ? snapshot.currentView : 'dashboard';
  state.flashcards.category = snapshot.flashcards?.category || 'all';
  state.flashcards.direction = snapshot.flashcards?.direction || 'fr-fa';
  state.flashcards.currentIndex = Number(snapshot.flashcards?.currentIndex) || 0;
  state.flashcards.deckId = snapshot.flashcards?.deckId || null;
  state.flashcards.screen = snapshot.flashcards?.screen === 'study' ? 'study' : 'browser';
  state.flashcards.reviews = snapshot.flashcards?.reviews && typeof snapshot.flashcards.reviews === 'object'
    ? snapshot.flashcards.reviews
    : {};
  state.flashcards.sessionDone = 0;
  state.flashcards.sessionTotal = 0;
  state.vocab.category = snapshot.vocab?.category || 'all';
  state.vocab.gender = snapshot.vocab?.gender || 'all';
  state.vocab.viewMode = snapshot.vocab?.viewMode || 'grid';
  state.sentences.topic = snapshot.sentences?.topic || 'all';
  state.sentences.hideTranslations = Boolean(snapshot.sentences?.hideTranslations);
  state.game.category = snapshot.gameCategory || 'all';
  state.lastQuizType = snapshot.lastQuizType || 'mcq';
  if (Object.prototype.hasOwnProperty.call(snapshot, 'openRouterKey') && snapshot.openRouterKey) {
    state.openRouterKey = snapshot.openRouterKey;
  } else if (!state.openRouterKey) {
    state.openRouterKey = window.FF_OPENROUTER_KEY || '';
  }
  state.openRouterModel = snapshot.openRouterModel || 'openai/gpt-4o-mini';
  state.custom = snapshot.custom && Array.isArray(snapshot.custom.vocab)
    ? snapshot.custom
    : emptyCustom();
  if (!Array.isArray(state.custom.sentences)) state.custom.sentences = [];
  state.aiVisuals = snapshot.aiVisuals && typeof snapshot.aiVisuals === 'object' ? snapshot.aiVisuals : {};
  state.activityDates = Array.isArray(snapshot.activityDates) ? snapshot.activityDates : [];
  state.quizLog = Array.isArray(snapshot.quizLog) ? snapshot.quizLog.slice(-50) : [];
}

function engineLabel(engine) {
  if (engine === 'opfs') return 'OPFS';
  if (engine === 'idb') return 'IndexedDB';
  if (engine === 'local') return 'Local';
  return 'Memory';
}

function storageTitle(engine, ok) {
  if (!ok) return 'ذخیره با مشکل مواجه شد';
  const persist = window.FFStorage.persistent ? ' • پایدار' : '';
  const quota = window.FFStorage.quotaLabel ? ` • ${window.FFStorage.quotaLabel}` : '';
  if (engine === 'opfs') {
    return `پیشرفت روی فایل خصوصی مرورگر (OPFS) و IndexedDB ذخیره می‌شود${persist}${quota}`;
  }
  if (engine === 'idb') {
    return `پیشرفت روی پایگاه‌داده ساخت‌یافته IndexedDB ذخیره می‌شود${persist}${quota}`;
  }
  if (engine === 'local') {
    return `ذخیره روی localStorage (پشتیبان)${quota}`;
  }
  return 'حافظه موقت — با بستن تب ممکن است پیشرفت از بین برود';
}

function setStorageStatus(label, engine, ok) {
  const text = document.getElementById('storageStatusText');
  const pill = document.getElementById('storageStatusPill');
  if (text) text.textContent = label;
  if (pill) {
    pill.dataset.engine = engine;
    pill.classList.toggle('is-error', !ok);
    pill.title = storageTitle(engine, ok);
  }
  const hint = document.getElementById('storageHint');
  if (hint) {
    if (engine === 'opfs') {
      hint.textContent = 'پیشرفت، واژگان سفارشی و تنظیمات همزمان روی فایل خصوصی مرورگر (OPFS) و IndexedDB ذخیره شده و کاملاً ماندگار است.';
    } else if (engine === 'idb') {
      hint.textContent = 'پیشرفت و داده‌های سفارشی روی پایگاه‌داده IndexedDB مرورگر با ظرفیت بالا و ماندگاری کامل ذخیره می‌شوند.';
    } else if (engine === 'local') {
      hint.textContent = 'مرورگر از OPFS و IndexedDB پشتیبانی نکرد؛ پیشرفت روی localStorage ذخیره می‌شود.';
    } else {
      hint.textContent = 'ذخیره پایدار در دسترس نیست. برای حفظ پیشرفت از دکمه پشتیبان‌گیری استفاده کنید.';
    }
  }
}

async function refreshQuota() {
  try {
    if (!navigator.storage || !navigator.storage.estimate) return;
    const { usage, quota } = await navigator.storage.estimate();
    if (!quota) return;
    const usedMb = (usage / (1024 * 1024)).toFixed(1);
    const quotaMb = Math.round(quota / (1024 * 1024));
    window.FFStorage.quotaLabel = `${usedMb} / ${quotaMb} MB`;
  } catch (e) {
    window.FFStorage.quotaLabel = '';
  }
}

window.FFStorage.applyToState = applySnapshotToState;

window.FFStorage.buildSnapshot = function buildSnapshot(state) {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    theme: state.theme,
    audioSpeed: state.audioSpeed,
    xp: state.xp,
    streak: state.streak,
    lastActiveDate: state.lastActiveDate,
    masteredIds: Array.from(state.masteredIds || []),
    savedIds: Array.from(state.savedIds || []),
    quizzesCompleted: state.quizzesCompleted,
    quizAccuracyHistory: state.quizAccuracyHistory || [],
    bestMatchRecord: state.bestMatchRecord,
    currentView: state.currentView,
    flashcards: {
      category: state.flashcards.category,
      direction: state.flashcards.direction,
      currentIndex: state.flashcards.currentIndex || 0,
      deckId: state.flashcards.deckId || null,
      screen: state.flashcards.screen || 'browser',
      reviews: state.flashcards.reviews || {}
    },
    vocab: {
      category: state.vocab.category,
      gender: state.vocab.gender,
      viewMode: state.vocab.viewMode
    },
    sentences: {
      topic: state.sentences.topic,
      hideTranslations: state.sentences.hideTranslations
    },
    gameCategory: state.game.category,
    lastQuizType: state.lastQuizType || state.quiz?.type || 'mcq',
    openRouterKey: state.openRouterKey || '',
    openRouterModel: state.openRouterModel || 'openai/gpt-4o-mini',
    custom: state.custom || emptyCustom(),
    aiVisuals: state.aiVisuals || {},
    activityDates: state.activityDates || [],
    quizLog: state.quizLog || []
  };
};

window.FFStorage.hydrate = async function hydrate(state) {
  let snapshot = null;
  let loadedFrom = 'none';

  // 1. Try OPFS
  try {
    this.dirHandle = await getOpfsDir();
    if (this.dirHandle) {
      snapshot = await readOpfsSnapshot(this.dirHandle);
      if (snapshot) {
        loadedFrom = 'opfs';
        this.hasOpfs = true;
      }
    }
  } catch (e) {
    console.warn('OPFS unavailable', e);
    this.dirHandle = null;
  }

  // 2. Try IndexedDB if OPFS snapshot was not found
  try {
    const idbTest = await openIdb();
    if (idbTest) {
      this.hasIdb = true;
      if (!snapshot) {
        snapshot = await readIdbSnapshot();
        if (snapshot) loadedFrom = 'idb';
      }
    }
  } catch (e) {
    console.warn('IndexedDB unavailable', e);
  }

  // 3. Try LocalStorage
  if (!snapshot) {
    snapshot = readLocalSnapshot();
    if (snapshot) loadedFrom = 'local';
  }

  // Determine active primary engine
  if (this.dirHandle) {
    this.engine = 'opfs';
  } else if (this.hasIdb) {
    this.engine = 'idb';
  } else if (snapshot || localStorage) {
    this.engine = 'local';
  } else {
    this.engine = 'memory';
  }

  if (!snapshot && window.FF_OPENROUTER_KEY) {
    snapshot = { openRouterKey: window.FF_OPENROUTER_KEY };
  }

  applySnapshotToState(snapshot, state);
  if (!state.openRouterKey && window.FF_OPENROUTER_KEY) {
    state.openRouterKey = window.FF_OPENROUTER_KEY;
  }

  try {
    if (navigator.storage && navigator.storage.persist) {
      this.persistent = await navigator.storage.persist();
    }
  } catch (e) {
    this.persistent = false;
  }

  await refreshQuota();
  this.ready = true;
  setStorageStatus(engineLabel(this.engine), this.engine, true);

  // Cross-sync all storage layers if we loaded from a fallback or migrated
  if (snapshot && (loadedFrom !== 'opfs' || !this.hasIdb)) {
    await this.saveNow(this.buildSnapshot(state));
  }

  return this.engine;
};

window.FFStorage.saveNow = async function saveNow(snapshot) {
  this.pendingSnapshot = snapshot;
  if (this.writing) return;
  this.writing = true;

  try {
    while (this.pendingSnapshot) {
      const data = this.pendingSnapshot;
      this.pendingSnapshot = null;

      // 1. Write to localStorage (fast fallback)
      try {
        localStorage.setItem(FF_LS_SNAPSHOT, JSON.stringify(data));
      } catch (e) {
        console.warn('localStorage backup failed', e);
      }

      // 2. Write to IndexedDB
      if (this.hasIdb || ('indexedDB' in window)) {
        try {
          const idbSuccess = await writeIdbSnapshot(data);
          if (idbSuccess) this.hasIdb = true;
        } catch (e) {
          console.warn('IndexedDB write failed', e);
        }
      }

      // 3. Write to OPFS
      if (this.dirHandle) {
        try {
          await writeOpfsSnapshot(this.dirHandle, data);
          this.engine = 'opfs';
        } catch (e) {
          console.warn('OPFS write failed, falling back to IDB/Local', e);
          this.engine = this.hasIdb ? 'idb' : 'local';
        }
      } else {
        this.engine = this.hasIdb ? 'idb' : 'local';
      }

      this.lastSavedAt = Date.now();
    }

    setStorageStatus('ذخیره شد', this.engine, true);
    setTimeout(() => {
      setStorageStatus(engineLabel(this.engine), this.engine, true);
    }, 1200);
    refreshQuota();
  } catch (e) {
    console.warn('All-tier Save failed', e);
    try {
      localStorage.setItem(FF_LS_SNAPSHOT, JSON.stringify(snapshot));
      this.engine = 'local';
      setStorageStatus('Local', 'local', true);
    } catch (err) {
      this.engine = 'memory';
      setStorageStatus('خطا', 'memory', false);
    }
  } finally {
    this.writing = false;
    if (this.pendingSnapshot) {
      await this.saveNow(this.pendingSnapshot);
    }
  }
};

window.FFStorage.scheduleSave = function scheduleSave(snapshot) {
  this.pendingSnapshot = snapshot;
  setStorageStatus('...', this.engine, true);
  clearTimeout(this.saveTimer);
  this.saveTimer = setTimeout(() => {
    this.saveNow(this.pendingSnapshot);
  }, 220);
};

window.FFStorage.flush = function flush(state) {
  clearTimeout(this.saveTimer);
  return this.saveNow(this.buildSnapshot(state));
};

window.FFStorage.clearLearning = async function clearLearning(state) {
  state.xp = 0;
  state.streak = 1;
  state.masteredIds = new Set();
  state.savedIds = new Set();
  state.quizzesCompleted = 0;
  state.quizAccuracyHistory = [];
  state.bestMatchRecord = 0;
  state.quizLog = [];
  state.activityDates = [todayISO()];
  state.flashcards.currentIndex = 0;
  state.flashcards.deckId = null;
  state.flashcards.screen = 'browser';
  state.flashcards.reviews = {};
  state.flashcards.sessionDone = 0;
  state.flashcards.sessionTotal = 0;
  await this.flush(state);
};

window.FFStorage.resetAll = async function resetAll(state) {
  FF_LS_LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem(FF_LS_SNAPSHOT);
  
  if (this.hasIdb || ('indexedDB' in window)) {
    await clearIdbSnapshot();
  }

  if (this.dirHandle) {
    try {
      await this.dirHandle.removeEntry('state.json');
    } catch (e) { /* ignore */ }
    try {
      await this.dirHandle.removeEntry('state.json.tmp');
    } catch (e) { /* ignore */ }
  }
};
