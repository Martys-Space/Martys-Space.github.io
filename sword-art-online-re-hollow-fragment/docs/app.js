// ============================================================
// SAO Re: Hollow Fragment Tracker
// Works both on GitHub Pages (browser Steam sync via CORS proxy)
// and locally via Node.js server (API key stays in config.json)
// ============================================================

const LS_KEY = 'sao_tracker_v1';

const CORS_PROXIES = [
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

async function proxyFetch(url) {
  let lastErr;
  for (const proxy of CORS_PROXIES) {
    try {
      const r = await fetch(proxy(url));
      if (r.ok) return r;
      lastErr = new Error(`Proxy returned ${r.status}`);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('All CORS proxies failed');
}

// ---- STATE ----
const PROGRESS_BAR_DEFAULTS = { hm: false, implementations: false, floors: true, affection: true, achievements: true };

let state = {
  hollowMissions:        {},
  floors:                {},
  affection:             {},
  achievements:          {},
  implementations:       {},
  steamConfig:           { apiKey: '', steamId: '' },
  steamHintDismissed:    false,
  progressBars:          { ...PROGRESS_BAR_DEFAULTS },
  showChildImplIds:      false
};

// ---- IMPLEMENTATIONS UI STATE (not persisted) ----
let implFilterType = 'all';
let implHideCompleted = false;
let implSearch = '';
const implCollapsed = {};

function isSteamConfigured() {
  return !!(state.steamConfig.apiKey && state.steamConfig.steamId);
}

// ---- IMPLEMENTATIONS HELPERS ----
function implParentId(id) {
  const lastDot = id.lastIndexOf('.');
  return lastDot === -1 ? null : id.slice(0, lastDot);
}

function implDepth(id) {
  return id.split('.').length - 1;
}

function implSortKey(id) {
  return id.split('.').map(n => parseInt(n).toString().padStart(6, '0')).join('.');
}

function implStatus(id) {
  return state.implementations[id] || null; // null | "testing" | "implemented"
}

function implIsAvailable(id) {
  const parentId = implParentId(id);
  if (parentId === null) return true;
  const ps = implStatus(parentId);
  return ps === 'implement' || ps === 'implemented';
}

const totalImpls     = () => IMPLEMENTATIONS_DATA.length;
const completedImpls = () => IMPLEMENTATIONS_DATA.filter(i => implStatus(i.id) === 'implemented').length;
const DONT_CHEAT_TOTAL = () => CHARACTERS_DATA.filter(c => !c.excludeDontCheat).length;
const dontCheatCount   = () => CHARACTERS_DATA.filter(c => !c.excludeDontCheat && (state.affection[c.id] || 0) >= 5).length;

function loadState() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      state = Object.assign(state, parsed);
      // Deep merge progressBars so new keys always get their defaults
      state.progressBars = Object.assign({ ...PROGRESS_BAR_DEFAULTS }, parsed.progressBars || {});
    }
  } catch (e) { console.error('Failed to load state', e); }
}

function saveState() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  catch (e) { console.error('Failed to save state', e); }
}

// ---- HELPERS ----
const totalMissions    = () => HOLLOW_MISSIONS_DATA.length;
const completedMissions= () => Object.values(state.hollowMissions).filter(Boolean).length;
const totalFloors      = () => FLOORS_DATA.length;
const completedFloors  = () => Object.values(state.floors).filter(Boolean).length;
const maxAffectionCount= () => CHARACTERS_DATA.filter(c => (state.affection[c.id] || 0) >= 5).length;
const completedAchs    = () => Object.values(state.achievements).filter(Boolean).length;

// ---- OVERVIEW ----
function updateOverview() {
  setOvStat('ov-hm',   completedMissions(), totalMissions());
  setOvStat('ov-fl',   completedFloors(),   totalFloors());
  setOvStat('ov-aff',  maxAffectionCount(), CHARACTERS_DATA.length);
  setOvStat('ov-ach',  completedAchs(),     ACHIEVEMENTS_DATA.length);
  setOvStat('ov-impl', completedImpls(),    totalImpls());
}

function setOvStat(id, done, total) {
  const el = document.getElementById(id);
  if (!el) return;
  el.querySelector('.stat-value').textContent = `${done}/${total}`;
  el.querySelector('.stat-value').classList.toggle('complete', done === total);
  const pct = total > 0 ? (done / total) * 100 : 0;
  const fill = el.querySelector('.progress-mini-fill');
  fill.style.width = pct + '%';
  fill.classList.toggle('complete', done === total);
}

function updateHMProgress() {
  const done = completedMissions(), total = totalMissions();
  const fill  = document.getElementById('hm-progress-fill');
  const label = document.getElementById('hm-progress-label');
  if (fill)  { fill.style.width = total > 0 ? (done / total * 100) + '%' : '0%'; fill.classList.toggle('green', done === total); }
  if (label) label.textContent = `${done} / ${total}`;
}

function applyProgressBarVisibility() {
  const pb = state.progressBars;
  [
    { key: 'hm',              id: 'hm-progress-wrap' },
    { key: 'implementations', id: 'impl-progress-wrap' },
    { key: 'floors',          id: 'floor-progress-wrap' },
    { key: 'affection',       id: 'aff-progress-wrap' },
    { key: 'achievements',    id: 'ach-progress-wrap' },
  ].forEach(({ key, id }) => {
    const el = document.getElementById(id);
    if (el) el.style.display = pb[key] ? '' : 'none';
  });
}

function applyChildImplIdVisibility() {
  const list = document.getElementById('impl-list');
  if (list) list.classList.toggle('hide-child-ids', !state.showChildImplIds);
}

// ---- TABS ----
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    });
  });
}

// ============================================================
// TAB 1 — HOLLOW MISSIONS
// ============================================================
function sortHMMissions(missions) {
  // Group chained missions (consecutive part sequences) into single units
  const groups = [];
  let i = 0;
  while (i < missions.length) {
    const m = missions[i];
    if (m.part === 1) {
      const chain = [m];
      i++;
      while (i < missions.length && missions[i].part != null && missions[i].part > 1) {
        chain.push(missions[i]);
        i++;
      }
      groups.push(chain);
    } else {
      groups.push([m]);
      i++;
    }
  }

  // Sort groups by rank of first mission; area_boss last within rank 2
  function groupRank(g) {
    const r = g[0].mission_rank;
    return r ? parseInt(r.replace('Rank ', '')) : 1;
  }

  function typePriority(g) {
    const t = g[0].type;
    if (t === 'area_boss') return 2;
    if (t === 'boss')      return 1;
    return 0;
  }

  groups.sort((a, b) => {
    const ra = groupRank(a), rb = groupRank(b);
    if (ra !== rb) return ra - rb;
    return typePriority(a) - typePriority(b);
  });

  return groups.flat();
}

