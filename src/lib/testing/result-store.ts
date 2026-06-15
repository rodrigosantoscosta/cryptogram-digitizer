import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ComparisonResult, BatchResult } from '../../types/ocr';

const RESULTS_DIR = path.resolve(process.cwd(), 'tests', 'results');

function safeTimestamp(iso: string): string {
  return iso.replace(/:/g, '-');
}

export async function saveResult(result: ComparisonResult): Promise<string> {
  const puzzleDir = path.join(RESULTS_DIR, result.puzzleId);
  await mkdir(puzzleDir, { recursive: true });
  const fileName = `${safeTimestamp(result.timestamp)}.json`;
  const filePath = path.join(puzzleDir, fileName);
  await writeFile(filePath, JSON.stringify(result, null, 2), 'utf-8');
  return filePath;
}

export async function saveBatchResult(batchResult: BatchResult): Promise<{ jsonPath: string; htmlPath: string }> {
  const batchDir = path.join(RESULTS_DIR, 'batch');
  await mkdir(batchDir, { recursive: true });
  const jsonPath = path.join(batchDir, `${batchResult.runId}.json`);
  const htmlPath = path.join(batchDir, `${batchResult.runId}.html`);
  await writeFile(jsonPath, JSON.stringify(batchResult, null, 2), 'utf-8');
  const { generateBatchHtmlReport } = await import('./report-generator');
  const html = generateBatchHtmlReport(batchResult);
  await writeFile(htmlPath, html, 'utf-8');
  return { jsonPath, htmlPath };
}

export async function loadHistory(puzzleId: string): Promise<ComparisonResult[]> {
  const puzzleDir = path.join(RESULTS_DIR, puzzleId);
  try {
    const files = await readdir(puzzleDir);
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort();
    const results: ComparisonResult[] = [];
    for (const file of jsonFiles) {
      const raw = await readFile(path.join(puzzleDir, file), 'utf-8');
      results.push(JSON.parse(raw));
    }
    return results.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  } catch {
    return [];
  }
}

export async function loadLatestResult(puzzleId: string): Promise<ComparisonResult | null> {
  const history = await loadHistory(puzzleId);
  return history.length > 0 ? history[history.length - 1] : null;
}

export async function getAccuracyTrend(puzzleId: string): Promise<{ timestamp: string; accuracy: number }[]> {
  const history = await loadHistory(puzzleId);
  return history.filter(r => !r.aborted).map(r => ({
    timestamp: r.timestamp,
    accuracy: r.metrics.accuracy,
  }));
}
