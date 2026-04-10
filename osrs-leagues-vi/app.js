// =============================================
// OSRS Leagues VI — Region Picker & Task Tracker
// =============================================

const MAX_CHOICES = 3;
const LS_KEY = 'osrsl6_v1';
const WIKI_TASKS_PAGE = 'Demonic_Pacts_League/Tasks';

// ─── State ────────────────────────────────────
const state = {
  activeTab:       null,
  viewMode:        'single',    // 'single' | 'overview'
  selectedRegion:  null,        // id of region showing in single view
  chosenRegions:   new Set(),   // user's picked region ids
  tasks:           [],          // { id, area, name, task, reqs, pts, comp, done }
  taskFilter: { search: '', area: '', pts: '', status: '', skill: '' },
  taskSort: 'default',
  selectedRelics:  {},          // { [tier]: relicId }
  reloadedRelicId: null,        // bonus relic chosen via Reloaded (T7)
  selectedSkill:   null,        // skill name currently shown in Skills tab
  colWidths:       {},          // { [cls]: px } for task table columns
  importCollapsed: false,       // whether the Import Tasks panel is collapsed
};

function applyImportCollapsed() {
  const body    = document.getElementById('import-box-body');
  const chevron = document.getElementById('import-box-chevron');
  body.hidden   = state.importCollapsed;
  chevron.textContent = state.importCollapsed ? '▸' : '▾';
}

// ─── Init ─────────────────────────────────────
function init() {
  loadFromStorage();
  renderRegionList();
  renderViewMode();

  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // View buttons
  document.getElementById('btn-single-view').addEventListener('click', () => setViewMode('single'));
  document.getElementById('btn-overview').addEventListener('click', () => setViewMode('overview'));

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // Task imports + filters
  document.getElementById('btn-import-tasks').addEventListener('click', importTasks);
  document.getElementById('btn-fetch-wiki').addEventListener('click', fetchTasksFromWiki);

  // Import box collapse (persisted)
  applyImportCollapsed();
  document.getElementById('import-box-toggle').addEventListener('click', () => {
    state.importCollapsed = !state.importCollapsed;
    applyImportCollapsed();
    saveToStorage();
  });

  // Paste section collapse (not persisted — always starts collapsed)
  document.getElementById('paste-section-toggle').addEventListener('click', () => {
    const body    = document.getElementById('paste-section-body');
    const btn     = document.getElementById('paste-section-toggle');
    const open    = body.hidden;
    body.hidden   = !open;
    btn.textContent = (open ? '▾' : '▸') + ' Paste manually';
  });

  // "All" checkbox toggles every region checkbox
  const allCb = document.getElementById('import-region-all');
  allCb.addEventListener('change', () => {
    document.querySelectorAll('.import-region-cb').forEach(cb => { cb.checked = allCb.checked; });
  });
  // Keep "All" in sync when individual boxes change
  document.querySelectorAll('.import-region-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const all  = document.querySelectorAll('.import-region-cb');
      const checked = document.querySelectorAll('.import-region-cb:checked');
      allCb.checked = all.length === checked.length;
      allCb.indeterminate = checked.length > 0 && checked.length < all.length;
    });
  });
  document.getElementById('btn-clear-filters').addEventListener('click', clearFilters);
  document.getElementById('btn-clear-tasks').addEventListener('click', clearAllTasks);
  document.getElementById('filter-search').addEventListener('input', applyFilters);
  document.getElementById('filter-area').addEventListener('change', applyFilters);
  document.getElementById('filter-pts').addEventListener('change', applyFilters);
  document.getElementById('filter-status').addEventListener('change', applyFilters);
  document.getElementById('filter-skill').addEventListener('change', applyFilters);
  populateSkillFilter();

  // Context menu — stop propagation inside menu so document click doesn't fire on item clicks
  const ctxMenu = document.getElementById('task-context-menu');
  ctxMenu.addEventListener('click', e => e.stopPropagation());
  document.getElementById('ctx-close').addEventListener('click', e => { e.stopPropagation(); hideContextMenu(); });
  document.getElementById('ctx-pin').addEventListener('click', () => { if (contextTaskId) togglePin(contextTaskId); hideContextMenu(); });
  document.getElementById('ctx-toggle').addEventListener('click', () => { if (contextTaskId) toggleTask(contextTaskId); hideContextMenu(); });
  document.getElementById('ctx-edit').addEventListener('click', () => { if (contextTaskId) openEditModal(contextTaskId); hideContextMenu(); });
  document.getElementById('ctx-remove').addEventListener('click', () => {
    if (!contextTaskId) return;
    const id = contextTaskId;
    const task = state.tasks.find(t => String(t.id) === String(id));
    hideContextMenu();
    showAppConfirm(
      'Remove Task',
      `Remove "${task ? task.name : 'this task'}"?`,
      () => removeTask(id),
      'Remove'
    );
  });
  document.addEventListener('click', hideContextMenu);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideContextMenu(); });

  // Edit modal
  document.getElementById('task-edit-close').addEventListener('click', closeEditModal);
  document.getElementById('task-edit-cancel').addEventListener('click', closeEditModal);
  document.getElementById('task-edit-save').addEventListener('click', saveEditTask);
  document.getElementById('task-edit-overlay').addEventListener('click', e => { if (e.target === document.getElementById('task-edit-overlay')) closeEditModal(); });

  // Global confirm dialog
  document.getElementById('app-confirm-ok').addEventListener('click', () => closeAppConfirm(true));
  document.getElementById('app-confirm-cancel').addEventListener('click', () => closeAppConfirm(false));
  document.getElementById('app-confirm-x').addEventListener('click', () => closeAppConfirm(false));
  document.getElementById('app-confirm-dialog').addEventListener('click', e => { if (e.target === document.getElementById('app-confirm-dialog')) closeAppConfirm(false); });

  // Sort buttons
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.taskSort = btn.dataset.sort;
      renderTaskTable();
    });
  });

  // Close build popup when clicking outside the summary wrap
  document.addEventListener('click', e => {
    if (_rsActiveRelicId && !e.target.closest('#relic-summary-wrap')) closeRsPopup();
  });

  // Reloaded relic picker
  document.getElementById('reloaded-picker-close')   .addEventListener('click', closeReloadedPicker);
  document.getElementById('reloaded-picker-backdrop').addEventListener('click', closeReloadedPicker);

  // Relic image lightbox
  document.getElementById('relic-lightbox-close').addEventListener('click', closeRelicLightbox);
  document.getElementById('relic-lightbox-backdrop').addEventListener('click', closeRelicLightbox);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeRelicLightbox(); closeReloadedPicker(); closeAppConfirm(false); } });
  initLightboxZoom();

  initColumnResize();
  window.addEventListener('resize', updateTaskStickyOffsets);

  // Legacy tabs toggle (Region Picker + Skills)
  document.getElementById('btn-legacy-toggle').addEventListener('click', () => {
    const isHidden = document.getElementById('tab-btn-picker').classList.contains('tab-btn-hidden');
    ['tab-btn-picker', 'tab-btn-skills'].forEach(id => {
      document.getElementById(id).classList.toggle('tab-btn-hidden', !isHidden);
    });
    document.getElementById('btn-legacy-toggle').textContent = isHidden ? '✕ Hide' : '⚠ More';
    // If hiding and currently on a legacy tab, go back to Relics
    if (!isHidden && (state.activeTab === 'picker' || state.activeTab === 'skills')) {
      switchTab('relics');
    }
  });

  // Incomplete banner dismiss
  document.querySelectorAll('.incomplete-banner-close').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.banner).hidden = true;
    });
  });

  // Auto-open Varlamore
  openRegion('varlamore');

  // Default to Relics tab if no saved tab; restore saved tab otherwise
  const savedTab = state.activeTab;
  if (!savedTab || savedTab === 'picker') {
    restoreTab('relics');
  } else {
    restoreTab(savedTab);
  }
  // Show legacy tabs in nav if saved tab was one of them
  if (savedTab === 'picker' || savedTab === 'skills') {
    ['tab-btn-picker', 'tab-btn-skills'].forEach(id => {
      document.getElementById(id).classList.remove('tab-btn-hidden');
    });
    document.getElementById('btn-legacy-toggle').textContent = '✕ Hide';
  }
}

function openRelicLightbox(src, alt) {
  const lb = document.getElementById('relic-lightbox');
  document.getElementById('relic-lightbox-img').src = src;
  document.getElementById('relic-lightbox-img').alt = alt;
  lb.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
  resetLightboxZoom();
}

function closeRelicLightbox() {
  document.getElementById('relic-lightbox').setAttribute('hidden', '');
  document.body.style.overflow = '';
  resetLightboxZoom();
}

// ─── Lightbox zoom & pan ──────────────────────
let _lbScale = 1, _lbPanX = 0, _lbPanY = 0;
let _lbDragging = false, _lbDragMoved = false, _lbDragX = 0, _lbDragY = 0, _lbDragPanX = 0, _lbDragPanY = 0;
const LB_MIN = 1, LB_MAX = 8;