function renderHollowMissions() {
  const container = document.getElementById('hm-areas');
  container.innerHTML = '';

  HOLLOW_REGIONS.forEach(region => {
    const missions   = sortHMMissions(HOLLOW_MISSIONS_DATA.filter(m => m.region === region.id));
    const areaDone   = missions.filter(m => state.hollowMissions[m.id]).length;
    const areaTotal  = missions.length;

    const block = document.createElement('div');
    block.className = 'area-block';
    block.dataset.regionId = region.id;

    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `
      <span class="section-title">${region.name}</span>
      <span class="section-progress">
        <span class="${areaDone === areaTotal && areaTotal > 0 ? 'done' : ''}">${areaDone}</span>/${areaTotal}
      </span>
      <span class="chevron">▼</span>`;

    const missionsDiv = document.createElement('div');
    missionsDiv.className = 'area-missions';
    missions.forEach((m, idx) => missionsDiv.appendChild(createMissionRow(m, idx + 1)));

    header.addEventListener('click', () => {
      header.classList.toggle('open');
      missionsDiv.classList.toggle('open');
    });

    block.appendChild(header);
    block.appendChild(missionsDiv);
    container.appendChild(block);
  });
  updateHMProgress();
}

function createMissionRow(m, num) {
  const done = !!state.hollowMissions[m.id];
  const rankNum = m.mission_rank ? m.mission_rank.replace('Rank ', '') : '1';

  const row = document.createElement('div');
  row.className = `mission-row${m.type ? ' type-' + m.type : ''}${done ? ' completed' : ''}`;

  let typeTag = '';
  if (m.type === 'area_boss')   typeTag = '<span class="type-tag tag-area_boss">AREA BOSS</span>';
  if (m.type === 'boss')        typeTag = '<span class="type-tag tag-boss">BOSS</span>';
  if (m.type === 'grand_quest') typeTag = '<span class="type-tag tag-grand_quest">GRAND QUEST</span>';
  if (m.type === 'ultra_hard')  typeTag = '<span class="type-tag tag-ultra_hard">ULTRA HARD</span>';
  const partTag = m.part ? `<span class="type-tag tag-part">Part ${m.part}</span>` : '';
  const timeLimit = m.time_limit || 'No Limit';

  row.innerHTML = `
    <div class="mission-row-main">
      <button class="impl-circle ${done ? 'impl-circle-done' : 'impl-circle-empty'}" title="${done ? 'Mark as incomplete' : 'Mark as complete'}">✓</button>
      <span class="rank-badge rank-${rankNum}">${rankNum}</span>
      <div class="mission-info">
        <div class="mission-name">${typeTag}${partTag}${m.name}</div>
        <div class="mission-meta"><span class="map-name">${m.location}</span> — ${m.summary}</div>
      </div>
      <div class="mission-num">#${num}</div>
    </div>
    <div class="mission-detail-panel">
      <div class="mdp-strategy">${m.strategy}</div>
      <div class="mdp-stats">
        <div class="mdp-stat"><span class="mdp-stat-label">GOAL</span><span class="mdp-stat-value">${m.goal}</span></div>
        <div class="mdp-stat"><span class="mdp-stat-label">TARGET</span><span class="mdp-stat-value">${m.target}</span></div>
        <div class="mdp-stat"><span class="mdp-stat-label">TIME LIMIT</span><span class="mdp-stat-value">${timeLimit}</span></div>
        <div class="mdp-stat"><span class="mdp-stat-label">REC. LEVEL</span><span class="mdp-stat-value">${m.recommended_level || '—'}</span></div>
      </div>
    </div>`;

  const circleBtn   = row.querySelector('.impl-circle');
  const detailPanel = row.querySelector('.mission-detail-panel');
  const mainRow     = row.querySelector('.mission-row-main');

  circleBtn.addEventListener('click', e => {
    e.stopPropagation();
    const newDone = !state.hollowMissions[m.id];
    state.hollowMissions[m.id] = newDone;
    row.classList.toggle('completed', newDone);
    circleBtn.className = `impl-circle ${newDone ? 'impl-circle-done' : 'impl-circle-empty'}`;
    circleBtn.title = newDone ? 'Mark as incomplete' : 'Mark as complete';
    saveState();
    updateOverview();
    updateHMProgress();
    updateAchInlineTrackers();
    refreshAreaHeader(m);
  });

  mainRow.addEventListener('click', e => {
    if (e.target.closest('.impl-circle')) return;
    detailPanel.classList.toggle('open');
  });

  return row;
}

function refreshAreaHeader(mission) {
  const block = document.querySelector(`.area-block[data-region-id="${mission.region}"]`);
  if (!block) return;
  const missions = HOLLOW_MISSIONS_DATA.filter(m => m.region === mission.region);
  const done  = missions.filter(m => state.hollowMissions[m.id]).length;
  const total = missions.length;
  const sp    = block.querySelector('.section-progress');
  if (sp) sp.innerHTML = `<span class="${done === total && total > 0 ? 'done' : ''}">${done}</span>/${total}`;
}

function initHMControls() {
  document.getElementById('hm-expand-all').addEventListener('click', () => {
    document.querySelectorAll('.section-header').forEach(h => h.classList.add('open'));
    document.querySelectorAll('.area-missions').forEach(m => m.classList.add('open'));
  });
  document.getElementById('hm-collapse-all').addEventListener('click', () => {
    document.querySelectorAll('.section-header').forEach(h => h.classList.remove('open'));
    document.querySelectorAll('.area-missions').forEach(m => m.classList.remove('open'));
  });
  document.getElementById('hm-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    document.querySelectorAll('.mission-row').forEach(row => {
      const name = row.querySelector('.mission-name').textContent.toLowerCase();
      const map  = row.querySelector('.map-name')?.textContent.toLowerCase() || '';
      row.style.display = (!q || name.includes(q) || map.includes(q)) ? '' : 'none';
    });
  });
  document.getElementById('hm-hide-completed').addEventListener('click', function() {
    const areas = document.getElementById('hm-areas');
    const hidden = areas.classList.toggle('hm-hide-completed');
    this.textContent = hidden ? 'Show Completed' : 'Hide Completed';
  });
}

