const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { analyzeLink } = require('./analyzer');

// In-memory session store (use Redis in production)
const sessions = new Map();

router.get('/fetch', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({
      status: 'fail',
      message: 'URL parameter required'
    });
  }

  try {
    const startTime = Date.now();

    // Fast analysis (< 200ms)
    const analysis = await analyzeLink(targetUrl);
    console.log(`⚡ Analysis done in ${Date.now() - startTime}ms`);

    // Generate session ID
    const sessionId = crypto.randomBytes(16).toString('hex');

    // Store session with URL and metadata
    const session = {
      url: targetUrl,
      analysis: analysis,
      createdAt: Date.now(),
      expiresAt: Date.now() + (3600 * 1000) // 1 hour
    };

    sessions.set(sessionId, session);

    // Auto-cleanup after expiry
    setTimeout(() => sessions.delete(sessionId), 3600 * 1000);

    const responseTime = Date.now() - startTime;
    console.log(`✅ Total response time: ${responseTime}ms`);

    return res.json({
      status: 'success',
      streamUrl: `${req.protocol}://${req.get('host')}/stream/${sessionId}`,
      fileType: analysis.contentType,
      fileName: analysis.fileName,
      fileSize: analysis.size,
      expiresIn: 3600,
      responseTime: `${responseTime}ms`
    });

  } catch (error) {
    console.error('❌ Fetch error:', error);
    return res.status(500).json({
      status: 'fail',
      error: error.message
    });
  }
});

module.exports = { router, sessions };
