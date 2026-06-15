import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GridDetectionStage,
  gridResultToTableStructure,
  tableStructureToGridResult,
} from '@/lib/pipeline/stages/GridDetectionStage';
import { TableDetector } from '@/lib/image-processing/TableDetector';
import { MockOpenCVAdapter } from '@/lib/pipeline/adapters/MockOpenCVAdapter';
import type { PipelineContext } from '@/lib/pipeline/types';
import type { GridResult, TableStructure, Point } from '@/types/image';

vi.mock('@/lib/image-processing/TableDetector', () => ({
  TableDetector: {
    detectTableStructure: vi.fn(),
  },
}));

function makeImageData(width = 300, height = 300): ImageData {
  return new ImageData(
    new Uint8ClampedArray(width * height * 4).fill(128),
    width,
    height,
  );
}

// ─── GridResult → TableStructure fixture ─────────────────────────────────────

const SAMPLE_GRID: GridResult = {
  rows: 4,
  cols: 4,
  roi: { x: 10, y: 10, width: 400, height: 400 },
  rowPositions: [10, 110, 210, 310, 410],
  colPositions: [10, 110, 210, 310, 410],
  rowHeights: [100, 100, 100, 100],
  colWidths: [100, 100, 100, 100],
};

// Grid with uneven widths/heights to exercise median logic
const SAMPLE_GRID_UNEVEN: GridResult = {
  rows: 3,
  cols: 3,
  roi: { x: 0, y: 0, width: 350, height: 190 },
  rowPositions: [0, 40, 100, 190],
  colPositions: [0, 120, 220, 350],
  rowHeights: [40, 60, 90],
  colWidths: [120, 100, 130],
};

// ─── TableStructure → GridResult fixture ─────────────────────────────────────

function buildGridPoints(
  rowPositions: number[],
  colPositions: number[],
): Point[][] {
  return rowPositions.map(y => colPositions.map(x => ({ x, y })));
}

const SAMPLE_TS: TableStructure = {
  rows: 4,
  cols: 4,
  cellWidth: 100,
  cellHeight: 100,
  gridPoints: buildGridPoints(
    [10, 110, 210, 310, 410],
    [10, 110, 210, 310, 410],
  ),
  clueColumnWidth: 150,
  answerColumnWidth: 100,
};

// ─── gridResultToTableStructure ──────────────────────────────────────────────

describe('gridResultToTableStructure', () => {
  it('should convert a GridResult to a TableStructure with correct dimensions', () => {
    const ts = gridResultToTableStructure(SAMPLE_GRID);

    expect(ts.rows).toBe(4);
    expect(ts.cols).toBe(4);
    expect(ts.cellWidth).toBe(100);
    expect(ts.cellHeight).toBe(100);
    expect(ts.clueColumnWidth).toBe(100);
    expect(ts.answerColumnWidth).toBe(100);
  });

  it('should compute median width and height from uneven data', () => {
    // widths: [120, 100, 130] → sorted [100, 120, 130] → median = 120
    // heights: [40, 60, 90] → sorted [40, 60, 90] → median = 60
    const ts = gridResultToTableStructure(SAMPLE_GRID_UNEVEN);

    expect(ts.cellWidth).toBe(120);
    expect(ts.cellHeight).toBe(60);
    expect(ts.clueColumnWidth).toBe(120);
    // answerColumnWidth: slice(1) = [100, 130] → sorted [100, 130]
    // index = Math.floor((3-1)/2) = 1 → sorted[1] = 130
    expect(ts.answerColumnWidth).toBe(130);
  });

  it('should build gridPoints with correct structure', () => {
    const ts = gridResultToTableStructure(SAMPLE_GRID);

    expect(ts.gridPoints).toHaveLength(5); // rows + 1
    ts.gridPoints.forEach((row, ri) => {
      expect(row).toHaveLength(5); // cols + 1
      row.forEach((pt, ci) => {
        expect(pt.x).toBe(SAMPLE_GRID.colPositions[ci]);
        expect(pt.y).toBe(SAMPLE_GRID.rowPositions[ri]);
      });
    });
  });

  it('should handle single-row grid', () => {
    const singleRow: GridResult = {
      rows: 1,
      cols: 3,
      roi: { x: 0, y: 0, width: 300, height: 50 },
      rowPositions: [0, 50],
      colPositions: [0, 100, 200, 300],
      rowHeights: [50],
      colWidths: [100, 100, 100],
    };

    const ts = gridResultToTableStructure(singleRow);

    expect(ts.rows).toBe(1);
    expect(ts.cols).toBe(3);
    expect(ts.cellWidth).toBe(100);
    expect(ts.cellHeight).toBe(50);
  });

  it('should handle single-column grid (colWidths.length === 1)', () => {
    const singleCol: GridResult = {
      rows: 4,
      cols: 1,
      roi: { x: 5, y: 5, width: 80, height: 400 },
      rowPositions: [5, 105, 205, 305, 405],
      colPositions: [5, 85],
      rowHeights: [100, 100, 100, 100],
      colWidths: [80],
    };

    const ts = gridResultToTableStructure(singleCol);

    expect(ts.rows).toBe(4);
    expect(ts.cols).toBe(1);
    expect(ts.cellWidth).toBe(80);
    expect(ts.cellHeight).toBe(100);
    // clueColumnWidth falls back to colWidths[0] (still 80)
    expect(ts.clueColumnWidth).toBe(80);
    // answerColumnWidth: colWidths.length === 1, so uses medianWidth (80)
    expect(ts.answerColumnWidth).toBe(80);
    // gridPoints: (rows+1) × (cols+1) = 5 × 2
    expect(ts.gridPoints).toHaveLength(5);
    ts.gridPoints.forEach((row) => {
      expect(row).toHaveLength(2);
    });
  });
});

