import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClueOCRStage } from '@/lib/pipeline/stages/ClueOCRStage';
import { MockOpenCVAdapter } from '@/lib/pipeline/adapters/MockOpenCVAdapter';
import { StubOCRAdapter } from '@/lib/pipeline/adapters/StubOCRAdapter';
import type { PipelineContext } from '@/lib/pipeline/types';
import type { GridResult } from '@/types/image';
import type { ClueResult } from '@/types/ocr';

function makeImageData(width = 300, height = 300): ImageData {
  return new ImageData(
    new Uint8ClampedArray(width * height * 4).fill(128),
    width,
    height,
  );
}

const SAMPLE_GRID: GridResult = {
  rows: 4,
  cols: 4,
  roi: { x: 10, y: 10, width: 400, height: 400 },
  rowPositions: [10, 110, 210, 310, 410],
  colPositions: [10, 110, 210, 310, 410],
  rowHeights: [100, 100, 100, 100],
  colWidths: [100, 100, 100, 100],
};

const SAMPLE_CLUES: ClueResult[] = [
  { row: 0, text: 'First clue', confidence: 0.95, rawText: 'First clue' },
  { row: 1, text: 'Second clue', confidence: 0.90, rawText: 'Second clue' },
  { row: 2, text: 'Third clue', confidence: 0.92, rawText: 'Third clue' },
  { row: 3, text: 'Fourth clue', confidence: 0.88, rawText: 'Fourth clue' },
];

describe('ClueOCRStage', () => {
  let cvAdapter: MockOpenCVAdapter;
  let inputImage: ImageData;

  beforeEach(() => {
    cvAdapter = new MockOpenCVAdapter({ rows: 4, cols: 4 });
    inputImage = makeImageData();
  });

  it('should have the correct stage name', () => {
    const stage = new ClueOCRStage(cvAdapter, new StubOCRAdapter());
    expect(stage.name).toBe('clueOCR');
  });

  describe('validation', () => {
    it('should throw if grid is missing from context', async () => {
      const stage = new ClueOCRStage(cvAdapter, new StubOCRAdapter());
      const ctx: PipelineContext = {
        imageData: inputImage,
      };

      await expect(stage.execute(ctx)).rejects.toThrow(
        'ClueOCRStage requires grid in context',
      );
    });
  });

  describe('happy path', () => {
    it('should call cvAdapter.extractColumnSlice with correct arguments', async () => {
      const spy = vi.spyOn(cvAdapter, 'extractColumnSlice');
      const ocrAdapter = new StubOCRAdapter();
      const stage = new ClueOCRStage(cvAdapter, ocrAdapter);
      const ctx: PipelineContext = {
        imageData: inputImage,
        grid: SAMPLE_GRID,
      };

      await stage.execute(ctx);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(inputImage, 0, SAMPLE_GRID);
    });

    it('should call ocrAdapter.recognizeClues with column slice and row positions', async () => {
      const spy = vi.spyOn(StubOCRAdapter.prototype, 'recognizeClues');
      const ocrAdapter = new StubOCRAdapter({ clues: SAMPLE_CLUES });
      const stage = new ClueOCRStage(cvAdapter, ocrAdapter);
      const ctx: PipelineContext = {
        imageData: inputImage,
        grid: SAMPLE_GRID,
      };

      await stage.execute(ctx);

      expect(spy).toHaveBeenCalledTimes(1);
      // column slice is the ImageData returned by MockOpenCVAdapter (1x1)
      expect(spy).toHaveBeenCalledWith(
        expect.any(ImageData),
        SAMPLE_GRID.rowPositions,
        2,
      );
    });

    it('should return clues from OCR adapter', async () => {
      const ocrAdapter = new StubOCRAdapter({ clues: SAMPLE_CLUES });
      const stage = new ClueOCRStage(cvAdapter, ocrAdapter);
      const ctx: PipelineContext = {
        imageData: inputImage,
        grid: SAMPLE_GRID,
      };

      const result = await stage.execute(ctx);

      expect(result.clues).toEqual(SAMPLE_CLUES);
    });

    it('should preserve existing context fields', async () => {
      const ocrAdapter = new StubOCRAdapter({ clues: SAMPLE_CLUES });
      const stage = new ClueOCRStage(cvAdapter, ocrAdapter);
      const ctx: PipelineContext = {
        imageData: inputImage,
        grid: SAMPLE_GRID,
        preprocessed: inputImage,
        usedFallback: false,
      };

      const result = await stage.execute(ctx);

      expect(result.preprocessed).toBe(inputImage);
      expect(result.usedFallback).toBe(false);
      expect(result.imageData).toBe(inputImage);
    });
  });

  describe('OCR failure path', () => {
    it('should return fallback clues (empty text, zero confidence) when OCR throws', async () => {
      const failingOcr = new StubOCRAdapter({ shouldFail: true });
      const stage = new ClueOCRStage(cvAdapter, failingOcr);
      const ctx: PipelineContext = {
        imageData: inputImage,
        grid: SAMPLE_GRID,
      };

      const result = await stage.execute(ctx);

      result.clues.forEach((clue, i) => {
        expect(clue.row).toBe(i);
        expect(clue.text).toBe('');
        expect(clue.confidence).toBe(0);
        expect(clue.rawText).toBe('');
      });
    });

    it('should produce fallback clues array length matching grid.rows', async () => {
      const failingOcr = new StubOCRAdapter({ shouldFail: true });
      const stage = new ClueOCRStage(cvAdapter, failingOcr);
      const ctx: PipelineContext = {
        imageData: inputImage,
        grid: SAMPLE_GRID,
      };

      const result = await stage.execute(ctx);

      expect(result.clues).toHaveLength(SAMPLE_GRID.rows);
    });

    it('should still proceed when cvAdapter.extractColumnSlice throws', async () => {
      vi.spyOn(cvAdapter, 'extractColumnSlice').mockImplementation(() => {
        throw new Error('slice extraction failed');
      });
      const ocrAdapter = new StubOCRAdapter();
      const stage = new ClueOCRStage(cvAdapter, ocrAdapter);
      const ctx: PipelineContext = {
        imageData: inputImage,
        grid: SAMPLE_GRID,
      };

      const result = await stage.execute(ctx);

      // Should not throw — fallback clues are used
      expect(result.clues).toHaveLength(4);
      result.clues.forEach(clue => {
        expect(clue.text).toBe('');
        expect(clue.confidence).toBe(0);
      });
    });

    it('should handle single-row grid in fallback clues', async () => {
      const singleRowGrid: GridResult = {
        rows: 1,
        cols: 3,
        roi: { x: 0, y: 0, width: 300, height: 50 },
        rowPositions: [0, 50],
        colPositions: [0, 100, 200, 300],
        rowHeights: [50],
        colWidths: [100, 100, 100],
      };
      const ocrAdapter = new StubOCRAdapter({ shouldFail: true });
      const stage = new ClueOCRStage(cvAdapter, ocrAdapter);
      const ctx: PipelineContext = {
        imageData: inputImage,
        grid: singleRowGrid,
      };

      const result = await stage.execute(ctx);

      expect(result.clues).toHaveLength(1);
      expect(result.clues[0].row).toBe(0);
      expect(result.clues[0].text).toBe('');
    });
  });
});