// ============================================================
// TAB 2 — FLOOR TRACKER
// ============================================================
function renderFloorTracker() {
  const grid = document.getElementById('floor-grid');
  grid.innerHTML = '';

  FLOORS_DATA.forEach(f => {
    const done = !!state.floors[f.floor];
    const card = document.createElement('div');
    card.className = 'floor-card' + (done ? ' has-bonus' : '');
    card.innerHTML = `
      <button class="impl-circle ${done ? 'impl-circle-done' : 'impl-circle-empty'}" title="${done ? 'Remove bonus' : 'Mark bonus received'}">✓</button>
      <div class="floor-card-info">
        <div class="floor-num">FLOOR ${f.floor}</div>
        <div class="floor-boss">${f.boss}</div>
      </div>`;

    const circleBtn = card.querySelector('.impl-circle');
    circleBtn.addEventListener('click', e => {
      e.stopPropagation();
      const newDone = !state.floors[f.floor];
      state.floors[f.floor] = newDone;
      card.classList.toggle('has-bonus', newDone);
      circleBtn.className = `impl-circle ${newDone ? 'impl-circle-done' : 'impl-circle-empty'}`;
      circleBtn.title = newDone ? 'Remove bonus' : 'Mark bonus received';
      saveState();
      updateOverview();
      updateFloorProgress();
    });
    card.addEventListener('click', e => { if (!e.target.closest('.impl-circle')) circleBtn.click(); });
    grid.appendChild(card);
  });

  updateFloorProgress();
}

function updateFloorProgress() {
  const done = completedFloors(), total = totalFloors();
  const fill  = document.getElementById('floor-progress-fill');
  const label = document.getElementById('floor-progress-label');
  if (fill)  { fill.style.width = (done / total * 100) + '%'; fill.classList.toggle('green', done === total); }
  if (label) label.textContent = `${done} / ${total} floors`;
}

// ============================================================
// TAB 3 — AFFECTION
// ============================================================
const INITIALS = { asuna:'A', yui:'Y', silica:'S', philia:'P', sinon:'Si', lisbeth:'Li', strea:'St', leafa:'Le', argo:'Ar' };

function renderAffection() {
  const grid = document.getElementById('affection-grid');
  grid.innerHTML = '';

  CHARACTERS_DATA.forEach(char => {
    const rank  = state.affection[char.id] || 0;
    const maxed = rank >= 5;
    const card  = document.createElement('div');
    card.className = 'char-card' + (maxed ? ' maxed' : (rank > 0 ? ' has-stars' : ''));
    card.id = 'char-card-' + char.id;

    const achHtml = char.achievement
      ? `<span class="char-achievement${state.achievements[getAchKey(char.achievement)] ? ' unlocked' : ''}">
           ${state.achievements[getAchKey(char.achievement)] ? '★' : '☆'} ${char.achievement}
         </span>`
      : '';

    const excludeNote = char.excludeDontCheat
      ? `<span class="char-exclude-note">Not required for Don't cheat, daddy</span>`
      : '';

    card.innerHTML = `
      <div class="char-avatar avatar-${char.id}">${INITIALS[char.id] || char.name[0]}</div>
      <div class="char-name">${char.name}</div>
      <div class="star-row" data-char="${char.id}">
        ${[1,2,3,4,5].map(i => `<button class="star-btn${rank >= i ? ' filled' : ''}" data-star="${i}">★</button>`).join('')}
      </div>
      ${achHtml}
      ${excludeNote}`;

    card.querySelector('.star-row').addEventListener('click', e => {
      const btn = e.target.closest('.star-btn');
      if (!btn) return;
      const clicked = parseInt(btn.dataset.star);
      const current = state.affection[char.id] || 0;
      state.affection[char.id] = (current === clicked) ? clicked - 1 : clicked;
      saveState();
      updateOverview();
      updateAffectionCard(char.id);
    });

    grid.appendChild(card);
  });

  syncAffectionBar();
}

function updateAffectionCard(charId) {
  const card = document.getElementById('char-card-' + charId);
  if (!card) return;
  const rank = state.affection[charId] || 0;
  card.classList.remove('maxed', 'has-stars');
  if (rank >= 5) card.classList.add('maxed');
  else if (rank > 0) card.classList.add('has-stars');
  card.querySelectorAll('.star-btn').forEach(btn => {
    btn.classList.toggle('filled', parseInt(btn.dataset.star) <= rank);
  });
  syncAffectionBar();
  updateAchInlineTrackers();
}

function syncAffectionBar() {
  const done = maxAffectionCount(), total = CHARACTERS_DATA.length;
  const fill  = document.getElementById('aff-progress-fill');
  const label = document.getElementById('aff-max-label');
  if (fill)  fill.style.width = (done / total * 100) + '%';
  if (label) label.textContent = `${done} / ${total}`;
}

function getAchKey(displayName) {
  return ACHIEVEMENTS_DATA.find(a => a.name === displayName)?.key || null;
}

// ============================================================
// TAB 4 — ACHIEVEMENTS
// ============================================================
function renderAchievementsSteamArea() {
  const area = document.getElementById('steam-sync-area');
  if (!area) return;

  if (isSteamConfigured()) {
    area.innerHTML = `
      <div class="steam-sync-bar">
        <div class="steam-sync-bar-info">
          <span class="steam-sync-label">Steam Sync</span>
          <span class="steam-sync-id">${state.steamConfig.steamId}</span>
        </div>
        <button id="steam-sync-btn" class="btn btn-small">Sync from Steam</button>
      </div>
      <div id="sync-status" class="sync-status"></div>`;
    document.getElementById('steam-sync-btn').addEventListener('click', handleSteamSync);
  } else if (!state.steamHintDismissed) {
    area.innerHTML = `
      <div class="steam-hint-card">
        <div class="steam-hint-icon">🎮</div>
        <div class="steam-hint-body">
          <strong>Sync achievements from Steam</strong>
          <p>Add your Steam API key in the <strong>Settings</strong> tab to automatically sync your achievements.</p>
        </div>
        <button id="steam-hint-dismiss" class="btn btn-small">Dismiss</button>
      </div>`;
    document.getElementById('steam-hint-dismiss').addEventListener('click', () => {
      state.steamHintDismissed = true;
      saveState();
      renderAchievementsSteamArea();
    });
  } else {
    area.innerHTML = '';
  }
}