function applyLightboxTransform() {
  const img = document.getElementById('relic-lightbox-img');
  img.style.transform = `translateX(${_lbPanX}px) translateY(${_lbPanY}px) scale(${_lbScale})`;
  img.style.cursor = _lbScale > 1 ? (_lbDragging ? 'grabbing' : 'grab') : 'zoom-in';
}

function resetLightboxZoom() {
  _lbScale = 1; _lbPanX = 0; _lbPanY = 0; _lbDragging = false;
  const img = document.getElementById('relic-lightbox-img');
  if (img) { img.style.transform = ''; img.style.cursor = 'zoom-in'; }
}

function initLightboxZoom() {
  const img = document.getElementById('relic-lightbox-img');

  // Scroll to zoom, centered on cursor
  img.addEventListener('wheel', e => {
    e.preventDefault();
    const factor   = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newScale = Math.min(LB_MAX, Math.max(LB_MIN, _lbScale * factor));
    if (newScale === _lbScale) return;

    // Compute cursor position relative to the element's layout center.
    // getBoundingClientRect gives visual rect (includes current transform).
    // Visual center = layout center + (_lbPanX, _lbPanY), so:
    const rect = img.getBoundingClientRect();
    const visCX = rect.left + rect.width  / 2;
    const visCY = rect.top  + rect.height / 2;
    const cx = e.clientX - (visCX - _lbPanX); // cursor relative to layout center
    const cy = e.clientY - (visCY - _lbPanY);

    _lbPanX = cx - (cx - _lbPanX) * newScale / _lbScale;
    _lbPanY = cy - (cy - _lbPanY) * newScale / _lbScale;
    _lbScale = newScale;
    applyLightboxTransform();
  }, { passive: false });

  // Drag to pan / click to zoom in
  img.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    _lbDragging = true;
    _lbDragMoved = false;
    _lbDragX = e.clientX; _lbDragY = e.clientY;
    _lbDragPanX = _lbPanX; _lbDragPanY = _lbPanY;
    if (_lbScale > 1) img.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', e => {
    if (!_lbDragging) return;
    const dx = e.clientX - _lbDragX, dy = e.clientY - _lbDragY;
    if (!_lbDragMoved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) _lbDragMoved = true;
    if (_lbDragMoved && _lbScale > 1) {
      _lbPanX = _lbDragPanX + dx;
      _lbPanY = _lbDragPanY + dy;
      applyLightboxTransform();
    }
  });

  document.addEventListener('mouseup', e => {
    if (!_lbDragging) return;
    _lbDragging = false;
    if (!_lbDragMoved) {
      // Click — zoom in centered on cursor (or reset if already at max)
      const newScale = Math.min(LB_MAX, _lbScale * 1.75);
      const rect = img.getBoundingClientRect();
      const cx = e.clientX - (rect.left + rect.width  / 2 - _lbPanX);
      const cy = e.clientY - (rect.top  + rect.height / 2 - _lbPanY);
      _lbPanX = cx - (cx - _lbPanX) * newScale / _lbScale;
      _lbPanY = cy - (cy - _lbPanY) * newScale / _lbScale;
      _lbScale = newScale;
    }
    applyLightboxTransform();
  });

  // Double-click to reset zoom
  img.addEventListener('dblclick', resetLightboxZoom);
}

// ─── Tab switching ────────────────────────────

// restoreTab: visual-only, called once on load from saved state.
// Does not save to storage, does not trigger EG.activateTab (EG.init handles that itself).
function restoreTab(tab) {
  state.activeTab = tab;
  // Remove the pre-paint style fix now that real classes are being applied
  const fix = document.getElementById('init-tab-fix');
  if (fix) fix.remove();
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
    btn.setAttribute('aria-selected', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.toggle('active', el.id === `tab-${tab}`);
    el.hidden = el.id !== `tab-${tab}`;
  });
  if (tab === 'tasks')  { renderTaskStats(); requestAnimationFrame(updateTaskStickyOffsets); }
  if (tab === 'relics') renderRelics();
  if (tab === 'skills') renderSkillsTab();
  // 'early' tab: EG.init() detects the active tab itself and calls activateEarlyTab()
}

function switchTab(tab) {
  state.activeTab = tab;
  saveToStorage();
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
    btn.setAttribute('aria-selected', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.toggle('active', el.id === `tab-${tab}`);
    el.hidden = el.id !== `tab-${tab}`;
  });
  if (tab === 'tasks') { renderTaskStats(); requestAnimationFrame(updateTaskStickyOffsets); }
  if (tab === 'relics') renderRelics();
  if (tab === 'skills') renderSkillsTab();
  if (tab === 'early' && typeof EG !== 'undefined' && EG?.activateTab) EG.activateTab();
}

// ─── View mode (single / overview) ───────────
function setViewMode(mode) {
  state.viewMode = mode;
  document.getElementById('btn-single-view').classList.toggle('active', mode === 'single');
  document.getElementById('btn-overview').classList.toggle('active', mode === 'overview');
  renderViewMode();
}

function renderViewMode() {
  if (state.viewMode === 'overview') {
    renderOverview();
  } else {
    if (state.selectedRegion) {
      openRegion(state.selectedRegion);
    } else {
      document.getElementById('detail-panel').innerHTML = `
        <div class="detail-placeholder"><p>← Select a region to view details</p></div>
      `;
    }
  }
}

// ─── Render sidebar list ──────────────────────
function renderRegionList() {
  const starters = REGIONS.filter(r => r.type === 'starter');
  const frees    = REGIONS.filter(r => r.type === 'free');
  const choices  = REGIONS.filter(r => r.type === 'choice');

  document.getElementById('starter-regions').innerHTML = starters.map(regionRowHTML).join('');
  document.getElementById('free-regions').innerHTML    = frees.map(regionRowHTML).join('');
  document.getElementById('choice-regions').innerHTML  = choices.map(regionRowHTML).join('');
  document.getElementById('choice-counter').textContent = `${state.chosenRegions.size} / ${MAX_CHOICES}`;

  attachRowListeners();
}

function regionRowHTML(region) {
  const isActive  = state.selectedRegion === region.id;
  const isLocked  = region.type === 'starter' || region.type === 'free';
  const isChosen  = state.chosenRegions.has(region.id);
  const dotClass  = isLocked
    ? (region.type === 'starter' ? 'dot-starter' : 'dot-free')
    : (isChosen ? 'dot-selected' : 'dot-choice');

  let checkContent = '';
  let checkClass   = 'region-check';
  if (isLocked) {
    checkContent = '★';
    checkClass  += ' locked';
  } else if (isChosen) {
    checkContent = '✓';
    checkClass  += ' checked';
  }

  return `
    <div class="region-row" data-id="${region.id}">
      <div class="${checkClass}" data-check="${region.id}" title="${isLocked ? 'Always unlocked' : (isChosen ? 'Remove from selection' : 'Add to selection')}">${checkContent}</div>
      <button class="region-btn ${isActive ? 'active' : ''}" data-view="${region.id}">
        <span class="region-icon">${region.icon}</span>
        <span class="region-name">${region.name}</span>
        <span class="region-type-dot ${dotClass}"></span>
      </button>
    </div>
  `;
}

function attachRowListeners() {
  // View buttons
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.viewMode = 'single';
      document.getElementById('btn-single-view').classList.add('active');
      document.getElementById('btn-overview').classList.remove('active');
      openRegion(btn.dataset.view);
    });
  });

  // Checkboxes (choice regions only)
  document.querySelectorAll('[data-check]').forEach(box => {
    if (box.classList.contains('locked')) return;
    box.addEventListener('click', () => {
      const id = box.dataset.check;
      if (state.chosenRegions.has(id)) {
        state.chosenRegions.delete(id);
      } else if (state.chosenRegions.size < MAX_CHOICES) {
        state.chosenRegions.add(id);
      }
      renderRegionList();
      // If in overview mode, refresh it
      if (state.viewMode === 'overview') renderOverview();
    });
  });
}

// ─── Single region detail ─────────────────────
function openRegion(id) {
  state.selectedRegion = id;
  const region = REGIONS.find(r => r.id === id);
  if (!region) return;

  renderRegionList(); // update active state

  const panel = document.getElementById('detail-panel');
  panel.innerHTML = buildDetailHTML(region);

  // "All regions →" button in each skill block → jump to Skills tab
  panel.querySelectorAll('.skr-view-all').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      switchTab('skills');
      openSkill(btn.dataset.skill);
    });
  });
}

