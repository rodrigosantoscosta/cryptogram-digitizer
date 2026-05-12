// scripts/debug-pipeline.cjs
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[PAGE_ERROR] ${err.message}`));

  await page.goto('http://localhost:5173/test', { waitUntil: 'networkidle' });

  await page.evaluate(() => {
    window.addEventListener('unhandledrejection', e => {
      console.error('[UNHANDLED]', String(e.reason), e.reason?.stack || '');
    });
  });

  // Carregar sample.jpg via fetch da origem e disparar upload
  await page.evaluate(async () => {
    const blob = await fetch('/sample.jpg').then(r => r.blob());
    const dataUrl = await new Promise(r => {
      const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob);
    });
    const blob2 = await fetch(dataUrl).then(r => r.blob());
    const file = new File([blob2], 'sample.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]');
    const dt = new DataTransfer(); dt.items.add(file);
    Object.defineProperty(input, 'files', { value: dt.files, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // Aguardar pipeline completo (OCR pode demorar até 60s)
  await page.waitForTimeout(90000);

  const bodyText = await page.evaluate(() => document.body.innerText);

  await browser.close();

  console.log('\n=== LOGS ===');
  logs.forEach(l => console.log(l));
  console.log('\n=== BODY TEXT ===');
  console.log(bodyText.substring(0, 3000));
})();
