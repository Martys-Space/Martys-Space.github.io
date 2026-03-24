// =============================================
// OSRS Leagues VI — Region Picker & Task Tracker
// =============================================

const MAX_CHOICES = 3;
const LS_KEY = 'osrsl6_v1';

// ─── State ────────────────────────────────────
const state = {
  activeTab:       'picker',
  viewMode:        'single',    // 'single' | 'overview'
  selectedRegion:  null,        // id of region showing in single view
  chosenRegions:   new Set(),   // user's picked region ids
  tasks:           [],          // { id, area, name, task, reqs, pts, comp, done }
  taskFilter: { search: '', area: '', pts: '', status: '' },
  taskSort: 'default',
  selectedRelics:  {},          // { [tier]: relicId }
};

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
  document.getElementById('btn-clear-filters').addEventListener('click', clearFilters);
  document.getElementById('btn-clear-tasks').addEventListener('click', clearAllTasks);
  document.getElementById('filter-search').addEventListener('input', applyFilters);
  document.getElementById('filter-area').addEventListener('change', applyFilters);
  document.getElementById('filter-pts').addEventListener('change', applyFilters);
  document.getElementById('filter-status').addEventListener('change', applyFilters);

  // Sort buttons
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.taskSort = btn.dataset.sort;
      renderTaskTable();
    });
  });

  // Relic image lightbox
  document.getElementById('relic-lightbox-close').addEventListener('click', closeRelicLightbox);
  document.getElementById('relic-lightbox-backdrop').addEventListener('click', closeRelicLightbox);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeRelicLightbox(); });

  // Auto-open Varlamore
  openRegion('varlamore');
}

function openRelicLightbox(src, alt) {
  const lb = document.getElementById('relic-lightbox');
  document.getElementById('relic-lightbox-img').src = src;
  document.getElementById('relic-lightbox-img').alt = alt;
  lb.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
}

function closeRelicLightbox() {
  document.getElementById('relic-lightbox').setAttribute('hidden', '');
  document.body.style.overflow = '';
}

