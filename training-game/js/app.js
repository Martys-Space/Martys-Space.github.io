/* ===== app.js — Main entry, routing, init ===== */
const App = (() => {
  let _state = null;
  let _user = null;
  let _activitiesData = null;
  let _businessesData = null;
  let _currentView = 'view-today';

  /* ===== INIT ===== */
  async function init() {
    // Try migrating from v1
    if (!Storage.loadUser()) {
      Storage.migrateV1();
    }

    // Load data files
    try {
      const [activitiesRes, businessesRes] = await Promise.all([
        fetch('data/activities.json'),
        fetch('data/businesses.json')
      ]);
      _activitiesData = await activitiesRes.json();
      _businessesData = await businessesRes.json();
    } catch (e) {
      console.error('Failed to load data files:', e);
      return;
    }

    // Load user and state
    _user = Storage.loadUser();
    _state = Storage.loadState();

    // Init modules
    Training.init(_activitiesData, _state);
    Game.init(_businessesData, _state);

    // Check day reset
    checkDayReset();

    // Setup navigation
    setupNavigation();

    // Setup modals
    setupModals();

    // Setup settings
    setupSettings();

    // Check if first visit
    if (!_user || !_user.username) {
      showModal('modal-username');
      document.getElementById('input-username').focus();
    } else {
      renderTopbar();
    }

    // Render initial view
    switchView('view-today');

    // Init notifications
    if (_user && _user.settings) {
      Notifications.init(_user.settings);
    }

    // Register service worker
    registerServiceWorker();

    // Install prompt
    setupInstallPrompt();

    // Periodic day reset check
    setInterval(checkDayReset, 60000);
  }

  /* ===== NAVIGATION ===== */
  function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        switchView(btn.dataset.view);
      });
    });

    // "Create Training Plan" button in empty today view
    document.getElementById('btn-create-plan-prompt').addEventListener('click', () => {
      switchView('view-plan');
    });
  }

  function switchView(viewId) {
    _currentView = viewId;

    document.querySelectorAll('.view').forEach(v => {
      v.classList.toggle('hidden', v.id !== viewId);
      v.classList.toggle('active', v.id === viewId);
    });

    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.view === viewId);
    });

    // Render the active view
    if (viewId === 'view-today') Training.renderTodayView();
    if (viewId === 'view-plan') Training.renderPlanView();
    if (viewId === 'view-game') Game.renderGameView();
  }

  /* ===== TOPBAR ===== */
  function renderTopbar() {
    if (!_user) return;
    document.getElementById('display-username').textContent = _user.username || 'Guest';
    document.getElementById('display-level').textContent = getPlayerLevel(_state.xp);
    document.getElementById('display-xp').textContent = _state.xp;
    document.getElementById('display-gold').textContent = _state.gold;
    document.getElementById('display-biz-money').textContent = Game.getTotalBusinessMoney();
    updateXpBar();
  }

  function updateXpBar() {
    const progress = getXpProgress(_state.xp);
    document.getElementById('xp-progress-fill').style.width = progress + '%';
  }

  /* ===== LEVEL UP ===== */
  function checkLevelUp(prevXp, newXp) {
    const prevLevel = getPlayerLevel(prevXp);
    const newLevel = getPlayerLevel(newXp);
    if (newLevel > prevLevel) {
      showLevelUpModal(newLevel);
    }
  }

  function showLevelUpModal(level) {
    const details = document.getElementById('levelup-details');
    let html = `<div class="levelup-new-level">${level}</div>`;

    // Check for new unlocks
    const unlocks = Game.checkUnlocks(level);
    if (unlocks.length > 0) {
      html += '<div class="levelup-unlock">';
      for (const biz of unlocks) {
        html += `<div>${biz.icon} ${biz.name} unlocked!</div>`;
      }
      html += '</div>';
    }

    details.innerHTML = html;
    showModal('modal-levelup');
  }

  /* ===== MODALS ===== */
  function setupModals() {
    // Username save
    document.getElementById('btn-save-username').addEventListener('click', saveUsername);
    document.getElementById('input-username').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveUsername();
    });

    // Add activity button
    document.getElementById('btn-add-activity').addEventListener('click', () => {
      Training.openActivityPicker();
    });

    // Confirm plan item
    document.getElementById('btn-confirm-plan-item').addEventListener('click', () => {
      Training.confirmPlanItem();
    });

    // Cancel plan item
    document.getElementById('btn-cancel-plan-item').addEventListener('click', () => {
      hideModal('modal-plan-item');
    });

    // Level up close
    document.getElementById('btn-close-levelup').addEventListener('click', () => {
      hideModal('modal-levelup');
    });

    // Info modal
    document.getElementById('btn-open-info').addEventListener('click', () => {
      showModal('modal-info');
    });

    // Close buttons (data-close attribute)
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        hideModal(btn.dataset.close);
      });
    });

    // Click backdrop to close
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', () => {
        const modal = backdrop.closest('.modal');
        if (modal && modal.id !== 'modal-username') {
          hideModal(modal.id);
        }
      });
    });
  }

  function saveUsername() {
    const input = document.getElementById('input-username');
    const name = input.value.trim();
    if (!name) {
      input.style.borderColor = 'var(--accent-red)';
      return;
    }

    if (!_user) {
      _user = Storage.defaultUser();
    }
    _user.username = name;
    Storage.saveUser(_user);

    hideModal('modal-username');
    renderTopbar();
    showToast(`Welcome, ${name}!`, 'success');
  }

  function showModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  function hideModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  /* ===== SETTINGS ===== */
  function setupSettings() {
    // Notification toggle
    const notifToggle = document.getElementById('setting-notif-enabled');
    const notifTime = document.getElementById('setting-notif-time');
    const notifTimeRow = document.getElementById('notif-time-row');

    // Show progressive toggle
    const progToggle = document.getElementById('setting-show-progressive');

    if (_user && _user.settings) {
      notifToggle.checked = _user.settings.notificationsEnabled;
      notifTime.value = _user.settings.notificationTime || '08:00';
      progToggle.checked = _user.settings.showProgressive !== false;
    }

    progToggle.addEventListener('change', () => {
      if (!_user) _user = Storage.defaultUser();
      _user.settings.showProgressive = progToggle.checked;
      Storage.saveUser(_user);
      Training.renderTodayView();
      Training.renderPlanView();
    });

    notifToggle.addEventListener('change', async () => {
      if (notifToggle.checked) {
        const granted = await Notifications.requestPermission();
        if (!granted) {
          notifToggle.checked = false;
          showToast('Notifications permission denied', 'error');
          return;
        }
      }

      if (!_user) _user = Storage.defaultUser();
      _user.settings.notificationsEnabled = notifToggle.checked;
      Storage.saveUser(_user);
      Notifications.updateSettings(_user.settings);
      showToast(notifToggle.checked ? 'Reminders enabled' : 'Reminders disabled', 'info');
    });

    notifTime.addEventListener('change', () => {
      if (!_user) _user = Storage.defaultUser();
      _user.settings.notificationTime = notifTime.value;
      Storage.saveUser(_user);
      if (_user.settings.notificationsEnabled) {
        Notifications.updateSettings(_user.settings);
      }
    });

    // Change username
    document.getElementById('btn-change-username').addEventListener('click', () => {
      document.getElementById('input-username').value = _user ? _user.username : '';
      showModal('modal-username');
    });

    // Export data
    document.getElementById('btn-export-data').addEventListener('click', () => {
      const data = Storage.exportAll();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `training-game-backup-${todayStr()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Data exported', 'success');
    });

    // Import data
    const importInput = document.getElementById('import-file-input');
    document.getElementById('btn-import-data').addEventListener('click', () => {
      importInput.click();
    });

    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (Storage.importAll(reader.result)) {
          showToast('Data imported! Reloading...', 'success');
          setTimeout(() => location.reload(), 1000);
        } else {
          showToast('Import failed — invalid file', 'error');
        }
      };
      reader.readAsText(file);
      importInput.value = '';
    });

    // Reset data
    document.getElementById('btn-reset-data').addEventListener('click', () => {
      if (!confirm('Are you sure you want to reset all data? This cannot be undone.')) return;
      if (!confirm('Really? All progress will be lost forever.')) return;
      Storage.resetAll();
      location.reload();
    });
  }

  /* ===== DAY RESET ===== */
  function checkDayReset() {
    const today = todayStr();
    if (_state && _state.lastDate !== today) {
      // Check if yesterday had completions for streak
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      if (_state.completions[yesterdayStr] && _state.completions[yesterdayStr].length > 0) {
        _state.stats.currentStreak++;
        _state.stats.longestStreak = Math.max(_state.stats.longestStreak, _state.stats.currentStreak);
      } else {
        // Check if the gap is more than 1 day
        if (_state.lastDate !== yesterdayStr) {
          _state.stats.currentStreak = 0;
        }
      }

      _state.lastDate = today;
      Storage.saveState(_state);

      // Re-render if active
      if (_currentView === 'view-today') {
        Training.renderTodayView();
      }
    }
  }

  /* ===== TOAST ===== */
  function showToast(message, type) {
    type = type || 'success';
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  /* ===== SERVICE WORKER ===== */
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // Service worker registration failed — not critical
      });
    }
  }

  /* ===== INSTALL PROMPT ===== */
  let _deferredInstallPrompt = null;

  function setupInstallPrompt() {
    const banner = document.getElementById('install-banner');
    const btnInstall = document.getElementById('btn-install-app');
    const btnDismiss = document.getElementById('btn-install-dismiss');
    const hint = document.getElementById('install-banner-hint');

    // Don't show if already installed as standalone
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
      return;
    }

    // Don't show if user previously dismissed
    if (localStorage.getItem('tg_install_dismissed')) return;

    // Android / Chrome — capture the native beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      _deferredInstallPrompt = e;
      banner.classList.remove('hidden');
      hint.textContent = 'Add to your home screen for the best experience';
      btnInstall.textContent = 'Install';
    });

    // iOS Safari — no beforeinstallprompt, detect and show manual hint
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /safari/i.test(navigator.userAgent) && !/crios|fxios|chrome/i.test(navigator.userAgent);
    if (isIos && isSafari && !navigator.standalone) {
      // Show after a short delay so it doesn't flash immediately
      setTimeout(() => {
        if (localStorage.getItem('tg_install_dismissed')) return;
        hint.textContent = 'Tap the share button, then "Add to Home Screen"';
        btnInstall.textContent = 'Got it';
        btnInstall.onclick = () => {
          banner.classList.add('hidden');
        };
        banner.classList.remove('hidden');
      }, 2000);
    }

    // Install button (Android)
    btnInstall.addEventListener('click', async () => {
      if (_deferredInstallPrompt) {
        _deferredInstallPrompt.prompt();
        const result = await _deferredInstallPrompt.userChoice;
        _deferredInstallPrompt = null;
        banner.classList.add('hidden');
        if (result.outcome === 'accepted') {
          showToast('App installed!', 'success');
        }
      }
    });

    // Dismiss button
    btnDismiss.addEventListener('click', () => {
      banner.classList.add('hidden');
      localStorage.setItem('tg_install_dismissed', '1');
    });

    // Hide banner if app gets installed while page is open
    window.addEventListener('appinstalled', () => {
      banner.classList.add('hidden');
      _deferredInstallPrompt = null;
    });
  }

  function showProgressiveOnCards() {
    return !_user || !_user.settings || _user.settings.showProgressive !== false;
  }

  return {
    init,
    switchView,
    renderTopbar,
    checkLevelUp,
    showModal,
    hideModal,
    showToast,
    showProgressiveOnCards
  };
})();

// Boot
window.addEventListener('DOMContentLoaded', () => App.init());
