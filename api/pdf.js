const fetch = require('node-fetch');
const HttpsProxyAgent = require('https-proxy-agent');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: 'URL missing' });

    // Aapki Proxy Details
    const proxyUrl = 'http://purevpn0s11340994:ak3t35fp@Px031901.pointtoserver.com:10780';
    const agent = new HttpsProxyAgent(proxyUrl);

    console.log(`Fetching via Proxy: ${targetUrl}`);

    const response = await fetch(decodeURIComponent(targetUrl), {
      method: 'GET',
      agent: agent, // Proxy agent yahan use ho raha hai
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Referer": "https://cwmediabkt99.crwilladmin.com/",
        "Accept": "application/pdf,*/*",
        "Connection": "keep-alive"
      },
      timeout: 45000
    });

    if (!response.ok) {
        throw new Error(`Site blocked proxy with status: ${response.status}`);
    }

    const buffer = await response.buffer();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="secured-notes.pdf"');
    res.send(buffer);

  } catch (error) {
    res.status(500).json({ 
        error: 'Proxy Bypass Failed', 
        message: error.message 
    });
  }
};
