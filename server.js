const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const midnightSnapshots = {};

function hashKey(id, type, cookie) {
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

// Route groupe
app.get('/group/:groupId/revenue', async (req, res) => {
  const cookie = req.headers['x-roblox-cookie'];
  const { groupId } = req.params;
  if (!cookie) return res.status(400).json({ error: 'Cookie manquant' });

  try {
    const headers = getRobloxHeaders(cookie);
    const base = `https://apis.roblox.com/transaction-records/v1/groups/${groupId}/revenue/summary`;

    const [dayRes, monthRes] = await Promise.all([
      fetch(`${base}/day`, { headers }),
      fetch(`${base}/month`, { headers }),
    ]);

    const dayData = await dayRes.json();
    const monthData = await monthRes.json();

    if (dayData.errors || monthData.errors) {
      return res.status(400).json({ error: `Roblox API: ${JSON.stringify(dayData.errors || monthData.errors)}` });
    }

    const key = hashKey(groupId, 'group', cookie);
    const today = getTodayStr();

    if (!midnightSnapshots[key] || midnightSnapshots[key].date !== today) {
      midnightSnapshots[key] = { date: today, pendingRobux: dayData.pendingRobux ?? 0 };
    }

    const snapshotPending = midnightSnapshots[key].pendingRobux;
    const currentPending = dayData.pendingRobux ?? 0;
    const dayRobux = Math.max(0, currentPending - snapshotPending) + (dayData.itemSaleRobux ?? 0);
    const monthRobux = (monthData.pendingRobux ?? 0) + (monthData.itemSaleRobux ?? 0);

    res.json({ dayRobux, dayCount: 0, monthRobux, monthCount: 0 });
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
    const headers = getRobloxHeaders(cookie);

    const [dayRes, monthRes] = await Promise.all([
      fetch(`https://apis.roblox.com/transaction-records/v1/users/${userId}/transaction-totals?timeFrame=Day&transactionType=summary`, { headers }),
      fetch(`https://apis.roblox.com/transaction-records/v1/users/${userId}/transaction-totals?timeFrame=Month&transactionType=summary`, { headers }),
    ]);

    const dayData = await dayRes.json();
    const monthData = await monthRes.json();

    if (dayData.errors || monthData.errors) {
      return res.status(400).json({ error: `Roblox API: ${JSON.stringify(dayData.errors || monthData.errors)}` });
    }

    const key = hashKey(userId, 'user', cookie);
    const today = getTodayStr();

    if (!midnightSnapshots[key] || midnightSnapshots[key].date !== today) {
      midnightSnapshots[key] = { date: today, salesTotal: dayData.salesTotal ?? 0 };
    }

    const snapshotSales = midnightSnapshots[key].salesTotal ?? 0;
    const currentSales = dayData.salesTotal ?? 0;
    const dayRobux = Math.max(0, currentSales - snapshotSales);
    const monthRobux = monthData.salesTotal ?? 0;

    res.json({ dayRobux, dayCount: 0, monthRobux, monthCount: 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
