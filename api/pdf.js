const express = require('express');
const { getPage, releasePage } = require('./browserPool');
const app = express();

app.get('/pdf', async (req, res) => {
    const rawUrl = req.query.url;

    if (!rawUrl) {
        return res.status(400).json({
            status: 'fail',
            message: 'URL parameter missing'
        });
    }

    const targetUrl = decodeURIComponent(rawUrl).trim();
    let pageHandle;

    try {
        console.log('🚀 Starting PDF download:', targetUrl);

        pageHandle = await getPage();
        const { page, entry } = pageHandle;

        // OPTIONAL: Navigate to establish session first (only if same domain)
        try {
            const parsedUrl = new URL(targetUrl);
            if (parsedUrl.hostname === 'cwmediabkt99.crwilladmin.com') {
                console.log('🌐 Establishing session...');
                await page.goto('https://cwmediabkt99.crwilladmin.com/', {
                    waitUntil: 'domcontentloaded',
                    timeout: 30000
                });
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (parseError) {
            // Invalid URL format; let page.goto handle the error below
            console.warn('⚠️ URL parse error during session establishment:', parseError.message);
        }

        console.log('📥 Fetching PDF directly via page.goto()...');

        // Enable request interception to ensure headers on all requests
        await page.setRequestInterception(true);
        const handleRequest = interceptedRequest => {
            interceptedRequest.continue({
                headers: {
                    ...interceptedRequest.headers(),
                    'Accept': 'application/pdf,*/*'
                }
            });
        };
        page.on('request', handleRequest);

        let response;
        try {
            // Navigate directly to PDF URL - proxy authentication will work!
            response = await page.goto(targetUrl, {
                waitUntil: 'networkidle0',
                timeout: 60000
            });
        } finally {
            page.off('request', handleRequest);
            await page.setRequestInterception(false);
        }

        if (!response || !response.ok()) {
            const status = response ? response.status() : 'No response';
            throw new Error(`Failed to fetch PDF: HTTP ${status}`);
        }

        // Get PDF buffer directly
        const pdfBuffer = await response.buffer();

        // Verify content type
        const contentType = response.headers()['content-type'] || '';
        console.log('📄 Content-Type:', contentType);

        console.log('📦 PDF fetched! Size:', pdfBuffer.length, 'bytes');

        if (pdfBuffer.length < 1000) {
            throw new Error('PDF too small: ' + pdfBuffer.length + ' bytes');
        }

        // Verify PDF
        const signature = pdfBuffer.slice(0, 5).toString();
        console.log('🔍 Signature:', signature);

        if (!signature.includes('%PDF')) {
            const preview = pdfBuffer.slice(0, 100).toString();
            console.log('❌ Not a PDF! Preview:', preview);
            throw new Error('Downloaded file is not a PDF');
        }

        console.log('✅ Valid PDF confirmed!');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader('Content-Disposition', 'attachment; filename="lecture-notes.pdf"');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(pdfBuffer);

        console.log('✅ PDF sent successfully!\n');

    } catch (error) {
        console.error('❌ ERROR:', error.message);
        res.status(500).json({
            status: 'fail',
            error: error.message,
            url: targetUrl
        });
    } finally {
        if (pageHandle) await releasePage(pageHandle.page, pageHandle.entry);
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API running on ${PORT}`));
