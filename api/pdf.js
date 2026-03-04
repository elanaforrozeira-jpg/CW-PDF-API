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
    // If URL doesn't start with http/https, assume it's from cwmediabkt99.crwilladmin.com
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

            const response = await page.goto(targetUrl, {
                waitUntil: 'networkidle2',
                timeout: 60000
            });

            const status = response ? response.status() : 0;

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

            if (status >= 400) {
                await releasePage(page, entry);
                return res.status(status).json({
                    status: 'fail',
                    message: `Upstream returned HTTP ${status}`
                });
            }

            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true
            });

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
            console.error('❌ PDF generation error:', err.message);
            return res.status(500).json({
                status: 'fail',
                message: 'Failed to generate PDF',
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