// ─── tableStructureToGridResult ──────────────────────────────────────────────

describe('tableStructureToGridResult', () => {
  it('should convert a TableStructure to a GridResult with correct dimensions', () => {
    const grid = tableStructureToGridResult(SAMPLE_TS);

    expect(grid.rows).toBe(4);
    expect(grid.cols).toBe(4);
    expect(grid.rowPositions).toEqual([10, 110, 210, 310, 410]);
    expect(grid.colPositions).toEqual([10, 110, 210, 310, 410]);
  });

  it('should compute colWidths and rowHeights from positions', () => {
    const grid = tableStructureToGridResult(SAMPLE_TS);

    expect(grid.colWidths).toHaveLength(4);
    expect(grid.colWidths).toEqual([100, 100, 100, 100]);
    expect(grid.rowHeights).toHaveLength(4);
    expect(grid.rowHeights).toEqual([100, 100, 100, 100]);
  });

  it('should compute roi from corner positions', () => {
    const ts: TableStructure = {
      rows: 3,
      cols: 2,
      cellWidth: 50,
      cellHeight: 80,
      gridPoints: buildGridPoints([5, 85, 165, 245], [5, 55, 105]),
      clueColumnWidth: 50,
      answerColumnWidth: 50,
    };

    const grid = tableStructureToGridResult(ts);

    expect(grid.roi).toEqual({
      x: 5,
      y: 5,
      width: 100, // 105 - 5
      height: 240, // 245 - 5
    });
  });

  it('should round-trip through gridResultToTableStructure', () => {
    const ts = gridResultToTableStructure(SAMPLE_GRID);
    const gridBack = tableStructureToGridResult(ts);

    expect(gridBack.rows).toBe(SAMPLE_GRID.rows);
    expect(gridBack.cols).toBe(SAMPLE_GRID.cols);
    expect(gridBack.rowPositions).toEqual(SAMPLE_GRID.rowPositions);
    expect(gridBack.colPositions).toEqual(SAMPLE_GRID.colPositions);
  });
});

// ─── GridDetectionStage ──────────────────────────────────────────────────────

