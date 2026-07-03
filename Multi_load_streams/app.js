'use strict';

// ── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'multistream_v1';
const MAX_WINDOWS = 10;

// ── State ───────────────────────────────────────────────────────────────────

let appData = { urlList: [], windowStates: [] };
let nextId   = 1;
let overlayPaused = []; // [{ id, url }] — windows paused while overlay is open

// ── Storage ─────────────────────────────────────────────────────────────────

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) appData = JSON.parse(raw);
  } catch (e) {
    console.warn('multistream_v1: failed to load localStorage', e);
  }
}

function saveData() {
  appData.windowStates = collectWindowStates();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function collectWindowStates() {
  return Array.from(document.querySelectorAll('.stream-window')).map(el => ({
    id:     el.dataset.id,
    url:    el.dataset.url || '',
    width:  parseInt(el.style.width)  || 480,
    height: parseInt(el.style.height) || 300,
  }));
}

// ── URL Normalization ────────────────────────────────────────────────────────

function normalizeUrl(raw) {
  const url = raw.trim();

  // YouTube: watch → embed
  const yt = url.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1`;

  // Twitch channel page → embed player
  const tw = url.match(/^(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([a-zA-Z0-9_]+)\/?$/);
  if (tw) {
    const parent = window.location.hostname || 'localhost';
    return `https://player.twitch.tv/?channel=${tw[1]}&parent=${parent}&autoplay=true`;
  }

  return url;
}

// ── Window Count Badge ───────────────────────────────────────────────────────

function updateCount() {
  const n = document.querySelectorAll('.stream-window').length;
  document.getElementById('window-count').textContent = `${n} / ${MAX_WINDOWS}`;
}

// ── Window Rendering ─────────────────────────────────────────────────────────

function buildSelectOptions() {
  const opts = appData.urlList
    .map((u, i) => `<option value="saved:${i}">${escHtml(u.tag)}</option>`)
    .join('');
  return `<option value="">— Saved URLs —</option>${opts}<option value="custom">Custom URL…</option>`;
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function createWindowEl(state) {
  const { id, url, width, height } = state;

  const win = document.createElement('div');
  win.className = 'stream-window';
  win.dataset.id  = id;
  win.dataset.url = url || '';
  win.style.width  = (width  || 480) + 'px';
  win.style.height = (height || 300) + 'px';

  win.innerHTML = `
    <div class="window-header">
      <select class="url-select">${buildSelectOptions()}</select>
      <input class="custom-url-input" type="text" placeholder="Enter stream URL…" style="display:none">
      <div class="window-actions">
        <button class="btn btn-sm btn-primary load-btn">Load</button>
        <button class="btn-expand" title="Open fullscreen">&#x26F6;</button>
        <button class="btn-close-win" title="Remove window">&times;</button>
      </div>
    </div>
    <div class="window-body${url ? ' loaded' : ''}">
      <iframe
        src="${url || 'about:blank'}"
        frameborder="0"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowfullscreen
      ></iframe>
      <div class="window-placeholder">
        <div class="placeholder-icon">&#128250;</div>
        <div>Select a URL above and click <strong>Load</strong></div>
      </div>
    </div>
    <div class="resize-handle"></div>
  `;

  attachWindowListeners(win, id);
  return win;
}

function addWindow(state) {
  if (document.querySelectorAll('.stream-window').length >= MAX_WINDOWS) {
    alert(`Maximum of ${MAX_WINDOWS} stream windows reached.`);
    return;
  }
  const win = createWindowEl(state || { id: String(nextId++), url: '', width: 480, height: 300 });
  document.getElementById('stream-grid').appendChild(win);
  updateCount();
  saveData();
}

function removeWindow(id) {
  const el = document.querySelector(`.stream-window[data-id="${id}"]`);
  if (el) el.remove();
  updateCount();
  saveData();
}

function loadUrlIntoWindow(win, rawUrl) {
  if (!rawUrl) return;
  const url = normalizeUrl(rawUrl);
  const iframe = win.querySelector('iframe');
  iframe.src = url;
  win.dataset.url = url;
  win.querySelector('.window-body').classList.add('loaded');
  saveData();
}

// ── Window Event Listeners ───────────────────────────────────────────────────

function attachWindowListeners(win, id) {
  const select      = win.querySelector('.url-select');
  const customInput = win.querySelector('.custom-url-input');
  const loadBtn     = win.querySelector('.load-btn');
  const expandBtn   = win.querySelector('.btn-expand');
  const closeBtn    = win.querySelector('.btn-close-win');
  const resizeHandle = win.querySelector('.resize-handle');

  // Toggle custom input visibility
  select.addEventListener('change', () => {
    const isCustom = select.value === 'custom';
    customInput.style.display = isCustom ? '' : 'none';
    if (isCustom) customInput.focus();
  });

  // Load button
  loadBtn.addEventListener('click', () => {
    let rawUrl = '';
    if (select.value === 'custom') {
      rawUrl = customInput.value.trim();
    } else if (select.value.startsWith('saved:')) {
      const idx = parseInt(select.value.slice(6));
      rawUrl = appData.urlList[idx]?.url || '';
    }
    loadUrlIntoWindow(win, rawUrl);
  });

  // Enter key in custom input
  customInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') loadBtn.click();
  });

  // Open fullscreen overlay
  expandBtn.addEventListener('click', () => {
    const url = win.dataset.url;
    if (!url || url === 'about:blank') return;
    openOverlay(url);
  });

  // Remove window
  closeBtn.addEventListener('click', () => removeWindow(id));

  // Resize drag
  attachResize(win, resizeHandle);

  // Header drag to reorder
  attachDrag(win);
}

