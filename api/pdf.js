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

            console.log('📥 Streaming PDF download...');

            // ✅ STREAMING APPROACH: Use CDP to intercept response body
            const client = await page.target().createCDPSession();
            await client.send('Network.enable');

            let pdfStatus = 200;
            const responseMap = {};
            let resolveBuffer, rejectBuffer;
            const bufferPromise = new Promise((res, rej) => {
                resolveBuffer = res;
                rejectBuffer = rej;
            });

            client.on('Network.responseReceived', (params) => {
                if (params.response.url === targetUrl) {
                    responseMap[params.requestId] = true;
                    pdfStatus = params.response.status;
                }
            });

            client.on('Network.loadingFinished', async (params) => {
                if (responseMap[params.requestId]) {
                    delete responseMap[params.requestId];
                    try {
                        const result = await client.send('Network.getResponseBody', {
                            requestId: params.requestId
                        });
                        resolveBuffer(result.base64Encoded
                            ? Buffer.from(result.body, 'base64')
                            : Buffer.from(result.body));
                    } catch (err) {
                        console.error('❌ Failed to get response body:', err.message);
                        rejectBuffer(err);
                    }
                }
            });

            // Navigate to PDF URL
            await page.goto(targetUrl, {
                waitUntil: 'networkidle0',
                timeout: 60000
            });

            // Wait for CDP handler to populate buffer (5s safety timeout after navigation)
            let pdfBuffer;
            try {
                pdfBuffer = await Promise.race([
                    bufferPromise,
                    new Promise((_, rej) => setTimeout(() => rej(new Error('CDP buffer timeout')), 5000))
                ]);
            } catch (cdpErr) {
                if (pdfStatus === 502) {
                    console.warn(`⚠️ 502 on attempt ${attempt + 1}, rotating proxy...`);
                    await client.detach().catch(e => console.warn('Failed to detach CDP client:', e.message));
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
                await client.detach().catch(e => console.warn('Failed to detach CDP client:', e.message));
                await releasePage(page, entry);
                return res.status(pdfStatus >= 400 ? pdfStatus : 500).json({
                    status: 'fail',
                    message: pdfStatus >= 400 ? `Upstream returned HTTP ${pdfStatus}` : cdpErr.message
                });
            }

            console.log('📦 PDF streamed! Size:', pdfBuffer.length, 'bytes');

            if (pdfBuffer.length < 1000) {
                await client.detach().catch(e => console.warn('Failed to detach CDP client:', e.message));
                await releasePage(page, entry);
                return res.status(500).json({
                    status: 'fail',
                    message: 'PDF too small: ' + pdfBuffer.length + ' bytes'
                });
            }

            // Verify PDF signature
            const signature = pdfBuffer.slice(0, 5).toString();
            console.log('🔍 Signature:', signature);

            if (!signature.includes('%PDF')) {
                const preview = pdfBuffer.slice(0, 100).toString();
                console.log('❌ Not a PDF! Preview:', preview);
                await client.detach().catch(e => console.warn('Failed to detach CDP client:', e.message));
                await releasePage(page, entry);
                return res.status(500).json({
                    status: 'fail',
                    message: 'Downloaded file is not a PDF'
                });
            }

            console.log('✅ Valid PDF confirmed!');

            await client.detach().catch(e => console.warn('Failed to detach CDP client:', e.message));
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
