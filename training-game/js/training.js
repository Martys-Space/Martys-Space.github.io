/* ===== training.js — Training plan CRUD, completions, progressive overload ===== */
const Training = (() => {
  let _activities = [];
  let _state = null;
  let _editingItemId = null; // null = adding new, string = editing existing

  function init(activitiesData, state) {
    _activities = activitiesData.categories || [];
    _state = state;
  }

  function setState(state) {
    _state = state;
  }

  function getActivityDef(activityId) {
    return _activities.find(a => a.id === activityId);
  }

  function unitLabel(unit, value) {
    if (unit === 'sec') return value === 1 ? 'sec' : 'sec';
    if (unit === 'min') return value === 1 ? 'min' : 'min';
    return unit;
  }

  /* ===== TODAY VIEW ===== */
  function renderTodayView() {
    const plan = _state.trainingPlan;
    const todayEmpty = document.getElementById('today-empty');
    const todayList = document.getElementById('today-list');
    const todayDone = document.getElementById('today-done');
    const streakBadge = document.getElementById('streak-badge');
    const streakCount = document.getElementById('streak-count');

    // Show streak
    if (_state.stats.currentStreak > 0) {
      streakBadge.classList.remove('hidden');
      streakCount.textContent = _state.stats.currentStreak;
    } else {
      streakBadge.classList.add('hidden');
    }

    if (!plan.items || plan.items.length === 0) {
      todayEmpty.classList.remove('hidden');
      todayList.classList.add('hidden');
      todayDone.classList.add('hidden');
      return;
    }

    todayEmpty.classList.add('hidden');

    const scheduled = getAllScheduledForToday();
    if (scheduled.length === 0) {
      todayList.classList.add('hidden');
      todayDone.classList.remove('hidden');
      return;
    }

    todayDone.classList.add('hidden');
    todayList.classList.remove('hidden');

    let html = '';
    let allDone = true;

    for (const item of scheduled) {
      const def = getActivityDef(item.activityId);
      if (!def) continue;

      const done = isCompletedToday(item.id);
      if (!done) allDone = false;

      const targetLabel = getAmountLabel(item, def);
      const effectiveAmt = getEffectiveAmount(item, def);
      const xpPreview = Math.round(effectiveAmt * def.xpMultiplier);
      const goldPreview = Math.max(1, Math.floor(effectiveAmt * def.goldMultiplier));
      const freqLabel = getFrequencyLabel(item);
      const progLabel = getProgressiveLabel(item, def);

      html += `
        <div class="today-card ${done ? 'completed' : ''}" data-item-id="${item.id}">
          <div class="today-card-info">
            <div class="today-card-name">${def.name}</div>
            <div class="today-card-detail">
              <span>${targetLabel}</span>
              <span class="today-card-freq">${freqLabel}</span>
            </div>
            ${progLabel && App.showProgressiveOnCards() ? `<div class="today-card-progressive">${progLabel}</div>` : ''}
            <div class="today-card-rewards">
              <span class="reward-xp">+${xpPreview} XP</span>
              <span class="reward-gold">+${goldPreview} Gold</span>
            </div>
          </div>
          <button class="btn-complete ${done ? 'done' : ''}" data-complete-id="${item.id}" ${done ? 'disabled' : ''}>
            ${done ? '✓' : '○'}
          </button>
        </div>
      `;
    }

    todayList.innerHTML = html;

    if (allDone) {
      todayDone.classList.remove('hidden');
    }

    // Bind complete buttons
    todayList.querySelectorAll('.btn-complete:not(.done)').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const itemId = btn.dataset.completeId;
        completeActivity(itemId);
      });
    });
  }

  function getScheduledForToday() {
    const plan = _state.trainingPlan;
    if (!plan.items) return [];

    const currentWeek = weekStr(new Date());

    return plan.items.filter(item => {
      if (item.frequency.type === 'daily') {
        return !isCompletedToday(item.id);
      }
      if (item.frequency.type === 'weekly') {
        const weeklyCount = getWeeklyCount(item.id, currentWeek);
        return weeklyCount < item.frequency.timesPerWeek;
      }
      return false;
    });
  }

  function getAllScheduledForToday() {
    const plan = _state.trainingPlan;
    if (!plan.items) return [];

    const currentWeek = weekStr(new Date());

    return plan.items.filter(item => {
      if (item.frequency.type === 'daily') return true;
      if (item.frequency.type === 'weekly') {
        const weeklyCount = getWeeklyCount(item.id, currentWeek);
        return weeklyCount < item.frequency.timesPerWeek;
      }
      return false;
    });
  }

  function isCompletedToday(planItemId) {
    const today = todayStr();
    const todayCompletions = _state.completions[today] || [];
    return todayCompletions.some(c => c.planItemId === planItemId);
  }

  function getWeeklyCount(planItemId, week) {
    const wk = week || weekStr();
    const weekData = _state.weeklyCompletions[wk] || {};
    return weekData[planItemId] || 0;
  }

  /* ===== AMOUNT & DISPLAY HELPERS ===== */

  // Returns the numeric amount used for XP/gold calculations
  function getEffectiveAmount(item, def) {
    const po = item.progressiveOverload;
    if (po) {
      if (po.type === 'reps') {
        return po.currentSets * po.currentReps;
      }
      // type === 'time'
      return po.currentTarget;
    }
    if (item.amount.sets && item.amount.reps) {
      return item.amount.sets * item.amount.reps;
    }
    return item.amount.value || 0;
  }

  // Returns a human-readable label for the current amount
  function getAmountLabel(item, def) {
    const po = item.progressiveOverload;
    if (po) {
      if (po.type === 'reps') {
        return `${po.currentSets} x ${po.currentReps} ${def.unit}`;
      }
      return `${po.currentTarget} ${def.unit}`;
    }
    if (item.amount.sets && item.amount.reps) {
      return `${item.amount.sets} x ${item.amount.reps} ${def.unit}`;
    }
    return `${item.amount.value} ${def.unit}`;
  }

  // Returns a short progressive overload status line, or null
  function getProgressiveLabel(item, def) {
    const po = item.progressiveOverload;
    if (!po) return null;

    const rate = po.rate === 'weekly' ? '/week' : '/session';
    if (po.type === 'reps') {
      return `↗ Progressive (${rate}): ${po.currentSets}x${po.currentReps} → ${po.maxSets}x${po.maxReps}`;
    }
    return `↗ Progressive (${rate}): ${po.currentTarget} → ${po.max} ${def.unit}`;
  }

  function getFrequencyLabel(item) {
    if (item.frequency.type === 'daily') return 'Daily';
    const week = weekStr();
    const done = getWeeklyCount(item.id, week);
    return `${done}/${item.frequency.timesPerWeek} this week`;
  }

  /* ===== COMPLETION ===== */
  function completeActivity(planItemId) {
    const item = _state.trainingPlan.items.find(i => i.id === planItemId);
    if (!item) return;

    const def = getActivityDef(item.activityId);
    if (!def) return;

    if (isCompletedToday(planItemId)) return;

    const amount = getEffectiveAmount(item, def);
    const xpGain = Math.round(amount * def.xpMultiplier);
    const goldGain = Math.max(1, Math.floor(amount * def.goldMultiplier));

    const prevXp = _state.xp;

    // Record completion
    const today = todayStr();
    if (!_state.completions[today]) _state.completions[today] = [];
    _state.completions[today].push({
      planItemId,
      completedAt: Date.now(),
      xpEarned: xpGain,
      goldEarned: goldGain
    });

    // Update weekly count
    const currentWeek = weekStr();
    if (!_state.weeklyCompletions[currentWeek]) _state.weeklyCompletions[currentWeek] = {};
    _state.weeklyCompletions[currentWeek][planItemId] =
      (_state.weeklyCompletions[currentWeek][planItemId] || 0) + 1;

    // Award XP and gold
    _state.xp += xpGain;
    _state.gold += goldGain;

    // Update stats
    _state.stats.totalActivitiesCompleted++;
    _state.stats.totalXpEarned += xpGain;
    _state.stats.totalGoldEarned += goldGain;

    // Advance progressive overload
    if (item.progressiveOverload) {
      advanceProgressive(item);
    }

    Storage.saveState(_state);

    // Show toast
    App.showToast(`+${xpGain} XP  +${goldGain} Gold`, 'success');

    // Check level up
    App.checkLevelUp(prevXp, _state.xp);

    // Re-render
    App.renderTopbar();
    renderTodayView();
  }

  /* ===== PROGRESSIVE OVERLOAD ===== */

  function advanceProgressive(item) {
    const po = item.progressiveOverload;
    if (!po) return;

    // Check rate — if weekly, only advance once per week
    if (po.rate === 'weekly') {
      const currentWeek = weekStr();
      if (po.lastProgressionWeek === currentWeek) return; // already progressed this week
      po.lastProgressionWeek = currentWeek;
    }

    if (po.type === 'reps') {
      advanceRepsProgressive(po);
    } else {
      // type === 'time'
      advanceTimeProgressive(po);
    }
  }

  function advanceRepsProgressive(po) {
    // Try to increase reps
    const newReps = po.currentReps + po.repsIncrement;
    if (newReps <= po.maxReps) {
      po.currentReps = newReps;
    } else {
      // Reps maxed out — try to increase sets
      if (po.currentSets < po.maxSets) {
        po.currentSets++;
        po.currentReps = po.startReps; // reset reps to starting value
      } else {
        // Fully maxed: maxSets x maxReps
        po.currentReps = po.maxReps;
        po.currentSets = po.maxSets;
      }
    }
  }

  function advanceTimeProgressive(po) {
    po.currentTarget = Math.min(po.max, po.currentTarget + po.increment);
  }

  /* ===== PLAN VIEW ===== */
  function renderPlanView() {
    const plan = _state.trainingPlan;
    const listEl = document.getElementById('plan-items-list');
    const emptyEl = document.getElementById('plan-empty');

    if (!plan.items || plan.items.length === 0) {
      listEl.innerHTML = '';
      emptyEl.classList.remove('hidden');
      return;
    }

    emptyEl.classList.add('hidden');

    let html = '';
    for (const item of plan.items) {
      const def = getActivityDef(item.activityId);
      if (!def) continue;

      const amountLabel = getAmountLabel(item, def);
      const freqLabel = item.frequency.type === 'daily'
        ? 'Daily'
        : `${item.frequency.timesPerWeek}x per week`;

      let progTag = '';
      if (item.progressiveOverload) {
        const po = item.progressiveOverload;
        const rate = po.rate === 'weekly' ? 'weekly' : 'per session';
        if (po.type === 'reps') {
          progTag = `Progressive (${rate}): ${po.startSets}x${po.startReps} → ${po.maxSets}x${po.maxReps}`;
        } else {
          progTag = `Progressive (${rate}): ${po.min} → ${po.max} ${def.unit}`;
        }
      }

      html += `
        <div class="plan-card" data-plan-item-id="${item.id}">
          <div class="plan-card-top">
            <span class="plan-card-name">${def.name}</span>
            <div class="plan-card-actions">
              <button class="btn-edit" data-edit-id="${item.id}">Edit</button>
              <button class="btn-delete" data-delete-id="${item.id}">Remove</button>
            </div>
          </div>
          <div class="plan-card-details">
            <span class="plan-tag plan-tag-freq">${freqLabel}</span>
            <span class="plan-tag plan-tag-amount">${amountLabel}</span>
            ${progTag ? `<span class="plan-tag plan-tag-progressive">${progTag}</span>` : ''}
          </div>
        </div>
      `;
    }

    listEl.innerHTML = html;

    // Bind edit buttons
    listEl.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        openEditPlanItem(btn.dataset.editId);
      });
    });

    // Bind delete buttons
    listEl.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        removePlanItem(btn.dataset.deleteId);
      });
    });
  }

  /* ===== ACTIVITY PICKER ===== */
  function openActivityPicker() {
    _editingItemId = null;
    const grid = document.getElementById('activity-picker-grid');
    const search = document.getElementById('activity-search');
    const tagFilters = document.getElementById('tag-filters');

    // Collect all unique tags
    const allTags = new Set();
    _activities.forEach(a => (a.tags || []).forEach(t => allTags.add(t)));

    tagFilters.innerHTML = `
      <button class="tag-filter-btn active" data-tag="all">All</button>
      ${[...allTags].map(t =>
        `<button class="tag-filter-btn" data-tag="${t}">${t}</button>`
      ).join('')}
    `;

    let activeTag = 'all';

    function renderGrid(filter, tag) {
      let filtered = _activities;
      if (filter) {
        const q = filter.toLowerCase();
        filtered = filtered.filter(a =>
          a.name.toLowerCase().includes(q) ||
          (a.tags || []).some(t => t.toLowerCase().includes(q))
        );
      }
      if (tag && tag !== 'all') {
        filtered = filtered.filter(a => (a.tags || []).includes(tag));
      }

      grid.innerHTML = filtered.map(a => `
        <div class="activity-pick-card" data-activity-id="${a.id}">
          <div class="activity-pick-name">${a.name}</div>
          <div class="activity-pick-unit">${a.unit}</div>
        </div>
      `).join('');

      grid.querySelectorAll('.activity-pick-card').forEach(card => {
        card.addEventListener('click', () => {
          App.hideModal('modal-activity-picker');
          openConfigurePlanItem(card.dataset.activityId, null);
        });
      });
    }

    search.value = '';
    renderGrid('', 'all');

    search.oninput = () => renderGrid(search.value, activeTag);

    tagFilters.querySelectorAll('.tag-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        tagFilters.querySelectorAll('.tag-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTag = btn.dataset.tag;
        renderGrid(search.value, activeTag);
      });
    });

    App.showModal('modal-activity-picker');
  }

  /* ===== CONFIGURE PLAN ITEM ===== */
  function openConfigurePlanItem(activityId, existingItem) {
    const def = getActivityDef(activityId);
    if (!def) return;

    const titleEl = document.getElementById('plan-item-title');
    const confirmBtn = document.getElementById('btn-confirm-plan-item');
    const weeklyConfig = document.getElementById('weekly-config');
    const progressiveFields = document.getElementById('progressive-fields');
    const progressiveDynamic = document.getElementById('progressive-dynamic-fields');
    const amountFields = document.getElementById('amount-fields');

    titleEl.textContent = def.name;

    if (existingItem) {
      _editingItemId = existingItem.id;
      confirmBtn.textContent = 'Save Changes';
    } else {
      _editingItemId = null;
      confirmBtn.textContent = 'Add to Plan';
    }

    // Reset form
    const freqRadios = document.querySelectorAll('input[name="frequency"]');
    freqRadios[0].checked = true; // daily
    weeklyConfig.classList.add('hidden');
    document.getElementById('plan-times-per-week').value = 3;
    document.getElementById('plan-progressive').checked = false;
    progressiveFields.classList.add('hidden');

    // Reset rate radios
    const rateRadios = document.querySelectorAll('input[name="prog-rate"]');
    if (rateRadios[0]) rateRadios[0].checked = true;

    // Amount fields based on unit type
    if (def.unit === 'reps') {
      amountFields.innerHTML = `
        <div class="amount-row">
          <input type="number" id="plan-sets" class="form-input" min="1" value="3" style="width:60px">
          <span>x</span>
          <input type="number" id="plan-reps" class="form-input" min="1" value="10" style="width:60px">
          <span>${def.unit}</span>
        </div>
      `;
    } else {
      const midVal = def.durations[Math.floor(def.durations.length / 2)];
      amountFields.innerHTML = `
        <div class="amount-row">
          <input type="number" id="plan-amount-value" class="form-input" min="1" value="${midVal}" style="width:80px">
          <span>${def.unit}</span>
        </div>
      `;
    }

    // Build progressive overload dynamic fields based on unit type
    buildProgressiveFields(def);

    // Pre-fill if editing
    if (existingItem) {
      // Frequency
      if (existingItem.frequency.type === 'weekly') {
        freqRadios[1].checked = true;
        weeklyConfig.classList.remove('hidden');
        document.getElementById('plan-times-per-week').value = existingItem.frequency.timesPerWeek;
      }

      // Amount
      if (def.unit === 'reps' && existingItem.amount.sets) {
        document.getElementById('plan-sets').value = existingItem.amount.sets;
        document.getElementById('plan-reps').value = existingItem.amount.reps;
      } else if (existingItem.amount.value) {
        document.getElementById('plan-amount-value').value = existingItem.amount.value;
      }

      // Progressive overload
      if (existingItem.progressiveOverload) {
        const po = existingItem.progressiveOverload;
        document.getElementById('plan-progressive').checked = true;
        progressiveFields.classList.remove('hidden');

        // Rate
        const rateVal = po.rate || 'session';
        const rateRadio = document.querySelector(`input[name="prog-rate"][value="${rateVal}"]`);
        if (rateRadio) rateRadio.checked = true;

        // Fill type-specific fields
        if (po.type === 'reps') {
          setVal('prog-start-sets', po.startSets);
          setVal('prog-start-reps', po.startReps);
          setVal('prog-max-reps', po.maxReps);
          setVal('prog-max-sets', po.maxSets);
          setVal('prog-reps-increment', po.repsIncrement);
        } else {
          setVal('prog-time-start', po.min);
          setVal('prog-time-max', po.max);
          setVal('prog-time-increment', po.increment);
        }
      }
    }

    // Frequency radio change
    freqRadios.forEach(r => {
      r.onchange = () => {
        weeklyConfig.classList.toggle('hidden', r.value !== 'weekly' || !r.checked);
      };
    });

    // Progressive toggle
    document.getElementById('plan-progressive').onchange = (e) => {
      progressiveFields.classList.toggle('hidden', !e.target.checked);
      if (e.target.checked) {
        syncProgressiveDefaults(def, existingItem);
      }
    };

    // Store the activity ID for the confirm handler
    confirmBtn.dataset.activityId = activityId;

    App.showModal('modal-plan-item');
  }

  function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  function buildProgressiveFields(def) {
    const container = document.getElementById('progressive-dynamic-fields');

    if (def.unit === 'reps') {
      container.innerHTML = `
        <div class="form-row" style="margin-bottom:8px">
          <div class="form-field">
            <label class="form-label">Start sets</label>
            <input type="number" id="prog-start-sets" class="form-input" min="1" value="2">
          </div>
          <div class="form-field">
            <label class="form-label">Start reps</label>
            <input type="number" id="prog-start-reps" class="form-input" min="1" value="5">
          </div>
        </div>
        <div class="form-row" style="margin-bottom:8px">
          <div class="form-field">
            <label class="form-label">Max sets</label>
            <input type="number" id="prog-max-sets" class="form-input" min="1" value="4">
          </div>
          <div class="form-field">
            <label class="form-label">Max reps</label>
            <input type="number" id="prog-max-reps" class="form-input" min="1" value="12">
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label class="form-label">+ reps per progression</label>
            <input type="number" id="prog-reps-increment" class="form-input" min="1" value="2">
          </div>
        </div>
        <p class="form-hint" style="margin-top:6px">
          Reps increase each progression. When max reps is reached, sets go up and reps reset to start.
        </p>
      `;
    } else {
      // Time-based (min or sec)
      container.innerHTML = `
        <div class="form-row" style="margin-bottom:8px">
          <div class="form-field">
            <label class="form-label">Start (${def.unit})</label>
            <input type="number" id="prog-time-start" class="form-input" min="1" value="30">
          </div>
          <div class="form-field">
            <label class="form-label">Max (${def.unit})</label>
            <input type="number" id="prog-time-max" class="form-input" min="1" value="60">
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label class="form-label">+ per progression (${def.unit})</label>
            <input type="number" id="prog-time-increment" class="form-input" min="1" value="${def.unit === 'sec' ? 10 : 5}">
          </div>
        </div>
      `;
    }
  }

  function syncProgressiveDefaults(def, existingItem) {
    if (existingItem && existingItem.progressiveOverload) return; // Don't overwrite existing values

    if (def.unit === 'reps') {
      const setsEl = document.getElementById('plan-sets');
      const repsEl = document.getElementById('plan-reps');
      if (setsEl && repsEl) {
        setVal('prog-start-sets', parseInt(setsEl.value) || 2);
        setVal('prog-start-reps', parseInt(repsEl.value) || 5);
        setVal('prog-max-sets', Math.max((parseInt(setsEl.value) || 2) + 2, 4));
        setVal('prog-max-reps', Math.max((parseInt(repsEl.value) || 5) * 2, 12));
      }
    } else {
      const valEl = document.getElementById('plan-amount-value');
      if (valEl) {
        const v = parseInt(valEl.value) || 30;
        setVal('prog-time-start', v);
        setVal('prog-time-max', v * 2);
      }
    }
  }

  function openEditPlanItem(itemId) {
    const item = _state.trainingPlan.items.find(i => i.id === itemId);
    if (!item) return;
    openConfigurePlanItem(item.activityId, item);
  }

  /* ===== CONFIRM / SAVE PLAN ITEM ===== */
  function confirmPlanItem() {
    const confirmBtn = document.getElementById('btn-confirm-plan-item');
    const activityId = confirmBtn.dataset.activityId;
    const def = getActivityDef(activityId);
    if (!def) return;

    // Read frequency
    const freqType = document.querySelector('input[name="frequency"]:checked').value;
    const frequency = { type: freqType };
    if (freqType === 'weekly') {
      frequency.timesPerWeek = Math.max(1, Math.min(7,
        parseInt(document.getElementById('plan-times-per-week').value) || 3
      ));
    }

    // Read amount
    const amount = {};
    if (def.unit === 'reps') {
      amount.sets = Math.max(1, parseInt(document.getElementById('plan-sets').value) || 1);
      amount.reps = Math.max(1, parseInt(document.getElementById('plan-reps').value) || 1);
    } else {
      amount.value = Math.max(1, parseInt(document.getElementById('plan-amount-value').value) || 1);
      amount.unit = def.unit;
    }

    // Read progressive overload
    let progressiveOverload = null;
    if (document.getElementById('plan-progressive').checked) {
      const rate = document.querySelector('input[name="prog-rate"]:checked').value; // 'session' or 'weekly'

      if (def.unit === 'reps') {
        const startSets = Math.max(1, parseInt(document.getElementById('prog-start-sets').value) || 2);
        const startReps = Math.max(1, parseInt(document.getElementById('prog-start-reps').value) || 5);
        const maxSets = Math.max(startSets, parseInt(document.getElementById('prog-max-sets').value) || 4);
        const maxReps = Math.max(startReps, parseInt(document.getElementById('prog-max-reps').value) || 12);
        const repsIncrement = Math.max(1, parseInt(document.getElementById('prog-reps-increment').value) || 2);

        // Preserve current progress if editing
        let currentSets = startSets;
        let currentReps = startReps;
        let lastProgressionWeek = null;
        if (_editingItemId) {
          const existing = _state.trainingPlan.items.find(i => i.id === _editingItemId);
          if (existing && existing.progressiveOverload && existing.progressiveOverload.type === 'reps') {
            currentSets = Math.min(maxSets, Math.max(startSets, existing.progressiveOverload.currentSets));
            currentReps = Math.min(maxReps, Math.max(1, existing.progressiveOverload.currentReps));
            lastProgressionWeek = existing.progressiveOverload.lastProgressionWeek || null;
          }
        }

        progressiveOverload = {
          type: 'reps',
          rate,
          startSets,
          startReps,
          maxSets,
          maxReps,
          repsIncrement,
          currentSets,
          currentReps,
          lastProgressionWeek
        };
      } else {
        // Time-based (min or sec)
        const min = Math.max(1, parseInt(document.getElementById('prog-time-start').value) || 30);
        const max = Math.max(min + 1, parseInt(document.getElementById('prog-time-max').value) || 60);
        const increment = Math.max(1, parseInt(document.getElementById('prog-time-increment').value) || 5);

        // Preserve current progress if editing
        let currentTarget = min;
        let lastProgressionWeek = null;
        if (_editingItemId) {
          const existing = _state.trainingPlan.items.find(i => i.id === _editingItemId);
          if (existing && existing.progressiveOverload && existing.progressiveOverload.type === 'time') {
            currentTarget = Math.min(max, Math.max(min, existing.progressiveOverload.currentTarget));
            lastProgressionWeek = existing.progressiveOverload.lastProgressionWeek || null;
          }
        }

        progressiveOverload = {
          type: 'time',
          rate,
          min,
          max,
          currentTarget,
          increment,
          unit: def.unit,
          lastProgressionWeek
        };
      }
    }

    if (_editingItemId) {
      const item = _state.trainingPlan.items.find(i => i.id === _editingItemId);
      if (item) {
        item.activityId = activityId;
        item.frequency = frequency;
        item.amount = amount;
        item.progressiveOverload = progressiveOverload;
      }
    } else {
      _state.trainingPlan.items.push({
        id: generateId('pi'),
        activityId,
        frequency,
        amount,
        progressiveOverload
      });
    }

    _state.trainingPlan.updatedAt = Date.now();
    Storage.saveState(_state);

    App.hideModal('modal-plan-item');
    renderPlanView();
    renderTodayView();

    App.showToast(_editingItemId ? 'Activity updated' : 'Activity added to plan', 'info');
    _editingItemId = null;
  }

  function removePlanItem(itemId) {
    if (!confirm('Remove this activity from your plan?')) return;
    _state.trainingPlan.items = _state.trainingPlan.items.filter(i => i.id !== itemId);
    _state.trainingPlan.updatedAt = Date.now();
    Storage.saveState(_state);
    renderPlanView();
    renderTodayView();
    App.showToast('Activity removed', 'info');
  }

  return {
    init,
    setState,
    renderTodayView,
    renderPlanView,
    openActivityPicker,
    confirmPlanItem,
    getScheduledForToday,
    getAllScheduledForToday,
    isCompletedToday,
    getWeeklyCount,
    completeActivity,
    getActivityDef
  };
})();