async function handleSteamSync() {
  const { apiKey, steamId } = state.steamConfig;
  if (!apiKey || !steamId) {
    setStatus('Steam sync not configured. Go to Settings to add your credentials.', 'error');
    return;
  }

  setStatus('Syncing with Steam…', '');

  try {
    const { schema, playerStats } = await fetchSteamData(state.steamConfig.apiKey, state.steamConfig.steamId);

    if (playerStats?.playerstats?.error) {
      throw new Error(playerStats.playerstats.error === 'Profile is not public'
        ? 'Your Steam profile game details must be set to Public. Go to Steam → Edit Profile → Privacy Settings → Game details → Public.'
        : playerStats.playerstats.error);
    }

    // Build displayName → achieved map via schema
    const playerAchs = playerStats?.playerstats?.achievements || [];
    const apiAchMap  = Object.fromEntries(playerAchs.map(a => [a.apiname, a.achieved === 1]));

    const schemaAchs = schema?.game?.availableGameStats?.achievements || [];
    const nameMap    = {};
    schemaAchs.forEach(a => {
      if (a.displayName) nameMap[a.displayName.toLowerCase()] = apiAchMap[a.name] || false;
    });

    let synced = 0;
    ACHIEVEMENTS_DATA.forEach(ach => {
      if (nameMap[ach.name.toLowerCase()] !== undefined) {
        state.achievements[ach.key] = nameMap[ach.name.toLowerCase()];
        synced++;
      }
    });

    saveState();
    updateOverview();
    renderAchievements();

    const unlocked = completedAchs();
    setStatus(`Synced! ${unlocked}/${ACHIEVEMENTS_DATA.length} achievements unlocked.`, 'success');
  } catch (err) {
    setStatus(`Error: ${err.message}`, 'error');
  }
}

async function fetchSteamData(apiKey, steamId) {
  // Call Steam API via CORS proxy
  const schemaUrl = `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${apiKey}&appid=638650`;
  const playerUrl = `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?key=${apiKey}&steamid=${steamId}&appid=638650`;

  const [schema, playerStats] = await Promise.all([
    proxyFetch(schemaUrl).then(r => r.json()),
    proxyFetch(playerUrl).then(r => r.json()),
  ]);

  return { schema, playerStats };
}

function setStatus(msg, type) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  el.textContent = msg;
  el.className   = 'sync-status' + (type ? ' ' + type : '');
}

function updateAchInlineTrackers() {
  const senior = document.getElementById('ach-tracker-senior');
  if (senior) {
    const v = Math.min(completedImpls(), 100);
    senior.querySelector('.ach-inline-val').textContent = `${v} / 100`;
    senior.querySelector('.ach-tracker-fill').style.width = v + '%';
    senior.classList.toggle('complete', v >= 100);
  }
  const debug = document.getElementById('ach-tracker-debug');
  if (debug) {
    const v = Math.min(completedMissions(), 100);
    debug.querySelector('.ach-inline-val').textContent = `${v} / 100`;
    debug.querySelector('.ach-tracker-fill').style.width = v + '%';
    debug.classList.toggle('complete', v >= 100);
  }
  const dcd = document.getElementById('ach-tracker-dcd');
  if (dcd) {
    const v = dontCheatCount(), t = DONT_CHEAT_TOTAL();
    dcd.querySelector('.ach-inline-val').textContent = `${v} / ${t}`;
    dcd.querySelector('.ach-tracker-fill').style.width = t > 0 ? (v / t * 100) + '%' : '0%';
    dcd.classList.toggle('complete', t > 0 && v >= t);
  }
}


function renderAchievements() {
  const list  = document.getElementById('achievements-list');
  list.innerHTML = '';

  const done  = completedAchs(), total = ACHIEVEMENTS_DATA.length;
  const fill  = document.getElementById('ach-progress-fill');
  const label = document.getElementById('ach-progress-label');
  if (fill)  fill.style.width = (done / total * 100) + '%';
  if (label) label.textContent = `${done} / ${total} achievements`;

  ACHIEVEMENTS_DATA.forEach(ach => {
    const unlocked = !!state.achievements[ach.key];
    let inlineTracker = '';
    if (ach.key === 'senior_test_player') {
      const v = Math.min(completedImpls(), 100);
      inlineTracker = `<div class="ach-inline-tracker${v >= 100 ? ' complete' : ''}" id="ach-tracker-senior">
        <span class="ach-inline-label">Implementations</span>
        <div class="ach-tracker-bar ach-tracker-bar-inline"><div class="ach-tracker-fill" style="width:${v}%"></div></div>
        <span class="ach-inline-val">${v} / 100</span>
      </div>`;
    } else if (ach.key === 'complete_debug') {
      const v = Math.min(completedMissions(), 100);
      inlineTracker = `<div class="ach-inline-tracker${v >= 100 ? ' complete' : ''}" id="ach-tracker-debug">
        <span class="ach-inline-label">Missions</span>
        <div class="ach-tracker-bar ach-tracker-bar-inline"><div class="ach-tracker-fill" style="width:${v}%"></div></div>
        <span class="ach-inline-val">${v} / 100</span>
      </div>`;
    } else if (ach.key === 'dont_cheat_daddy') {
      const v = dontCheatCount(), t = DONT_CHEAT_TOTAL();
      inlineTracker = `<div class="ach-inline-tracker${t > 0 && v >= t ? ' complete' : ''}" id="ach-tracker-dcd">
        <span class="ach-inline-label">Max affection</span>
        <div class="ach-tracker-bar ach-tracker-bar-inline"><div class="ach-tracker-fill green" style="width:${t > 0 ? (v/t*100) : 0}%"></div></div>
        <span class="ach-inline-val">${v} / ${t}</span>
      </div>`;
    }

    const row = document.createElement('div');
    row.className = 'ach-row' + (unlocked ? ' unlocked' : '');
    row.innerHTML = `
      <button class="impl-circle ${unlocked ? 'impl-circle-done' : 'impl-circle-empty'}" title="${unlocked ? 'Mark as locked' : 'Mark as unlocked'}">✓</button>
      <div class="ach-info">
        <div class="ach-name">${ach.name}</div>
        <div class="ach-desc-row">
          <span class="ach-desc">${ach.description}</span>
          ${inlineTracker}
        </div>
      </div>`;

    const circleBtn = row.querySelector('.impl-circle');
    circleBtn.addEventListener('click', e => {
      e.stopPropagation();
      const newUnlocked = !state.achievements[ach.key];
      state.achievements[ach.key] = newUnlocked;
      row.classList.toggle('unlocked', newUnlocked);
      circleBtn.className = `impl-circle ${newUnlocked ? 'impl-circle-done' : 'impl-circle-empty'}`;
      circleBtn.title = newUnlocked ? 'Mark as locked' : 'Mark as unlocked';
      saveState();
      updateOverview();
      const d = completedAchs();
      if (fill)  fill.style.width = (d / total * 100) + '%';
      if (label) label.textContent = `${d} / ${total} achievements`;
    });
    row.addEventListener('click', e => { if (!e.target.closest('.impl-circle')) circleBtn.click(); });
    list.appendChild(row);
  });
}

