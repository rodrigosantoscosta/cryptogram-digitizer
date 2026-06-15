import { ComparisonResult, CellComparison, BatchResult, GroundTruthPuzzle } from '../../types/ocr';

function metricsHtml(result: ComparisonResult): string {
  const m = result.metrics;
  return `
    <div class="metrics">
      <h2>Metrics</h2>
      <table class="metrics-table">
        <tr><td>Accuracy</td><td class="value">${(m.accuracy * 100).toFixed(1)}%</td></tr>
        <tr><td>Precision</td><td class="value">${(m.precision * 100).toFixed(1)}%</td></tr>
        <tr><td>Recall</td><td class="value">${(m.recall * 100).toFixed(1)}%</td></tr>
        <tr><td>F1 Score</td><td class="value">${(m.f1Score * 100).toFixed(1)}%</td></tr>
        <tr><td>Coverage</td><td class="value">${(m.coverage * 100).toFixed(1)}%</td></tr>
        <tr><td>Edit Distance</td><td class="value">${m.editDistance}</td></tr>
        <tr><td>Normalized Edit Distance</td><td class="value">${(m.normalizedEditDistance * 100).toFixed(1)}%</td></tr>
      </table>
    </div>`;
}

function gridHtml(grid: (number | null)[][], label: string): string {
  let html = `<div class="grid-container"><h3>${label}</h3><table class="grid">`;
  for (const row of grid) {
    html += '<tr>';
    for (const cell of row) {
      html += `<td>${cell !== null ? cell : ''}</td>`;
    }
    html += '</tr>';
  }
  html += '</table></div>';
  return html;
}

function colorClass(match: CellComparison['match']): string {
  switch (match) {
    case 'correct': return 'cell-correct';
    case 'incorrect': return 'cell-incorrect';
    case 'missed': return 'cell-missed';
    case 'extra': return 'cell-extra';
    case 'aborted': return 'cell-aborted';
  }
}

function diffGridHtml(comparisons: CellComparison[], expected: GroundTruthPuzzle): string {
  const rows = expected.dimensions.rows;
  const cols = expected.dimensions.cols;
  const cellMap = new Map<string, CellComparison>();
  for (const c of comparisons) cellMap.set(`${c.row},${c.col}`, c);

  const expectedGrid: (number | null)[][] = [];
  const actualGrid: (number | null)[][] = [];

  for (let r = 0; r < rows; r++) {
    const expRow: (number | null)[] = [];
    const actRow: (number | null)[] = [];
    for (let c = 0; c < cols; c++) {
      const comp = cellMap.get(`${r},${c}`);
      expRow.push(comp?.expected ?? null);
      actRow.push(comp?.actual ?? null);
    }
    expectedGrid.push(expRow);
    actualGrid.push(actRow);
  }

  let html = '<div class="diff-grids">';
  html += '<div class="diff-section">';
  html += `<h3>Expected</h3><table class="grid">`;
  for (let r = 0; r < rows; r++) {
    html += '<tr>';
    for (let c = 0; c < cols; c++) {
      const comp = cellMap.get(`${r},${c}`);
      const cls = comp ? colorClass(comp.match) : '';
      html += `<td class="${cls}">${expectedGrid[r][c] !== null ? expectedGrid[r][c] : ''}</td>`;
    }
    html += '</tr>';
  }
  html += '</table></div>';

  html += '<div class="diff-section">';
  html += `<h3>Actual</h3><table class="grid">`;
  for (let r = 0; r < rows; r++) {
    html += '<tr>';
    for (let c = 0; c < cols; c++) {
      const comp = cellMap.get(`${r},${c}`);
      const cls = comp ? colorClass(comp.match) : '';
      html += `<td class="${cls}">${actualGrid[r][c] !== null ? actualGrid[r][c] : ''}</td>`;
    }
    html += '</tr>';
  }
  html += '</table></div>';
  html += '</div>';

  return html;
}

