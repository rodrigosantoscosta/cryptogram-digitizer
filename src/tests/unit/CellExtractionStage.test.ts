import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CellExtractionStage } from '@/lib/pipeline/stages/CellExtractionStage';
import { SymbolExtractor } from '@/lib/image-processing/SymbolExtractor';
import { StubOCRAdapter } from '@/lib/pipeline/adapters/StubOCRAdapter';
import type { PipelineContext } from '@/lib/pipeline/types';
import type { GridResult, TableStructure } from '@/types/image';
import type { CellNumberMap } from '@/types/ocr';

vi.mock('@/lib/image-processing/SymbolExtractor', () => ({
  SymbolExtractor: {
    extractAllSymbols: vi.fn(async () => []),
    extractAllSymbolsFromGrid: vi.fn(async () => []),
  },
}));

function makeImageData(width = 8, height = 8): ImageData {
  return new ImageData(
    new Uint8ClampedArray(width * height * 4).fill(128),
    width,
    height,
  );
}

const SAMPLE_GRID: GridResult = {
  rows: 4,
  cols: 4,
  roi: { x: 0, y: 0, width: 400, height: 400 },
  rowPositions: [0, 100, 200, 300, 400],
  colPositions: [0, 100, 200, 300, 400],
  rowHeights: [100, 100, 100, 100],
  colWidths: [100, 100, 100, 100],
};

const SAMPLE_TABLE_STRUCTURE: TableStructure = {
  rows: 4,
  cols: 4,
  cellWidth: 100,
  cellHeight: 100,
  gridPoints: Array.from({ length: 5 }, (_, ri) =>
    Array.from({ length: 5 }, (_, ci) => ({ x: ci * 100, y: ri * 100 })),
  ),
  clueColumnWidth: 100,
  answerColumnWidth: 100,
};

const SAMPLE_CELL_NUMBERS: CellNumberMap = {
  cells: [
    { row: 0, col: 1, number: 1, confidence: 0.95, rawText: '1', rawOcr: '1' },
    { row: 0, col: 2, number: 2, confidence: 0.90, rawText: '2', rawOcr: '2' },
  ],
  bySymbol: { '1': [{ row: 0, col: 1 }], '2': [{ row: 0, col: 2 }] },
  recognized: 2,
  total: 12,
};

