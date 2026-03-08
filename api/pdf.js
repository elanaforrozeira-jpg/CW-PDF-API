const express = require('express');
const puppeteer = require('puppeteer-core');
const https = require('https');
const http = require('http');
const zlib = require('zlib');
const { URL } = require('url');
const app = express();
app.use(express.json());

// Proxy configuration
const PROXY_HOST = 'Px031901.pointtoserver.com';
const PROXY_PORT = 10780;
const PROXY_USER = 'purevpn0s11340994';
const PROXY_PASS = 'ak3t35fp';

// Function to download PDF via proxy with streaming
async function downloadPDFWithProxy(targetUrl, cookies = '') {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(targetUrl);
        
        const proxyOptions = {
            host: PROXY_HOST,
            port: PROXY_PORT,
            method: 'GET',
            path: targetUrl,
            headers: {
                'Host': parsedUrl.host,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/pdf,application/octet-stream,*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': `${parsedUrl.protocol}//${parsedUrl.host}/`,
                'Connection': 'keep-alive',
                'Proxy-Authorization': 'Basic ' + Buffer.from(`${PROXY_USER}:${PROXY_PASS}`).toString('base64')
            }
        };

        if (cookies) {
            proxyOptions.headers['Cookie'] = cookies;
            console.log('🍪 Cookies added to request');
        }

        console.log('📡 Target host:', parsedUrl.host);
        console.log('📡 Using cookies:', cookies ? 'Yes' : 'No');
        console.log('📡 Making proxy request to:', targetUrl);

        const req = http.request(proxyOptions, (res) => {
            console.log('📊 Response status:', res.statusCode);
            console.log('📋 Response headers:', res.headers);

            if (res.statusCode === 302 || res.statusCode === 301) {
                const redirectUrl = res.headers.location;
                console.log('🔄 Following redirect to:', redirectUrl);
                return downloadPDFWithProxy(redirectUrl, cookies)
                    .then(resolve)
                    .catch(reject);
            }

            if (res.statusCode !== 200) {
                let errorBody = '';
                res.on('data', chunk => errorBody += chunk.toString());
                res.on('end', () => {
                    reject(new Error(`HTTP ${res.statusCode}: ${errorBody.substring(0, 500)}`));
                });
                return;
            }

            const chunks = [];
            let downloadedSize = 0;

            res.on('data', (chunk) => {
                chunks.push(chunk);
                downloadedSize += chunk.length;
                if (downloadedSize % (1024 * 1024) === 0) { // Log every 1MB
                    console.log(`📥 Downloaded: ${(downloadedSize / 1024 / 1024).toFixed(2)} MB`);
                }
            });

            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                console.log('✅ Download complete! Total size:', (buffer.length / 1024 / 1024).toFixed(2), 'MB');
                resolve(buffer);
            });

            res.on('error', reject);
        });

        req.on('error', reject);
        req.setTimeout(120000, () => { // 2 minute timeout
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

// Fallback download function with minimal headers (for stubborn domains)
async function downloadPDFWithProxyDirect(targetUrl) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(targetUrl);

        console.log('🔧 Using minimal headers for:', parsedUrl.host);

        const proxyOptions = {
            host: PROXY_HOST,
            port: PROXY_PORT,
            method: 'GET',
            path: targetUrl,
            headers: {
                'Host': parsedUrl.host,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
                'Proxy-Authorization': 'Basic ' + Buffer.from(`${PROXY_USER}:${PROXY_PASS}`).toString('base64')
            }
        };

        const req = http.request(proxyOptions, (res) => {
            console.log('📊 Fallback response status:', res.statusCode);

            if (res.statusCode === 302 || res.statusCode === 301) {
                const redirectUrl = res.headers.location;
                console.log('🔄 Following redirect:', redirectUrl);
                return downloadPDFWithProxyDirect(redirectUrl)
                    .then(resolve)
                    .catch(reject);
            }

            if (res.statusCode !== 200) {
                let errorBody = '';
                res.on('data', chunk => errorBody += chunk.toString());
                res.on('end', () => {
                    reject(new Error(`HTTP ${res.statusCode}: ${errorBody.substring(0, 200)}`));
                });
                return;
            }

            const chunks = [];
            let downloadedSize = 0;

            res.on('data', (chunk) => {
                chunks.push(chunk);
                downloadedSize += chunk.length;
                if (downloadedSize % (1024 * 1024) === 0) {
                    console.log(`📥 Fallback download: ${(downloadedSize / 1024 / 1024).toFixed(2)} MB`);
                }
            });

            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                console.log('✅ Fallback download complete:', (buffer.length / 1024 / 1024).toFixed(2), 'MB');
                resolve(buffer);
            });

            res.on('error', reject);
        });

        req.on('error', reject);
        req.setTimeout(120000, () => {
            req.destroy();
            reject(new Error('Fallback request timeout'));
        });

        req.end();
    });
}

