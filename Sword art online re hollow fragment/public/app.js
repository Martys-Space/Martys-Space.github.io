// ============================================================
// SAO Re: Hollow Fragment Tracker - App Logic
// ============================================================

const LS_KEY = 'sao_tracker_v1';

// ---- STATE ----
let state = {
  hollowMissions: {},   // { missionId: true }
  floors: {},           // { floorNum: true }
  affection: {},        // { characterId: 1-5 }
  achievements: {},     // { achievementKey: true }
  steamConfig: { apiKey: '', steamId: '' }
};

function loadState() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) state = Object.assign(state, JSON.parse(saved));
  } catch (e) { console.error('Failed to load state', e); }
}

function saveState() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (e) { console.error('Failed to save state', e); }
}

// ---- HELPERS ----
function buildIndentMap() {
  const map = {}; // id -> indent level
  const allMissions = AREAS.flatMap(a => a.missions);
  const idToMission = Object.fromEntries(allMissions.map(m => [m.id, m]));
  function getIndent(id) {
    if (map[id] !== undefined) return map[id];
    const m = idToMission[id];
    if (!m || !m.parentId) { map[id] = 0; return 0; }
    map[id] = getIndent(m.parentId) + 1;
    return map[id];
  }
  allMissions.forEach(m => getIndent(m.id));
  return map;
}
const INDENT_MAP = buildIndentMap();

function totalMissions() {
  return AREAS.reduce((sum, a) => sum + a.missions.length, 0);
}

function completedMissions() {
  return Object.values(state.hollowMissions).filter(Boolean).length;
}

function totalFloors() { return FLOORS_DATA.length; }

function completedFloors() {
  return Object.values(state.floors).filter(Boolean).length;
}

function maxAffectionCount() {
  return CHARACTERS_DATA.filter(c => (state.affection[c.id] || 0) >= 5).length;
}

function completedAchievements() {
  return Object.values(state.achievements).filter(Boolean).length;
}

// ---- OVERVIEW ----
function updateOverview() {
  const hm = completedMissions(), hmTotal = totalMissions();
  const fl = completedFloors(), flTotal = totalFloors();
  const aff = maxAffectionCount(), affTotal = CHARACTERS_DATA.length;
  const ach = completedAchievements(), achTotal = ACHIEVEMENTS_DATA.length;

  setOverviewStat('ov-hm',  hm,  hmTotal);
  setOverviewStat('ov-fl',  fl,  flTotal);
  setOverviewStat('ov-aff', aff, affTotal);
  setOverviewStat('ov-ach', ach, achTotal);
}

function setOverviewStat(id, done, total) {
  const el = document.getElementById(id);
  if (!el) return;
  const val = el.querySelector('.stat-value');
  const bar = el.querySelector('.progress-mini-fill');
  val.textContent = `${done}/${total}`;
  val.classList.toggle('complete', done === total);
  const pct = total > 0 ? (done / total) * 100 : 0;
  bar.style.width = pct + '%';
  bar.classList.toggle('complete', done === total);
}

// ---- TAB SWITCHING ----
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
// TAB 1: HOLLOW MISSIONS
// ============================================================
function renderHollowMissions() {
  const container = document.getElementById('hm-areas');
  container.innerHTML = '';

  AREAS.forEach(area => {
    const areaDone = area.missions.filter(m => state.hollowMissions[m.id]).length;
    const areaTotal = area.missions.length;

    const block = document.createElement('div');
    block.className = 'area-block';

    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `
      <span class="section-title">${area.name}</span>
      <span class="section-progress">
        <span class="${areaDone === areaTotal ? 'done' : ''}">${areaDone}</span>/${areaTotal}
      </span>
      <span class="chevron">▼</span>
    `;

    const missionsDiv = document.createElement('div');
    missionsDiv.className = 'area-missions';

    area.missions.forEach(m => {
      missionsDiv.appendChild(createMissionRow(m));
    });

    header.addEventListener('click', () => {
      header.classList.toggle('open');
      missionsDiv.classList.toggle('open');
    });

    block.appendChild(header);
    block.appendChild(missionsDiv);
    container.appendChild(block);
  });
}

function createMissionRow(m) {
  const done = !!state.hollowMissions[m.id];
  const indent = INDENT_MAP[m.id] || 0;

  const row = document.createElement('div');
  row.className = `mission-row type-${m.type} indent-${indent}${done ? ' completed' : ''}`;

  let typeTag = '';
  if (m.type === 'boss')        typeTag = '<span class="type-tag tag-boss">BOSS</span>';
  if (m.type === 'grand_quest') typeTag = '<span class="type-tag tag-grand_quest">GRAND QUEST</span>';
  if (m.type === 'uhq')         typeTag = '<span class="type-tag tag-uhq">ULTRA HARD</span>';

  row.innerHTML = `
    <input type="checkbox" class="mission-checkbox" ${done ? 'checked' : ''}>
    <span class="rank-badge rank-${m.rank}">${m.rank}</span>
    <div class="mission-info">
      <div class="mission-name">${typeTag}${m.name}</div>
      <div class="mission-meta"><span class="map-name">${m.map}</span> — ${m.objective}</div>
    </div>
    <div class="mission-num">#${m.num}</div>
  `;

  const cb = row.querySelector('.mission-checkbox');
  cb.addEventListener('change', () => {
    state.hollowMissions[m.id] = cb.checked;
    row.classList.toggle('completed', cb.checked);
    saveState();
    updateOverview();
    updateAreaProgress(m);
  });

  return row;
}

