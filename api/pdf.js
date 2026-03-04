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

        console.log('📥 Fetching PDF using browser context...');

        // Fetch PDF inside browser context using native fetch
        const pdfData = await page.evaluate(async (url) => {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/pdf,*/*'
                    }
                });

                if (!response.ok) {
                    return { error: `HTTP ${response.status}` };
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
            throw new Error('Fetch failed: ' + pdfData.error);
        }

        console.log('📦 PDF fetched! Size:', pdfData.size, 'bytes');
        console.log('📄 Content-Type:', pdfData.type);

        if (pdfData.size < 1000) {
            throw new Error('PDF too small: ' + pdfData.size + ' bytes');
        }

        // Convert array back to Buffer
        const pdfBuffer = Buffer.from(pdfData.data);

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
