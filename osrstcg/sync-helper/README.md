# OSRS TCG Locked Tracker — sync helper (optional)

This is a small local program you can run to give the
[webapp](https://martys-space.github.io/osrstcg/) true background auto-sync
with your RuneLite OSRS-TCG save, instead of manually picking your backups
folder every time you want to re-import.

**You don't need this.** The webapp works fine without it — "Import your
account" in the Profile tab still works exactly as before. This is purely
for people who want their card collection to stay in sync automatically
while they play.

## What it actually does

- Watches your `.runelite/OSRS-TCG/backups` folder on your own machine.
- Runs a tiny web server on `http://127.0.0.1:51823` (localhost only — not
  reachable from any other device on your network, or the internet).
- When the webapp tab asks it for your accounts, it reads the save file(s)
  straight off disk and hands back the raw, still-encoded file contents.
- **It never decodes your save, computes anything from it, or sends it
  anywhere.** All of that (same as today) happens in your browser, from
  `osrstcg/app/src/lib/tcgSave.js` — this helper is just a "read this folder
  for me" bridge so the browser doesn't need permission-prompt access to
  your filesystem every session.
- Only responds to requests whose origin is the deployed webapp (or a local
  dev copy of it) — see the `ALLOWED_ORIGINS` list at the top of
  `server.js`. A random other website you have open can't read your save
  through it.

## Running it

**Easiest: `OSRS-TCG-Sync-Helper.exe`.** Download it from the webapp's
Profile tab (Auto-Sync button) and double-click it — that's it, nothing to
install. It's a self-contained Windows program built directly from
`server.js` via Node's own "single executable application" packaging, so it
doesn't need Node installed on your PC.

A console window opens and stays open while it's running — that's normal,
leave it be. Close the window (or hit Ctrl+C) to stop it.

Since it's unsigned (no paid code-signing certificate for a small indie
tool), Windows SmartScreen will likely warn about an "unrecognized
publisher" the first time you run it. That's expected — click **More info**
→ **Run anyway** if you're comfortable, or see the source-only option below
if you'd rather not run an unsigned .exe at all.

**Prefer to run it from source instead?** It's a single plain, readable
file with zero dependencies — read `server.js` yourself, then, with
[Node.js](https://nodejs.org) 18+ installed:

```
node server.js
```

or double-click `run.bat` on Windows. If your backups folder isn't in the
default location, pass it explicitly:

```
node server.js "D:\some\other\path\backups"
```

or set `TCG_BACKUPS_DIR` / `TCG_SYNC_PORT` environment variables if you'd
rather not pass CLI args.

### Rebuilding the .exe

The .exe is just `node.exe` with `server.js` baked in via Node's
[Single Executable Applications](https://nodejs.org/api/single-executable-applications.html)
feature — regenerate it after editing `server.js` with:

```
node --experimental-sea-config sea-config.json
copy "%ProgramFiles%\nodejs\node.exe" OSRS-TCG-Sync-Helper.exe
npx postject OSRS-TCG-Sync-Helper.exe NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
```

## Using it

With the helper running, open the webapp's **Profile** tab — it checks for
the helper automatically and, once found, keeps your import up to date in
the background for as long as both the helper and the webapp tab stay open.
If you have more than one RuneLite account backed up, it'll ask you once
which one to keep syncing.

## Auto-starting it

The helper doesn't install itself as a background service — that's
deliberate, so it's obvious when it is and isn't running. If you want it
running automatically whenever you're at your PC, the simplest way on
Windows is to put a shortcut to `OSRS-TCG-Sync-Helper.exe` (or `run.bat`) in
your Startup folder (`Win+R` → `shell:startup`).
