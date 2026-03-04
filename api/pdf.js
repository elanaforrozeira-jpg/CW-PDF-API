const express = require('express');
const puppeteer = require('puppeteer-core');
const zlib = require('zlib');
const app = express();

app.get('/pdf', async (req, res) => {
    const rawUrl = req.query.url;
    const compress = req.query.compress === 'true'; // Add compression flag
    
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

        // Stealth
        await page.evaluateOnNewDocument(() => {
            delete navigator.__proto__.webdriver;
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
        });

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        );

        // Navigate to a simple page first to establish session
        console.log('🌐 Establishing session...');
        await page.goto('https://cwmediabkt99.crwilladmin.com/', { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });

        await page.waitForTimeout(2000);

        console.log('📥 Fetching PDF using browser context...');

        // Fetch PDF inside browser context using native fetch
        const pdfData = await page.evaluate(async (url) => {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/pdf,*/*'
                    }
                });

                if (!response.ok) {
                    return { error: `HTTP ${response.status}` };
                }

                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                
                return {
                    data: Array.from(uint8Array),
                    size: uint8Array.length,
                    type: blob.type
                };
            } catch (e) {
                return { error: e.message };
            }
        }, targetUrl);

        if (pdfData.error) {
            throw new Error('Fetch failed: ' + pdfData.error);
        }

        console.log('📦 PDF fetched! Size:', pdfData.size, 'bytes');
        console.log('📄 Content-Type:', pdfData.type);

        if (pdfData.size < 1000) {
            throw new Error('PDF too small: ' + pdfData.size + ' bytes');
        }

        // Convert array back to Buffer
        let pdfBuffer = Buffer.from(pdfData.data);

        // Verify PDF
        const signature = pdfBuffer.slice(0, 5).toString();
        console.log('🔍 Signature:', signature);

        if (!signature.includes('%PDF')) {
            const preview = pdfBuffer.slice(0, 100).toString();
            console.log('❌ Not a PDF! Preview:', preview);
            throw new Error('Downloaded file is not a PDF');
        }

        console.log('✅ Valid PDF confirmed!');

        // Compress if requested
        if (compress) {
            console.log('🗜️  Compressing PDF...');
            pdfBuffer = zlib.gzipSync(pdfBuffer, { level: 6 });
            console.log('📦 Compressed size:', pdfBuffer.length, 'bytes');
            console.log('💾 Compression ratio:', ((1 - pdfBuffer.length / pdfData.size) * 100).toFixed(2) + '%');
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
