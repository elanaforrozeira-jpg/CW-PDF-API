const express = require('express');
const puppeteer = require('puppeteer-core');
const app = express();

app.get('/pdf', async (req, res) => {
    const rawUrl = req.query.url;
    
    if (!rawUrl) {
        return res.status(400).json({ 
            status: "fail", 
            message: "URL parameter missing" 
        });
    }
    
    const targetUrl = decodeURIComponent(rawUrl).trim();
    let browser;

    try {
        console.log('🚀 Starting PDF download for:', targetUrl);

        browser = await puppeteer.launch({
            executablePath: '/usr/bin/google-chrome-stable',
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--single-process',
                '--no-zygote',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--proxy-server=Px031901.pointtoserver.com:10780'
            ],
            ignoreDefaultArgs: ['--enable-automation']
        });

        const page = await browser.newPage();
        
        await page.authenticate({ 
            username: 'purevpn0s11340994', 
            password: 'ak3t35fp' 
        });

        await page.setViewport({ 
            width: 1920, 
            height: 1080
        });

        // Stealth
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            window.chrome = { runtime: {} };
        });

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        );
        
        await page.setExtraHTTPHeaders({ 
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://cwmediabkt99.crwilladmin.com/"
        });

        console.log('🌐 Loading page...');
        
        await page.goto(targetUrl, { 
            waitUntil: 'networkidle2', 
            timeout: 120000 
        });

        console.log('⏳ Waiting for content...');
        await page.waitForTimeout(15000);

        console.log('📄 Rendering page as PDF...');
        
        // Directly print the page as PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            landscape: true,
            printBackground: true,
            preferCSSPageSize: false,
            displayHeaderFooter: false,
            margin: { top: 0, right: 0, bottom: 0, left: 0 }
        });

        console.log('✅ PDF generated, size:', pdfBuffer.length, 'bytes');

        if (pdfBuffer.length < 1000) {
            throw new Error('Generated PDF is too small');
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader('Content-Disposition', 'attachment; filename="lecture-notes.pdf"');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(pdfBuffer);

        console.log('✅ PDF sent successfully!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({ 
            status: "fail", 
            error: error.message
        });
    } finally {
        if (browser) await browser.close();
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ PDF API running on ${PORT}`));
