const express = require('express');
const puppeteer = require('puppeteer');
const app = express();

app.get('/pdf', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('URL missing');

    let browser;
    try {
        browser = await puppeteer.launch({
            executablePath: '/usr/bin/google-chrome-stable',
            headless: "new",
            // Memory bachane ke liye optimized flags
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Memory crash rokne ke liye
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process', // Free tier ke liye best
                '--disable-gpu',
                '--proxy-server=Px031901.pointtoserver.com:10780'
            ]
        });

        const page = await browser.newPage();
        
        // Proxy Auth
        await page.authenticate({
            username: 'purevpn0s11340994',
            password: 'ak3t35fp'
        });

        // Basic Stealth
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
        await page.setExtraHTTPHeaders({ "Referer": "https://cwmediabkt99.crwilladmin.com/" });

        // Networkidle0 ke bajaye load use karein memory bachane ke liye
        await page.goto(decodeURIComponent(targetUrl), { waitUntil: 'load', timeout: 60000 });
        
        const pdf = await page.pdf({ format: 'A4', printBackground: true });
        res.contentType("application/pdf");
        res.send(pdf);

    } catch (e) {
        res.status(500).send("Error: " + e.message);
    } finally {
        if (browser) await browser.close();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Live on ${PORT}`));
