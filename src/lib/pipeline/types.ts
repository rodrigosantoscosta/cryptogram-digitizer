import type { GridResult, TableStructure } from '@/types/image';
import type { ClueResult } from '@/types/ocr';
import type { ExtractedSymbol, UniqueSymbol } from '@/types/symbol';
import type { CellNumberMap } from '@/types/ocr';

export type PipelineStageName =
  | 'preprocessing'
  | 'gridDetection'
  | 'cellExtraction'
  | 'classification'
  | 'clueOCR';

export interface PipelineProgress {
  stage: PipelineStageName;
  progress: number;
  message: string;
}

export interface PipelineContext {
  imageData: ImageData;
  preprocessed?: ImageData;
  grid?: GridResult;
  tableStructure?: TableStructure;
  usedFallback?: boolean;
  cellNumbers?: CellNumberMap | null;
  extractedSymbols?: ExtractedSymbol[];
  uniqueSymbols?: UniqueSymbol[];
  clues?: ClueResult[];
}

export interface PipelineResult {
  preprocessedImage: ImageData;
  tableStructure: TableStructure;
  grid: GridResult;
  clues: ClueResult[];
  cellNumbers: CellNumberMap | null;
  extractedSymbols: ExtractedSymbol[];
  uniqueSymbols: UniqueSymbol[];
  processedAt: Date;
}

export interface PipelineStage {
  readonly name: PipelineStageName;
  execute(ctx: PipelineContext): Promise<PipelineContext>;
}

export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export type ProgressCallback = (progress: PipelineProgress) => void;

export interface PipelineConfig {
  earlyAbortThreshold?: number;
  minCellsProcessed?: number;
  numberCoverageThreshold?: number;
}

export const DEFAULT_PIPELINE_CONFIG: Required<PipelineConfig> = {
  earlyAbortThreshold: 0.25,
  minCellsProcessed: 10,
  numberCoverageThreshold: 0.70,
};
