import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { PipelineService } from '@/lib/pipeline/PipelineService';
import { MockOpenCVAdapter } from '@/lib/pipeline/adapters/MockOpenCVAdapter';
import { StubOCRAdapter } from '@/lib/pipeline/adapters/StubOCRAdapter';
import { SymbolClassifier } from '@/lib/image-processing/SymbolClassifier';
import type { PipelineProgress } from '@/lib/pipeline/types';

vi.mock('@/lib/image-processing/ImageProcessor', () => ({
  ImageProcessor: {
    preprocess: vi.fn(async (img: ImageData) => img),
    preprocessClueCell: vi.fn((img: ImageData) => img),
  },
}));

vi.mock('@/lib/image-processing/SymbolExtractor', () => ({
  SymbolExtractor: {
    extractAllSymbols: vi.fn(async () => []),
    extractAllSymbolsFromGrid: vi.fn(async () => []),
  },
}));

vi.mock('@/lib/image-processing/SymbolClassifier', () => ({
  SymbolClassifier: {
    identifyUniqueSymbols: vi.fn(() => []),
    buildFromNumbers: vi.fn(() => []),
  },
}));

function makeImageData(width = 300, height = 300): ImageData {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4).fill(128),
    colorSpace: 'srgb',
  } as ImageData;
}

describe('PipelineService — integration with mock adapters', () => {
  it('deve executar todas as fases e retornar PipelineResult', async () => {
    const cvAdapter = new MockOpenCVAdapter({ rows: 4, cols: 4 });
    const ocrAdapter = new StubOCRAdapter();
    const pipeline = new PipelineService(cvAdapter, ocrAdapter);

    const result = await pipeline.run(makeImageData());

    expect(result.grid).toBeDefined();
    expect(result.grid.rows).toBe(4);
    expect(result.grid.cols).toBe(4);
    expect(result.tableStructure).toBeDefined();
    expect(result.preprocessedImage).toBeDefined();
    expect(result.processedAt).toBeInstanceOf(Date);
  });

  it('deve emitir eventos de progresso para cada fase', async () => {
    const cvAdapter = new MockOpenCVAdapter();
    const ocrAdapter = new StubOCRAdapter();
    const pipeline = new PipelineService(cvAdapter, ocrAdapter);

    const progressEvents: PipelineProgress[] = [];
    await pipeline.run(makeImageData(), (p) => progressEvents.push(p));

    const stages = [...new Set(progressEvents.map(p => p.stage))];
    expect(stages).toContain('preprocessing');
    expect(stages).toContain('gridDetection');
    expect(stages).toContain('cellExtraction');
    expect(stages).toContain('classification');
    expect(stages).toContain('clueOCR');
  });

  it('deve continuar sem cellNumbers quando OCR falha', async () => {
    const cvAdapter = new MockOpenCVAdapter();
    const ocrAdapter = new StubOCRAdapter({ shouldFail: true });
    const pipeline = new PipelineService(cvAdapter, ocrAdapter);

    const result = await pipeline.run(makeImageData());
    expect(result.cellNumbers).toBeNull();
  });

  it('deve aceitar config customizada', async () => {
    const cvAdapter = new MockOpenCVAdapter();
    const ocrAdapter = new StubOCRAdapter();
    const pipeline = new PipelineService(cvAdapter, ocrAdapter, {
      earlyAbortThreshold: 0.5,
      minCellsProcessed: 5,
      numberCoverageThreshold: 0.8,
    });

    const result = await pipeline.run(makeImageData());
    expect(result).toBeDefined();
  });
});

// ─── Unit-level tests: config propagation & progress details ─────────────────

