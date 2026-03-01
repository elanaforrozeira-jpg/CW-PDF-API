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
        
        // standard PDF resolution set karna
        await page.setViewport({ width: 1280, height: 720 });

        await page.authenticate({ username: 'purevpn0s11340994', password: 'ak3t35fp' });
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
        await page.setExtraHTTPHeaders({ "Referer": "https://cwmediabkt99.crwilladmin.com/" });

        // URL par jana aur network shaant hone ka wait karna
        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 90000 });

        // CSS Inject karke "Screenshot" mode ko deactivate karna aur PDF pages force karna
        await page.addStyleTag({
            content: `
                @page { size: A4 landscape; margin: 0; }
                @media print {
                    canvas, img, .slide, div[class*="slide"] { 
                        page-break-after: always !important; 
                        break-after: page !important;
                        display: block !important;
                        width: 100% !important;
                        height: auto !important;
                    }
                    .no-print, #header, #footer, .sidebar { display: none !important; }
                }
            `
        });

        // Saare dynamic content (slides) load karne ke liye niche tak scroll
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
                        window.scrollTo(0,0); // Top par wapas aana zaroori hai
                        resolve();
                    }
                }, 100);
            });
        });

        // Buffering ke liye wait taaki PDF corrupt na ho
        await new Promise(r => setTimeout(r, 6000));

        // Asli PDF generate karna, Screenshot nahi!
        const pdfBuffer = await page.pdf({ 
            format: 'A4',
            landscape: true,
            printBackground: true,
            preferCSSPageSize: false,
            displayHeaderFooter: false
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="notes.pdf"');
        res.send(pdfBuffer);

    } catch (e) {
        res.status(500).json({ status: "fail", error: e.message });
    } finally {
        if (browser) await browser.close();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PDF Engine Live on ${PORT}`));
