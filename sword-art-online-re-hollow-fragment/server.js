const express = require('express');
const https = require('https');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Load config (API key stays server-side, never sent to browser)
let config = { steamApiKey: '', steamId: '' };
const configPath = path.join(__dirname, 'config.json');
if (fs.existsSync(configPath)) {
  try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); }
  catch (e) { console.warn('Could not parse config.json:', e.message); }
}

app.use(express.static(path.join(__dirname, 'docs')));
app.use(express.json());

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON from Steam API')); }
      });
    }).on('error', reject);
  });
}

// Return the configured Steam ID to the frontend (not the API key)
app.get('/api/steam/config', (req, res) => {
  res.json({ steamId: config.steamId, configured: !!config.steamApiKey });
});

// Sync achievements — API key used server-side only
app.get('/api/steam/sync', async (req, res) => {
  const apiKey = config.steamApiKey;
  // Allow frontend to override Steam ID (e.g. look up a friend), but default to config
  const steamId = req.query.steamId || config.steamId;

  if (!apiKey) return res.status(400).json({ error: 'No Steam API key configured in config.json' });
  if (!steamId) return res.status(400).json({ error: 'No Steam ID configured' });

  try {
    const [schema, playerStats] = await Promise.all([
      fetchJson(`https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${apiKey}&appid=638650`),
      fetchJson(`https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?key=${apiKey}&steamid=${steamId}&appid=638650`)
    ]);
    res.json({ schema, playerStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`SAO Tracker running at http://localhost:${PORT}`);
  if (config.steamApiKey) console.log('Steam API key loaded from config.json.');
  else console.log('No Steam API key found in config.json — manual achievement tracking only.');
});
