const express = require('express');
const puppeteer = require('puppeteer-core');
const app = express();

app.get('/pdf', async (req, res) => {
    const rawUrl = req.query.url;
    if (!rawUrl) return res.status(400).json({ status: "fail", message: "URL missing" });

    const targetUrl = decodeURIComponent(rawUrl).trim();
    let browser;

    try {
        browser = await puppeteer.launch({
            executablePath: '/usr/bin/google-chrome-stable',
            headless: "new",
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--single-process', 
                '--no-zygote',
                '--disable-blink-features=AutomationControlled' // Sabse zaroori stealth flag
            ]
        });

        const page = await browser.newPage();

        // Browser fingerprint hide karna
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

        // "Unauthorized" bypass karne ke liye headers
        await page.setExtraHTTPHeaders({
            "Referer": "https://cwmediabkt99.crwilladmin.com/",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1"
        });

        // Timeout badha diya hai Render free tier ke liye
        const response = await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 90000 });

        const content = await page.content();
        if (content.includes("not authorized") || content.includes("Unauthorized")) {
            throw new Error("Bypass failed: Still getting Unauthorized error");
        }

        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });

        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdfBuffer);

    } catch (e) {
        console.error(e.message);
        res.status(500).json({ status: "fail", error: e.message });
    } finally {
        if (browser) await browser.close();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bypass Engine Live on ${PORT}`));
