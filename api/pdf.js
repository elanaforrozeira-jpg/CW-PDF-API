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
        console.log('🕵️  Starting STEALTH mode PDF extraction');
        console.log('🔗 Target:', targetUrl);
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
                
                // Anti-detection flags
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-web-security',
                '--disable-site-isolation-trials',
                
                // Real browser simulation
                '--window-size=1920,1080',
                '--disable-infobars',
                '--disable-notifications',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-popup-blocking',
                
                // Proxy
                '--proxy-server=Px031901.pointtoserver.com:10780'
            ],
            ignoreDefaultArgs: ['--enable-automation']
        });

        const page = await browser.newPage();
        
        // Proxy authentication
        await page.authenticate({ 
            username: 'purevpn0s11340994', 
            password: 'ak3t35fp' 
        });

        // Perfect viewport - common desktop size
        await page.setViewport({ 
            width: 1920, 
            height: 1080,
            deviceScaleFactor: 1,
            hasTouch: false,
            isLandscape: true,
            isMobile: false
        });

        // === STEALTH INJECTION ===
        console.log('🛡️  Injecting stealth scripts...');
        
        await page.evaluateOnNewDocument(() => {
            // 1. Remove webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false
            });

            // 2. Mock plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
                    {
                        0: {type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format"},
                        description: "Portable Document Format",
                        filename: "internal-pdf-viewer",
                        length: 1,
                        name: "Chrome PDF Plugin"
                    },
                    {
                        0: {type: "application/pdf", suffixes: "pdf", description: "Portable Document Format"},
                        description: "Portable Document Format",
                        filename: "internal-pdf-viewer",
                        length: 1,
                        name: "Chrome PDF Viewer"
                    },
                    {
                        description: "Portable Document Format",
                        filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
                        length: 1,
                        name: "PDF Viewer"
                    }
                ]
            });

            // 3. Mock languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });

            // 4. Mock permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );

            // 5. Chrome runtime
            window.chrome = {
                runtime: {}
            };

            // 6. Mock battery
            Object.defineProperty(navigator, 'getBattery', {
                get: () => () => Promise.resolve({
                    charging: true,
                    chargingTime: 0,
                    dischargingTime: Infinity,
                    level: 1
                })
            });

            // 7. Connection
            Object.defineProperty(navigator, 'connection', {
                get: () => ({
                    effectiveType: '4g',
                    rtt: 100,
                    downlink: 10,
                    saveData: false
                })
            });

            // 8. Hardware concurrency
            Object.defineProperty(navigator, 'hardwareConcurrency', {
                get: () => 8
            });

            // 9. Device memory
            Object.defineProperty(navigator, 'deviceMemory', {
                get: () => 8
            });

            // 10. Mock screen
            Object.defineProperty(window.screen, 'width', { get: () => 1920 });
            Object.defineProperty(window.screen, 'height', { get: () => 1080 });
            Object.defineProperty(window.screen, 'availWidth', { get: () => 1920 });
            Object.defineProperty(window.screen, 'availHeight', { get: () => 1040 });
            Object.defineProperty(window.screen, 'colorDepth', { get: () => 24 });
            Object.defineProperty(window.screen, 'pixelDepth', { get: () => 24 });

            // 11. User activation
            Object.defineProperty(navigator, 'userActivation', {
                get: () => ({
                    hasBeenActive: true,
                    isActive: true
                })
            });

            // 12. Notification permission
            Object.defineProperty(Notification, 'permission', {
                get: () => 'default'
            });
        });

        // Real browser user agent
        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        );

        // Perfect headers - exactly like real browser
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'max-age=0',
            'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'Referer': 'https://cwmediabkt99.crwilladmin.com/'
        });

        console.log('✅ Stealth mode activated');

        // PDF capture from network
        let pdfBuffer = null;
        let pdfCaptured = false;

        page.on('response', async (response) => {
            try {
                const url = response.url();
                const contentType = response.headers()['content-type'] || '';
                const status = response.status();
                
                console.log('📡 Response:', url.substring(0, 80), '| Status:', status, '| Type:', contentType);
                
                if (status === 200 && contentType.includes('application/pdf')) {
                    console.log('🎯 PDF DETECTED!');
                    const buffer = await response.buffer();
                    const signature = buffer.slice(0, 5).toString();
                    
                    console.log('🔍 Signature:', signature);
                    console.log('📦 Size:', buffer.length, 'bytes');
                    
                    if (signature.includes('%PDF') && buffer.length > 1000) {
                        pdfBuffer = buffer;
                        pdfCaptured = true;
                        console.log('✅ Valid PDF captured!');
                    }
                }
            } catch (e) {
                // Silent fail for response handling
            }
        });

        console.log('🌐 Navigating to URL as real browser...');
        
        const response = await page.goto(targetUrl, { 
            waitUntil: 'networkidle2', 
            timeout: 120000 
        });

        console.log('📊 Page loaded, Status:', response.status());
        console.log('📄 Content-Type:', response.headers()['content-type']);

        // Wait for PDF to load
        console.log('⏳ Waiting for PDF to fully load...');
        await page.waitForTimeout(15000); // 15 seconds

        // Check if PDF was captured
        if (pdfCaptured && pdfBuffer && pdfBuffer.length > 1000) {
            console.log('🎉 SUCCESS! Sending PDF...');
            console.log('📦 Final size:', pdfBuffer.length, 'bytes');
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Length', pdfBuffer.length);
            res.setHeader('Content-Disposition', 'attachment; filename="lecture-notes.pdf"');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.send(pdfBuffer);
            
            console.log('✅ PDF sent successfully!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            return;
        }

        // If network capture failed, try alternative methods
        console.log('⚠️  Network capture failed, trying alternatives...');

        const pageInfo = await page.evaluate(() => {
            return {
                contentType: document.contentType,
                title: document.title,
                bodyHTML: document.body ? document.body.innerHTML.substring(0, 500) : 'No body',
                hasIframe: !!document.querySelector('iframe'),
                hasEmbed: !!document.querySelector('embed'),
                hasObject: !!document.querySelector('object')
            };
        });

        console.log('📄 Page info:', JSON.stringify(pageInfo, null, 2));

        throw new Error('PDF not detected in network traffic. Page might be using dynamic loading or blob URLs.');

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
            console.log('🔒 Browser closed');
        }
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        mode: 'stealth',
        service: 'PDF Extractor with Bot Bypass',
        version: '4.0.0'
    });
});

app.get('/', (req, res) => {
    res.json({
        service: 'Stealth PDF Extractor',
        description: 'Bypasses bot detection to extract PDFs',
        usage: 'GET /pdf?url=<encoded_url>',
        features: [
            'Anti-bot detection',
            'Real browser simulation',
            'Network traffic capture',
            'Proxy support'
        ]
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🕵️  Stealth PDF Extractor LIVE on port ${PORT}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});
