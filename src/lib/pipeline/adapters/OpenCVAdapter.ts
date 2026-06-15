import type { GridResult } from '@/types/image';

export interface OpenCVAdapter {
  ensureLoaded(): Promise<void>;
  detectGrid(imageData: ImageData): GridResult;
  extractColumnSlice(imageData: ImageData, col: number, grid: GridResult): ImageData;
}
