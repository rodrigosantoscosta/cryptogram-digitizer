import type { OpenCVAdapter } from './OpenCVAdapter';
import type { GridResult } from '@/types/image';

export interface MockGridConfig {
  rows?: number;
  cols?: number;
  roi?: { x: number; y: number; width: number; height: number };
}

export class MockOpenCVAdapter implements OpenCVAdapter {
  private gridConfig: MockGridConfig;
  private columnSliceData: ImageData | null;

  constructor(gridConfig?: MockGridConfig, columnSlice?: ImageData) {
    this.gridConfig = gridConfig ?? { rows: 8, cols: 12 };
    this.columnSliceData = columnSlice ?? null;
  }

  async ensureLoaded(): Promise<void> {}

  detectGrid(_imageData: ImageData): GridResult {
    const rows = this.gridConfig.rows ?? 8;
    const cols = this.gridConfig.cols ?? 12;
    const roi = this.gridConfig.roi ?? { x: 10, y: 10, width: 580, height: 380 };

    const rowStep = roi.height / rows;
    const colStep = roi.width / cols;

    const rowPositions = Array.from({ length: rows + 1 }, (_, i) => Math.round(roi.y + i * rowStep));
    const colPositions = Array.from({ length: cols + 1 }, (_, i) => Math.round(roi.x + i * colStep));
    const rowHeights = Array.from({ length: rows }, () => Math.round(rowStep));
    const colWidths = Array.from({ length: cols }, () => Math.round(colStep));

    return { rows, cols, roi, rowPositions, colPositions, rowHeights, colWidths };
  }

  extractColumnSlice(_imageData: ImageData, _col: number, _grid: GridResult): ImageData {
    if (this.columnSliceData) return this.columnSliceData;
    return new ImageData(1, 1);
  }
}
