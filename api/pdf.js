const express = require('express');
const puppeteer = require('puppeteer-core');
const app = express();

app.get('/pdf', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('URL missing');

    let browser;
    try {
        browser = await puppeteer.launch({
            executablePath: '/usr/bin/google-chrome-stable',
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--single-process', '--no-zygote']
        });

        const page = await browser.newPage();
        
        // Browser jaisa dikhne ke liye user agent
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

        // CW Media bypass headers
        await page.setExtraHTTPHeaders({
            "Referer": "https://cwmediabkt99.crwilladmin.com/",
            "Accept-Language": "en-US,en;q=0.9"
        });

        // Load hone ka wait karein
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
