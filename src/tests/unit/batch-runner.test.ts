import { describe, it, expect, vi } from 'vitest';
import { runSinglePuzzle, runBatch } from '../../lib/testing/batch-runner';
import { CellNumberMap, CellNumber, BatchConfig } from '../../types/ocr';

vi.mock('../../lib/testing/ground-truth-loader', () => ({
  loadGroundTruth: vi.fn(async (puzzleId: string) => ({
    puzzleId,
    sourceImage: `${puzzleId}.jpg`,
    type: 'numeric',
    dimensions: { rows: 2, cols: 2 },
    valueRange: { min: 1, max: 27 },
    grid: [[1, 2], [3, 4]],
    frequency: {},
    metadata: { validatedBy: 'test', validatedAt: '2026-01-01T00:00:00Z' },
  })),
}));

vi.mock('../../lib/testing/report-generator', () => ({
  generateBatchHtmlReport: vi.fn(() => '<html></html>'),
}));

vi.mock('../../lib/testing/result-store', () => ({
  saveBatchResult: vi.fn(async () => ({ jsonPath: 'test.json', htmlPath: 'test.html' })),
}));

function makeCell(row: number, col: number, number: number | null): CellNumber {
  return { row, col, number, confidence: 0.95, rawText: String(number ?? ''), rawOcr: String(number ?? '') };
}

describe('runSinglePuzzle', () => {
  it('returns a ComparisonResult for a valid puzzle', async () => {
    const cellMap: CellNumberMap = {
      cells: [
        makeCell(0, 0, 1), makeCell(0, 1, 2),
        makeCell(1, 0, 3), makeCell(1, 1, 4),
      ],
      bySymbol: {},
      recognized: 4,
      total: 4,
    };
    const result = await runSinglePuzzle('test-puzzle', cellMap);
    expect(result.puzzleId).toBe('test-puzzle');
    expect(result.aborted).toBe(false);
    expect(result.metrics.accuracy).toBe(1);
  });

  it('handles aborted cell maps', async () => {
    const cellMap: CellNumberMap = {
      cells: [],
      bySymbol: {},
      recognized: 0,
      total: 4,
      aborted: true,
    };
    const result = await runSinglePuzzle('test-puzzle', cellMap);
    expect(result.aborted).toBe(true);
  });
});

describe('runBatch', () => {
  const config: BatchConfig = {
    apiUrl: 'http://localhost:3001',
    earlyAbortThreshold: 0.25,
    minCellsProcessed: 24,
    puzzles: ['puzzle-a', 'puzzle-b'],
  };

  it('runs batch and returns BatchResult', async () => {
    let callCount = 0;
    const getCellNumberMap = async (puzzleId: string): Promise<CellNumberMap> => {
      callCount++;
      return {
        cells: [
          makeCell(0, 0, 1), makeCell(0, 1, 2),
          makeCell(1, 0, 3), makeCell(1, 1, 4),
        ],
        bySymbol: {},
        recognized: 4,
        total: 4,
      };
    };

    const batchResult = await runBatch(config, getCellNumberMap);
    expect(batchResult.runId).toMatch(/^run-/);
    expect(batchResult.puzzles).toHaveLength(2);
    expect(batchResult.aggregate.totalPuzzles).toBe(2);
    expect(callCount).toBe(2);
  });

  it('handles per-puzzle errors gracefully', async () => {
    let callCount = 0;
    const getCellNumberMap = async (puzzleId: string): Promise<CellNumberMap> => {
      callCount++;
      if (puzzleId === 'puzzle-b') throw new Error('OCR service unavailable');
      return {
        cells: [makeCell(0, 0, 1)],
        bySymbol: {},
        recognized: 1,
        total: 1,
      };
    };

    const batchResult = await runBatch(config, getCellNumberMap);
    expect(batchResult.puzzles).toHaveLength(2);
    expect(batchResult.puzzles[1].aborted).toBe(true);
    expect(batchResult.puzzles[1].abortReason).toContain('OCR service unavailable');
  });
});
