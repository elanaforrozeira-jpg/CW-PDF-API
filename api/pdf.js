const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: 'URL required' });

    // Step 1: Link ko Google Drive Viewer ke andar wrap karna
    // Google ke servers file ko fetch karenge, isse bypass ho jayega
    const googleProxyUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(decodeURIComponent(targetUrl))}&embedded=true`;
    
    const BROWSERLESS_KEY = "2U40pteEEfgboGxc0c0a37611fd811886f47819d326726eaa";
    const endpoint = `https://production-sfo.browserless.io/pdf?token=${BROWSERLESS_KEY}&stealth`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: googleProxyUrl,
        options: {
          format: 'A4',
          printBackground: true,
          margin: { top: '0', right: '0', bottom: '0', left: '0' }
        },
        gotoOptions: { 
          waitUntil: 'networkidle2', // Google viewer load hone ka wait karega
          timeout: 50000 
        }
      })
    });

    if (!response.ok) throw new Error(`Google Proxy Blocked: ${response.status}`);

    const pdfBuffer = await response.buffer();
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);

  } catch (error) {
    res.status(500).json({ 
      error: 'Final Bypass Failed', 
      message: error.message,
      tip: "Try refreshing the original PDF link in your browser first."
    });
  }
};