describe('CellExtractionStage', () => {
  let ocrAdapter: StubOCRAdapter;
  let config: { earlyAbortThreshold: number; minCellsProcessed: number };

  beforeEach(() => {
    vi.clearAllMocks();
    ocrAdapter = new StubOCRAdapter({ cellNumbers: SAMPLE_CELL_NUMBERS });
    config = { earlyAbortThreshold: 0.25, minCellsProcessed: 10 };
  });

  it('should have the correct stage name', () => {
    const stage = new CellExtractionStage(ocrAdapter, config);
    expect(stage.name).toBe('cellExtraction');
  });

  describe('validation', () => {
    it('should throw if grid is missing from context', async () => {
      const stage = new CellExtractionStage(ocrAdapter, config);
      const ctx: PipelineContext = {
        imageData: makeImageData(),
        tableStructure: SAMPLE_TABLE_STRUCTURE,
      };

      await expect(stage.execute(ctx)).rejects.toThrow(
        'CellExtractionStage requires grid and tableStructure in context',
      );
    });

    it('should throw if tableStructure is missing from context', async () => {
      const stage = new CellExtractionStage(ocrAdapter, config);
      const ctx: PipelineContext = {
        imageData: makeImageData(),
        grid: SAMPLE_GRID,
      };

      await expect(stage.execute(ctx)).rejects.toThrow(
        'CellExtractionStage requires grid and tableStructure in context',
      );
    });

    it('should throw if both grid and tableStructure are missing', async () => {
      const stage = new CellExtractionStage(ocrAdapter, config);
      const ctx: PipelineContext = {
        imageData: makeImageData(),
      };

      await expect(stage.execute(ctx)).rejects.toThrow(
        'CellExtractionStage requires grid and tableStructure in context',
      );
    });
  });

  describe('happy path — primary grid path', () => {
    it('should call ocrAdapter.readCellNumbers with imageData and config', async () => {
      const spy = vi.spyOn(ocrAdapter, 'readCellNumbers');
      const stage = new CellExtractionStage(ocrAdapter, config);
      const ctx: PipelineContext = {
        imageData: makeImageData(),
        grid: SAMPLE_GRID,
        tableStructure: SAMPLE_TABLE_STRUCTURE,
      };

      await stage.execute(ctx);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        ctx.imageData,
        SAMPLE_GRID,
        undefined,
        {
          earlyAbortThreshold: 0.25,
          minCellsProcessed: 10,
        },
      );
    });

    it('should call extractAllSymbolsFromGrid when usedFallback is falsy', async () => {
      const stage = new CellExtractionStage(ocrAdapter, config);
      const ctx: PipelineContext = {
        imageData: makeImageData(),
        grid: SAMPLE_GRID,
        tableStructure: SAMPLE_TABLE_STRUCTURE,
        usedFallback: false,
      };

      await stage.execute(ctx);

      expect(SymbolExtractor.extractAllSymbolsFromGrid).toHaveBeenCalledTimes(1);
      expect(SymbolExtractor.extractAllSymbolsFromGrid).toHaveBeenCalledWith(
        ctx.imageData,
        SAMPLE_GRID,
        true,
      );
      expect(SymbolExtractor.extractAllSymbols).not.toHaveBeenCalled();
    });

    it('should return context with cellNumbers and extractedSymbols', async () => {
      const stage = new CellExtractionStage(ocrAdapter, config);
      const ctx: PipelineContext = {
        imageData: makeImageData(),
        grid: SAMPLE_GRID,
        tableStructure: SAMPLE_TABLE_STRUCTURE,
      };

      const result = await stage.execute(ctx);

      expect(result.cellNumbers).toEqual(SAMPLE_CELL_NUMBERS);
      expect(result.extractedSymbols).toEqual([]);
    });

    it('should preserve existing context fields', async () => {
      const stage = new CellExtractionStage(ocrAdapter, config);
      const ctx: PipelineContext = {
        imageData: makeImageData(),
        grid: SAMPLE_GRID,
        tableStructure: SAMPLE_TABLE_STRUCTURE,
        preprocessed: makeImageData(),
        usedFallback: false,
      };

      const result = await stage.execute(ctx);

      expect(result.preprocessed).toBeDefined();
      expect(result.usedFallback).toBe(false);
    });
  });

  describe('OCR failure path', () => {
    it('should set cellNumbers to null when OCR adapter throws', async () => {
      const failingAdapter = new StubOCRAdapter({ shouldFail: true });
      const stage = new CellExtractionStage(failingAdapter, config);
      const ctx: PipelineContext = {
        imageData: makeImageData(),
        grid: SAMPLE_GRID,
        tableStructure: SAMPLE_TABLE_STRUCTURE,
      };

      const result = await stage.execute(ctx);

      expect(result.cellNumbers).toBeNull();
    });

    it('should still extract symbols even if OCR fails', async () => {
      const failingAdapter = new StubOCRAdapter({ shouldFail: true });
      const stage = new CellExtractionStage(failingAdapter, config);
      const ctx: PipelineContext = {
        imageData: makeImageData(),
        grid: SAMPLE_GRID,
        tableStructure: SAMPLE_TABLE_STRUCTURE,
      };

      const result = await stage.execute(ctx);

      expect(SymbolExtractor.extractAllSymbolsFromGrid).toHaveBeenCalled();
      expect(result.extractedSymbols).toBeDefined();
    });
  });

  describe('fallback path — usedFallback is true', () => {
    it('should call extractAllSymbols (not fromGrid) when usedFallback is true', async () => {
      const stage = new CellExtractionStage(ocrAdapter, config);
      const ctx: PipelineContext = {
        imageData: makeImageData(),
        grid: SAMPLE_GRID,
        tableStructure: SAMPLE_TABLE_STRUCTURE,
        usedFallback: true,
      };

      await stage.execute(ctx);

      expect(SymbolExtractor.extractAllSymbols).toHaveBeenCalledTimes(1);
      expect(SymbolExtractor.extractAllSymbols).toHaveBeenCalledWith(
        ctx.imageData,
        SAMPLE_TABLE_STRUCTURE,
        true,
      );
      expect(SymbolExtractor.extractAllSymbolsFromGrid).not.toHaveBeenCalled();
    });

    it('should still use OCR for cell numbers in fallback path', async () => {
      const spy = vi.spyOn(ocrAdapter, 'readCellNumbers');
      const stage = new CellExtractionStage(ocrAdapter, config);
      const ctx: PipelineContext = {
        imageData: makeImageData(),
        grid: SAMPLE_GRID,
        tableStructure: SAMPLE_TABLE_STRUCTURE,
        usedFallback: true,
      };

      await stage.execute(ctx);

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