function mismatchListHtml(comparisons: CellComparison[]): string {
  const mismatches = comparisons.filter(c => c.match === 'incorrect' || c.match === 'missed' || c.match === 'extra');
  if (mismatches.length === 0) return '<p>No mismatches found.</p>';

  let html = '<div class="mismatches"><h3>Mismatches</h3><table class="mismatch-table"><tr><th>Row</th><th>Col</th><th>Expected</th><th>Actual</th><th>Confidence</th><th>Type</th></tr>';
  for (const c of mismatches) {
    html += `<tr class="${colorClass(c.match)}">
      <td>${c.row}</td><td>${c.col}</td>
      <td>${c.expected !== null ? c.expected : '—'}</td>
      <td>${c.actual !== null ? c.actual : '—'}</td>
      <td>${(c.confidence * 100).toFixed(0)}%</td>
      <td>${c.match}</td>
    </tr>`;
  }
  html += '</table></div>';
  return html;
}

function perDigitHtml(perDigit: Record<string, { digit: number; truePositives: number; falsePositives: number; falseNegatives: number; precision: number; recall: number; f1Score: number }>): string {
  const entries = Object.values(perDigit).filter(d => d.truePositives > 0 || d.falsePositives > 0 || d.falseNegatives > 0);
  if (entries.length === 0) return '';

  let html = '<div class="per-digit"><h3>Per-Digit Breakdown</h3><table class="metrics-table"><tr><th>Digit</th><th>TP</th><th>FP</th><th>FN</th><th>Precision</th><th>Recall</th><th>F1</th></tr>';
  for (const d of entries) {
    html += `<tr>
      <td>${d.digit}</td><td>${d.truePositives}</td><td>${d.falsePositives}</td><td>${d.falseNegatives}</td>
      <td>${(d.precision * 100).toFixed(0)}%</td><td>${(d.recall * 100).toFixed(0)}%</td>
      <td>${(d.f1Score * 100).toFixed(0)}%</td>
    </tr>`;
  }
  html += '</table></div>';
  return html;
}

function buildCss(): string {
  return `
    body { font-family: 'Courier New', monospace; margin: 20px; background: #1a1a2e; color: #e0e0e0; }
    h1, h2, h3 { color: #ffffff; }
    .container { max-width: 1200px; margin: 0 auto; }
    .grid { border-collapse: collapse; margin: 10px 0; }
    .grid td { width: 40px; height: 40px; text-align: center; border: 1px solid #444; font-size: 14px; font-weight: bold; }
    .grid-container { display: inline-block; margin-right: 20px; }
    .diff-grids { display: flex; gap: 30px; flex-wrap: wrap; }
    .diff-section { flex: 1; min-width: 300px; }
    .cell-correct { background: #1b5e20; color: #a5d6a7; }
    .cell-incorrect { background: #b71c1c; color: #ef9a9a; }
    .cell-missed { background: #f57f17; color: #fff8e1; }
    .cell-extra { background: #e65100; color: #ffe0b2; }
    .cell-aborted { background: #424242; color: #9e9e9e; }
    .metrics-table { border-collapse: collapse; margin: 10px 0; }
    .metrics-table td, .metrics-table th { padding: 6px 12px; border: 1px solid #444; }
    .metrics-table .value { text-align: right; font-weight: bold; }
    .mismatch-table { border-collapse: collapse; margin: 10px 0; width: 100%; }
    .mismatch-table th, .mismatch-table td { padding: 4px 8px; border: 1px solid #444; text-align: center; }
    .mismatches { margin-top: 20px; }
    .per-digit { margin-top: 20px; }
    .summary { margin: 20px 0; }
    .puzzle-section { margin: 20px 0; padding: 15px; border: 1px solid #444; border-radius: 8px; }
    .legend { margin: 10px 0; }
    .legend span { display: inline-block; padding: 2px 8px; margin-right: 10px; border-radius: 3px; font-size: 12px; }
    .nav-links { margin: 10px 0; }
    .nav-links a { color: #64b5f6; margin-right: 10px; }`;
}

