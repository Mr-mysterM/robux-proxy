const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Récupère le token CSRF depuis Roblox
async function getCsrfToken(cookie) {
  const res = await fetch('https://auth.roblox.com/v2/logout', {
    method: 'POST',
    headers: {
      'Cookie': `.ROBLOSECURITY=${cookie}`,
      'Content-Length': '0',
    }
  });
  return res.headers.get('x-csrf-token') || '';
}

const getRobloxHeaders = (cookie, csrfToken) => ({
  'Cookie': `.ROBLOSECURITY=${cookie}`,
  'x-csrf-token': csrfToken,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.roblox.com/',
  'Origin': 'https://www.roblox.com',
  'Accept': 'application/json',
});

function calcRevenue(transactions) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let dayRobux = 0, dayCount = 0, monthRobux = 0, monthCount = 0;

  for (const tx of transactions) {
    const amount = tx.currency?.amount ?? 0;
    const created = tx.created ?? '';
    if (created.startsWith(todayStr)) { dayRobux += amount; dayCount++; }
    if (created.startsWith(monthStr)) { monthRobux += amount; monthCount++; }
  }

  return { dayRobux, dayCount, monthRobux, monthCount };
}

// Route groupe
app.get('/group/:groupId/revenue', async (req, res) => {
  const cookie = req.headers['x-roblox-cookie'];
  const { groupId } = req.params;
  if (!cookie) return res.status(400).json({ error: 'Cookie manquant' });

  try {
    const csrfToken = await getCsrfToken(cookie);
    const headers = getRobloxHeaders(cookie, csrfToken);

    const txRes = await fetch(
      `https://economy.roblox.com/v1/groups/${groupId}/transactions?transactionType=Sale&limit=100`,
      { headers }
    );
    const txData = await txRes.json();

    if (txData.errors) {
      return res.status(400).json({ error: `Roblox API: ${JSON.stringify(txData.errors)}` });
    }

    const transactions = txData.data ?? [];
    const revenue = calcRevenue(transactions);
    res.json({ ...revenue, transactions });
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
    const csrfToken = await getCsrfToken(cookie);
    const headers = getRobloxHeaders(cookie, csrfToken);

    const txRes = await fetch(
      `https://economy.roblox.com/v1/users/${userId}/transactions?transactionType=Sale&limit=100`,
      { headers }
    );
    const txData = await txRes.json();

    if (txData.errors) {
      return res.status(400).json({ error: `Roblox API: ${JSON.stringify(txData.errors)}` });
    }

    const transactions = txData.data ?? [];
    const revenue = calcRevenue(transactions);
    res.json({ ...revenue, transactions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
