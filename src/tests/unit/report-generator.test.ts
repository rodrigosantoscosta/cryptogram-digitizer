import { describe, it, expect } from 'vitest';
import { generateHtmlReport, generateBatchHtmlReport } from '../../lib/testing/report-generator';
import { ComparisonResult, BatchResult, GroundTruthPuzzle, BatchConfig } from '../../types/ocr';

const groundTruth: GroundTruthPuzzle = {
  puzzleId: 'test',
  sourceImage: 'test.jpg',
  type: 'numeric',
  dimensions: { rows: 2, cols: 2 },
  valueRange: { min: 1, max: 27 },
  grid: [[1, 2], [3, 4]],
  frequency: {},
  metadata: { validatedBy: 'test', validatedAt: '2026-01-01T00:00:00Z' },
};

function makeResult(overrides?: Partial<ComparisonResult>): ComparisonResult {
  return {
    puzzleId: 'test',
    timestamp: '2026-01-01T00:00:00.000Z',
    cells: [
      { row: 0, col: 0, expected: 1, actual: 1, confidence: 0.95, match: 'correct' },
      { row: 0, col: 1, expected: 2, actual: 9, confidence: 0.5, match: 'incorrect' },
      { row: 1, col: 0, expected: 3, actual: null, confidence: 0, match: 'missed' },
      { row: 1, col: 1, expected: 4, actual: 4, confidence: 0.95, match: 'correct' },
    ],
    metrics: {
      accuracy: 0.5,
      precision: 0.6667,
      recall: 0.5,
      f1Score: 0.5,
      coverage: 0.75,
      editDistance: 2,
      normalizedEditDistance: 0.5,
      perDigit: {},
    },
    aborted: false,
    ...overrides,
  };
}

describe('generateHtmlReport', () => {
  it('returns a complete HTML document', () => {
    const html = generateHtmlReport(makeResult(), groundTruth);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Ground Truth Report');
    expect(html).toContain('</html>');
  });

  it('contains metrics values', () => {
    const html = generateHtmlReport(makeResult(), groundTruth);
    expect(html).toContain('50.0%');
    expect(html).toContain('66.7%');
  });

  it('contains grid tables', () => {
    const html = generateHtmlReport(makeResult(), groundTruth);
    expect(html).toMatch(/<table class="grid">/);
    expect(html).toContain('Expected');
    expect(html).toContain('Actual');
  });

  it('contains mismatch list when there are mismatches', () => {
    const html = generateHtmlReport(makeResult(), groundTruth);
    expect(html).toContain('Mismatches');
    expect(html).toContain('incorrect');
  });

  it('applies color classes for match types', () => {
    const html = generateHtmlReport(makeResult(), groundTruth);
    expect(html).toContain('cell-correct');
    expect(html).toContain('cell-incorrect');
    expect(html).toContain('cell-missed');
  });

  it('handles aborted results', () => {
    const aborted = makeResult({ aborted: true, abortReason: 'Pipeline failed', cells: [] });
    const html = generateHtmlReport(aborted, groundTruth);
    expect(html).toContain('Pipeline failed');
  });
});

describe('generateBatchHtmlReport', () => {
  const config: BatchConfig = { apiUrl: 'http://localhost:3001', earlyAbortThreshold: 0.25, minCellsProcessed: 24, puzzles: ['test'] };
  const batchResult: BatchResult = {
    runId: 'run-20260101-000000',
    timestamp: '2026-01-01T00:00:00.000Z',
    puzzles: [makeResult()],
    aggregate: {
      totalPuzzles: 1,
      totalCells: 4,
      overallAccuracy: 0.5,
      overallPrecision: 0.6667,
      overallRecall: 0.5,
      overallF1: 0.5,
      averageEditDistance: 2,
      perPuzzleSummary: [{ puzzleId: 'test', accuracy: 0.5, coverage: 0.75 }],
    },
    config,
  };

  it('returns a complete HTML document', () => {
    const html = generateBatchHtmlReport(batchResult);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Batch Ground Truth Report');
  });

  it('contains aggregate metrics', () => {
    const html = generateBatchHtmlReport(batchResult);
    expect(html).toContain('50.0%');
  });

  it('contains per-puzzle sections', () => {
    const html = generateBatchHtmlReport(batchResult);
    expect(html).toContain('puzzle-section');
    expect(html).toContain('test');
  });

  it('handles empty results gracefully', () => {
    const allAborted = makeResult({ aborted: true, abortReason: 'fail', cells: [], metrics: {
      accuracy: 0, precision: 0, recall: 0, f1Score: 0, coverage: 0, editDistance: 0, normalizedEditDistance: 0, perDigit: {},
    } });
    const batch: BatchResult = {
      runId: 'run-20260101-000000', timestamp: '', puzzles: [allAborted],
      aggregate: { totalPuzzles: 1, totalCells: 0, overallAccuracy: 0, overallPrecision: 0, overallRecall: 0, overallF1: 0, averageEditDistance: 0, perPuzzleSummary: [] },
      config,
    };
    const html = generateBatchHtmlReport(batch);
    expect(html).toContain('Aborted');
  });
});
