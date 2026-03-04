const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

// Proxy pool configuration
const PROXIES = [
  process.env.PROXY_1,
  process.env.PROXY_2,
  process.env.PROXY_3,
  process.env.PROXY_4,
  process.env.PROXY_5,
].filter(Boolean);

let currentProxyIndex = 0;

function getNextProxy() {
  if (PROXIES.length === 0) return null;
  const proxy = PROXIES[currentProxyIndex];
  currentProxyIndex = (currentProxyIndex + 1) % PROXIES.length;
  return proxy;
}

// Improved URL normalization
function normalizeUrl(url) {
  try {
    // Remove extra whitespace
    url = url.trim();
    
    // If it's just a path, add the CW domain
    if (url.startsWith('/')) {
      return `https://cwmediabkt99.crwilladmin.com${url}`;
    }
    
    // If it already has the CW domain, return as-is
    if (url.includes('cwmediabkt99.crwilladmin.com')) {
      return url;
    }
    
    // If it has a different domain but includes the path pattern, extract and rebuild
    const pathMatch = url.match(/\/class-attachment\/[^"'\s]+/);
    if (pathMatch) {
      return `https://cwmediabkt99.crwilladmin.com${pathMatch[0]}`;
    }
    
    // Otherwise, assume it's a full URL and return as-is
    return url;
  } catch (error) {
    console.error('URL normalization error:', error);
    return url;
  }
}

// Improved domain validation
function isValidCWDomain(url) {
  try {
    const urlObj = new URL(url);
    // More flexible domain validation - accept the CW domain and common CDN patterns
    const validDomains = [
      'cwmediabkt99.crwilladmin.com',
      'crwilladmin.com',
      'd3js...cloudfront.net' // In case CloudFront is used
    ];
    
    return validDomains.some(domain => 
      urlObj.hostname === domain || 
      urlObj.hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

module.exports = async (req, res) => {
  let browser = null;
  const startTime = Date.now();
  
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    const normalizedUrl = normalizeUrl(url);
    console.log(`[${new Date().toISOString()}] Processing URL: ${normalizedUrl}`);
    
    // Validate domain
    if (!isValidCWDomain(normalizedUrl)) {
      console.error(`Invalid domain for URL: ${normalizedUrl}`);
      return res.status(400).json({ 
        error: 'Invalid domain - only CW media URLs are allowed',
        providedUrl: url,
        normalizedUrl: normalizedUrl
      });
    }

    // Get proxy configuration
    const proxy = getNextProxy();
    const proxyConfig = proxy ? new URL(proxy) : null;
    
    console.log(`[${new Date().toISOString()}] Using proxy: ${proxy ? proxyConfig.hostname : 'none'}`);

    // Launch browser with extended timeout
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        ...(proxyConfig ? [`--proxy-server=${proxyConfig.protocol}//${proxyConfig.host}`] : []),
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    
    // Set longer timeout
    page.setDefaultTimeout(120000); // 2 minutes
    page.setDefaultNavigationTimeout(120000);
    
    // Authenticate proxy if configured
    if (proxyConfig && proxyConfig.username && proxyConfig.password) {
      await page.authenticate({
        username: decodeURIComponent(proxyConfig.username),
        password: decodeURIComponent(proxyConfig.password),
      });
    }

    // Enable CDP session for network interception
    const client = await page.target().createCDPSession();
    await client.send('Network.enable');
    await client.send('Page.enable');

    let pdfRequestId = null;
    let pdfData = null;

    // Listen for PDF responses
    client.on('Network.responseReceived', (params) => {
      const response = params.response;
      if (response.url === normalizedUrl && 
          response.mimeType === 'application/pdf' &&
          response.status === 200) {
        pdfRequestId = params.requestId;
        console.log(`[${new Date().toISOString()}] PDF response detected: ${pdfRequestId}`);
      }
    });

    // Navigate with retry logic
    let attempt = 0;
    const maxAttempts = 3;
    let navigationSuccess = false;
    
    while (attempt < maxAttempts && !navigationSuccess) {
      attempt++;
      console.log(`[${new Date().toISOString()}] Attempt ${attempt}/${maxAttempts} - Navigating to: ${normalizedUrl}`);
      
      try {
        // Use AbortController with longer timeout
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 90000); // 90 seconds
        
        const response = await page.goto(normalizedUrl, {
          waitUntil: 'networkidle2',
          timeout: 90000,
          signal: abortController.signal
        });
        
        clearTimeout(timeoutId);
        
        const status = response.status();
        const contentType = response.headers()['content-type'] || '';
        
        console.log(`[${new Date().toISOString()}] Response: status=${status}, contentType=${contentType}`);
        
        if (status === 200 && contentType.includes('application/pdf')) {
          navigationSuccess = true;
          console.log(`[${new Date().toISOString()}] Navigation successful`);
        } else if (status === 403 || status === 503) {
          console.log(`[${new Date().toISOString()}] Got ${status}, rotating proxy and retrying...`);
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
            await browser.close();
            
            // Get new proxy and relaunch
            const newProxy = getNextProxy();
            const newProxyConfig = newProxy ? new URL(newProxy) : null;
            
            browser = await puppeteer.launch({
              args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process',
                '--no-zygote',
                ...(newProxyConfig ? [`--proxy-server=${newProxyConfig.protocol}//${newProxyConfig.host}`] : []),
              ],
              defaultViewport: chromium.defaultViewport,
              executablePath: await chromium.executablePath(),
              headless: chromium.headless,
              ignoreHTTPSErrors: true,
            });
            
            const newPage = await browser.newPage();
            newPage.setDefaultTimeout(120000);
            newPage.setDefaultNavigationTimeout(120000);
            
            if (newProxyConfig && newProxyConfig.username && newProxyConfig.password) {
              await newPage.authenticate({
                username: decodeURIComponent(newProxyConfig.username),
                password: decodeURIComponent(newProxyConfig.password),
              });
            }
          }
        } else {
          throw new Error(`Non-PDF response: status=${status}, contentType=${contentType}`);
        }
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Attempt ${attempt} failed:`, error.message);
        
        if (attempt >= maxAttempts) {
          throw new Error(`All ${maxAttempts} attempts failed. Last error: ${error.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }

    // Get PDF data using CDP
    if (pdfRequestId) {
      try {
        const { body, base64Encoded } = await client.send('Network.getResponseBody', {
          requestId: pdfRequestId,
        });
        
        pdfData = base64Encoded ? Buffer.from(body, 'base64') : Buffer.from(body);
        console.log(`[${new Date().toISOString()}] PDF data retrieved via CDP: ${pdfData.length} bytes`);
      } catch (error) {
        console.error(`[${new Date().toISOString()}] CDP fetch failed:`, error.message);
      }
    }

    // Fallback: Use page.evaluate if CDP didn't work
    if (!pdfData) {
      console.log(`[${new Date().toISOString()}] Using fallback fetch method`);
      
      pdfData = await page.evaluate(async (url) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`fetch-failed status=${response.status}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('pdf')) {
          throw new Error(`fetch-not-pdf status=${response.status} type=${contentType}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        return Array.from(new Uint8Array(arrayBuffer));
      }, normalizedUrl);
      
      pdfData = Buffer.from(pdfData);
      console.log(`[${new Date().toISOString()}] PDF data retrieved via fallback: ${pdfData.length} bytes`);
    }

    // Validate PDF
    if (!pdfData || pdfData.length === 0) {
      throw new Error('Empty PDF data received');
    }
    
    if (!pdfData.toString('utf8', 0, 4).startsWith('%PDF')) {
      throw new Error('Invalid PDF data - missing PDF header');
    }

    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Success! PDF size: ${pdfData.length} bytes, Duration: ${duration}ms`);

    // Send PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfData.length);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(pdfData);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] Final failure: ${error.message}, Duration: ${duration}ms`);
    
    res.status(403).json({
      error: 'Access denied or non-PDF response',
      message: error.message,
      url: req.query.url,
      duration: `${duration}ms`
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        console.error('Error closing browser:', error);
      }
    }
  }
};