export function generateHtmlReport(
  result: ComparisonResult,
  groundTruth: GroundTruthPuzzle
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Ground Truth Report — ${result.puzzleId}</title>
<style>${buildCss()}</style></head>
<body>
<div class="container">
  <h1>Ground Truth Report: ${result.puzzleId}</h1>
  <p>Timestamp: ${result.timestamp}</p>
  ${result.aborted ? '<div class="alert">Pipeline aborted: ' + (result.abortReason || 'unknown') + '</div>' : ''}
  ${metricsHtml(result)}
  ${result.aborted ? '' : diffGridHtml(result.cells, groundTruth)}
  ${result.aborted ? '' : mismatchListHtml(result.cells)}
  ${result.aborted ? '' : perDigitHtml(result.metrics.perDigit)}
</div>
</body></html>`;
}

export function generateBatchHtmlReport(batchResult: BatchResult): string {
  const puzzleSections = batchResult.puzzles.map((p, i) => {
    const acc = p.aborted ? 'Aborted' : `${(p.metrics.accuracy * 100).toFixed(1)}%`;
    return `<div class="puzzle-section" id="puzzle-${i}">
      <h2>${p.puzzleId} — ${acc}</h2>
      ${p.timestamp ? `<p>Timestamp: ${p.timestamp}</p>` : ''}
      ${p.aborted ? '<p class="aborted">Aborted: ' + (p.abortReason || 'unknown') + '</p>' : ''}
      ${p.aborted ? '' : `<div class="summary">Accuracy: ${(p.metrics.accuracy * 100).toFixed(1)}% | Precision: ${(p.metrics.precision * 100).toFixed(1)}% | Recall: ${(p.metrics.recall * 100).toFixed(1)}% | F1: ${(p.metrics.f1Score * 100).toFixed(1)}% | Coverage: ${(p.metrics.coverage * 100).toFixed(1)}% | Edit Distance: ${p.metrics.editDistance}</div>`}
    </div>`;
  }).join('\n');

  const sorted = [...batchResult.puzzles]
    .filter(p => !p.aborted)
    .sort((a, b) => b.metrics.accuracy - a.metrics.accuracy);

  let summaryRows = '';
  for (const p of sorted) {
    summaryRows += `<tr>
      <td>${p.puzzleId}</td>
      <td>${(p.metrics.accuracy * 100).toFixed(1)}%</td>
      <td>${(p.metrics.precision * 100).toFixed(1)}%</td>
      <td>${(p.metrics.recall * 100).toFixed(1)}%</td>
      <td>${(p.metrics.f1Score * 100).toFixed(1)}%</td>
      <td>${p.metrics.editDistance}</td>
    </tr>`;
  }

  const a = batchResult.aggregate;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Batch Ground Truth Report — ${batchResult.runId}</title>
<style>${buildCss()}</style></head>
<body>
<div class="container">
  <h1>Batch Ground Truth Report</h1>
  <p>Run ID: ${batchResult.runId}</p>
  <p>Timestamp: ${batchResult.timestamp}</p>

  <div class="summary">
    <h2>Aggregate Metrics</h2>
    <table class="metrics-table">
      <tr><td>Puzzles</td><td class="value">${a.totalPuzzles}</td></tr>
      <tr><td>Total Cells</td><td class="value">${a.totalCells}</td></tr>
      <tr><td>Overall Accuracy</td><td class="value">${(a.overallAccuracy * 100).toFixed(1)}%</td></tr>
      <tr><td>Overall Precision</td><td class="value">${(a.overallPrecision * 100).toFixed(1)}%</td></tr>
      <tr><td>Overall Recall</td><td class="value">${(a.overallRecall * 100).toFixed(1)}%</td></tr>
      <tr><td>Overall F1</td><td class="value">${(a.overallF1 * 100).toFixed(1)}%</td></tr>
      <tr><td>Avg Edit Distance</td><td class="value">${a.averageEditDistance.toFixed(2)}</td></tr>
    </table>
  </div>

  <h2>Summary (sorted by accuracy)</h2>
  <table class="metrics-table">
    <tr><th>Puzzle</th><th>Accuracy</th><th>Precision</th><th>Recall</th><th>F1</th><th>Edit Dist</th></tr>
    ${summaryRows}
  </table>

  <h2>Puzzle Details</h2>
  <div class="nav-links">
    ${batchResult.puzzles.map((_, i) => `<a href="#puzzle-${i}">${batchResult.puzzles[i].puzzleId}</a>`).join('')}
  </div>
  ${puzzleSections}
</div>
</body></html>`;
}
