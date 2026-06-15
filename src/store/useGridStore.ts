import { create } from 'zustand';
import type { GridResult, TableStructure } from '@/types/image';
import type { ExtractedSymbol, UniqueSymbol } from '@/types/symbol';

interface GridStore {
  grid: GridResult | null;
  tableStructure: TableStructure | null;
  extractedSymbols: ExtractedSymbol[];
  uniqueSymbols: UniqueSymbol[];
  usedFallback: boolean;
  setGrid: (grid: GridResult | null) => void;
  setTableStructure: (ts: TableStructure | null) => void;
  setExtractedSymbols: (symbols: ExtractedSymbol[]) => void;
  setUniqueSymbols: (symbols: UniqueSymbol[]) => void;
  setUsedFallback: (used: boolean) => void;
  clearGrid: () => void;
}

export const useGridStore = create<GridStore>()((set) => ({
  grid: null,
  tableStructure: null,
  extractedSymbols: [],
  uniqueSymbols: [],
  usedFallback: false,
  setGrid: (grid) => set({ grid }),
  setTableStructure: (tableStructure) => set({ tableStructure }),
  setExtractedSymbols: (extractedSymbols) => set({ extractedSymbols }),
  setUniqueSymbols: (uniqueSymbols) => set({ uniqueSymbols }),
  setUsedFallback: (usedFallback) => set({ usedFallback }),
  clearGrid: () => set({
    grid: null,
    tableStructure: null,
    extractedSymbols: [],
    uniqueSymbols: [],
    usedFallback: false,
  }),
}));
