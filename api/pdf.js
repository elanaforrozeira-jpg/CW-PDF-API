const express = require('express');
const puppeteer = require('puppeteer-core');
const zlib = require('zlib');
const app = express();

app.get('/pdf', async (req, res) => {
    const rawUrl = req.query.url;
    const compress = req.query.compress === 'true';
    
    if (!rawUrl) {
        return res.status(400).json({ 
            status: "fail", 
            message: "URL parameter missing" 
        });
    }
    
    const targetUrl = decodeURIComponent(rawUrl).trim();
    let browser;

    try {
        console.log('🚀 Starting PDF download:', targetUrl);
        if (compress) console.log('🗜️  Compression enabled');

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
                '--proxy-server=Px031901.pointtoserver.com:10780'
            ],
            ignoreDefaultArgs: ['--enable-automation']
        });

        const page = await browser.newPage();
        
        await page.authenticate({ 
            username: 'purevpn0s11340994', 
            password: 'ak3t35fp' 
        });

        // Enhanced stealth
        await page.evaluateOnNewDocument(() => {
            delete navigator.__proto__.webdriver;
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            window.chrome = { runtime: {} };
        });

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        );

        // Set additional headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-User': '?1',
            'Sec-Fetch-Dest': 'document',
            'Upgrade-Insecure-Requests': '1'
        });

        // Navigate to main domain first to establish cookies/session
        console.log('🌐 Establishing session on main domain...');
        const mainDomain = 'https://cwmediabkt99.crwilladmin.com/';
        
        await page.goto(mainDomain, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });

        console.log('⏳ Waiting for session establishment...');
        await page.waitForTimeout(3000);

        // Get cookies after session
        const cookies = await page.cookies();
        console.log('🍪 Cookies received:', cookies.length);

        console.log('📥 Fetching PDF with authenticated session...');

        // Enhanced fetch with proper headers and credentials
        const pdfData = await page.evaluate(async (url, domain) => {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    credentials: 'include',
                    mode: 'cors',
                    cache: 'no-cache',
                    headers: {
                        'Accept': 'application/pdf,application/octet-stream,*/*',
                        'Referer': domain,
                        'Origin': domain,
                        'Sec-Fetch-Site': 'same-origin',
                        'Sec-Fetch-Mode': 'no-cors',
                        'Sec-Fetch-Dest': 'document'
                    }
                });

                console.log('Response status:', response.status);
                console.log('Response headers:', [...response.headers.entries()]);

                if (!response.ok) {
                    const text = await response.text();
                    return { 
                        error: `HTTP ${response.status}`,
                        body: text.substring(0, 500)
                    };
                }

                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                
                return {
                    data: Array.from(uint8Array),
                    size: uint8Array.length,
                    type: blob.type || response.headers.get('content-type')
                };
            } catch (e) {
                return { 
                    error: e.message,
                    stack: e.stack
                };
            }
        }, targetUrl, mainDomain);

        if (pdfData.error) {
            console.error('❌ Fetch error details:', pdfData);
            throw new Error('Fetch failed: ' + pdfData.error + (pdfData.body ? '\nBody: ' + pdfData.body : ''));
        }

        console.log('📦 PDF fetched! Size:', pdfData.size, 'bytes');
        console.log('📄 Content-Type:', pdfData.type);

        if (pdfData.size < 1000) {
            throw new Error('PDF too small: ' + pdfData.size + ' bytes (might be error page)');
        }

        // Convert array back to Buffer
        let pdfBuffer = Buffer.from(pdfData.data);

        // Verify PDF
        const signature = pdfBuffer.slice(0, 5).toString();
        console.log('🔍 Signature:', signature);

        if (!signature.includes('%PDF')) {
            const preview = pdfBuffer.slice(0, 200).toString();
            console.log('❌ Not a PDF! Preview:', preview);
            throw new Error('Downloaded file is not a PDF');
        }

        console.log('✅ Valid PDF confirmed!');

        // Compress if requested
        if (compress) {
            console.log('🗜️  Compressing PDF...');
            const originalSize = pdfBuffer.length;
            pdfBuffer = zlib.gzipSync(pdfBuffer, { level: 6 });
            console.log('📦 Compressed size:', pdfBuffer.length, 'bytes');
            console.log('💾 Compression ratio:', ((1 - pdfBuffer.length / originalSize) * 100).toFixed(2) + '%');
        }

        // Set response headers
        res.setHeader('Content-Type', compress ? 'application/gzip' : 'application/pdf');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader('Content-Disposition', `attachment; filename="lecture-notes.${compress ? 'pdf.gz' : 'pdf'}"`);
        res.setHeader('Cache-Control', 'no-cache');
        
        if (compress) {
            res.setHeader('Content-Encoding', 'gzip');
        }

        res.send(pdfBuffer);

        console.log('✅ PDF sent successfully!\n');

    } catch (error) {
        console.error('❌ ERROR:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({ 
            status: "fail", 
            error: error.message,
            url: targetUrl
        });
    } finally {
        if (browser) await browser.close();
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API running on ${PORT}`));
