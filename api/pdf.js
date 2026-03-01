const express = require('express');
const puppeteer = require('puppeteer-core');
const app = express();

app.use(express.json());

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
        console.log('🚀 Starting PDF generation for:', targetUrl);

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
                '--disable-features=IsolateOrigins,site-per-process',
                '--proxy-server=Px031901.pointtoserver.com:10780'
            ]
        });

        const page = await browser.newPage();
        
        // Browser fingerprinting bypass
        await page.setViewport({ 
            width: 1920, 
            height: 1080,
            deviceScaleFactor: 1
        });

        // Proxy authentication
        await page.authenticate({ 
            username: 'purevpn0s11340994', 
            password: 'ak3t35fp' 
        });

        // Stealth headers
        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        );
        
        await page.setExtraHTTPHeaders({ 
            "Referer": "https://cwmediabkt99.crwilladmin.com/",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br"
        });

        // Block unnecessary resources for speed
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['font', 'media', 'websocket'].includes(resourceType)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        console.log('🌐 Navigating to URL...');
        await page.goto(targetUrl, { 
            waitUntil: 'networkidle2', 
            timeout: 120000 
        });

        console.log('⏳ Waiting for content to load...');
        await page.waitForTimeout(3000);

        // Auto-scroll to trigger lazy-loading
        console.log('📜 Scrolling to load all slides...');
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 300;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        window.scrollTo(0, 0); // Reset to top
                        setTimeout(resolve, 1000);
                    }
                }, 150);
            });
        });

        console.log('⏳ Waiting for all content to render...');
        await page.waitForTimeout(5000);

        // Inject CSS for proper page breaks
        await page.addStyleTag({
            content: `
                @page { 
                    size: A4 landscape; 
                    margin: 0; 
                }
                @media print {
                    body { 
                        margin: 0; 
                        padding: 0; 
                    }
                    canvas, img, .slide, [class*="slide"], [class*="page"] { 
                        page-break-after: always !important; 
                        break-after: page !important;
                        display: block !important;
                        width: 100% !important;
                        height: auto !important;
                        max-width: 100% !important;
                    }
                    .no-print, #header, #footer, .sidebar, .thumbnail { 
                        display: none !important; 
                    }
                }
            `
        });

        console.log('📄 Generating PDF...');
        const pdfBuffer = await page.pdf({ 
            format: 'A4',
            landscape: true,
            printBackground: true,
            preferCSSPageSize: false,
            displayHeaderFooter: false,
            margin: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0
            }
        });

        console.log('✅ PDF generated successfully, size:', pdfBuffer.length, 'bytes');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader('Content-Disposition', 'inline; filename="lecture-notes.pdf"');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(pdfBuffer);

    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({ 
            status: "fail", 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        if (browser) {
            await browser.close();
            console.log('🔒 Browser closed');
        }
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'PDF Generator API',
        timestamp: new Date().toISOString()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'PDF Generator API',
        usage: 'GET /pdf?url=<encoded_url>',
        example: '/pdf?url=https%3A%2F%2Fexample.com%2Ffile.pdf'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ PDF Generator API is running on port ${PORT}`);
    console.log(`🌍 Health check: http://localhost:${PORT}/health`);
});
