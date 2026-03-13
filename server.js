const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Stockage en mémoire des snapshots de minuit
// { "groupId_cookie_hash": { date: "2026-03-13", pendingRobux: 140 } }
const midnightSnapshots = {};

function hashKey(id, type, cookie) {
  // Clé simple basée sur l'id et les 20 derniers caractères du cookie
  return `${type}_${id}_${cookie.slice(-20)}`;
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

const getRobloxHeaders = (cookie) => ({
  'Cookie': `.ROBLOSECURITY=${cookie}`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.roblox.com/',
  'Origin': 'https://www.roblox.com',
  'Accept': 'application/json',
});

async function fetchRevenueSummary(type, id, cookie) {
  const headers = getRobloxHeaders(cookie);
  const base = `https://apis.roblox.com/transaction-records/v1/${type}s/${id}/revenue/summary`;

  const [dayRes, monthRes] = await Promise.all([
    fetch(`${base}/day`, { headers }),
    fetch(`${base}/month`, { headers }),
  ]);

  const dayData = await dayRes.json();
  const monthData = await monthRes.json();

  return { dayData, monthData };
}

function calcDayRobux(dayData, snapshotPending) {
  const currentPending = dayData.pendingRobux ?? 0;
  const itemSale = dayData.itemSaleRobux ?? 0;
  // Si on a un snapshot, le vrai revenu du jour = différence de pending + ventes directes
  const pendingDiff = Math.max(0, currentPending - snapshotPending);
  return pendingDiff + itemSale;
}

// Route groupe
app.get('/group/:groupId/revenue', async (req, res) => {
  const cookie = req.headers['x-roblox-cookie'];
  const { groupId } = req.params;
  if (!cookie) return res.status(400).json({ error: 'Cookie manquant' });

  try {
    const { dayData, monthData } = await fetchRevenueSummary('group', groupId, cookie);

    if (dayData.errors || monthData.errors) {
      return res.status(400).json({ error: `Roblox API: ${JSON.stringify(dayData.errors || monthData.errors)}` });
    }

    const key = hashKey(groupId, 'group', cookie);
    const today = getTodayStr();

    // Si pas de snapshot pour aujourd'hui, on en crée un
    if (!midnightSnapshots[key] || midnightSnapshots[key].date !== today) {
      midnightSnapshots[key] = {
        date: today,
        pendingRobux: dayData.pendingRobux ?? 0,
      };
    }

    const snapshotPending = midnightSnapshots[key].pendingRobux;
    const dayRobux = calcDayRobux(dayData, snapshotPending);
    const monthRobux = (monthData.pendingRobux ?? 0) + (monthData.itemSaleRobux ?? 0);

    res.json({
      dayRobux,
      dayCount: 0,
      monthRobux,
      monthCount: 0,
      dayData,
      monthData,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Route joueur
app.get('/player/:userId/revenue', async (req, res) => {
  const cookie = req.headers['x-roblox-cookie'];
  const { userId } = req.params;
  if (!cookie) return res.status(400).json({ error: 'Cookie manquant' });

  try {
    const { dayData, monthData } = await fetchRevenueSummary('user', userId, cookie);

    if (dayData.errors || monthData.errors) {
      return res.status(400).json({ error: `Roblox API: ${JSON.stringify(dayData.errors || monthData.errors)}` });
    }

    const key = hashKey(userId, 'user', cookie);
    const today = getTodayStr();

    if (!midnightSnapshots[key] || midnightSnapshots[key].date !== today) {
      midnightSnapshots[key] = {
        date: today,
        pendingRobux: dayData.pendingRobux ?? 0,
      };
    }

    const snapshotPending = midnightSnapshots[key].pendingRobux;
    const dayRobux = calcDayRobux(dayData, snapshotPending);
    const monthRobux = (monthData.pendingRobux ?? 0) + (monthData.itemSaleRobux ?? 0);

    res.json({
      dayRobux,
      dayCount: 0,
      monthRobux,
      monthCount: 0,
      dayData,
      monthData,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Route pour réinitialiser le snapshot (à appeler à minuit)
app.post('/reset-snapshot', (req, res) => {
  const key = req.body.key;
  if (key && midnightSnapshots[key]) {
    delete midnightSnapshots[key];
  }
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