// ─── Tab switching ────────────────────────────
function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
    btn.setAttribute('aria-selected', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.toggle('active', el.id === `tab-${tab}`);
    el.hidden = el.id !== `tab-${tab}`;
  });
  if (tab === 'tasks') renderTaskStats();
  if (tab === 'relics') renderRelics();
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

  // Skill click → modal
  panel.querySelectorAll('.skill-card').forEach(card => {
    card.addEventListener('click', () => {
      const skill = region.skills.find(s => s.skill === card.dataset.skill);
      if (skill) openSkillModal(skill);
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
        <div class="skills-grid">${region.skills.map(skillCardHTML).join('')}</div>
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

function skillCardHTML(skill) {
  const icon = SKILL_ICONS[skill.skill] || '❓';
  const hint = skill.summary.split('—')[0].trim();
  return `
    <div class="skill-card rating-${skill.rating}" data-skill="${skill.skill}" title="Click for training methods">
      <div class="skill-card-inner">
        <span class="skill-icon">${icon}</span>
        <span class="skill-name">${skill.skill}</span>
      </div>
      <div class="skill-rating-bar"></div>
      <div class="skill-rating-label">${skill.rating}</div>
      <div class="skill-hint">${hint}</div>
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

// ─── Skill Modal ──────────────────────────────
function openSkillModal(skill) {
  const icon = SKILL_ICONS[skill.skill] || '❓';
  const ratingColor = {
    excellent: 'var(--rating-excellent)',
    good:      'var(--rating-good)',
    decent:    'var(--rating-decent)',
    poor:      'var(--rating-poor)',
  }[skill.rating] || '#fff';

  document.getElementById('modal-content').innerHTML = `
    <div class="modal-title">${icon} ${skill.skill}</div>
    <div class="modal-rating" style="color:${ratingColor}">
      ${skill.rating.toUpperCase()} — ${skill.summary}
    </div>
    ${skill.methods?.length ? `
    <div class="modal-section">
      <h4>Training Methods</h4>
      <ul>${skill.methods.map(m => `<li>${m}</li>`).join('')}</ul>
    </div>` : ''}
    ${skill.notes?.length ? `
    <div class="modal-section">
      <h4>Notes</h4>
      <ul>${skill.notes.map(n => `<li>${n}</li>`).join('')}</ul>
    </div>` : ''}
  `;
  document.getElementById('modal-overlay').removeAttribute('hidden');
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

  // Skill hover tooltips
  panel.querySelectorAll('.ov-skill-card[data-skill]').forEach(card => {
    card.addEventListener('click', () => {
      const skillId = card.dataset.skill;
      const regionId = card.dataset.region;
      const region = REGIONS.find(r => r.id === regionId);
      if (region) {
        const skill = region.skills.find(s => s.skill === skillId);
        if (skill) openSkillModal(skill);
      }
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
        state.selectedRelics = parsed.selectedRelics || {};
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
    localStorage.setItem(LS_KEY, JSON.stringify({
      tasks: state.tasks,
      selectedRelics: state.selectedRelics,
    }));
  } catch (e) {}
}

// ─── RELICS ───────────────────────────────────
function renderRelics() {
  const container = document.getElementById('relics-content');
  container.innerHTML = RELIC_TIERS.map(tier => {
    const selectedId = state.selectedRelics[tier.tier];

    const passivesHTML = tier.passives.length
      ? `<div class="tier-passives"><div class="tier-passives-label">Tier Passives</div><ul>${tier.passives.map(p => `<li>${p}</li>`).join('')}</ul></div>`
      : `<div class="tier-passives tier-passives-none">No additional passives at this tier.</div>`;

    const revealedCards = tier.relics.map(relic => {
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
          <div class="relic-img-wrap">
            <img class="relic-card-img" src="${relic.image}" alt="${relic.name}">
            <button class="relic-img-zoom" data-src="${relic.image}" data-alt="${relic.name}" title="View full size">⛶</button>
          </div>
          <div class="relic-card-body">
            <div class="relic-card-name">${relic.name}</div>
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

    const placeholderCount = tier.choices - tier.relics.length;
    const placeholders = Array.from({ length: placeholderCount }, () => `
      <div class="relic-card relic-placeholder">
        <div class="relic-placeholder-icon">?</div>
        <div class="relic-card-body">
          <div class="relic-card-name">Not Yet Revealed</div>
          <p class="relic-placeholder-text">Check back as Jagex reveals more relics before April 15th.</p>
        </div>
      </div>
    `).join('');

    return `
      <div class="relic-tier">
        <div class="relic-tier-header">
          <span class="relic-tier-number">Tier ${tier.tier}</span>
          <span class="relic-tier-choices">${tier.choices} choice${tier.choices !== 1 ? 's' : ''}</span>
          ${selectedId ? `<span class="relic-tier-selected-badge">✓ ${tier.relics.find(r => r.id === selectedId)?.name || ''}</span>` : ''}
        </div>
        ${passivesHTML}
        <div class="relic-cards-row">
          ${revealedCards}${placeholders}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.relic-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tier = parseInt(btn.dataset.tier, 10);
      const relicId = btn.dataset.relic;
      if (state.selectedRelics[tier] === relicId) {
        delete state.selectedRelics[tier];
      } else {
        state.selectedRelics[tier] = relicId;
      }
      saveToStorage();
      renderRelics();
    });
  });

  container.querySelectorAll('.relic-img-zoom').forEach(btn => {
    btn.addEventListener('click', () => openRelicLightbox(btn.dataset.src, btn.dataset.alt));
  });
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

  const lines = raw.split('\n').filter(l => l.trim());
  let added = 0;
  let skipped = 0;

  lines.forEach(line => {
    const cols = line.split('\t').map(c => c.trim());

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
      // No area column — treat as general
      area = 'General';
      [name, task, reqs, pts, comp] = cols;
    }

    if (!name) { skipped++; return; }

    // Parse points — strip non-numeric except digits
    const ptsNum = parseInt((pts || '0').replace(/\D/g, ''), 10) || 0;

    // Normalise area name
    const cleanArea = normaliseArea(area || 'General');

    // Check if duplicate (same name + area)
    const isDupe = state.tasks.some(t => t.name === name && t.area === cleanArea);
    if (isDupe) { skipped++; return; }

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
  populateAreaFilter();
  renderTaskTable();
  renderTaskStats();

  document.getElementById('task-paste').value = '';
  feedback.textContent = `Imported ${added} task${added !== 1 ? 's' : ''}${skipped ? `, skipped ${skipped}` : ''}.`;
  feedback.className = `import-feedback ${added > 0 ? 'success' : 'error'}`;
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
  };
  renderTaskTable();
}

