const express = require('express');
const puppeteer = require('puppeteer-core');
const app = express();

app.get('/pdf', async (req, res) => {
    const rawUrl = req.query.url;
    if (!rawUrl) return res.status(400).json({ status: "fail", message: "URL missing" });
    
    const targetUrl = decodeURIComponent(rawUrl).trim();
    let browser;

    try {
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
            ]
        });

        const page = await browser.newPage();
        
        await page.authenticate({ 
            username: 'purevpn0s11340994', 
            password: 'ak3t35fp' 
        });

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        );
        
        await page.setExtraHTTPHeaders({ 
            "Referer": "https://cwmediabkt99.crwilladmin.com/" 
        });

        let pdfUrl = null;
        let pdfBuffer = null;

        // Listen for responses to capture PDF
        page.on('response', async (response) => {
            try {
                const url = response.url();
                const contentType = response.headers()['content-type'] || '';
                const status = response.status();
                
                if (status === 200 && contentType.includes('application/pdf')) {
                    console.log('✅ PDF detected:', url);
                    pdfUrl = url;
                    pdfBuffer = await response.buffer();
                }
            } catch (e) {
                // Ignore errors in response handler
            }
        });

        console.log('🌐 Navigating to:', targetUrl);
        await page.goto(targetUrl, { 
            waitUntil: 'networkidle2', 
            timeout: 90000 
        });

        // Wait for PDF to load
        await new Promise(r => setTimeout(r, 5000));

        // If we got the buffer from network interception, use it
        if (pdfBuffer && pdfBuffer.length > 0) {
            console.log('✅ Sending captured PDF buffer, size:', pdfBuffer.length);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Length', pdfBuffer.length);
            res.setHeader('Content-Disposition', 'inline; filename="notes.pdf"');
            res.send(pdfBuffer);
            return;
        }

        // If network capture failed, try to extract URL and fetch
        if (!pdfUrl) {
            console.log('🔍 Trying to extract PDF URL from page...');
            pdfUrl = await page.evaluate(() => {
                // Method 1: Check iframe
                const iframe = document.querySelector('iframe');
                if (iframe && iframe.src) return iframe.src;
                
                // Method 2: Check embed
                const embed = document.querySelector('embed[type="application/pdf"]');
                if (embed && embed.src) return embed.src;
                
                // Method 3: Check object
                const obj = document.querySelector('object[type="application/pdf"]');
                if (obj && obj.data) return obj.data;
                
                // Method 4: Check for PDF.js viewer URL parameter
                const params = new URLSearchParams(window.location.search);
                if (params.has('url')) return decodeURIComponent(params.get('url'));
                if (params.has('file')) return decodeURIComponent(params.get('file'));
                
                return null;
            });
        }

        if (pdfUrl) {
            console.log('📥 Fetching PDF from URL:', pdfUrl);
            
            // Make absolute URL if relative
            if (!pdfUrl.startsWith('http')) {
                const base = new URL(targetUrl);
                pdfUrl = new URL(pdfUrl, base.origin).href;
            }
            
            // Fetch PDF with proper headers
            const pdfPage = await browser.newPage();
            await pdfPage.authenticate({ 
                username: 'purevpn0s11340994', 
                password: 'ak3t35fp' 
            });
            await pdfPage.setUserAgent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            );
            await pdfPage.setExtraHTTPHeaders({ 
                "Referer": targetUrl 
            });
            
            const response = await pdfPage.goto(pdfUrl, { 
                waitUntil: 'networkidle2',
                timeout: 60000 
            });
            
            if (response.status() !== 200) {
                throw new Error(`PDF fetch failed with status ${response.status()}`);
            }
            
            const buffer = await response.buffer();
            
            if (!buffer || buffer.length === 0) {
                throw new Error('PDF buffer is empty');
            }
            
            console.log('✅ PDF fetched successfully, size:', buffer.length);
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Length', buffer.length);
            res.setHeader('Content-Disposition', 'inline; filename="notes.pdf"');
            res.send(buffer);
            
            await pdfPage.close();
        } else {
            throw new Error('Could not locate PDF URL');
        }

    } catch (e) {
        console.error('❌ Error:', e.message);
        res.status(500).json({ 
            status: "fail", 
            error: e.message,
            url: targetUrl
        });
    } finally {
        if (browser) await browser.close();
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'PDF Proxy API' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ PDF Proxy API running on port ${PORT}`));
