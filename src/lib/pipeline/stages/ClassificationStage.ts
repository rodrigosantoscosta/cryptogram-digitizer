import type { PipelineStage, PipelineContext, PipelineConfig } from '../types';
import { SymbolClassifier } from '@/lib/image-processing/SymbolClassifier';
import type { UniqueSymbol } from '@/types/symbol';

export class ClassificationStage implements PipelineStage {
  readonly name = 'classification' as const;

  constructor(
    private readonly config: Required<Pick<PipelineConfig, 'numberCoverageThreshold'>>
  ) {}

  async execute(ctx: PipelineContext): Promise<PipelineContext> {
    if (!ctx.extractedSymbols) {
      throw new Error('ClassificationStage requires extractedSymbols in context');
    }

    const isAborted = ctx.cellNumbers?.aborted === true;
    const numberCoverage = ctx.cellNumbers
      ? ctx.cellNumbers.recognized / Math.max(ctx.cellNumbers.total, 1)
      : 0;
    const useNumbers = !isAborted && numberCoverage >= this.config.numberCoverageThreshold;

    const uniqueSymbols: UniqueSymbol[] = useNumbers
      ? SymbolClassifier.buildFromNumbers(ctx.cellNumbers!, ctx.extractedSymbols)
      : SymbolClassifier.identifyUniqueSymbols(ctx.extractedSymbols);

    return { ...ctx, uniqueSymbols };
  }
}
