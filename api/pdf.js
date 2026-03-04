const express = require('express');
const { getPage, releasePage } = require('./browserPool');
const app = express();

const CW_HOST = 'cwmediabkt99.crwilladmin.com';
const CW_ORIGIN = `https://${CW_HOST}`;
const MAX_RETRIES = 4;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeUrl(rawUrl) {
  let u = decodeURIComponent(rawUrl || '').trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) {
    u = `${CW_ORIGIN}${u.startsWith('/') ? '' : '/'}${u}`;
  }
  return u;
}

function isPdfBuffer(buf) {
  const sig = buf.slice(0, 8).toString('utf8');
  return sig.includes('%PDF');
}

function safePreviewFromBuffer(buf) {
  return buf.slice(0, 350).toString('utf8').replace(/\s+/g, ' ').trim();
}

app.get('/pdf', async (req, res) => {
  const rawUrl = req.query.url;
  if (!rawUrl) {
    return res.status(400).json({ status: 'fail', message: 'URL parameter missing' });
  }

  const targetUrl = normalizeUrl(rawUrl);
  if (!targetUrl) {
    return res.status(400).json({ status: 'fail', message: 'Invalid URL' });
  }

  try {
    const parsed = new URL(targetUrl);
    if (parsed.hostname !== CW_HOST) {
      return res.status(400).json({ status: 'fail', message: `Only ${CW_HOST} is supported` });
    }
  } catch (e) {
    return res.status(400).json({ status: 'fail', message: `Invalid URL: ${e.message}` });
  }

  let lastErr = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let pageHandle = null;
    try {
      console.log(`🚀 Attempt ${attempt}/${MAX_RETRIES} - Downloading: ${targetUrl}`);
      pageHandle = await getPage();
      const { page } = pageHandle;

      // ---- 1) Warm session on CW origin ----
      console.log('🌐 Establishing CW session...');
      await page.goto(`${CW_ORIGIN}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(800);

      // ---- 2) Try fetch in browser context with strong headers ----
      console.log('📥 Fetching via browser fetch + auth headers...');
      const fetched = await page.evaluate(async ({ url, origin }) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 45000);

          const resp = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Accept': 'application/pdf,*/*',
              'Referer': `${origin}/`,
              'Origin': origin,
              'Pragma': 'no-cache',
              'Cache-Control': 'no-cache',
              'Sec-Fetch-Site': 'same-origin',
              'Sec-Fetch-Mode': 'cors',
              'Sec-Fetch-Dest': 'empty'
            },
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          const contentType = resp.headers.get('content-type') || '';
          const status = resp.status;

          const ab = await resp.arrayBuffer();
          const bytes = new Uint8Array(ab);

          return {
            ok: resp.ok,
            status,
            contentType,
            size: bytes.length,
            data: Array.from(bytes.slice(0, Math.min(bytes.length, 30_000_000)))
          };
        } catch (e) {
          return { ok: false, status: 0, error: e.message || 'fetch failed' };
        }
      }, { url: targetUrl, origin: CW_ORIGIN });

      let pdfBuffer = null;
      let reason = '';

      if (fetched && fetched.data) {
        pdfBuffer = Buffer.from(fetched.data);
        if (isPdfBuffer(pdfBuffer)) {
          console.log(`✅ PDF via fetch | size=${pdfBuffer.length} | status=${fetched.status}`);
        } else {
          reason = `fetch-not-pdf status=${fetched.status} type=${fetched.contentType} preview=${safePreviewFromBuffer(pdfBuffer)}`;
          pdfBuffer = null;
        }
      } else {
        reason = `fetch-error status=${fetched?.status || 0} err=${fetched?.error || 'unknown'}`;
      }

      // ---- 3) Fallback: direct navigation response buffer ----
      if (!pdfBuffer) {
        console.log(`↪️ Fallback page.goto() because: ${reason}`);
        const navResp = await page.goto(targetUrl, {
          waitUntil: 'networkidle0',
          timeout: 45000
        });

        if (navResp) {
          const buf = await navResp.buffer();
          if (isPdfBuffer(buf)) {
            pdfBuffer = buf;
            console.log(`✅ PDF via goto fallback | size=${pdfBuffer.length} | status=${navResp.status()}`);
          } else {
            reason = `goto-not-pdf status=${navResp.status()} type=${navResp.headers()['content-type'] || ''} preview=${safePreviewFromBuffer(buf)}`;
          }
        } else {
          reason = `goto-no-response`;
        }
      }

      if (!pdfBuffer) {
        throw new Error(`Access denied or non-PDF response | ${reason}`);
      }

      // Success response
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Content-Disposition', 'attachment; filename="lecture-notes.pdf"');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(pdfBuffer);

      await releasePage(pageHandle.page, pageHandle.entry);
      return;
    } catch (e) {
      lastErr = e;
      console.warn(`⚠️ Attempt ${attempt} failed: ${e.message}`);
      if (pageHandle) {
        await releasePage(pageHandle.page, pageHandle.entry);
      }
      if (attempt < MAX_RETRIES) {
        const delay = 900 * Math.pow(2, attempt - 1);
        console.log(`🔄 Rotating proxy + retry in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  console.error(`❌ Final failure: ${lastErr?.message}`);
  return res.status(500).json({
    status: 'fail',
    error: lastErr?.message || 'Failed to download PDF',
    url: targetUrl
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API running on ${PORT}`));
