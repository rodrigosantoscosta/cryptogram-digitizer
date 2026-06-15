import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClassificationStage } from '@/lib/pipeline/stages/ClassificationStage';
import { SymbolClassifier } from '@/lib/image-processing/SymbolClassifier';
import type { PipelineContext } from '@/lib/pipeline/types';
import type { CellNumberMap } from '@/types/ocr';
import type { ExtractedSymbol } from '@/types/symbol';

vi.mock('@/lib/image-processing/SymbolClassifier', () => ({
  SymbolClassifier: {
    identifyUniqueSymbols: vi.fn(() => []),
    buildFromNumbers: vi.fn(() => []),
  },
}));

function makeExtractedSymbols(count = 3): ExtractedSymbol[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `sym_${i}`,
    imageData: new ImageData(1, 1),
    features: {
      area: 10,
      perimeter: 12,
      aspectRatio: 1,
      moments: [0, 0, 0, 0, 0, 0, 0],
      histogram: [0],
      centerOfMass: { x: 0, y: 0 },
    },
    positions: [{ row: 0, col: i + 1 }],
    hash: `hash_${i}`,
  }));
}

const DEFAULT_THRESHOLD = 0.7;
const BASE_CELL_NUMBERS: CellNumberMap = {
  cells: [],
  bySymbol: {},
  recognized: 0,
  total: 10,
};

