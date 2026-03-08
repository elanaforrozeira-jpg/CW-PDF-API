const http = require('http');
const { URL } = require('url');

// Proxy config (reuse from existing)
const PROXY_HOST = 'Px031901.pointtoserver.com';
const PROXY_PORT = 10780;
const PROXY_USER = 'purevpn0s11340994';
const PROXY_PASS = 'ak3t35fp';

async function analyzeLink(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const timeout = 5000; // 5s max for analysis

    const proxyOptions = {
      host: PROXY_HOST,
      port: PROXY_PORT,
      method: 'HEAD', // Fast - only headers
      path: targetUrl,
      headers: {
        'Host': parsedUrl.host,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Proxy-Authorization': 'Basic ' + Buffer.from(`${PROXY_USER}:${PROXY_PASS}`).toString('base64')
      },
      timeout: timeout
    };

    const req = http.request(proxyOptions, (res) => {
      // Extract filename from URL or Content-Disposition
      const fileName = extractFileName(targetUrl, res.headers);
      const contentType = res.headers['content-type'] || 'application/octet-stream';
      const size = parseInt(res.headers['content-length']) || 0;

      resolve({
        contentType: contentType,
        size: size,
        fileName: fileName,
        needsAuth: res.statusCode === 401 || res.statusCode === 403,
        statusCode: res.statusCode
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Analysis timeout'));
    });

    req.end();
  });
}

function extractFileName(url, headers) {
  // Try Content-Disposition header
  const disposition = headers['content-disposition'];
  if (disposition) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match) return match[1].trim();
  }

  // Extract from URL
  const urlPath = new URL(url).pathname;
  const parts = urlPath.split('/');
  return parts[parts.length - 1] || 'download';
}

module.exports = { analyzeLink };
