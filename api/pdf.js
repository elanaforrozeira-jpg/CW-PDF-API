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
        
        // Desktop view set karna slides ke liye
        await page.setViewport({ width: 1600, height: 900 });

        await page.authenticate({ username: 'purevpn0s11340994', password: 'ak3t35fp' });
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
        await page.setExtraHTTPHeaders({ "Referer": "https://cwmediabkt99.crwilladmin.com/" });

        // Go to URL and wait for scripts to run
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 90000 });

        // YAHAN MAGIC HAI: Saari slides ko alag-alag pages par force karna
        await page.addStyleTag({
            content: `
                @media print {
                    div[class*="slide"], .slide, img, canvas { 
                        page-break-after: always !important; 
                        display: block !important;
                        position: relative !important;
                        break-after: page !important;
                    }
                    body, html { height: auto !important; }
                }
            `
        });

        // Niche tak scroll taaki saare 28 pages load ho jayein
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                let distance = 400;
                let timer = setInterval(() => {
                    let scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if(totalHeight >= scrollHeight){
                        clearInterval(timer);
                        window.scrollTo(0,0);
                        resolve();
                    }
                }, 100);
            });
        });

        // Extra wait taaki images render ho jayein
        await new Promise(r => setTimeout(r, 5000));

        // PDF generate karna A4 landscape format mein
        const pdfBuffer = await page.pdf({ 
            format: 'A4',
            landscape: true,
            printBackground: true,
            preferCSSPageSize: false,
            margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdfBuffer);

    } catch (e) {
        res.status(500).json({ status: "fail", error: e.message });
    } finally {
        if (browser) await browser.close();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Multi-page Engine Live on ${PORT}`));
