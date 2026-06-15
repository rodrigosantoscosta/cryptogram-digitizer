import { CellComparison, PuzzleMetrics, DigitMetrics, ComparisonResult, AggregateMetrics } from '../../types/ocr';

export function calculateMetrics(comparisons: CellComparison[]): PuzzleMetrics {
  let correct = 0;
  let incorrect = 0;
  let missed = 0;
  let extra = 0;
  let aborted = 0;

  for (const c of comparisons) {
    if (c.match === 'correct') correct++;
    else if (c.match === 'incorrect') incorrect++;
    else if (c.match === 'missed') missed++;
    else if (c.match === 'extra') extra++;
    else if (c.match === 'aborted') aborted++;
  }

  const totalExpected = correct + incorrect + missed;
  const accuracy = totalExpected > 0 ? correct / totalExpected : 0;
  const precision = (correct + extra) > 0 ? correct / (correct + extra) : 0;
  const recall = (correct + missed) > 0 ? correct / (correct + missed) : 0;
  const f1Score = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  const coverage = totalExpected > 0 ? (correct + incorrect) / totalExpected : 0;

  const expectedSeq = comparisons.map(c => c.expected);
  const actualSeq = comparisons.map(c => c.actual);
  const editDistance = computeEditDistance(expectedSeq, actualSeq);
  const normalizedEditDistance = expectedSeq.length > 0 ? editDistance / expectedSeq.length : 0;

  const perDigit = computePerDigitMetrics(comparisons);

  return {
    accuracy,
    precision,
    recall,
    f1Score,
    coverage,
    editDistance,
    normalizedEditDistance,
    perDigit,
  };
}

export function computeEditDistance(
  expected: (number | null)[],
  actual: (number | null)[]
): number {
  const m = expected.length;
  const n = actual.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = expected[i - 1] === actual[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

export function computePerDigitMetrics(
  comparisons: CellComparison[]
): Record<string, DigitMetrics> {
  const digitMap = new Map<number, DigitMetrics>();

  for (let d = 1; d <= 27; d++) {
    digitMap.set(d, {
      digit: d,
      truePositives: 0,
      falsePositives: 0,
      falseNegatives: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
    });
  }

  for (const c of comparisons) {
    if (c.match === 'aborted') continue;

    if (c.expected !== null) {
      const m = digitMap.get(c.expected)!;
      if (c.match === 'correct') {
        m.truePositives++;
      } else {
        m.falseNegatives++;
      }
    }

    if (c.actual !== null && c.match === 'extra') {
      const m = digitMap.get(c.actual);
      if (m) {
        m.falsePositives++;
      }
    }

    if (c.actual !== null && c.match === 'incorrect') {
      const am = digitMap.get(c.actual);
      if (am) {
        am.falsePositives++;
      }
    }
  }

  for (const m of digitMap.values()) {
    m.precision = (m.truePositives + m.falsePositives) > 0
      ? m.truePositives / (m.truePositives + m.falsePositives)
      : 0;
    m.recall = (m.truePositives + m.falseNegatives) > 0
      ? m.truePositives / (m.truePositives + m.falseNegatives)
      : 0;
    m.f1Score = (m.precision + m.recall) > 0
      ? 2 * (m.precision * m.recall) / (m.precision + m.recall)
      : 0;
  }

  const result: Record<string, DigitMetrics> = {};
  for (const [key, value] of digitMap) {
    result[String(key)] = value;
  }
  return result;
}

export function calculateBatchMetrics(results: ComparisonResult[]): AggregateMetrics {
  let totalCorrect = 0;
  let totalIncorrect = 0;
  let totalMissed = 0;
  let totalExtra = 0;
  let totalEditDistance = 0;
  let totalCells = 0;
  let totalExpected = 0;

  const perPuzzleSummary: { puzzleId: string; accuracy: number; coverage: number }[] = [];

  for (const result of results) {
    if (result.aborted) continue;

    let correct = 0;
    let incorrect = 0;
    let missed = 0;
    let extra = 0;

    for (const c of result.cells) {
      if (c.match === 'correct') correct++;
      else if (c.match === 'incorrect') incorrect++;
      else if (c.match === 'missed') missed++;
      else if (c.match === 'extra') extra++;
    }

    totalCorrect += correct;
    totalIncorrect += incorrect;
    totalMissed += missed;
    totalExtra += extra;
    totalEditDistance += result.metrics.editDistance;
    totalCells += result.cells.length;

    const exp = correct + incorrect + missed;
    totalExpected += exp;
    perPuzzleSummary.push({
      puzzleId: result.puzzleId,
      accuracy: exp > 0 ? correct / exp : 0,
      coverage: exp > 0 ? (correct + incorrect) / exp : 0,
    });
  }

  const overallAccuracy = totalExpected > 0 ? totalCorrect / totalExpected : 0;
  const overallPrecision = (totalCorrect + totalExtra) > 0 ? totalCorrect / (totalCorrect + totalExtra) : 0;
  const overallRecall = (totalCorrect + totalMissed) > 0 ? totalCorrect / (totalCorrect + totalMissed) : 0;
  const overallF1 = (overallPrecision + overallRecall) > 0
    ? 2 * (overallPrecision * overallRecall) / (overallPrecision + overallRecall)
    : 0;
  const averageEditDistance = results.length > 0 ? totalEditDistance / results.filter(r => !r.aborted).length : 0;

  return {
    totalPuzzles: results.length,
    totalCells,
    overallAccuracy,
    overallPrecision,
    overallRecall,
    overallF1,
    averageEditDistance,
    perPuzzleSummary,
  };
}