// Function to get cookies using Puppeteer (lightweight session establishment)
async function getCookies(domain) {
    let browser;
    try {
        console.log('🍪 Getting cookies for domain:', domain);

        browser = await puppeteer.launch({
            executablePath: '/usr/bin/google-chrome-stable',
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--single-process',
                '--no-zygote',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--proxy-server=Px031901.pointtoserver.com:10780'
            ],
            ignoreDefaultArgs: ['--enable-automation']
        });

        const page = await browser.newPage();

        await page.authenticate({ 
            username: 'purevpn0s11340994', 
            password: 'ak3t35fp' 
        });

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        );

        console.log('🌐 Visiting domain:', domain);

        // Visit domain with reduced timeout (faster failure)
        await page.goto(domain, { 
            waitUntil: 'domcontentloaded',
            timeout: 15000  // Reduced from 30000 - fail faster
        });

        const cookies = await page.cookies();
        console.log('🍪 Received', cookies.length, 'cookies from', domain);

        if (cookies.length === 0) {
            console.warn('⚠️ No cookies received from', domain);
        }

        // Format cookies for HTTP header
        const cookieString = cookies
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join('; ');

        return cookieString;

    } catch (error) {
        console.error('❌ Cookie fetch failed for', domain);
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        throw error;  // Propagate to trigger fallback
    } finally {
        if (browser) {
            try {
                await browser.close();
            } catch (closeError) {
                console.error('⚠️ Browser close error:', closeError.message);
            }
        }
    }
}