function buildDetailHTML(region) {
  const typeLabel = {
    starter: '★ Starter Region — Always Unlocked',
    free:    '✦ Free Region — First Unlock',
    choice:  '◆ Choice Region',
  }[region.type];

  // Section order: Bosses, Raids, Echo Bosses, Gear, Skills, Special Unlocks, Quests
  const sections = [];

  // 1. Bosses
  if (region.bosses?.length) {
    sections.push(`
      <div class="detail-section">
        <div class="detail-section-title">💀 Bosses</div>
        <div class="item-list">${region.bosses.map(b => itemCardHTML(b, false)).join('')}</div>
      </div>
    `);
  }

  // 2. Raids
  if (region.raids?.length) {
    sections.push(`
      <div class="detail-section">
        <div class="detail-section-title">⚔️ Raids</div>
        <div class="item-list">${region.raids.map(b => itemCardHTML(b, true)).join('')}</div>
      </div>
    `);
  }

  // 3. Echo Bosses
  if (region.echoBosses?.length) {
    sections.push(`
      <div class="detail-section">
        <div class="detail-section-title">✨ Echo Bosses</div>
        <p class="echo-disclaimer">${ECHO_BOSSES_NOTE}</p>
        <div class="item-list">${region.echoBosses.map(b => echoCardHTML(b)).join('')}</div>
      </div>
    `);
  }

  // 4. Skills
  if (region.skills?.length) {
    sections.push(`
      <div class="detail-section">
        <div class="detail-section-title">⚗️ Skills</div>
        <div class="skills-expanded">${region.skills.map(buildRegionSkillBlock).join('')}</div>
      </div>
    `);
  }

  // 5. Special Unlocks
  if (region.specialUnlocks?.length) {
    sections.push(`
      <div class="detail-section">
        <div class="detail-section-title">🔓 Special Unlocks</div>
        <div class="unlocks-grid">${region.specialUnlocks.map(unlockCardHTML).join('')}</div>
      </div>
    `);
  }

  // 6. Quests
  if (region.quests?.length) {
    sections.push(`
      <div class="detail-section">
        <div class="detail-section-title">📜 Notable Quests</div>
        <div class="item-list">${region.quests.map(b => itemCardHTML(b, false)).join('')}</div>
      </div>
    `);
  }

  // 7. Overview / special rules
  if (region.overview) {
    sections.push(`
      <div class="detail-section">
        <div class="detail-section-title">ℹ️ League Rules & Notes</div>
        <p class="region-overview-text">${region.overview}</p>
      </div>
    `);
  }

  // 8. Start boosts (Varlamore only)
  if (region.startBoosts?.length) {
    sections.push(`
      <div class="detail-section">
        <div class="detail-section-title">⬆️ Starting Stat Boosts</div>
        <div class="tag-list">${region.startBoosts.map(b => `<span class="tag tag-boost">${b}</span>`).join('')}</div>
      </div>
    `);
  }

  // 9. Auto-completed quests
  if (region.autoQuests?.length) {
    const label = region.id === 'varlamore'
      ? '📜 Auto-Completed Quests <span class="section-note">(league-wide, no XP awarded)</span>'
      : '📜 Auto-Completed Quests <span class="section-note">(no XP awarded)</span>';
    sections.push(`
      <div class="detail-section">
        <div class="detail-section-title">${label}</div>
        <div class="tag-list">${region.autoQuests.map(q => `<span class="tag tag-quest">${q}</span>`).join('')}</div>
      </div>
    `);
  }

  // 10. Auto-completed diary tasks
  if (region.autoDiary?.length) {
    const diaryGroups = region.autoDiary.map(d => `
      <div class="diary-group">
        <div class="diary-group-name">${d.diary} Diary</div>
        <ul class="diary-task-list">${d.tasks.map(t => `<li>${t}</li>`).join('')}</ul>
      </div>
    `).join('');
    sections.push(`
      <div class="detail-section">
        <div class="detail-section-title">📋 Auto-Completed Diary Tasks</div>
        ${diaryGroups}
      </div>
    `);
  }

  // 11. Auto-completed combat achievements
  if (region.autoCombatAchievements?.length) {
    sections.push(`
      <div class="detail-section">
        <div class="detail-section-title">🏆 Auto-Completed Combat Achievements</div>
        <div class="tag-list">${region.autoCombatAchievements.map(a => `<span class="tag tag-ca">${a}</span>`).join('')}</div>
      </div>
    `);
  }

  // 12. Key drops
  if (region.keyDrops?.length) {
    sections.push(`
      <div class="detail-section">
        <div class="detail-section-title">💰 Key Drops</div>
        <ul class="key-drops-list">${region.keyDrops.map(d => `<li>${d}</li>`).join('')}</ul>
      </div>
    `);
  }

  return `
    <div class="region-detail-header">
      <div class="region-detail-icon">${region.icon}</div>
      <div>
        <div class="region-detail-title">${region.name}</div>
        <div class="region-detail-type">${typeLabel}</div>
      </div>
    </div>
    <p class="region-detail-desc">${region.description}</p>
    ${sections.join('')}
  `;
}

function itemCardHTML(item, isRaid) {
  const nameEl = item.wikiUrl
    ? `<a class="boss-wiki-link" href="${item.wikiUrl}" target="_blank" rel="noopener">${item.name} <span class="wiki-icon">↗</span></a>`
    : item.name;
  const drops = item.drops?.length
    ? `<div class="boss-drops">${item.drops.join(' · ')}</div>`
    : '';
  return `
    <div class="item-card ${isRaid ? 'raid-card' : ''}">
      <div class="item-card-icon">${item.icon || '📌'}</div>
      <div class="item-card-body">
        <div class="item-card-name">${nameEl}</div>
        ${drops}
      </div>
    </div>
  `;
}

function echoCardHTML(item) {
  const nameEl = item.wikiUrl
    ? `<a class="boss-wiki-link echo-link" href="${item.wikiUrl}" target="_blank" rel="noopener">${item.name} <span class="wiki-icon">↗</span></a>`
    : item.name;
  const diffBadge = item.difficulty
    ? `<span class="echo-diff">${item.difficulty}</span>`
    : '';
  const drops = item.drops?.length
    ? `<div class="boss-drops">${item.drops.join(' · ')}</div>`
    : '';
  return `
    <div class="echo-card">
      <div class="item-card-icon">${item.icon || '✨'}</div>
      <div class="item-card-body">
        <div class="item-card-name">${nameEl}${diffBadge}</div>
        ${drops}
      </div>
    </div>
  `;
}

// ─── Shared skill block builders ──────────────

// Used in Region Picker detail: skill header (name+rating) + methods + notes
function buildRegionSkillBlock(skillEntry) {
  const icon = SKILL_ICONS[skillEntry.skill] || '❓';
  const methodsHTML = skillEntry.methods?.length
    ? `<ul class="skr-methods">${skillEntry.methods.map(m => `<li>${m}</li>`).join('')}</ul>` : '';
  const notesHTML = skillEntry.notes?.length
    ? `<ul class="skr-notes">${skillEntry.notes.map(n => `<li>${n}</li>`).join('')}</ul>` : '';
  return `
    <div class="skill-region-block">
      <div class="skr-header">
        <span class="skr-icon">${icon}</span>
        <span class="skr-name">${skillEntry.skill}</span>
        <span class="skr-rating-pill rating-${skillEntry.rating}">${skillEntry.rating}</span>
        <button class="skr-view-all" data-skill="${skillEntry.skill}">All regions ↗</button>
      </div>
      <div class="skr-summary">${skillEntry.summary}</div>
      ${methodsHTML}
      ${notesHTML}
    </div>
  `;
}

// Used in Skills tab: region header (icon+name+type+rating) + methods + notes
function buildSkillRegionBlock(skillEntry, region) {
  const methodsHTML = skillEntry.methods?.length
    ? `<ul class="skr-methods">${skillEntry.methods.map(m => `<li>${m}</li>`).join('')}</ul>` : '';
  const notesHTML = skillEntry.notes?.length
    ? `<ul class="skr-notes">${skillEntry.notes.map(n => `<li>${n}</li>`).join('')}</ul>` : '';
  const typeLabel = { starter: '★ Starter', free: '✦ Free', choice: '◆ Choice' }[region.type] || region.type;
  return `
    <div class="skill-region-block skr-region-variant">
      <div class="skr-header">
        <span class="skr-icon">${region.icon}</span>
        <span class="skr-name">${region.name}</span>
        <span class="skr-type-tag type-${region.type}">${typeLabel}</span>
        <span class="skr-rating-pill rating-${skillEntry.rating}">${skillEntry.rating}</span>
      </div>
      <div class="skr-summary">${skillEntry.summary}</div>
      ${methodsHTML}
      ${notesHTML}
    </div>
  `;
}

function unlockCardHTML(unlock) {
  return `
    <div class="unlock-card">
      <div class="unlock-name">${unlock.name}</div>
      <div class="unlock-desc">${unlock.desc}</div>
    </div>
  `;
}

// ─── Skills Tab ───────────────────────────────
function renderSkillsTab() {
  const navEl = document.getElementById('skill-nav-list');
  navEl.innerHTML = ALL_SKILLS.map(skillName => {
    const icon  = SKILL_ICONS[skillName] || '❓';
    const isActive = state.selectedSkill === skillName;
    return `
      <button class="skill-nav-btn ${isActive ? 'active' : ''}" data-skill="${skillName}">
        <span class="skill-nav-icon">${icon}</span>
        <span class="skill-nav-label">${skillName}</span>
      </button>`;
  }).join('');

  navEl.querySelectorAll('.skill-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => openSkill(btn.dataset.skill));
  });

  if (state.selectedSkill) {
    renderSkillDetail();
  } else {
    document.getElementById('skill-detail-panel').innerHTML =
      `<div class="detail-placeholder"><p>← Select a skill to view training methods by region</p></div>`;
  }
}

