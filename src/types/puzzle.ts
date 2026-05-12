// src/types/puzzle.ts
import type { ClueResult } from './ocr';
import type { ExtractedSymbol, UniqueSymbol, SymbolMapping } from './symbol';
import type { GridCell } from './grid';

export interface CellPosition {
  row: number;
  col: number;
}

export interface TableStructure {
  rows: number;
  cols: number;
  cellWidth: number;
  cellHeight: number;
}

export interface ValidationError {
  type: 'duplicate' | 'unmapped' | 'incomplete';
  message: string;
  symbolId?: string;
}

export interface ProcessedData {
  preprocessedImage: ImageData;
  tableStructure: TableStructure;
  clues: ClueResult[];
  extractedSymbols: ExtractedSymbol[];
  uniqueSymbols: UniqueSymbol[];
  processedAt: Date;
}

export interface PuzzleSolution {
  grid: GridCell[][];
  mapping: SymbolMapping;
  isComplete: boolean;
  progress: number;
}

export interface PuzzleMetadata {
  id: string;
  name: string;
  createdAt: Date;
  lastModified: Date;
  imageUrl?: string;
  progress: number;
}

export interface PuzzleState {
  id: string;
  metadata: PuzzleMetadata;
  processedData: ProcessedData;
  solution: PuzzleSolution;
  mapping: SymbolMapping;
}
