const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const ROBLOX_HEADERS = (cookie) => ({
  'Cookie': `.ROBLOSECURITY=${cookie}`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Referer': 'https://www.roblox.com/',
  'Origin': 'https://www.roblox.com',
});

app.get('/group/:groupId/revenue', async (req, res) => {
  const { groupId } = req.params;
  const cookie = req.headers['x-roblox-cookie'];
  if (!cookie) return res.status(401).json({ error: 'Cookie manquant' });

  try {
    const [dayRes, monthRes, txRes] = await Promise.all([
      fetch(`https://economy.roblox.com/v2/groups/${groupId}/revenue/summary/Day`, { headers: ROBLOX_HEADERS(cookie) }),
      fetch(`https://economy.roblox.com/v2/groups/${groupId}/revenue/summary/Month`, { headers: ROBLOX_HEADERS(cookie) }),
      fetch(`https://economy.roblox.com/v2/groups/${groupId}/transactions?transactionType=Sale&limit=100`, { headers: ROBLOX_HEADERS(cookie) }),
    ]);
    const dayData = await dayRes.json();
    const monthData = await monthRes.json();
    const txData = await txRes.json();
    res.json({ dayData, monthData, txData });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/player/:userId/revenue', async (req, res) => {
  const { userId } = req.params;
  const cookie = req.headers['x-roblox-cookie'];
  if (!cookie) return res.status(401).json({ error: 'Cookie manquant' });

  try {
    const [dayRes, monthRes] = await Promise.all([
      fetch(`https://economy.roblox.com/v2/users/${userId}/transaction-totals?timeFrame=Day&transactionType=Sale`, { headers: ROBLOX_HEADERS(cookie) }),
      fetch(`https://economy.roblox.com/v2/users/${userId}/transaction-totals?timeFrame=Month&transactionType=Sale`, { headers: ROBLOX_HEADERS(cookie) }),
    ]);
    const dayData = await dayRes.json();
    const monthData = await monthRes.json();
    res.json({ dayData, monthData });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));