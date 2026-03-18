/* ===== storage.js — localStorage wrapper ===== */
const Storage = (() => {
  const USER_KEY = 'tg_user_v2';
  const STATE_KEY = 'tg_state_v2';
  const OLD_USER_KEY = 'training_game_user_v1';
  const OLD_STATE_KEY = 'training_game_state_v1';

  let _saveTimeout = null;

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
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return null;
  }

  function saveUser(user) {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) { /* ignore */ }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Merge with defaults to fill any missing fields
        const state = { ...defaultState(), ...parsed };
        state.trainingPlan = { ...defaultState().trainingPlan, ...parsed.trainingPlan };
        state.stats = { ...defaultState().stats, ...parsed.stats };
        return state;
      }
    } catch (e) { /* ignore */ }
    return defaultState();
  }

  function saveState(state) {
    // Debounce saves to avoid excessive writes
    clearTimeout(_saveTimeout);
    _saveTimeout = setTimeout(() => {
      try {
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
      } catch (e) { /* ignore */ }
    }, 100);
  }

  function saveStateImmediate(state) {
    clearTimeout(_saveTimeout);
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) { /* ignore */ }
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
      if (data.user) saveUser(data.user);
      if (data.state) {
        clearTimeout(_saveTimeout);
        localStorage.setItem(STATE_KEY, JSON.stringify(data.state));
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function resetAll() {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(STATE_KEY);
  }

  // Try to migrate from old v1 format
  function migrateV1() {
    try {
      const oldUser = localStorage.getItem(OLD_USER_KEY);
      const oldState = localStorage.getItem(OLD_STATE_KEY);
      if (!oldUser && !oldState) return false;

      if (oldUser) {
        const parsed = JSON.parse(oldUser);
        const user = defaultUser();
        if (parsed.name) user.username = parsed.name;
        saveUser(user);
      }

      if (oldState) {
        const parsed = JSON.parse(oldState);
        const state = defaultState();
        if (parsed.xp) state.xp = parsed.xp;
        if (parsed.gold) state.gold = parsed.gold;
        saveStateImmediate(state);
      }

      return true;
    } catch (e) {
      return false;
    }
  }

  return {
    loadUser,
    saveUser,
    loadState,
    saveState,
    saveStateImmediate,
    exportAll,
    importAll,
    resetAll,
    migrateV1,
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