function clearFilters() {
  document.getElementById('filter-search').value = '';
  document.getElementById('filter-area').value = '';
  document.getElementById('filter-pts').value = '';
  document.getElementById('filter-status').value = '';
  state.taskFilter = { search: '', area: '', pts: '', status: '' };
  renderTaskTable();
}

function clearAllTasks() {
  if (!confirm('Clear all imported tasks? This cannot be undone.')) return;
  state.tasks = [];
  saveToStorage();
  populateAreaFilter();
  renderTaskTable();
  renderTaskStats();
}

function getFilteredTasks() {
  const { search, area, pts, status } = state.taskFilter;

  let tasks = state.tasks.filter(t => {
    if (area   && t.area !== area) return false;
    if (pts    && t.pts < parseInt(pts, 10)) return false;
    if (status === 'complete'   && !t.done) return false;
    if (status === 'incomplete' && t.done)  return false;
    if (search) {
      const haystack = `${t.name} ${t.task} ${t.area} ${t.reqs}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  switch (state.taskSort) {
    case 'pts-desc': tasks.sort((a, b) => b.pts - a.pts); break;
    case 'pts-asc':  tasks.sort((a, b) => a.pts - b.pts); break;
    case 'area':     tasks.sort((a, b) => a.area.localeCompare(b.area)); break;
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
        <td colspan="6">
          <div class="task-empty">
            <p>No tasks yet. Paste wiki tasks in the import box to get started.</p>
            <p class="task-empty-hint">Go to the <a href="https://oldschool.runescape.wiki/w/Raging_Echoes_League/Tasks" target="_blank" rel="noopener">wiki tasks page</a>, copy table rows, then paste here.</p>
          </div>
        </td>
      </tr>`;
    info.textContent = 'No tasks imported yet';
    return;
  }

  if (!tasks.length) {
    tbody.innerHTML = `<tr class="task-empty-row"><td colspan="6"><div class="task-empty"><p>No tasks match your filters.</p></div></td></tr>`;
    info.textContent = `0 of ${state.tasks.length} tasks`;
    return;
  }

  info.textContent = `Showing ${tasks.length} of ${state.tasks.length} tasks`;

  tbody.innerHTML = tasks.map(task => {
    const areaClass = task.area === 'General' ? 'area-general' : '';
    return `
      <tr class="${task.done ? 'completed' : ''}" data-task-id="${task.id}">
        <td class="col-check">
          <div class="task-check-btn ${task.done ? 'done' : ''}" data-check-id="${task.id}" title="Mark ${task.done ? 'incomplete' : 'complete'}">
            ${task.done ? '✓' : ''}
          </div>
        </td>
        <td class="col-area"><span class="area-chip ${areaClass}">${task.area}</span></td>
        <td class="col-name"><span class="col-name-text">${escapeHTML(task.name)}</span></td>
        <td class="col-task">${escapeHTML(task.task)}</td>
        <td class="col-reqs">${escapeHTML(task.reqs)}</td>
        <td class="col-pts"><span class="pts-badge">${task.pts}</span></td>
      </tr>
    `;
  }).join('');

  // Attach check listeners
  tbody.querySelectorAll('[data-check-id]').forEach(btn => {
    btn.addEventListener('click', () => toggleTask(btn.dataset.checkId));
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