function openSkill(skillName) {
  state.selectedSkill = skillName;
  // Update active nav state if the skill nav is visible
  document.querySelectorAll('.skill-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.skill === skillName);
  });
  renderSkillDetail();
}

function renderSkillDetail() {
  const skillName = state.selectedSkill;
  if (!skillName) return;
  const icon     = SKILL_ICONS[skillName] || '❓';
  const wikiUrl  = `${WIKI}${encodeURIComponent(skillName)}`;
  const regions  = REGIONS.filter(r => r.skills?.some(s => s.skill === skillName));

  const blocksHTML = regions.length
    ? regions.map(r => buildSkillRegionBlock(r.skills.find(s => s.skill === skillName), r)).join('')
    : `<p class="skr-empty">No region-specific training data for this skill yet.</p>`;

  document.getElementById('skill-detail-panel').innerHTML = `
    <div class="skill-detail-header">
      <span class="skill-detail-icon">${icon}</span>
      <span class="skill-detail-title">${skillName}</span>
      <a class="skill-wiki-link" href="${wikiUrl}" target="_blank" rel="noopener">
        Wiki page ↗
      </a>
    </div>
    <div class="skill-region-list">${blocksHTML}</div>
  `;
}

function closeModal() {
  document.getElementById('modal-overlay').setAttribute('hidden', '');
}

// ─── OVERVIEW ─────────────────────────────────
function renderOverview() {
  // Active regions = starter + free + chosen
  const activeRegions = REGIONS.filter(r =>
    r.type === 'starter' ||
    r.type === 'free' ||
    state.chosenRegions.has(r.id)
  );

  const panel = document.getElementById('detail-panel');

  // Chips
  const chipsHTML = activeRegions.map(r => `
    <span class="overview-region-chip">${r.icon} ${r.name}</span>
  `).join('');

  const chosenCount = state.chosenRegions.size;
  const notice = chosenCount < MAX_CHOICES
    ? `<p class="overview-empty-notice">Select ${MAX_CHOICES - chosenCount} more region${MAX_CHOICES - chosenCount !== 1 ? 's' : ''} using the checkboxes on the left.</p>`
    : '';

  // Skills coverage
  const skillsCoverageHTML = buildSkillsCoverage(activeRegions);

  // Bosses grouped by region
  const bossesHTML = buildOverviewSection(activeRegions, 'bosses', '💀 Bosses', false);

  // Raids grouped by region
  const raidsHTML = buildOverviewSection(activeRegions, 'raids', '⚔️ Raids', true);

  // Echo bosses
  const echoHTML = buildEchoSection(activeRegions);

  const unlocksHTML      = buildUnlocksOverview(activeRegions);
  const autoQuestsHTML   = buildAutoQuestsOverview(activeRegions);
  const autoDiaryHTML    = buildAutoDiaryOverview(activeRegions);
  const autoCAsHTML      = buildAutoCAsOverview(activeRegions);
  const keyDropsHTML     = buildKeyDropsOverview(activeRegions);
  const notesHTML        = buildNotesOverview(activeRegions);

  panel.innerHTML = `
    <div class="overview-header">
      <div class="overview-title">📊 Region Overview</div>
      <div class="overview-regions">${chipsHTML}</div>
      ${notice}
    </div>

    <div class="ov-section">
      <div class="ov-section-title">⚗️ Skills Coverage</div>
      <div class="overview-skills-grid">${skillsCoverageHTML}</div>
    </div>

    ${bossesHTML}
    ${raidsHTML}
    ${echoHTML}
    ${unlocksHTML}
    ${autoQuestsHTML}
    ${autoDiaryHTML}
    ${autoCAsHTML}
    ${keyDropsHTML}
    ${notesHTML}
  `;

  // Skill cards → jump to Skills tab
  panel.querySelectorAll('.ov-skill-card[data-skill]').forEach(card => {
    card.addEventListener('click', () => {
      switchTab('skills');
      openSkill(card.dataset.skill);
    });
  });
}

function buildSkillsCoverage(activeRegions) {
  const RATING_ORDER = { excellent: 4, good: 3, decent: 2, poor: 1 };
  const FILL_CLASS   = { excellent: 'fill-excellent', good: 'fill-good', decent: 'fill-decent', poor: 'fill-poor', none: 'fill-none' };

  return ALL_SKILLS.map(skillName => {
    let bestRating = null;
    let bestRegion = null;
    let bestRatingVal = 0;

    activeRegions.forEach(region => {
      const skill = region.skills?.find(s => s.skill === skillName);
      if (skill) {
        const val = RATING_ORDER[skill.rating] || 0;
        if (val > bestRatingVal) {
          bestRatingVal = val;
          bestRating    = skill.rating;
          bestRegion    = region;
        }
      }
    });

    const icon       = SKILL_ICONS[skillName] || '❓';
    const fillClass  = bestRating ? FILL_CLASS[bestRating] : FILL_CLASS.none;
    const cardClass  = bestRating ? `covered-${bestRating}` : 'not-covered';
    const regionName = bestRegion ? bestRegion.name : '—';
    const tooltip    = bestRating ? `${bestRating} (${regionName})` : 'Not covered';

    const clickAttrs = bestRegion
      ? `data-skill="${skillName}" data-region="${bestRegion.id}" style="cursor:pointer"`
      : '';

    return `
      <div class="ov-skill-card ${cardClass}" ${clickAttrs} title="${tooltip}">
        <div class="ov-skill-inner">
          <span class="ov-skill-icon">${icon}</span>
          <span class="ov-skill-name">${skillName}</span>
        </div>
        <div class="ov-skill-bar"><div class="ov-skill-bar-fill ${fillClass}"></div></div>
        <div class="ov-skill-region">${bestRating ? `${bestRating} · ${regionName}` : 'Not covered'}</div>
      </div>
    `;
  }).join('');
}

function buildOverviewSection(activeRegions, key, title, isRaid) {
  const withContent = activeRegions.filter(r => r[key]?.length);
  if (!withContent.length) return '';

  const groups = withContent.map(region => `
    <div class="ov-region-group">
      <div class="ov-region-label">${region.icon} ${region.name}</div>
      <div class="item-list">${region[key].map(b => itemCardHTML(b, isRaid)).join('')}</div>
    </div>
  `).join('');

  return `
    <div class="ov-section">
      <div class="ov-section-title">${title}</div>
      ${groups}
    </div>
  `;
}

function buildEchoSection(activeRegions) {
  const withEcho = activeRegions.filter(r => r.echoBosses?.length);
  if (!withEcho.length) return '';

  const groups = withEcho.map(region => `
    <div class="ov-region-group">
      <div class="ov-region-label">${region.icon} ${region.name}</div>
      <div class="item-list">${region.echoBosses.map(echoCardHTML).join('')}</div>
    </div>
  `).join('');

  return `
    <div class="ov-section">
      <div class="ov-section-title">✨ Echo Bosses</div>
      <p class="echo-disclaimer">${ECHO_BOSSES_NOTE}</p>
      ${groups}
    </div>
  `;
}


function buildUnlocksOverview(activeRegions) {
  const withUnlocks = activeRegions.filter(r => r.specialUnlocks?.length);
  if (!withUnlocks.length) return '';

  const groups = withUnlocks.map(region => `
    <div class="ov-region-group">
      <div class="ov-region-label">${region.icon} ${region.name}</div>
      <div class="unlocks-grid">${region.specialUnlocks.map(unlockCardHTML).join('')}</div>
    </div>
  `).join('');

  return `
    <div class="ov-section">
      <div class="ov-section-title">🔓 Special Unlocks</div>
      ${groups}
    </div>
  `;
}

function buildAutoQuestsOverview(activeRegions) {
  const allQuests = [...new Set(activeRegions.flatMap(r => r.autoQuests || []))];
  if (!allQuests.length) return '';
  return `
    <div class="ov-section">
      <div class="ov-section-title">📜 Auto-Completed Quests <span class="section-note">no XP awarded</span></div>
      <div class="tag-list">${allQuests.map(q => `<span class="tag tag-quest">${q}</span>`).join('')}</div>
    </div>
  `;
}

function buildAutoDiaryOverview(activeRegions) {
  const diaryMap = {};
  activeRegions.forEach(r => {
    r.autoDiary?.forEach(d => {
      if (!diaryMap[d.diary]) diaryMap[d.diary] = new Set();
      d.tasks.forEach(t => diaryMap[d.diary].add(t));
    });
  });
  if (!Object.keys(diaryMap).length) return '';
  const groups = Object.entries(diaryMap).map(([diary, tasks]) => `
    <div class="diary-group">
      <div class="diary-group-name">${diary} Diary</div>
      <ul class="diary-task-list">${[...tasks].map(t => `<li>${t}</li>`).join('')}</ul>
    </div>
  `).join('');
  return `
    <div class="ov-section">
      <div class="ov-section-title">📋 Auto-Completed Diary Tasks</div>
      ${groups}
    </div>
  `;
}

