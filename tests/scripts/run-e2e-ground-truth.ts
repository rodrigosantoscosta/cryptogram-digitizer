/**
 * E2E Ground Truth Runner
 *
 * Runs the full OCR pipeline against puzzle images and compares results
 * against ground truth data using the ground truth framework.
 *
 * Usage:
 *   npx tsx tests/scripts/run-e2e-ground-truth.ts [options]
 *
 * Options:
 *   --puzzle <id>       Run E2E for a specific puzzle ID (default: all)
 *   --api-url <url>     Backend OCR API URL (default: http://localhost:4000)
 *   --threshold <n>     Accuracy threshold for exit code (default: 0)
 *   --report            Generate HTML report
 *   --help              Show this help
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import sharp from 'sharp';

// Types (inline to avoid TS import issues)
interface CellNumber {
  row: number;
  col: number;
  number: number | null;
  confidence: number;
  rawText: string;
  rawOcr: string;
}

interface CellNumberMap {
  cells: CellNumber[];
  bySymbol: Record<string, Array<{ row: number; col: number }>>;
  recognized: number;
  total: number;
  aborted?: boolean;
  abortReason?: string;
}

interface GroundTruthPuzzle {
  puzzleId: string;
  sourceImage: string;
  type: 'numeric' | 'pictogram';
  dimensions: { rows: number; cols: number };
  valueRange: { min: number; max: number };
  grid: (number | null)[][];
  frequency: Record<string, number>;
  metadata: { validatedBy: string; validatedAt: string; notes?: string };
}

interface CellComparison {
  row: number;
  col: number;
  expected: number | null;
  actual: number | null;
  confidence: number;
  match: 'correct' | 'incorrect' | 'missed' | 'extra' | 'aborted';
}

interface PuzzleMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  coverage: number;
  editDistance: number;
  normalizedEditDistance: number;
  perDigit: Record<string, DigitMetrics>;
}

interface DigitMetrics {
  digit: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
}

interface ComparisonResult {
  puzzleId: string;
  timestamp: string;
  cells: CellComparison[];
  metrics: PuzzleMetrics;
  aborted: boolean;
  abortReason?: string;
}

// Parse args
const args = process.argv.slice(2);
const opts = {
  puzzle: null as string | null,
  apiUrl: 'http://localhost:4000',
  threshold: 0,
  report: false,
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--puzzle': opts.puzzle = args[++i]!; break;
    case '--api-url': opts.apiUrl = args[++i]!; break;
    case '--threshold': opts.threshold = parseFloat(args[++i]!); break;
    case '--report': opts.report = true; break;
    case '--help':
      console.log(`
E2E Ground Truth Runner

Usage: npx tsx tests/scripts/run-e2e-ground-truth.ts [options]

Options:
  --puzzle <id>       Run E2E for a specific puzzle ID (default: all)
  --api-url <url>     Backend OCR API URL (default: http://localhost:4000)
  --threshold <n>     Accuracy threshold for exit code (default: 0)
  --report            Generate HTML report
  --help              Show this help
`);
      process.exit(0);
  }
}

const ROOT = path.resolve(process.cwd());
const GROUND_TRUTH_DIR = path.join(ROOT, 'tests', 'fixtures', 'ground-truth');
const RESULTS_DIR = path.join(ROOT, 'tests', 'results');
const BATCH_DIR = path.join(RESULTS_DIR, 'batch');

// ─── Health Check ───
async function checkHealth(apiUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    http.get(`${apiUrl}/api/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          console.log(`  Backend: ${health.status} (GPU: ${health.gpu})`);
          resolve(health.status === 'ok');
        } catch {
          console.error(`  Health check failed: ${data}`);
          resolve(false);
        }
      });
    }).on('error', (e) => {
      console.error(`  Health check error: ${e.message}`);
      resolve(false);
    });
  });
}

// ─── Load Ground Truth ───
async function loadGroundTruth(puzzleId: string): Promise<GroundTruthPuzzle> {
  const filePath = path.join(GROUND_TRUTH_DIR, `${puzzleId}.json`);
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function listPuzzleIds(): Promise<string[]> {
  const files = await fs.readdir(GROUND_TRUTH_DIR);
  return files.filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
}

// ─── Extract Cells ───
async function extractCells(
  imagePath: string,
  dimensions: { rows: number; cols: number },
  metadata: { width?: number; height?: number }
): Promise<Array<{ imageData: Buffer; row: number; col: number }>> {
  const { width = 800, height = 600 } = metadata;
  const { rows, cols } = dimensions;

  // Estimate grid margins (same as run-ocr-test.mjs)
  const marginX = Math.floor(width * 0.08);
  const marginY = Math.floor(height * 0.03);
  const gridWidth = width - 2 * marginX;
  const gridHeight = height - 2 * marginY;
  const cellWidth = gridWidth / cols;
  const cellHeight = gridHeight / rows;

  const cells: Array<{ imageData: Buffer; row: number; col: number }> = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 1; col < cols; col++) {
      const left = marginX + col * cellWidth;
      const top = marginY + row * cellHeight;

      // Aggressive padding to avoid grid lines
      const paddingX = cellWidth * 0.25;
      const paddingY = cellHeight * 0.25;

      const extractLeft = Math.floor(left + paddingX);
      const extractTop = Math.floor(top + paddingY);
      const extractWidth = Math.floor(cellWidth - 2 * paddingX);
      const extractHeight = Math.floor(cellHeight - 2 * paddingY);

      if (extractLeft < 0 || extractTop < 0 || extractWidth <= 0 || extractHeight <= 0) continue;

      const cellBuffer = await sharp(imagePath)
        .extract({
          left: extractLeft,
          top: extractTop,
          width: extractWidth,
          height: extractHeight,
        })
        .resize(null, 96, { fit: 'inside', background: { r: 255, g: 255, b: 255 } })
        .extend({
          top: 20, bottom: 20, left: 30, right: 30,
          background: { r: 255, g: 255, b: 255 },
        })
        .png()
        .toBuffer();

      cells.push({ imageData: cellBuffer, row, col });
    }
  }

  return cells;
}

// ─── Send to OCR ───
async function sendBatchToOCR(
  apiUrl: string,
  cells: Array<{ imageData: Buffer; row: number; col: number }>
): Promise<Array<{ number: number | null; confidence: number; rawText: string }>> {
  return new Promise((resolve) => {
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);

    const parts = cells.map((cell, i) =>
      Buffer.concat([
        Buffer.from(`------FormBoundary${boundary}\r\n`),
        Buffer.from(`Content-Disposition: form-data; name="files"; filename="cell_${i}.png"\r\n`),
        Buffer.from('Content-Type: image/png\r\n\r\n'),
        cell.imageData,
        Buffer.from('\r\n'),
      ])
    );

    const body = Buffer.concat([
      ...parts,
      Buffer.from(`------FormBoundary${boundary}--\r\n`),
    ]);

    const url = new URL(`${apiUrl}/api/ocr/batch`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=----FormBoundary${boundary}`,
        'Content-Length': body.length,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response.results || []);
        } catch {
          console.error(`  OCR batch error: ${data}`);
          resolve([]);
        }
      });
    });

    req.on('error', (e) => {
      console.error(`  OCR request error: ${e.message}`);
      resolve([]);
    });
    req.write(body);
    req.end();
  });
}

// ─── Build CellNumberMap ───
function buildCellNumberMap(
  cells: Array<{ imageData: Buffer; row: number; col: number }>,
  ocrResults: Array<{ number: number | null; confidence: number; rawText: string }>,
  dimensions: { rows: number; cols: number }
): CellNumberMap {
  const cellNumbers: CellNumber[] = [];
  const bySymbol: Record<string, Array<{ row: number; col: number }>> = {};
  let recognized = 0;

  for (let i = 0; i < cells.length; i++) {
    const { row, col } = cells[i];
    const ocr = ocrResults[i];
    const number = ocr?.number ?? null;
    const confidence = ocr?.confidence ?? 0;
    const rawText = ocr?.rawText ?? '';
    const rawOcr = rawText;

    cellNumbers.push({ row, col, number, confidence, rawText, rawOcr });

    if (number !== null) {
      recognized++;
      const key = String(number);
      if (!bySymbol[key]) bySymbol[key] = [];
      bySymbol[key].push({ row, col });
    }
  }

  const total = dimensions.rows * (dimensions.cols - 1); // Skip clue column

  return {
    cells: cellNumbers,
    bySymbol,
    recognized,
    total,
  };
}

// ─── Comparison Engine (inline) ───
function compareCells(actual: CellNumber[], expected: GroundTruthPuzzle): CellComparison[] {
  const expectedMap = new Map<string, number | null>();
  for (let r = 0; r < expected.grid.length; r++) {
    for (let c = 0; c < expected.grid[r].length; c++) {
      expectedMap.set(`${r},${c}`, expected.grid[r][c]);
    }
  }

  const actualMap = new Map<string, CellNumber>();
  for (const cell of actual) {
    actualMap.set(`${cell.row},${cell.col}`, cell);
  }

  const allRows = Math.max(
    expected.grid.length,
    actual.length > 0 ? Math.max(...actual.map(c => c.row)) + 1 : 0
  );
  const allCols = Math.max(
    expected.grid[0]?.length ?? 0,
    actual.length > 0 ? Math.max(...actual.map(c => c.col)) + 1 : 0
  );

  const comparisons: CellComparison[] = [];

  for (let r = 0; r < allRows; r++) {
    for (let c = 0; c < allCols; c++) {
      const expectedVal = expectedMap.get(`${r},${c}`) ?? null;
      const actualCell = actualMap.get(`${r},${c}`);
      const actualVal = actualCell?.number ?? null;
      const confidence = actualCell?.confidence ?? 0;

      let match: CellComparison['match'];
      if (expectedVal === null && actualVal === null) {
        continue;
      } else if (expectedVal !== null && actualVal === null) {
        match = 'missed';
      } else if (expectedVal === null && actualVal !== null) {
        match = 'extra';
      } else if (expectedVal === actualVal) {
        match = 'correct';
      } else {
        match = 'incorrect';
      }

      comparisons.push({ row: r, col: c, expected: expectedVal, actual: actualVal, confidence, match });
    }
  }

  return comparisons;
}

function calculateMetrics(comparisons: CellComparison[]): PuzzleMetrics {
  let correct = 0, incorrect = 0, missed = 0, extra = 0;

  for (const c of comparisons) {
    if (c.match === 'correct') correct++;
    else if (c.match === 'incorrect') incorrect++;
    else if (c.match === 'missed') missed++;
    else if (c.match === 'extra') extra++;
  }

  const totalExpected = correct + incorrect + missed;
  const accuracy = totalExpected > 0 ? correct / totalExpected : 0;
  const precision = (correct + extra) > 0 ? correct / (correct + extra) : 0;
  const recall = (correct + missed) > 0 ? correct / (correct + missed) : 0;
  const f1Score = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  const coverage = totalExpected > 0 ? (correct + incorrect) / totalExpected : 0;

  // Edit distance
  const expectedSeq = comparisons.map(c => c.expected);
  const actualSeq = comparisons.map(c => c.actual);
  const editDistance = computeEditDistance(expectedSeq, actualSeq);
  const normalizedEditDistance = expectedSeq.length > 0 ? editDistance / expectedSeq.length : 0;

  const perDigit = computePerDigitMetrics(comparisons);

  return { accuracy, precision, recall, f1Score, coverage, editDistance, normalizedEditDistance, perDigit };
}

function computeEditDistance(expected: (number | null)[], actual: (number | null)[]): number {
  const m = expected.length;
  const n = actual.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = expected[i - 1] === actual[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function computePerDigitMetrics(comparisons: CellComparison[]): Record<string, DigitMetrics> {
  const digitMap = new Map<number, DigitMetrics>();
  for (let d = 1; d <= 27; d++) {
    digitMap.set(d, { digit: d, truePositives: 0, falsePositives: 0, falseNegatives: 0, precision: 0, recall: 0, f1Score: 0 });
  }
  for (const c of comparisons) {
    if (c.match === 'aborted') continue;
    if (c.expected !== null) {
      const m = digitMap.get(c.expected)!;
      if (c.match === 'correct') m.truePositives++;
      else m.falseNegatives++;
    }
    if (c.actual !== null && (c.match === 'extra' || c.match === 'incorrect')) {
      const m = digitMap.get(c.actual);
      if (m) m.falsePositives++;
    }
  }
  for (const m of digitMap.values()) {
    m.precision = (m.truePositives + m.falsePositives) > 0 ? m.truePositives / (m.truePositives + m.falsePositives) : 0;
    m.recall = (m.truePositives + m.falseNegatives) > 0 ? m.truePositives / (m.truePositives + m.falseNegatives) : 0;
    m.f1Score = (m.precision + m.recall) > 0 ? 2 * (m.precision * m.recall) / (m.precision + m.recall) : 0;
  }
  const result: Record<string, DigitMetrics> = {};
  for (const [key, value] of digitMap) result[String(key)] = value;
  return result;
}

// ─── HTML Report ───
function generateHtmlReport(result: ComparisonResult, groundTruth: GroundTruthPuzzle): string {
  const m = result.metrics;
  const mismatches = result.cells.filter(c => c.match === 'incorrect' || c.match === 'missed' || c.match === 'extra');

  let mismatchRows = '';
  for (const c of mismatches) {
    mismatchRows += `<tr>
      <td>${c.row}</td><td>${c.col}</td>
      <td>${c.expected !== null ? c.expected : '—'}</td>
      <td>${c.actual !== null ? c.actual : '—'}</td>
      <td>${(c.confidence * 100).toFixed(0)}%</td>
      <td>${c.match}</td>
    </tr>`;
  }

  let gridRows = '';
  for (let r = 0; r < groundTruth.dimensions.rows; r++) {
    gridRows += '<tr>';
    for (let c = 0; c < groundTruth.dimensions.cols; c++) {
      const comp = result.cells.find(x => x.row === r && x.col === c);
      const expected = groundTruth.grid[r][c];
      const actual = comp?.actual ?? null;
      const match = comp?.match ?? '';
      const cls = match === 'correct' ? 'cell-correct' : match === 'incorrect' ? 'cell-incorrect' : match === 'missed' ? 'cell-missed' : match === 'extra' ? 'cell-extra' : '';
      gridRows += `<td class="${cls}">${expected !== null ? expected : ''}</td>`;
    }
    gridRows += '</tr>';
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>E2E Report — ${result.puzzleId}</title>
<style>
  body { font-family: 'Courier New', monospace; margin: 20px; background: #1a1a2e; color: #e0e0e0; }
  h1, h2 { color: #fff; }
  .container { max-width: 1200px; margin: 0 auto; }
  .metrics { margin: 20px 0; }
  .metrics table { border-collapse: collapse; }
  .metrics td, .metrics th { padding: 6px 12px; border: 1px solid #444; }
  .metrics .value { font-weight: bold; }
  .grid { border-collapse: collapse; margin: 10px 0; }
  .grid td { width: 40px; height: 40px; text-align: center; border: 1px solid #444; font-size: 14px; font-weight: bold; }
  .cell-correct { background: #1b5e20; color: #a5d6a7; }
  .cell-incorrect { background: #b71c1c; color: #ef9a9a; }
  .cell-missed { background: #f57f17; color: #fff8e1; }
  .cell-extra { background: #e65100; color: #ffe0b2; }
  .mismatches { margin-top: 20px; }
  .mismatches table { border-collapse: collapse; width: 100%; }
  .mismatches th, .mismatches td { padding: 4px 8px; border: 1px solid #444; text-align: center; }
</style></head>
<body>
<div class="container">
  <h1>E2E Ground Truth Report: ${result.puzzleId}</h1>
  <p>Timestamp: ${result.timestamp}</p>
  ${result.aborted ? '<p style="color:#f57f17">Pipeline aborted: ' + (result.abortReason || 'unknown') + '</p>' : ''}
  <div class="metrics">
    <h2>Metrics</h2>
    <table>
      <tr><td>Accuracy</td><td class="value">${(m.accuracy * 100).toFixed(1)}%</td></tr>
      <tr><td>Precision</td><td class="value">${(m.precision * 100).toFixed(1)}%</td></tr>
      <tr><td>Recall</td><td class="value">${(m.recall * 100).toFixed(1)}%</td></tr>
      <tr><td>F1 Score</td><td class="value">${(m.f1Score * 100).toFixed(1)}%</td></tr>
      <tr><td>Coverage</td><td class="value">${(m.coverage * 100).toFixed(1)}%</td></tr>
      <tr><td>Edit Distance</td><td class="value">${m.editDistance}</td></tr>
    </table>
  </div>
  <h2>Grid Comparison</h2>
  <table class="grid">${gridRows}</table>
  ${mismatches.length > 0 ? `
  <div class="mismatches">
    <h2>Mismatches (${mismatches.length})</h2>
    <table>
      <tr><th>Row</th><th>Col</th><th>Expected</th><th>Actual</th><th>Confidence</th><th>Type</th></tr>
      ${mismatchRows}
    </table>
  </div>` : '<p>No mismatches found.</p>'}
</div>
</body></html>`;
}

// ─── Main ───
async function runE2EForPuzzle(puzzleId: string, apiUrl: string, generateReport: boolean): Promise<ComparisonResult | null> {
  const groundTruth = await loadGroundTruth(puzzleId);
  const imagePath = path.join(ROOT, groundTruth.sourceImage);

  // Check if image exists
  try {
    await fs.access(imagePath);
  } catch {
    console.error(`  Image not found: ${imagePath}`);
    return null;
  }

  // Load image metadata
  const image = sharp(imagePath);
  const metadata = await image.metadata();

  // Extract cells
  const cells = await extractCells(imagePath, groundTruth.dimensions, metadata);

  // Send to OCR
  const ocrResults = await sendBatchToOCR(apiUrl, cells);

  // Build CellNumberMap
  const cellNumberMap = buildCellNumberMap(cells, ocrResults, groundTruth.dimensions);

  // Compare against ground truth
  const comparisons = compareCells(cellNumberMap.cells, groundTruth);
  const metrics = calculateMetrics(comparisons);

  const result: ComparisonResult = {
    puzzleId,
    timestamp: new Date().toISOString(),
    cells: comparisons,
    metrics,
    aborted: false,
  };

  // Save result
  const puzzleDir = path.join(RESULTS_DIR, puzzleId);
  await fs.mkdir(puzzleDir, { recursive: true });
  const safeTs = result.timestamp.replace(/:/g, '-');
  await fs.writeFile(path.join(puzzleDir, `${safeTs}.json`), JSON.stringify(result, null, 2));

  // Generate report
  if (generateReport) {
    const html = generateHtmlReport(result, groundTruth);
    const reportPath = path.join(puzzleDir, `${safeTs}.html`);
    await fs.writeFile(reportPath, html, 'utf-8');
    console.log(`  Report: ${reportPath}`);
  }

  return result;
}

async function main() {
  console.log('E2E Ground Truth Runner\n');

  // Health check
  console.log('Checking backend...');
  const healthy = await checkHealth(opts.apiUrl);
  if (!healthy) {
    console.error('\nBackend not healthy. Ensure Docker services are running:');
    console.error('  docker compose up -d');
    process.exit(1);
  }

  // Get puzzles to test
  const puzzleIds = opts.puzzle ? [opts.puzzle] : await listPuzzleIds();
  if (puzzleIds.length === 0) {
    console.error('No ground truth files found.');
    process.exit(1);
  }

  console.log(`\nTesting ${puzzleIds.length} puzzle(s): ${puzzleIds.join(', ')}\n`);

  // Run E2E for each puzzle
  const results: ComparisonResult[] = [];

  for (const puzzleId of puzzleIds) {
    console.log(`[${puzzleId}]`);

    const groundTruth = await loadGroundTruth(puzzleId);
    console.log(`  Grid: ${groundTruth.dimensions.rows}x${groundTruth.dimensions.cols}`);

    const result = await runE2EForPuzzle(puzzleId, opts.apiUrl, opts.report);
    if (result) {
      results.push(result);
      const m = result.metrics;
      console.log(`  Accuracy:  ${(m.accuracy * 100).toFixed(1)}%`);
      console.log(`  Precision: ${(m.precision * 100).toFixed(1)}%`);
      console.log(`  Recall:    ${(m.recall * 100).toFixed(1)}%`);
      console.log(`  F1:        ${(m.f1Score * 100).toFixed(1)}%`);
      console.log(`  Coverage:  ${(m.coverage * 100).toFixed(1)}%`);
      console.log(`  Edit Dist: ${m.editDistance}`);
      console.log('');
    }
  }

  // Summary
  if (results.length > 1) {
    console.log('='.repeat(60));
    console.log('Aggregate Summary');
    console.log('='.repeat(60));

    let totalCorrect = 0, totalIncorrect = 0, totalMissed = 0, totalExtra = 0;
    for (const r of results) {
      for (const c of r.cells) {
        if (c.match === 'correct') totalCorrect++;
        else if (c.match === 'incorrect') totalIncorrect++;
        else if (c.match === 'missed') totalMissed++;
        else if (c.match === 'extra') totalExtra++;
      }
    }

    const totalExpected = totalCorrect + totalIncorrect + totalMissed;
    const overallAccuracy = totalExpected > 0 ? totalCorrect / totalExpected : 0;
    const overallPrecision = (totalCorrect + totalExtra) > 0 ? totalCorrect / (totalCorrect + totalExtra) : 0;
    const overallRecall = (totalCorrect + totalMissed) > 0 ? totalCorrect / (totalCorrect + totalMissed) : 0;
    const overallF1 = (overallPrecision + overallRecall) > 0 ? 2 * (overallPrecision * overallRecall) / (overallPrecision + overallRecall) : 0;

    console.log(`Puzzles: ${results.length}`);
    console.log(`Overall Accuracy:  ${(overallAccuracy * 100).toFixed(1)}%`);
    console.log(`Overall Precision: ${(overallPrecision * 100).toFixed(1)}%`);
    console.log(`Overall Recall:    ${(overallRecall * 100).toFixed(1)}%`);
    console.log(`Overall F1:        ${(overallF1 * 100).toFixed(1)}%`);
  }

  // Check threshold
  if (opts.threshold > 0 && results.length > 0) {
    const avgAccuracy = results.reduce((sum, r) => sum + r.metrics.accuracy, 0) / results.length;
    if (avgAccuracy * 100 >= opts.threshold) {
      console.log(`\n✅ PASSED: Accuracy ${(avgAccuracy * 100).toFixed(1)}% >= ${opts.threshold}%`);
    } else {
      console.log(`\n❌ FAILED: Accuracy ${(avgAccuracy * 100).toFixed(1)}% < ${opts.threshold}%`);
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
