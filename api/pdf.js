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

        const targetUrl = decodeURIComponent(url);

        browser = await puppeteer.launch({
            args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36');

        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 60000 });

        const buffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0.4in', right: '0.4in', bottom: '0.4in', left: '0.4in' }
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ error: 'Generation Failed', message: error.message });
    } finally {
        if (browser) await browser.close();
    }
};
