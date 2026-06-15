import type { OpenCVAdapter } from './OpenCVAdapter';
import type { GridResult } from '@/types/image';
import { GridDetector } from '@/lib/image-processing/GridDetector';
import { loadOpenCV } from '@/lib/opencv/loadOpenCV';

export class RealOpenCVAdapter implements OpenCVAdapter {
  async ensureLoaded(): Promise<void> {
    await loadOpenCV();
  }

  detectGrid(imageData: ImageData): GridResult {
    return GridDetector.detect(imageData);
  }

  extractColumnSlice(imageData: ImageData, col: number, grid: GridResult): ImageData {
    return GridDetector.extractColumnSlice(imageData, col, grid);
  }
}
