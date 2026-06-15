import type { PipelineStage, PipelineContext, PipelineConfig } from '../types';
import type { OCRAdapter } from '../adapters/OCRAdapter';
import { SymbolExtractor } from '@/lib/image-processing/SymbolExtractor';
import type { ExtractedSymbol } from '@/types/symbol';

export class CellExtractionStage implements PipelineStage {
  readonly name = 'cellExtraction' as const;

  constructor(
    private readonly ocrAdapter: OCRAdapter,
    private readonly config: Required<Pick<PipelineConfig, 'earlyAbortThreshold' | 'minCellsProcessed'>>
  ) {}

  async execute(ctx: PipelineContext): Promise<PipelineContext> {
    if (!ctx.grid || !ctx.tableStructure) {
      throw new Error('CellExtractionStage requires grid and tableStructure in context');
    }

    let cellNumbers = null;
    try {
      cellNumbers = await this.ocrAdapter.readCellNumbers(
        ctx.imageData,
        ctx.grid,
        undefined,
        {
          earlyAbortThreshold: this.config.earlyAbortThreshold,
          minCellsProcessed: this.config.minCellsProcessed,
        }
      );
    } catch {
      // continue without cell numbers
    }

    const extractedSymbols: ExtractedSymbol[] = ctx.usedFallback
      ? await SymbolExtractor.extractAllSymbols(ctx.imageData, ctx.tableStructure, true)
      : await SymbolExtractor.extractAllSymbolsFromGrid(ctx.imageData, ctx.grid, true);

    return { ...ctx, cellNumbers, extractedSymbols };
  }
}
