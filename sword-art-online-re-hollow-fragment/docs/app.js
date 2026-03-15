// ============================================================
// SAO Re: Hollow Fragment Tracker
// Works both on GitHub Pages (browser Steam sync via CORS proxy)
// and locally via Node.js server (API key stays in config.json)
// ============================================================

const LS_KEY     = 'sao_tracker_v1';
const CORS_PROXY = 'https://corsproxy.io/?';

// ---- STATE ----
let state = {
  hollowMissions: {},
  floors:         {},
  affection:      {},
  achievements:   {},
  steamConfig:    { apiKey: '', steamId: '' }
};

function loadState() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) state = Object.assign(state, JSON.parse(saved));
  } catch (e) { console.error('Failed to load state', e); }
}

function saveState() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  catch (e) { console.error('Failed to save state', e); }
}

// ---- HELPERS ----
function buildIndentMap() {
  const map = {};
  const allMissions = AREAS.flatMap(a => a.missions);
  const byId = Object.fromEntries(allMissions.map(m => [m.id, m]));
  function depth(id) {
    if (map[id] !== undefined) return map[id];
    const m = byId[id];
    map[id] = (!m || !m.parentId) ? 0 : depth(m.parentId) + 1;
    return map[id];
  }
  allMissions.forEach(m => depth(m.id));
  return map;
}
const INDENT_MAP = buildIndentMap();

const totalMissions    = () => AREAS.reduce((s, a) => s + a.missions.length, 0);
const completedMissions= () => Object.values(state.hollowMissions).filter(Boolean).length;
const totalFloors      = () => FLOORS_DATA.length;
const completedFloors  = () => Object.values(state.floors).filter(Boolean).length;
const maxAffectionCount= () => CHARACTERS_DATA.filter(c => (state.affection[c.id] || 0) >= 5).length;
const completedAchs    = () => Object.values(state.achievements).filter(Boolean).length;