function buildAutoCAsOverview(activeRegions) {
  const allCAs = [...new Set(activeRegions.flatMap(r => r.autoCombatAchievements || []))];
  if (!allCAs.length) return '';
  return `
    <div class="ov-section">
      <div class="ov-section-title">🏆 Auto-Completed Combat Achievements</div>
      <div class="tag-list">${allCAs.map(a => `<span class="tag tag-ca">${a}</span>`).join('')}</div>
    </div>
  `;
}

function buildKeyDropsOverview(activeRegions) {
  const withDrops = activeRegions.filter(r => r.keyDrops?.length);
  if (!withDrops.length) return '';
  const groups = withDrops.map(r => `
    <div class="ov-region-group">
      <div class="ov-region-label">${r.icon} ${r.name}</div>
      <ul class="key-drops-list">${r.keyDrops.map(d => `<li>${d}</li>`).join('')}</ul>
    </div>
  `).join('');
  return `
    <div class="ov-section">
      <div class="ov-section-title">💰 Key Drops</div>
      ${groups}
    </div>
  `;
}

function buildNotesOverview(activeRegions) {
  const withNotes = activeRegions.filter(r => r.overview);
  if (!withNotes.length) return '';
  const groups = withNotes.map(r => `
    <div class="ov-region-group">
      <div class="ov-region-label">${r.icon} ${r.name}</div>
      <p class="region-overview-text">${r.overview}</p>
    </div>
  `).join('');
  return `
    <div class="ov-section">
      <div class="ov-section-title">ℹ️ League Rules & Notes</div>
      ${groups}
    </div>
  `;
}

// ─── TASK LIST ────────────────────────────────

function loadFromStorage() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // Legacy format: just the tasks array
        state.tasks = parsed;
      } else {
        state.tasks = parsed.tasks || [];
        state.selectedRelics  = parsed.selectedRelics  || {};
        state.reloadedRelicId = parsed.reloadedRelicId || null;
        state.colWidths = parsed.colWidths || {};
        state.importCollapsed = parsed.importCollapsed ?? false;
        if (parsed.activeTab && parsed.activeTab !== 'picker') state.activeTab = parsed.activeTab;
      }
    }
  } catch (e) {
    state.tasks = [];
  }
  populateAreaFilter();
  renderTaskTable();
  renderTaskStats();
}

function saveToStorage() {
  try {
    // Merge into existing object so other modules' subkeys (e.g. earlyGame) are preserved
    const raw    = localStorage.getItem(LS_KEY);
    const parsed = (raw && !Array.isArray(JSON.parse(raw))) ? JSON.parse(raw) : {};
    parsed.tasks           = state.tasks;
    parsed.selectedRelics  = state.selectedRelics;
    parsed.reloadedRelicId = state.reloadedRelicId;
    parsed.colWidths       = state.colWidths;
    parsed.importCollapsed = state.importCollapsed;
    parsed.activeTab       = state.activeTab || 'picker';
    localStorage.setItem(LS_KEY, JSON.stringify(parsed));
  } catch (e) {}
}

// ─── RELICS ───────────────────────────────────
function buildRelicSummary() {
  const slots = RELIC_TIERS.map(tier => {
    const selectedId = state.selectedRelics[tier.tier];
    const relic = tier.relics.find(r => r.id === selectedId);

    if (relic) {
      let bonusHTML = '';
      if (relic.id === 'reloaded' && state.reloadedRelicId) {
        const bonusRelic = RELIC_TIERS.flatMap(t => t.relics).find(r => r.id === state.reloadedRelicId);
        if (bonusRelic) bonusHTML = `<div class="rs-bonus"><img class="rs-bonus-icon" src="${bonusRelic.icon}" alt="${bonusRelic.name}"><span>+ ${bonusRelic.name}</span></div>`;
      }
      return `
        <div class="rs-slot rs-slot-filled" data-relic-id="${relic.id}" title="${relic.name}">
          <div class="rs-tier-label">T${tier.tier}</div>
          <img class="rs-icon" src="${relic.icon}" alt="${relic.name}">
          <div class="rs-name">${relic.name}</div>
          ${bonusHTML}
        </div>`;
    }
    return `
      <div class="rs-slot rs-slot-empty">
        <div class="rs-tier-label">T${tier.tier}</div>
        <div class="rs-empty-icon">?</div>
        <div class="rs-name rs-name-empty">Not chosen</div>
      </div>`;
  }).join('');

  const chosen = Object.keys(state.selectedRelics).length;
  return `
    <div class="relic-summary">
      <div class="relic-summary-header">
        <span class="relic-summary-title">Your Build</span>
        <span class="relic-summary-count">${chosen} / ${RELIC_TIERS.length} chosen</span>
      </div>
      <div class="relic-summary-slots">${slots}</div>
    </div>
  `;
}

let _rsActiveRelicId = null;

function renderRelics() {
  // Summary in its own sticky wrap
  const summaryWrap = document.getElementById('relic-summary-wrap');
  summaryWrap.innerHTML = buildRelicSummary() +
    '<div id="rs-detail-popup" class="rs-detail-popup"></div>';

  const container = document.getElementById('relics-content');
  container.innerHTML = RELIC_TIERS.map(tier => {
    const selectedId = state.selectedRelics[tier.tier];

    const passivesHTML = tier.passives.length
      ? `<div class="tier-passives"><div class="tier-passives-label">Tier Passives</div><ul>${tier.passives.map(p => `<li>${p}</li>`).join('')}</ul></div>`
      : `<div class="tier-passives tier-passives-none">No additional passives at this tier.</div>`;

    const placeholder = `
      <div class="relic-card relic-placeholder">
        <div class="relic-placeholder-icon">?</div>
        <div class="relic-card-body">
          <div class="relic-card-name">Not Yet Revealed</div>
          <p class="relic-placeholder-text">Check back as Jagex reveals more relics before April 15th.</p>
        </div>
      </div>
    `;

    // Build column slots — relics with a `column` field go into that position (1-based);
    // relics without fill left-to-right from remaining slots.
    const slots = Array.from({ length: tier.choices }, () => null);
    const unpositioned = [];
    tier.relics.forEach(relic => {
      if (relic.column && relic.column <= tier.choices) {
        slots[relic.column - 1] = relic;
      } else {
        unpositioned.push(relic);
      }
    });
    unpositioned.forEach(relic => {
      const idx = slots.indexOf(null);
      if (idx !== -1) slots[idx] = relic;
    });

    const cardsHTML = slots.map(relic => {
      if (!relic) return placeholder;
      const isSelected = selectedId === relic.id;
      const effectsHTML = relic.effects.map(e => `<li>${e}</li>`).join('');
      const toggleHTML = relic.toggleable
        ? `<div class="relic-toggleable"><span class="relic-toggle-label">Toggleable:</span> ${relic.toggleable}</div>`
        : '';
      const giftHTML = relic.gift
        ? `<div class="relic-gift">🎁 Receive: <strong>${relic.gift}</strong></div>`
        : '';
      return `
        <div class="relic-card ${isSelected ? 'relic-selected' : ''}">
          <div class="relic-card-header">
            <img class="relic-card-icon" src="${relic.icon}" alt="${relic.name}">
            <div class="relic-card-header-text">
              <div class="relic-card-name">${relic.wikiUrl ? `<a class="boss-wiki-link" href="${relic.wikiUrl}" target="_blank" rel="noopener">${relic.name} <span class="wiki-icon">↗</span></a>` : relic.name}</div>
              <button class="relic-view-full-btn" data-src="${relic.image}" data-alt="${relic.name}">View full image ↗</button>
            </div>
          </div>
          <div class="relic-card-body">
            ${giftHTML}
            ${toggleHTML}
            <ul class="relic-effects">${effectsHTML}</ul>
          </div>
          <button class="relic-select-btn ${isSelected ? 'active' : ''}" data-tier="${tier.tier}" data-relic="${relic.id}">
            ${isSelected ? '✓ Selected' : 'Select'}
          </button>
        </div>
      `;
    }).join('');

    let reloadedBonusHTML = '';
    if (tier.tier === 7 && selectedId === 'reloaded') {
      if (state.reloadedRelicId) {
        const bonusRelic = RELIC_TIERS.flatMap(t => t.relics).find(r => r.id === state.reloadedRelicId);
        const bonusTierNum = RELIC_TIERS.find(t => t.relics.some(r => r.id === state.reloadedRelicId))?.tier;
        if (bonusRelic) {
          reloadedBonusHTML = `
            <div class="reloaded-bonus-bar">
              <img class="reloaded-bonus-icon" src="${bonusRelic.icon}" alt="${bonusRelic.name}">
              <span>Bonus relic (T${bonusTierNum}): <strong>${bonusRelic.name}</strong></span>
              <button class="reloaded-bonus-change">Change</button>
            </div>`;
        }
      } else {
        reloadedBonusHTML = `
          <div class="reloaded-bonus-bar reloaded-bonus-empty">
            <span>⚠ No bonus relic chosen yet —</span>
            <button class="reloaded-bonus-change">Choose now</button>
          </div>`;
      }
    }

    return `
      <div class="relic-tier">
        <div class="relic-tier-header">
          <span class="relic-tier-number">Tier ${tier.tier}</span>
          <span class="relic-tier-choices">${tier.choices} choice${tier.choices !== 1 ? 's' : ''}</span>
          ${selectedId ? `<span class="relic-tier-selected-badge">✓ ${tier.relics.find(r => r.id === selectedId)?.name || ''}</span>` : ''}
        </div>
        ${passivesHTML}
        <div class="relic-cards-row" data-cols="${tier.choices}">
          ${cardsHTML}
        </div>
        ${reloadedBonusHTML}
      </div>
    `;
  }).join('');

  container.querySelectorAll('.relic-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tier = parseInt(btn.dataset.tier, 10);
      const relicId = btn.dataset.relic;
      if (state.selectedRelics[tier] === relicId) {
        delete state.selectedRelics[tier];
        if (relicId === 'reloaded') state.reloadedRelicId = null;
      } else {
        state.selectedRelics[tier] = relicId;
        if (relicId === 'reloaded') openReloadedPicker();
      }
      saveToStorage();
      renderRelics();
    });
  });

  container.querySelectorAll('.reloaded-bonus-change').forEach(btn => {
    btn.addEventListener('click', openReloadedPicker);
  });

  container.querySelectorAll('.relic-view-full-btn').forEach(btn => {
    btn.addEventListener('click', () => openRelicLightbox(btn.dataset.src, btn.dataset.alt));
  });

  bindSummarySlots();
  // Re-open popup for the same relic if one was active before re-render
  if (_rsActiveRelicId) openRsPopup(_rsActiveRelicId);
}

