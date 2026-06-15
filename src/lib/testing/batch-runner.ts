import { CellNumberMap, BatchResult, ComparisonResult, BatchConfig } from '../../types/ocr';
import { GroundTruthPuzzle } from '../../types/ocr';
import { loadGroundTruth } from './ground-truth-loader';
import { comparePipeline } from './comparison-engine';
import { calculateBatchMetrics } from './metrics-calculator';
import { saveBatchResult } from './result-store';

function generateRunId(): string {
  const now = new Date();
  const pad = (n: number, d: number = 2) => String(n).padStart(d, '0');
  return `run-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export async function runSinglePuzzle(
  puzzleId: string,
  actual: CellNumberMap,
  config?: Partial<BatchConfig>
): Promise<ComparisonResult> {
  const expected: GroundTruthPuzzle = await loadGroundTruth(puzzleId);
  return comparePipeline(actual, expected);
}

export async function runBatch(
  config: BatchConfig,
  getCellNumberMap: (puzzleId: string) => Promise<CellNumberMap>
): Promise<BatchResult> {
  const runId = generateRunId();
  const timestamp = new Date().toISOString();
  const puzzles: ComparisonResult[] = [];

  for (const puzzleId of config.puzzles) {
    try {
      const actual = await getCellNumberMap(puzzleId);
      const result = await runSinglePuzzle(puzzleId, actual, config);
      puzzles.push(result);
    } catch (err) {
      puzzles.push({
        puzzleId,
        timestamp: new Date().toISOString(),
        cells: [],
        metrics: {
          accuracy: 0,
          precision: 0,
          recall: 0,
          f1Score: 0,
          coverage: 0,
          editDistance: 0,
          normalizedEditDistance: 0,
          perDigit: {},
        },
        aborted: true,
        abortReason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const aggregate = calculateBatchMetrics(puzzles);
  const batchResult: BatchResult = { runId, timestamp, puzzles, aggregate, config };

  try {
    await saveBatchResult(batchResult);
  } catch {
    // non-critical: results directory may not be writable in all environments
  }

  return batchResult;
}
