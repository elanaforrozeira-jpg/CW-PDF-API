const express = require('express');
const http = require('http');
const { URL } = require('url');
const router = express.Router();

// Sessions map injected from fetch.js via setSessions()
let sessions;

// Proxy config
const PROXY_HOST = 'Px031901.pointtoserver.com';
const PROXY_PORT = 10780;
const PROXY_USER = 'purevpn0s11340994';
const PROXY_PASS = 'ak3t35fp';

router.get('/stream/:sessionId', async (req, res) => {
  const sessionId = req.params.sessionId;
  const session = sessions && sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({
      status: 'fail',
      message: 'Session expired or not found'
    });
  }

  // Check expiry
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return res.status(410).json({
      status: 'fail',
      message: 'Session expired'
    });
  }

  const targetUrl = session.url;
  const parsedUrl = new URL(targetUrl);

  console.log('📡 Streaming:', targetUrl);

  // Handle Range requests for video streaming
  const range = req.headers.range;

  const proxyOptions = {
    host: PROXY_HOST,
    port: PROXY_PORT,
    method: 'GET',
    path: targetUrl,
    headers: {
      'Host': parsedUrl.host,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Connection': 'keep-alive',
      'Proxy-Authorization': 'Basic ' + Buffer.from(`${PROXY_USER}:${PROXY_PASS}`).toString('base64')
    }
  };

  // Forward Range header for partial content
  if (range) {
    proxyOptions.headers['Range'] = range;
  }

  const proxyReq = http.request(proxyOptions, (proxyRes) => {
    // Forward status code and headers
    res.writeHead(proxyRes.statusCode, proxyRes.headers);

    // Stream response
    proxyRes.pipe(res);

    proxyRes.on('error', (err) => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream content from remote server' });
      }
    });
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to connect to proxy server' });
    }
  });

  // Handle client disconnect
  req.on('close', () => {
    proxyReq.destroy();
  });

  proxyReq.end();
});

function setSessions(sessionsMap) {
  sessions = sessionsMap;
}

module.exports = { router, setSessions };
