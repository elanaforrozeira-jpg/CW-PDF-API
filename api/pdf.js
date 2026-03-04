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
        const { page } = pageHandle;

        // Navigate to establish session first (only if same domain)
        try {
            const parsedUrl = new URL(targetUrl);
            if (parsedUrl.hostname === 'cwmediabkt99.crwilladmin.com') {
                console.log('🌐 Establishing session...');
                await page.goto('https://cwmediabkt99.crwilladmin.com/', {
                    waitUntil: 'domcontentloaded',
                    timeout: 30000
                });
            }
        } catch (parseError) {
            console.warn('⚠️ URL parse error during session establishment:', parseError.message);
        }

        console.log('📥 Fetching PDF using CDP streaming...');

        const MAX_RETRIES = 3;
        let pdfBuffer;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            console.log(`📥 Fetch attempt ${attempt}/${MAX_RETRIES} for: ${targetUrl}`);

            // Use CDP to intercept the response body directly — no array duplication
            const client = await pageHandle.page.target().createCDPSession();
            let requestId = null;
            let httpStatus = null;

            try {
                await client.send('Network.enable');

                client.on('Network.responseReceived', (event) => {
                    if (event.response.url === targetUrl) {
                        requestId = event.requestId;
                        httpStatus = event.response.status;
                    }
                });

                await pageHandle.page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 60000 });

                if (httpStatus !== null && httpStatus !== 200) {
                    const is502 = httpStatus === 502;
                    console.warn(`⚠️ Attempt ${attempt} failed: HTTP ${httpStatus} (URL: ${targetUrl})`);

                    if (is502 && attempt < MAX_RETRIES) {
                        const delay = 1000 * Math.pow(2, attempt - 1);
                        console.log(`🔄 502 error - rotating proxy and retrying in ${delay}ms...`);

                        const oldHandle = pageHandle;
                        pageHandle = null;
                        await releasePage(oldHandle.page, oldHandle.entry);

                        await new Promise(r => setTimeout(r, delay));

                        pageHandle = await getPage();

                        // Re-establish session on the new page/proxy
                        try {
                            const parsedUrl = new URL(targetUrl);
                            if (parsedUrl.hostname === 'cwmediabkt99.crwilladmin.com') {
                                console.log('🌐 Re-establishing session with new proxy...');
                                await pageHandle.page.goto('https://cwmediabkt99.crwilladmin.com/', {
                                    waitUntil: 'domcontentloaded',
                                    timeout: 30000
                                });
                            }
                        } catch (parseError) {
                            console.warn('⚠️ URL parse error during session establishment:', parseError.message);
                        }
                        continue;
                    }

                    throw new Error(`Fetch failed: HTTP ${httpStatus} (${targetUrl})`);
                }

                if (!requestId) {
                    throw new Error(`No network request captured for: ${targetUrl}`);
                }

                const { body, base64Encoded } = await client.send('Network.getResponseBody', { requestId });
                pdfBuffer = Buffer.from(body, base64Encoded ? 'base64' : 'binary');
            } finally {
                await client.detach().catch(() => {});
            }

            break;
        }

        console.log('📦 PDF fetched! Size:', pdfBuffer.length, 'bytes');

        if (pdfBuffer.length < 1000) {
            throw new Error('PDF too small: ' + pdfBuffer.length + ' bytes');
        }

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