// ============================================================
// TAB 5 — IMPLEMENTATIONS
// ============================================================
const REWARD_TYPE_COLORS = {
  'System':           { bg: 'rgba(0,212,255,0.12)',   border: 'rgba(0,212,255,0.4)',   text: '#00d4ff' },
  'Battle Skill':     { bg: 'rgba(255,136,0,0.12)',   border: 'rgba(255,136,0,0.4)',   text: '#ff8800' },
  'Sword Skill':      { bg: 'rgba(255,68,68,0.12)',   border: 'rgba(255,68,68,0.4)',   text: '#ff4444' },
  'Rapier':           { bg: 'rgba(255,170,200,0.12)', border: 'rgba(255,170,200,0.4)', text: '#ffaac8' },
  'Two-Handed Sword': { bg: 'rgba(180,60,60,0.15)',   border: 'rgba(180,60,60,0.5)',   text: '#e06060' },
  'Two-Handed Axe':   { bg: 'rgba(160,90,40,0.15)',   border: 'rgba(160,90,40,0.5)',   text: '#c87830' },
  'One-Handed Sword': { bg: 'rgba(100,160,255,0.12)', border: 'rgba(100,160,255,0.4)', text: '#64a0ff' },
  'One-Handed Club':  { bg: 'rgba(140,100,60,0.15)',  border: 'rgba(140,100,60,0.5)',  text: '#b08040' },
  'Gloves':           { bg: 'rgba(120,200,120,0.12)', border: 'rgba(120,200,120,0.4)', text: '#78c878' },
  'Armor':            { bg: 'rgba(150,150,200,0.12)', border: 'rgba(150,150,200,0.4)', text: '#9696c8' },
  'Boots':            { bg: 'rgba(100,180,140,0.12)', border: 'rgba(100,180,140,0.4)', text: '#64b48c' },
  'Ring':             { bg: 'rgba(255,215,0,0.12)',   border: 'rgba(255,215,0,0.4)',   text: '#ffd700' },
  'Necklace':         { bg: 'rgba(220,180,255,0.12)', border: 'rgba(220,180,255,0.4)', text: '#dcb4ff' },
  'Charm':            { bg: 'rgba(255,180,220,0.12)', border: 'rgba(255,180,220,0.4)', text: '#ffb4dc' },
  'Scimitar':         { bg: 'rgba(200,160,60,0.12)',  border: 'rgba(200,160,60,0.4)',  text: '#c8a03c' },
  'Dagger':           { bg: 'rgba(180,220,100,0.12)', border: 'rgba(180,220,100,0.4)', text: '#b4dc64' },
  'Spear':            { bg: 'rgba(80,180,200,0.12)',  border: 'rgba(80,180,200,0.4)',  text: '#50b4c8' },
  'Katana':           { bg: 'rgba(200,80,100,0.12)',  border: 'rgba(200,80,100,0.4)',  text: '#c85064' },
};