function updateAreaProgress(mission) {
  // Re-render just the area header progress (simpler to find and update)
  const area = AREAS.find(a => a.missions.some(m => m.id === mission.id));
  if (!area) return;
  const areaDone = area.missions.filter(m => state.hollowMissions[m.id]).length;
  const areaTotal = area.missions.length;
  // Find the section header for this area by index
  const headers = document.querySelectorAll('.section-header');
  const areaIndex = AREAS.indexOf(area);
  if (headers[areaIndex]) {
    const sp = headers[areaIndex].querySelector('.section-progress');
    sp.innerHTML = `<span class="${areaDone === areaTotal ? 'done' : ''}">${areaDone}</span>/${areaTotal}`;
  }
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
      const map = row.querySelector('.map-name').textContent.toLowerCase();
      row.style.display = (!q || name.includes(q) || map.includes(q)) ? '' : 'none';
    });
  });
}

// ============================================================
// TAB 2: FLOOR TRACKER
// ============================================================
function renderFloorTracker() {
  const grid = document.getElementById('floor-grid');
  grid.innerHTML = '';

  FLOORS_DATA.forEach(f => {
    const done = !!state.floors[f.floor];
    const card = document.createElement('div');
    card.className = 'floor-card' + (done ? ' has-bonus' : '');

    card.innerHTML = `
      <input type="checkbox" class="floor-card-check" ${done ? 'checked' : ''}>
      <div class="floor-card-info">
        <div class="floor-num">FLOOR ${f.floor}</div>
        <div class="floor-boss">${f.boss}</div>
      </div>
    `;

    const cb = card.querySelector('.floor-card-check');
    cb.addEventListener('change', () => {
      state.floors[f.floor] = cb.checked;
      card.classList.toggle('has-bonus', cb.checked);
      saveState();
      updateOverview();
      updateFloorProgress();
    });

    card.addEventListener('click', e => {
      if (e.target !== cb) cb.click();
    });

    grid.appendChild(card);
  });

  updateFloorProgress();
}

function updateFloorProgress() {
  const done = completedFloors(), total = totalFloors();
  const bar = document.getElementById('floor-progress-fill');
  const label = document.getElementById('floor-progress-label');
  if (bar) { bar.style.width = (done / total * 100) + '%'; bar.classList.toggle('green', done === total); }
  if (label) label.textContent = `${done} / ${total} floors`;
}

// ============================================================
// TAB 3: AFFECTION TRACKER
// ============================================================
const AVATAR_INITIALS = { asuna: 'A', yui: 'Y', silica: 'S', philia: 'P', sinon: 'Si', lisbeth: 'Li', strea: 'St', leafa: 'Le' };

function renderAffection() {
  const grid = document.getElementById('affection-grid');
  grid.innerHTML = '';

  CHARACTERS_DATA.forEach(char => {
    const rank = state.affection[char.id] || 0;
    const maxed = rank >= 5;

    const card = document.createElement('div');
    card.className = 'char-card' + (maxed ? ' maxed' : '');
    card.id = 'char-card-' + char.id;

    const achStatus = char.achievement
      ? (state.achievements[getAchKeyByName(char.achievement)]
          ? `<span class="char-achievement unlocked">★ ${char.achievement}</span>`
          : `<span class="char-achievement">${char.achievement}</span>`)
      : '';

    card.innerHTML = `
      <div class="char-avatar avatar-${char.id}">${AVATAR_INITIALS[char.id] || char.name[0]}</div>
      <div class="char-name">${char.name}</div>
      <div class="star-row" data-char="${char.id}">
        ${[1,2,3,4,5].map(i => `<button class="star-btn${rank >= i ? ' filled' : ''}" data-star="${i}">★</button>`).join('')}
      </div>
      ${achStatus}
    `;

    const starRow = card.querySelector('.star-row');
    starRow.addEventListener('click', e => {
      const btn = e.target.closest('.star-btn');
      if (!btn) return;
      const newRank = parseInt(btn.dataset.star);
      // Click same star to unset (toggle down)
      const current = state.affection[char.id] || 0;
      state.affection[char.id] = (current === newRank) ? newRank - 1 : newRank;
      saveState();
      updateOverview();
      updateAffectionCard(char.id);
    });

    grid.appendChild(card);
  });

  // Init affection progress bar
  const maxed = maxAffectionCount(), total = CHARACTERS_DATA.length;
  const bar = document.getElementById('aff-progress-fill');
  const label = document.getElementById('aff-max-label');
  if (bar)   bar.style.width = (maxed / total * 100) + '%';
  if (label) label.textContent = `${maxed} / ${total}`;
}

