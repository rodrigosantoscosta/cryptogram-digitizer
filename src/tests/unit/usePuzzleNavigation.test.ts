/**
 * Testes unitários para funções puras de navegação do Puzzle
 * e para o hook usePuzzleNavigation (via renderHook).
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { GridCell } from '@/types/grid';
import { usePuzzleNavigation } from '@/hooks/usePuzzleNavigation';

// ─── Re-implementação local (funções não exportadas) ──────────────────────────

interface ActiveCell {
  row: number;
  col: number;
}

function findNextCell(
  grid: GridCell[][],
  row: number,
  col: number,
  direction: 1 | -1,
): ActiveCell | null {
  const rows = grid.length;
  if (rows === 0) return null;
  const cols = grid[0].length;
  let r = row;
  let c = col + direction;

  while (r >= 0 && r < rows) {
    while (c >= 0 && c < cols) {
      const cell = grid[r]?.[c];
      if (cell && !cell.isClue && cell.symbolId) return { row: r, col: c };
      c += direction;
    }
    r += direction;
    c = direction === 1 ? 0 : (grid[r]?.length ?? cols) - 1;
  }
  return null;
}

function findVerticalCell(
  grid: GridCell[][],
  row: number,
  col: number,
  direction: 1 | -1,
): ActiveCell | null {
  const rows = grid.length;
  let r = row + direction;
  while (r >= 0 && r < rows) {
    const cell = grid[r]?.[col];
    if (cell && !cell.isClue && cell.symbolId) return { row: r, col };
    r += direction;
  }
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cell(row: number, col: number, overrides: Partial<GridCell> = {}): GridCell {
  return {
    row,
    col,
    isClue: false,
    symbolId: `sym_${row}_${col}`,
    userValue: '',
    ...overrides,
  };
}

function clueCell(row: number, col: number): GridCell {
  return cell(row, col, { isClue: true, symbolId: undefined });
}

function emptyCell(row: number, col: number): GridCell {
  return cell(row, col, { symbolId: undefined });
}

// ─── findNextCell ─────────────────────────────────────────────────────────────

describe('findNextCell (direção = 1, forward)', () => {
  it('deve encontrar próxima célula na mesma linha', () => {
    const grid: GridCell[][] = [
      [cell(0, 0), cell(0, 1), cell(0, 2)],
    ];

    const result = findNextCell(grid, 0, 0, 1);

    expect(result).toEqual({ row: 0, col: 1 });
  });

  it('deve pular células de pista (isClue)', () => {
    const grid: GridCell[][] = [
      [cell(0, 0), clueCell(0, 1), cell(0, 2)],
    ];

    const result = findNextCell(grid, 0, 0, 1);

    expect(result).toEqual({ row: 0, col: 2 });
  });

  it('deve pular células sem symbolId', () => {
    const grid: GridCell[][] = [
      [cell(0, 0), emptyCell(0, 1), cell(0, 2)],
    ];

    const result = findNextCell(grid, 0, 0, 1);

    expect(result).toEqual({ row: 0, col: 2 });
  });

  it('deve pular para próxima linha ao chegar no fim', () => {
    const grid: GridCell[][] = [
      [cell(0, 0), cell(0, 1)],
      [cell(1, 0), cell(1, 1)],
    ];

    const result = findNextCell(grid, 0, 1, 1);

    expect(result).toEqual({ row: 1, col: 0 });
  });

  it('deve pular linhas inteiras de pistas', () => {
    const grid: GridCell[][] = [
      [cell(0, 0)],
      [clueCell(1, 0)],
      [cell(2, 0)],
    ];

    const result = findNextCell(grid, 0, 0, 1);

    expect(result).toEqual({ row: 2, col: 0 });
  });

  it('deve retornar null quando não há mais células', () => {
    const grid: GridCell[][] = [
      [cell(0, 0)],
    ];

    const result = findNextCell(grid, 0, 0, 1);

    expect(result).toBeNull();
  });

  it('deve retornar null para grid vazio', () => {
    expect(findNextCell([], 0, 0, 1)).toBeNull();
  });
});

describe('findNextCell (direção = -1, backward)', () => {
  it('deve encontrar célula anterior na mesma linha', () => {
    const grid: GridCell[][] = [
      [cell(0, 0), cell(0, 1), cell(0, 2)],
    ];

    const result = findNextCell(grid, 0, 2, -1);

    expect(result).toEqual({ row: 0, col: 1 });
  });

  it('deve pular para linha anterior ao chegar no início', () => {
    const grid: GridCell[][] = [
      [cell(0, 0), cell(0, 1)],
      [cell(1, 0), cell(1, 1)],
    ];

    const result = findNextCell(grid, 1, 0, -1);

    expect(result).toEqual({ row: 0, col: 1 });
  });

  it('deve retornar null quando não há mais células atrás', () => {
    const grid: GridCell[][] = [
      [cell(0, 0)],
    ];

    const result = findNextCell(grid, 0, 0, -1);

    expect(result).toBeNull();
  });

  it('deve pular pistas na direção backward', () => {
    const grid: GridCell[][] = [
      [cell(0, 0), clueCell(0, 1), cell(0, 2)],
    ];

    const result = findNextCell(grid, 0, 2, -1);

    expect(result).toEqual({ row: 0, col: 0 });
  });
});

// ─── findVerticalCell ─────────────────────────────────────────────────────────

describe('findVerticalCell (direction = 1, down)', () => {
  it('deve encontrar célula abaixo na mesma coluna', () => {
    const grid: GridCell[][] = [
      [cell(0, 0), cell(0, 1)],
      [cell(1, 0), cell(1, 1)],
      [cell(2, 0), cell(2, 1)],
    ];

    const result = findVerticalCell(grid, 0, 0, 1);

    expect(result).toEqual({ row: 1, col: 0 });
  });

  it('deve pular células de pista na vertical', () => {
    const grid: GridCell[][] = [
      [cell(0, 0)],
      [clueCell(1, 0)],
      [cell(2, 0)],
    ];

    const result = findVerticalCell(grid, 0, 0, 1);

    expect(result).toEqual({ row: 2, col: 0 });
  });

  it('deve retornar null ao chegar no fim da coluna', () => {
    const grid: GridCell[][] = [
      [cell(0, 0)],
      [cell(1, 0)],
    ];

    const result = findVerticalCell(grid, 1, 0, 1);

    expect(result).toBeNull();
  });
});

describe('findVerticalCell (direction = -1, up)', () => {
  it('deve encontrar célula acima na mesma coluna', () => {
    const grid: GridCell[][] = [
      [cell(0, 0)],
      [cell(1, 0)],
      [cell(2, 0)],
    ];

    const result = findVerticalCell(grid, 2, 0, -1);

    expect(result).toEqual({ row: 1, col: 0 });
  });

  it('deve pular pistas na direção up', () => {
    const grid: GridCell[][] = [
      [cell(0, 0)],
      [clueCell(1, 0)],
      [cell(2, 0)],
    ];

    const result = findVerticalCell(grid, 2, 0, -1);

    expect(result).toEqual({ row: 0, col: 0 });
  });

  it('deve retornar null ao chegar no topo', () => {
    const grid: GridCell[][] = [
      [cell(0, 0)],
    ];

    const result = findVerticalCell(grid, 0, 0, -1);

    expect(result).toBeNull();
  });
});

// ─── usePuzzleNavigation hook ─────────────────────────────────────────────────

function makeGrid(rows: number, cols: number): GridCell[][] {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => cell(r, c)),
  );
}

function createKeyboardEvent(key: string, options: Partial<KeyboardEvent> = {}): React.KeyboardEvent {
  return {
    key,
    preventDefault: vi.fn(),
    ...options,
  } as unknown as React.KeyboardEvent;
}

describe('usePuzzleNavigation hook', () => {
  it('deve iniciar com activeRow e activeCol null', () => {
    const { result } = renderHook(() => usePuzzleNavigation());

    expect(result.current.activeRow).toBeNull();
    expect(result.current.activeCol).toBeNull();
  });

  it('handleCellFocus deve definir activeRow e activeCol', () => {
    const { result } = renderHook(() => usePuzzleNavigation());

    act(() => {
      result.current.handleCellFocus(2, 3);
    });

    expect(result.current.activeRow).toBe(2);
    expect(result.current.activeCol).toBe(3);
  });

  it('handleCellChange deve chamar onChange com os argumentos corretos', () => {
    const { result } = renderHook(() => usePuzzleNavigation());
    const onChange = vi.fn();

    act(() => {
      result.current.handleCellChange(1, 2, '5', onChange);
    });

    expect(onChange).toHaveBeenCalledWith(1, 2, '5');
  });

  it('markCellCorrect deve adicionar célula ao set correctCells', () => {
    const { result } = renderHook(() => usePuzzleNavigation());

    act(() => {
      result.current.markCellCorrect(3, 4);
    });

    expect(result.current.correctCells.has('3-4')).toBe(true);
  });

  describe('handleCellKeyDown - Tab', () => {
    it('Tab deve mover para próxima célula e chamar preventDefault', () => {
      const { result } = renderHook(() => usePuzzleNavigation());
      const grid = makeGrid(2, 3);

      act(() => {
        result.current.handleCellFocus(0, 0);
      });

      const e = createKeyboardEvent('Tab');
      act(() => {
        result.current.handleCellKeyDown(e, 0, 0, grid);
      });

      expect(e.preventDefault).toHaveBeenCalled();
      expect(result.current.activeRow).toBe(0);
      expect(result.current.activeCol).toBe(1);
    });

    it('Shift+Tab deve mover para célula anterior', () => {
      const { result } = renderHook(() => usePuzzleNavigation());
      const grid = makeGrid(2, 3);

      act(() => {
        result.current.handleCellFocus(0, 1);
      });

      const e = createKeyboardEvent('Tab', { shiftKey: true });
      act(() => {
        result.current.handleCellKeyDown(e, 0, 1, grid);
      });

      expect(result.current.activeRow).toBe(0);
      expect(result.current.activeCol).toBe(0);
    });
  });

  describe('handleCellKeyDown - Arrow keys', () => {
    it('ArrowRight deve mover para célula à direita', () => {
      const { result } = renderHook(() => usePuzzleNavigation());
      const grid = makeGrid(2, 3);

      act(() => {
        result.current.handleCellFocus(0, 0);
      });

      act(() => {
        result.current.handleCellKeyDown(createKeyboardEvent('ArrowRight'), 0, 0, grid);
      });

      expect(result.current.activeRow).toBe(0);
      expect(result.current.activeCol).toBe(1);
    });

    it('ArrowLeft deve mover para célula à esquerda', () => {
      const { result } = renderHook(() => usePuzzleNavigation());
      const grid = makeGrid(2, 3);

      act(() => {
        result.current.handleCellFocus(0, 2);
      });

      act(() => {
        result.current.handleCellKeyDown(createKeyboardEvent('ArrowLeft'), 0, 2, grid);
      });

      expect(result.current.activeRow).toBe(0);
      expect(result.current.activeCol).toBe(1);
    });

    it('ArrowDown deve mover para célula abaixo', () => {
      const { result } = renderHook(() => usePuzzleNavigation());
      const grid = makeGrid(3, 2);

      act(() => {
        result.current.handleCellFocus(0, 0);
      });

      act(() => {
        result.current.handleCellKeyDown(createKeyboardEvent('ArrowDown'), 0, 0, grid);
      });

      expect(result.current.activeRow).toBe(1);
      expect(result.current.activeCol).toBe(0);
    });

    it('ArrowUp deve mover para célula acima', () => {
      const { result } = renderHook(() => usePuzzleNavigation());
      const grid = makeGrid(3, 2);

      act(() => {
        result.current.handleCellFocus(2, 0);
      });

      act(() => {
        result.current.handleCellKeyDown(createKeyboardEvent('ArrowUp'), 2, 0, grid);
      });

      expect(result.current.activeRow).toBe(1);
      expect(result.current.activeCol).toBe(0);
    });
  });

  describe('handleCellKeyDown - Backspace/Delete', () => {
    it('Backspace em célula vazia deve mover para célula anterior', () => {
      const { result } = renderHook(() => usePuzzleNavigation());
      const grid = makeGrid(2, 3);

      act(() => {
        result.current.handleCellFocus(0, 1);
      });

      act(() => {
        result.current.handleCellKeyDown(createKeyboardEvent('Backspace'), 0, 1, grid);
      });

      expect(result.current.activeRow).toBe(0);
      expect(result.current.activeCol).toBe(0);
    });

    it('Backspace em célula com valor NÃO deve mover', () => {
      const { result } = renderHook(() => usePuzzleNavigation());
      const grid = makeGrid(2, 3);
      grid[0][1] = { ...grid[0][1], userValue: '5' };

      act(() => {
        result.current.handleCellFocus(0, 1);
      });

      act(() => {
        result.current.handleCellKeyDown(createKeyboardEvent('Backspace'), 0, 1, grid);
      });

      expect(result.current.activeRow).toBe(0);
      expect(result.current.activeCol).toBe(1);
    });

    it('Delete em célula vazia deve mover para célula anterior', () => {
      const { result } = renderHook(() => usePuzzleNavigation());
      const grid = makeGrid(2, 3);

      act(() => {
        result.current.handleCellFocus(0, 1);
      });

      act(() => {
        result.current.handleCellKeyDown(createKeyboardEvent('Delete'), 0, 1, grid);
      });

      expect(result.current.activeRow).toBe(0);
      expect(result.current.activeCol).toBe(0);
    });
  });

  describe('handleCellKeyDown - Character keys', () => {
    it('tecla de letra deve agendar avanço para próxima célula', () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => usePuzzleNavigation());
      const grid = makeGrid(2, 3);

      act(() => {
        result.current.handleCellFocus(0, 0);
      });

      act(() => {
        result.current.handleCellKeyDown(createKeyboardEvent('a'), 0, 0, grid);
      });

      expect(result.current.activeRow).toBe(0);
      expect(result.current.activeCol).toBe(0);

      act(() => {
        vi.advanceTimersByTime(10);
      });

      expect(result.current.activeRow).toBe(0);
      expect(result.current.activeCol).toBe(1);

      vi.useRealTimers();
    });

    it('tecla numérica NÃO deve agendar avanço', () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => usePuzzleNavigation());
      const grid = makeGrid(2, 3);

      act(() => {
        result.current.handleCellFocus(0, 0);
      });

      act(() => {
        result.current.handleCellKeyDown(createKeyboardEvent('5'), 0, 0, grid);
      });

      act(() => {
        vi.advanceTimersByTime(10);
      });

      expect(result.current.activeRow).toBe(0);
      expect(result.current.activeCol).toBe(0);

      vi.useRealTimers();
    });
  });
});
