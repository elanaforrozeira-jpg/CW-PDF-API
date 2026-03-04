const puppeteer = require('puppeteer-core');

const MAX_BROWSERS = 3;

const LAUNCH_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--no-zygote',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-blink-features=AutomationControlled',
    '--proxy-server=Px031901.pointtoserver.com:10780'
];

const pool = [];

async function createBrowser() {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome-stable',
        headless: 'new',
        args: LAUNCH_ARGS,
        ignoreDefaultArgs: ['--enable-automation']
    });

    const entry = { browser, pages: 0 };

    browser.on('disconnected', () => {
        const idx = pool.indexOf(entry);
        if (idx !== -1) pool.splice(idx, 1);
    });

    pool.push(entry);
    return entry;
}

async function getPage(retries = 0) {
    const MAX_RETRIES = 10;
    // Find an existing browser with capacity
    let entry = pool.find(e => e.pages < 5);

    if (!entry && pool.length < MAX_BROWSERS) {
        entry = await createBrowser();
    }

    if (!entry) {
        if (retries >= MAX_RETRIES) {
            throw new Error('Browser pool exhausted: all instances at capacity');
        }
        // All browsers at capacity; wait briefly and retry
        await new Promise(r => setTimeout(r, 500));
        return getPage(retries + 1);
    }

    entry.pages++;
    const page = await entry.browser.newPage();

    await page.authenticate({
        username: 'purevpn0s11340994',
        password: 'ak3t35fp'
    });

    await page.evaluateOnNewDocument(() => {
        delete navigator.__proto__.webdriver;
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.chrome = { runtime: {} };
    });

    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    return { page, entry };
}

async function releasePage(page, entry) {
    try {
        await page.close();
    } catch (_) {
        // ignore close errors
    }
    if (entry.pages > 0) entry.pages--;
}

module.exports = { getPage, releasePage };
