import type { PipelineStage, PipelineContext } from '../types';
import { ImageProcessor } from '@/lib/image-processing/ImageProcessor';

export class PreprocessStage implements PipelineStage {
  readonly name = 'preprocessing' as const;

  async execute(ctx: PipelineContext): Promise<PipelineContext> {
    const preprocessed = await ImageProcessor.preprocess(ctx.imageData);
    return { ...ctx, preprocessed };
  }
}
