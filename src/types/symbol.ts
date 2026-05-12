// src/types/symbol.ts
import type { CellPosition } from './puzzle';

export interface SymbolFeatures {
  area: number;
  aspectRatio: number;
  moments: number[]; // 7 Hu moments
}

export interface ExtractedSymbol {
  id: string;                 // Hash estável (para deduplicação técnica)
  imageData: ImageData;       // Recorte do símbolo
  features: SymbolFeatures;   // Características para clustering
  positions: CellPosition[];  // Onde aparece no grid
}

export interface SymbolCluster {
  id: string;                 // cluster_0, cluster_1...
  representativeSymbol: ExtractedSymbol;
  members: ExtractedSymbol[];
  avgFeatures: SymbolFeatures;
  count: number;
}

export interface UniqueSymbol {
  symbolId: string;           // ID lógico usado na UI (ex.: "symbol_12")
  representative: ExtractedSymbol;
  occurrences: CellPosition[];
}

export type SymbolMapping = Record<string, string>; // "symbol_12" -> "A"

export interface SymbolSuggestion {
  symbolId: string;
  suggestedLetter: string;
  confidence: number; // 0..1
  reason: string;
}
