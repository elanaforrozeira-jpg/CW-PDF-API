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
                '--no-sandbox', '--disable-setuid-sandbox', '--single-process', 
                '--no-zygote', '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--proxy-server=Px031901.pointtoserver.com:10780'
            ]
        });

        const page = await browser.newPage();
        
        // Browser jaisa viewport
        await page.setViewport({ width: 1920, height: 1080 });

        await page.authenticate({ username: 'purevpn0s11340994', password: 'ak3t35fp' });
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
        await page.setExtraHTTPHeaders({ "Referer": "https://cwmediabkt99.crwilladmin.com/" });

        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 90000 });

        // Saare slides load karne ke liye scroll
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                let distance = 500;
                let timer = setInterval(() => {
                    let scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if(totalHeight >= scrollHeight){
                        clearInterval(timer);
                        window.scrollTo(0, 0);
                        resolve();
                    }
                }, 100);
            });
        });

        await new Promise(r => setTimeout(r, 3000));

        // PDF generate - browser default behavior use karenge
        const pdfBuffer = await page.pdf({ 
            printBackground: true,
            preferCSSPageSize: true, // Website ki CSS page size use karegi
            displayHeaderFooter: false,
            scale: 1.0,
            margin: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0
            }
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="notes.pdf"');
        res.send(pdfBuffer);

    } catch (e) {
        console.error('Error:', e);
        res.status(500).json({ status: "fail", error: e.message });
    } finally {
        if (browser) await browser.close();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PDF Engine Live on ${PORT}`));
