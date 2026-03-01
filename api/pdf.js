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
        console.log('🚀 Starting PDF extraction for:', targetUrl);
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
            "Referer": "https://cwmediabkt99.crwilladmin.com/"
        });

        // Track network requests to capture PDF
        let pdfBuffer = null;
        let pdfUrl = null;

        page.on('response', async (response) => {
            try {
                const url = response.url();
                const contentType = response.headers()['content-type'] || '';
                const status = response.status();
                
                // Capture any PDF response
                if (status === 200 && contentType.includes('application/pdf')) {
                    console.log('✅ PDF detected in network:', url);
                    pdfUrl = url;
                    pdfBuffer = await response.buffer();
                    console.log('📦 Captured buffer size:', pdfBuffer.length);
                }
            } catch (e) {
                // Ignore buffer capture errors
            }
        });

        console.log('🌐 Loading viewer page...');
        
        await page.goto(targetUrl, { 
            waitUntil: 'networkidle0', 
            timeout: 120000 
        });

        console.log('⏳ Waiting for PDF to load in viewer...');
        await page.waitForTimeout(10000); // 10 seconds for PDF to fully load

        // If we captured PDF from network, use it
        if (pdfBuffer && pdfBuffer.length > 1000) {
            console.log('✅ Using captured PDF from network');
            
            const signature = pdfBuffer.slice(0, 5).toString();
            console.log('🔍 PDF Signature:', signature);
            
            if (signature.includes('%PDF')) {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Length', pdfBuffer.length);
                res.setHeader('Content-Disposition', 'attachment; filename="lecture-notes.pdf"');
                res.setHeader('Cache-Control', 'no-cache');
                res.send(pdfBuffer);
                
                console.log('✅ PDF sent successfully!');
                return;
            }
        }

        // If network capture failed, try to extract URL
        console.log('🔍 Network capture failed, extracting PDF URL from page...');
        
        const extractedInfo = await page.evaluate(() => {
            const info = {
                pdfUrl: null,
                method: null,
                pageContent: null
            };
            
            // Method 1: iframe with src
            const iframe = document.querySelector('iframe');
            if (iframe) {
                info.pdfUrl = iframe.src;
                info.method = 'iframe';
                return info;
            }
            
            // Method 2: embed tag
            const embed = document.querySelector('embed[type="application/pdf"]');
            if (embed) {
                info.pdfUrl = embed.src;
                info.method = 'embed';
                return info;
            }
            
            // Method 3: object tag
            const obj = document.querySelector('object[type="application/pdf"]');
            if (obj) {
                info.pdfUrl = obj.data;
                info.method = 'object';
                return info;
            }
            
            // Method 4: Look for data-src or similar attributes
            const elementsWithDataSrc = document.querySelectorAll('[data-src*=".pdf"], [data-url*=".pdf"]');
            if (elementsWithDataSrc.length > 0) {
                info.pdfUrl = elementsWithDataSrc[0].getAttribute('data-src') || elementsWithDataSrc[0].getAttribute('data-url');
                info.method = 'data-attribute';
                return info;
            }
            
            // Method 5: Check all script tags for PDF URLs
            const scripts = document.querySelectorAll('script');
            for (let script of scripts) {
                const text = script.textContent;
                const pdfMatch = text.match(/['"]([^'"]*\.pdf[^'"]*)['"]/);
                if (pdfMatch) {
                    info.pdfUrl = pdfMatch[1];
                    info.method = 'script_content';
                    return info;
                }
            }
            
            // Method 6: Check window location for embedded PDF
            if (document.contentType === 'application/pdf') {
                info.pdfUrl = window.location.href;
                info.method = 'same_page_pdf';
                return info;
            }
            
            // Debug: Get page structure
            info.pageContent = document.body ? document.body.innerHTML.substring(0, 500) : 'No body';
            
            return info;
        });

        console.log('🔍 Extraction method:', extractedInfo.method);
        console.log('🔗 Extracted URL:', extractedInfo.pdfUrl);

        if (!extractedInfo.pdfUrl) {
            console.log('⚠️  Page content preview:', extractedInfo.pageContent);
            throw new Error('Could not find PDF URL. The page might use dynamic loading or blob URLs.');
        }

        // Make absolute URL
        let absolutePdfUrl = extractedInfo.pdfUrl;
        if (!absolutePdfUrl.startsWith('http')) {
            const baseUrl = new URL(targetUrl);
            absolutePdfUrl = new URL(absolutePdfUrl, baseUrl.origin).href;
        }

        console.log('📥 Fetching PDF from:', absolutePdfUrl);

        // Fetch the actual PDF
        const pdfPage = await browser.newPage();
        await pdfPage.authenticate({ 
            username: 'purevpn0s11340994', 
            password: 'ak3t35fp' 
        });
        await pdfPage.setExtraHTTPHeaders({ 
            "Referer": targetUrl
        });

        const pdfResponse = await pdfPage.goto(absolutePdfUrl, { 
            waitUntil: 'networkidle0',
            timeout: 120000 
        });

        const status = pdfResponse.status();
        console.log('📊 PDF Response Status:', status);

        if (status !== 200) {
            throw new Error(`PDF fetch failed with HTTP ${status}`);
        }

        const finalBuffer = await pdfResponse.buffer();
        console.log('📦 Final buffer size:', finalBuffer.length);

        if (finalBuffer.length < 100) {
            throw new Error('PDF buffer too small');
        }

        const signature = finalBuffer.slice(0, 5).toString();
        console.log('🔍 Final PDF Signature:', signature);
        
        if (!signature.includes('%PDF')) {
            console.log('❌ Not a PDF, content starts with:', finalBuffer.slice(0, 100).toString());
            throw new Error('Response is not a valid PDF file');
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', finalBuffer.length);
        res.setHeader('Content-Disposition', 'attachment; filename="lecture-notes.pdf"');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(finalBuffer);

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
        service: 'PDF Extractor API',
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({
        service: 'PDF Extractor API',
        description: 'Extracts PDF from HTML viewer pages',
        usage: '/pdf?url=<encoded_viewer_url>'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ PDF Extractor API running on port ${PORT}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});
