#!/usr/bin/env node
// OSRS TCG Locked Tracker — local sync helper.
//
// A tiny, dependency-free local server that watches your RuneLite OSRS-TCG
// backups folder and serves the raw save file contents over localhost, so
// the webapp can auto-sync in the background instead of needing you to
// manually pick the folder every time. It never decodes, interprets, or
// sends your save data anywhere except to the webapp tab you have open —
// see the README in this folder for exactly what it does and doesn't do.
//
// Run it with:  node server.js
// (or just double-click OSRS-TCG-Sync-Helper.exe / run.bat on Windows)

const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

// Only these origins are allowed to read your save data from this server —
// keeps a random website you happen to have open in another tab from being
// able to silently fetch it just because the port is open on your machine.
// Add your own dev origin here if you're running the app locally.
const ALLOWED_ORIGINS = new Set([
  'https://martys-space.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
])

const BACKUPS_DIR =
  process.env.TCG_BACKUPS_DIR || process.argv[2] || path.join(os.homedir(), '.runelite', 'OSRS-TCG', 'backups')
const PORT = Number(process.env.TCG_SYNC_PORT || process.argv[3] || 51823)
const HOST = '127.0.0.1' // never bind 0.0.0.0 — this should only ever be reachable from this machine

function findAccounts() {
  const results = []
  let entries
  try {
    entries = fs.readdirSync(BACKUPS_DIR, { withFileTypes: true })
  } catch (err) {
    throw new Error(`Can't read backups folder "${BACKUPS_DIR}": ${err.message}`)
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const savePath = path.join(BACKUPS_DIR, entry.name, 'tcg.save')
    try {
      const stat = fs.statSync(savePath)
      const rawText = fs.readFileSync(savePath, 'utf8')
      results.push({ folderName: entry.name, mtimeMs: stat.mtimeMs, rawText })
    } catch {
      // No tcg.save in this subfolder, or it's unreadable — skip it, same as
      // the browser-side folder scan does.
    }
  }
  return results
}

function withCors(req, res) {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data) })
  res.end(data)
}

const server = http.createServer((req, res) => {
  withCors(req, res)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'method not allowed' })
    return
  }

  const url = new URL(req.url, `http://${req.headers.host}`)

  if (url.pathname === '/health') {
    try {
      const accounts = findAccounts()
      sendJson(res, 200, { ok: true, watching: BACKUPS_DIR, accounts: accounts.length })
    } catch (err) {
      sendJson(res, 200, { ok: true, watching: BACKUPS_DIR, error: err.message })
    }
    return
  }

  if (url.pathname === '/accounts') {
    try {
      sendJson(res, 200, findAccounts())
    } catch (err) {
      sendJson(res, 500, { error: err.message })
    }
    return
  }

  sendJson(res, 404, { error: 'not found' })
})

server.listen(PORT, HOST, () => {
  console.log('OSRS TCG Locked Tracker — sync helper')
  console.log(`  Watching: ${BACKUPS_DIR}`)
  console.log(`  Listening on http://${HOST}:${PORT} (only reachable from this machine)`)
  console.log('  Leave this window open while you want auto-sync to work. Ctrl+C to stop.')
  try {
    const accounts = findAccounts()
    console.log(`  Found ${accounts.length} account(s): ${accounts.map((a) => a.folderName).join(', ') || '(none yet)'}`)
  } catch (err) {
    console.log(`  Warning: ${err.message}`)
    console.log('  Double-check the folder path above, or pass it as: node server.js "C:\\path\\to\\backups"')
  }
})

// Purely informational — /accounts always re-reads from disk on request, so
// nothing depends on this catching every change, but it's reassuring to see
// the helper notice a new pack opened without having to poll it yourself.
try {
  fs.watch(BACKUPS_DIR, { recursive: true }, (eventType, filename) => {
    if (filename && filename.endsWith('tcg.save')) {
      console.log(`  [change detected] ${filename}`)
    }
  })
} catch {
  // fs.watch with recursive:true isn't supported on every platform — the
  // server still works fine via plain polling from the webapp either way.
}
