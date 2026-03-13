const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const getRobloxHeaders = (cookie) => ({
  'Cookie': `.ROBLOSECURITY=${cookie}`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.roblox.com/',
  'Origin': 'https://www.roblox.com',
  'Accept': 'application/json',
});

// Récupère toutes les transactions d'un groupe (jusqu'à 100)
async function fetchGroupTransactions(groupId, cookie) {
  const url = `https://economy.roblox.com/v1/groups/${groupId}/transactions?transactionType=Sale&limit=100`;
  const res = await fetch(url, { headers: getRobloxHeaders(cookie) });
  const data = await res.json();
  return data;
}

// Récupère toutes les transactions d'un joueur
async function fetchPlayerTransactions(userId, cookie) {
  const url = `https://economy.roblox.com/v1/users/${userId}/transactions?transactionType=Sale&limit=100`;
  const res = await fetch(url, { headers: getRobloxHeaders(cookie) });
  const data = await res.json();
  return data;
}

// Calcule les revenus du jour et du mois depuis une liste de transactions
function calcRevenue(transactions) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let dayRobux = 0;
  let dayCount = 0;
  let monthRobux = 0;
  let monthCount = 0;

  for (const tx of transactions) {
    const amount = tx.currency?.amount ?? 0;
    const created = tx.created ?? '';
    if (created.startsWith(todayStr)) {
      dayRobux += amount;
      dayCount++;
    }
    if (created.startsWith(monthStr)) {
      monthRobux += amount;
      monthCount++;
    }
  }

  return { dayRobux, dayCount, monthRobux, monthCount };
}

// Route groupe
app.get('/group/:groupId/revenue', async (req, res) => {
  const cookie = req.headers['x-roblox-cookie'];
  const { groupId } = req.params;

  if (!cookie) return res.status(400).json({ error: 'Cookie manquant' });

  try {
    const txData = await fetchGroupTransactions(groupId, cookie);
    const transactions = txData.data ?? [];
    const { dayRobux, dayCount, monthRobux, monthCount } = calcRevenue(transactions);

    res.json({
      dayRobux,
      dayCount,
      monthRobux,
      monthCount,
      transactions,
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
    const txData = await fetchPlayerTransactions(userId, cookie);
    const transactions = txData.data ?? [];
    const { dayRobux, dayCount, monthRobux, monthCount } = calcRevenue(transactions);

    res.json({
      dayRobux,
      dayCount,
      monthRobux,
      monthCount,
      transactions,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
