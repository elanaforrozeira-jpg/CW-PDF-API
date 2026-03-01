const express = require('express');
const puppeteer = require('puppeteer-core');
const app = express();

// Lazy-loading bypass ke liye advanced auto-scroll
async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            let distance = 200; // Thoda fast scroll taaki timeout na ho
            let timer = setInterval(() => {
                let scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    // Wapas upar jana zaroori hai printing ke liye
                    window.scrollTo(0, 0);
                    resolve();
                }
            }, 150);
        });
    });
}

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
        
        // Desktop view set karna taaki slides proper dikhen
        await page.setViewport({ width: 1280, height: 800 });

        await page.authenticate({ username: 'purevpn0s11340994', password: 'ak3t35fp' });
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
        
        await page.setExtraHTTPHeaders({ 
            "Referer": "https://cwmediabkt99.crwilladmin.com/",
            "Accept-Language": "en-US,en;q=0.9"
        });

        // Networkidle0 ka wait taaki saare heavy assets load hon
        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 90000 });

        // Check for common errors before processing
        const content = await page.content();
        if (content.includes("AccessDenied")) { //
            return res.status(403).json({ status: "fail", error: "Token Expired. Refresh link." });
        }
        if (content.includes("not authorized")) { //
            return res.status(401).json({ status: "fail", error: "Proxy/Auth Blocked." });
        }

        // Saare pages load karne ke liye scroll
        await autoScroll(page);
        
        // Final rendering ke liye 3 sec ka wait
        await new Promise(r => setTimeout(r, 3000));

        // PDF Generation with A4 paging logic
        const pdfBuffer = await page.pdf({ 
            format: 'A4',
            printBackground: true,
            margin: { top: '10px', right: '10px', bottom: '10px', left: '10px' },
            displayHeaderFooter: false,
            preferCSSPageSize: false, // Force browser to break pages
            scale: 0.8 // Slides ko page par fit karne ke liye thoda scale down
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdfBuffer);

    } catch (e) {
        console.error("Render Error:", e.message);
        res.status(500).json({ status: "fail", error: e.message });
    } finally {
        if (browser) await browser.close();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
