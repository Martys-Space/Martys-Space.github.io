// =============================================
// OSRS Leagues VI — Early Game Planner
// =============================================

const EG = (() => {
  'use strict';

  // ─── Constants ────────────────────────────
  const LS_KEY          = 'osrsl6_v1';
  const EG_SUBKEY       = 'earlyGame';
  const MYROUTE_VERSION = '20260411a'; // bump this whenever myroute.json is updated
  const REGIONS   = ['General','Asgarnia','Desert','Fremennik','Kandarin',
                     'Karamja','Kourend','Morytania','Tirannwn','Varlamore','Wilderness'];

  // ─── State ────────────────────────────────
  let tasks    = [];
  let phases   = []; // { id, name, collapsed }
  let settings = {
    completedDisplay: 'gray',
    filters: { region: '', status: '', type: '' },
    colors: {
      pinLeague:          '#2980b9',
      pinHelper:          '#8e44ad',
      pinNext:            '#e8c35a',
      pinComplete:        '#666666',
      pinCompleteOpacity: 50,
      pinSkipped:         '#e67e22',
      line:               '#fec416',
      lineOpacity:        100,
      lineDone:           '#c8a84b',
      lineDoneOpacity:    35,
    },
  };

  let mapState = {
    x: 0, y: 0, scale: 1,
    dragging: false, dragStartX: 0, dragStartY: 0,
    imgW: 0, imgH: 0,
    placementMode: false,
    initialized: false,
  };

  let panelState = {
    open: false,
    editingId: null,
    waitingForPin: false,
    formData: defaultFormData(),
    searchQuery: '',
  };

  let dragItem  = { fromIdx: -1, overIdx: -1, el: null };
  let phaseDrag = { fromId: null };
  let tabActivated = false;

  // ─── Overlay render caches (screen-space, updated via rAF) ──
  let _pinPositions = []; // [{ el, px, py }]             — rebuilt by renderMapPins
  let _lineSegs     = []; // [{ px1,py1, px2,py2, isDone }] — rebuilt by renderMapPins
  let _donePathEl   = null; // single <path> for completed segments
  let _activePathEl = null; // single <path> for active segments
  let _rafPending   = false;

  // ─── Modal state ──────────────────────────
  let phaseModalCallback = null;
  let confirmOkCallback  = null;
  let confirmAltCallback = null;

  // ─── Helpers ──────────────────────────────
  function defaultFormData() {
    return {
      srcType: 'league', isLeagueTask: true, taskRef: null,
      title: '', description: '', area: '', pin: null,
      pts: null, phaseId: null,
    };
  }

  function uid() {
    return 'eg_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
  }

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Returns display-ordered task array (phase order → ungrouped)
  function displayOrderedTasks() {
    if (phases.length === 0) return tasks.slice();
    const phaseIdSet = new Set(phases.map(p => p.id));
    const ordered = [];
    for (const phase of phases) {
      ordered.push(...tasks.filter(t => t.phaseId === phase.id));
    }
    ordered.push(...tasks.filter(t => !t.phaseId || !phaseIdSet.has(t.phaseId)));
    return ordered;
  }

  // First incomplete task in display order → index into tasks[] (used for next-pin highlighting)
  function nextIncompleteIdx() {
    const next = displayOrderedTasks().find(t => t.status === 'incomplete');
    return next ? tasks.indexOf(next) : -1;
  }

  function getImportedTasks() {
    if (typeof state !== 'undefined' && Array.isArray(state.tasks)) return state.tasks;
    return [];
  }

  function hasImportedTasks() {
    return getImportedTasks().length > 0;
  }

  function searchImported(query) {
    const all = getImportedTasks();
    // Build set of taskRefs already used in the route, excluding the task being edited
    const usedRefs = new Set(
      tasks
        .filter(t => t.taskRef && t.id !== panelState.editingId)
        .map(t => t.taskRef)
    );
    const available = all.filter(t => !usedRefs.has(t.id));
    if (!query || !query.trim()) return available.slice(0, 40);
    const q = query.toLowerCase().trim();
    return available.filter(t =>
      (t.name  && t.name.toLowerCase().includes(q))  ||
      (t.task  && t.task.toLowerCase().includes(q))  ||
      (t.area  && t.area.toLowerCase().includes(q))
    ).slice(0, 80);
  }

  function visibleNonSkipped() {
    return displayOrderedTasks().filter(t => t.status !== 'skipped' && t.pin);
  }

  // ─── Pts / difficulty helpers ──────────────
  function ptsBadgeClass(pts) {
    if (pts >= 400) return 'eg-badge-master';
    if (pts >= 200) return 'eg-badge-elite';
    if (pts >= 80)  return 'eg-badge-hard';
    if (pts >= 30)  return 'eg-badge-medium';
    return 'eg-badge-easy';
  }

  function ptsBadgeLabel(pts) {
    if (pts >= 400) return 'Master';
    if (pts >= 200) return 'Elite';
    if (pts >= 80)  return 'Hard';
    if (pts >= 30)  return 'Medium';
    return 'Easy';
  }

  // ─── Storage ──────────────────────────────
  let _firstVisit = false;

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) { _firstVisit = true; return; }
      const parsed = JSON.parse(raw);
      if (!parsed.seenEgInfo) _firstVisit = true;
      const eg = parsed[EG_SUBKEY] || {};
      tasks  = Array.isArray(eg.tasks)  ? eg.tasks  : [];
      phases = Array.isArray(eg.phases) ? eg.phases : [];
      if (eg.settings) {
        settings.completedDisplay = eg.settings.completedDisplay || 'gray';
        if (eg.settings.filters) settings.filters = { ...settings.filters, ...eg.settings.filters };
        if (eg.settings.colors)  settings.colors  = { ...settings.colors,  ...eg.settings.colors  };
      }
    } catch (e) { tasks = []; phases = []; _firstVisit = true; }
  }

  function markInfoSeen() {
    if (!_firstVisit) return;
    _firstVisit = false;
    document.getElementById('eg-info-btn').classList.remove('eg-icon-btn-pulse');
    try {
      const raw    = localStorage.getItem(LS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.seenEgInfo = true;
      localStorage.setItem(LS_KEY, JSON.stringify(parsed));
    } catch (e) {}
  }

  function save() {
    try {
      const raw    = localStorage.getItem(LS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed[EG_SUBKEY] = { tasks, phases, settings };
      localStorage.setItem(LS_KEY, JSON.stringify(parsed));
    } catch (e) {}
  }

  // ─── Filters ──────────────────────────────
  function filteredTasks() {
    const f = settings.filters;
    return tasks.filter(t => {
      if (f.status  && t.status !== f.status) return false;
      if (f.type === 'league' && !t.isLeagueTask) return false;
      if (f.type === 'helper' &&  t.isLeagueTask) return false;
      if (f.region  && t.area !== f.region) return false;
      return true;
    });
  }

  // ─── Map ──────────────────────────────────
  function initMap() {
    const container = document.getElementById('eg-map-container');
    const img       = document.getElementById('eg-map-img');
    const loader    = document.getElementById('eg-map-loader');

    function onImgLoaded() {
      mapState.imgW = img.naturalWidth;
      mapState.imgH = img.naturalHeight;
      fitMap();
      renderMapPins();
      // Wait for fitMap's transform to be painted before revealing
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (loader) loader.hidden = true;
      }));
    }

    if (img.complete && img.naturalWidth > 0) {
      onImgLoaded();
    } else {
      img.addEventListener('load', onImgLoaded);
      img.addEventListener('error', () => {
        if (loader) { loader.querySelector('.eg-map-loader-text').textContent = 'Failed to load map'; }
      });
    }

    container.addEventListener('mousedown', onMapMouseDown);
    window.addEventListener('mousemove', onMapMouseMove);
    window.addEventListener('mouseup',   onMapMouseUp);
    container.addEventListener('wheel', onMapWheel, { passive: false });
    container.addEventListener('contextmenu', onMapContextMenu);

    document.getElementById('eg-zoom-in') .addEventListener('click', () => zoomAt(1.25, null, null));
    document.getElementById('eg-zoom-out').addEventListener('click', () => zoomAt(0.8,  null, null));
    document.getElementById('eg-zoom-fit').addEventListener('click', fitMap);
  }

  function applyMapTransform() {
    const vp = document.getElementById('eg-map-viewport');
    if (!vp) return;
    vp.style.transform = `translate(${mapState.x}px, ${mapState.y}px) scale(${mapState.scale})`;
    // Throttle overlay repositioning to one DOM write-pass per animation frame
    if (!_rafPending) {
      _rafPending = true;
      requestAnimationFrame(() => { _rafPending = false; updatePinPositions(); });
    }
  }

  function fitMap() {
    const container = document.getElementById('eg-map-container');
    if (!container || !mapState.imgW) return;
    const cw = container.clientWidth, ch = container.clientHeight;
    const s  = Math.min(cw / mapState.imgW, ch / mapState.imgH, 1);
    mapState.scale = s;
    mapState.x = (cw - mapState.imgW * s) / 2;
    mapState.y = (ch - mapState.imgH * s) / 2;
    applyMapTransform();
  }

  function zoomAt(factor, screenX, screenY) {
    const container = document.getElementById('eg-map-container');
    const minS = 0.04, maxS = 5;
    const newScale = Math.max(minS, Math.min(maxS, mapState.scale * factor));
    if (screenX === null) { screenX = container.clientWidth / 2; screenY = container.clientHeight / 2; }
    const ratio = newScale / mapState.scale;
    mapState.x = screenX - ratio * (screenX - mapState.x);
    mapState.y = screenY - ratio * (screenY - mapState.y);
    mapState.scale = newScale;
    applyMapTransform();
  }

  function screenToImg(screenX, screenY) {
    const container = document.getElementById('eg-map-container');
    const rect = container.getBoundingClientRect();
    return {
      px: Math.max(0, Math.min(100, ((screenX - rect.left  - mapState.x) / mapState.scale / mapState.imgW) * 100)),
      py: Math.max(0, Math.min(100, ((screenY - rect.top   - mapState.y) / mapState.scale / mapState.imgH) * 100)),
    };
  }

  function imgToScreen(px, py) {
    return {
      x: (px / 100 * mapState.imgW) * mapState.scale + mapState.x,
      y: (py / 100 * mapState.imgH) * mapState.scale + mapState.y,
    };
  }

  function onMapMouseDown(e) {
    if (e.button !== 0 || mapState.placementMode) return;
    mapState.dragging  = true;
    mapState.dragStartX = e.clientX - mapState.x;
    mapState.dragStartY = e.clientY - mapState.y;
    e.preventDefault();
  }
  function onMapMouseMove(e) {
    if (!mapState.dragging) return;
    mapState.x = e.clientX - mapState.dragStartX;
    mapState.y = e.clientY - mapState.dragStartY;
    applyMapTransform();
  }
  function onMapMouseUp() { mapState.dragging = false; }

  function onMapWheel(e) {
    e.preventDefault();
    const container = document.getElementById('eg-map-container');
    const rect   = container.getBoundingClientRect();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top);
  }

  function onMapContextMenu(e) {
    e.preventDefault();
    if (!mapState.imgW || mapState.placementMode) return;
    openPanel(null, screenToImg(e.clientX, e.clientY));
  }

  function startPlacementMode() {
    mapState.placementMode   = true;
    panelState.waitingForPin = true;
    document.getElementById('eg-map-area').classList.add('eg-placement-active');
    document.getElementById('eg-placement-banner').removeAttribute('hidden');
    if (panelState.open) document.getElementById('eg-panel').classList.add('eg-panel-placing');
    document.getElementById('eg-map-container').addEventListener('click', onPlacementClick);
  }

  function endPlacementMode() {
    mapState.placementMode   = false;
    panelState.waitingForPin = false;
    document.getElementById('eg-map-area').classList.remove('eg-placement-active');
    document.getElementById('eg-placement-banner').setAttribute('hidden', '');
    document.getElementById('eg-panel').classList.remove('eg-panel-placing');
    document.getElementById('eg-map-container').removeEventListener('click', onPlacementClick);
  }

  function onPlacementClick(e) {
    if (!mapState.placementMode || !mapState.imgW) return;
    e.stopPropagation();
    panelState.formData.pin = screenToImg(e.clientX, e.clientY);
    endPlacementMode();
    showPanel();
    renderPanelBody();
  }

  // ─── Map rendering ─────────────────────────
  function renderMapPins() {
    if (!mapState.imgW) return;
    const linesSvg    = document.getElementById('eg-map-lines-svg');
    const pinsOverlay = document.getElementById('eg-map-pins-overlay');
    if (!linesSvg || !pinsOverlay) return;

    linesSvg.innerHTML = ''; pinsOverlay.innerHTML = '';

    const nextIdx = nextIncompleteIdx();
    const chain   = visibleNonSkipped();

    // Two shared path elements — one attribute write per frame covers all segments
    function makePathEl(color, opacity) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('stroke', color);
      p.setAttribute('stroke-width', '2.5');
      p.setAttribute('stroke-dasharray', '12 7');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-opacity', opacity);
      p.setAttribute('fill', 'none');
      return p;
    }
    _donePathEl   = makePathEl(settings.colors.lineDone, settings.colors.lineDoneOpacity / 100);
    _activePathEl = makePathEl(settings.colors.line,     settings.colors.lineOpacity / 100);
    linesSvg.appendChild(_donePathEl);
    linesSvg.appendChild(_activePathEl);

    const lineSegs = [];
    for (let i = 0; i < chain.length - 1; i++) {
      const t1 = chain[i], t2 = chain[i + 1];
      if (settings.completedDisplay === 'hidden' && t2.status === 'complete') continue;
      lineSegs.push({ px1: t1.pin.px, py1: t1.pin.py, px2: t2.pin.px, py2: t2.pin.py,
                      isDone: t1.status === 'complete' });
    }
    _lineSegs = lineSegs;

    const displayNums = buildDisplayNums();
    const pinPositions = [];
    tasks.forEach((task, idx) => {
      if (!task.pin) return;
      const isSkipped  = task.status === 'skipped';
      const isComplete = task.status === 'complete';
      if (!isSkipped && settings.completedDisplay === 'hidden' && isComplete) {
        const chainIdx = chain.indexOf(task);
        const next = chainIdx >= 0 ? chain[chainIdx + 1] : undefined;
        if (!next || next.status === 'complete') return;
      }
      const isNext   = idx === nextIdx;
      const pinNum   = displayNums.get(task.id) ?? idx + 1;
      const fill     = isSkipped  ? settings.colors.pinSkipped  :
                       isComplete ? settings.colors.pinComplete :
                       isNext     ? settings.colors.pinNext     :
                       task.isLeagueTask ? settings.colors.pinLeague : settings.colors.pinHelper;
      const textFill = isNext ? '#1a1408' : '#fff';
      const opacity  = isComplete ? settings.colors.pinCompleteOpacity / 100 : 1;
      const dotColor = task.isLeagueTask ? '#5dade2' : '#bb8fce';
      const dotSvg   = (!isComplete && !isSkipped)
        ? `<circle cx="9" cy="-9" r="4" fill="${dotColor}" stroke="rgba(0,0,0,0.5)" stroke-width="0.8"/>` : '';

      const pinDiv = document.createElement('div');
      pinDiv.className = 'eg-map-pin' +
        (isNext     ? ' eg-pin-next'     : '') +
        (isComplete ? ' eg-pin-complete' : '') +
        (isSkipped  ? ' eg-pin-skipped'  : '');
      pinDiv.style.opacity = opacity;
      pinDiv.innerHTML = `
        <svg width="32" height="32" viewBox="-14 -14 28 28"
             style="display:block;overflow:visible" xmlns="http://www.w3.org/2000/svg">
          <circle r="13" fill="rgba(0,0,0,0.4)"/>
          <circle r="11" fill="${fill}" stroke="rgba(0,0,0,0.7)" stroke-width="1.5"/>
          ${dotSvg}
          <text x="0" y="0" text-anchor="middle" dominant-baseline="middle"
                font-size="9" font-weight="bold" fill="${textFill}"
                font-family="Arial,sans-serif" pointer-events="none">${pinNum}</text>
        </svg>`;
      pinDiv.addEventListener('click', e => { e.stopPropagation(); showPinTooltip(task, e.clientX, e.clientY); });
      pinsOverlay.appendChild(pinDiv);
      pinPositions.push({ el: pinDiv, px: task.pin.px, py: task.pin.py });
    });

    _pinPositions = pinPositions;
    updatePinPositions();
    renderPreviewPin();
  }

  function updatePinPositions() {
    // Lines: build two path strings, then write 2 attributes total (vs N×4 before)
    if (_donePathEl || _activePathEl) {
      let donePath = '', activePath = '';
      _lineSegs.forEach(({ px1, py1, px2, py2, isDone }) => {
        const s1 = imgToScreen(px1, py1);
        const s2 = imgToScreen(px2, py2);
        const seg = `M${s1.x},${s1.y}L${s2.x},${s2.y}`;
        if (isDone) donePath   += seg;
        else        activePath += seg;
      });
      if (_donePathEl)   _donePathEl.setAttribute('d',   donePath   || 'M0,0');
      if (_activePathEl) _activePathEl.setAttribute('d', activePath || 'M0,0');
    }
    // Pins: style.transform bypasses layout (compositor path), left/top would trigger it
    _pinPositions.forEach(({ el, px, py }) => {
      const sc = imgToScreen(px, py);
      el.style.transform = `translate(${sc.x - 16}px,${sc.y - 16}px)`;
    });
    // Preview pin
    const preview = document.getElementById('eg-preview-pin');
    if (preview && preview.dataset.px) {
      const sc = imgToScreen(parseFloat(preview.dataset.px), parseFloat(preview.dataset.py));
      preview.style.transform = `translate(${sc.x - 16}px,${sc.y - 16}px)`;
    }
  }

  function showPinTooltip(task, clientX, clientY) {
    removeTooltip();
    const container = document.getElementById('eg-map-container');
    const sc = imgToScreen(task.pin.px, task.pin.py);
    const tt = document.createElement('div');
    tt.id = 'eg-tooltip'; tt.className = 'eg-pin-tooltip';
    tt.style.left = sc.x + 'px'; tt.style.top = sc.y + 'px';
    const typeLine = task.isLeagueTask
      ? '<span style="color:#5dade2">⚔️ League</span>'
      : '<span style="color:#bb8fce">🛒 Helper</span>';
    const cIcon  = task.status === 'complete' ? '↩' : '✓';
    const cLabel = task.status === 'complete' ? 'Undo' : 'Complete';
    const sIcon  = task.status === 'skipped'  ? '↩' : '⟳';
    const sLabel = task.status === 'skipped'  ? 'Unskip' : 'Skip';
    const displayNum = buildDisplayNums().get(task.id) ?? tasks.indexOf(task) + 1;
    tt.innerHTML = `
      <div style="font-weight:700;color:var(--text-gold);margin-bottom:3px">#${displayNum} ${esc(task.title)}</div>
      ${task.description ? `<div style="color:var(--text-secondary);font-size:0.77rem">${esc(task.description)}</div>` : ''}
      ${task.area ? `<div style="color:var(--text-muted);font-size:0.72rem;margin-top:2px">${esc(task.area)}</div>` : ''}
      <div style="margin-top:3px;font-size:0.72rem">${typeLine}</div>
      <div style="margin-top:6px;display:flex;gap:4px;">
        <button class="eg-task-btn btn-complete eg-tooltip-btn" data-tt-action="complete" data-tid="${task.id}">${cIcon} ${cLabel}</button>
        <button class="eg-task-btn btn-skip    eg-tooltip-btn" data-tt-action="skip"     data-tid="${task.id}">${sIcon} ${sLabel}</button>
      </div>`;
    container.appendChild(tt);
    tt.querySelectorAll('[data-tt-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (btn.dataset.ttAction === 'complete') toggleComplete(btn.dataset.tid);
        else toggleSkip(btn.dataset.tid);
        removeTooltip();
      });
    });
    const handleOutside = e => {
      const cur = document.getElementById('eg-tooltip');
      if (!cur || !cur.contains(e.target)) { removeTooltip(); document.removeEventListener('click', handleOutside); }
    };
    setTimeout(() => document.addEventListener('click', handleOutside), 0);
  }

  function removeTooltip() {
    const el = document.getElementById('eg-tooltip');
    if (el) el.remove();
  }

  // ─── Progress ─────────────────────────────
  function renderProgress() {
    const leagueTasks = tasks.filter(t => t.isLeagueTask);
    const helperTasks = tasks.filter(t => !t.isLeagueTask);
    const lDone  = leagueTasks.filter(t => t.status === 'complete').length;
    const hDone  = helperTasks.filter(t => t.status === 'complete').length;
    const total  = tasks.length;
    const lPct   = total > 0 ? (lDone / total * 100) : 0;
    const hPct   = total > 0 ? (hDone / total * 100) : 0;
    const ptsEarned = leagueTasks.filter(t => t.status === 'complete').reduce((s, t) => s + (t.pts || 0), 0);
    const ptsTotal  = leagueTasks.reduce((s, t) => s + (t.pts || 0), 0);
    el('eg-fill-league').style.width = lPct + '%';
    el('eg-fill-helper').style.width = hPct + '%';
    el('eg-stat-done').textContent    = `${lDone + hDone}/${total}`;
    el('eg-stat-league').textContent  = `${lDone}/${leagueTasks.length}`;
    el('eg-stat-helper').textContent  = `${hDone}/${helperTasks.length}`;
    const ptsEl = el('eg-stat-pts');
    if (ptsEl) ptsEl.textContent = ptsTotal > 0 ? `${ptsEarned}/${ptsTotal}` : '—';
  }

  // ─── Display-order numbering ───────────────
  // Returns a Map<taskId, 1-based display number> following phase order, then ungrouped.
  function buildDisplayNums() {
    const map = new Map();
    let n = 1;
    if (phases.length === 0) {
      tasks.forEach(t => map.set(t.id, n++));
    } else {
      const phaseIdSet = new Set(phases.map(p => p.id));
      for (const phase of phases) {
        tasks.filter(t => t.phaseId === phase.id).forEach(t => map.set(t.id, n++));
      }
      tasks.filter(t => !t.phaseId || !phaseIdSet.has(t.phaseId)).forEach(t => map.set(t.id, n++));
    }
    return map;
  }

  // ─── Task item HTML ────────────────────────
  function taskItemHtml(task, globalIdx, nextIdx, displayNum) {
    const isNext     = globalIdx === nextIdx;
    const isComplete = task.status === 'complete';
    const isSkipped  = task.status === 'skipped';

    let cls = 'eg-task-item';
    if (isNext)                                             cls += ' eg-next';
    if (isComplete && (settings.completedDisplay === 'gray' || settings.completedDisplay === 'hidden')) cls += ' eg-complete-gray';
    if (isSkipped)                                          cls += ' eg-skipped';

    const typeBadge = task.isLeagueTask
      ? '<span class="eg-badge eg-badge-league" title="League Task">⚔️</span>'
      : '<span class="eg-badge eg-badge-helper" title="Helper Task">🛒</span>';
    // Item 9: show pts number as badge, difficulty as tooltip
    const ptsBadge = (task.isLeagueTask && task.pts)
      ? `<span class="eg-badge ${ptsBadgeClass(task.pts)}" title="${ptsBadgeLabel(task.pts)}">${task.pts}</span>`
      : '';
    const areaBadge = task.area ? `<span class="eg-badge eg-badge-area" title="${esc(task.area)}">${esc(task.area)}</span>` : '';
    const skipBadge = isSkipped  ? '<span class="eg-badge eg-badge-skipped">SKIP</span>' : '';
    const pinBadge  = task.pin   ? `<button class="eg-task-btn eg-btn-goto" data-action="goto" data-id="${task.id}" title="Zoom to pin">📍</button>` : '';

    const cIcon  = isComplete ? '↩' : '✓';
    const cTitle = isComplete ? 'Mark incomplete' : 'Mark complete';
    const sIcon  = isSkipped  ? '↩' : '⟳';
    const sTitle = isSkipped  ? 'Unskip' : 'Skip';

    return `
      <div class="${cls}" data-id="${task.id}" data-idx="${globalIdx}" data-phase-id="${task.phaseId || ''}" draggable="true">
        <span class="eg-drag-handle" title="Drag to reorder">⠿</span>
        <span class="eg-task-num">${displayNum ?? globalIdx + 1}</span>
        <div class="eg-task-body">
          <div class="eg-task-title" title="${esc(task.title)}">${esc(task.title)}</div>
          <div class="eg-task-meta">${pinBadge}${typeBadge}${ptsBadge}${areaBadge}${skipBadge}</div>
        </div>
        <div class="eg-task-actions">
          <button class="eg-task-btn btn-complete" data-action="complete" data-id="${task.id}" title="${cTitle}">${cIcon}</button>
          <button class="eg-task-btn btn-skip"     data-action="skip"     data-id="${task.id}" title="${sTitle}">${sIcon}</button>
          <button class="eg-task-btn btn-edit"     data-action="edit"     data-id="${task.id}" title="Edit">✏</button>
          <button class="eg-task-btn btn-delete"   data-action="delete"   data-id="${task.id}" title="Remove">🗑</button>
        </div>
      </div>`;
  }

  function phaseHeaderHtml(phase, taskCount) {
    const chevron = phase.collapsed ? '▸' : '▾';
    return `
      <div class="eg-phase-header" data-phase-id="${phase.id}" draggable="true">
        <span class="eg-phase-drag-handle" title="Drag to reorder phases">⠿</span>
        <button class="eg-phase-collapse-btn" data-phase-action="toggle" data-phase-id="${phase.id}">${chevron}</button>
        <span class="eg-phase-name">${esc(phase.name)}</span>
        <span class="eg-phase-count">${taskCount}</span>
        <button class="eg-phase-btn" data-phase-action="rename" data-phase-id="${phase.id}" title="Rename">✏</button>
        <button class="eg-phase-btn btn-delete" data-phase-action="delete" data-phase-id="${phase.id}" title="Delete">🗑</button>
      </div>`;
  }

  // ─── Task list ─────────────────────────────
  function renderTaskList() {
    const list    = document.getElementById('eg-task-list');
    const visible = filteredTasks();
    const nextIdx = nextIncompleteIdx();

    el('eg-task-count-label').textContent =
      tasks.length === 0 ? '' : `${visible.length} of ${tasks.length} task${tasks.length !== 1 ? 's' : ''}`;

    if (tasks.length === 0) {
      list.innerHTML = `
        <div class="eg-empty-state">
          <div class="eg-empty-icon">🗺️</div>
          <div>No tasks planned yet</div>
          <p>Click <strong>+ Add Task</strong> to start,<br>or right-click anywhere on the map.</p>
        </div>`;
      return;
    }

    if (visible.length === 0) {
      list.innerHTML = `<div class="eg-empty-state"><div>No tasks match the current filters</div></div>`;
      return;
    }

    const displayNums = buildDisplayNums();

    if (phases.length === 0) {
      list.innerHTML = visible.map(t => taskItemHtml(t, tasks.indexOf(t), nextIdx, displayNums.get(t.id))).join('');
    } else {
      const phaseIdSet = new Set(phases.map(p => p.id));
      let html = '';
      for (const phase of phases) {
        const phaseTasks = visible.filter(t => t.phaseId === phase.id);
        html += phaseHeaderHtml(phase, phaseTasks.length);
        if (!phase.collapsed) {
          html += phaseTasks.map(t => taskItemHtml(t, tasks.indexOf(t), nextIdx, displayNums.get(t.id))).join('');
        }
      }
      const ungrouped = visible.filter(t => !t.phaseId || !phaseIdSet.has(t.phaseId));
      if (ungrouped.length > 0) {
        html += `<div class="eg-ungrouped-header">Ungrouped (${ungrouped.length})<button class="eg-phase-btn btn-delete" data-phase-action="delete-ungrouped" title="Delete all ungrouped tasks">🗑</button></div>`;
        html += ungrouped.map(t => taskItemHtml(t, tasks.indexOf(t), nextIdx, displayNums.get(t.id))).join('');
      }
      list.innerHTML = html;
    }

    initDnD();
    bindTaskButtons();
    if (phases.length > 0) bindPhaseButtons();
  }

  function bindTaskButtons() {
    document.querySelectorAll('#eg-task-list [data-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const { action, id } = btn.dataset;
        if (action === 'complete') toggleComplete(id);
        else if (action === 'skip')   toggleSkip(id);
        else if (action === 'edit')   openPanel(id);
        else if (action === 'delete') deleteTask(id);
        else if (action === 'goto')   gotoTaskPin(id);
      });
    });
  }

  // ─── Phase management ─────────────────────
  // Item 2: phase modal replaces prompt()
  function openPhaseModal(title, defaultVal, callback) {
    phaseModalCallback = callback;
    document.getElementById('eg-phase-modal-title').textContent = title;
    const input = document.getElementById('eg-phase-modal-input');
    input.value = defaultVal || '';
    document.getElementById('eg-phase-modal').removeAttribute('hidden');
    setTimeout(() => { input.focus(); input.select(); }, 50);
  }

  function closePhaseModal(confirmed) {
    const val = document.getElementById('eg-phase-modal-input').value.trim();
    document.getElementById('eg-phase-modal').setAttribute('hidden', '');
    const cb = phaseModalCallback;
    phaseModalCallback = null;
    if (confirmed && val && cb) cb(val);
  }

  function addPhase() {
    openPhaseModal('Add Phase', `Phase ${phases.length + 1}`, name => {
      phases.push({ id: uid(), name, collapsed: false });
      save(); renderTaskList();
    });
  }

  function renamePhase(id) {
    const phase = phases.find(p => p.id === id);
    if (!phase) return;
    openPhaseModal('Rename Phase', phase.name, name => {
      phase.name = name; save(); renderTaskList();
    });
  }

  function deletePhase(id) {
    const phase = phases.find(p => p.id === id);
    if (!phase) return;
    const count = tasks.filter(t => t.phaseId === id).length;
    if (count === 0) {
      showConfirmDialog('Delete Phase', `Delete "${phase.name}"?`, {
        okLabel: 'Delete', onOk: () => {
          phases = phases.filter(p => p.id !== id);
          save(); render();
        }
      });
    } else {
      showConfirmDialog('Delete Phase',
        `"${phase.name}" has ${count} task(s). What would you like to do?`,
        {
          okLabel:  'Delete phase & tasks',
          onOk:     () => {
            tasks  = tasks.filter(t => t.phaseId !== id);
            phases = phases.filter(p => p.id !== id);
            save(); render();
          },
          altLabel: 'Ungroup tasks',
          onAlt:    () => {
            tasks.forEach(t => { if (t.phaseId === id) t.phaseId = null; });
            phases = phases.filter(p => p.id !== id);
            save(); render();
          }
        });
    }
  }

  function deleteUngroupedTasks() {
    const phaseIdSet = new Set(phases.map(p => p.id));
    const ungrouped  = tasks.filter(t => !t.phaseId || !phaseIdSet.has(t.phaseId));
    if (ungrouped.length === 0) return;
    showConfirmDialog('Delete Ungrouped',
      `Delete all ${ungrouped.length} ungrouped task(s)? This cannot be undone.`,
      { okLabel: 'Delete all', onOk: () => {
        const ids = new Set(ungrouped.map(t => t.id));
        tasks = tasks.filter(t => !ids.has(t.id));
        save(); render();
      }});
  }

  function togglePhaseCollapse(id) {
    const phase = phases.find(p => p.id === id);
    if (!phase) return;
    phase.collapsed = !phase.collapsed;
    save(); renderTaskList();
  }

  function bindPhaseButtons() {
    // Phase action buttons
    document.querySelectorAll('[data-phase-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const { phaseAction, phaseId } = btn.dataset;
        if (phaseAction === 'toggle') togglePhaseCollapse(phaseId);
        else if (phaseAction === 'rename')          renamePhase(phaseId);
        else if (phaseAction === 'delete')          deletePhase(phaseId);
        else if (phaseAction === 'delete-ungrouped') deleteUngroupedTasks();
      });
    });

    // Phase headers: drop targets for task assignment AND phase reordering
    document.querySelectorAll('.eg-phase-header').forEach(header => {
      // Phase drag start — prevent when clicking buttons inside header
      header.addEventListener('dragstart', e => {
        if (e.target.tagName === 'BUTTON') { e.preventDefault(); return; }
        phaseDrag.fromId = header.dataset.phaseId;
        dragItem.fromIdx = -1; // clear any task drag state
        e.dataTransfer.effectAllowed = 'move';
      });
      header.addEventListener('dragend', () => { phaseDrag.fromId = null; });

      header.addEventListener('dragover', e => {
        if (dragItem.fromIdx === -1 && !phaseDrag.fromId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        header.classList.add('eg-phase-drop-active');
      });
      header.addEventListener('dragleave', () => {
        header.classList.remove('eg-phase-drop-active');
      });
      header.addEventListener('drop', e => {
        e.preventDefault();
        header.classList.remove('eg-phase-drop-active');
        const toId = header.dataset.phaseId;
        if (phaseDrag.fromId && phaseDrag.fromId !== toId) {
          // Reorder phases
          const fromIdx = phases.findIndex(p => p.id === phaseDrag.fromId);
          const toIdx   = phases.findIndex(p => p.id === toId);
          if (fromIdx !== -1 && toIdx !== -1) {
            const [moved] = phases.splice(fromIdx, 1);
            phases.splice(toIdx, 0, moved);
            save(); render();
          }
          phaseDrag.fromId = null;
        } else if (dragItem.fromIdx !== -1) {
          // Assign task to phase
          if (toId && tasks[dragItem.fromIdx]) {
            tasks[dragItem.fromIdx].phaseId = toId;
            save(); render();
          }
          dragItem.fromIdx = -1;
        }
      });
    });
  }

  // ─── Drag & drop ──────────────────────────
  function initDnD() {
    document.querySelectorAll('#eg-task-list .eg-task-item').forEach(item => {
      item.addEventListener('dragstart',  onDragStart);
      item.addEventListener('dragover',   onDragOver);
      item.addEventListener('dragleave',  onDragLeave);
      item.addEventListener('drop',       onDrop);
      item.addEventListener('dragend',    onDragEnd);
    });
  }

  function onDragStart(e) {
    dragItem.fromIdx = parseInt(e.currentTarget.dataset.idx);
    dragItem.el      = e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { if (dragItem.el) dragItem.el.classList.add('eg-dragging'); }, 0);
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const toIdx = parseInt(e.currentTarget.dataset.idx);
    if (toIdx === dragItem.overIdx) return;
    clearDragOver();
    dragItem.overIdx = toIdx;
    const mid = e.currentTarget.getBoundingClientRect();
    e.currentTarget.classList.add(e.clientY < mid.top + mid.height / 2 ? 'eg-drag-over-top' : 'eg-drag-over-bottom');
  }

  function onDragLeave(e) {
    e.currentTarget.classList.remove('eg-drag-over-top', 'eg-drag-over-bottom');
  }

  function onDrop(e) {
    e.preventDefault();
    const toEl     = e.currentTarget;
    const toIdx    = parseInt(toEl.dataset.idx);
    const above    = e.clientY < toEl.getBoundingClientRect().top + toEl.getBoundingClientRect().height / 2;
    const insertAt = above ? toIdx : toIdx + 1;
    const fromIdx  = dragItem.fromIdx;

    if (fromIdx !== -1 && insertAt !== fromIdx && insertAt !== fromIdx + 1) {
      // Adopt the destination task's phase when dragging between phases
      const destPhaseId = toEl.dataset.phaseId || null;
      const [item] = tasks.splice(fromIdx, 1);
      item.phaseId  = destPhaseId;
      const adj     = insertAt > fromIdx ? insertAt - 1 : insertAt;
      tasks.splice(adj, 0, item);
      save(); render();
    }
  }

  function onDragEnd() {
    if (dragItem.el) dragItem.el.classList.remove('eg-dragging');
    clearDragOver();
    dragItem.fromIdx = -1; dragItem.overIdx = -1; dragItem.el = null;
  }

  function clearDragOver() {
    document.querySelectorAll('.eg-drag-over-top, .eg-drag-over-bottom').forEach(e => {
      e.classList.remove('eg-drag-over-top', 'eg-drag-over-bottom');
    });
  }

  // ─── Task actions ─────────────────────────
  function toggleComplete(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    t.status = t.status === 'complete' ? 'incomplete' : 'complete';
    save(); render();
  }

  function toggleSkip(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    t.status = t.status === 'skipped' ? 'incomplete' : 'skipped';
    save(); render();
  }

  // Item 6: styled confirm dialog instead of confirm()
  function deleteTask(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    showConfirmDialog('Remove Task', `Remove "${t.title}" from your route?`, {
      okLabel: 'Remove',
      onOk: () => { tasks = tasks.filter(x => x.id !== id); save(); render(); }
    });
  }

  // ─── Confirm dialog ───────────────────────
  // Items 6 & 7: shared styled confirm/alert dialog
  function showConfirmDialog(title, message, opts) {
    const o = { okLabel: 'OK', cancelLabel: 'Cancel', onOk: null, showCancel: true, altLabel: null, onAlt: null, ...opts };
    document.getElementById('eg-confirm-title').textContent   = title;
    document.getElementById('eg-confirm-message').textContent = message;
    document.getElementById('eg-confirm-ok').textContent      = o.okLabel;
    const cancelBtn = document.getElementById('eg-confirm-cancel');
    if (o.showCancel !== false) {
      cancelBtn.removeAttribute('hidden');
      cancelBtn.textContent = o.cancelLabel;
    } else {
      cancelBtn.setAttribute('hidden', '');
    }
    const altBtn = document.getElementById('eg-confirm-alt');
    if (o.altLabel) {
      altBtn.textContent = o.altLabel;
      altBtn.removeAttribute('hidden');
      confirmAltCallback = o.onAlt;
    } else {
      altBtn.setAttribute('hidden', '');
      confirmAltCallback = null;
    }
    confirmOkCallback = o.onOk;
    document.getElementById('eg-confirm-dialog').removeAttribute('hidden');
  }

  function closeConfirmDialog(confirmed, alt) {
    document.getElementById('eg-confirm-dialog').setAttribute('hidden', '');
    document.getElementById('eg-confirm-cancel').removeAttribute('hidden');
    document.getElementById('eg-confirm-alt').setAttribute('hidden', '');
    const cb    = confirmOkCallback;
    const altCb = confirmAltCallback;
    confirmOkCallback  = null;
    confirmAltCallback = null;
    if (alt && altCb) altCb();
    else if (confirmed && cb) cb();
  }

  // ─── Search helpers ────────────────────────
  function updateSearchResults() {
    const resultsDiv = document.getElementById('eg-search-results');
    if (!resultsDiv) return;
    const results = searchImported(panelState.searchQuery);
    resultsDiv.innerHTML = results.length === 0
      ? `<div class="eg-no-results">No matches</div>`
      : results.map(t => `
          <div class="eg-search-item ${panelState.formData.taskRef === t.id ? 'selected' : ''}" data-tid="${t.id}">
            <span class="si-pts">${t.pts || 0} pts</span>
            <div class="si-name">${esc(t.name)}</div>
            <div class="si-detail">${esc(t.area || '')}${t.area && t.task ? ' — ' : ''}${esc(t.task || '')}</div>
          </div>`).join('');
    bindSearchItems();
  }

  function bindSearchItems() {
    const resultsDiv = document.getElementById('eg-search-results');
    if (!resultsDiv) return;
    resultsDiv.querySelectorAll('.eg-search-item').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        const t = getImportedTasks().find(x => String(x.id) === item.dataset.tid);
        if (!t) return;
        panelState.formData.taskRef     = t.id;
        panelState.formData.title       = t.name;
        panelState.formData.description = t.task  || '';
        panelState.formData.area        = t.area  || '';
        panelState.formData.pts         = t.pts   || null;
        panelState.searchQuery          = t.name;
        renderPanelBody();
      });
    });
  }

  // ─── Panel ────────────────────────────────
  function openPanel(taskId = null, prePin = null) {
    panelState.editingId   = taskId;
    panelState.searchQuery = '';

    if (taskId) {
      const t = tasks.find(x => x.id === taskId);
      if (!t) return;
      panelState.formData = {
        srcType: t.taskRef ? 'league' : 'custom',
        isLeagueTask: t.isLeagueTask,
        taskRef:  t.taskRef  || null,
        title:    t.title,
        description: t.description || '',
        area:     t.area    || '',
        pin:      t.pin     || null,
        pts:      t.pts     || null,
        phaseId:  t.phaseId || null,
      };
      if (t.taskRef) panelState.searchQuery = t.title;
    } else {
      panelState.formData = defaultFormData();
      if (prePin) panelState.formData.pin = prePin;
      if (phases.length > 0) panelState.formData.phaseId = phases[phases.length - 1].id;
    }

    panelState.open = true;
    showPanel();
    renderPanelBody();
  }

  function showPanel() {
    panelState.open = true;
    document.getElementById('eg-panel').classList.add('eg-panel-open');
    document.getElementById('eg-panel-title').textContent =
      panelState.editingId ? 'Edit Task' : 'Add Task';
  }

  function closePanel() {
    panelState.open = false;
    if (panelState.waitingForPin) endPlacementMode();
    document.getElementById('eg-panel').classList.remove('eg-panel-open');
    renderPreviewPin();
  }

  function hidePanelTemporarily() {
    document.getElementById('eg-panel').classList.remove('eg-panel-open');
  }

  function renderPanelBody() {
    const body      = document.getElementById('eg-panel-body');
    const fd        = panelState.formData;
    const hasImport = hasImportedTasks();

    const selected = fd.taskRef ? getImportedTasks().find(t => t.id === fd.taskRef) : null;
    const results  = searchImported(panelState.searchQuery);

    // Item 8: source toggle ALWAYS shown (not hidden when no imports)
    const sourceHtml = `
      <div class="eg-form-section">
        <div class="eg-form-label">Task source</div>
        <div class="eg-type-toggle">
          <button class="eg-type-btn ${fd.srcType === 'league' ? 'active' : ''}" data-source="league">From Task List</button>
          <button class="eg-type-btn ${fd.srcType === 'custom' ? 'active' : ''}" data-source="custom">Custom</button>
        </div>
      </div>`;

    // Task search picker — shown when "From Task List" mode AND tasks are imported
    const pickerHtml = (fd.srcType === 'league' && hasImport) ? `
      <div class="eg-form-section">
        <div class="eg-form-label">Search tasks (${getImportedTasks().length} imported)</div>
        <div class="eg-task-search-wrap">
          <input type="text" class="eg-form-input" id="eg-search-input"
                 placeholder="Search by name, task, or area…"
                 value="${esc(panelState.searchQuery)}" autocomplete="off">
          <div class="eg-task-search-results" id="eg-search-results">
            ${results.length === 0 ? `<div class="eg-no-results">No matches</div>` :
              results.map(t => `
                <div class="eg-search-item ${fd.taskRef === t.id ? 'selected' : ''}" data-tid="${t.id}">
                  <span class="si-pts">${t.pts || 0} pts</span>
                  <div class="si-name">${esc(t.name)}</div>
                  <div class="si-detail">${esc(t.area || '')}${t.area && t.task ? ' — ' : ''}${esc(t.task || '')}</div>
                </div>`).join('')}
          </div>
        </div>
      </div>
      ${selected ? `
        <div class="eg-task-preview">
          <div class="eg-task-preview-name">${esc(selected.name)}</div>
          ${selected.task ? `<div class="eg-task-preview-desc">${esc(selected.task)}</div>` : ''}
          <div class="eg-task-preview-meta">${esc(selected.area || '')}${selected.pts ? ` · ${selected.pts} pts` : ''}</div>
        </div>` : ''}` : '';

    // Item 8: mini-import section — shown when "From Task List" mode AND no tasks imported
    const miniImportHtml = (fd.srcType === 'league' && !hasImport) ? `
      <div class="eg-mini-import">
        <div class="eg-mini-import-title">📋 No league tasks imported yet</div>
        <p class="eg-mini-import-desc">Import tasks from the OSRS wiki to use them in your route, or switch to <strong>Custom</strong> to create a manual task.</p>
        <button class="btn-primary" id="eg-mini-import-btn" style="width:100%;margin-top:0.5rem">🌐 Import from Wiki (All Regions)</button>
        <div id="eg-mini-import-status" class="eg-mini-import-status"></div>
      </div>` : '';

    // Custom fields — shown ONLY when "Custom" source mode
    const customHtml = fd.srcType === 'custom' ? `
      <div class="eg-form-section">
        <div class="eg-form-label">Title *</div>
        <input type="text" class="eg-form-input" id="eg-f-title"
               placeholder="What needs to be done…" value="${esc(fd.title)}">
      </div>
      <div class="eg-form-section">
        <div class="eg-form-label">Description</div>
        <input type="text" class="eg-form-input" id="eg-f-desc"
               placeholder="Extra details…" value="${esc(fd.description)}">
      </div>
      <div class="eg-form-section">
        <div class="eg-form-label">Region</div>
        <select class="eg-form-input" id="eg-f-area">
          <option value="">— Select Region —</option>
          ${REGIONS.map(r => `<option value="${r}" ${fd.area === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      </div>` : '';

    // Category toggle
    const categoryHtml = `
      <div class="eg-form-section">
        <div class="eg-form-label">Category</div>
        <div class="eg-type-toggle">
          <button class="eg-type-btn ${fd.isLeagueTask ? 'active' : ''}"  data-league="true">⚔️ League Task</button>
          <button class="eg-type-btn ${!fd.isLeagueTask ? 'active' : ''}" data-league="false">🛒 Helper Task</button>
        </div>
      </div>`;

    // Phase selector
    const phaseHtml = phases.length > 0 ? `
      <div class="eg-form-section">
        <div class="eg-form-label">Phase</div>
        <select class="eg-form-input" id="eg-f-phase">
          <option value="">— Ungrouped —</option>
          ${phases.map(p => `<option value="${p.id}" ${fd.phaseId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select>
      </div>` : '';

    // Pin location
    const pinLabel = fd.pin ? '📍 Pin placed — click to move' : '📍 Click to place pin on map';
    const pinHtml = `
      <div class="eg-form-section">
        <div class="eg-form-label">Map pin</div>
        <button class="${fd.pin ? 'eg-pin-btn has-pin' : 'eg-pin-btn'}" id="eg-pin-btn">${pinLabel}</button>
        ${fd.pin ? `<button class="eg-pin-clear" id="eg-pin-clear">✕ Remove pin</button>` : ''}
      </div>`;

    body.innerHTML = sourceHtml + pickerHtml + miniImportHtml + customHtml + categoryHtml + phaseHtml + pinHtml;

    // ── Bind events ──

    // Item 4: source toggle auto-swaps category
    body.querySelectorAll('[data-source]').forEach(btn => {
      btn.addEventListener('click', () => {
        panelState.formData.srcType = btn.dataset.source;
        if (btn.dataset.source === 'custom') {
          panelState.formData.taskRef      = null;
          panelState.formData.isLeagueTask = false; // auto-switch to helper
        } else {
          panelState.formData.isLeagueTask = true;  // auto-switch to league
        }
        renderPanelBody();
      });
    });

    // Category toggle
    body.querySelectorAll('[data-league]').forEach(btn => {
      btn.addEventListener('click', () => {
        panelState.formData.isLeagueTask = btn.dataset.league === 'true';
        renderPanelBody();
      });
    });

    // Search input (only updates results, prevents cursor-jump on re-render)
    const searchInput = document.getElementById('eg-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        panelState.searchQuery = searchInput.value;
        updateSearchResults();
      });
      if (!panelState.formData.taskRef) {
        setTimeout(() => {
          if (searchInput) { searchInput.focus(); const l = searchInput.value.length; searchInput.setSelectionRange(l, l); }
        }, 50);
      }
    }
    bindSearchItems();

    // Custom fields
    [['eg-f-title', 'title'], ['eg-f-desc', 'description']].forEach(([id, key]) => {
      const inp = document.getElementById(id);
      if (inp) inp.addEventListener('input', () => { panelState.formData[key] = inp.value; });
    });
    const areaEl = document.getElementById('eg-f-area');
    if (areaEl) areaEl.addEventListener('change', () => { panelState.formData.area = areaEl.value; });

    // Phase selector
    const phaseEl = document.getElementById('eg-f-phase');
    if (phaseEl) phaseEl.addEventListener('change', () => { panelState.formData.phaseId = phaseEl.value || null; });

    // Pin button
    const pinBtn = document.getElementById('eg-pin-btn');
    if (pinBtn) pinBtn.addEventListener('click', () => startPlacementMode());

    const clearPin = document.getElementById('eg-pin-clear');
    if (clearPin) clearPin.addEventListener('click', () => { panelState.formData.pin = null; renderPanelBody(); });

    // Item 8: mini-import button — calls global fetchTasksFromWiki
    const miniImportBtn = document.getElementById('eg-mini-import-btn');
    if (miniImportBtn) {
      miniImportBtn.addEventListener('click', async () => {
        miniImportBtn.disabled = true;
        miniImportBtn.textContent = '⏳ Importing from wiki…';
        const statusEl = document.getElementById('eg-mini-import-status');
        try {
          if (typeof fetchTasksFromWiki === 'function') await fetchTasksFromWiki();
        } catch (e) {}
        if (hasImportedTasks()) {
          if (statusEl) statusEl.textContent = `✅ ${getImportedTasks().length} tasks imported!`;
          setTimeout(() => renderPanelBody(), 500);
        } else {
          if (statusEl) statusEl.textContent = '❌ Import failed. Check your connection.';
          miniImportBtn.disabled = false;
          miniImportBtn.textContent = '🌐 Import from Wiki (All Regions)';
        }
      });
    }

    renderPreviewPin();
  }

  function saveTask() {
    const fd    = panelState.formData;
    const title = (fd.title || '').trim();

    if (!title) {
      if (fd.srcType === 'league' && !fd.taskRef) {
        showConfirmDialog('No Task Selected', 'Please select a task from the list.', { showCancel: false });
      } else {
        showConfirmDialog('Title Required', 'Please enter a task title.', { showCancel: false });
      }
      return;
    }

    if (panelState.editingId) {
      const t = tasks.find(x => x.id === panelState.editingId);
      if (t) {
        t.title        = title;
        t.description  = (fd.description || '').trim();
        t.area         = (fd.area || '').trim();
        t.isLeagueTask = fd.isLeagueTask;
        t.taskRef      = fd.taskRef  || null;
        t.pin          = fd.pin;
        t.pts          = fd.pts      || null;
        t.phaseId      = fd.phaseId  || null;
      }
    } else {
      let phaseId = fd.phaseId || null;
      if (tasks.length === 0 && phases.length === 0) {
        const newPhase = { id: uid(), name: 'Phase 1', collapsed: false };
        phases.push(newPhase);
        phaseId = newPhase.id;
      }
      tasks.push({
        id:           uid(),
        taskRef:      fd.taskRef   || null,
        title,
        description:  (fd.description || '').trim(),
        area:         (fd.area || '').trim(),
        isLeagueTask: fd.isLeagueTask,
        pts:          fd.pts        || null,
        phaseId,
        status:       'incomplete',
        pin:          fd.pin,
      });
    }

    save(); closePanel(); render();
  }

  // ─── Full render ──────────────────────────
  function render() {
    renderProgress();
    renderTaskList();
    renderMapPins();
  }

  // ─── Go to pin ────────────────────────────
  function gotoTaskPin(id) {
    const task = tasks.find(t => t.id === id);
    if (!task || !task.pin || !mapState.imgW) return;
    const container = document.getElementById('eg-map-container');
    const cw = container.clientWidth, ch = container.clientHeight;
    const targetScale = Math.max(2.5, mapState.scale);
    animateMapTo(
      cw / 2 - (task.pin.px / 100 * mapState.imgW) * targetScale,
      ch / 2 - (task.pin.py / 100 * mapState.imgH) * targetScale,
      targetScale
    );
  }

  function animateMapTo(targetX, targetY, targetScale) {
    const startX = mapState.x, startY = mapState.y, startS = mapState.scale;
    const duration = 380, t0 = performance.now();
    function frame(now) {
      const p    = Math.min((now - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      mapState.x = startX + (targetX - startX) * ease;
      mapState.y = startY + (targetY - startY) * ease;
      mapState.scale = startS + (targetScale - startS) * ease;
      const vp = document.getElementById('eg-map-viewport');
      if (vp) vp.style.transform = `translate(${mapState.x}px,${mapState.y}px) scale(${mapState.scale})`;
      updatePinPositions();
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ─── Preview pin ──────────────────────────
  function renderPreviewPin() {
    const existing = document.getElementById('eg-preview-pin');
    if (existing) existing.remove();
    if (!panelState.open || !panelState.formData.pin || !mapState.imgW) return;
    const pinsOverlay = document.getElementById('eg-map-pins-overlay');
    if (!pinsOverlay) return;
    const { px, py } = panelState.formData.pin;
    const div = document.createElement('div');
    div.id = 'eg-preview-pin'; div.className = 'eg-map-pin eg-pin-preview';
    div.dataset.px = px; div.dataset.py = py;
    div.innerHTML = `
      <svg width="32" height="32" viewBox="-14 -14 28 28"
           style="display:block;overflow:visible" xmlns="http://www.w3.org/2000/svg">
        <circle r="13" fill="rgba(0,0,0,0.3)"/>
        <circle r="11" fill="rgba(232,195,90,0.3)" stroke="#e8c35a" stroke-width="2.5" stroke-dasharray="4 3"/>
        <text x="0" y="0" text-anchor="middle" dominant-baseline="middle"
              font-size="13" fill="#e8c35a" font-family="Arial,sans-serif" pointer-events="none">+</text>
      </svg>`;
    pinsOverlay.appendChild(div);
    const sc = imgToScreen(px, py);
    div.style.transform = `translate(${sc.x - 16}px,${sc.y - 16}px)`;
  }

  // ─── Info overlay ─────────────────────────
  function openInfoOverlay()  {
    markInfoSeen();
    document.getElementById('eg-info-overlay').removeAttribute('hidden');
  }
  function closeInfoOverlay() { document.getElementById('eg-info-overlay').setAttribute('hidden', ''); }

  // ─── Color settings popup ─────────────────
  const COLOR_DEFAULTS = {
    pinLeague: '#2980b9', pinHelper: '#8e44ad', pinNext: '#e8c35a',
    pinComplete: '#666666', pinCompleteOpacity: 50, pinSkipped: '#e67e22',
    line: '#fec416', lineOpacity: 100, lineDone: '#c8a84b', lineDoneOpacity: 35,
  };

  function openColorPopup()  { document.getElementById('eg-color-popup').removeAttribute('hidden'); syncColorPopupInputs(); }
  function closeColorPopup() { document.getElementById('eg-color-popup').setAttribute('hidden', ''); }

  function syncColorPopupInputs() {
    const c = settings.colors;
    const setVal = (id, val) => { const e = document.getElementById(id); if (e) e.value = val; };
    const setDot = (id, val) => { const e = document.getElementById(id); if (e) e.style.background = val; };
    ['pinLeague','pinHelper','pinNext','pinComplete','pinSkipped','line','lineDone'].forEach(k => { setVal('egc-'+k, c[k]); setDot('egc-pdot-'+k, c[k]); });
    const syncRange = (id, key) => {
      const e = document.getElementById(id), v = document.getElementById(id+'-val');
      if (e) { e.value = c[key]; if (v) v.textContent = c[key] + '%'; }
    };
    syncRange('egc-pinCompleteOpacity', 'pinCompleteOpacity');
    syncRange('egc-lineOpacity', 'lineOpacity');
    syncRange('egc-lineDoneOpacity', 'lineDoneOpacity');
  }

  function bindColorPopupEvents() {
    document.getElementById('eg-color-popup-close').addEventListener('click', closeColorPopup);
    document.getElementById('egc-reset').addEventListener('click', () => {
      settings.colors = { ...COLOR_DEFAULTS }; syncColorPopupInputs(); save(); renderMapPins();
    });
    ['pinLeague','pinHelper','pinNext','pinComplete','pinSkipped','line','lineDone'].forEach(k => {
      const inp = document.getElementById('egc-'+k), dot = document.getElementById('egc-pdot-'+k);
      if (inp) inp.addEventListener('input', () => { settings.colors[k] = inp.value; if (dot) dot.style.background = inp.value; save(); renderMapPins(); });
    });
    const bindRange = (id, key) => {
      const inp = document.getElementById(id), val = document.getElementById(id+'-val');
      if (inp) inp.addEventListener('input', () => { settings.colors[key] = parseInt(inp.value); if (val) val.textContent = inp.value + '%'; save(); renderMapPins(); });
    };
    bindRange('egc-pinCompleteOpacity', 'pinCompleteOpacity');
    bindRange('egc-lineOpacity', 'lineOpacity');
    bindRange('egc-lineDoneOpacity', 'lineDoneOpacity');
  }

  // ─── Fullscreen ───────────────────────────
  function initFullscreenToggles() {
    const page = document.querySelector('.eg-page');
    const sidebar = document.getElementById('eg-fs-toggle-sidebar');
    const header  = document.getElementById('eg-fs-toggle-header');
    if (sidebar) sidebar.addEventListener('click', () => { page.classList.toggle('eg-fs-hide-sidebar'); setTimeout(() => applyMapTransform(), 60); });
    if (header)  header .addEventListener('click', () => { page.classList.toggle('eg-fs-hide-header');  setTimeout(() => applyMapTransform(), 60); });
  }

  function toggleFullscreen() {
    const tab = el('tab-early');
    const entering = !tab.classList.contains('eg-windowed-fs');
    tab.classList.toggle('eg-windowed-fs');
    const btn = el('eg-zoom-fullscreen');
    if (btn) {
      btn.title = entering ? 'Exit expanded view' : 'Expand to window';
      btn.style.color = entering ? 'var(--text-gold)' : '';
    }
    if (!entering) {
      const page = document.querySelector('.eg-page');
      if (page) page.classList.remove('eg-fs-hide-sidebar', 'eg-fs-hide-header');
    }
    setTimeout(() => fitMap(), 120);
  }

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const tab = el('tab-early');
    if (!tab || !tab.classList.contains('eg-windowed-fs')) return;
    const phaseModal   = el('eg-phase-modal');
    const confirmDlg   = el('eg-confirm-dialog');
    const infoOverlay  = document.getElementById('eg-info-overlay');
    if ((phaseModal  && !phaseModal.hidden)  ||
        (confirmDlg  && !confirmDlg.hidden)  ||
        (infoOverlay && !infoOverlay.hidden)) return;
    toggleFullscreen();
  });

  // ─── Export / Import ──────────────────────
  function exportJSON() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      phases: phases.map(p => ({ id: p.id, name: p.name, collapsed: !!p.collapsed })),
      tasks:  tasks.map(t => ({
        id: t.id, phaseId: t.phaseId || null, taskRef: t.taskRef || null,
        title: t.title, description: t.description || '', area: t.area || '',
        isLeagueTask: t.isLeagueTask, pts: t.pts || null, status: t.status, pin: t.pin || null,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `osrs-league-route-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  // Item 7: two-stage styled confirm for imports
  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.tasks || !Array.isArray(data.tasks)) {
          showConfirmDialog('Import Error', 'Invalid file format: expected { tasks: [...] }', { showCancel: false });
          return;
        }
        const newCount   = data.tasks.length;
        const newPhases  = Array.isArray(data.phases) ? data.phases.length : 0;
        const existing   = tasks.length;

        const doImport = () => {
          phases = Array.isArray(data.phases) ? data.phases.map(p => ({
            id: p.id || uid(), name: p.name || 'Phase', collapsed: !!p.collapsed,
          })) : [];
          tasks = data.tasks.map(t => ({
            id: t.id || uid(), phaseId: t.phaseId || null, taskRef: t.taskRef || null,
            title: t.title || '', description: t.description || '', area: t.area || '',
            isLeagueTask: !!t.isLeagueTask, pts: t.pts || null,
            status: ['complete','skipped'].includes(t.status) ? t.status : 'incomplete',
            pin: (t.pin && typeof t.pin.px === 'number') ? t.pin : null,
          }));
          save(); render();
          showConfirmDialog('Import Complete',
            `Imported ${tasks.length} task(s) across ${phases.length} phase(s).`,
            { showCancel: false });
        };

        // First confirmation: import preview
        showConfirmDialog('Import Route',
          `Import ${newCount} task(s) across ${newPhases} phase(s)?`,
          { okLabel: 'Import', onOk: () => {
            if (existing > 0) {
              // Second confirmation: replace warning
              showConfirmDialog('Replace Existing Tasks',
                `This will replace your ${existing} existing task(s). This cannot be undone.`,
                { okLabel: 'Replace & Import', onOk: doImport });
            } else {
              doImport();
            }
          }});
      } catch (err) {
        showConfirmDialog('Import Error', 'Failed to read file: ' + err.message, { showCancel: false });
      }
    };
    reader.readAsText(file);
  }

  function importMyRoute() {
    fetch('myroute.json?v=' + MYROUTE_VERSION)
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(data => {
        if (!data.tasks || !Array.isArray(data.tasks)) {
          showConfirmDialog('Import Error', 'myroute.json has an invalid format.', { showCancel: false });
          return;
        }
        const newCount  = data.tasks.length;
        const newPhases = Array.isArray(data.phases) ? data.phases.length : 0;
        const existing  = tasks.length;

        const doImport = () => {
          phases = Array.isArray(data.phases) ? data.phases.map(p => ({
            id: p.id || uid(), name: p.name || 'Phase', collapsed: !!p.collapsed,
          })) : [];
          tasks = data.tasks.map(t => ({
            id: t.id || uid(), phaseId: t.phaseId || null, taskRef: t.taskRef || null,
            title: t.title || '', description: t.description || '', area: t.area || '',
            isLeagueTask: !!t.isLeagueTask, pts: t.pts || null,
            status: ['complete','skipped'].includes(t.status) ? t.status : 'incomplete',
            pin: (t.pin && typeof t.pin.px === 'number') ? t.pin : null,
          }));
          save(); render();
          showConfirmDialog('Import Complete',
            'Loaded ' + tasks.length + ' task(s) across ' + phases.length + ' phase(s).',
            { showCancel: false });
        };

        showConfirmDialog('Load My Route Preset',
          'Load the preset route? (' + newCount + ' task(s), ' + newPhases + ' phase(s))',
          { okLabel: 'Load', onOk: () => {
            if (existing > 0) {
              showConfirmDialog('Replace Existing Tasks',
                'This will replace your ' + existing + ' existing task(s). This cannot be undone.',
                { okLabel: 'Replace & Load', onOk: doImport });
            } else {
              doImport();
            }
          }});
      })
      .catch(err => {
        showConfirmDialog('Import Error', 'Could not load myroute.json: ' + err.message, { showCancel: false });
      });
  }

  function parseTXTImport(text) {
    const lines = text.split('\n');
    const newPhases = [], newTasks = [];
    let currentPhaseId = null;
    const regionMap = { 'Global': 'General' };
    const diffPts   = { 'Easy': 10, 'Medium': 30, 'Hard': 80, 'Elite': 200, 'Master': 400 };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (/^[\u2550═]+/.test(line) || /^Total:/i.test(line)) continue;

      if (/^[\u2500─\-]{2,}/.test(line) && /[\u2500─\-]{2,}\s*$/.test(line)) {
        const stripped  = line.replace(/^[\u2500─\- ]+/, '').replace(/[\u2500─\- ]+$/, '').trim();
        const phaseName = stripped.replace(/\s*\([^)]*\)\s*$/, '').trim();
        if (phaseName) {
          const phaseId = uid();
          newPhases.push({ id: phaseId, name: phaseName, collapsed: false });
          currentPhaseId = phaseId;
        }
        continue;
      }

      if (!/^[✅⬜]/.test(line)) continue;
      const isDone = line.startsWith('✅');
      const rest   = line.slice(line.codePointAt(0) > 0xFFFF ? 3 : 2).trim();

      if (rest.startsWith('📝')) {
        const content    = rest.slice(rest.codePointAt(0) > 0xFFFF ? 3 : 2).trim();
        const colonIdx   = content.indexOf(':');
        newTasks.push({
          id: uid(), phaseId: currentPhaseId, taskRef: null,
          title: colonIdx !== -1 ? content.slice(0, colonIdx).trim() : content,
          description: colonIdx !== -1 ? content.slice(colonIdx + 1).trim() : '',
          area: '', isLeagueTask: false, pts: null,
          status: isDone ? 'complete' : 'incomplete', pin: null,
        });
      } else {
        const m = rest.match(/^(.+?)\s+\[([^\]]+)\]\s+\[([^\]]+)\]\s+(\d+)\s*pts?\.?$/i);
        if (m) {
          newTasks.push({
            id: uid(), phaseId: currentPhaseId, taskRef: null,
            title: m[1].trim(), description: '',
            area: regionMap[m[2].trim()] || m[2].trim(),
            isLeagueTask: true,
            pts: parseInt(m[4]) || diffPts[m[3].trim()] || 0,
            status: isDone ? 'complete' : 'incomplete', pin: null,
          });
        } else {
          newTasks.push({
            id: uid(), phaseId: currentPhaseId, taskRef: null,
            title: rest, description: '', area: '', isLeagueTask: false, pts: null,
            status: isDone ? 'complete' : 'incomplete', pin: null,
          });
        }
      }
    }
    return { phases: newPhases, tasks: newTasks };
  }

  function importTXT(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const { phases: newPhases, tasks: newTasks } = parseTXTImport(e.target.result);
      if (newTasks.length === 0) {
        showConfirmDialog('No Tasks Found', 'No tasks could be parsed from the file.', { showCancel: false });
        return;
      }
      const existing = tasks.length;

      // First confirmation: import preview
      showConfirmDialog('Import Leaguesplanner Route',
        `Import ${newTasks.length} task(s) across ${newPhases.length} phase(s)?`,
        { okLabel: 'Import', onOk: () => {
          if (existing > 0) {
            // Second confirmation: replace warning
            showConfirmDialog('Replace Existing Tasks',
              `This will replace your ${existing} existing task(s). This cannot be undone.`,
              { okLabel: 'Replace & Import', onOk: () => {
                phases = newPhases; tasks = newTasks; save(); render();
                showConfirmDialog('Import Complete',
                  `Imported ${newTasks.length} task(s) across ${newPhases.length} phase(s).`,
                  { showCancel: false });
              }});
          } else {
            phases = newPhases; tasks = newTasks; save(); render();
            showConfirmDialog('Import Complete',
              `Imported ${newTasks.length} task(s) across ${newPhases.length} phase(s).`,
              { showCancel: false });
          }
        }});
    };
    reader.readAsText(file);
  }

  function handleImportFile(file) {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith('.json'))     importJSON(file);
    else if (name.endsWith('.txt')) importTXT(file);
    else showConfirmDialog('Invalid File', 'Please select a .json or .txt file.', { showCancel: false });
  }

  // ─── Utility ──────────────────────────────
  function el(id) { return document.getElementById(id); }

  // ─── Tab activation (called by app.js when restoring saved tab) ──
  function activateEarlyTab() {
    if (!tabActivated) {
      tabActivated = true;
      setTimeout(() => { initMap(); render(); }, 60);
    }
  }

  // ─── Init ─────────────────────────────────
  function init() {
    load();

    // Toolbar
    el('eg-add-task')         .addEventListener('click', () => openPanel());
    el('eg-panel-close')      .addEventListener('click', closePanel);
    el('eg-save-task')        .addEventListener('click', saveTask);
    el('eg-cancel-task')      .addEventListener('click', closePanel);
    el('eg-cancel-placement') .addEventListener('click', () => { endPlacementMode(); showPanel(); });
    el('eg-zoom-fullscreen')  .addEventListener('click', toggleFullscreen);
    el('eg-add-phase-btn')    .addEventListener('click', addPhase);
    el('eg-export-btn')            .addEventListener('click', exportJSON);
    el('eg-import-file')           .addEventListener('change', e => { handleImportFile(e.target.files[0]); e.target.value = ''; });
    el('eg-import-myroute-btn')    .addEventListener('click', importMyRoute);

    // Info overlay
    el('eg-info-btn')   .addEventListener('click', openInfoOverlay);
    el('eg-info-close') .addEventListener('click', closeInfoOverlay);
    el('eg-info-overlay').addEventListener('click', e => { if (e.target === el('eg-info-overlay')) closeInfoOverlay(); });

    // First-visit pulse on info button
    if (_firstVisit) el('eg-info-btn').classList.add('eg-icon-btn-pulse');

    // Color popup
    el('eg-color-settings-btn').addEventListener('click', openColorPopup);
    bindColorPopupEvents();

    // Phase modal (Item 2)
    el('eg-phase-modal-ok')    .addEventListener('click', () => closePhaseModal(true));
    el('eg-phase-modal-cancel').addEventListener('click', () => closePhaseModal(false));
    el('eg-phase-modal-x')     .addEventListener('click', () => closePhaseModal(false));
    el('eg-phase-modal')       .addEventListener('click', e => { if (e.target === el('eg-phase-modal')) closePhaseModal(false); });
    el('eg-phase-modal-input') .addEventListener('keydown', e => {
      if (e.key === 'Enter') closePhaseModal(true);
      if (e.key === 'Escape') closePhaseModal(false);
    });

    // Confirm dialog (Items 6 & 7)
    el('eg-confirm-ok')    .addEventListener('click', () => closeConfirmDialog(true));
    el('eg-confirm-alt')   .addEventListener('click', () => closeConfirmDialog(false, true));
    el('eg-confirm-cancel').addEventListener('click', () => closeConfirmDialog(false));
    el('eg-confirm-x')     .addEventListener('click', () => closeConfirmDialog(false));
    el('eg-confirm-dialog').addEventListener('click', e => { if (e.target === el('eg-confirm-dialog')) closeConfirmDialog(false); });

    // Fullscreen toggles
    initFullscreenToggles();

    // Filters
    el('eg-filter-region').addEventListener('change', e => { settings.filters.region = e.target.value; save(); renderTaskList(); });
    el('eg-filter-status').addEventListener('change', e => { settings.filters.status = e.target.value; save(); renderTaskList(); });
    el('eg-filter-type')  .addEventListener('change', e => { settings.filters.type   = e.target.value; save(); renderTaskList(); });
    el('eg-completed-display').addEventListener('change', e => { settings.completedDisplay = e.target.value; save(); render(); });

    el('eg-completed-display').value = settings.completedDisplay;
    el('eg-filter-region').value     = settings.filters.region || '';
    el('eg-filter-status').value     = settings.filters.status || '';
    el('eg-filter-type').value       = settings.filters.type   || '';

    // Early game tab click → lazy map init
    document.querySelector('[data-tab="early"]').addEventListener('click', activateEarlyTab);

    // Listen for tasks imported from Task List tab → re-render panel if open
    document.addEventListener('osrsl6:tasksImported', () => {
      if (panelState.open) renderPanelBody();
    });

    renderProgress();
    renderTaskList();

    // If the tab was already restored as active before EG loaded (e.g. from saved tab in localStorage)
    if (!document.getElementById('tab-early').hidden) {
      activateEarlyTab();
    }
  }

  return { init, activateTab: activateEarlyTab, closePhaseModal, closeConfirmDialog };
})();

EG.init();
