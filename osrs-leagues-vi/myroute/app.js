// =============================================
// Route Planner — League VI
// =============================================
const LS_KEY = 'osrsl6_route_v1';

const state = {
  relics:          {},   // tier (number) -> relicId
  relicNotes:      {},   // tier (number) -> note string
  regions:         ['', '', ''],   // 3 selected region ids
  regionNotes:     ['', '', ''],   // 3 note strings
  skills:          {},   // skillName -> { status, method, xphr, note }
  echoNotes:       {},   // bossName -> note string
  pactNotes:       {},   // 'region::task' -> note string
  pactDone:        {},   // 'region::task' -> boolean
  pactDifficulty:  {},   // 'region::task' -> ''|'easy'|'medium'|'hard'|'elite'|'master'
};

// ─── Persistence ──────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    Object.assign(state, saved);
    if (!Array.isArray(state.regions))     state.regions     = ['', '', ''];
    if (!Array.isArray(state.regionNotes)) state.regionNotes = ['', '', ''];
  } catch (e) { /* ignore corrupt data */ }
}

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
  showSaved();
}

let _saveTimer;
function scheduleSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(saveState, 400);
}

function showSaved() {
  const el = document.getElementById('save-status');
  el.textContent = 'Saved ✓';
  el.classList.add('visible');
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => { el.classList.remove('visible'); }, 2000);
}

