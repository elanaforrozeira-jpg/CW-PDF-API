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
        console.log('📥 Fetching PDF like a real browser');
        console.log('🔗 URL:', targetUrl);
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
                '--allow-running-insecure-content',
                '--proxy-server=Px031901.pointtoserver.com:10780'
            ],
            ignoreDefaultArgs: ['--enable-automation']
        });

        const page = await browser.newPage();
        
        // Enable CDP session for advanced control
        const client = await page.target().createCDPSession();
        await client.send('Network.enable');
        
        // Proxy auth
        await page.authenticate({ 
            username: 'purevpn0s11340994', 
            password: 'ak3t35fp' 
        });

        // Full stealth mode
        await page.evaluateOnNewDocument(() => {
            // Remove webdriver
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });

            // Mock plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
                    {
                        0: {type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format"},
                        description: "Portable Document Format",
                        filename: "internal-pdf-viewer",
                        length: 1,
                        name: "Chrome PDF Plugin"
                    }
                ]
            });

            // Chrome object
            window.chrome = {
                runtime: {},
                loadTimes: function() {},
                csi: function() {},
                app: {}
            };

            // Permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );

            // Languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });
        });

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        );

        // Extra headers exactly like browser
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'identity',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        });

        let pdfBuffer = null;
        let pdfCaptured = false;

        // Listen to network responses
        client.on('Network.responseReceived', async (params) => {
            const response = params.response;
            const url = response.url;
            const status = response.status;
            const mimeType = response.mimeType || '';
            
            console.log('📡 Network:', url.substring(url.length - 50), '| Status:', status, '| Type:', mimeType);

            if (status === 200 && mimeType.includes('pdf')) {
                console.log('🎯 PDF response detected!');
                
                try {
                    const responseBody = await client.send('Network.getResponseBody', {
                        requestId: params.requestId
                    });
                    
                    if (responseBody.base64Encoded) {
                        pdfBuffer = Buffer.from(responseBody.body, 'base64');
                    } else {
                        pdfBuffer = Buffer.from(responseBody.body);
                    }
                    
                    pdfCaptured = true;
                    console.log('✅ PDF captured via CDP! Size:', pdfBuffer.length);
                } catch (e) {
                    console.log('⚠️  Could not get response body:', e.message);
                }
            }
        });

        console.log('🌐 Navigating to URL...');
        
        const response = await page.goto(targetUrl, { 
            waitUntil: 'networkidle0',
            timeout: 120000
        });

        const status = response.status();
        const headers = response.headers();
        
        console.log('📊 Page Response:');
        console.log('   Status:', status);
        console.log('   Content-Type:', headers['content-type']);
        console.log('   Content-Length:', headers['content-length']);

        // Wait for PDF to load
        console.log('⏳ Waiting for PDF to fully load...');
        await page.waitForTimeout(10000);

        // If CDP captured the PDF
        if (pdfCaptured && pdfBuffer && pdfBuffer.length > 1000) {
            const signature = pdfBuffer.slice(0, 8).toString();
            console.log('🔍 PDF Signature:', signature);
            
            if (signature.includes('%PDF')) {
                console.log('✅ Valid PDF! Sending...');
                
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Length', pdfBuffer.length);
                res.setHeader('Content-Disposition', 'attachment; filename="lecture-notes.pdf"');
                res.setHeader('Cache-Control', 'no-cache');
                res.send(pdfBuffer);
                
                console.log('✅ PDF sent successfully!');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                return;
            }
        }

        // Fallback: Try getting buffer from response
        const fallbackBuffer = await response.buffer();
        console.log('📦 Fallback buffer size:', fallbackBuffer.length);
        
        if (fallbackBuffer.length > 1000) {
            const sig = fallbackBuffer.slice(0, 8).toString();
            console.log('🔍 Fallback signature:', sig);
            
            if (sig.includes('%PDF')) {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Length', fallbackBuffer.length);
                res.setHeader('Content-Disposition', 'attachment; filename="lecture-notes.pdf"');
                res.send(fallbackBuffer);
                
                console.log('✅ PDF sent via fallback!');
                return;
            } else {
                console.log('❌ Not a PDF. Content preview:', fallbackBuffer.slice(0, 200).toString());
            }
        }

        // Final attempt: Check if page loaded PDF viewer
        const pageContent = await page.evaluate(() => {
            return {
                contentType: document.contentType,
                title: document.title,
                hasEmbed: !!document.querySelector('embed[type="application/pdf"]'),
                bodyText: document.body ? document.body.innerText.substring(0, 500) : 'No body'
            };
        });

        console.log('📄 Page content:', JSON.stringify(pageContent, null, 2));

        throw new Error('Could not capture PDF. The server might be blocking automated access.');

    } catch (error) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ ERROR:', error.message);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        res.status(500).json({ 
            status: "fail", 
            error: error.message,
            url: targetUrl,
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
        service: 'CDP PDF Downloader',
        version: '6.0.0'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('✅ CDP PDF Downloader running on', PORT);
});
