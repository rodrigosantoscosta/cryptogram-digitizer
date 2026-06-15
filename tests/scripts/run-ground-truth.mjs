#!/usr/bin/env node

/**
 * Ground Truth Comparison CLI
 *
 * Usage:
 *   node tests/scripts/run-ground-truth.mjs --puzzle sample --report
 *   node tests/scripts/run-ground-truth.mjs --all --threshold 85
 *
 * Options:
 *   --puzzle <id>       Run comparison for a single puzzle
 *   --all               Run comparison for all available puzzles
 *   --api-url <url>     Backend OCR API URL (default: http://localhost:3001)
 *   --output <dir>      Output directory for results (default: tests/results)
 *   --report            Generate HTML report
 *   --threshold <n>     Accuracy threshold for exit code (default: 0)
 *   --help              Show this help
 */

import path from 'node:path';
import fs from 'node:fs';

const args = process.argv.slice(2);
const opts = {
  puzzle: null,
  all: false,
  apiUrl: 'http://localhost:3001',
  output: null,
  report: false,
  threshold: 0,
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--puzzle': opts.puzzle = args[++i]; break;
    case '--all': opts.all = true; break;
    case '--api-url': opts.apiUrl = args[++i]; break;
    case '--output': opts.output = args[++i]; break;
    case '--report': opts.report = true; break;
    case '--threshold': opts.threshold = parseFloat(args[++i]); break;
    case '--help':
      console.log(fs.readFileSync(new URL(import.meta.url), 'utf-8').split('\n').slice(2, 15).join('\n'));
      process.exit(0);
  }
}

if (!opts.puzzle && !opts.all) {
  console.error('Error: Specify --puzzle <id> or --all');
  process.exit(1);
}

async function main() {
  const { listPuzzleIds, loadGroundTruth } = await import('../../src/lib/testing/ground-truth-loader.ts');
  const { runSinglePuzzle, runBatch } = await import('../../src/lib/testing/batch-runner.ts');
  const { saveResult, saveBatchResult } = await import('../../src/lib/testing/result-store.ts');
  const { generateHtmlReport, generateBatchHtmlReport } = await import('../../src/lib/testing/report-generator.ts');

  const puzzles = opts.all ? await listPuzzleIds() : [opts.puzzle];

  if (opts.puzzle && !opts.all) {
    // Single puzzle mode
    const groundTruth = await loadGroundTruth(opts.puzzle);
    console.log(`\nRunning comparison for: ${opts.puzzle}`);
    console.log(`  Grid: ${groundTruth.dimensions.rows}x${groundTruth.dimensions.cols}`);
    console.log(`  API: ${opts.apiUrl}\n`);

    // TODO: Replace with actual OCR pipeline call
    // For now, this requires a CellNumberMap input via stdin or file
    console.log('Error: Single puzzle mode requires a CellNumberMap input.');
    console.log('Use the batch runner with a getCellNumberMap callback instead.');
    process.exit(1);
  }

  if (opts.all) {
    console.log(`\nBatch mode: ${puzzles.length} puzzle(s) found`);
    console.log(`  API: ${opts.apiUrl}\n`);

    // Mock getCellNumberMap — replace with real OCR pipeline integration
    const getCellNumberMap = async (puzzleId) => {
      throw new Error(`OCR pipeline not yet integrated. Puzzle: ${puzzleId}`);
    };

    const config = {
      apiUrl: opts.apiUrl,
      earlyAbortThreshold: 0.25,
      minCellsProcessed: 24,
      puzzles,
    };

    const result = await runBatch(config, getCellNumberMap);
    console.log(`\nBatch complete. Run ID: ${result.runId}`);
    console.log(`  Puzzles: ${result.aggregate.totalPuzzles}`);
    console.log(`  Overall Accuracy: ${(result.aggregate.overallAccuracy * 100).toFixed(1)}%`);
    console.log(`  Overall Precision: ${(result.aggregate.overallPrecision * 100).toFixed(1)}%`);
    console.log(`  Overall F1: ${(result.aggregate.overallF1 * 100).toFixed(1)}%`);

    const passed = result.aggregate.overallAccuracy >= (opts.threshold / 100);
    console.log(`\nThreshold: ${opts.threshold}% — ${passed ? 'PASSED' : 'FAILED'}`);
    process.exit(passed ? 0 : 1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
