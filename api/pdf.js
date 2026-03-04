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

    let targetUrl = decodeURIComponent(rawUrl).trim();

    // AUTO-DETECT AND FIX URL FORMAT
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        if (!targetUrl.startsWith('/')) {
            targetUrl = '/' + targetUrl;
        }
        targetUrl = 'https://cwmediabkt99.crwilladmin.com' + targetUrl;
        console.log('🔧 Auto-fixed URL to:', targetUrl);
    }

    // VALIDATE IT'S A CW DOMAIN URL
    let parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
    } catch (e) {
        return res.status(400).json({
            status: 'fail',
            message: 'Invalid URL format'
        });
    }

    if (parsedUrl.hostname !== 'cwmediabkt99.crwilladmin.com') {
        return res.status(400).json({
            status: 'fail',
            message: 'Only cwmediabkt99.crwilladmin.com URLs are supported'
        });
    }

    let pageHandle;
    const MAX_502_RETRIES = 3;

    for (let attempt = 0; attempt <= MAX_502_RETRIES; attempt++) {
        try {
            pageHandle = await getPage();
            const { page, entry } = pageHandle;

            // Establish session
            console.log('🌐 Establishing session...');
            await page.goto('https://cwmediabkt99.crwilladmin.com/', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            console.log('📥 Downloading PDF using fetch...');

            // ✅ CORRECT METHOD: Download PDF using browser's fetch API
            const pdfData = await page.evaluate(async (url) => {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 30000);
                    
                    const response = await fetch(url, {
                        method: 'GET',
                        credentials: 'include',
                        headers: {
                            'Accept': 'application/pdf,*/*'
                        },
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        return { error: `HTTP ${response.status}`, status: response.status };
                    }

                    const blob = await response.blob();
                    const arrayBuffer = await blob.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);

                    return {
                        data: Array.from(uint8Array),
                        size: uint8Array.length,
                        type: blob.type
                    };
                } catch (e) {
                    return { error: e.message };
                }
            }, targetUrl);

            if (pdfData.error) {
                const status = pdfData.status || 500;
                
                if (status === 502) {
                    console.warn(`⚠️ 502 on attempt ${attempt + 1}, rotating proxy...`);
                    await releasePage(page, entry);
                    pageHandle = null;
                    if (attempt < MAX_502_RETRIES) {
                        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
                        continue;
                    }
                    return res.status(502).json({
                        status: 'fail',
                        message: 'Upstream server returned 502 after retries'
                    });
                }
                
                await releasePage(page, entry);
                return res.status(status).json({
                    status: 'fail',
                    message: pdfData.error
                });
            }

            console.log('📦 PDF fetched! Size:', pdfData.size, 'bytes');

            if (pdfData.size < 1000) {
                await releasePage(page, entry);
                return res.status(500).json({
                    status: 'fail',
                    message: 'PDF too small: ' + pdfData.size + ' bytes'
                });
            }

            // Convert array back to Buffer
            const pdfBuffer = Buffer.from(pdfData.data);

            // Verify PDF signature
            const signature = pdfBuffer.slice(0, 5).toString();
            console.log('🔍 Signature:', signature);

            if (!signature.includes('%PDF')) {
                const preview = pdfBuffer.slice(0, 100).toString();
                console.log('❌ Not a PDF! Preview:', preview);
                await releasePage(page, entry);
                return res.status(500).json({
                    status: 'fail',
                    message: 'Downloaded file is not a PDF'
                });
            }

            console.log('✅ Valid PDF confirmed!');

            await releasePage(page, entry);

            const filename = parsedUrl.pathname.split('/').pop() || 'document.pdf';
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
            return res.send(pdfBuffer);

        } catch (err) {
            if (pageHandle) {
                try {
                    await releasePage(pageHandle.page, pageHandle.entry);
                } catch (_) {}
                pageHandle = null;
            }
            console.error('❌ PDF download error:', err.message);
            return res.status(500).json({
                status: 'fail',
                message: 'Failed to download PDF',
                error: err.message
            });
        }
    }
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 PDF API running on port ${PORT}`);
    });
}

module.exports = app;