function bindSummarySlots() {
  document.querySelectorAll('.rs-slot-filled').forEach(slot => {
    slot.addEventListener('click', e => {
      e.stopPropagation();
      const relicId = slot.dataset.relicId;
      if (_rsActiveRelicId === relicId) {
        closeRsPopup();
      } else {
        _rsActiveRelicId = relicId;
        document.querySelectorAll('.rs-slot').forEach(s => s.classList.remove('rs-slot-active'));
        slot.classList.add('rs-slot-active');
        openRsPopup(relicId);
      }
    });
  });
}

function openRsPopup(relicId) {
  const relic    = RELIC_TIERS.flatMap(t => t.relics).find(r => r.id === relicId);
  const popup    = document.getElementById('rs-detail-popup');
  if (!relic || !popup) return;

  const tierNum    = RELIC_TIERS.find(t => t.relics.some(r => r.id === relicId))?.tier;
  const effectsHTML = relic.effects.map(e => `<li>${e}</li>`).join('');
  const giftHTML    = relic.gift      ? `<div class="relic-gift">🎁 Receive: <strong>${relic.gift}</strong></div>` : '';
  const toggleHTML  = relic.toggleable
    ? `<div class="relic-toggleable"><span class="relic-toggle-label">Toggleable:</span> ${relic.toggleable}</div>` : '';

  let bonusHTML = '';
  if (relicId === 'reloaded' && state.reloadedRelicId) {
    const bonus     = RELIC_TIERS.flatMap(t => t.relics).find(r => r.id === state.reloadedRelicId);
    const bonusTier = RELIC_TIERS.find(t => t.relics.some(r => r.id === state.reloadedRelicId))?.tier;
    if (bonus) {
      const bonusEffectsHTML  = bonus.effects.map(e => `<li>${e}</li>`).join('');
      const bonusGiftHTML     = bonus.gift      ? `<div class="relic-gift">🎁 Receive: <strong>${bonus.gift}</strong></div>` : '';
      const bonusToggleHTML   = bonus.toggleable
        ? `<div class="relic-toggleable"><span class="relic-toggle-label">Toggleable:</span> ${bonus.toggleable}</div>` : '';
      bonusHTML = `
        <div class="rs-bonus-section">
          <div class="rs-bonus-section-head">
            <img class="rs-popup-icon" src="${bonus.icon}" alt="${bonus.name}">
            <div>
              <div class="rs-popup-name">${bonus.name}</div>
              <div class="rs-popup-tier">Bonus relic — Tier ${bonusTier}</div>
            </div>
          </div>
          ${bonusGiftHTML}${bonusToggleHTML}
          <ul class="relic-effects">${bonusEffectsHTML}</ul>
        </div>`;
    }
  }

  popup.innerHTML = `
    <div class="rs-popup-inner">
      <div class="rs-popup-head">
        <img class="rs-popup-icon" src="${relic.icon}" alt="${relic.name}">
        <div>
          <div class="rs-popup-name">${relic.name}</div>
          <div class="rs-popup-tier">Tier ${tierNum}</div>
        </div>
      </div>
      ${giftHTML}${toggleHTML}
      <ul class="relic-effects">${effectsHTML}</ul>
      ${bonusHTML}
    </div>`;
  popup.classList.add('rs-popup-open');
}

function closeRsPopup() {
  const popup = document.getElementById('rs-detail-popup');
  if (popup) popup.classList.remove('rs-popup-open');
  document.querySelectorAll('.rs-slot').forEach(s => s.classList.remove('rs-slot-active'));
  _rsActiveRelicId = null;
}

// ─── Reloaded relic picker ────────────────────
function openReloadedPicker() {
  const overlay = document.getElementById('reloaded-picker');
  const body    = document.getElementById('reloaded-picker-body');

  // Build list of all relics from T1–T6 excluding the one already chosen for each tier
  let html = '';
  RELIC_TIERS.filter(t => t.tier <= 6).forEach(tier => {
    const available = tier.relics.filter(r => r.id !== state.selectedRelics[tier.tier]);
    if (!available.length) return;
    html += `<div class="rp-tier-label">Tier ${tier.tier}</div>`;
    available.forEach(r => {
      const chosen = r.id === state.reloadedRelicId;
      html += `
        <button class="rp-row${chosen ? ' rp-row-selected' : ''}" data-relic-id="${r.id}">
          <img class="rp-row-icon" src="${r.icon}" alt="${r.name}">
          <span class="rp-row-name">${r.name}</span>
          ${chosen ? '<span class="rp-check">✓</span>' : ''}
        </button>`;
    });
  });
  body.innerHTML = html;

  body.querySelectorAll('.rp-row').forEach(btn => {
    btn.addEventListener('click', () => {
      state.reloadedRelicId = btn.dataset.relicId;
      saveToStorage();
      closeReloadedPicker();
      renderRelics();
    });
  });

  overlay.removeAttribute('hidden');
}

function closeReloadedPicker() {
  document.getElementById('reloaded-picker').setAttribute('hidden', '');
}

function populateSkillFilter() {
  const sel = document.getElementById('filter-skill');
  ALL_SKILLS.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  });
}

// ─── Context menu ─────────────────────────
let contextTaskId = null;

function showContextMenu(e, taskId) {
  e.preventDefault();
  contextTaskId = taskId;
  const menu = document.getElementById('task-context-menu');
  const task = state.tasks.find(t => String(t.id) === String(taskId));
  document.getElementById('ctx-pin').textContent    = task?.pinned ? '📌 Unpin task' : '📌 Pin task';
  document.getElementById('ctx-toggle').textContent = task?.done   ? 'Mark incomplete' : 'Mark complete';
  menu.style.left = Math.min(e.clientX, window.innerWidth - 175) + 'px';
  menu.style.top  = Math.min(e.clientY, window.innerHeight - 130) + 'px';
  menu.removeAttribute('hidden');
}

function hideContextMenu() {
  document.getElementById('task-context-menu').setAttribute('hidden', '');
  contextTaskId = null;
}

function removeTask(id) {
  state.tasks = state.tasks.filter(t => String(t.id) !== String(id));
  saveToStorage();
  populateAreaFilter();
  renderTaskTable();
  renderTaskStats();
}

function togglePin(id) {
  const task = state.tasks.find(t => String(t.id) === String(id));
  if (task) {
    task.pinned = !task.pinned;
    saveToStorage();
    renderTaskTable();
  }
}

// ─── Edit modal ───────────────────────────
let editingTaskId = null;

function openEditModal(id) {
  const task = state.tasks.find(t => String(t.id) === String(id));
  if (!task) return;
  editingTaskId = id;
  document.getElementById('edit-name').value      = task.name;
  document.getElementById('edit-task-desc').value = task.task;
  document.getElementById('edit-reqs').value      = task.reqs;
  document.getElementById('edit-pts').value       = task.pts;
  document.getElementById('task-edit-overlay').removeAttribute('hidden');
}

function closeEditModal() {
  document.getElementById('task-edit-overlay').setAttribute('hidden', '');
  editingTaskId = null;
}

function saveEditTask() {
  const task = state.tasks.find(t => String(t.id) === String(editingTaskId));
  if (!task) { closeEditModal(); return; }
  task.name = document.getElementById('edit-name').value.trim() || task.name;
  task.task = document.getElementById('edit-task-desc').value.trim();
  task.reqs = document.getElementById('edit-reqs').value.trim();
  task.pts  = parseInt(document.getElementById('edit-pts').value, 10) || 0;
  saveToStorage();
  renderTaskTable();
  renderTaskStats();
  closeEditModal();
}

