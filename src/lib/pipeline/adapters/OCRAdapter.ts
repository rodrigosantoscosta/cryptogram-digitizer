import type { CellNumberMap } from '@/types/ocr';
import type { GridResult } from '@/types/image';
import type { ClueResult } from '@/types/ocr';

export interface OCRAdapter {
  readCellNumbers(
    imageData: ImageData,
    grid: GridResult,
    onProgress?: (progress: number) => void,
    config?: { earlyAbortThreshold?: number; minCellsProcessed?: number }
  ): Promise<CellNumberMap | null>;

  recognizeClues(
    columnSlice: ImageData,
    rowPositions: number[],
    maxWords: number
  ): Promise<ClueResult[]>;
}
