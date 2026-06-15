const { chromium } = require('playwright');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => errors.push('PAGE_ERROR: ' + err.message));
  page.on('requestfailed', req => errors.push('REQ_FAIL: ' + req.url() + ' ' + req.failure()?.errorText));

  console.log('Navigating...');
  try {
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 8000 });
  } catch (e) {
    errors.push('NAV: ' + e.message.substring(0, 200));
  }
  
  console.log('Waiting 3s...');
  await page.waitForTimeout(3000);

  const title = await page.title().catch(() => 'N/A');
  const bodyText = await page.textContent('body').catch(() => 'FAILED');
  let rootHtml = 'N/A';
  try { rootHtml = await page.$eval('#root', el => el.innerHTML); } catch(e) {}
  
  console.log('\n=== TITLE:', title);
  console.log('=== BODY:', bodyText?.substring(0, 500));
  console.log('=== ROOT:', rootHtml?.substring(0, 500));
  console.log('=== ERRORS:', errors.length);
  errors.forEach(e => console.log('  ', e.substring(0, 200)));
  console.log('=== CONSOLE LOGS:', logs.length);
  logs.forEach(l => console.log('  ', l.substring(0, 200)));

  await browser.close();
  process.exit(0);
})();
