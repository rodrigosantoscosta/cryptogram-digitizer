import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { GroundTruthPuzzle } from '../../types/ocr';

const FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures/ground-truth');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateGroundTruth(data: unknown): GroundTruthPuzzle {
  if (!isRecord(data)) {
    throw new Error('Ground truth data must be a JSON object');
  }

  if (typeof data.puzzleId !== 'string' || data.puzzleId.length === 0) {
    throw new Error('puzzleId is required and must be a non-empty string');
  }
  if (typeof data.sourceImage !== 'string' || data.sourceImage.length === 0) {
    throw new Error('sourceImage is required and must be a non-empty string');
  }
  if (data.type !== 'numeric' && data.type !== 'pictogram') {
    throw new Error('type must be "numeric" or "pictogram"');
  }

  if (!isRecord(data.dimensions)) {
    throw new Error('dimensions must be an object with rows and cols');
  }
  if (typeof data.dimensions.rows !== 'number' || data.dimensions.rows < 1) {
    throw new Error('dimensions.rows must be a positive integer');
  }
  if (typeof data.dimensions.cols !== 'number' || data.dimensions.cols < 1) {
    throw new Error('dimensions.cols must be a positive integer');
  }

  if (!isRecord(data.valueRange)) {
    throw new Error('valueRange must be an object with min and max');
  }
  if (typeof data.valueRange.min !== 'number' || typeof data.valueRange.max !== 'number') {
    throw new Error('valueRange.min and valueRange.max must be numbers');
  }

  if (!Array.isArray(data.grid)) {
    throw new Error('grid must be a 2D array');
  }
  if (data.grid.length !== data.dimensions.rows) {
    throw new Error(`grid row count ${data.grid.length} does not match dimensions.rows ${data.dimensions.rows}`);
  }
  for (let r = 0; r < data.grid.length; r++) {
    const row = data.grid[r];
    if (!Array.isArray(row)) {
      throw new Error(`grid row ${r} is not an array`);
    }
    if (row.length !== data.dimensions.cols) {
      throw new Error(`grid row ${r} length ${row.length} does not match dimensions.cols ${data.dimensions.cols}`);
    }
    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      if (val !== null && (typeof val !== 'number' || val < data.valueRange.min || val > data.valueRange.max)) {
        throw new Error(`grid[${r}][${c}] value ${val} is outside valueRange [${data.valueRange.min}, ${data.valueRange.max}]`);
      }
    }
  }

  if (!isRecord(data.metadata)) {
    throw new Error('metadata must be an object with validatedBy and validatedAt');
  }
  if (typeof data.metadata.validatedBy !== 'string' || data.metadata.validatedBy.length === 0) {
    throw new Error('metadata.validatedBy is required');
  }
  if (typeof data.metadata.validatedAt !== 'string' || data.metadata.validatedAt.length === 0) {
    throw new Error('metadata.validatedAt is required');
  }

  return data as GroundTruthPuzzle;
}

export async function loadGroundTruth(puzzleId: string): Promise<GroundTruthPuzzle> {
  const filePath = path.join(FIXTURES_DIR, `${puzzleId}.json`);
  const raw = await readFile(filePath, 'utf-8');
  const data = JSON.parse(raw);
  return validateGroundTruth(data);
}

export async function loadAllGroundTruth(): Promise<GroundTruthPuzzle[]> {
  const files = await readdir(FIXTURES_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json'));
  const puzzles: GroundTruthPuzzle[] = [];
  for (const file of jsonFiles) {
    const filePath = path.join(FIXTURES_DIR, file);
    const raw = await readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);
    puzzles.push(validateGroundTruth(data));
  }
  return puzzles;
}

export async function listPuzzleIds(): Promise<string[]> {
  const files = await readdir(FIXTURES_DIR);
  return files.filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
}
