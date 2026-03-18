/* ===== notifications.js — Notification API + timer scheduling ===== */
const Notifications = (() => {
  let _dailyTimeout = null;
  let _dailyInterval = null;
  let _checkInterval = null;

  function init(settings) {
    cancelAll();
    if (settings.notificationsEnabled && Notification.permission === 'granted') {
      scheduleDaily(settings.notificationTime);
      startBusinessClaimChecker();
    }
  }

  async function requestPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  function scheduleDaily(timeStr) {
    cancelDaily();
    const [hours, minutes] = timeStr.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);

    // If time has already passed today, schedule for tomorrow
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    const msUntil = target.getTime() - now.getTime();

    _dailyTimeout = setTimeout(() => {
      fireTrainingReminder();
      // Then repeat every 24 hours
      _dailyInterval = setInterval(fireTrainingReminder, 24 * 60 * 60 * 1000);
    }, msUntil);
  }

  function fireTrainingReminder() {
    notifyNow('Training Reminder', 'Time to check your training plan!', {
      tag: 'training-reminder'
    });
  }

  function notifyNow(title, body, options) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
      new Notification(title, {
        body,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        ...options
      });
    } catch (e) {
      // Notification API may fail in some contexts
    }
  }

  function startBusinessClaimChecker() {
    // Check every 30 minutes if the page is visible
    _checkInterval = setInterval(() => {
      if (document.visibilityState === 'visible') return; // Don't notify when app is visible
      checkBusinessClaims();
    }, 30 * 60 * 1000);

    // Also check on visibility change
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      // User returned to the app — trigger a UI refresh if the game module exists
      if (typeof Game !== 'undefined' && Game.renderGameView) {
        // Only re-render if game view is active
      }
    }
  }

  function checkBusinessClaims() {
    // This will be called by app.js with actual data
  }

  function notifyClaimsReady(businessName) {
    notifyNow('Claims Ready!', `Your ${businessName} has max claims waiting to be collected.`, {
      tag: 'claims-' + businessName
    });
  }

  function cancelDaily() {
    clearTimeout(_dailyTimeout);
    clearInterval(_dailyInterval);
    _dailyTimeout = null;
    _dailyInterval = null;
  }

  function cancelAll() {
    cancelDaily();
    clearInterval(_checkInterval);
    _checkInterval = null;
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }

  function updateSettings(settings) {
    cancelAll();
    if (settings.notificationsEnabled && Notification.permission === 'granted') {
      scheduleDaily(settings.notificationTime);
      startBusinessClaimChecker();
    }
  }

  return {
    init,
    requestPermission,
    scheduleDaily,
    notifyNow,
    notifyClaimsReady,
    checkBusinessClaims,
    cancelAll,
    updateSettings
  };
})();
