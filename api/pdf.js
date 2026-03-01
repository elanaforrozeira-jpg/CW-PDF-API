const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: 'URL missing' });

    const BROWSERLESS_KEY = "2U40pteEEfgboGxc0c0a37611fd811886f47819d326726eaa";
    
    // Yahan hum /pdf use karenge par extra query params ke saath
    const endpoint = `https://production-sfo.browserless.io/pdf?token=${BROWSERLESS_KEY}&stealth=true&--disable-web-security=true`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: decodeURIComponent(targetUrl),
        options: {
          format: 'A4',
          printBackground: true
        },
        // CW Media Auth Bypass Headers
        setExtraHTTPHeaders: {
          "Referer": "https://cwmediabkt99.crwilladmin.com/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9"
        },
        gotoOptions: { 
          waitUntil: 'networkidle2', 
          timeout: 60000 
        }
      })
    });

    if (!response.ok) {
        const errorMsg = await response.text();
        throw new Error(`Browserless Error: ${response.status} - ${errorMsg}`);
    }

    const buffer = await response.buffer();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="notes.pdf"');
    res.send(buffer);

  } catch (error) {
    res.status(500).json({ 
        error: 'Final Attempt Failed', 
        message: error.message 
    });
  }
};
