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
          printBackground: true,
          displayHeaderFooter: false
        },
        gotoOptions: { 
          // 'load' use kar rahe hain taaki agar network idle na ho tab bhi PDF ban jaye
          waitUntil: 'load', 
          timeout: 45000 
        },
        // Real Browser behavior mimic karne ke liye
        setExtraHTTPHeaders: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "application/pdf,application/xhtml+xml,text/html;q=0.9",
          "Referer": "https://cwmediabkt99.crwilladmin.com/",
          "Accept-Language": "en-US,en;q=0.9"
        }
      })
    });

    if (!response.ok) {
       const status = response.status;
       throw new Error(`Site blocked request with status: ${status}`);
    }

    const pdfBuffer = await response.buffer();
    
    // Response send karna
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="class-notes.pdf"');
    res.send(pdfBuffer);

  } catch (error) {
    res.status(500).json({ 
      error: 'Bypass Failed', 
      message: error.message,
      tip: "Check if the PDF link is still active." 
    });
  }
};