// ---- OVERVIEW ----
function updateOverview() {
  setOvStat('ov-hm',  completedMissions(), totalMissions());
  setOvStat('ov-fl',  completedFloors(),   totalFloors());
  setOvStat('ov-aff', maxAffectionCount(), CHARACTERS_DATA.length);
  setOvStat('ov-ach', completedAchs(),     ACHIEVEMENTS_DATA.length);
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
function renderHollowMissions() {
  const container = document.getElementById('hm-areas');
  container.innerHTML = '';

  AREAS.forEach(area => {
    const areaDone  = area.missions.filter(m => state.hollowMissions[m.id]).length;
    const areaTotal = area.missions.length;

    const block  = document.createElement('div');
    block.className = 'area-block';

    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `
      <span class="section-title">${area.name}</span>
      <span class="section-progress">
        <span class="${areaDone === areaTotal ? 'done' : ''}">${areaDone}</span>/${areaTotal}
      </span>
      <span class="chevron">▼</span>`;

    const missionsDiv = document.createElement('div');
    missionsDiv.className = 'area-missions';
    area.missions.forEach(m => missionsDiv.appendChild(createMissionRow(m)));

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
  const done   = !!state.hollowMissions[m.id];
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
    <div class="mission-num">#${m.num}</div>`;

  const cb = row.querySelector('.mission-checkbox');
  cb.addEventListener('change', () => {
    state.hollowMissions[m.id] = cb.checked;
    row.classList.toggle('completed', cb.checked);
    saveState();
    updateOverview();
    refreshAreaHeader(m);
  });
  return row;
}

function refreshAreaHeader(mission) {
  const area = AREAS.find(a => a.missions.some(m => m.id === mission.id));
  if (!area) return;
  const done  = area.missions.filter(m => state.hollowMissions[m.id]).length;
  const total = area.missions.length;
  const idx   = AREAS.indexOf(area);
  const sp    = document.querySelectorAll('.section-header')[idx]?.querySelector('.section-progress');
  if (sp) sp.innerHTML = `<span class="${done === total ? 'done' : ''}">${done}</span>/${total}`;
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
      <input type="checkbox" class="floor-card-check" ${done ? 'checked' : ''}>
      <div class="floor-card-info">
        <div class="floor-num">FLOOR ${f.floor}</div>
        <div class="floor-boss">${f.boss}</div>
      </div>`;

    const cb = card.querySelector('.floor-card-check');
    cb.addEventListener('change', () => {
      state.floors[f.floor] = cb.checked;
      card.classList.toggle('has-bonus', cb.checked);
      saveState();
      updateOverview();
      updateFloorProgress();
    });
    card.addEventListener('click', e => { if (e.target !== cb) cb.click(); });
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
const INITIALS = { asuna:'A', yui:'Y', silica:'S', philia:'P', sinon:'Si', lisbeth:'Li', strea:'St', leafa:'Le' };

function renderAffection() {
  const grid = document.getElementById('affection-grid');
  grid.innerHTML = '';

  CHARACTERS_DATA.forEach(char => {
    const rank  = state.affection[char.id] || 0;
    const maxed = rank >= 5;
    const card  = document.createElement('div');
    card.className = 'char-card' + (maxed ? ' maxed' : '');
    card.id = 'char-card-' + char.id;

    const achHtml = char.achievement
      ? `<span class="char-achievement${state.achievements[getAchKey(char.achievement)] ? ' unlocked' : ''}">
           ${state.achievements[getAchKey(char.achievement)] ? '★' : '☆'} ${char.achievement}
         </span>`
      : '';

    card.innerHTML = `
      <div class="char-avatar avatar-${char.id}">${INITIALS[char.id] || char.name[0]}</div>
      <div class="char-name">${char.name}</div>
      <div class="star-row" data-char="${char.id}">
        ${[1,2,3,4,5].map(i => `<button class="star-btn${rank >= i ? ' filled' : ''}" data-star="${i}">★</button>`).join('')}
      </div>
      ${achHtml}`;

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
  card.classList.toggle('maxed', rank >= 5);
  card.querySelectorAll('.star-btn').forEach(btn => {
    btn.classList.toggle('filled', parseInt(btn.dataset.star) <= rank);
  });
  syncAffectionBar();
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
function renderSteamSettingsPanel() {
  const badge   = document.getElementById('steam-mode-badge');
  const content = document.getElementById('steam-settings-content');

  badge.textContent = 'PUBLIC';
  badge.className   = 'mode-badge public';
  content.innerHTML = `
    <div class="settings-row">
      <div class="settings-field">
        <label>STEAM API KEY</label>
        <input id="steam-api-key" type="password"
          placeholder="Get a free key at steamcommunity.com/dev/apikey"
          value="${state.steamConfig.apiKey || ''}">
      </div>
      <div class="settings-field">
        <label>STEAM ID (64-bit)</label>
        <input id="steam-id" type="text"
          placeholder="e.g. 76561198xxxxxxxxx"
          value="${state.steamConfig.steamId || ''}">
      </div>
      <button id="steam-sync-btn" class="btn">Sync from Steam</button>
    </div>
    <div class="privacy-note">
      <strong style="color:var(--gold)">Privacy note:</strong>
      Syncing sends your API key and Steam ID through
      <a href="https://corsproxy.io" target="_blank" rel="noopener">corsproxy.io</a>
      (a CORS proxy) to reach the Steam API from the browser.
      Your Steam API key is <strong>read-only</strong> and cannot modify your account.
      Credentials are only stored in your browser's localStorage — never on any server.
      You can also track achievements manually without entering any credentials.
    </div>`;

  // Attach sync button handler after DOM is ready
  requestAnimationFrame(() => attachSyncHandler());
}

function attachSyncHandler() {
  const btn = document.getElementById('steam-sync-btn');
  if (!btn) return;
  btn.addEventListener('click', handleSteamSync);
}

async function handleSteamSync() {
  const steamIdEl = document.getElementById('steam-id');
  const apiKeyEl  = document.getElementById('steam-api-key'); // null on local
  const steamId   = steamIdEl?.value.trim() || '';
  const apiKey    = apiKeyEl?.value.trim()  || '';

  if (!steamId) { setStatus('Please enter your Steam ID.', 'error'); return; }
  if (!apiKey) { setStatus('Please enter your Steam API key.', 'error'); return; }

  // Save credentials to localStorage (convenient for next visit)
  state.steamConfig = { apiKey, steamId };
  saveState();

  setStatus('Syncing with Steam…', '');

  try {
    const { schema, playerStats } = await fetchSteamData(apiKey, steamId);

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
    fetch(CORS_PROXY + encodeURIComponent(schemaUrl)).then(r => {
      if (!r.ok) throw new Error(`CORS proxy error ${r.status}`);
      return r.json();
    }),
    fetch(CORS_PROXY + encodeURIComponent(playerUrl)).then(r => {
      if (!r.ok) throw new Error(`CORS proxy error ${r.status}`);
      return r.json();
    })
  ]);

  return { schema, playerStats };
}

function setStatus(msg, type) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  el.textContent = msg;
  el.className   = 'sync-status' + (type ? ' ' + type : '');
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
    const row = document.createElement('div');
    row.className = 'ach-row' + (unlocked ? ' unlocked' : '');
    row.innerHTML = `
      <input type="checkbox" class="ach-check" ${unlocked ? 'checked' : ''}>
      <div class="ach-icon">${unlocked ? '✅' : '🔒'}</div>
      <div class="ach-info">
        <div class="ach-name">${ach.name}</div>
        <div class="ach-desc">${ach.description}</div>
      </div>`;

    const cb = row.querySelector('.ach-check');
    cb.addEventListener('change', () => {
      state.achievements[ach.key] = cb.checked;
      row.classList.toggle('unlocked', cb.checked);
      row.querySelector('.ach-icon').textContent = cb.checked ? '✅' : '🔒';
      saveState();
      updateOverview();
      // Refresh progress bar without re-rendering the whole list
      const d = completedAchs();
      if (fill)  fill.style.width = (d / total * 100) + '%';
      if (label) label.textContent = `${d} / ${total} achievements`;
    });
    row.addEventListener('click', e => { if (e.target !== cb) cb.click(); });
    list.appendChild(row);
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
  renderSteamSettingsPanel();
  renderAchievements();
  updateOverview();
});
