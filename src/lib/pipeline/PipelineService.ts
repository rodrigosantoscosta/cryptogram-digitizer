import type {
  PipelineStage,
  PipelineContext,
  PipelineResult,
  PipelineConfig,
  PipelineProgress,
  ProgressCallback,
} from './types';
import { DEFAULT_PIPELINE_CONFIG } from './types';
import { PipelineError } from './errors';
import type { OpenCVAdapter } from './adapters/OpenCVAdapter';
import type { OCRAdapter } from './adapters/OCRAdapter';
import { PreprocessStage } from './stages/PreprocessStage';
import { GridDetectionStage } from './stages/GridDetectionStage';
import { CellExtractionStage } from './stages/CellExtractionStage';
import { ClassificationStage } from './stages/ClassificationStage';
import { ClueOCRStage } from './stages/ClueOCRStage';

const STAGE_PROGRESS: Record<string, { start: number; end: number }> = {
  preprocessing: { start: 10, end: 25 },
  gridDetection: { start: 25, end: 45 },
  cellExtraction: { start: 45, end: 70 },
  classification: { start: 70, end: 85 },
  clueOCR: { start: 85, end: 100 },
};

export class PipelineService {
  private readonly stages: PipelineStage[];
  private readonly config: Required<PipelineConfig>;
  private readonly cvAdapter: OpenCVAdapter;

  constructor(
    cvAdapter: OpenCVAdapter,
    ocrAdapter: OCRAdapter,
    config?: PipelineConfig
  ) {
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };
    this.cvAdapter = cvAdapter;

    this.stages = [
      new PreprocessStage(),
      new GridDetectionStage(cvAdapter),
      new CellExtractionStage(ocrAdapter, {
        earlyAbortThreshold: this.config.earlyAbortThreshold,
        minCellsProcessed: this.config.minCellsProcessed,
      }),
      new ClassificationStage({
        numberCoverageThreshold: this.config.numberCoverageThreshold,
      }),
      new ClueOCRStage(cvAdapter, ocrAdapter),
    ];
  }

  async run(imageData: ImageData, onProgress?: ProgressCallback): Promise<PipelineResult> {
    await this.cvAdapter.ensureLoaded();

    let ctx: PipelineContext = { imageData };

    for (const stage of this.stages) {
      const range = STAGE_PROGRESS[stage.name];

      onProgress?.({
        stage: stage.name,
        progress: range.start,
        message: this.stageMessage(stage.name),
      });

      try {
        ctx = await stage.execute(ctx);
      } catch (error) {
        throw new PipelineError(
          `Pipeline failed at stage "${stage.name}": ${(error as Error).message}`,
          stage.name,
          error
        );
      }

      onProgress?.({
        stage: stage.name,
        progress: range.end,
        message: this.stageCompleteMessage(stage.name, ctx),
      });
    }

    if (!ctx.preprocessed || !ctx.grid || !ctx.tableStructure || !ctx.extractedSymbols || !ctx.uniqueSymbols || !ctx.clues) {
      throw new PipelineError('Pipeline completed with missing context fields', 'unknown');
    }

    return {
      preprocessedImage: ctx.preprocessed,
      grid: ctx.grid,
      tableStructure: ctx.tableStructure,
      clues: ctx.clues,
      cellNumbers: ctx.cellNumbers ?? null,
      extractedSymbols: ctx.extractedSymbols,
      uniqueSymbols: ctx.uniqueSymbols,
      processedAt: new Date(),
    };
  }

  private stageMessage(stage: PipelineStage['name']): string {
    switch (stage) {
      case 'preprocessing': return 'Preprocessing image...';
      case 'gridDetection': return 'Detecting grid...';
      case 'cellExtraction': return 'Extracting cells and reading OCR...';
      case 'classification': return 'Classifying symbols...';
      case 'clueOCR': return 'Recognizing clues...';
    }
  }

  private stageCompleteMessage(stage: PipelineStage['name'], ctx: PipelineContext): string {
    switch (stage) {
      case 'preprocessing': return 'Image preprocessed';
      case 'gridDetection':
        return ctx.grid ? `Grid detected: ${ctx.grid.rows} x ${ctx.grid.cols}` : 'Grid detected';
      case 'cellExtraction':
        return ctx.extractedSymbols ? `${ctx.extractedSymbols.length} symbols extracted` : 'Cells extracted';
      case 'classification':
        return ctx.uniqueSymbols ? `${ctx.uniqueSymbols.length} unique symbols` : 'Symbols classified';
      case 'clueOCR':
        return ctx.clues ? `${ctx.clues.filter(c => c.text.trim().length > 0).length} clues recognized` : 'Clues processed';
    }
  }
}
