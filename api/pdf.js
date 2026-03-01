const express = require('express');
const puppeteer = require('puppeteer-core');
const app = express();

app.get('/pdf', async (req, res) => {
    const rawUrl = req.query.url;
    
    if (!rawUrl) {
        return res.status(400).json({ 
            status: "fail", 
            message: "URL parameter missing. Usage: /pdf?url=<encoded_url>" 
        });
    }
    
    const targetUrl = decodeURIComponent(rawUrl).trim();
    let browser;

    try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🚀 Starting PDF fetch for:', targetUrl);
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
                '--proxy-server=Px031901.pointtoserver.com:10780'
            ]
        });

        const page = await browser.newPage();
        
        // Proxy auth
        await page.authenticate({ 
            username: 'purevpn0s11340994', 
            password: 'ak3t35fp' 
        });

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        );
        
        await page.setExtraHTTPHeaders({ 
            "Referer": "https://cwmediabkt99.crwilladmin.com/",
            "Accept": "application/pdf,text/html,application/xhtml+xml,*/*"
        });

        console.log('🌐 Navigating to page...');
        
        const response = await page.goto(targetUrl, { 
            waitUntil: 'domcontentloaded', 
            timeout: 120000 
        });

        const status = response.status();
        const contentType = response.headers()['content-type'] || '';
        
        console.log('📊 Response Status:', status);
        console.log('📄 Content-Type:', contentType);

        // Check if direct PDF
        if (status === 200 && contentType.includes('application/pdf')) {
            console.log('✅ Direct PDF detected, downloading...');
            const buffer = await response.buffer();
            console.log('📦 Buffer size:', buffer.length, 'bytes');
            
            if (buffer.length < 100) {
                throw new Error('PDF buffer too small, might be corrupted');
            }
            
            // Verify PDF signature
            const pdfSignature = buffer.slice(0, 5).toString();
            if (!pdfSignature.includes('%PDF')) {
                throw new Error('Invalid PDF signature: ' + pdfSignature);
            }
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Length', buffer.length);
            res.setHeader('Content-Disposition', 'attachment; filename="lecture-notes.pdf"');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.send(buffer);
            
            console.log('✅ PDF sent successfully!');
            return;
        }

        // If it's a viewer page, wait and extract PDF URL
        console.log('🔍 PDF viewer page detected, extracting PDF URL...');
        
        await page.waitForTimeout(8000); // Longer wait for PDF to load

        const extractedData = await page.evaluate(() => {
            const data = {
                pdfUrl: null,
                method: null
            };
            
            // Method 1: iframe
            const iframe = document.querySelector('iframe');
            if (iframe && iframe.src) {
                data.pdfUrl = iframe.src;
                data.method = 'iframe';
                return data;
            }
            
            // Method 2: embed
            const embed = document.querySelector('embed');
            if (embed && embed.src) {
                data.pdfUrl = embed.src;
                data.method = 'embed';
                return data;
            }
            
            // Method 3: object
            const obj = document.querySelector('object');
            if (obj && obj.data) {
                data.pdfUrl = obj.data;
                data.method = 'object';
                return data;
            }
            
            // Method 4: Check URL params
            const params = new URLSearchParams(window.location.search);
            if (params.has('url')) {
                data.pdfUrl = decodeURIComponent(params.get('url'));
                data.method = 'url_param';
                return data;
            }
            
            // Method 5: All links
            const links = Array.from(document.querySelectorAll('a'));
            for (let link of links) {
                if (link.href && link.href.includes('.pdf')) {
                    data.pdfUrl = link.href;
                    data.method = 'anchor_tag';
                    return data;
                }
            }
            
            return data;
        });

        console.log('🔍 Extraction method:', extractedData.method);
        console.log('🔗 Extracted URL:', extractedData.pdfUrl);

        if (!extractedData.pdfUrl) {
            throw new Error('Could not find PDF URL in the page');
        }

        // Fetch the actual PDF
        console.log('📥 Fetching actual PDF file...');
        
        const pdfPage = await browser.newPage();
        await pdfPage.authenticate({ 
            username: 'purevpn0s11340994', 
            password: 'ak3t35fp' 
        });
        await pdfPage.setExtraHTTPHeaders({ 
            "Referer": targetUrl
        });

        const pdfResponse = await pdfPage.goto(extractedData.pdfUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 120000 
        });

        const pdfStatus = pdfResponse.status();
        console.log('📊 PDF Response Status:', pdfStatus);

        if (pdfStatus !== 200) {
            throw new Error(`PDF fetch failed with status ${pdfStatus}`);
        }

        const pdfBuffer = await pdfResponse.buffer();
        console.log('📦 PDF Buffer size:', pdfBuffer.length, 'bytes');

        if (pdfBuffer.length < 100) {
            throw new Error('PDF too small, might be corrupted');
        }

        // Verify PDF
        const signature = pdfBuffer.slice(0, 5).toString();
        console.log('🔍 PDF Signature:', signature);
        
        if (!signature.includes('%PDF')) {
            throw new Error('Invalid PDF format');
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader('Content-Disposition', 'attachment; filename="lecture-notes.pdf"');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.send(pdfBuffer);

        console.log('✅ PDF sent successfully!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        await pdfPage.close();

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
        service: 'PDF Downloader API',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({
        service: 'PDF Downloader API',
        endpoints: {
            download: '/pdf?url=<encoded_url>',
            health: '/health'
        },
        example: '/pdf?url=' + encodeURIComponent('https://example.com/file.pdf')
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ PDF Downloader API is LIVE on port ${PORT}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});
