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
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🚀 Starting authenticated PDF extraction');
        console.log('🔗 Target URL:', targetUrl);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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
        
        // Viewport set karo
        await page.setViewport({ 
            width: 1920, 
            height: 1080 
        });

        // Proxy authentication
        await page.authenticate({ 
            username: 'purevpn0s11340994', 
            password: 'ak3t35fp' 
        });

        // Stealth user agent
        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        );
        
        await page.setExtraHTTPHeaders({ 
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Referer": "https://cwmediabkt99.crwilladmin.com/",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin"
        });

        // Network monitoring for PDF capture
        let pdfBuffer = null;
        let capturedFromNetwork = false;

        page.on('response', async (response) => {
            try {
                const url = response.url();
                const contentType = response.headers()['content-type'] || '';
                const status = response.status();
                
                // Log all responses for debugging
                if (url.includes('compressed.pdf') || url.includes('class-attachment')) {
                    console.log('📊 Response for:', url);
                    console.log('   Status:', status);
                    console.log('   Content-Type:', contentType);
                }
                
                // Capture PDF responses
                if (status === 200 && contentType.includes('application/pdf')) {
                    console.log('✅ PDF found in network traffic!');
                    const buffer = await response.buffer();
                    
                    // Verify it's a real PDF
                    const sig = buffer.slice(0, 5).toString();
                    if (sig.includes('%PDF')) {
                        pdfBuffer = buffer;
                        capturedFromNetwork = true;
                        console.log('📦 Valid PDF captured, size:', buffer.length, 'bytes');
                    }
                }
            } catch (e) {
                // Ignore response handling errors
            }
        });

        console.log('🌐 Loading page with full browser context...');
        
        // Navigate to the URL - this will trigger any authentication/session
        const response = await page.goto(targetUrl, { 
            waitUntil: 'networkidle2', 
            timeout: 120000 
        });

        const initialStatus = response.status();
        const initialContentType = response.headers()['content-type'] || '';
        
        console.log('📊 Initial Response:');
        console.log('   Status:', initialStatus);
        console.log('   Content-Type:', initialContentType);

        // Wait for PDF to load
        console.log('⏳ Waiting for PDF to fully load...');
        await page.waitForTimeout(12000); // 12 seconds

        // Check if we captured PDF from network
        if (capturedFromNetwork && pdfBuffer && pdfBuffer.length > 1000) {
            console.log('✅ Using PDF captured from network traffic');
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Length', pdfBuffer.length);
            res.setHeader('Content-Disposition', 'attachment; filename="lecture-notes.pdf"');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.send(pdfBuffer);
            
            console.log('✅ PDF sent successfully!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            return;
        }

        // If no PDF captured, check page content type
        const finalUrl = page.url();
        console.log('🔍 Final URL after redirects:', finalUrl);

        // Check if browser directly opened PDF
        const isPdfPage = await page.evaluate(() => {
            return document.contentType === 'application/pdf' || 
                   document.querySelector('embed[type="application/pdf"]') !== null ||
                   document.querySelector('iframe') !== null;
        });

        console.log('📄 Is PDF viewer page?', isPdfPage);

        if (isPdfPage) {
            console.log('📥 Page is showing PDF, trying to extract...');
            
            // Try to get PDF content from the page
            const pdfDataUrl = await page.evaluate(() => {
                const embed = document.querySelector('embed');
                if (embed && embed.src) return embed.src;
                
                const iframe = document.querySelector('iframe');
                if (iframe && iframe.src) return iframe.src;
                
                return window.location.href;
            });

            console.log('🔗 PDF data URL:', pdfDataUrl);

            // If it's a blob or data URL, we need to fetch it differently
            if (pdfDataUrl.startsWith('blob:')) {
                console.log('🔄 Detected blob URL, converting to buffer...');
                
                pdfBuffer = await page.evaluate(async (url) => {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    const arrayBuffer = await blob.arrayBuffer();
                    return Array.from(new Uint8Array(arrayBuffer));
                }, pdfDataUrl);
                
                pdfBuffer = Buffer.from(pdfBuffer);
                
            } else if (pdfDataUrl !== finalUrl) {
                // It's a different URL, fetch it
                console.log('📥 Fetching from different URL...');
                
                const pdfPage = await browser.newPage();
                await pdfPage.authenticate({ 
                    username: 'purevpn0s11340994', 
                    password: 'ak3t35fp' 
                });
                
                // Copy cookies from main page
                const cookies = await page.cookies();
                await pdfPage.setCookie(...cookies);
                
                await pdfPage.setExtraHTTPHeaders({ 
                    "Referer": finalUrl
                });

                const pdfResp = await pdfPage.goto(pdfDataUrl, { 
                    waitUntil: 'networkidle0',
                    timeout: 60000 
                });

                pdfBuffer = await pdfResp.buffer();
                await pdfPage.close();
            }
        }

        // Validate and send PDF
        if (pdfBuffer && pdfBuffer.length > 100) {
            const signature = pdfBuffer.slice(0, 5).toString();
            console.log('🔍 PDF Signature check:', signature);
            
            if (signature.includes('%PDF')) {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Length', pdfBuffer.length);
                res.setHeader('Content-Disposition', 'attachment; filename="lecture-notes.pdf"');
                res.setHeader('Cache-Control', 'no-cache');
                res.send(pdfBuffer);
                
                console.log('✅ PDF sent successfully!');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                return;
            } else {
                console.log('❌ Invalid signature. First 50 chars:', pdfBuffer.slice(0, 50).toString());
            }
        }

        // If everything failed, take screenshot for debugging
        console.log('⚠️  All methods failed. Taking screenshot for debugging...');
        const screenshot = await page.screenshot({ encoding: 'base64', fullPage: false });
        
        throw new Error(`Could not extract valid PDF. Page might require manual authentication. Screenshot saved in logs.`);

    } catch (error) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ ERROR:', error.message);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        res.status(500).json({ 
            status: "fail", 
            error: error.message,
            url: targetUrl,
            hint: "The PDF URL might require authentication cookies from a logged-in session",
            timestamp: new Date().toISOString()
        });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'Authenticated PDF Extractor',
        version: '3.0.0',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({
        service: 'Authenticated PDF Extractor API',
        description: 'Extracts PDFs from authenticated/protected URLs',
        usage: '/pdf?url=<encoded_url>',
        note: 'Handles cookies, sessions, and authentication automatically'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Authenticated PDF Extractor running on ${PORT}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});