function renderImplementations() {
  const list  = document.getElementById('impl-list');
  const fill  = document.getElementById('impl-progress-fill');
  const label = document.getElementById('impl-progress-label');
  if (!list) return;

  const done  = completedImpls(), total = totalImpls();
  if (fill)  fill.style.width = total > 0 ? (done / total * 100) + '%' : '0%';
  if (label) label.textContent = `${done} / ${total}`;

  const sorted = [...IMPLEMENTATIONS_DATA].sort((a, b) =>
    implSortKey(a.id) < implSortKey(b.id) ? -1 : 1
  );

  // Type filter: matching items + all their ancestors
  let typeVisible = null;
  if (implFilterType !== 'all') {
    const matchIds = new Set(sorted.filter(i => i.rewardType === implFilterType).map(i => i.id));
    typeVisible = new Set(matchIds);
    matchIds.forEach(id => {
      let curr = implParentId(id);
      while (curr) { typeVisible.add(curr); curr = implParentId(curr); }
    });
  }

  // Search filter: matching items + all their ancestors
  const searchQ = implSearch.toLowerCase().trim();
  let searchVisible = null;
  if (searchQ) {
    const matchIds = new Set(sorted.filter(i =>
      i.name.toLowerCase().includes(searchQ) || i.id.includes(searchQ)
    ).map(i => i.id));
    searchVisible = new Set(matchIds);
    matchIds.forEach(id => {
      let curr = implParentId(id);
      while (curr) { searchVisible.add(curr); curr = implParentId(curr); }
    });
  }

  // Group by root ID
  const groups = new Map();
  sorted.forEach(impl => {
    const root = impl.id.split('.')[0];
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(impl);
  });

  list.innerHTML = '';
  groups.forEach((items, rootId) => {
    const visibleItems = items.filter(impl => {
      if (typeVisible   && !typeVisible.has(impl.id))   return false;
      if (searchVisible && !searchVisible.has(impl.id)) return false;
      if (implHideCompleted && implStatus(impl.id) === 'implemented') return false;
      return true;
    });
    if (!visibleItems.length) return;

    const isCollapsed = !!implCollapsed[rootId];

    const group = document.createElement('div');
    group.className = `impl-group${isCollapsed ? ' collapsed' : ''}`;
    group.dataset.group = rootId;

    const rootItem = IMPLEMENTATIONS_DATA.find(i => i.id === rootId);
    const header = document.createElement('div');
    header.className = 'impl-group-header';
    header.innerHTML = `<span class="impl-group-label"><span class="impl-group-label-id">${rootId}</span><span class="impl-group-label-name">${rootItem ? rootItem.name : ''}</span></span><span class="impl-group-chevron">▼</span>`;
    header.addEventListener('click', () => {
      implCollapsed[rootId] = !implCollapsed[rootId];
      renderImplementations();
    });

    const body = document.createElement('div');
    body.className = 'impl-group-body';

    visibleItems.forEach(impl => {
      const status    = implStatus(impl.id);
      const available = implIsAvailable(impl.id);
      const depth     = implDepth(impl.id);
      const locked    = !available && status !== 'checking' && status !== 'implement' && status !== 'implemented';

      const row = document.createElement('div');
      row.className = `impl-row impl-depth-${Math.min(depth, 4)} impl-status-${locked ? 'locked' : (status || 'available')}`;
      row.dataset.id = impl.id;

      const color = REWARD_TYPE_COLORS[impl.rewardType] || REWARD_TYPE_COLORS['System'];
      const target = impl.rewardTarget !== null ? impl.rewardTarget.toLocaleString() : '1';
      const rewardCurrent = (status === 'implement' || status === 'implemented') ? target : '0';
      const rewardLabel = `${impl.rewardType} <span class="impl-target">${rewardCurrent} / ${target}</span>`;
      const hpBadge = impl.hollowPointCost !== null
        ? `<span class="impl-hp-cost">Hollow Points ${impl.hollowPointCost.toLocaleString()}</span>`
        : '';

      let circleBtn;
      if (locked) {
        circleBtn = '<span class="impl-circle impl-circle-locked">🔒</span>';
      } else if (status === 'implemented') {
        circleBtn = `<button class="impl-circle impl-circle-done" data-action="undo" data-id="${impl.id}" title="Undo">✓</button>`;
      } else {
        circleBtn = `<button class="impl-circle impl-circle-empty" data-action="complete" data-id="${impl.id}" title="Mark as Implemented">✓</button>`;
      }

      let rightBtn = '';
      if (!locked) {
        if (status === 'implemented') {
          rightBtn = `<button class="impl-btn impl-btn-done" data-action="cycle" data-id="${impl.id}">Implemented</button>`;
        } else if (status === 'implement') {
          rightBtn = `<button class="impl-btn impl-btn-implement" data-action="cycle" data-id="${impl.id}">Implement</button>`;
        } else if (status === 'checking') {
          rightBtn = `<button class="impl-btn impl-btn-checking" data-action="cycle" data-id="${impl.id}">Checking</button>`;
        } else {
          rightBtn = `<button class="impl-btn impl-btn-activate" data-action="cycle" data-id="${impl.id}">Start</button>`;
        }
      }

      row.innerHTML = `
        <div class="impl-main">
          ${circleBtn}
          <div class="impl-info">
            <div class="impl-name-row">
              <span class="impl-id${depth > 0 ? ' impl-id-child' : ''}">${impl.id}</span>
              <span class="impl-name">${impl.name}</span>
            </div>
            <div class="impl-badges">
              <span class="impl-reward-badge" style="background:${color.bg};border-color:${color.border};color:${color.text}">${rewardLabel}</span>
              ${hpBadge}
            </div>
          </div>
          <div class="impl-actions">
            ${rightBtn}
            <button class="impl-expand-btn" data-id="${impl.id}" title="Details">▼</button>
          </div>
        </div>
        <div class="impl-details" id="impl-details-${impl.id.replace(/\./g, '-')}">
          <div class="impl-details-grid">
            <div class="impl-detail-block">
              <span class="impl-detail-label">TESTING INFO</span>
              <span class="impl-detail-value">${impl.testingInfo}</span>
            </div>
            <div class="impl-detail-block">
              <span class="impl-detail-label">OBJECTIVE</span>
              <span class="impl-detail-value">${impl.objective}</span>
            </div>
            ${impl.restrictions && impl.restrictions !== 'None' ? `
            <div class="impl-detail-block">
              <span class="impl-detail-label">RESTRICTIONS</span>
              <span class="impl-detail-value">${impl.restrictions}</span>
            </div>` : ''}
            ${impl.targetMissions ? `
            <div class="impl-detail-block">
              <span class="impl-detail-label">TARGET MISSIONS</span>
              <span class="impl-detail-value">${impl.targetMissions}</span>
            </div>` : ''}
            ${impl.notes ? `
            <div class="impl-detail-block">
              <span class="impl-detail-label">NOTES</span>
              <span class="impl-detail-value impl-notes">${impl.notes}</span>
            </div>` : ''}
          </div>
        </div>`;

      row.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const id     = btn.dataset.id;
          const action = btn.dataset.action;
          if (action === 'complete') {
            state.implementations[id] = 'implemented';
          } else if (action === 'cycle') {
            const current = implStatus(id);
            if (!current) {
              Object.keys(state.implementations).forEach(k => {
                if (state.implementations[k] === 'checking') state.implementations[k] = null;
              });
              state.implementations[id] = 'checking';
            } else if (current === 'checking') {
              state.implementations[id] = 'implement';
            } else if (current === 'implement') {
              state.implementations[id] = 'implemented';
            } else if (current === 'implemented') {
              state.implementations[id] = null;
              lockDescendantsIfNeeded(id);
            }
          } else if (action === 'undo') {
            state.implementations[id] = null;
            lockDescendantsIfNeeded(id);
          }
          saveState();
          updateOverview();
          updateAchInlineTrackers();
          renderImplementations();
        });
      });

      const expandBtn = row.querySelector('.impl-expand-btn');
      const mainDiv   = row.querySelector('.impl-main');
      const detailsEl = row.querySelector('.impl-details');
      const toggleDetails = e => {
        if (e.target.closest('[data-action]')) return;
        const open = detailsEl.classList.toggle('open');
        expandBtn.textContent = open ? '▲' : '▼';
      };
      expandBtn.addEventListener('click', toggleDetails);
      mainDiv.addEventListener('click', toggleDetails);

      body.appendChild(row);
    });

    group.appendChild(header);
    group.appendChild(body);
    list.appendChild(group);
  });
  applyChildImplIdVisibility();
}

