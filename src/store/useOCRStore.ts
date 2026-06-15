import { create } from 'zustand';
import type { CellNumberMap } from '@/types/ocr';
import type { ClueResult } from '@/types/ocr';

interface OCRStore {
  cellNumbers: CellNumberMap | null;
  clues: ClueResult[];
  setCellNumbers: (data: CellNumberMap | null) => void;
  setClues: (clues: ClueResult[]) => void;
  clearOCR: () => void;
}

export const useOCRStore = create<OCRStore>()((set) => ({
  cellNumbers: null,
  clues: [],
  setCellNumbers: (cellNumbers) => set({ cellNumbers }),
  setClues: (clues) => set({ clues }),
  clearOCR: () => set({ cellNumbers: null, clues: [] }),
}));
