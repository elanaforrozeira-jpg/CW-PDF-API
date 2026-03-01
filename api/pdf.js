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
        console.log('📥 Downloading original PDF file');
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
                '--proxy-server=Px031901.pointtoserver.com:10780'
            ],
            ignoreDefaultArgs: ['--enable-automation']
        });

        const page = await browser.newPage();
        
        // Proxy auth
        await page.authenticate({ 
            username: 'purevpn0s11340994', 
            password: 'ak3t35fp' 
        });

        // Stealth
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });
            window.chrome = { runtime: {} };
        });

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        );

        // Perfect headers for direct PDF download
        await page.setExtraHTTPHeaders({
            'Accept': 'application/pdf,application/octet-stream,*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://cwmediabkt99.crwilladmin.com/',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Upgrade-Insecure-Requests': '1'
        });

        console.log('🌐 Fetching PDF file...');

        // Direct goto to PDF URL
        const response = await page.goto(targetUrl, { 
            waitUntil: 'networkidle0',
            timeout: 120000
        });

        const status = response.status();
        const contentType = response.headers()['content-type'] || '';
        
        console.log('📊 Response Status:', status);
        console.log('📄 Content-Type:', contentType);

        if (status !== 200) {
            throw new Error(`Failed to fetch PDF: HTTP ${status}`);
        }

        // Get the buffer
        const pdfBuffer = await response.buffer();
        
        console.log('📦 Buffer size:', pdfBuffer.length, 'bytes');

        if (pdfBuffer.length < 1000) {
            throw new Error('PDF file is too small, might be an error page');
        }

        // Verify PDF signature
        const signature = pdfBuffer.slice(0, 8).toString();
        console.log('🔍 File signature:', signature);

        if (!signature.includes('%PDF')) {
            const preview = pdfBuffer.slice(0, 200).toString();
            console.log('❌ Not a PDF! Content preview:', preview);
            throw new Error('Downloaded file is not a valid PDF');
        }

        // Extract PDF metadata
        const pdfInfo = {
            size: pdfBuffer.length,
            sizeInMB: (pdfBuffer.length / (1024 * 1024)).toFixed(2)
        };

        console.log('✅ Valid PDF confirmed!');
        console.log('📊 PDF Size:', pdfInfo.sizeInMB, 'MB');

        // Send the original PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader('Content-Disposition', 'attachment; filename="lecture-notes.pdf"');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.send(pdfBuffer);

        console.log('✅ Original PDF sent successfully!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

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
            console.log('🔒 Browser closed\n');
        }
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        service: 'Direct PDF Downloader',
        version: '5.0.0',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({
        service: 'Direct PDF Downloader API',
        description: 'Downloads original PDF files with authentication bypass',
        usage: 'GET /pdf?url=<encoded_pdf_url>',
        example: '/pdf?url=' + encodeURIComponent('https://example.com/file.pdf')
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Direct PDF Downloader running on ${PORT}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});
