import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const errors: string[] = [];
const logs: string[] = [];

page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => errors.push('PAGE_ERROR: ' + err.message));

try {
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(5000);
} catch (e: any) {
  errors.push('NAV: ' + e.message.substring(0, 300));
}

const title = await page.title().catch(() => 'N/A');
const bodyText = await page.textContent('body').catch(() => 'FAILED');
let rootHtml = 'N/A';
try { rootHtml = await page.$eval('#root', el => el.innerHTML); } catch(e) {}

console.log('=== TITLE:', title);
console.log('=== BODY:', bodyText?.substring(0, 500));
console.log('=== ROOT:', rootHtml?.substring(0, 500));
console.log('=== ERRORS:', errors.length);
errors.forEach(e => console.log('  ', e.substring(0, 300)));
console.log('=== CONSOLE:', logs.length);
logs.forEach(l => console.log('  ', l.substring(0, 300)));

await browser.close();
process.exit(0);