describe('ClassificationStage', () => {
  let stage: ClassificationStage;

  beforeEach(() => {
    vi.clearAllMocks();
    stage = new ClassificationStage({
      numberCoverageThreshold: DEFAULT_THRESHOLD,
    });
  });

  it('should have the correct stage name', () => {
    expect(stage.name).toBe('classification');
  });

  describe('validation', () => {
    it('should throw if extractedSymbols is missing from context', async () => {
      const ctx: PipelineContext = {
        imageData: new ImageData(1, 1),
      };

      await expect(stage.execute(ctx)).rejects.toThrow(
        'ClassificationStage requires extractedSymbols in context',
      );
    });

    it('should throw if extractedSymbols is undefined even with other fields', async () => {
      const ctx: PipelineContext = {
        imageData: new ImageData(1, 1),
        grid: {} as any,
        tableStructure: {} as any,
      };

      await expect(stage.execute(ctx)).rejects.toThrow(
        'ClassificationStage requires extractedSymbols in context',
      );
    });
  });

  describe('aborted OCR path', () => {
    it('should use identifyUniqueSymbols when cellNumbers.aborted is true', async () => {
      const symbols = makeExtractedSymbols(3);
      const ctx: PipelineContext = {
        imageData: new ImageData(1, 1),
        extractedSymbols: symbols,
        cellNumbers: { ...BASE_CELL_NUMBERS, recognized: 9, aborted: true },
      };

      await stage.execute(ctx);

      expect(SymbolClassifier.identifyUniqueSymbols).toHaveBeenCalledWith(symbols);
      expect(SymbolClassifier.buildFromNumbers).not.toHaveBeenCalled();
    });

    it('should use visual classification even with high coverage when aborted', async () => {
      const symbols = makeExtractedSymbols(3);
      const ctx: PipelineContext = {
        imageData: new ImageData(1, 1),
        extractedSymbols: symbols,
        cellNumbers: {
          ...BASE_CELL_NUMBERS,
          recognized: 10,
          total: 10,
          aborted: true,
        },
      };

      await stage.execute(ctx);

      expect(SymbolClassifier.identifyUniqueSymbols).toHaveBeenCalledWith(symbols);
      expect(SymbolClassifier.buildFromNumbers).not.toHaveBeenCalled();
    });
  });

  describe('number coverage >= threshold path', () => {
    it('should use buildFromNumbers when coverage meets threshold', async () => {
      const symbols = makeExtractedSymbols(3);
      const cellNumbers: CellNumberMap = {
        ...BASE_CELL_NUMBERS,
        recognized: 8,
        total: 10, // coverage = 0.8 >= 0.7
        bySymbol: { '1': [{ row: 0, col: 1 }] },
      };
      const ctx: PipelineContext = {
        imageData: new ImageData(1, 1),
        extractedSymbols: symbols,
        cellNumbers,
      };

      await stage.execute(ctx);

      expect(SymbolClassifier.buildFromNumbers).toHaveBeenCalledWith(
        cellNumbers,
        symbols,
      );
      expect(SymbolClassifier.identifyUniqueSymbols).not.toHaveBeenCalled();
    });

    it('should use buildFromNumbers with exact threshold match', async () => {
      const symbols = makeExtractedSymbols(3);
      const cellNumbers: CellNumberMap = {
        ...BASE_CELL_NUMBERS,
        recognized: 7,
        total: 10, // coverage = 0.7, exactly at threshold
      };
      const ctx: PipelineContext = {
        imageData: new ImageData(1, 1),
        extractedSymbols: symbols,
        cellNumbers,
      };

      await stage.execute(ctx);

      expect(SymbolClassifier.buildFromNumbers).toHaveBeenCalled();
    });
  });

  describe('low coverage path', () => {
    it('should use identifyUniqueSymbols when coverage is below threshold', async () => {
      const symbols = makeExtractedSymbols(3);
      const ctx: PipelineContext = {
        imageData: new ImageData(1, 1),
        extractedSymbols: symbols,
        cellNumbers: {
          ...BASE_CELL_NUMBERS,
          recognized: 5,
          total: 10, // coverage = 0.5 < 0.7
        },
      };

      await stage.execute(ctx);

      expect(SymbolClassifier.identifyUniqueSymbols).toHaveBeenCalledWith(symbols);
      expect(SymbolClassifier.buildFromNumbers).not.toHaveBeenCalled();
    });

    it('should use identifyUniqueSymbols when zero coverage', async () => {
      const symbols = makeExtractedSymbols(3);
      const ctx: PipelineContext = {
        imageData: new ImageData(1, 1),
        extractedSymbols: symbols,
        cellNumbers: {
          ...BASE_CELL_NUMBERS,
          recognized: 0,
          total: 10, // coverage = 0.0 < 0.7
        },
      };

      await stage.execute(ctx);

      expect(SymbolClassifier.identifyUniqueSymbols).toHaveBeenCalledWith(symbols);
    });

    it('should fall back to visual when cellNumbers is null', async () => {
      const symbols = makeExtractedSymbols(3);
      const ctx: PipelineContext = {
        imageData: new ImageData(1, 1),
        extractedSymbols: symbols,
        cellNumbers: null,
      };

      await stage.execute(ctx);

      expect(SymbolClassifier.identifyUniqueSymbols).toHaveBeenCalledWith(symbols);
      expect(SymbolClassifier.buildFromNumbers).not.toHaveBeenCalled();
    });

    it('should fall back to visual when cellNumbers is undefined', async () => {
      const symbols = makeExtractedSymbols(3);
      const ctx: PipelineContext = {
        imageData: new ImageData(1, 1),
        extractedSymbols: symbols,
        // cellNumbers intentionally undefined
      };

      await stage.execute(ctx);

      expect(SymbolClassifier.identifyUniqueSymbols).toHaveBeenCalledWith(symbols);
      expect(SymbolClassifier.buildFromNumbers).not.toHaveBeenCalled();
    });
  });

  describe('result structure', () => {
    it('should return context with uniqueSymbols', async () => {
      const symbols = makeExtractedSymbols(3);
      const mockUnique = [
        { symbolId: '1', representative: symbols[0], occurrences: [{ row: 0, col: 1 }], mappedLetter: null },
      ];
      vi.mocked(SymbolClassifier.identifyUniqueSymbols).mockReturnValue(mockUnique);

      const ctx: PipelineContext = {
        imageData: new ImageData(1, 1),
        extractedSymbols: symbols,
      };

      const result = await stage.execute(ctx);

      expect(result.uniqueSymbols).toEqual(mockUnique);
    });

    it('should preserve existing context fields', async () => {
      const ctx: PipelineContext = {
        imageData: new ImageData(1, 1),
        extractedSymbols: makeExtractedSymbols(2),
        preprocessed: new ImageData(1, 1),
        usedFallback: false,
        grid: {} as any,
      };

      const result = await stage.execute(ctx);

      expect(result.preprocessed).toBeDefined();
      expect(result.usedFallback).toBe(false);
      expect(result.grid).toBeDefined();
      expect(result.uniqueSymbols).toBeDefined();
    });
  });
});
