import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test('Process cryptogram image and check OCR results', async ({ page }) => {
  // Collect console messages
  const consoleMessages: string[] = [];
  page.on('console', msg => {
    consoleMessages.push(msg.text());
  });

  // Navigate to the app
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Find file input and upload image
  const imagePath = path.resolve(__dirname, '../../legacy/sample.jpg');
  console.log('Looking for image at:', imagePath);
  
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image not found at ${imagePath}`);
  }

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'visible', timeout: 10000 });
  await fileInput.setInputFiles(imagePath);

  // Wait for processing to complete (CellNumberReader can take time)
  console.log('Waiting for processing...');
  await page.waitForTimeout(45000);

  // Extract diagnostic info from console
  const cnrMessages = consoleMessages.filter(m => 
    m.includes('CellNumberReader') || 
    m.includes('preprocess') ||
    m.includes('coverage') ||
    m.includes('reconhecida')
  );

  console.log('\n=== CellNumberReader Console Output ===');
  cnrMessages.forEach(m => console.log(m));

  // Try to get results from page
  const pageText = await page.textContent('body');
  
  // Look for diagnostic JSON or result display
  const diagnosticMatch = pageText.match(/\{[^]*"recognized"[^]*"coverage"[^]*\}/s);
  if (diagnosticMatch) {
    console.log('\n=== Diagnostic JSON Found ===');
    console.log(diagnosticMatch[0]);
  }

  // Take screenshot
  await page.screenshot({ 
    path: 'test-results/cryptogram-results.png', 
    fullPage: true,
    timeout: 10000
  });

  // Save console log
  fs.writeFileSync(
    'test-results/console-log.txt', 
    consoleMessages.join('\n')
  );

  console.log('\n=== Full Console Log ===');
  console.log(consoleMessages.join('\n'));

  // Basic assertion - page should have processed something
  expect(pageText.length).toBeGreaterThan(100);
});
