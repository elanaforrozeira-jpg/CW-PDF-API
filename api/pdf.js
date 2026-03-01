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

        // Track all PDF requests
        let pdfUrl = null;
        let pdfBuffer = null;

        // Intercept network requests to find the PDF
        await page.setRequestInterception(true);
        
        page.on('request', (request) => {
            const url = request.url();
            const resourceType = request.resourceType();
            
            // If it's already a direct PDF URL or document type
            if (url.endsWith('.pdf') || resourceType === 'document') {
                pdfUrl = url;
            }
            
            request.continue();
        });

        // Capture PDF response
        page.on('response', async (response) => {
            const url = response.url();
            const contentType = response.headers()['content-type'] || '';
            
            if (contentType.includes('application/pdf')) {
                console.log('PDF found at:', url);
                pdfUrl = url;
                try {
                    pdfBuffer = await response.buffer();
                } catch (e) {
                    console.log('Could not capture buffer from response');
                }
            }
        });

        // Navigate to the page
        await page.goto(targetUrl, { 
            waitUntil: 'networkidle0', 
            timeout: 90000 
        });

        // Wait a bit for PDF to fully load
        await new Promise(r => setTimeout(r, 3000));

        // If we captured the buffer directly from network, use it
        if (pdfBuffer) {
            console.log('Using captured PDF buffer');
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="notes.pdf"');
            res.send(pdfBuffer);
            return;
        }

        // Try to extract PDF URL from page
        if (!pdfUrl) {
            pdfUrl = await page.evaluate(() => {
                // Check for iframe with PDF
                const iframe = document.querySelector('iframe[src*=".pdf"], embed[src*=".pdf"], object[data*=".pdf"]');
                if (iframe) {
                    return iframe.src || iframe.getAttribute('data');
                }
                
                // Check for PDF.js viewer
                const viewerUrl = window.location.href;
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.has('file')) {
                    return urlParams.get('file');
                }
                
                // Check meta tags or global variables
                if (window.PDFViewerApplication && window.PDFViewerApplication.url) {
                    return window.PDFViewerApplication.url;
                }
                
                return null;
            });
        }

        if (pdfUrl) {
            console.log('Fetching PDF from:', pdfUrl);
            
            // Create a new page to download the PDF
            const pdfPage = await browser.newPage();
            await pdfPage.authenticate({ 
                username: 'purevpn0s11340994', 
                password: 'ak3t35fp' 
            });
            await pdfPage.setExtraHTTPHeaders({ 
                "Referer": "https://cwmediabkt99.crwilladmin.com/" 
            });
            
            const pdfResponse = await pdfPage.goto(pdfUrl, { 
                waitUntil: 'networkidle0',
                timeout: 60000 
            });
            
            const buffer = await pdfResponse.buffer();
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="notes.pdf"');
            res.send(buffer);
            
            await pdfPage.close();
        } else {
            throw new Error('Could not locate PDF file');
        }

    } catch (e) {
        console.error('Error:', e.message);
        res.status(500).json({ 
            status: "fail", 
            error: e.message,
            details: "Could not fetch the original PDF file"
        });
    } finally {
        if (browser) await browser.close();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ PDF Proxy API running on port ${PORT}`));
