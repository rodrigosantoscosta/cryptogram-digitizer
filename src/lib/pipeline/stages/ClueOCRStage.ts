import type { PipelineStage, PipelineContext } from '../types';
import type { OCRAdapter } from '../adapters/OCRAdapter';
import type { OpenCVAdapter } from '../adapters/OpenCVAdapter';
import type { ClueResult } from '@/types/ocr';

export class ClueOCRStage implements PipelineStage {
  readonly name = 'clueOCR' as const;

  constructor(
    private readonly cvAdapter: OpenCVAdapter,
    private readonly ocrAdapter: OCRAdapter
  ) {}

  async execute(ctx: PipelineContext): Promise<PipelineContext> {
    if (!ctx.grid) {
      throw new Error('ClueOCRStage requires grid in context');
    }

    let clues: ClueResult[] = [];

    try {
      const columnSlice = this.cvAdapter.extractColumnSlice(ctx.imageData, 0, ctx.grid);
      clues = await this.ocrAdapter.recognizeClues(columnSlice, ctx.grid.rowPositions, 2);
    } catch {
      clues = Array.from({ length: ctx.grid.rows }, (_, i) => ({
        row: i,
        text: '',
        confidence: 0,
        rawText: '',
      }));
    }

    return { ...ctx, clues };
  }
}
