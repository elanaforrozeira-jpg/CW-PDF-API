const express = require('express');
const puppeteer = require('puppeteer-core');
const app = express();

app.get('/pdf', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('URL missing');

    let browser;
    try {
        browser = await puppeteer.launch({
            // Docker image mein Chrome yahan hota hai
            executablePath: '/usr/bin/google-chrome-stable',
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', 
                '--single-process', // Memory bachane ke liye sabse zaroori
                '--no-zygote',
                '--proxy-server=Px031901.pointtoserver.com:10780'
            ]
        });

        const page = await browser.newPage();
        await page.authenticate({ username: 'purevpn0s11340994', password: 'ak3t35fp' });
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
        await page.setExtraHTTPHeaders({ "Referer": "https://cwmediabkt99.crwilladmin.com/" });

        // load use karein networkidle2 ke bajaye memory kam lagti hai
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
app.listen(PORT, () => console.log(`App live on ${PORT}`));
