// src/store/puzzleStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PuzzleState, PuzzleMetadata, ProcessedData, SymbolMapping } from '@/types';

interface PuzzleStore {
  currentPuzzle: PuzzleState | null;
  savedPuzzles: PuzzleMetadata[];
  /** Dados de processamento em trânsito ProcessingPage→MappingPage (contém ImageData, nunca persiste) */
  pendingProcessedData: ProcessedData | null;
  setPendingProcessedData: (data: ProcessedData | null) => void;

  setCurrentPuzzle: (puzzle: PuzzleState) => void;
  updateMapping: (mapping: SymbolMapping) => void;
  updateSolution: (row: number, col: number, value: string) => void;
  savePuzzle: () => Promise<void>;
  loadPuzzle: (id: string) => Promise<void>;
  deletePuzzle: (id: string) => Promise<void>;
  clearCurrentPuzzle: () => void;
  /** Alias semântico usado pelo PuzzlePage */
  clearPuzzle: () => void;
}

export const usePuzzleStore = create<PuzzleStore>()(
  persist(
    (set, get) => ({
      currentPuzzle: null,
      savedPuzzles: [],
      pendingProcessedData: null,
      setPendingProcessedData: (data) => set({ pendingProcessedData: data }),

      setCurrentPuzzle: (puzzle) => set({ currentPuzzle: puzzle }),

      updateMapping: (mapping) =>
        set((state) => {
          if (!state.currentPuzzle) return state;

          return {
            currentPuzzle: {
              ...state.currentPuzzle,
              mapping,
              metadata: {
                ...state.currentPuzzle.metadata,
                lastModified: new Date(),
              },
            },
          };
        }),

      updateSolution: (row, col, value) =>
        set((state) => {
          if (!state.currentPuzzle) return state;

          const newGrid = state.currentPuzzle.solution.grid.map((r, i) =>
            r.map((c, j) =>
              i === row && j === col ? { ...c, userValue: value } : c
            )
          );

          let filled = 0;
          let total = 0;
          for (const r of newGrid) {
            for (const c of r) {
              if (!c.isClue && c.symbolId) {
                total++;
                if (c.userValue) filled++;
              }
            }
          }
          const progress = total > 0 ? (filled / total) * 100 : 0;

          return {
            currentPuzzle: {
              ...state.currentPuzzle,
              solution: {
                ...state.currentPuzzle.solution,
                grid: newGrid,
                progress,
                isComplete: progress === 100,
              },
              metadata: {
                ...state.currentPuzzle.metadata,
                progress,
                lastModified: new Date(),
              },
            },
          };
        }),

      savePuzzle: async () => {
        const puzzle = get().currentPuzzle;
        if (!puzzle) return;

        set((state) => ({
          savedPuzzles: [
            puzzle.metadata,
            ...state.savedPuzzles.filter((p) => p.id !== puzzle.id),
          ],
        }));
      },

      loadPuzzle: async (id) => {
        // Puzzles salvos contêm apenas metadata (sem ImageData, que não é serializável).
        // Para carregar um puzzle completo com imagens, o fluxo Upload → Processing
        // deve ser repetido. Esta função existe para uso futuro com IndexedDB.
        console.warn('loadPuzzle: persistência completa de ImageData ainda não implementada. id=', id);
      },

      deletePuzzle: async (id) => {
        set((state) => ({
          savedPuzzles: state.savedPuzzles.filter((p) => p.id !== id),
        }));
      },

      clearCurrentPuzzle: () => set({ currentPuzzle: null }),
      clearPuzzle: () => set({ currentPuzzle: null }),
    }),
    {
      name: 'puzzle-storage',
      partialize: (state) => ({
        savedPuzzles: state.savedPuzzles,
      }),
    }
  )
);
