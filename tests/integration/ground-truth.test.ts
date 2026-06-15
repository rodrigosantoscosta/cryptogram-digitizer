import { describe, it, expect, beforeAll } from 'vitest';
import { loadGroundTruth } from '../../src/lib/testing/ground-truth-loader';
import { comparePipeline } from '../../src/lib/testing/comparison-engine';
import { CellNumberMap } from '../../src/types/ocr';
import fs from 'node:fs';
import path from 'node:path';

let sampleGroundTruth: any;
let sampleCellNumberMap: CellNumberMap;

beforeAll(async () => {
  sampleGroundTruth = await loadGroundTruth('sample');
  const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/sample-cell-number-map.json');
  sampleCellNumberMap = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
});

describe('Ground Truth Integration', () => {
  it('loads sample ground truth correctly', () => {
    expect(sampleGroundTruth.puzzleId).toBe('sample');
    expect(sampleGroundTruth.dimensions).toEqual({ rows: 12, cols: 8 });
    expect(sampleGroundTruth.grid).toHaveLength(12);
    expect(sampleGroundTruth.grid[0]).toHaveLength(8);
  });

  it('runs comparison against sample cell number map', () => {
    const result = comparePipeline(sampleCellNumberMap, sampleGroundTruth);
    expect(result.puzzleId).toBe('sample');
    expect(result.aborted).toBe(false);
    expect(result.cells.length).toBeGreaterThan(0);
    expect(result.metrics.accuracy).toBeGreaterThanOrEqual(0);
    expect(result.metrics.accuracy).toBeLessThanOrEqual(1);
  });

  it('computes non-zero metrics for sample data', () => {
    const result = comparePipeline(sampleCellNumberMap, sampleGroundTruth);
    console.log(`Integration test metrics for sample:
  Accuracy: ${(result.metrics.accuracy * 100).toFixed(1)}%
  Precision: ${(result.metrics.precision * 100).toFixed(1)}%
  Recall: ${(result.metrics.recall * 100).toFixed(1)}%
  F1: ${(result.metrics.f1Score * 100).toFixed(1)}%
  Coverage: ${(result.metrics.coverage * 100).toFixed(1)}%
  Edit Distance: ${result.metrics.editDistance}`);
    expect(result.metrics.accuracy).toBeGreaterThan(0);
    expect(result.metrics.editDistance).toBeGreaterThanOrEqual(0);
  });

  it('produces matching metrics between expected and actual first 2 rows', () => {
    const result = comparePipeline(sampleCellNumberMap, sampleGroundTruth);
    // First 2 rows (16 cells) from sample-cell-number-map should all be correct
    // since they match the ground truth sample data
    const firstTwoRows = result.cells.filter(c => c.row < 2);
    expect(firstTwoRows.every(c => c.match === 'correct')).toBe(true);
  });
});
