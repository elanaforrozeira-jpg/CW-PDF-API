const express = require('express');
const { getPage, releasePage } = require('./browserPool');
const app = express();

app.get('/pdf', async (req, res) => {
    const rawUrl = req.query.url;
    if (!rawUrl) return res.status(400).json({ status: 'fail', message: 'URL missing' });

    let targetUrl = decodeURIComponent(rawUrl).trim();
    if (!targetUrl.startsWith('http')) {
        targetUrl = 'https://cwmediabkt99.crwilladmin.com' + (targetUrl.startsWith('/') ? '' : '/') + targetUrl;
    }

    let pageHandle;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            console.log(`🚀 Attempt ${attempt}/3:`, targetUrl);
            pageHandle = await getPage();

            // Session
            await pageHandle.page.goto('https://cwmediabkt99.crwilladmin.com/', {
                waitUntil: 'domcontentloaded',
                timeout: 20000
            });

            console.log('📥 Streaming PDF (no memory load)...');

            // Navigate directly to PDF
            const response = await pageHandle.page.goto(targetUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            if (!response) throw new Error('No response');
            if (!response.ok()) throw new Error(`HTTP ${response.status()}`);

            // Stream buffer (light memory)
            const buffer = await response.buffer();

            if (buffer.length < 1000) {
                throw new Error(`Too small: ${buffer.length} bytes`);
            }

            const signature = buffer.slice(0, 5).toString();
            if (!signature.includes('%PDF')) {
                throw new Error('Not a PDF');
            }

            console.log(`✅ PDF Ready: ${buffer.length} bytes`);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Length', buffer.length);
            res.setHeader('Content-Disposition', 'attachment; filename="lecture-notes.pdf"');
            res.send(buffer);

            console.log('✅ Sent!\n');
            if (pageHandle) await releasePage(pageHandle.page, pageHandle.entry);
            return;

        } catch (err) {
            console.error(`❌ Attempt ${attempt}:`, err.message);
            if (pageHandle) {
                await releasePage(pageHandle.page, pageHandle.entry);
                pageHandle = null;
            }
            if (attempt < 3) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
            } else {
                return res.status(500).json({ status: 'fail', error: err.message });
            }
        }
    }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Running on ${PORT}`));