app.get('/pdf', async (req, res) => {
    const rawUrl = req.query.url;
    const compress = req.query.compress === 'true';
    const useCookies = req.query.cookies !== 'false'; // Default true
    
    if (!rawUrl) {
        return res.status(400).json({ 
            status: "fail", 
            message: "URL parameter missing" 
        });
    }
    
    const targetUrl = decodeURIComponent(rawUrl).trim();

    try {
        console.log('🚀 Starting download:', targetUrl);
        try {
            const urlExt = new URL(targetUrl).pathname.split('.').pop();
            console.log('📋 File type from URL:', urlExt);
        } catch (e) {
            console.log('📋 File type from URL: unknown');
        }
        console.log('⚙️ Cookies enabled:', useCookies);
        console.log('⚙️ Compression enabled:', compress);

        let cookies = '';
        
        // Get cookies if needed (for authenticated files)
        if (useCookies) {
            try {
                // Extract domain from target URL dynamically
                const parsedUrl = new URL(targetUrl);
                const targetDomain = `${parsedUrl.protocol}//${parsedUrl.host}`;

                console.log('🌐 Target domain:', targetDomain);
                console.log('🍪 Attempting cookie fetch for:', targetDomain);

                // Try to get cookies with timeout
                const cookiePromise = getCookies(targetDomain);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Cookie fetch timeout')), 15000)
                );

                cookies = await Promise.race([cookiePromise, timeoutPromise]);
                console.log('✅ Cookies fetched successfully');
            } catch (cookieError) {
                console.warn('⚠️ Cookie retrieval failed:', cookieError.message);
                console.log('🔄 Proceeding with direct download (no cookies)');
                // Continue with empty cookies - will try direct download
            }
        }

        // Download via proxy with retry logic
        let pdfBuffer;
        let lastError;

        // Attempt 1: With cookies (if available)
        try {
            console.log('📥 Attempt 1: Downloading with cookies...');
            pdfBuffer = await downloadPDFWithProxy(targetUrl, cookies);
        } catch (error) {
            console.warn('⚠️ Download failed with cookies:', error.message);
            lastError = error;

            // Attempt 2: Without cookies (direct access)
            if (cookies) {
                try {
                    console.log('📥 Attempt 2: Retrying without cookies...');
                    pdfBuffer = await downloadPDFWithProxy(targetUrl, '');
                } catch (error2) {
                    console.error('⚠️ Download failed without cookies:', error2.message);
                    lastError = error2;

                    // Attempt 3: Fallback with minimal headers
                    try {
                        console.log('📥 Attempt 3: Final attempt with modified headers...');
                        pdfBuffer = await downloadPDFWithProxyDirect(targetUrl);
                    } catch (error3) {
                        console.error('❌ All download attempts failed');
                        throw error3;
                    }
                }
            } else {
                // Attempt 2 (no-cookie path): Fallback with minimal headers
                try {
                    console.log('📥 Attempt 2: Final attempt with modified headers...');
                    pdfBuffer = await downloadPDFWithProxyDirect(targetUrl);
                } catch (error2) {
                    console.error('❌ All download attempts failed');
                    throw lastError;
                }
            }
        }

        // Detect file type (no blocking - allow all file types)
        const signature = pdfBuffer.slice(0, 5).toString();
        console.log('🔍 File signature:', signature);

        let detectedType = 'unknown';
        if (signature.includes('%PDF')) {
            detectedType = 'pdf';
            console.log('✅ PDF file detected');
        } else if (pdfBuffer.slice(4, 8).toString('ascii') === 'ftyp') {
            detectedType = 'video';
            console.log('✅ Video file detected (MP4/M4V)');
        } else {
            console.log('✅ File detected, type:', detectedType);
        }

        console.log('📦 File size:', (pdfBuffer.length / 1024 / 1024).toFixed(2), 'MB');

        // Determine content type and filename extension based on detected file type
        let contentType = 'application/octet-stream';
        let fileExt = 'bin';
        if (detectedType === 'pdf') {
            contentType = 'application/pdf';
            fileExt = 'pdf';
        } else if (detectedType === 'video') {
            contentType = 'video/mp4';
            fileExt = 'mp4';
        }

        // Derive filename from source URL, falling back to a sensible default
        let fileName;
        try {
            const urlPath = new URL(targetUrl).pathname;
            fileName = urlPath.substring(urlPath.lastIndexOf('/') + 1) || `lecture.${fileExt}`;
        } catch (e) {
            fileName = `lecture.${fileExt}`;
        }

        // Compress if requested (skip for already-compressed video files)
        const shouldCompress = compress && detectedType !== 'video';
        if (shouldCompress) {
            console.log('🗜️  Compressing...');
            const originalSize = pdfBuffer.length;
            pdfBuffer = zlib.gzipSync(pdfBuffer, { level: 6 });
            const compressedSize = pdfBuffer.length;
            console.log('📦 Compressed size:', (compressedSize / 1024 / 1024).toFixed(2), 'MB');
            console.log('💾 Compression ratio:', ((1 - compressedSize / originalSize) * 100).toFixed(2) + '%');
        }

        // Set response headers
        res.setHeader('Content-Type', shouldCompress ? 'application/gzip' : contentType);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader('Content-Disposition', `attachment; filename="${shouldCompress ? fileName + '.gz' : fileName}"`);
        res.setHeader('Cache-Control', 'no-cache');
        
        if (shouldCompress) {
            res.setHeader('Content-Encoding', 'gzip');
        }

        res.send(pdfBuffer);

        console.log('✅ File sent successfully!\n');

    } catch (error) {
        console.error('❌ ERROR:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({ 
            status: "fail", 
            error: error.message,
            url: targetUrl
        });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', method: 'streaming' });
});

// Telegram upload routes
const telegramRoutes = require('./telegram');
app.use('/api', telegramRoutes);

// Fetch & stream endpoints
const { router: fetchRouter, sessions } = require('./fetch');
const { router: streamRouter, setSessions } = require('./stream');
setSessions(sessions);
app.use(fetchRouter);
app.use(streamRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API running on ${PORT} with streaming support`));
