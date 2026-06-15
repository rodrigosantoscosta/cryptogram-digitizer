import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateGroundTruth } from '../../lib/testing/ground-truth-loader';

const validData = {
  puzzleId: 'test-puzzle',
  sourceImage: 'samples/test.jpg',
  type: 'numeric',
  dimensions: { rows: 2, cols: 3 },
  valueRange: { min: 1, max: 27 },
  grid: [[1, 2, 3], [4, 5, 6]],
  frequency: { '1': 1, '2': 1, '3': 1, '4': 1, '5': 1, '6': 1 },
  metadata: { validatedBy: 'test', validatedAt: '2026-01-01T00:00:00Z' },
};

describe('validateGroundTruth', () => {
  it('accepts valid ground truth data', () => {
    const result = validateGroundTruth(validData);
    expect(result.puzzleId).toBe('test-puzzle');
  });

  it('rejects missing puzzleId', () => {
    const { puzzleId, ...rest } = validData;
    expect(() => validateGroundTruth(rest)).toThrow('puzzleId');
  });

  it('rejects empty puzzleId', () => {
    expect(() => validateGroundTruth({ ...validData, puzzleId: '' })).toThrow('puzzleId');
  });

  it('rejects invalid type', () => {
    expect(() => validateGroundTruth({ ...validData, type: 'invalid' })).toThrow('type');
  });

  it('rejects grid row count mismatch', () => {
    expect(() => validateGroundTruth({
      ...validData,
      grid: [[1, 2, 3]],
    })).toThrow('row count');
  });

  it('rejects grid column count mismatch', () => {
    expect(() => validateGroundTruth({
      ...validData,
      grid: [[1, 2], [3, 4]],
    })).toThrow('does not match dimensions.cols');
  });

  it('rejects out-of-range value', () => {
    expect(() => validateGroundTruth({
      ...validData,
      grid: [[1, 2, 99], [4, 5, 6]],
    })).toThrow('outside valueRange');
  });

  it('accepts null values in grid', () => {
    const result = validateGroundTruth({
      ...validData,
      grid: [[1, null, 3], [4, 5, 6]],
    });
    expect(result.grid[0][1]).toBeNull();
  });

  it('rejects missing metadata.validatedBy', () => {
    expect(() => validateGroundTruth({
      ...validData,
      metadata: { validatedBy: '', validatedAt: '2026-01-01T00:00:00Z' },
    })).toThrow('metadata.validatedBy');
  });
});
