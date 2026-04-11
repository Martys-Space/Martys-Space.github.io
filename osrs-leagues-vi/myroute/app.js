// =============================================
// Route Planner — League VI
// =============================================
const LS_KEY = 'osrsl6_route_v1';

const state = {
  relics:      {},   // tier (number) -> relicId
  relicNotes:  {},   // tier (number) -> note string
  regions:     ['', '', ''],   // 3 selected region ids
  regionNotes: ['', '', ''],   // 3 note strings
  skills:      {},   // skillName -> { status, method, xphr, note }
  echoNotes:   {},   // bossName -> note string
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

    const options = REGIONS.map(r => {
      const tag = r.type === 'starter' ? ' (starter)' : r.type === 'free' ? ' (free)' : '';
      return `<option value="${esc(r.id)}" ${r.id === selectedId ? 'selected' : ''}>${r.icon} ${esc(r.name)}${tag}</option>`;
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

// ─── ECHO BOSSES ──────────────────────────────
function parseDropName(str) {
  const idx = str.indexOf(' — ');
  return idx !== -1 ? str.slice(0, idx) : str;
}

function renderEcho() {
  const container = document.getElementById('echo-list');
  container.innerHTML = '';

  const selectedRegionIds = new Set(state.regions.filter(Boolean));

  if (selectedRegionIds.size === 0) {
    container.innerHTML = '<p style="padding:0.6rem 0.75rem; color:var(--text-muted); font-size:0.8rem;">Select regions above to see their echo bosses.</p>';
    return;
  }

  const bossesToShow = [];
  REGIONS.forEach(r => {
    if (selectedRegionIds.has(r.id)) {
      (r.echoBosses || []).forEach(b => {
        bossesToShow.push({ ...b, regionName: r.name, regionIcon: r.icon });
      });
    }
  });

  if (!bossesToShow.length) {
    container.innerHTML = '<p style="padding:0.6rem 0.75rem; color:var(--text-muted); font-size:0.8rem;">No echo bosses for the selected regions.</p>';
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