function updateAffectionCard(charId) {
  const card = document.getElementById('char-card-' + charId);
  if (!card) return;
  const rank = state.affection[charId] || 0;
  card.classList.toggle('maxed', rank >= 5);
  card.querySelectorAll('.star-btn').forEach(btn => {
    btn.classList.toggle('filled', parseInt(btn.dataset.star) <= rank);
  });
  // Update affection tab progress bar
  const maxed = maxAffectionCount(), total = CHARACTERS_DATA.length;
  const bar = document.getElementById('aff-progress-fill');
  const label = document.getElementById('aff-max-label');
  if (bar)   { bar.style.width = (maxed / total * 100) + '%'; }
  if (label) label.textContent = `${maxed} / ${total}`;
}

function getAchKeyByName(displayName) {
  const ach = ACHIEVEMENTS_DATA.find(a => a.name === displayName);
  return ach ? ach.key : null;
}

// ============================================================
// TAB 4: STEAM ACHIEVEMENTS
// ============================================================
function renderAchievements() {
  const list = document.getElementById('achievements-list');
  list.innerHTML = '';

  const done = completedAchievements(), total = ACHIEVEMENTS_DATA.length;
  const bar = document.getElementById('ach-progress-fill');
  const label = document.getElementById('ach-progress-label');
  if (bar)   bar.style.width = (done / total * 100) + '%';
  if (label) label.textContent = `${done} / ${total} achievements`;

  ACHIEVEMENTS_DATA.forEach(ach => {
    const unlocked = !!state.achievements[ach.key];
    const row = document.createElement('div');
    row.className = 'ach-row' + (unlocked ? ' unlocked' : '');

    row.innerHTML = `
      <input type="checkbox" class="ach-check" ${unlocked ? 'checked' : ''}>
      <div class="ach-icon">${unlocked ? '✅' : '🔒'}</div>
      <div class="ach-info">
        <div class="ach-name">${ach.name}</div>
        <div class="ach-desc">${ach.description}</div>
      </div>
    `;

    const cb = row.querySelector('.ach-check');
    cb.addEventListener('change', () => {
      state.achievements[ach.key] = cb.checked;
      row.classList.toggle('unlocked', cb.checked);
      row.querySelector('.ach-icon').textContent = cb.checked ? '✅' : '🔒';
      saveState();
      updateOverview();
      renderAchievements();
    });

    row.addEventListener('click', e => {
      if (e.target !== cb) cb.click();
    });

    list.appendChild(row);
  });
}

async function initSteamSync() {
  // Auto-populate Steam ID from server config
  try {
    const cfg = await fetch('/api/steam/config').then(r => r.json());
    const idInput = document.getElementById('steam-id');
    if (idInput && cfg.steamId) idInput.value = cfg.steamId;
    if (!cfg.configured) {
      document.getElementById('sync-status').textContent = 'No API key found in config.json.';
      document.getElementById('sync-status').className = 'sync-status error';
    }
  } catch (e) { /* server not available */ }

  document.getElementById('steam-sync-btn').addEventListener('click', async () => {
    const steamId = document.getElementById('steam-id').value.trim();
    const status  = document.getElementById('sync-status');

    if (!steamId) {
      status.textContent = 'Please enter your Steam ID.';
      status.className = 'sync-status error';
      return;
    }

    status.textContent = 'Syncing…';
    status.className = 'sync-status';

    try {
      const res = await fetch(`/api/steam/sync?steamId=${encodeURIComponent(steamId)}`);
      const data = await res.json();

      if (!res.ok || data.error) throw new Error(data.error || 'Steam API error');

      // Map apiname -> achieved from player stats
      const playerAchs = data.playerStats?.playerstats?.achievements || [];
      const apiAchMap = {};
      playerAchs.forEach(a => { apiAchMap[a.apiname] = a.achieved === 1; });

      // Map displayName (lowercase) -> achieved via schema
      const schemaAchs = data.schema?.game?.availableGameStats?.achievements || [];
      const displayNameMap = {};
      schemaAchs.forEach(a => {
        if (a.displayName) displayNameMap[a.displayName.toLowerCase()] = apiAchMap[a.name] || false;
      });

      // Match our list by display name
      let synced = 0;
      ACHIEVEMENTS_DATA.forEach(ach => {
        const key = ach.name.toLowerCase();
        if (displayNameMap[key] !== undefined) {
          state.achievements[ach.key] = displayNameMap[key];
          synced++;
        }
      });

      saveState();
      updateOverview();
      renderAchievements();

      const unlocked = Object.values(state.achievements).filter(Boolean).length;
      status.textContent = `Synced! ${unlocked}/${ACHIEVEMENTS_DATA.length} achievements unlocked on Steam.`;
      status.className = 'sync-status success';
    } catch (err) {
      status.textContent = `Error: ${err.message}`;
      status.className = 'sync-status error';
    }
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
  renderAchievements();
  initSteamSync();
  updateOverview();
});
