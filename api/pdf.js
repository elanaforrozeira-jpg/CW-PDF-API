const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    let browser = null;
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'URL required' });

        browser = await puppeteer.launch({
            args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        await page.goto(decodeURIComponent(url), { waitUntil: 'networkidle0', timeout: 60000 });

        const buffer = await page.pdf({ format: 'A4', printBackground: true });

        res.setHeader('Content-Type', 'application/pdf');
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ error: 'Error', message: error.message });
    } finally {
        if (browser) await browser.close();
    }
};
