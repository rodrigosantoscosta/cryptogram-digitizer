import { describe, it, expect } from 'vitest';
import { calculateMetrics, computeEditDistance, computePerDigitMetrics, calculateBatchMetrics } from '../../lib/testing/metrics-calculator';
import { CellComparison, ComparisonResult } from '../../types/ocr';

function cell(match: CellComparison['match'], expected: number | null = 1, actual: number | null = 1): CellComparison {
  return { row: 0, col: 0, expected, actual, confidence: 0.95, match };
}

describe('calculateMetrics', () => {
  it('returns 100% accuracy when all cells correct', () => {
    const comparisons = [
      cell('correct', 1, 1),
      cell('correct', 2, 2),
      cell('correct', 3, 3),
    ];
    const m = calculateMetrics(comparisons);
    expect(m.accuracy).toBe(1);
    expect(m.precision).toBe(1);
    expect(m.recall).toBe(1);
    expect(m.f1Score).toBe(1);
    expect(m.coverage).toBe(1);
  });

  it('returns 0% accuracy when all cells incorrect', () => {
    const comparisons = [
      cell('incorrect', 1, 2),
      cell('incorrect', 2, 3),
    ];
    const m = calculateMetrics(comparisons);
    expect(m.accuracy).toBe(0);
    expect(m.recall).toBe(0);
  });

  it('computes known expected values for mixed results', () => {
    const comparisons = [
      cell('correct', 1, 1),
      cell('correct', 2, 2),
      cell('incorrect', 3, 4),
      cell('missed', 5, null),
      cell('extra', null, 6),
    ];
    const m = calculateMetrics(comparisons);
    expect(m.accuracy).toBeCloseTo(2 / 4, 5);
    expect(m.precision).toBeCloseTo(2 / 3, 5);
    expect(m.recall).toBeCloseTo(2 / 3, 5);
    expect(m.f1Score).toBeCloseTo(2 * (2/3 * 2/3) / (2/3 + 2/3), 5);
    expect(m.coverage).toBeCloseTo(3 / 4, 5);
  });

  it('handles empty comparisons', () => {
    const m = calculateMetrics([]);
    expect(m.accuracy).toBe(0);
    expect(m.precision).toBe(0);
    expect(m.recall).toBe(0);
  });
});

describe('computeEditDistance', () => {
  it('returns 0 for identical sequences', () => {
    expect(computeEditDistance([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it('returns correct distance for completely different sequences', () => {
    expect(computeEditDistance([1, 2, 3], [4, 5, 6])).toBe(3);
  });

  it('handles insertions', () => {
    expect(computeEditDistance([1, 2, 3], [1, 2, 3, 4])).toBe(1);
  });

  it('handles deletions', () => {
    expect(computeEditDistance([1, 2, 3, 4], [1, 2, 3])).toBe(1);
  });

  it('treats null as a distinct value', () => {
    expect(computeEditDistance([1, null, 3], [1, 2, 3])).toBe(1);
  });

  it('returns 0 for empty sequences', () => {
    expect(computeEditDistance([], [])).toBe(0);
  });
});

describe('computePerDigitMetrics', () => {
  it('counts true positives correctly', () => {
    const comparisons = [
      cell('correct', 5, 5),
      cell('correct', 5, 5),
    ];
    const m = computePerDigitMetrics(comparisons);
    expect(m['5'].truePositives).toBe(2);
    expect(m['5'].falseNegatives).toBe(0);
  });

  it('counts false negatives for missed cells', () => {
    const comparisons = [
      cell('missed', 5, null),
    ];
    const m = computePerDigitMetrics(comparisons);
    expect(m['5'].falseNegatives).toBe(1);
  });

  it('counts false positives for incorrect cells', () => {
    const comparisons = [
      cell('incorrect', 5, 7),
    ];
    const m = computePerDigitMetrics(comparisons);
    expect(m['5'].falseNegatives).toBe(1);
    expect(m['7'].falsePositives).toBe(1);
  });

  it('computes precision and recall per digit', () => {
    const comparisons = [
      cell('correct', 5, 5),
      cell('incorrect', 5, 7),
    ];
    const m = computePerDigitMetrics(comparisons);
    expect(m['5'].precision).toBe(1);
    expect(m['5'].recall).toBeCloseTo(1 / 2, 5);
    expect(m['7'].falsePositives).toBe(1);
  });
});

describe('calculateBatchMetrics', () => {
  it('aggregates across multiple puzzles', () => {
    const result1: ComparisonResult = {
      puzzleId: 'a', timestamp: '', cells: [cell('correct', 1, 1)], metrics: calculateMetrics([cell('correct', 1, 1)]), aborted: false,
    };
    const result2: ComparisonResult = {
      puzzleId: 'b', timestamp: '', cells: [cell('incorrect', 1, 2)], metrics: calculateMetrics([cell('incorrect', 1, 2)]), aborted: false,
    };
    const agg = calculateBatchMetrics([result1, result2]);
    expect(agg.totalPuzzles).toBe(2);
    expect(agg.overallAccuracy).toBeCloseTo(0.5, 5);
    expect(agg.perPuzzleSummary).toHaveLength(2);
  });

  it('skips aborted puzzles in aggregate', () => {
    const result1: ComparisonResult = {
      puzzleId: 'a', timestamp: '', cells: [cell('correct', 1, 1)], metrics: calculateMetrics([cell('correct', 1, 1)]), aborted: false,
    };
    const aborted: ComparisonResult = {
      puzzleId: 'b', timestamp: '', cells: [], metrics: calculateMetrics([]), aborted: true, abortReason: 'fail',
    };
    const agg = calculateBatchMetrics([result1, aborted]);
    expect(agg.totalPuzzles).toBe(2);
    expect(agg.perPuzzleSummary).toHaveLength(1);
  });
});
