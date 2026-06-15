import { describe, it, expect } from 'vitest';
import { compareCells, comparePipeline } from '../../lib/testing/comparison-engine';
import { CellNumber, CellNumberMap, GroundTruthPuzzle } from '../../types/ocr';

const sampleGroundTruth: GroundTruthPuzzle = {
  puzzleId: 'test',
  sourceImage: 'test.jpg',
  type: 'numeric',
  dimensions: { rows: 2, cols: 3 },
  valueRange: { min: 1, max: 27 },
  grid: [[1, 2, 3], [4, 5, 6]],
  frequency: {},
  metadata: { validatedBy: 'test', validatedAt: '2026-01-01T00:00:00Z' },
};

function makeCell(row: number, col: number, number: number | null): CellNumber {
  return { row, col, number, confidence: 0.95, rawText: String(number ?? ''), rawOcr: String(number ?? '') };
}

describe('compareCells', () => {
  it('marks all cells correct when actual matches expected', () => {
    const actual = [
      makeCell(0, 0, 1), makeCell(0, 1, 2), makeCell(0, 2, 3),
      makeCell(1, 0, 4), makeCell(1, 1, 5), makeCell(1, 2, 6),
    ];
    const result = compareCells(actual, sampleGroundTruth);
    expect(result.every(c => c.match === 'correct')).toBe(true);
    expect(result).toHaveLength(6);
  });

  it('marks cells incorrect when values differ', () => {
    const actual = [
      makeCell(0, 0, 99), makeCell(0, 1, 2), makeCell(0, 2, 3),
      makeCell(1, 0, 4), makeCell(1, 1, 5), makeCell(1, 2, 6),
    ];
    const result = compareCells(actual, sampleGroundTruth);
    expect(result[0].match).toBe('incorrect');
    expect(result[0].expected).toBe(1);
    expect(result[0].actual).toBe(99);
  });

  it('marks cells as missed when expected has value but actual is null', () => {
    const actual = [
      makeCell(0, 0, null), makeCell(0, 1, 2), makeCell(0, 2, 3),
      makeCell(1, 0, 4), makeCell(1, 1, 5), makeCell(1, 2, 6),
    ];
    const result = compareCells(actual, sampleGroundTruth);
    expect(result[0].match).toBe('missed');
  });

  it('marks cells as extra when actual has value but expected is null', () => {
    const groundWithNull: GroundTruthPuzzle = {
      ...sampleGroundTruth,
      grid: [[null, 2, 3], [4, 5, 6]],
    };
    const actual = [
      makeCell(0, 0, 99), makeCell(0, 1, 2), makeCell(0, 2, 3),
      makeCell(1, 0, 4), makeCell(1, 1, 5), makeCell(1, 2, 6),
    ];
    const result = compareCells(actual, groundWithNull);
    expect(result[0].match).toBe('extra');
  });

  it('handles mixed results', () => {
    const actual = [
      makeCell(0, 0, 1), makeCell(0, 1, 99), makeCell(0, 2, null),
      makeCell(1, 0, 4), makeCell(1, 1, 5), makeCell(1, 2, 6),
    ];
    const result = compareCells(actual, sampleGroundTruth);
    const correct = result.filter(c => c.match === 'correct').length;
    const incorrect = result.filter(c => c.match === 'incorrect').length;
    const missed = result.filter(c => c.match === 'missed').length;
    expect(correct).toBe(4);
    expect(incorrect).toBe(1);
    expect(missed).toBe(1);
  });

  it('handles dimension mismatch with extra actual cells', () => {
    const actual = [
      makeCell(0, 0, 1), makeCell(0, 1, 2), makeCell(0, 2, 3),
      makeCell(1, 0, 4), makeCell(1, 1, 5), makeCell(1, 2, 6),
      makeCell(2, 0, 7),
    ];
    const result = compareCells(actual, sampleGroundTruth);
    const extras = result.filter(c => c.match === 'extra');
    expect(extras.length).toBeGreaterThanOrEqual(1);
  });
});

describe('comparePipeline', () => {
  it('returns normal ComparisonResult when not aborted', () => {
    const actual: CellNumberMap = {
      cells: [
        makeCell(0, 0, 1), makeCell(0, 1, 2), makeCell(0, 2, 3),
        makeCell(1, 0, 4), makeCell(1, 1, 5), makeCell(1, 2, 6),
      ],
      bySymbol: {},
      recognized: 6,
      total: 6,
    };
    const result = comparePipeline(actual, sampleGroundTruth);
    expect(result.aborted).toBe(false);
    expect(result.metrics.accuracy).toBe(1);
  });

  it('returns aborted result when CellNumberMap is aborted', () => {
    const actual: CellNumberMap = {
      cells: [],
      bySymbol: {},
      recognized: 0,
      total: 96,
      aborted: true,
      abortReason: 'Early abort at 25% coverage',
    };
    const result = comparePipeline(actual, sampleGroundTruth);
    expect(result.aborted).toBe(true);
    expect(result.abortReason).toBe('Early abort at 25% coverage');
    expect(result.cells.every(c => c.match === 'aborted')).toBe(true);
  });
});
