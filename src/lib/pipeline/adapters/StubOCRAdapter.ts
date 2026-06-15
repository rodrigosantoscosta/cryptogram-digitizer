import type { OCRAdapter } from './OCRAdapter';
import type { GridResult } from '@/types/image';
import type { ClueResult } from '@/types/ocr';
import type { CellNumberMap } from '@/types/ocr';

export interface StubOCRConfig {
  cellNumbers?: CellNumberMap | null;
  clues?: ClueResult[];
  shouldFail?: boolean;
}

export class StubOCRAdapter implements OCRAdapter {
  private config: StubOCRConfig;

  constructor(config?: StubOCRConfig) {
    this.config = config ?? {};
  }

  async readCellNumbers(
    _imageData: ImageData,
    _grid: GridResult,
    onProgress?: (progress: number) => void,
    _config?: { earlyAbortThreshold?: number; minCellsProcessed?: number }
  ): Promise<CellNumberMap | null> {
    if (this.config.shouldFail) {
      throw new Error('StubOCRAdapter: simulated failure');
    }
    onProgress?.(1);
    return this.config.cellNumbers ?? null;
  }

  async recognizeClues(
    _columnSlice: ImageData,
    rowPositions: number[],
    _maxWords: number
  ): Promise<ClueResult[]> {
    if (this.config.shouldFail) {
      throw new Error('StubOCRAdapter: simulated clue failure');
    }
    if (this.config.clues) return this.config.clues;
    return rowPositions.slice(0, -1).map((_, i) => ({
      row: i,
      text: `Clue ${i + 1}`,
      confidence: 0.9,
      rawText: `Clue ${i + 1}`,
    }));
  }
}
