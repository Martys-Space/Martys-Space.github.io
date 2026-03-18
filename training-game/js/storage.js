/* ===== storage.js — localStorage wrapper ===== */
const Storage = (() => {
  const LS_KEY = 'tg_v1';

  let _saveTimeout = null;
  let _data = {};  // in-memory mirror of the single stored object

  function _load() {
    if (Object.keys(_data).length) return _data;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) _data = JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return _data;
  }

  function _flush() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(_data));
    } catch (e) { /* ignore */ }
  }

  function defaultState() {
    return {
      xp: 0,
      gold: 0,
      lastDate: todayStr(),
      trainingPlan: {
        id: generateId('plan'),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        items: []
      },
      completions: {},
      weeklyCompletions: {},
      businesses: [],
      stats: {
        totalActivitiesCompleted: 0,
        totalXpEarned: 0,
        totalGoldEarned: 0,
        longestStreak: 0,
        currentStreak: 0
      }
    };
  }

  function defaultUser() {
    return {
      username: '',
      createdAt: Date.now(),
      settings: {
        notificationsEnabled: false,
        notificationTime: '08:00',
        showProgressive: true
      }
    };
  }

  function loadUser() {
    return _load().user || null;
  }

  function saveUser(user) {
    _load();
    _data.user = user;
    _flush();
  }

  function loadState() {
    const saved = _load().state;
    if (saved) {
      // Merge with defaults to fill any missing fields
      const state = { ...defaultState(), ...saved };
      state.trainingPlan = { ...defaultState().trainingPlan, ...saved.trainingPlan };
      state.stats = { ...defaultState().stats, ...saved.stats };
      return state;
    }
    return defaultState();
  }

  function saveState(state) {
    // Debounce saves to avoid excessive writes
    _load();
    _data.state = state;
    clearTimeout(_saveTimeout);
    _saveTimeout = setTimeout(_flush, 100);
  }

  function saveStateImmediate(state) {
    _load();
    _data.state = state;
    clearTimeout(_saveTimeout);
    _flush();
  }

  function getInstallDismissed() {
    return !!_load().installDismissed;
  }

  function setInstallDismissed() {
    _load();
    _data.installDismissed = true;
    _flush();
  }

  function exportAll() {
    return JSON.stringify({
      user: loadUser(),
      state: loadState(),
      exportedAt: Date.now(),
      version: 2
    }, null, 2);
  }

  function importAll(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      _load();
      if (data.user)  _data.user  = data.user;
      if (data.state) _data.state = data.state;
      clearTimeout(_saveTimeout);
      _flush();
      return true;
    } catch (e) {
      return false;
    }
  }

  function resetAll() {
    clearTimeout(_saveTimeout);
    _data = {};
    localStorage.removeItem(LS_KEY);
  }

  return {
    loadUser,
    saveUser,
    loadState,
    saveState,
    saveStateImmediate,
    getInstallDismissed,
    setInstallDismissed,
    exportAll,
    importAll,
    resetAll,
    defaultState,
    defaultUser
  };
})();

/* ===== Utility functions ===== */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function weekStr(date) {
  const d = date || new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return d.getFullYear() + '-W' + String(weekNum).padStart(2, '0');
}

function generateId(prefix) {
  return prefix + '_' + Math.random().toString(36).substring(2, 9);
}

function getPlayerLevel(xp) {
  return Math.floor(xp / 100);
}

function getXpProgress(xp) {
  return xp % 100;
}

function getXpForNextLevel(xp) {
  return 100 - (xp % 100);
}
