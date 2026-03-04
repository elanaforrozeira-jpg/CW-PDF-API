const express = require('express');
const { getPage, releasePage } = require('./browserPool');
const app = express();

app.get('/pdf', async (req, res) => {
    const rawUrl = req.query.url;
    if (!rawUrl) return res.status(400).json({ status: 'fail', message: 'URL missing' });

    let targetUrl = decodeURIComponent(rawUrl).trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        if (!targetUrl.startsWith('/')) {
            targetUrl = '/' + targetUrl;
        }
        targetUrl = 'https://cwmediabkt99.crwilladmin.com' + targetUrl;
        console.log('🔧 Normalized URL to:', targetUrl);
    }

    // Validate domain
    try {
        const parsedUrl = new URL(targetUrl);
        if (parsedUrl.hostname !== 'cwmediabkt99.crwilladmin.com') {
            return res.status(400).json({
                status: 'fail',
                message: 'Only cwmediabkt99.crwilladmin.com domain is supported'
            });
        }
    } catch (urlError) {
        return res.status(400).json({
            status: 'fail',
            message: 'Invalid URL: ' + urlError.message
        });
    }

    let pageHandle;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            console.log(`🚀 Attempt ${attempt}/3 - Downloading:`, targetUrl);
            pageHandle = await getPage();
            
            console.log('🌐 Establishing session...');
            await pageHandle.page.goto('https://cwmediabkt99.crwilladmin.com/', { 
                waitUntil: 'domcontentloaded', 
                timeout: 30000 
            });
            await new Promise(r => setTimeout(r, 1000)); // Wait for session

            console.log('📥 Fetching PDF...');
            const pdfData = await pageHandle.page.evaluate(async (url) => {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 30000);

                    const response = await fetch(url, {
                        method: 'GET',
                        credentials: 'include',
                        headers: { 'Accept': 'application/pdf,*/*' },
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        return { error: `HTTP ${response.status}`, status: response.status };
                    }
                    const blob = await response.blob();
                    const buffer = await blob.arrayBuffer();
                    return { 
                        data: Array.from(new Uint8Array(buffer)), 
                        size: buffer.byteLength,
                        type: blob.type
                    };
                } catch (e) {
                    return { error: e.message };
                }
            }, targetUrl);

            if (pdfData.error) throw new Error(`Fetch failed: ${pdfData.error}`);
            if (pdfData.size < 1000) throw new Error(`PDF too small: ${pdfData.size} bytes (likely error page)`);

            const pdfBuffer = Buffer.from(pdfData.data);
            const signature = pdfBuffer.slice(0, 5).toString();
            
            if (!signature.includes('%PDF')) {
                const preview = pdfBuffer.slice(0, 100).toString();
                console.log('❌ Not a PDF! Preview:', preview);
                throw new Error('Downloaded file is not a PDF');
            }

            console.log(`✅ Valid PDF! Size: ${pdfData.size} bytes`);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Length', pdfBuffer.length);
            res.setHeader('Content-Disposition', 'attachment; filename="lecture-notes.pdf"');
            res.send(pdfBuffer);
            
            console.log('✅ PDF sent successfully!\n');
            if (pageHandle) await releasePage(pageHandle.page, pageHandle.entry);
            return;
            
        } catch (err) {
            console.error(`❌ Attempt ${attempt}/3 failed:`, err.message);
            if (pageHandle) { 
                await releasePage(pageHandle.page, pageHandle.entry); 
                pageHandle = null; 
            }
            if (attempt < 3) {
                const delay = 1000 * Math.pow(2, attempt - 1);
                console.log(`🔄 Retrying with different proxy in ${delay}ms...\n`);
                await new Promise(r => setTimeout(r, delay));
            } else {
                return res.status(500).json({ 
                    status: 'fail', 
                    error: err.message,
                    url: targetUrl
                });
            }
        }
    }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API running on port ${PORT}`));
