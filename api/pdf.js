const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: 'URL required' });

    const BROWSERLESS_KEY = "2U40pteEEfgboGxc0c0a37611fd811886f47819d326726eaa";
    const endpoint = `https://production-sfo.browserless.io/pdf?token=${BROWSERLESS_KEY}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: decodeURIComponent(targetUrl),
        options: {
          format: 'A4',
          printBackground: true
        },
        gotoOptions: { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        },
        // YE FIX HAI: Custom headers add kiye hain authorized dikhne ke liye
        setExtraHTTPHeaders: {
          "Referer": "https://cwmediabkt99.crwilladmin.com/",
          "Origin": "https://cwmediabkt99.crwilladmin.com/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      })
    });

    if (!response.ok) throw new Error(`Browserless Error: ${response.status}`);

    const pdfBuffer = await response.buffer();
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);

  } catch (error) {
    res.status(500).json({ error: 'Auth failed on target site', message: error.message });
  }
};
