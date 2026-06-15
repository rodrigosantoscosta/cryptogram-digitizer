import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { saveResult, loadHistory, loadLatestResult, getAccuracyTrend } from '../../lib/testing/result-store';
import { ComparisonResult } from '../../types/ocr';
import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const RESULTS_DIR = path.resolve(process.cwd(), 'tests', 'results');
const TEST_DIR = path.join(RESULTS_DIR, '__test__');

function makeResult(ts: string, accuracy?: number): ComparisonResult {
  return {
    puzzleId: '__test__',
    timestamp: ts,
    cells: [],
    metrics: {
      accuracy: accuracy ?? 0.95, precision: 0.95, recall: 0.95, f1Score: 0.95, coverage: 1,
      editDistance: 1, normalizedEditDistance: 0.01, perDigit: {},
    },
    aborted: false,
  };
}

beforeAll(async () => {
  await mkdir(TEST_DIR, { recursive: true });
});

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe('saveResult + loadHistory round-trip', () => {
  it('saves and loads a single result', async () => {
    const result = makeResult('2026-06-07T12:00:00.000Z');
    const filePath = await saveResult(result);

    expect(filePath).toContain('__test__');
    expect(filePath).toContain('.json');

    const history = await loadHistory('__test__');
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history.some(r => r.timestamp === '2026-06-07T12:00:00.000Z')).toBe(true);
  });

  it('returns sorted history by timestamp ascending', async () => {
    await saveResult(makeResult('2026-01-01T00:00:00.000Z', 0.5));
    await saveResult(makeResult('2026-12-01T00:00:00.000Z', 0.99));

    const history = await loadHistory('__test__');
    expect(history).toHaveLength(3);
    expect(history[0].timestamp).toBe('2026-01-01T00:00:00.000Z');
    expect(history[2].timestamp).toBe('2026-12-01T00:00:00.000Z');
  });
});

describe('loadLatestResult', () => {
  it('returns the most recent result', async () => {
    const latest = await loadLatestResult('__test__');
    expect(latest).not.toBeNull();
    expect(latest!.timestamp).toBe('2026-12-01T00:00:00.000Z');
    expect(latest!.metrics.accuracy).toBe(0.99);
  });

  it('returns null for unknown puzzle', async () => {
    const latest = await loadLatestResult('__nonexistent__');
    expect(latest).toBeNull();
  });
});

describe('getAccuracyTrend', () => {
  it('extracts timestamp/accuracy pairs', async () => {
    const trend = await getAccuracyTrend('__test__');
    expect(trend).toHaveLength(3);
    expect(trend[0].accuracy).toBe(0.5);
    expect(trend[2].accuracy).toBe(0.99);
  });

  it('returns empty array for unknown puzzle', async () => {
    const trend = await getAccuracyTrend('__nonexistent__');
    expect(trend).toHaveLength(0);
  });
});