// ─── Helpers ──────────────────────────────────
function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Parse user-entered XP/hr (handles "50k", "1.2m", "50,000", plain numbers)
function parseXp(str) {
  if (!str) return null;
  const s = str.trim().replace(/,/g, '').toLowerCase();
  if (!s) return null;
  const m = s.match(/^([\d.]+)\s*([km]?)$/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (isNaN(n)) return null;
  if (m[2] === 'k') n *= 1_000;
  if (m[2] === 'm') n *= 1_000_000;
  return n;
}

function formatXp(n) {
  if (n === null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'm';
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.?0+$/, '') + 'k';
  return Math.round(n).toString();
}

// ─── RELICS ───────────────────────────────────

// Find any relic by id across all tiers
function findRelic(id) {
  for (const tier of RELIC_TIERS) {
    const r = tier.relics.find(r => r.id === id);
    if (r) return { relic: r, tier };
  }
  return null;
}

// IDs of relics selected in T1–6
function pickedT16Ids() {
  return new Set(
    Object.entries(state.relics)
      .filter(([t]) => Number(t) >= 1 && Number(t) <= 6)
      .map(([, id]) => id)
      .filter(Boolean)
  );
}

function buildT7Options(selectedId) {
  const t7Tier  = RELIC_TIERS.find(t => t.tier === 7);
  const picked  = pickedT16Ids();

  // Real T7 relics except Reloaded
  const t7Html = t7Tier.relics
    .filter(r => r.id !== 'reloaded')
    .map(r => `<option value="${esc(r.id)}" ${r.id === selectedId ? 'selected' : ''}>${esc(r.name)}</option>`)
    .join('');

  // All T1–6 relics not already chosen
  const available = [];
  for (let t = 1; t <= 6; t++) {
    const td = RELIC_TIERS.find(x => x.tier === t);
    if (!td) continue;
    td.relics.forEach(r => {
      if (!picked.has(r.id)) available.push(r);
    });
  }

  const reloadedVal = selectedId && selectedId.startsWith('reloaded:') ? selectedId : '';
  const t16Html = available
    .map(r => `<option value="reloaded:${esc(r.id)}" ${'reloaded:' + r.id === reloadedVal ? 'selected' : ''}>${esc(r.name)}</option>`)
    .join('');

  return t7Html + (t16Html ? `<optgroup label="── Via Reloaded ──">${t16Html}</optgroup>` : '');
}

function buildRelicRow(tier) {
  const selectedId = state.relics[tier.tier] || '';
  const note       = state.relicNotes[tier.tier] || '';
  const isT7       = tier.tier === 7;

  const options = isT7
    ? buildT7Options(selectedId)
    : tier.relics.map(r => `<option value="${esc(r.id)}" ${r.id === selectedId ? 'selected' : ''}>${esc(r.name)}</option>`).join('');

  const row = document.createElement('div');
  row.className = 'rp-relic-row';
  row.dataset.tier = tier.tier;
  row.innerHTML = `
    <span class="rp-tier-label">T${tier.tier}</span>
    <div class="rp-relic-inner">
      <select class="rp-select">
        <option value="">— Choose —</option>
        ${options}
      </select>
      <input class="rp-note" type="text" placeholder="Note…" value="${esc(note)}">
    </div>
    <button class="rp-info-btn" title="View relic info" ${selectedId ? '' : 'disabled'}>ℹ</button>
  `;

  const select  = row.querySelector('select');
  const noteEl  = row.querySelector('input');
  const infoBtn = row.querySelector('.rp-info-btn');

  select.addEventListener('change', () => {
    state.relics[tier.tier] = select.value;
    infoBtn.disabled = !select.value;
    // T1–6 change affects what's available in T7 via Reloaded
    if (!isT7) rerenderT7();
    scheduleSave();
  });

  noteEl.addEventListener('input', () => {
    state.relicNotes[tier.tier] = noteEl.value;
    scheduleSave();
  });

  infoBtn.addEventListener('click', () => {
    const val = select.value;
    if (!val) return;
    if (val.startsWith('reloaded:')) {
      // Show info for the T1–6 relic chosen via Reloaded
      const found = findRelic(val.replace('reloaded:', ''));
      if (found) openRelicPopup(found.tier.tier, found.relic.id);
    } else {
      openRelicPopup(tier.tier, val);
    }
  });

  return row;
}

function rerenderT7() {
  const t7Tier = RELIC_TIERS.find(t => t.tier === 7);
  if (!t7Tier) return;
  const old = document.querySelector('[data-tier="7"]');
  if (old) old.replaceWith(buildRelicRow(t7Tier));
}

function renderRelics() {
  const container = document.getElementById('relic-list');
  container.innerHTML = '';
  RELIC_TIERS.forEach(tier => container.appendChild(buildRelicRow(tier)));
}

function openRelicPopup(tierNum, relicId) {
  const tier  = RELIC_TIERS.find(t => t.tier === tierNum);
  const relic = tier?.relics.find(r => r.id === relicId);
  if (!tier || !relic) return;

  document.getElementById('popup-title').textContent = `T${tierNum}: ${relic.name}`;

  const body = document.getElementById('popup-body');
  body.innerHTML = `
    ${relic.gift       ? `<div class="popup-gift">🎁 Gift: <strong>${relic.gift}</strong></div>` : ''}
    ${relic.toggleable ? `<div class="popup-toggle">⚙ Toggleable: ${relic.toggleable}</div>` : ''}
    <ul class="popup-effects">
      ${relic.effects.map(e => `<li>${e}</li>`).join('')}
    </ul>
    ${tier.passives.length ? `
      <div class="popup-passives">
        <div class="popup-passives-label">Tier ${tierNum} passives</div>
        <ul>${tier.passives.map(p => `<li>${p}</li>`).join('')}</ul>
      </div>` : ''}
  `;

  document.getElementById('relic-popup').removeAttribute('hidden');
}

// ─── REGIONS ──────────────────────────────────
function renderRegions() {
  const container = document.getElementById('region-list');
  container.innerHTML = '';

  for (let i = 0; i < 3; i++) {
    const selectedId = state.regions[i]     || '';
    const note       = state.regionNotes[i] || '';

    const ALWAYS_ON = new Set(['varlamore', 'karamja']);
    const options = REGIONS.filter(r => !ALWAYS_ON.has(r.id)).map(r => {
      return `<option value="${esc(r.id)}" ${r.id === selectedId ? 'selected' : ''}>${r.icon} ${esc(r.name)}</option>`;
    }).join('');

    const row = document.createElement('div');
    row.className = 'rp-region-row';
    row.innerHTML = `
      <span class="rp-region-num">${i + 1}</span>
      <div class="rp-region-fields">
        <select class="rp-select" data-slot="${i}">
          <option value="">— Region —</option>
          ${options}
        </select>
        <input class="rp-note" type="text" placeholder="Notes for this region…" value="${esc(note)}">
      </div>
    `;

    container.appendChild(row);

    row.querySelector('select').addEventListener('change', e => {
      state.regions[i] = e.target.value;
      renderEcho();
      renderPactTasks();
      scheduleSave();
    });
    row.querySelector('input').addEventListener('input', e => {
      state.regionNotes[i] = e.target.value;
      scheduleSave();
    });
  }
}

// ─── SKILLS ───────────────────────────────────
const STATUSES      = ['unsolved', 'planning', 'solved'];
const STATUS_LABELS = { unsolved: 'Unsolved', planning: 'Planning', solved: 'Solved' };

function renderSkills() {
  const tbody = document.getElementById('skills-tbody');
  tbody.innerHTML = '';

  ALL_SKILLS.forEach(skill => {
    const data   = state.skills[skill] || {};
    const status = data.status || 'unsolved';
    const icon   = SKILL_ICONS[skill] || '';

    const tr = document.createElement('tr');
    tr.className = status !== 'unsolved' ? `skill-${status}` : '';
    tr.dataset.skill = skill;

    const xp16 = formatXp(parseXp(data.xphr) !== null ? parseXp(data.xphr) * 16 : null);
    const hasDetail = !!(data.detail || '').trim();
    tr.innerHTML = `
      <td class="col-skill">
        <button class="skill-name-btn${hasDetail ? ' skill-has-detail' : ''}" title="Open training plan">
          <span class="skill-icon">${icon}</span>${esc(skill)}
        </button>
      </td>
      <td class="col-status">
        <button class="status-btn status-${status}">${STATUS_LABELS[status]}</button>
      </td>
      <td class="col-method">
        <input class="cell-input" type="text" data-field="method" placeholder="Method…" value="${esc(data.method || '')}">
      </td>
      <td class="col-xp">
        <input class="cell-input xp-input" type="text" data-field="xphr" placeholder="XP/hr" value="${esc(data.xphr || '')}">
      </td>
      <td class="col-xp16">
        <span class="xp16-val">${xp16}</span>
      </td>
      <td class="col-note">
        <input class="cell-input" type="text" data-field="note" placeholder="Notes…" value="${esc(data.note || '')}">
      </td>
    `;

    tbody.appendChild(tr);

    // Skill name → open detail popup
    tr.querySelector('.skill-name-btn').addEventListener('click', () => openSkillDetail(skill));

    // Status cycle
    tr.querySelector('.status-btn').addEventListener('click', e => {
      if (!state.skills[skill]) state.skills[skill] = {};
      const cur  = state.skills[skill].status || 'unsolved';
      const next = STATUSES[(STATUSES.indexOf(cur) + 1) % STATUSES.length];
      state.skills[skill].status = next;
      e.target.className = `status-btn status-${next}`;
      e.target.textContent = STATUS_LABELS[next];
      tr.className = next !== 'unsolved' ? `skill-${next}` : '';
      scheduleSave();
    });

    // Text inputs
    tr.querySelectorAll('.cell-input').forEach(input => {
      input.addEventListener('input', () => {
        if (!state.skills[skill]) state.skills[skill] = {};
        state.skills[skill][input.dataset.field] = input.value;
        if (input.dataset.field === 'xphr') {
          const parsed = parseXp(input.value);
          tr.querySelector('.xp16-val').textContent = formatXp(parsed !== null ? parsed * 16 : null);
        }
        scheduleSave();
      });
    });
  });
}

// ─── SKILL DETAIL POPUP ───────────────────────
let _skillPopupSkill = null;

function openSkillDetail(skill) {
  _skillPopupSkill = skill;
  const data   = state.skills[skill] || {};
  const icon   = SKILL_ICONS[skill] || '';
  const status = data.status || 'unsolved';

  document.getElementById('skill-popup-title').textContent = `${icon} ${skill} — Training Plan`;

  const statusBtn = document.getElementById('skill-popup-status');
  statusBtn.textContent = STATUS_LABELS[status];
  statusBtn.className   = `status-btn status-${status}`;

  document.getElementById('skill-popup-method').value = data.method || '';
  document.getElementById('skill-popup-xphr').value   = data.xphr   || '';
  document.getElementById('skill-popup-note').value   = data.note   || '';

  const xp = parseXp(data.xphr);
  document.getElementById('skill-popup-xp16').textContent = formatXp(xp !== null ? xp * 16 : null);

  document.getElementById('skill-popup-textarea').value = data.detail || '';
  document.getElementById('skill-popup').removeAttribute('hidden');
  document.getElementById('skill-popup-textarea').focus();
}

function closeSkillDetail() {
  document.getElementById('skill-popup').setAttribute('hidden', '');
  _skillPopupSkill = null;
}

// ─── PACT TASKS ───────────────────────────────
const PACT_TASKS = [
  // Global (always shown)
  { region: 'global', task: 'Complete the Leagues Tutorial',    pts: 10 },
  { region: 'global', task: 'Open the Leagues Menu',            pts: 10 },
  { region: 'global', task: 'Defeat a Hill Giant',              pts: 10 },
  { region: 'global', task: 'Reach Combat Level 50',            pts: 30 },
  { region: 'global', task: 'Use the Protect from Melee Prayer',pts: 30 },
  { region: 'global', task: 'Kill 1 unique Echo Boss',          pts: 80,  extra: '+ Pact Reset' },
  { region: 'global', task: 'Kill 2 unique Echo Bosses',        pts: 80,  extra: '+ Pact Reset' },
  { region: 'global', task: 'Kill 3 unique Echo Bosses',        pts: 80,  extra: '+ Pact Reset' },
  { region: 'global', task: 'Kill 4 unique Echo Bosses',        pts: 200 },
  // Varlamore (always shown)
  { region: 'varlamore', task: '1 Hueycoatl Kill',                           pts: 80 },
  { region: 'varlamore', task: 'Complete Wave 12 of Fortis Colosseum',        pts: 200 },
  { region: 'varlamore', task: 'Defeat Awakened Vardorvis',                   pts: 200 },
  { region: 'varlamore', task: 'Equip Avernic Treads',                        pts: 200 },
  // Karamja (always shown)
  { region: 'karamja', task: 'Defeat a Steel Dragon on Karamja',              pts: 30 },
  { region: 'karamja', task: 'Defeat a TzHaar',                               pts: 30 },
  { region: 'karamja', task: "Complete Tzhaar-Ket-Rek's third challenge",     pts: 80 },
  { region: 'karamja', task: 'Equip a Fire Cape',                             pts: 200 },
  { region: 'karamja', task: "Complete Tzhaar-Ket-Rek's Special challenge",   pts: 400 },
  { region: 'karamja', task: 'Equip an Infernal Cape',                        pts: 400 },
  // Asgarnia
  { region: 'asgarnia', task: 'Defeat a Troll in Asgarnia',    pts: 10 },
  { region: 'asgarnia', task: 'Defeat the Royal Titans solo',  pts: 80 },
  { region: 'asgarnia', task: 'Equip a Dragon Defender',        pts: 80 },
  { region: 'asgarnia', task: 'Defeat Awakened Whisperer',      pts: 200 },
  { region: 'asgarnia', task: 'Equip a Godsword',               pts: 200 },
  { region: 'asgarnia', task: 'Equip the Bellator Ring',         pts: 200 },
  { region: 'asgarnia', task: 'Defeat Nex Solo',                pts: 400 },
  // Desert
  { region: 'desert', task: 'Set a mummy ablaze',                                      pts: 10 },
  { region: 'desert', task: 'Cast Ice Barrage',                                         pts: 200 },
  { region: 'desert', task: 'Defeat Awakened Leviathan',                                pts: 200 },
  { region: 'desert', task: 'Equip a Dragon Chainbody in the Kharidian Desert',         pts: 200 },
  { region: 'desert', task: 'Equip a Piece of Masori Armour',                           pts: 200 },
  { region: 'desert', task: 'Equip the Venator Ring',                                   pts: 200 },
  { region: 'desert', task: "Equip Osmumten's Fang (or)",                               pts: 400 },
  // Fremennik
  { region: 'fremennik', task: 'Defeat a Cockatrice in the Fremennik Province',         pts: 10 },
  { region: 'fremennik', task: 'Kill 8 penguins within 5 seconds',                      pts: 30 },
  { region: 'fremennik', task: 'Defeat Phantom Muspah',                                 pts: 80 },
  { region: 'fremennik', task: 'Defeat Basilisk Knight',                                pts: 80 },
  { region: 'fremennik', task: 'Defeat Awakened Duke Sucellus',                         pts: 200 },
  { region: 'fremennik', task: 'Defeat Vorkath 5 Times Without Special Damage',         pts: 200 },
  { region: 'fremennik', task: 'Equip the Magus Ring',                                  pts: 200 },
  // Kandarin
  { region: 'kandarin', task: 'Defeat a Demonic Gorilla',       pts: 80 },
  { region: 'kandarin', task: 'Defeat a Mithril Dragon',        pts: 80 },
  { region: 'kandarin', task: 'Defeat the Kraken Boss 50 Times',pts: 80 },
  { region: 'kandarin', task: 'Equip a Trident of the Seas',    pts: 80 },
  { region: 'kandarin', task: 'Equip Some Zenyte Jewelry',       pts: 200 },
  { region: 'kandarin', task: 'Equip an Abyssal Tentacle',       pts: 200 },
  { region: 'kandarin', task: 'Equip an Occult Necklace',        pts: 200 },
  // Kourend
  { region: 'kourend', task: 'Open 1 Grubby Chest',              pts: 10 },
  { region: 'kourend', task: '150 Lizardmen Shaman Kills',        pts: 30 },
  { region: 'kourend', task: '1 Skotizo Kill',                    pts: 80 },
  { region: 'kourend', task: '25 Chambers of Xeric',              pts: 80 },
  { region: 'kourend', task: 'Equip a Dragon Hunter Lance',       pts: 200 },
  { region: 'kourend', task: 'Equip a piece of Radiant Oathplate',pts: 200 },
  { region: 'kourend', task: 'Equip any Ancestral Piece',         pts: 200 },
  // Morytania
  { region: 'morytania', task: 'Defeat a Werewolf in Morytania',          pts: 10 },
  { region: 'morytania', task: '1 Araxxor Kill',                           pts: 80 },
  { region: 'morytania', task: 'Assemble a Slayer Helm',                   pts: 80 },
  { region: 'morytania', task: 'Create an Amulet of Blood Fury',           pts: 80 },
  { region: 'morytania', task: 'Equip any Full Barrows Armour Set',        pts: 80 },
  { region: 'morytania', task: 'Complete the Theatre of Blood 25 Times',   pts: 200 },
  { region: 'morytania', task: "Defeat Phosani's Nightmare",               pts: 200 },
  // Tirannwn
  { region: 'tirannwn', task: 'Kill a Black Dragon in Tirannwn',                       pts: 30 },
  { region: 'tirannwn', task: 'Complete the Corrupted Gauntlet',                        pts: 80 },
  { region: 'tirannwn', task: 'Defeat Zalcano',                                         pts: 80 },
  { region: 'tirannwn', task: 'Equip a Dark Bow in Tirannwn',                          pts: 80 },
  { region: 'tirannwn', task: 'Craft a Toxic Blowpipe',                                pts: 200 },
  { region: 'tirannwn', task: 'Use a prayer altar to restore 90 prayer in Prifddinas', pts: 200 },
  { region: 'tirannwn', task: 'Equip a Corrupted Weapon',                              pts: 400 },
  // Wilderness
  { region: 'wilderness', task: 'Defeat a Chaos Dwarf in the Wilderness',        pts: 10 },
  { region: 'wilderness', task: 'Defeat the Corporeal Beast',                     pts: 80 },
  { region: 'wilderness', task: 'Equip a Dragon 2-Handed Sword in the Wilderness',pts: 80 },
  { region: 'wilderness', task: 'Equip a Malediction Ward',                       pts: 80 },
  { region: 'wilderness', task: "Equip a Piece of the Dagon'Hai Set",            pts: 200 },
  { region: 'wilderness', task: 'Equip the Voidwaker',                            pts: 200 },
  { region: 'wilderness', task: 'Imbue a God Cape',                               pts: 200 },
];

// Build region display info from REGIONS + special global entry
const PACT_REGION_INFO = { global: { name: 'Global', icon: '🌍' } };
REGIONS.forEach(r => { PACT_REGION_INFO[r.id] = { name: r.name, icon: r.icon }; });

const PACT_ALWAYS_ON = new Set(['global', 'varlamore', 'karamja']);

const PACT_DIFFICULTIES = ['', 'easy', 'medium', 'hard', 'elite', 'master'];
const PACT_DIFF_LABELS  = { '': 'Difficulty', easy: 'Easy', medium: 'Medium', hard: 'Hard', elite: 'Elite', master: 'Master' };

function updatePactDiffSummary() {
  const el = document.getElementById('pact-diff-summary');
  if (!el) return;

  const selectedRegionIds = new Set(state.regions.filter(Boolean));
  const regionOrder = ['global', 'varlamore', 'karamja',
    ...REGIONS.filter(r => !PACT_ALWAYS_ON.has(r.id)).map(r => r.id)];
  const visibleRegions = regionOrder.filter(id => PACT_ALWAYS_ON.has(id) || selectedRegionIds.has(id));

  // Count total and done tasks per difficulty (skip unrated '')
  const countByDiff = {}; // diff -> { total, done }
  PACT_DIFFICULTIES.filter(d => d !== '').forEach(d => { countByDiff[d] = { total: 0, done: 0 }; });

  visibleRegions.forEach(regionId => {
    PACT_TASKS.filter(t => t.region === regionId).forEach(t => {
      const key  = regionId + '::' + t.task;
      const diff = state.pactDifficulty[key] || '';
      if (!diff) return;
      countByDiff[diff].total++;
      if (state.pactDone[key]) countByDiff[diff].done++;
    });
  });

  const chips = PACT_DIFFICULTIES.filter(d => d !== '').map(d => {
    const c = countByDiff[d];
    if (!c.total) return '';
    return `<span class="pact-dsumm-chip pact-diff-${d}">${PACT_DIFF_LABELS[d]} <strong>${c.done}/${c.total}</strong></span>`;
  }).filter(Boolean).join('');

  el.innerHTML = chips;
}

function updatePactCounter() {
  const counter = document.getElementById('pact-counter');
  if (!counter) return;
  const selectedRegionIds = new Set(state.regions.filter(Boolean));
  const regionOrder = ['global', 'varlamore', 'karamja',
    ...REGIONS.filter(r => !PACT_ALWAYS_ON.has(r.id)).map(r => r.id)];
  const visibleRegions = regionOrder.filter(id => PACT_ALWAYS_ON.has(id) || selectedRegionIds.has(id));
  let total = 0, done = 0;
  visibleRegions.forEach(regionId => {
    (PACT_TASKS.filter(t => t.region === regionId)).forEach(t => {
      total++;
      if (state.pactDone[regionId + '::' + t.task]) done++;
    });
  });
  counter.textContent = `${done} / ${total}`;
}

function renderPactTasks() {
  const container = document.getElementById('pact-list');
  container.innerHTML = '';

  const selectedRegionIds = new Set(state.regions.filter(Boolean));

  // Determine which regions to show (always-on + selected), in source order
  const regionOrder = ['global', 'varlamore', 'karamja',
    ...REGIONS.filter(r => !PACT_ALWAYS_ON.has(r.id)).map(r => r.id)];
  const visibleRegions = regionOrder.filter(id =>
    PACT_ALWAYS_ON.has(id) || selectedRegionIds.has(id)
  );

  // Group tasks by region
  const tasksByRegion = {};
  PACT_TASKS.forEach(t => {
    if (!tasksByRegion[t.region]) tasksByRegion[t.region] = [];
    tasksByRegion[t.region].push(t);
  });

  visibleRegions.forEach(regionId => {
    const tasks    = tasksByRegion[regionId] || [];
    const info     = PACT_REGION_INFO[regionId] || { name: regionId, icon: '•' };
    const alwaysOn = PACT_ALWAYS_ON.has(regionId);
    const doneCnt  = tasks.filter(t => state.pactDone[regionId + '::' + t.task]).length;

    // Region sub-header
    const header = document.createElement('div');
    header.className = 'rp-pact-region-header' + (alwaysOn ? ' rp-pact-always' : '');
    header.innerHTML = `
      <span class="pact-region-icon">${info.icon}</span>
      <span class="pact-region-name">${esc(info.name)}</span>
      <span class="pact-region-pts">${doneCnt}/${tasks.length} done</span>
    `;
    container.appendChild(header);

    tasks.forEach(t => {
      const key   = regionId + '::' + t.task;
      const note  = state.pactNotes[key]      || '';
      const done  = !!state.pactDone[key];
      const diff  = state.pactDifficulty[key] || '';

      const row = document.createElement('div');
      row.className = 'rp-pact-row' + (done ? ' pact-complete' : '');
      row.innerHTML = `
        <button class="pact-done-btn${done ? ' done' : ''}" title="Mark complete">✓</button>
        <span class="pact-pts-badge">${t.pts}</span>
        <span class="pact-task-name">${esc(t.task)}${t.extra ? `<span class="pact-task-extra">${esc(t.extra)}</span>` : ''}</span>
        <button class="pact-diff-badge pact-diff-${diff || 'none'}">${esc(PACT_DIFF_LABELS[diff])}</button>
        <input class="rp-note pact-note" type="text" placeholder="Notes…" value="${esc(note)}">
      `;
      container.appendChild(row);

      row.querySelector('.pact-done-btn').addEventListener('click', () => {
        state.pactDone[key] = !state.pactDone[key];
        row.classList.toggle('pact-complete', !!state.pactDone[key]);
        row.querySelector('.pact-done-btn').classList.toggle('done', !!state.pactDone[key]);
        updatePactCounter();
        // Update region header done count
        const regionDone = tasks.filter(t2 => state.pactDone[regionId + '::' + t2.task]).length;
        header.querySelector('.pact-region-pts').textContent = `${regionDone}/${tasks.length} done`;
        scheduleSave();
      });

      row.querySelector('.pact-diff-badge').addEventListener('click', e => {
        const cur  = state.pactDifficulty[key] || '';
        const next = PACT_DIFFICULTIES[(PACT_DIFFICULTIES.indexOf(cur) + 1) % PACT_DIFFICULTIES.length];
        state.pactDifficulty[key] = next;
        e.target.textContent = PACT_DIFF_LABELS[next];
        e.target.className   = `pact-diff-badge pact-diff-${next || 'none'}`;
        updatePactDiffSummary();
        scheduleSave();
      });

      row.querySelector('input').addEventListener('input', e => {
        state.pactNotes[key] = e.target.value;
        scheduleSave();
      });
    });
  });

  if (!container.children.length) {
    container.innerHTML = '<p style="padding:0.6rem 0.75rem; color:var(--text-muted); font-size:0.8rem;">Select regions above to see their pact tasks.</p>';
  }

  updatePactCounter();
  updatePactDiffSummary();
}

// ─── ECHO BOSSES ──────────────────────────────
function parseDropName(str) {
  const idx = str.indexOf(' — ');
  return idx !== -1 ? str.slice(0, idx) : str;
}

const ALWAYS_ON_REGIONS = new Set(['varlamore', 'karamja']);

function renderEcho() {
  const container = document.getElementById('echo-list');
  container.innerHTML = '';

  const selectedRegionIds = new Set(state.regions.filter(Boolean));

  const bossesToShow = [];
  REGIONS.forEach(r => {
    if (ALWAYS_ON_REGIONS.has(r.id) || selectedRegionIds.has(r.id)) {
      (r.echoBosses || []).forEach(b => {
        bossesToShow.push({ ...b, regionName: r.name, regionIcon: r.icon });
      });
    }
  });

  if (!bossesToShow.length) {
    container.innerHTML = '<p style="padding:0.6rem 0.75rem; color:var(--text-muted); font-size:0.8rem;">Select regions above to see their echo bosses.</p>';
    return;
  }

  bossesToShow.forEach(boss => {
    const note      = state.echoNotes[boss.name] || '';
    const dropNames = (boss.drops || []).map(parseDropName).join(' · ');

    const row = document.createElement('div');
    row.className = 'rp-echo-row';
    row.innerHTML = `
      <div class="echo-clickable" title="View boss details">
        <span class="echo-icon">${boss.icon || '👾'}</span>
        <div class="echo-info">
          <div class="echo-name">
            ${esc(boss.name)}
            <span class="echo-badge">${boss.regionIcon} ${esc(boss.regionName)}${boss.difficulty ? ' · ' + esc(boss.difficulty) : ''}</span>
          </div>
          ${dropNames ? `<div class="echo-drops">${esc(dropNames)}</div>` : ''}
        </div>
      </div>
      <input class="rp-note" type="text" placeholder="Notes…" value="${esc(note)}">
    `;

    container.appendChild(row);

    row.querySelector('.echo-clickable').addEventListener('click', () => openEchoPopup(boss));
    row.querySelector('input').addEventListener('input', e => {
      state.echoNotes[boss.name] = e.target.value;
      scheduleSave();
    });
  });
}

// ─── ECHO POPUP ───────────────────────────────
function openEchoPopup(boss) {
  document.getElementById('echo-popup-title').textContent = `${boss.icon || '👾'} ${boss.name}`;

  const body       = document.getElementById('echo-popup-body');
  const badgeHtml  = `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.6rem">${boss.regionIcon} ${esc(boss.regionName)}${boss.difficulty ? ' · ' + esc(boss.difficulty) : ''}</div>`;

  const dropsHtml = (boss.drops || []).map(d => {
    const dashIdx = d.indexOf(' — ');
    const header  = dashIdx !== -1 ? d.slice(0, dashIdx) : d;
    const detail  = dashIdx !== -1 ? d.slice(dashIdx + 3) : '';
    return `<li class="echo-popup-drop"><strong>${esc(header)}</strong>${detail ? `<span>${esc(detail)}</span>` : ''}</li>`;
  }).join('');

  const wikiLink = boss.wikiUrl
    ? `<div style="margin-top:0.75rem"><a href="${esc(boss.wikiUrl)}" target="_blank" rel="noopener" style="color:var(--text-gold);font-size:0.78rem">→ View on Wiki</a></div>`
    : '';

  body.innerHTML = badgeHtml
    + (dropsHtml ? `<ul class="popup-effects" style="list-style:none;padding-left:0">${dropsHtml}</ul>` : '<p style="color:var(--text-muted)">No unique drops listed.</p>')
    + wikiLink;

  document.getElementById('echo-popup').removeAttribute('hidden');
}

function closeEchoPopup() {
  document.getElementById('echo-popup').setAttribute('hidden', '');
}

// ─── POPUP ────────────────────────────────────
function closePopup() {
  document.getElementById('relic-popup').setAttribute('hidden', '');
}

// ─── INIT ─────────────────────────────────────
function init() {
  loadState();
  renderRelics();
  renderRegions();
  renderSkills();
  renderEcho();
  renderPactTasks();

  // Relic popup
  document.getElementById('popup-close').addEventListener('click', closePopup);
  document.getElementById('relic-popup').addEventListener('click', e => {
    if (e.target === document.getElementById('relic-popup')) closePopup();
  });

  // Skill detail popup — close
  document.getElementById('skill-popup-close').addEventListener('click', closeSkillDetail);
  document.getElementById('skill-popup').addEventListener('click', e => {
    if (e.target === document.getElementById('skill-popup')) closeSkillDetail();
  });

  // Skill popup — status cycle
  document.getElementById('skill-popup-status').addEventListener('click', e => {
    if (!_skillPopupSkill) return;
    if (!state.skills[_skillPopupSkill]) state.skills[_skillPopupSkill] = {};
    const cur  = state.skills[_skillPopupSkill].status || 'unsolved';
    const next = STATUSES[(STATUSES.indexOf(cur) + 1) % STATUSES.length];
    state.skills[_skillPopupSkill].status = next;
    e.target.className   = `status-btn status-${next}`;
    e.target.textContent = STATUS_LABELS[next];
    const tr = document.querySelector(`[data-skill="${_skillPopupSkill}"]`);
    if (tr) {
      const btn = tr.querySelector('.status-btn');
      if (btn) { btn.className = `status-btn status-${next}`; btn.textContent = STATUS_LABELS[next]; }
      tr.className = next !== 'unsolved' ? `skill-${next}` : '';
    }
    scheduleSave();
  });

  // Skill popup — method / xphr / note fields
  ['method', 'xphr', 'note'].forEach(field => {
    const el = document.getElementById(`skill-popup-${field}`);
    el.addEventListener('input', () => {
      if (!_skillPopupSkill) return;
      if (!state.skills[_skillPopupSkill]) state.skills[_skillPopupSkill] = {};
      state.skills[_skillPopupSkill][field] = el.value;
      if (field === 'xphr') {
        const xp = parseXp(el.value);
        document.getElementById('skill-popup-xp16').textContent = formatXp(xp !== null ? xp * 16 : null);
      }
      // Sync back to table row live
      const tr = document.querySelector(`[data-skill="${_skillPopupSkill}"]`);
      if (tr) {
        const input = tr.querySelector(`[data-field="${field}"]`);
        if (input) input.value = el.value;
        if (field === 'xphr') {
          const xp16el = tr.querySelector('.xp16-val');
          const xp = parseXp(el.value);
          if (xp16el) xp16el.textContent = formatXp(xp !== null ? xp * 16 : null);
        }
      }
      scheduleSave();
    });
  });

  // Skill popup — detail textarea
  document.getElementById('skill-popup-textarea').addEventListener('input', e => {
    if (!_skillPopupSkill) return;
    if (!state.skills[_skillPopupSkill]) state.skills[_skillPopupSkill] = {};
    state.skills[_skillPopupSkill].detail = e.target.value;
    const btn = document.querySelector(`[data-skill="${_skillPopupSkill}"] .skill-name-btn`);
    if (btn) btn.classList.toggle('skill-has-detail', !!e.target.value.trim());
    scheduleSave();
  });

  // Echo popup
  document.getElementById('echo-popup-close').addEventListener('click', closeEchoPopup);
  document.getElementById('echo-popup').addEventListener('click', e => {
    if (e.target === document.getElementById('echo-popup')) closeEchoPopup();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closePopup(); closeSkillDetail(); closeEchoPopup(); }
  });
}

document.addEventListener('DOMContentLoaded', init);
