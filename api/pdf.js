const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: 'URL is required' });

    const BROWSERLESS_KEY = "2U40pteEEfgboGxc0c0a37611fd811886f47819d326726eaa";
    
    // Stealth mode enable karne ke liye query param joda hai
    const endpoint = `https://production-sfo.browserless.io/pdf?token=${BROWSERLESS_KEY}&stealth`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: decodeURIComponent(targetUrl),
        options: {
          format: 'A4',
          printBackground: true
        },
        // CW Media security bypass headers
        setExtraHTTPHeaders: {
          "Referer": "https://cwmediabkt99.crwilladmin.com/",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        },
        gotoOptions: { 
          waitUntil: 'load', // S3 links ke liye 'load' faster aur stable hota hai
          timeout: 45000 
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Site Blocked Access (Status: ${response.status})`);
    }

    const pdfBuffer = await response.buffer();
    
    // Headers for PDF display
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="class-notes.pdf"');
    res.send(pdfBuffer);

  } catch (error) {
    res.status(500).json({ 
      error: 'Bypass Failed', 
      message: error.message,
      note: "If this persists, the link might have expired or requires a session cookie."
    });
  }
};
