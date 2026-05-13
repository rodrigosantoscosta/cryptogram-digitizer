// src/types/symbol.ts
import type { Point } from './image';

export interface CellPosition {
  row: number;
  col: number;
}

export interface SymbolFeatures {
  area: number;
  perimeter: number;
  aspectRatio: number;
  moments: number[]; // Hu Moments (7 valores)
  histogram: number[];
  centerOfMass: Point;
  extent?: number;
  solidity?: number;
}

/**
 * Símbolo extraído de uma célula
 */
export interface ExtractedSymbol {
  id: string;
  imageData: ImageData;
  features: SymbolFeatures;
  positions: CellPosition[];
  hash: string;
}

/**
 * Cluster de símbolos similares (técnico)
 */
export interface SymbolCluster {
  id: string;
  representativeSymbol: ExtractedSymbol;
  members: ExtractedSymbol[];
  avgFeatures: SymbolFeatures;
  count: number;
}

/**
 * Símbolo único identificado (usado na UI)
 */
export interface UniqueSymbol {
  symbolId: string;
  representative: ExtractedSymbol;
  occurrences: CellPosition[];
  mappedLetter: string | null;
}

export type SymbolMapping = Record<string, string>; // symbolId -> Letter

export interface SymbolSuggestion {
  symbolId: string;
  suggestedLetter: string;
  confidence: number;
  reason: string;
}