// Fetch task table directly from the OSRS wiki API
async function fetchTasksFromWiki() {
  const btn = document.getElementById('btn-fetch-wiki');
  const feedback = document.getElementById('import-feedback');

  btn.disabled = true;
  btn.textContent = 'Fetching…';
  feedback.textContent = '';
  feedback.className = 'import-feedback';

  try {
    const apiUrl = `https://oldschool.runescape.wiki/api.php?action=parse&page=${encodeURIComponent(WIKI_TASKS_PAGE)}&prop=text&format=json&origin=*`;
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const html = data?.parse?.text?.['*'];
    if (!html) throw new Error('No content returned from wiki');

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const tables = doc.querySelectorAll('table.wikitable');
    if (!tables.length) throw new Error('No task tables found on wiki page');

    // Collect selected regions (normalised)
    const selectedRegions = new Set(
      [...document.querySelectorAll('.import-region-cb:checked')].map(cb => cb.value)
    );

    let added = 0, updated = 0, skipped = 0;

    tables.forEach(table => {
      table.querySelectorAll('tr[data-lf-tier], tr[data-taskid]').forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 5) return;

        // Area: td[0] has data-sort-value="Asgarnia" — most reliable source
        const rawArea = cells[0].getAttribute('data-sort-value') || cells[0].textContent.trim();

        const name  = cells[1].textContent.trim();
        const task  = cells[2].textContent.trim();
        const reqs  = cells[3].textContent.trim().replace(/\s+/g, ' ');
        // Points: prefer data-lf-points on the row, fall back to cell text
        const pts   = parseInt(row.getAttribute('data-lf-points') || (cells[4].textContent.trim()).replace(/\D/g, ''), 10) || 0;
        const comp  = cells[5] ? cells[5].textContent.trim() : '';

        if (!name) { skipped++; return; }

        const area = normaliseArea(rawArea || 'General');

        // Skip if this region isn't selected
        if (selectedRegions.size && !selectedRegions.has(area)) { skipped++; return; }

        const existing = state.tasks.find(t => t.name === name && t.area === area);
        if (existing) {
          existing.comp = comp; // update completion %
          updated++;
          return;
        }

        state.tasks.push({ id: Date.now() + Math.random(), area, name, task, reqs: reqs || 'N/A', pts, comp, done: false });
        added++;
      });
    });

    saveToStorage();
    document.dispatchEvent(new CustomEvent('osrsl6:tasksImported'));
    populateAreaFilter();
    renderTaskTable();
    renderTaskStats();

    const parts = [];
    if (added)   parts.push(`${added} imported`);
    if (updated) parts.push(`${updated} updated`);
    if (skipped) parts.push(`${skipped} skipped`);
    feedback.textContent = parts.join(', ') + '.';
    feedback.className = `import-feedback ${added > 0 || updated > 0 ? 'success' : 'error'}`;
  } catch (err) {
    feedback.textContent = `Could not fetch from wiki: ${err.message}`;
    feedback.className = 'import-feedback error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Import from Wiki';
  }
}

// Parse pasted wiki task text (tab-separated rows)
function importTasks() {
  const raw = document.getElementById('task-paste').value.trim();
  const feedback = document.getElementById('import-feedback');

  if (!raw) {
    feedback.textContent = 'Nothing pasted.';
    feedback.className = 'import-feedback error';
    return;
  }

  // Pre-merge continuation lines: wiki cells can contain newlines, which splits
  // one row across multiple lines. A continuation line has < 3 tab characters.
  const rawLines = raw.split('\n').filter(l => l.trim());
  const lines = [];
  for (const line of rawLines) {
    const tabCount = (line.match(/\t/g) || []).length;
    if (tabCount < 3 && lines.length > 0) {
      lines[lines.length - 1] += ' ' + line.trim();
    } else {
      lines.push(line);
    }
  }

  let added = 0, updated = 0, skipped = 0;

  lines.forEach(line => {
    const cols = line.split('\t').map(c => c.trim());

    // Skip the wiki table header row: Area | Name | Task | Requirements | Pts | Comp%
    const colsLower = cols.map(c => c.toLowerCase());
    if (colsLower[0] === 'area' && colsLower.includes('requirements') && colsLower.includes('pts')) { skipped++; return; }

    // Wiki format: Area | Name | Task | Requirements | Pts | Comp%
    // Some rows may be missing the Area column (general tasks start with empty)
    // cols[0] might be area OR name if row starts without area
    if (cols.length < 3) { skipped++; return; }

    let area, name, task, reqs, pts, comp;

    // Detect if first col looks like an area or is a name
    // Wiki areas: Asgarnia, Karamja, Desert, Fremennik, Kandarin, Kourend, Morytania, Tirannwn, Wilderness, Varlamore, General
    const knownAreas = ['asgarnia','karamja','desert','kharidian','fremennik','kandarin','kourend','kebos','morytania','tirannwn','wilderness','varlamore','general'];
    const col0lower = cols[0].toLowerCase();
    const isArea = knownAreas.some(a => col0lower.includes(a)) || col0lower === '' || col0lower.length === 0;

    if (isArea) {
      [area, name, task, reqs, pts, comp] = cols;
    } else {
      // No area column (wiki area is an image, copies as nothing) — use selected default area
      area = document.getElementById('import-area').value || 'General';
      [name, task, reqs, pts, comp] = cols;
    }

    if (!name) { skipped++; return; }

    // Parse points — strip non-numeric except digits
    const ptsNum = parseInt((pts || '0').replace(/\D/g, ''), 10) || 0;

    // Normalise area name
    const cleanArea = normaliseArea(area || 'General');

    // Update comp% if task already exists, otherwise add new
    const existing = state.tasks.find(t => t.name === name && t.area === cleanArea);
    if (existing) {
      existing.comp = comp || '';
      updated++;
      return;
    }

    state.tasks.push({
      id:   Date.now() + Math.random(),
      area: cleanArea,
      name: name,
      task: task || '',
      reqs: reqs || 'N/A',
      pts:  ptsNum,
      comp: comp || '',
      done: false,
    });
    added++;
  });

  saveToStorage();
  document.dispatchEvent(new CustomEvent('osrsl6:tasksImported'));
  populateAreaFilter();
  renderTaskTable();
  renderTaskStats();

  document.getElementById('task-paste').value = '';
  const parts = [];
  if (added)   parts.push(`${added} imported`);
  if (updated) parts.push(`${updated} updated`);
  if (skipped) parts.push(`${skipped} skipped`);
  feedback.textContent = parts.join(', ') + '.';
  feedback.className = `import-feedback ${added > 0 || updated > 0 ? 'success' : 'error'}`;
}

function normaliseArea(raw) {
  const lower = raw.toLowerCase();
  if (!raw || lower === 'general' || lower === '') return 'General';
  if (lower.includes('asgarnia'))   return 'Asgarnia';
  if (lower.includes('karamja'))    return 'Karamja';
  if (lower.includes('desert') || lower.includes('kharidian')) return 'Desert';
  if (lower.includes('fremennik') || lower.includes('fremenick')) return 'Fremennik';
  if (lower.includes('kandarin'))   return 'Kandarin';
  if (lower.includes('kourend') || lower.includes('kebos')) return 'Kourend';
  if (lower.includes('morytania'))  return 'Morytania';
  if (lower.includes('tirannwn') || lower.includes('tirannwyn')) return 'Tirannwn';
  if (lower.includes('wilderness')) return 'Wilderness';
  if (lower.includes('varlamore'))  return 'Varlamore';
  return raw.trim() || 'General';
}

function populateAreaFilter() {
  const areas = [...new Set(state.tasks.map(t => t.area))].sort();
  const select = document.getElementById('filter-area');
  const prev = select.value;
  select.innerHTML = '<option value="">All Areas</option>' +
    areas.map(a => `<option value="${a}"${a === prev ? ' selected' : ''}>${a}</option>`).join('');
}

function applyFilters() {
  state.taskFilter = {
    search: document.getElementById('filter-search').value.toLowerCase(),
    area:   document.getElementById('filter-area').value,
    pts:    document.getElementById('filter-pts').value,
    status: document.getElementById('filter-status').value,
    skill:  document.getElementById('filter-skill').value,
  };
  renderTaskTable();
}

function clearFilters() {
  document.getElementById('filter-search').value = '';
  document.getElementById('filter-area').value = '';
  document.getElementById('filter-pts').value = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-skill').value = '';
  state.taskFilter = { search: '', area: '', pts: '', status: '', skill: '' };
  renderTaskTable();
}

let _appConfirmOkCb = null;

function showAppConfirm(title, message, onOk, okLabel = 'OK') {
  _appConfirmOkCb = onOk;
  document.getElementById('app-confirm-title').textContent   = title;
  document.getElementById('app-confirm-message').textContent = message;
  document.getElementById('app-confirm-ok').textContent      = okLabel;
  document.getElementById('app-confirm-dialog').removeAttribute('hidden');
}

