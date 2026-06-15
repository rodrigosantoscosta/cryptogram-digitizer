import { CellNumber, CellNumberMap, CellComparison, ComparisonResult } from '../../types/ocr';
import { GroundTruthPuzzle } from '../../types/ocr';
import { calculateMetrics } from './metrics-calculator';

export function compareCells(
  actual: CellNumber[],
  expected: GroundTruthPuzzle
): CellComparison[] {
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

export function comparePipeline(
  actual: CellNumberMap,
  expected: GroundTruthPuzzle
): ComparisonResult {
  const timestamp = new Date().toISOString();

  if (actual.aborted) {
    const cells: CellComparison[] = [];
    for (let r = 0; r < expected.grid.length; r++) {
      for (let c = 0; c < expected.grid[r].length; c++) {
        cells.push({
          row: r, col: c,
          expected: expected.grid[r][c],
          actual: null,
          confidence: 0,
          match: 'aborted',
        });
      }
    }
    return {
      puzzleId: expected.puzzleId,
      timestamp,
      cells,
      metrics: {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
        coverage: 0,
        editDistance: expected.grid.flat().filter(v => v !== null).length,
        normalizedEditDistance: 1,
        perDigit: {},
      },
      aborted: true,
      abortReason: actual.abortReason,
    };
  }

  const cells = compareCells(actual.cells, expected);
  const metrics = calculateMetrics(cells);

  return {
    puzzleId: expected.puzzleId,
    timestamp,
    cells,
    metrics,
    aborted: false,
  };
}