// ── Window Drag Reorder ──────────────────────────────────────────────────────

function attachDrag(win) {
  const header = win.querySelector('.window-header');

  header.addEventListener('mousedown', e => {
    if (e.target.closest('button, select, input')) return;
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    let ghost = null;
    let offsetX, offsetY;

    const placeholder = document.createElement('div');
    placeholder.className = 'drag-placeholder';

    function beginDrag() {
      dragging = true;
      const rect = win.getBoundingClientRect();
      offsetX = startX - rect.left;
      offsetY = startY - rect.top;

      placeholder.style.width  = rect.width  + 'px';
      placeholder.style.height = rect.height + 'px';

      ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.style.left   = rect.left   + 'px';
      ghost.style.top    = rect.top    + 'px';
      ghost.style.width  = rect.width  + 'px';
      ghost.style.height = rect.height + 'px';
      document.body.appendChild(ghost);

      win.replaceWith(placeholder);
      document.body.classList.add('dragging-window');
    }

    function onMove(e) {
      if (!dragging) {
        if (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5) {
          beginDrag();
        } else return;
      }

      ghost.style.left = (e.clientX - offsetX) + 'px';
      ghost.style.top  = (e.clientY - offsetY) + 'px';

      // iframes have pointer-events:none so elementFromPoint sees through them
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const target = el?.closest('.stream-window');
      if (target) {
        const rect = target.getBoundingClientRect();
        if (e.clientX < rect.left + rect.width / 2) {
          target.before(placeholder);
        } else {
          target.after(placeholder);
        }
      }
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!dragging) return;

      placeholder.replaceWith(win);
      ghost.remove();
      document.body.classList.remove('dragging-window');
      dragging = false;
      saveData();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// ── Resize Drag ──────────────────────────────────────────────────────────────

function attachResize(win, handle) {
  handle.addEventListener('mousedown', e => {
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = win.offsetWidth;
    const startH = win.offsetHeight;

    document.body.classList.add('resizing');

    function onMove(e) {
      win.style.width  = Math.max(240, startW + (e.clientX - startX)) + 'px';
      win.style.height = Math.max(160, startH + (e.clientY - startY)) + 'px';
    }

    function onUp() {
      document.body.classList.remove('resizing');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      saveData();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// ── Overlay ──────────────────────────────────────────────────────────────────

function openOverlay(url) {
  // Pause all active stream windows
  overlayPaused = [];
  document.querySelectorAll('.stream-window').forEach(win => {
    const winUrl = win.dataset.url;
    if (winUrl && winUrl !== 'about:blank') {
      overlayPaused.push({ id: win.dataset.id, url: winUrl });
      win.querySelector('iframe').src = 'about:blank';
    }
  });

  document.getElementById('overlay-label').textContent = url;
  document.getElementById('overlay-iframe').src = url;
  document.getElementById('overlay').classList.add('active');
}

function closeOverlay() {
  document.getElementById('overlay').classList.remove('active');
  document.getElementById('overlay-iframe').src = 'about:blank';
  document.getElementById('overlay-label').textContent = '';

  // Restore all paused windows
  overlayPaused.forEach(({ id, url }) => {
    const win = document.querySelector(`.stream-window[data-id="${id}"]`);
    if (win) win.querySelector('iframe').src = url;
  });
  overlayPaused = [];
}

// ── URL Manager ──────────────────────────────────────────────────────────────

function renderUrlList() {
  const list = document.getElementById('url-list');
  list.innerHTML = '';

  if (appData.urlList.length === 0) {
    list.innerHTML = '<p class="empty-msg">No saved URLs yet.</p>';
    return;
  }

  appData.urlList.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'url-list-item';
    row.innerHTML = `
      <span class="url-tag">${escHtml(item.tag)}</span>
      <span class="url-text" title="${escHtml(item.url)}">${escHtml(item.url)}</span>
      <button class="btn btn-sm btn-danger" data-idx="${idx}">Remove</button>
    `;
    row.querySelector('button').addEventListener('click', () => {
      appData.urlList.splice(idx, 1);
      saveData();
      renderUrlList();
      refreshAllSelects();
    });
    list.appendChild(row);
  });
}

function addSavedUrl(tag, rawUrl) {
  if (!tag.trim() || !rawUrl.trim()) return false;
  appData.urlList.push({ tag: tag.trim(), url: rawUrl.trim() });
  saveData();
  renderUrlList();
  refreshAllSelects();
  return true;
}

function tagFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host || 'Stream';
  } catch {
    return 'Stream';
  }
}

function bulkAddUrls(raw) {
  const lines = raw.split('\n');
  let added = 0, skipped = 0;

  lines.forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;

    let tag, url;
    const sep = line.indexOf('|');
    if (sep !== -1) {
      tag = line.slice(0, sep).trim();
      url = line.slice(sep + 1).trim();
    } else {
      url = line;
      tag = tagFromUrl(url);
    }

    if (!url) { skipped++; return; }
    if (!tag) tag = tagFromUrl(url);

    appData.urlList.push({ tag, url });
    added++;
  });

  if (added > 0) {
    saveData();
    renderUrlList();
    refreshAllSelects();
  }

  return { added, skipped };
}

function refreshAllSelects() {
  document.querySelectorAll('.url-select').forEach(sel => {
    const prev = sel.value;
    sel.innerHTML = buildSelectOptions();
    // Try to restore previous selection if still valid
    if (sel.querySelector(`option[value="${prev}"]`)) sel.value = prev;
  });
}

// ── Init ─────────────────────────────────────────────────────────────────────

function init() {
  loadData();

  // Restore saved windows or start with one empty window
  if (appData.windowStates?.length) {
    const maxId = appData.windowStates.reduce((m, w) => Math.max(m, parseInt(w.id) || 0), 0);
    nextId = maxId + 1;
    appData.windowStates.forEach(state => addWindow(state));
  } else {
    addWindow();
  }

  // Header: Add Window
  document.getElementById('btn-add-window').addEventListener('click', () => addWindow());

  // Header: Manage URLs
  document.getElementById('btn-manage-urls').addEventListener('click', () => {
    renderUrlList();
    document.getElementById('url-manager-modal').classList.add('active');
  });

  // URL modal: close button
  document.getElementById('btn-close-url-manager').addEventListener('click', () => {
    document.getElementById('url-manager-modal').classList.remove('active');
  });

  // URL modal: click backdrop to close
  document.getElementById('url-manager-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
  });

  // URL modal: add url button
  document.getElementById('btn-add-url').addEventListener('click', () => {
    const tag = document.getElementById('url-tag-input').value;
    const url = document.getElementById('url-url-input').value;
    if (!tag.trim() || !url.trim()) {
      alert('Please enter both a tag/label and a URL.');
      return;
    }
    if (addSavedUrl(tag, url)) {
      document.getElementById('url-tag-input').value = '';
      document.getElementById('url-url-input').value = '';
      document.getElementById('url-tag-input').focus();
    }
  });

  // URL modal: enter key in url input
  document.getElementById('url-url-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-add-url').click();
  });

  // Bulk add: toggle visibility
  document.getElementById('btn-bulk-toggle').addEventListener('click', () => {
    const body = document.getElementById('bulk-body');
    const btn  = document.getElementById('btn-bulk-toggle');
    const open = body.classList.toggle('open');
    btn.innerHTML = (open ? '&#9650;' : '&#9660;') + ' Bulk Add';
  });

  // Bulk add: add all button
  document.getElementById('btn-bulk-add').addEventListener('click', () => {
    const raw = document.getElementById('bulk-input').value;
    if (!raw.trim()) return;
    const { added, skipped } = bulkAddUrls(raw);
    const resultEl = document.getElementById('bulk-result');
    resultEl.textContent = added
      ? `Added ${added}${skipped ? `, skipped ${skipped}` : ''}`
      : 'Nothing to add.';
    resultEl.className = 'bulk-result ' + (added ? 'ok' : 'warn');
    if (added) document.getElementById('bulk-input').value = '';
    setTimeout(() => { resultEl.textContent = ''; resultEl.className = 'bulk-result'; }, 3000);
  });

  // Overlay: close button
  document.getElementById('btn-close-overlay').addEventListener('click', closeOverlay);

  // Overlay: click background to close
  document.getElementById('overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeOverlay();
  });

  // Escape key: close overlay or modal
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('overlay').classList.contains('active')) {
      closeOverlay();
    } else if (document.getElementById('url-manager-modal').classList.contains('active')) {
      document.getElementById('url-manager-modal').classList.remove('active');
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