function closeAppConfirm(confirmed) {
  document.getElementById('app-confirm-dialog').setAttribute('hidden', '');
  if (confirmed && _appConfirmOkCb) _appConfirmOkCb();
  _appConfirmOkCb = null;
}

function clearAllTasks() {
  showAppConfirm(
    'Clear All Tasks',
    'Clear all imported tasks? This cannot be undone.',
    () => {
      state.tasks = [];
      saveToStorage();
      populateAreaFilter();
      renderTaskTable();
      renderTaskStats();
    },
    'Clear All'
  );
}

function getFilteredTasks() {
  const { search, area, pts, status, skill } = state.taskFilter;

  let tasks = state.tasks.filter(t => {
    if (area   && t.area !== area) return false;
    if (pts    && t.pts < parseInt(pts, 10)) return false;
    if (status === 'complete'   && !t.done)    return false;
    if (status === 'incomplete' && t.done)     return false;
    if (status === 'pinned'     && !t.pinned)  return false;
    if (skill  && !t.reqs.toLowerCase().includes(skill.toLowerCase())) return false;
    if (search) {
      const haystack = `${t.name} ${t.task} ${t.area} ${t.reqs}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  switch (state.taskSort) {
    case 'pts-desc':  tasks.sort((a, b) => b.pts - a.pts); break;
    case 'pts-asc':   tasks.sort((a, b) => a.pts - b.pts); break;
    case 'comp-desc': tasks.sort((a, b) => parseFloat(b.comp) - parseFloat(a.comp)); break;
    case 'comp-asc':  tasks.sort((a, b) => parseFloat(a.comp) - parseFloat(b.comp)); break;
    case 'area':      tasks.sort((a, b) => a.area.localeCompare(b.area)); break;
    case 'pinned':    tasks.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)); break;
    // default: insertion order
  }

  return tasks;
}

function renderTaskTable() {
  const tasks = getFilteredTasks();
  const tbody = document.getElementById('task-tbody');
  const info  = document.getElementById('task-count-info');

  if (!state.tasks.length) {
    tbody.innerHTML = `
      <tr class="task-empty-row">
        <td colspan="7">
          <div class="task-empty">
            <p>No tasks yet. Paste wiki tasks in the import box to get started.</p>
            <p class="task-empty-hint">Go to the <a href="https://oldschool.runescape.wiki/w/Demonic_Pacts_League/Tasks" target="_blank" rel="noopener">wiki tasks page</a>, copy table rows, then paste here.</p>
          </div>
        </td>
      </tr>`;
    info.textContent = 'No tasks imported yet';
    return;
  }

  if (!tasks.length) {
    tbody.innerHTML = `<tr class="task-empty-row"><td colspan="7"><div class="task-empty"><p>No tasks match your filters.</p></div></td></tr>`;
    info.textContent = `0 of ${state.tasks.length} tasks`;
    return;
  }

  info.textContent = `Showing ${tasks.length} of ${state.tasks.length} tasks`;

  tbody.innerHTML = tasks.map(task => {
    const areaClass = task.area === 'General' ? 'area-general' : '';
    return `
      <tr class="${task.done ? 'completed' : ''}${task.pinned ? ' pinned' : ''}" data-task-id="${task.id}">
        <td class="col-check">
          ${task.pinned ? '<span class="pin-indicator" title="Pinned">📌</span>' : ''}
          <div class="task-check-btn ${task.done ? 'done' : ''}" data-check-id="${task.id}" title="Mark ${task.done ? 'incomplete' : 'complete'}">
            ${task.done ? '✓' : ''}
          </div>
        </td>
        <td class="col-area"><span class="area-chip ${areaClass}">${task.area}</span></td>
        <td class="col-name"><span class="col-name-text">${escapeHTML(task.name)}</span></td>
        <td class="col-task">${escapeHTML(task.task)}</td>
        <td class="col-reqs">${escapeHTML(task.reqs)}</td>
        <td class="col-pts"><span class="pts-badge">${task.pts}</span></td>
        <td class="col-comp">${task.comp ? escapeHTML(task.comp) : ''}</td>
      </tr>
    `;
  }).join('');

  // Left-click row to toggle complete; right-click for context menu
  tbody.querySelectorAll('tr[data-task-id]').forEach(row => {
    row.addEventListener('click', () => toggleTask(row.dataset.taskId));
    row.addEventListener('contextmenu', e => showContextMenu(e, row.dataset.taskId));
  });
}

function toggleTask(id) {
  const task = state.tasks.find(t => String(t.id) === String(id));
  if (task) {
    task.done = !task.done;
    saveToStorage();
    renderTaskTable();
    renderTaskStats();
  }
}

function renderTaskStats() {
  const total          = state.tasks.length;
  const completed      = state.tasks.filter(t => t.done).length;
  const pointsTotal    = state.tasks.reduce((s, t) => s + t.pts, 0);
  const pointsEarned   = state.tasks.filter(t => t.done).reduce((s, t) => s + t.pts, 0);

  document.getElementById('stat-total').textContent         = total;
  document.getElementById('stat-completed').textContent     = completed;
  document.getElementById('stat-points-earned').textContent = pointsEarned.toLocaleString();
  document.getElementById('stat-points-total').textContent  = pointsTotal.toLocaleString();
}

function updateTaskStickyOffsets() {
  const wrap = document.querySelector('.task-stats-wrap');
  if (!wrap) return;
  const h = wrap.getBoundingClientRect().height;
  const headerRow = document.querySelector('.task-table-header-row');
  const headerRowH = headerRow ? headerRow.getBoundingClientRect().height : 43;
  document.documentElement.style.setProperty('--task-table-sticky-top', h + 'px');
  document.documentElement.style.setProperty('--task-thead-sticky-top', (h + headerRowH) + 'px');
}

// ─── Column Resizing ──────────────────────────
// flex: true = column auto-fills remaining width (no explicit col width, no handle)
const COL_CONFIG = [
  { cls: 'col-check', defaultW: 32,  resizable: false, flex: false },
  { cls: 'col-area',  defaultW: 110, resizable: true,  flex: false },
  { cls: 'col-name',  defaultW: 150, resizable: true,  flex: false },
  { cls: 'col-task',  defaultW: null, resizable: false, flex: true  },
  { cls: 'col-reqs',  defaultW: 200, resizable: true,  flex: false },
  { cls: 'col-pts',   defaultW: 58,  resizable: false, flex: false },
  { cls: 'col-comp',  defaultW: 62,  resizable: false, flex: false },
];

function loadColWidths() {
  return COL_CONFIG.map(c => ({
    ...c,
    w: c.flex ? null : (state.colWidths[c.cls] ?? c.defaultW),
  }));
}

function saveColWidths(cols) {
  cols.forEach(c => { if (!c.flex) state.colWidths[c.cls] = c.w; });
  saveToStorage();
}

function initColumnResize() {
  const table = document.getElementById('task-table');
  if (!table || table.dataset.resizeInit) return;
  table.dataset.resizeInit = '1';

  const cols = loadColWidths();

  // Inject <colgroup> — fixed-width columns get explicit px; flex column gets no width
  const cg = document.createElement('colgroup');
  cols.forEach(c => {
    const col = document.createElement('col');
    col.className = 'tcol-' + c.cls;
    if (!c.flex) col.style.width = c.w + 'px';
    cg.appendChild(col);
  });
  table.insertBefore(cg, table.firstChild);
  table.style.tableLayout = 'fixed';
  table.style.width = '100%';

  // Add drag handles to header cells.
  // For flex columns (col-task): the handle inversely resizes the next fixed column
  // so dragging right makes the flex column visually grow and the next column shrink.
  const thList = [...table.querySelectorAll('thead th')];
  thList.forEach((th, idx) => {
    const colDef = cols.find(c => th.classList.contains(c.cls));
    if (!colDef) return;

    let targetDef, inverse;
    if (colDef.resizable && !colDef.flex) {
      // Normal case: resize this column directly
      targetDef = colDef;
      inverse = false;
    } else if (colDef.flex) {
      // Flex column: find the next fixed+resizable column and resize it inversely
      for (let i = idx + 1; i < thList.length; i++) {
        const next = cols.find(c => thList[i].classList.contains(c.cls));
        if (next && !next.flex && next.resizable) { targetDef = next; break; }
      }
      if (!targetDef) return;
      inverse = true;
    } else {
      return; // not resizable, not flex — skip
    }

    const handle = document.createElement('div');
    handle.className = 'col-resize-handle';
    handle.title = 'Drag to resize column';
    th.appendChild(handle);

    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = targetDef.w;
      const colEl  = cg.querySelector('.tcol-' + targetDef.cls);

      document.body.classList.add('table-resizing');

      function onMove(ev) {
        const delta = ev.clientX - startX;
        const newW  = Math.max(50, startW + (inverse ? -delta : delta));
        targetDef.w = newW;
        colEl.style.width = newW + 'px';
      }
      function onUp() {
        document.body.classList.remove('table-resizing');
        saveColWidths(cols);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

// ─── Helpers ──────────────────────────────────
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Start ────────────────────────────────────
init();
