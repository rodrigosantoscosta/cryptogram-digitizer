import type { OCRAdapter } from './OCRAdapter';
import type { GridResult } from '@/types/image';
import type { ClueResult } from '@/types/ocr';
import type { CellNumberMap } from '@/types/ocr';
import { CellNumberReader } from '@/lib/ocr/CellNumberReader';
import { OCREngine, PSM_SINGLE_COLUMN } from '@/lib/ocr/OCREngine';
import { ImageProcessor } from '@/lib/image-processing/ImageProcessor';

export class HttpOCRAdapter implements OCRAdapter {
  async readCellNumbers(
    imageData: ImageData,
    grid: GridResult,
    onProgress?: (progress: number) => void,
    config?: { earlyAbortThreshold?: number; minCellsProcessed?: number }
  ): Promise<CellNumberMap | null> {
    return CellNumberReader.read(imageData, grid, onProgress, undefined, {
      earlyAbortThreshold: config?.earlyAbortThreshold ?? 0.25,
      minCellsProcessed: config?.minCellsProcessed ?? 10,
    });
  }

  async recognizeClues(
    columnSlice: ImageData,
    rowPositions: number[],
    maxWords: number
  ): Promise<ClueResult[]> {
    const processed = ImageProcessor.preprocessClueCell(columnSlice);
    const ocrEngine = new OCREngine({ pageSegMode: PSM_SINGLE_COLUMN });

    try {
      await ocrEngine.initialize('por');
      return await ocrEngine.recognizeColumn(processed, rowPositions, maxWords);
    } finally {
      await ocrEngine.terminate();
    }
  }
}