describe('GridDetectionStage', () => {
  let cvAdapter: MockOpenCVAdapter;
  let inputImage: ImageData;
  let ctx: PipelineContext;

  beforeEach(() => {
    vi.clearAllMocks();
    cvAdapter = new MockOpenCVAdapter({ rows: 4, cols: 4 });
    inputImage = makeImageData();
    ctx = { imageData: inputImage };
  });

  it('should have the correct stage name', () => {
    const stage = new GridDetectionStage(cvAdapter);
    expect(stage.name).toBe('gridDetection');
  });

  describe('primary path — cvAdapter.detectGrid succeeds', () => {
    it('should call cvAdapter.detectGrid with imageData', async () => {
      const spy = vi.spyOn(cvAdapter, 'detectGrid');
      const stage = new GridDetectionStage(cvAdapter);

      await stage.execute(ctx);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(inputImage);
    });

    it('should set grid and tableStructure in context', async () => {
      const stage = new GridDetectionStage(cvAdapter);

      const result = await stage.execute(ctx);

      expect(result.grid).toBeDefined();
      expect(result.grid!.rows).toBe(4);
      expect(result.grid!.cols).toBe(4);
      expect(result.tableStructure).toBeDefined();
      expect(result.tableStructure!.rows).toBe(4);
      expect(result.tableStructure!.cols).toBe(4);
    });

    it('should not set usedFallback flag', async () => {
      const stage = new GridDetectionStage(cvAdapter);

      const result = await stage.execute(ctx);

      expect(result.usedFallback).toBe(false);
    });

    it('should preserve existing context fields', async () => {
      const stage = new GridDetectionStage(cvAdapter);
      const richCtx: PipelineContext = {
        imageData: inputImage,
        preprocessed: inputImage,
        cellNumbers: null,
      };

      const result = await stage.execute(richCtx);

      expect(result.imageData).toBe(inputImage);
      expect(result.preprocessed).toBe(inputImage);
      expect(result.cellNumbers).toBeNull();
      expect(result.grid).toBeDefined();
      expect(result.tableStructure).toBeDefined();
    });
  });

  describe('fallback path — cvAdapter.detectGrid throws', () => {
    beforeEach(() => {
      vi.spyOn(cvAdapter, 'detectGrid').mockImplementation(() => {
        throw new Error('CV detection failed');
      });
    });

    it('should call TableDetector.detectTableStructure as fallback', async () => {
      const mockTs: TableStructure = {
        rows: 4,
        cols: 4,
        cellWidth: 100,
        cellHeight: 100,
        gridPoints: buildGridPoints(
          [10, 110, 210, 310, 410],
          [10, 110, 210, 310, 410],
        ),
        clueColumnWidth: 100,
        answerColumnWidth: 100,
      };
      vi.mocked(TableDetector.detectTableStructure).mockResolvedValue(mockTs);

      const stage = new GridDetectionStage(cvAdapter);
      await stage.execute(ctx);

      expect(TableDetector.detectTableStructure).toHaveBeenCalledTimes(1);
      expect(TableDetector.detectTableStructure).toHaveBeenCalledWith(inputImage);
    });

    it('should set usedFallback to true when primary fails', async () => {
      const mockTs: TableStructure = {
        rows: 4,
        cols: 4,
        cellWidth: 100,
        cellHeight: 100,
        gridPoints: buildGridPoints(
          [10, 110, 210, 310, 410],
          [10, 110, 210, 310, 410],
        ),
        clueColumnWidth: 100,
        answerColumnWidth: 100,
      };
      vi.mocked(TableDetector.detectTableStructure).mockResolvedValue(mockTs);

      const stage = new GridDetectionStage(cvAdapter);
      const result = await stage.execute(ctx);

      expect(result.usedFallback).toBe(true);
    });

    it('should still populate grid and tableStructure via fallback', async () => {
      const mockTs: TableStructure = {
        rows: 3,
        cols: 3,
        cellWidth: 80,
        cellHeight: 60,
        gridPoints: buildGridPoints([0, 60, 120, 180], [0, 80, 160, 240]),
        clueColumnWidth: 80,
        answerColumnWidth: 80,
      };
      vi.mocked(TableDetector.detectTableStructure).mockResolvedValue(mockTs);

      const stage = new GridDetectionStage(cvAdapter);
      const result = await stage.execute(ctx);

      expect(result.grid).toBeDefined();
      expect(result.grid!.rows).toBe(3);
      expect(result.grid!.cols).toBe(3);
      expect(result.tableStructure).toBeDefined();
      expect(result.tableStructure!.rows).toBe(3);
      expect(result.tableStructure!.cols).toBe(3);
    });
  });
});
