const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  let browser = null;
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: 'URL required' });
    
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });
    
    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    
    const buffer = await page.pdf({ format: 'A4' });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (browser) await browser.close();
  }
};
