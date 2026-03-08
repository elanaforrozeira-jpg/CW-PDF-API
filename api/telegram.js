const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const https = require('https');
const path = require('path');
const { URL } = require('url');

const router = express.Router();

// Telegram Bot Configuration from environment
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

let bot = null;
if (TELEGRAM_TOKEN) {
    bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });
    console.log('✅ Telegram bot initialised');
} else {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN not set – Telegram uploads will fail');
}

// Proxy pool (mirrors api/browserPool.js PROXY_POOL)
const PROXY_POOL = [
    { host: 'px340403.pointtoserver.com', port: 10780, username: 'purevpn0s12456771', password: 'fc0bdh0p' },
    { host: 'px1400403.pointtoserver.com', port: 10780, username: 'purevpn0s12456771', password: 'fc0bdh0p' },
    { host: 'px173007.pointtoserver.com', port: 10780, username: 'purevpn0s12456771', password: 'fc0bdh0p' },
    { host: 'px350401.pointtoserver.com', port: 10780, username: 'purevpn0s11340994', password: 'ak3t35fp' },
    { host: 'px031901.pointtoserver.com', port: 10780, username: 'purevpn0s11340994', password: 'ak3t35fp' }
];

let currentProxyIndex = 0;

function getNextProxy() {
    const proxy = PROXY_POOL[currentProxyIndex];
    currentProxyIndex = (currentProxyIndex + 1) % PROXY_POOL.length;
    return proxy;
}

// Custom headers per domain pattern
function buildHeaders(parsedUrl, cookies) {
    const headers = {
        'Host': parsedUrl.host,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive'
    };

    // Add referer based on known domains
    if (parsedUrl.hostname.includes('utkarshapp')) {
        headers['Referer'] = 'https://learn.utkarsh.com/';
    } else if (parsedUrl.hostname.includes('crwilladmin')) {
        headers['Referer'] = 'https://cwmediabkt99.crwilladmin.com/';
    }

    if (cookies) {
        headers['Cookie'] = cookies;
    }

    return headers;
}