function initImplControls() {
  const panel = document.getElementById('panel-implementations');
  if (!panel || document.getElementById('impl-filter-bar')) return;

  const types = [...new Set(IMPLEMENTATIONS_DATA.map(i => i.rewardType))].sort();

  const bar = document.createElement('div');
  bar.id = 'impl-filter-bar';
  bar.innerHTML = `
    <div class="flex-row mt-8" style="margin-bottom:8px;flex-wrap:wrap;gap:8px;">
      <input id="impl-search" type="text" placeholder="Search implementations…"
        style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-size:13px;padding:6px 10px;outline:none;flex:1;min-width:160px;">
      <button id="impl-expand-all" class="btn btn-small">Expand All</button>
      <button id="impl-collapse-all" class="btn btn-small">Collapse All</button>
      <button id="impl-hide-completed-btn" class="btn btn-small">Hide Completed</button>
    </div>
    <div class="flex-row" style="margin-bottom:12px;flex-wrap:wrap;gap:8px;">
      <select id="impl-filter-type" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-size:13px;padding:6px 10px;outline:none;cursor:pointer;">
        <option value="all">All Reward Types</option>
        ${types.map(t => `<option value="${t}">${t}</option>`).join('')}
      </select>
    </div>`;

  const implList = panel.querySelector('#impl-list');
  panel.insertBefore(bar, implList);

  document.getElementById('impl-search').addEventListener('input', e => {
    implSearch = e.target.value;
    renderImplementations();
  });
  document.getElementById('impl-expand-all').addEventListener('click', () => {
    IMPLEMENTATIONS_DATA.filter(i => implDepth(i.id) === 0).forEach(i => { delete implCollapsed[i.id]; });
    renderImplementations();
  });
  document.getElementById('impl-collapse-all').addEventListener('click', () => {
    IMPLEMENTATIONS_DATA.filter(i => implDepth(i.id) === 0).forEach(i => { implCollapsed[i.id] = true; });
    renderImplementations();
  });
  document.getElementById('impl-hide-completed-btn').addEventListener('click', function() {
    implHideCompleted = !implHideCompleted;
    this.textContent = implHideCompleted ? 'Show Completed' : 'Hide Completed';
    renderImplementations();
  });
  document.getElementById('impl-filter-type').addEventListener('change', e => {
    implFilterType = e.target.value;
    renderImplementations();
  });
}

function lockDescendantsIfNeeded(parentId) {
  IMPLEMENTATIONS_DATA.forEach(impl => {
    if (implParentId(impl.id) === parentId) {
      const s = implStatus(impl.id);
      if (s === 'checking' || s === 'implement' || s === 'implemented') {
        state.implementations[impl.id] = null;
        lockDescendantsIfNeeded(impl.id);
      }
    }
  });
}

// ============================================================
// TAB 6 — SETTINGS
// ============================================================
function renderSettingsTab() {
  const panel = document.getElementById('panel-settings');
  panel.innerHTML = `
    <div class="settings-sections">

      <div class="settings-section">
        <h2 class="settings-section-title">About</h2>
        <div class="about-card">
          <p><strong style="color:var(--accent)">SAO Re: Hollow Fragment Tracker</strong> is a fan-made progress tracker for
          <strong>Sword Art Online Re: Hollow Fragment</strong> on Steam.</p>
          <p style="margin-top:10px;">Track your progress across:</p>
          <ul class="about-list">
            <li><strong>Hollow Missions</strong> — all missions organised by area, rank, and type</li>
            <li><strong>Implementations</strong> — track the implementation chain through four statuses: Start → Checking → Implement → Implemented. Use the <strong>right button</strong> to step through statuses, or the <strong>left circle</strong> to quick-complete in one click. Click anywhere on any row — locked or unlocked — to expand its detailed testing info.</li>
            <li><strong>Floor Tracker</strong> — Last Attacking Bonus for floors 76–100</li>
            <li><strong>Affection</strong> — character relationship levels (1–5 stars)</li>
            <li><strong>Achievements</strong> — all 54 Steam achievements, with optional Steam sync</li>
          </ul>
          <p class="about-note">All progress is saved locally in your browser. Nothing is ever sent to any server.</p>
        </div>
      </div>

      <div class="settings-section">
        <h2 class="settings-section-title">Steam Sync</h2>
        <div id="steam-config-area"></div>
      </div>

      <div class="settings-section">
        <h2 class="settings-section-title">Progress Bars</h2>
        <p class="text-dim" style="font-size:12px; margin-bottom:12px;">
          Show or hide the progress bar at the top of each tab.
        </p>
        <div id="pb-toggle-list" class="reset-trackers">
          ${[
            { key: 'hm',              label: 'Hollow Missions'  },
            { key: 'implementations', label: 'Implementations'  },
            { key: 'floors',          label: 'Floor Tracker'    },
            { key: 'affection',       label: 'Affection'        },
            { key: 'achievements',    label: 'Achievements'     },
          ].map(({ key, label }) => `
            <label class="reset-tracker-item">
              <input type="checkbox" class="pb-toggle" data-key="${key}"${state.progressBars[key] ? ' checked' : ''} style="accent-color:var(--accent)">
              <span>${label}</span>
            </label>`).join('')}
        </div>
      </div>

      <div class="settings-section">
        <h2 class="settings-section-title">Display Options</h2>
        <div class="reset-trackers">
          <label class="reset-tracker-item">
            <input type="checkbox" id="toggle-child-impl-ids"${state.showChildImplIds ? ' checked' : ''} style="accent-color:var(--accent)">
            <span>Show IDs on child implementations</span>
          </label>
        </div>
      </div>

      <div class="settings-section">
        <h2 class="settings-section-title">Reset Tracking</h2>
        <div class="reset-card">
          <p class="text-dim" style="font-size:12px; margin-bottom:12px;">
            Select which trackers to reset. This permanently removes your saved progress for those categories.
          </p>
          <div class="reset-trackers">
            <label class="reset-tracker-item"><input type="checkbox" id="reset-hollowMissions"> Hollow Missions</label>
            <label class="reset-tracker-item"><input type="checkbox" id="reset-floors"> Floor Tracker</label>
            <label class="reset-tracker-item"><input type="checkbox" id="reset-affection"> Affection</label>
            <label class="reset-tracker-item"><input type="checkbox" id="reset-achievements"> Achievements</label>
            <label class="reset-tracker-item"><input type="checkbox" id="reset-implementations"> Implementations</label>
          </div>
          <div class="reset-actions">
            <button id="reset-selected-btn" class="btn btn-danger">Reset Selected</button>
          </div>
          <div id="reset-confirm-area"></div>
          <div id="reset-status" class="sync-status" style="margin-top:8px;"></div>
        </div>
      </div>

    </div>`;

  renderSteamConfigArea();
  initResetSection();
  initProgressBarToggles();
}

