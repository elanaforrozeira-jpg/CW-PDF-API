const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).json({ error: 'URL is required. Usage: /pdf?url=URL' });
    }

    // Aapki Browserless API Key yahan use ho rahi hai
    const BROWSERLESS_KEY = "2U40pteEEfgboGxc0c0a37611fd811886f47819d326726eaa";
    const endpoint = `https://production-sfo.browserless.io/pdf?token=${BROWSERLESS_KEY}`;

    console.log(`Sending request to Browserless for: ${targetUrl}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: decodeURIComponent(targetUrl),
        options: {
          format: 'A4',
          printBackground: true,
          margin: { top: '0.4in', right: '0.4in', bottom: '0.4in', left: '0.4in' }
        },
        gotoOptions: { 
          waitUntil: 'networkidle0',
          timeout: 30000 
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Browserless Error: ${response.status} - ${errorText}`);
    }

    const pdfBuffer = await response.buffer();
    
    // PDF Send karna
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.status(200).send(pdfBuffer);

  } catch (error) {
    console.error('API Error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Cloud Generation Failed', 
      message: error.message 
    });
  }
};