describe('PipelineService — config propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('numberCoverageThreshold', () => {
    it('should use buildFromNumbers when coverage exceeds threshold (low threshold)', async () => {
      const cvAdapter = new MockOpenCVAdapter();
      // cellNumbers: 5/10 = 50% coverage
      const ocrAdapter = new StubOCRAdapter({
        cellNumbers: {
          cells: [],
          bySymbol: { '1': [{ row: 0, col: 1 }] },
          recognized: 5,
          total: 10,
        },
      });
      // threshold 0.4 → 0.5 >= 0.4 → use numbers
      const pipeline = new PipelineService(cvAdapter, ocrAdapter, {
        numberCoverageThreshold: 0.4,
      });

      await pipeline.run(makeImageData());

      expect(SymbolClassifier.buildFromNumbers).toHaveBeenCalled();
      expect(SymbolClassifier.identifyUniqueSymbols).not.toHaveBeenCalled();
    });

    it('should use identifyUniqueSymbols when coverage is below threshold (high threshold)', async () => {
      const cvAdapter = new MockOpenCVAdapter();
      const ocrAdapter = new StubOCRAdapter({
        cellNumbers: {
          cells: [],
          bySymbol: { '1': [{ row: 0, col: 1 }] },
          recognized: 5,
          total: 10,
        },
      });
      // threshold 0.9 → 0.5 < 0.9 → use visual
      const pipeline = new PipelineService(cvAdapter, ocrAdapter, {
        numberCoverageThreshold: 0.9,
      });

      await pipeline.run(makeImageData());

      expect(SymbolClassifier.identifyUniqueSymbols).toHaveBeenCalled();
      expect(SymbolClassifier.buildFromNumbers).not.toHaveBeenCalled();
    });
  });

  describe('earlyAbortThreshold and minCellsProcessed', () => {
    it('should forward earlyAbortThreshold and minCellsProcessed to OCR adapter', async () => {
      const cvAdapter = new MockOpenCVAdapter();
      const ocrAdapter = new StubOCRAdapter();
      const readCellNumbersSpy = vi.spyOn(ocrAdapter, 'readCellNumbers');

      const pipeline = new PipelineService(cvAdapter, ocrAdapter, {
        earlyAbortThreshold: 0.5,
        minCellsProcessed: 5,
      });

      await pipeline.run(makeImageData());

      expect(readCellNumbersSpy).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        undefined,
        expect.objectContaining({
          earlyAbortThreshold: 0.5,
          minCellsProcessed: 5,
        }),
      );
    });
  });
});

describe('PipelineService — progress callback details', () => {
  it('should emit exactly 10 progress events (2 per stage)', async () => {
    const cvAdapter = new MockOpenCVAdapter();
    const ocrAdapter = new StubOCRAdapter();
    const pipeline = new PipelineService(cvAdapter, ocrAdapter);

    const progressEvents: PipelineProgress[] = [];
    await pipeline.run(makeImageData(), (p) => progressEvents.push(p));

    expect(progressEvents).toHaveLength(10);
  });

  it('should emit start and end events in correct order', async () => {
    const cvAdapter = new MockOpenCVAdapter();
    const ocrAdapter = new StubOCRAdapter();
    const pipeline = new PipelineService(cvAdapter, ocrAdapter);

    const progressEvents: PipelineProgress[] = [];
    await pipeline.run(makeImageData(), (p) => progressEvents.push(p));

    // Expected event sequence (stage, progress): preprocessing(10→25), gridDetection(25→45),
    // cellExtraction(45→70), classification(70→85), clueOCR(85→100)
    const expected = [
      { stage: 'preprocessing', progress: 10 },
      { stage: 'preprocessing', progress: 25 },
      { stage: 'gridDetection', progress: 25 },
      { stage: 'gridDetection', progress: 45 },
      { stage: 'cellExtraction', progress: 45 },
      { stage: 'cellExtraction', progress: 70 },
      { stage: 'classification', progress: 70 },
      { stage: 'classification', progress: 85 },
      { stage: 'clueOCR', progress: 85 },
      { stage: 'clueOCR', progress: 100 },
    ] as const;

    expected.forEach((exp, i) => {
      const event = progressEvents[i];
      expect(event.stage).toBe(exp.stage);
      expect(event.progress).toBe(exp.progress);
      expect(event.message).toBeDefined();
      expect(typeof event.message).toBe('string');
      expect(event.message.length).toBeGreaterThan(0);
    });
  });

  it('should have meaningful message texts for each event', async () => {
    const cvAdapter = new MockOpenCVAdapter();
    const ocrAdapter = new StubOCRAdapter();
    const pipeline = new PipelineService(cvAdapter, ocrAdapter);

    const progressEvents: PipelineProgress[] = [];
    await pipeline.run(makeImageData(), (p) => progressEvents.push(p));

    // Start messages
    expect(progressEvents[0].message).toBe('Preprocessing image...');
    expect(progressEvents[2].message).toBe('Detecting grid...');
    expect(progressEvents[4].message).toBe('Extracting cells and reading OCR...');
    expect(progressEvents[6].message).toBe('Classifying symbols...');
    expect(progressEvents[8].message).toBe('Recognizing clues...');

    // End messages
    expect(progressEvents[1].message).toBe('Image preprocessed');
    expect(progressEvents[3].message).toMatch(/^Grid detected:/);
    expect(progressEvents[5].message).toMatch(/^\d+ symbols extracted/);
    expect(progressEvents[7].message).toMatch(/^\d+ unique symbols/);
    expect(progressEvents[9].message).toMatch(/^\d+ clues recognized/);
  });
});