// Download a file through a proxy with retry logic
async function downloadFile(targetUrl, cookies = '', attempt = 0) {
    const MAX_ATTEMPTS = 3;

    return new Promise((resolve, reject) => {
        let parsedUrl;
        try {
            parsedUrl = new URL(targetUrl);
        } catch (e) {
            return reject(new Error(`Invalid URL: ${targetUrl}`));
        }

        const proxy = getNextProxy();
        console.log(`📡 [Attempt ${attempt + 1}/${MAX_ATTEMPTS}] Downloading via proxy ${proxy.host}: ${targetUrl}`);

        const proxyAuth = Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64');
        const headers = buildHeaders(parsedUrl, cookies);
        headers['Proxy-Authorization'] = `Basic ${proxyAuth}`;

        const options = {
            host: proxy.host,
            port: proxy.port,
            method: 'GET',
            path: targetUrl,
            headers
        };

        const req = http.request(options, (res) => {
            console.log(`📊 Response status: ${res.statusCode}`);

            // Follow redirects (up to 5 hops)
            if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) && res.headers.location) {
                const redirectUrl = res.headers.location;
                console.log(`🔄 Redirecting to: ${redirectUrl}`);
                return downloadFile(redirectUrl, cookies, attempt)
                    .then(resolve)
                    .catch(reject);
            }

            if (res.statusCode !== 200) {
                let body = '';
                res.on('data', (c) => { body += c.toString(); });
                res.on('end', () => {
                    const err = new Error(`HTTP ${res.statusCode}: ${body.substring(0, 300)}`);
                    if (attempt + 1 < MAX_ATTEMPTS) {
                        console.warn(`⚠️  Attempt ${attempt + 1} failed, retrying…`);
                        return downloadFile(targetUrl, cookies, attempt + 1).then(resolve).catch(reject);
                    }
                    reject(err);
                });
                return;
            }

            const contentType = res.headers['content-type'] || '';
            const chunks = [];
            let downloadedSize = 0;
            let lastLoggedMB = 0;

            res.on('data', (chunk) => {
                chunks.push(chunk);
                downloadedSize += chunk.length;
                const downloadedMB = Math.floor(downloadedSize / (5 * 1024 * 1024));
                if (downloadedMB > lastLoggedMB) {
                    lastLoggedMB = downloadedMB;
                    console.log(`📥 Downloaded: ${(downloadedSize / 1024 / 1024).toFixed(1)} MB`);
                }
            });

            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                console.log(`✅ Download complete: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
                resolve({ buffer, contentType });
            });

            res.on('error', (err) => {
                if (attempt + 1 < MAX_ATTEMPTS) {
                    console.warn(`⚠️  Stream error on attempt ${attempt + 1}, retrying…`);
                    return downloadFile(targetUrl, cookies, attempt + 1).then(resolve).catch(reject);
                }
                reject(err);
            });
        });

        req.on('error', (err) => {
            if (attempt + 1 < MAX_ATTEMPTS) {
                console.warn(`⚠️  Request error on attempt ${attempt + 1} (${err.message}), retrying…`);
                return downloadFile(targetUrl, cookies, attempt + 1).then(resolve).catch(reject);
            }
            reject(err);
        });

        req.setTimeout(120000, () => {
            req.destroy();
            const err = new Error('Request timeout (2 min)');
            if (attempt + 1 < MAX_ATTEMPTS) {
                console.warn(`⚠️  Timeout on attempt ${attempt + 1}, retrying…`);
                return downloadFile(targetUrl, cookies, attempt + 1).then(resolve).catch(reject);
            }
            reject(err);
        });

        req.end();
    });
}

// Detect file type from URL, content-type header, and magic bytes
function detectFileType(urlStr, contentType, buffer) {
    const ext = path.extname(new URL(urlStr).pathname).toLowerCase();

    // Check URL extension first
    if (ext === '.mp4' || ext === '.mkv' || ext === '.avi' || ext === '.mov' || ext === '.webm') {
        return 'video';
    }
    if (ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.gif' || ext === '.webp') {
        return 'photo';
    }

    // Check Content-Type header
    if (contentType.includes('video/')) {
        return 'video';
    }
    if (contentType.includes('image/')) {
        return 'photo';
    }

    // Check magic bytes / file signature
    if (buffer && buffer.length >= 8) {
        // MP4: ftyp box at offset 4
        if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
            return 'video';
        }
        // JPEG: FF D8 FF
        if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
            return 'photo';
        }
        // PNG: 89 50 4E 47
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
            return 'photo';
        }
    }

    // Default: send as document
    return 'document';
}

// Upload buffer to Telegram using the appropriate method
async function uploadToTelegram(chatId, buffer, filename, fileType) {
    if (!bot) {
        throw new Error('Telegram bot is not initialised – set TELEGRAM_BOT_TOKEN');
    }

    console.log(`📤 Uploading ${fileType} "${filename}" (${(buffer.length / 1024 / 1024).toFixed(2)} MB) to Telegram chat ${chatId}`);

    const options = { filename, contentType: 'application/octet-stream' };

    if (fileType === 'video') {
        return bot.sendVideo(chatId, buffer, {}, { filename, contentType: 'video/mp4' });
    }

    if (fileType === 'photo') {
        return bot.sendPhoto(chatId, buffer, {}, { filename });
    }

    // Default: document
    return bot.sendDocument(chatId, buffer, {}, options);
}

// Derive a sensible filename from a URL
function filenameFromUrl(urlStr) {
    try {
        const base = path.basename(new URL(urlStr).pathname);
        return base || 'file';
    } catch (_) {
        return 'file';
    }
}

// POST /fetch-and-upload
router.post('/fetch-and-upload', async (req, res) => {
    const { link, telegram_chat_id, cookies } = req.body || {};
    const chatId = telegram_chat_id || DEFAULT_CHAT_ID;

    if (!link) {
        return res.status(400).json({ status: 'fail', message: 'link parameter is required' });
    }

    if (!chatId) {
        return res.status(400).json({ status: 'fail', message: 'No Telegram chat ID – set TELEGRAM_CHAT_ID env var or pass telegram_chat_id' });
    }

    console.log(`🚀 fetch-and-upload request: ${link}`);

    try {
        // 1. Download the file
        let downloadResult;
        try {
            downloadResult = await downloadFile(link, cookies || '');
        } catch (dlErr) {
            // Retry once without cookies
            if (cookies) {
                console.warn('⚠️  Download failed with cookies, retrying without cookies…');
                downloadResult = await downloadFile(link, '');
            } else {
                throw dlErr;
            }
        }

        const { buffer, contentType } = downloadResult;
        const filename = filenameFromUrl(link);
        const fileType = detectFileType(link, contentType, buffer);

        console.log(`🔍 Detected file type: ${fileType}, content-type: "${contentType}", filename: "${filename}"`);

        // 2. Upload to Telegram
        const message = await uploadToTelegram(chatId, buffer, filename, fileType);

        console.log(`✅ Upload successful! Message ID: ${message.message_id}`);

        return res.json({
            status: 'ok',
            file_type: fileType,
            filename,
            size_bytes: buffer.length,
            telegram_message_id: message.message_id,
            chat_id: chatId
        });

    } catch (error) {
        console.error(`❌ fetch-and-upload error: ${error.message}`);
        console.error(error.stack);
        return res.status(500).json({
            status: 'fail',
            error: error.message,
            link
        });
    }
});

module.exports = router;
