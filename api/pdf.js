const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: 'URL missing' });

    const BROWSERLESS_KEY = "2U40pteEEfgboGxc0c0a37611fd811886f47819d326726eaa";
    // Is baar hum /content endpoint use karenge jo raw file download ke liye hota hai
    const endpoint = `https://production-sfo.browserless.io/download?token=${BROWSERLESS_KEY}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: decodeURIComponent(targetUrl),
        // Force download behavior
        headers: {
          "Referer": "https://cwmediabkt99.crwilladmin.com/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        }
      })
    });

    if (!response.ok) throw new Error(`Fetch Failed: ${response.status}`);

    const buffer = await response.buffer();
    
    // Browser ko PDF force karne ke liye headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="notes.pdf"');
    res.send(buffer);

  } catch (error) {
    res.status(500).json({ error: 'Bypass Failed', message: error.message });
  }
};
