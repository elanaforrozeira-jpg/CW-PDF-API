const puppeteer = require('puppeteer-core');
const PROXY_POOL = [{ host: 'px340403.pointtoserver.com:10780', username: 'purevpn0s12456771', password: 'fc0bdh0p' }, { host: 'px1400403.pointtoserver.com:10780', username: 'purevpn0s12456771', password: 'fc0bdh0p' }, { host: 'px173007.pointtoserver.com:10780', username: 'purevpn0s12456771', password: 'fc0bdh0p' }, { host: 'px350401.pointtoserver.com:10780', username: 'purevpn0s11340994', password: 'ak3t35fp' }, { host: 'Px031901.pointtoserver.com:10780', username: 'purevpn0s11340994', password: 'ak3t35fp' }];
let currentProxyIndex = 0;
function getNextProxy() {
  const proxy = PROXY_POOL[currentProxyIndex];
  currentProxyIndex = (currentProxyIndex + 1) % PROXY_POOL.length;
  console.log('🌐 Using proxy ' + currentProxyIndex + '/' + PROXY_POOL.length + ': ' + proxy.host.split(':')[0]);
  return proxy;
}

const MAX_BROWSERS = 3;
const pool = [];

async function createBrowser() {
  const proxyConfig = getNextProxy();
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--no-zygote', '--disable-dev-shm-usage', '--disable-gpu', '--disable-software-rasterizer', '--disable-blink-features=AutomationControlled', '--proxy-server=' + proxyConfig.host],
    ignoreDefaultArgs: ['--enable-automation']
  });
  const entry = { browser, pages: 0, proxyConfig };
  browser.on('disconnected', () => {
    const idx = pool.indexOf(entry);
    if (idx !== -1) pool.splice(idx, 1);
  });
  pool.push(entry);
  return entry;
}

async function getPage(retries = 0) {
  let entry = pool.find(e => e.pages < 5);
  if (!entry && pool.length < MAX_BROWSERS) entry = await createBrowser();
  if (!entry) {
    if (retries >= 10) throw new Error('Pool exhausted');
    await new Promise(r => setTimeout(r, 500));
    return getPage(retries + 1);
  }
  entry.pages++;
  const page = await entry.browser.newPage();
  await page.authenticate({ username: entry.proxyConfig.username, password: entry.proxyConfig.password });
  await page.evaluateOnNewDocument(() => {
    delete navigator.__proto__.webdriver;
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  return { page, entry };
}

async function releasePage(page, entry) {
  try {
    await page.close();
  } catch (_) {}
  if (entry.pages > 0) entry.pages--;
}

module.exports = { getPage, releasePage };