function initProgressBarToggles() {
  document.querySelectorAll('.pb-toggle').forEach(cb => {
    cb.addEventListener('change', () => {
      state.progressBars[cb.dataset.key] = cb.checked;
      saveState();
      applyProgressBarVisibility();
    });
  });
  const childIdToggle = document.getElementById('toggle-child-impl-ids');
  if (childIdToggle) {
    childIdToggle.addEventListener('change', () => {
      state.showChildImplIds = childIdToggle.checked;
      saveState();
      applyChildImplIdVisibility();
    });
  }
}

function renderSteamConfigArea() {
  const area = document.getElementById('steam-config-area');
  if (!area) return;

  if (isSteamConfigured()) {
    const masked = '●'.repeat(8) + state.steamConfig.apiKey.slice(-4);
    area.innerHTML = `
      <div class="steam-configured-card">
        <div class="steam-configured-status">
          <span class="steam-status-dot"></span>
          <span style="color:var(--green); font-weight:700; font-size:13px;">Connected</span>
        </div>
        <div class="steam-configured-fields">
          <div class="steam-configured-field">
            <span class="steam-configured-label">STEAM ID</span>
            <span class="steam-configured-value">${state.steamConfig.steamId}</span>
          </div>
          <div class="steam-configured-field">
            <span class="steam-configured-label">API KEY</span>
            <span class="steam-configured-value" style="font-family:monospace; letter-spacing:2px;">${masked}</span>
          </div>
        </div>
        <button id="remove-steam-btn" class="btn btn-danger btn-small">Remove Steam Sync</button>
      </div>
      <div class="privacy-note" style="margin-top:10px;">
        <strong style="color:var(--gold)">Privacy note:</strong>
        Syncing routes your API key and Steam ID through a CORS proxy to reach the Steam API from the browser.
        Your key is <strong>read-only</strong> and cannot modify your account.
        Credentials are stored only in your browser's localStorage — never on any server.
      </div>`;
    document.getElementById('remove-steam-btn').addEventListener('click', () => {
      state.steamConfig = { apiKey: '', steamId: '' };
      saveState();
      renderSteamConfigArea();
      renderAchievementsSteamArea();
    });
  } else {
    area.innerHTML = `
      <div class="settings-row">
        <div class="settings-field">
          <label>STEAM API KEY — <a href="https://steamcommunity.com/dev/apikey" target="_blank" rel="noopener" style="color:var(--accent)">Get a free key here</a></label>
          <input id="steam-api-key-input" type="password" placeholder="Paste your Steam API key">
        </div>
        <div class="settings-field">
          <label>STEAM ID (64-bit)</label>
          <input id="steam-id-input" type="text" placeholder="e.g. 76561198xxxxxxxxx">
        </div>
        <button id="save-steam-btn" class="btn">Save Steam Sync</button>
      </div>
      <div class="privacy-note" style="margin-top:10px;">
        <strong style="color:var(--gold)">Privacy note:</strong>
        Syncing routes your API key and Steam ID through a CORS proxy to reach the Steam API from the browser.
        Your key is <strong>read-only</strong> and cannot modify your account.
        Credentials are stored only in your browser's localStorage — never on any server.
        You can also track achievements manually without adding Steam sync.
      </div>`;
    document.getElementById('save-steam-btn').addEventListener('click', () => {
      const apiKey  = document.getElementById('steam-api-key-input').value.trim();
      const steamId = document.getElementById('steam-id-input').value.trim();
      if (!apiKey)  { alert('Please enter your Steam API key.'); return; }
      if (!steamId) { alert('Please enter your Steam ID.'); return; }
      state.steamConfig = { apiKey, steamId };
      state.steamHintDismissed = true;
      saveState();
      renderSteamConfigArea();
      renderAchievementsSteamArea();
    });
  }
}

function initResetSection() {
  const btn = document.getElementById('reset-selected-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const trackers = [
      { id: 'hollowMissions',  label: 'Hollow Missions'  },
      { id: 'floors',          label: 'Floor Tracker'    },
      { id: 'affection',       label: 'Affection'         },
      { id: 'achievements',    label: 'Achievements'      },
      { id: 'implementations', label: 'Implementations'   },
    ];
    const selected = trackers.filter(t => document.getElementById('reset-' + t.id)?.checked);
    const statusEl = document.getElementById('reset-status');
    if (!selected.length) {
      statusEl.textContent = 'Select at least one tracker to reset.';
      statusEl.className = 'sync-status error';
      return;
    }
    statusEl.textContent = '';
    const confirmArea = document.getElementById('reset-confirm-area');
    const names = selected.map(t => t.label).join(', ');
    confirmArea.innerHTML = `
      <div class="reset-confirm">
        <span class="reset-confirm-msg">Reset <strong>${names}</strong>? This cannot be undone.</span>
        <div class="reset-confirm-btns">
          <button id="reset-cancel-btn" class="btn btn-small">Cancel</button>
          <button id="reset-confirm-btn" class="btn btn-danger btn-small">Confirm Reset</button>
        </div>
      </div>`;
    document.getElementById('reset-cancel-btn').addEventListener('click', () => {
      confirmArea.innerHTML = '';
    });
    document.getElementById('reset-confirm-btn').addEventListener('click', () => {
      selected.forEach(t => { state[t.id] = {}; });
      saveState();
      if (selected.some(t => t.id === 'hollowMissions')) renderHollowMissions();
      if (selected.some(t => t.id === 'floors'))         renderFloorTracker();
      if (selected.some(t => t.id === 'affection'))      renderAffection();
      if (selected.some(t => t.id === 'achievements'))    { renderAchievements(); renderAchievementsSteamArea(); }
      if (selected.some(t => t.id === 'implementations')) renderImplementations();
      updateOverview();
      confirmArea.innerHTML = '';
      selected.forEach(t => { const el = document.getElementById('reset-' + t.id); if (el) el.checked = false; });
      statusEl.textContent = `Reset complete: ${names}.`;
      statusEl.className = 'sync-status success';
    });
  });
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  initTabs();
  renderHollowMissions();
  initHMControls();
  renderFloorTracker();
  renderAffection();
  renderAchievementsSteamArea();
  renderAchievements();
  renderImplementations();
  initImplControls();
  renderSettingsTab();
  updateOverview();
  applyProgressBarVisibility();
  applyChildImplIdVisibility();
});
