// src/types/processed.ts
import type { TableStructure } from './puzzle';
import type { ClueResult } from './ocr';
import type { ExtractedSymbol, UniqueSymbol } from './symbol';

export interface ProcessedData {
  preprocessedImage: ImageData;
  tableStructure: TableStructure;
  clues: ClueResult[];
  extractedSymbols: ExtractedSymbol[];
  uniqueSymbols: UniqueSymbol[];
  processedAt: Date;
}

export interface ProcessingStatus {
  stage: 'idle' | 'preprocessing' | 'detecting' | 'extracting' | 'classifying' | 'ocr' | 'complete' | 'error';
  progress: number; // 0-100
  currentStep: string;
  error: Error | null;
}
