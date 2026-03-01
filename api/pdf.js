const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const app = express();

puppeteer.use(StealthPlugin());

app.get('/pdf', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('URL missing');

    let browser;
    try {
        browser = await puppeteer.launch({
            executablePath: '/usr/bin/google-chrome-stable', // Docker environment ke liye
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--proxy-server=Px031901.pointtoserver.com:10780'
            ]
        });

        const page = await browser.newPage();
        
        // Proxy Authentication
        await page.authenticate({
            username: 'purevpn0s11340994',
            password: 'ak3t35fp'
        });

        // Stealth Headers taaki site block na kare
        await page.setExtraHTTPHeaders({
            "Referer": "https://cwmediabkt99.crwilladmin.com/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        });

        // URL par jana
        await page.goto(decodeURIComponent(targetUrl), { 
            waitUntil: 'networkidle2', 
            timeout: 60000 
        });
        
        const pdf = await page.pdf({ format: 'A4', printBackground: true });
        
        res.contentType("application/pdf");
        res.send(pdf);

    } catch (e) {
        console.error(e);
        res.status(500).send("Error: " + e.message);
    } finally {
        if (browser) await browser.close();
    }
});

// Render dynamic port use karta hai
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
