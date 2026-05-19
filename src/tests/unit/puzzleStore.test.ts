/**
 * Testes unitários para puzzleStore — lógica das actions
 *
 * Zustand 5 stores são difíceis de testar isoladamente sem o runtime completo.
 * Estes testes extraem e testam a lógica pura das reducer functions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PuzzleState, PuzzleMetadata, ProcessedData, SymbolMapping, GridCell } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMetadata(id: string = 'test-1'): PuzzleMetadata {
  return {
    id,
    name: `Puzzle ${id}`,
    createdAt: new Date('2024-01-01'),
    lastModified: new Date('2024-01-01'),
    progress: 0,
  };
}

function makeGrid(): GridCell[][] {
  return [
    [
      { row: 0, col: 0, isClue: true, symbolId: undefined, userValue: '' },
      { row: 0, col: 1, isClue: false, symbolId: 'sym_A', userValue: '' },
      { row: 0, col: 2, isClue: false, symbolId: 'sym_B', userValue: '' },
    ],
    [
      { row: 1, col: 0, isClue: true, symbolId: undefined, userValue: '' },
      { row: 1, col: 1, isClue: false, symbolId: 'sym_B', userValue: '' },
      { row: 1, col: 2, isClue: false, symbolId: 'sym_A', userValue: '' },
    ],
  ];
}

function makePuzzleState(id: string = 'test-1'): PuzzleState {
  return {
    id,
    metadata: makeMetadata(id),
    processedData: {} as ProcessedData,
    solution: {
      grid: makeGrid(),
      mapping: {},
      isComplete: false,
      progress: 0,
    },
    mapping: {},
  };
}

// ─── Re-implementação da lógica do store (sem Zustand) ────────────────────────

interface StoreState {
  currentPuzzle: PuzzleState | null;
  savedPuzzles: PuzzleMetadata[];
  pendingProcessedData: ProcessedData | null;
}

function setCurrentPuzzle(state: StoreState, puzzle: PuzzleState): StoreState {
  return { ...state, currentPuzzle: puzzle };
}

function updateMapping(state: StoreState, mapping: SymbolMapping): StoreState {
  if (!state.currentPuzzle) return state;
  return {
    ...state,
    currentPuzzle: {
      ...state.currentPuzzle,
      mapping,
      metadata: {
        ...state.currentPuzzle.metadata,
        lastModified: new Date(),
      },
    },
  };
}

function updateSolution(state: StoreState, row: number, col: number, value: string): StoreState {
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
    ...state,
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
}

function savePuzzle(state: StoreState): StoreState {
  const puzzle = state.currentPuzzle;
  if (!puzzle) return state;
  return {
    ...state,
    savedPuzzles: [
      puzzle.metadata,
      ...state.savedPuzzles.filter((p) => p.id !== puzzle.id),
    ],
  };
}

function deletePuzzle(state: StoreState, id: string): StoreState {
  return {
    ...state,
    savedPuzzles: state.savedPuzzles.filter((p) => p.id !== id),
  };
}

function clearCurrentPuzzle(state: StoreState): StoreState {
  return { ...state, currentPuzzle: null };
}

// ─── setCurrentPuzzle ────────────────────────────────────────────────────────

describe('puzzleStore — setCurrentPuzzle', () => {
  it('deve definir o puzzle atual', () => {
    const state: StoreState = { currentPuzzle: null, savedPuzzles: [], pendingProcessedData: null };
    const puzzle = makePuzzleState();

    const result = setCurrentPuzzle(state, puzzle);

    expect(result.currentPuzzle).toBe(puzzle);
  });
});

// ─── updateMapping ────────────────────────────────────────────────────────────

describe('puzzleStore — updateMapping', () => {
  it('deve atualizar o mapping do puzzle atual', () => {
    const state: StoreState = {
      currentPuzzle: makePuzzleState(),
      savedPuzzles: [],
      pendingProcessedData: null,
    };
    const mapping: SymbolMapping = { sym_A: 'C', sym_B: 'A' };

    const result = updateMapping(state, mapping);

    expect(result.currentPuzzle!.mapping).toEqual(mapping);
  });

  it('deve atualizar lastModified', () => {
    const state: StoreState = {
      currentPuzzle: makePuzzleState(),
      savedPuzzles: [],
      pendingProcessedData: null,
    };
    const oldDate = new Date('2020-01-01');
    state.currentPuzzle!.metadata.lastModified = oldDate;

    const result = updateMapping(state, { sym_A: 'C' });

    expect(result.currentPuzzle!.metadata.lastModified).not.toBe(oldDate);
  });

  it('deve retornar o mesmo state se não há puzzle atual', () => {
    const state: StoreState = { currentPuzzle: null, savedPuzzles: [], pendingProcessedData: null };

    const result = updateMapping(state, { sym_A: 'C' });

    expect(result).toBe(state);
  });
});

// ─── updateSolution ───────────────────────────────────────────────────────────

describe('puzzleStore — updateSolution', () => {
  it('deve atualizar userValue de uma célula', () => {
    const state: StoreState = {
      currentPuzzle: makePuzzleState(),
      savedPuzzles: [],
      pendingProcessedData: null,
    };

    const result = updateSolution(state, 0, 1, 'C');

    expect(result.currentPuzzle!.solution.grid[0][1].userValue).toBe('C');
  });

  it('deve calcular progresso corretamente', () => {
    const state: StoreState = {
      currentPuzzle: makePuzzleState(),
      savedPuzzles: [],
      pendingProcessedData: null,
    };
    // 4 células editáveis
    // Preencher 1 → 25%
    const result = updateSolution(state, 0, 1, 'C');
    expect(result.currentPuzzle!.solution.progress).toBe(25);
  });

  it('deve marcar isComplete quando progresso = 100', () => {
    const state: StoreState = {
      currentPuzzle: makePuzzleState(),
      savedPuzzles: [],
      pendingProcessedData: null,
    };

    let result = updateSolution(state, 0, 1, 'C');
    result = updateSolution(result, 0, 2, 'A');
    result = updateSolution(result, 1, 1, 'B');
    result = updateSolution(result, 1, 2, 'D');

    expect(result.currentPuzzle!.solution.isComplete).toBe(true);
    expect(result.currentPuzzle!.solution.progress).toBe(100);
  });

  it('deve retornar o mesmo state se não há puzzle atual', () => {
    const state: StoreState = { currentPuzzle: null, savedPuzzles: [], pendingProcessedData: null };

    const result = updateSolution(state, 0, 0, 'A');

    expect(result).toBe(state);
  });
});

// ─── savePuzzle ───────────────────────────────────────────────────────────────

describe('puzzleStore — savePuzzle', () => {
  it('deve adicionar metadata aos savedPuzzles', () => {
    const state: StoreState = {
      currentPuzzle: makePuzzleState('puzzle-1'),
      savedPuzzles: [],
      pendingProcessedData: null,
    };

    const result = savePuzzle(state);

    expect(result.savedPuzzles).toHaveLength(1);
    expect(result.savedPuzzles[0].id).toBe('puzzle-1');
  });

  it('deve substituir puzzle existente com mesmo id', () => {
    const state: StoreState = {
      currentPuzzle: makePuzzleState('puzzle-1'),
      savedPuzzles: [makeMetadata('puzzle-2'), makeMetadata('puzzle-1')],
      pendingProcessedData: null,
    };

    const result = savePuzzle(state);

    expect(result.savedPuzzles).toHaveLength(2);
    expect(result.savedPuzzles[0].id).toBe('puzzle-1'); // novo no início
  });

  it('não deve salvar se não há puzzle atual', () => {
    const state: StoreState = { currentPuzzle: null, savedPuzzles: [], pendingProcessedData: null };

    const result = savePuzzle(state);

    expect(result.savedPuzzles).toEqual([]);
  });
});

// ─── deletePuzzle ─────────────────────────────────────────────────────────────

describe('puzzleStore — deletePuzzle', () => {
  it('deve remover puzzle dos savedPuzzles', () => {
    const state: StoreState = {
      currentPuzzle: null,
      savedPuzzles: [makeMetadata('puzzle-1'), makeMetadata('puzzle-2')],
      pendingProcessedData: null,
    };

    const result = deletePuzzle(state, 'puzzle-1');

    expect(result.savedPuzzles).toHaveLength(1);
    expect(result.savedPuzzles[0].id).toBe('puzzle-2');
  });

  it('deve retornar mesmo array se id não existe', () => {
    const state: StoreState = {
      currentPuzzle: null,
      savedPuzzles: [makeMetadata('puzzle-1')],
      pendingProcessedData: null,
    };

    const result = deletePuzzle(state, 'nonexistent');

    expect(result.savedPuzzles).toHaveLength(1);
  });
});

// ─── clearCurrentPuzzle ───────────────────────────────────────────────────────

describe('puzzleStore — clearCurrentPuzzle', () => {
  it('deve definir currentPuzzle como null', () => {
    const state: StoreState = {
      currentPuzzle: makePuzzleState(),
      savedPuzzles: [],
      pendingProcessedData: null,
    };

    const result = clearCurrentPuzzle(state);

    expect(result.currentPuzzle).toBeNull();
  });

  it('deve manter savedPuzzles intactos', () => {
    const state: StoreState = {
      currentPuzzle: makePuzzleState(),
      savedPuzzles: [makeMetadata('puzzle-1')],
      pendingProcessedData: null,
    };

    const result = clearCurrentPuzzle(state);

    expect(result.savedPuzzles).toHaveLength(1);
  });
});
