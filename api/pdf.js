const express = require('express');
const { getPage, releasePage } = require('./browserPool');
const app = express();

const CW_HOST = 'cwmediabkt99.crwilladmin.com';
const CW_ORIGIN = `https://${CW_HOST}`;
const MAX_RETRIES = 4;

function normalizeUrl(rawUrl) {
  let targetUrl = decodeURIComponent(rawUrl || '').trim();
  if (!targetUrl) return null;

  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `${CW_ORIGIN}${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;
  }

  return targetUrl;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

app.get('/pdf', async (req, res) => {
  const rawUrl = req.query.url;
  if (!rawUrl) {
    return res.status(400).json({
      status: 'fail',
      message: 'URL parameter missing'
    });
  }

  const targetUrl = normalizeUrl(rawUrl);
  if (!targetUrl) {
    return res.status(400).json({
      status: 'fail',
      message: 'Invalid URL parameter'
    });
  }

  // Domain validation
  try {
    const parsed = new URL(targetUrl);
    if (parsed.hostname !== CW_HOST) {
      return res.status(400).json({
        status: 'fail',
        message: `Only ${CW_HOST} domain is supported`
      });
    }
  } catch (e) {
    return res.status(400).json({
      status: 'fail',
      message: `Invalid URL: ${e.message}`
    });
  }

  let pageHandle = null;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🚀 Attempt ${attempt}/${MAX_RETRIES} - ${targetUrl}`);

      pageHandle = await getPage();
      const { page } = pageHandle;

      // Establish CW session
      console.log('🌐 Establishing session...');
      await page.goto(`${CW_ORIGIN}/`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      await sleep(700);

      console.log('📥 Fetching PDF using browser context...');

      const pdfData = await page.evaluate(async (url) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 45000);

          const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: {
              Accept: 'application/pdf,*/*'
            },
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          const contentType = response.headers.get('content-type') || '';

          if (!response.ok) {
            const txt = await response.text().catch(() => '');
            return {
              error: `HTTP ${response.status}`,
              status: response.status,
              contentType,
              preview: txt.slice(0, 300)
            };
          }

          const ab = await response.arrayBuffer();
          const bytes = new Uint8Array(ab);

          return {
            ok: true,
            size: bytes.length,
            contentType,
            data: Array.from(bytes.slice(0, Math.min(bytes.length, 25_000_000))) // hard cap safety
          };
        } catch (e) {
          return { error: e.message || 'Unknown fetch error' };
        }
      }, targetUrl);

      if (!pdfData || pdfData.error) {
        throw new Error(
          pdfData?.preview
            ? `${pdfData.error} | preview: ${pdfData.preview}`
            : (pdfData?.error || 'Unknown download error')
        );
      }

      const pdfBuffer = Buffer.from(pdfData.data);
      const sig = pdfBuffer.slice(0, 8).toString('utf8');

      // PDF signature validation ONLY (no "too small" rejection)
      if (!sig.includes('%PDF')) {
        const preview = pdfBuffer.slice(0, 300).toString('utf8');
        throw new Error(`Not a PDF response. content-type=${pdfData.contentType}; preview=${preview}`);
      }

      console.log(`✅ PDF OK | size=${pdfBuffer.length} | type=${pdfData.contentType}`);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Content-Disposition', 'attachment; filename="lecture-notes.pdf"');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(pdfBuffer);

      if (pageHandle) {
        await releasePage(pageHandle.page, pageHandle.entry);
        pageHandle = null;
      }

      return;
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ Attempt ${attempt} failed: ${err.message}`);

      if (pageHandle) {
        await releasePage(pageHandle.page, pageHandle.entry);
        pageHandle = null;
      }

      if (attempt < MAX_RETRIES) {
        const delay = 800 * Math.pow(2, attempt - 1);
        console.log(`🔄 Rotating proxy + retry in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  console.error('❌ Final failure:', lastError?.message);
  return res.status(500).json({
    status: 'fail',
    error: lastError?.message || 'Failed to download PDF',
    url: targetUrl
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API running on ${PORT}`));
