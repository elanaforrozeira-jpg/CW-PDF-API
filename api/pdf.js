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
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled', // Automation hide karne ke liye
                '--proxy-server=Px031901.pointtoserver.com:10780' // Aapki PureVPN Proxy
            ]
        });

        const page = await browser.newPage();

        // Proxy Auth
        await page.authenticate({
            username: 'purevpn0s11340994',
            password: 'ak3t35fp'
        });

        // Human behavior simulate karna taaki block na ho
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

        // Request interception taaki faltu ads load na hon aur memory bache
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if(['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Final attempt to load
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // PDF generate karne se pehle 2 sec ka wait (for extra safety)
        await new Promise(r => setTimeout(r, 2000));

        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdfBuffer);

    } catch (e) {
        console.error("Critical Error:", e.message);
        res.status(500).json({ status: "fail", error: e.message });
    } finally {
        if (browser) await browser.close();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Final Engine Live on ${PORT}`));
