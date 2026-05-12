// scripts/test-clues.cjs
// Uso: node scripts/test-clues.cjs
// Requer: npm run dev rodando em localhost:5173

const { chromium } = require('playwright');

const GROUND_TRUTH = [
  'Que possui frisos, ranhuras.',
  'Que ocupa ou está em posse.',
  'Fruta tropical, polpa é doce e ácida.',
  'Ato de pousar.',
  'Peixe de água salgada que tem o corpo achatado.',
  'Relacionado à espinha ou espinha dorsal.',
  'Instrumento musical de percussão.',
  'Plural de irônica.',
  'Refere ao ato de dublar (pl.).',
  'Fazer com que algo ou alguém fuja.',
  'Particípio feminino de decolar.',
  'Conjunto de todos os ecossistemas da Terra.',
];

function similarity(a, b) {
  a = a.toLowerCase().trim().replace(/[.,;]/g, '');
  b = b.toLowerCase().trim().replace(/[.,;]/g, '');
  if (a === b) return 1;
  if (!a || !b) return 0;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return 1 - dp[m][n] / Math.max(m, n);
}

(async () => {
  console.log('Iniciando teste Playwright...\n');
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();

  const ocrLogs = [];
  page.on('console', msg => {
    const t = msg.text();
    if (t.includes('[OCR]') || t.includes('GridDetector') || t.includes('concluido') || t.includes('concluído')) {
      ocrLogs.push(t);
    }
    if (msg.type() === 'error') {
      ocrLogs.push('[ERR] ' + t.substring(0, 150));
    }
  });

  await page.goto('http://localhost:5173/test', { waitUntil: 'networkidle', timeout: 15000 });

  await page.evaluate(async () => {
    const blob    = await fetch('/sample.jpg').then(r => r.blob());
    const dataUrl = await new Promise(r => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result);
      fr.readAsDataURL(blob);
    });
    const blob2 = await fetch(dataUrl).then(r => r.blob());
    const file  = new File([blob2], 'sample.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]');
    const dt    = new DataTransfer();
    dt.items.add(file);
    Object.defineProperty(input, 'files', { value: dt.files, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  console.log('Upload disparado, aguardando pipeline (max 120s)...\n');

  try {
    await page.waitForFunction(
      () => document.body.innerText.includes('complete') || document.body.innerText.includes('Processamento concluído'),
      { timeout: 120000 }
    );
    // Aguardar mais 5s para o OCR terminar de logar
    await page.waitForTimeout(5000);
  } catch {
    console.log('Timeout — coletando resultado parcial\n');
    await page.waitForTimeout(3000);
  }

  const summary = await page.evaluate(() => {
    const body = document.body.innerText;
    const match = body.match(/✅[\s\S]{0,500}/);
    return match ? match[0] : body.slice(-300);
  });

  await browser.close();

  // Relatório
  console.log('='.repeat(60));
  console.log('LOGS DO PIPELINE');
  console.log('='.repeat(60));
  ocrLogs.forEach(l => console.log(' ', l));

  console.log('\n' + '='.repeat(60));
  console.log('RESULTADO GERAL');
  console.log('='.repeat(60));
  console.log(summary);

  // Parsear pistas dos logs
  const parsedClues = ocrLogs
    .filter(l => l.includes('[OCR] pista'))
    .map(l => {
      const m = l.match(/pista (\d+): "([^"]*)" conf=(\d+)%/);
      if (!m) return null;
      return { row: parseInt(m[1]) - 1, text: m[2], conf: parseInt(m[3]) };
    })
    .filter(Boolean);

  if (parsedClues.length === 0) {
    console.log('\nNenhuma pista OCR encontrada nos logs.');
    console.log('Verifique se o dev server esta rodando e o OCR foi executado.');
    return;
  }

  console.log('\n' + '='.repeat(60));
  console.log('COMPARACAO COM GROUND TRUTH');
  console.log('='.repeat(60));

  let passCount = 0;
  for (const clue of parsedClues) {
    const expected = GROUND_TRUTH[clue.row] || '(sem ground truth)';
    const sim      = similarity(clue.text, expected);
    const ok       = sim >= 0.60;
    if (ok) passCount++;
    const icon = ok ? '[OK]' : '[XX]';
    console.log(`\n${icon} Pista ${clue.row + 1}  conf=${clue.conf}%  sim=${(sim*100).toFixed(0)}%`);
    console.log(`  OCR:      "${clue.text}"`);
    console.log(`  Esperado: "${expected}"`);
  }

  const total = parsedClues.length;
  console.log('\n' + '='.repeat(60));
  console.log(`SCORE: ${passCount}/${total} pistas com similaridade >= 60%`);
  if (passCount === total) {
    console.log('RESULTADO: PASS');
  } else if (passCount >= Math.ceil(total * 0.66)) {
    console.log(`RESULTADO: PARCIAL (${Math.round(passCount/total*100)}%)`);
  } else {
    console.log(`RESULTADO: FAIL (${Math.round(passCount/total*100)}%)`);
  }
  console.log('='.repeat(60));
})();
