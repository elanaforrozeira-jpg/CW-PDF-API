const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// 1. Constant Configuration
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36';
const BLOCKED_RESOURCES = ['image', 'font', 'media', 'stylesheet']; // Speed boost ke liye images block kar sakte hain

// 2. Helper: Logger
const log = (tag, message) => console.log(`[${tag}] ${new Date().toISOString()}: ${message}`);

module.exports = async (req, res) => {
    // 3. Advanced CORS Policy
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    let browser = null;
    const startTime = Date.now();

    try {
        // 4. Input Validation & Decoding
        let { url, filename = 'document.pdf', wait = 'networkidle0', fullPage = 'true' } = req.query;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'Missing URL',
                usage: '/pdf?url=HTTPS_ENCODED_URL'
            });
        }

        const targetUrl = decodeURIComponent(url);
        log('INIT', `Starting PDF generation for: ${targetUrl}`);

        // 5. Browser Launch Optimization
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process'
            ],
            defaultViewport: { width: 1280, height: 800 },
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();

        // 6. Security & Identification
        await page.setUserAgent(DEFAULT_USER_AGENT);
        await page.setExtraHTTPHeaders({ 'DNT': '1' });

        // 7. Performance: Resource Interception (Optional Speedup)
        /*
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (BLOCKED_RESOURCES.includes(req.resourceType())) req.abort();
            else req.continue();
        });
        */

        // 8. Navigation Logic
        log('NAVIGATE', `Navigating to ${targetUrl}...`);
        const response = await page.goto(targetUrl, {
            waitUntil: wait,
            timeout: 55000 // Close to Vercel's 60s limit
        });

        if (!response || !response.ok()) {
            throw new Error(`Target URL returned status ${response ? response.status() : 'Unknown'}`);
        }

        // 9. Advanced PDF Options
        log('RENDER', 'Generating PDF buffer...');
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: false,
            margin: { top: '0.4in', right: '0.4in', bottom: '0.4in', left: '0.4in' },
            fullPage: fullPage === 'true'
        });

        // 10. Performance Headers
        const executionTime = Date.now() - startTime;
        log('SUCCESS', `Completed in ${executionTime}ms. Size: ${pdfBuffer.length} bytes`);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('X-Execution-Time', `${executionTime}ms`);
        
        return res.status(200).send(pdfBuffer);

    } catch (error) {
        log('ERROR', error.message);
        
        return res.status(500).json({
            success: false,
            error: 'PDF Generation Failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });

    } finally {
        // 11. Memory Leak Prevention
        if (browser) {
            log('CLEANUP', 'Closing browser process...');
            await browser.close();
        }
    }
};
