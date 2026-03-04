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

        console.log('📥 Fetching PDF using browser context...');

        const MAX_RETRIES = 3;
        let pdfData;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            console.log(`📥 Fetch attempt ${attempt}/${MAX_RETRIES} for: ${targetUrl}`);

            // Fetch PDF inside browser context using native fetch (proxy auth inherited)
            pdfData = await pageHandle.page.evaluate(async (url) => {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 40000);
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

            if (!pdfData.error) {
                break; // success
            }

            const is502 = pdfData.status === 502;
            console.warn(`⚠️ Attempt ${attempt} failed: ${pdfData.error} (URL: ${targetUrl})`);

            if (is502 && attempt < MAX_RETRIES) {
                const delay = 1000 * Math.pow(2, attempt - 1);
                console.log(`🔄 502 error - rotating proxy and retrying in ${delay}ms...`);

                // Release current page and acquire a new one backed by a different proxy
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
            } else if (!is502) {
                break;
            }
        }

        if (pdfData.error) {
            const errMsg = pdfData.status
                ? `Fetch failed: HTTP ${pdfData.status} (${targetUrl})`
                : `Fetch failed: ${pdfData.error} (${targetUrl})`;
            throw new Error(errMsg);
        }

        console.log('📦 PDF fetched! Size:', pdfData.size, 'bytes');
        console.log('📄 Content-Type:', pdfData.type);

        if (pdfData.size < 1000) {
            throw new Error('PDF too small: ' + pdfData.size + ' bytes');
        }

        const pdfBuffer = Buffer.from(pdfData.data);

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
