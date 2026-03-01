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
        console.log('🚀 Fetching PDF from:', targetUrl);

        browser = await puppeteer.launch({
            executablePath: '/usr/bin/google-chrome-stable',
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--single-process',
                '--no-zygote',
                '--disable-dev-shm-usage',
                '--proxy-server=Px031901.pointtoserver.com:10780'
            ]
        });

        const page = await browser.newPage();
        
        // Proxy authentication
        await page.authenticate({ 
            username: 'purevpn0s11340994', 
            password: 'ak3t35fp' 
        });

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        );
        
        await page.setExtraHTTPHeaders({ 
            "Referer": "https://cwmediabkt99.crwilladmin.com/",
            "Accept": "application/pdf,*/*"
        });

        console.log('🌐 Loading page...');
        
        // Direct PDF URL hai to seedha download karo
        const response = await page.goto(targetUrl, { 
            waitUntil: 'networkidle0', 
            timeout: 120000 
        });

        const contentType = response.headers()['content-type'];
        
        // Agar direct PDF file hai
        if (contentType && contentType.includes('application/pdf')) {
            console.log('✅ Direct PDF file detected');
            const pdfBuffer = await response.buffer();
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Length', pdfBuffer.length);
            res.setHeader('Content-Disposition', 'inline; filename="lecture-notes.pdf"');
            res.send(pdfBuffer);
            return;
        }

        // Agar PDF viewer page hai (jaise tumhara screenshot)
        console.log('🔍 PDF viewer detected, extracting actual PDF URL...');
        
        // Wait for PDF to load in viewer
        await page.waitForTimeout(5000);

        // Extract the actual PDF URL from the viewer
        const pdfUrl = await page.evaluate(() => {
            // Method 1: Check for iframe with PDF
            const iframe = document.querySelector('iframe[src*=".pdf"], iframe[src*="blob:"]');
            if (iframe) return iframe.src;
            
            // Method 2: Check for embed tag
            const embed = document.querySelector('embed[type="application/pdf"]');
            if (embed && embed.src) return embed.src;
            
            // Method 3: Check object tag
            const obj = document.querySelector('object[type="application/pdf"]');
            if (obj && obj.data) return obj.data;
            
            // Method 4: Check for PDF.js viewer
            if (window.PDFViewerApplication && window.PDFViewerApplication.url) {
                return window.PDFViewerApplication.url;
            }
            
            // Method 5: Check URL parameters
            const params = new URLSearchParams(window.location.search);
            if (params.has('url')) return decodeURIComponent(params.get('url'));
            if (params.has('file')) return decodeURIComponent(params.get('file'));
            
            // Method 6: Look for any anchor tag with PDF
            const links = Array.from(document.querySelectorAll('a[href*=".pdf"]'));
            if (links.length > 0) return links[0].href;
            
            // Method 7: Check all iframes
            const allIframes = document.querySelectorAll('iframe');
            for (let iframe of allIframes) {
                if (iframe.src) return iframe.src;
            }
            
            return null;
        });

        if (!pdfUrl) {
            throw new Error('Could not find PDF URL on the page');
        }

        console.log('📥 Found PDF URL:', pdfUrl);

        // Create new page to download the actual PDF
        const pdfPage = await browser.newPage();
        
        await pdfPage.authenticate({ 
            username: 'purevpn0s11340994', 
            password: 'ak3t35fp' 
        });
        
        await pdfPage.setExtraHTTPHeaders({ 
            "Referer": targetUrl,
            "Accept": "application/pdf,*/*"
        });

        const pdfResponse = await pdfPage.goto(pdfUrl, { 
            waitUntil: 'networkidle0',
            timeout: 120000 
        });

        if (pdfResponse.status() !== 200) {
            throw new Error(`Failed to fetch PDF: HTTP ${pdfResponse.status()}`);
        }

        const pdfBuffer = await pdfResponse.buffer();

        if (!pdfBuffer || pdfBuffer.length < 1000) {
            throw new Error('Invalid PDF data received');
        }

        console.log('✅ PDF downloaded successfully, size:', pdfBuffer.length, 'bytes');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader('Content-Disposition', 'inline; filename="lecture-notes.pdf"');
        res.send(pdfBuffer);

        await pdfPage.close();

    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({ 
            status: "fail", 
            error: error.message,
            url: targetUrl
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
        service: 'PDF Downloader API',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({
        service: 'PDF Downloader API',
        usage: 'GET /pdf?url=<encoded_pdf_url>',
        example: '/pdf?url=https%3A%2F%2Fexample.com%2Ffile.pdf'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ PDF Downloader API running on port ${PORT}`);
});
