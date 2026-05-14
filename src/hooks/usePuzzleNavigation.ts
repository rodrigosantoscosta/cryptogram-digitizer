// src/hooks/usePuzzleNavigation.ts
import { useState, useCallback } from 'react';
import type { GridCell } from '@/types';

interface ActiveCell {
  row: number;
  col: number;
}

interface UsePuzzleNavigationReturn {
  activeRow: number | null;
  activeCol: number | null;
  correctCells: Set<string>;
  handleCellFocus: (row: number, col: number) => void;
  handleCellChange: (
    row: number,
    col: number,
    value: string,
    onChange: (row: number, col: number, value: string) => void,
  ) => void;
  handleCellKeyDown: (
    e: React.KeyboardEvent,
    row: number,
    col: number,
    grid: GridCell[][],
  ) => void;
  markCellCorrect: (row: number, col: number) => void;
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

export function usePuzzleNavigation(): UsePuzzleNavigationReturn {
  const [active, setActive] = useState<ActiveCell | null>(null);
  const [correctSet, setCorrectSet] = useState<Set<string>>(new Set());

  const handleCellFocus = useCallback((row: number, col: number) => {
    setActive({ row, col });
  }, []);

  const handleCellChange = useCallback(
    (
      row: number,
      col: number,
      value: string,
      onChange: (r: number, c: number, v: string) => void,
    ) => {
      onChange(row, col, value);
    },
    [],
  );

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent, row: number, col: number, grid: GridCell[][]) => {
      const move = (next: ActiveCell | null) => {
        if (next) setActive(next);
      };

      switch (e.key) {
        case 'Tab': {
          e.preventDefault();
          move(findNextCell(grid, row, col, e.shiftKey ? -1 : 1));
          break;
        }
        case 'ArrowRight': {
          move(findNextCell(grid, row, col, 1));
          break;
        }
        case 'ArrowLeft': {
          move(findNextCell(grid, row, col, -1));
          break;
        }
        case 'ArrowDown': {
          move(findVerticalCell(grid, row, col, 1));
          break;
        }
        case 'ArrowUp': {
          move(findVerticalCell(grid, row, col, -1));
          break;
        }
        case 'Backspace':
        case 'Delete': {
          const cell = grid[row]?.[col];
          if (!cell?.userValue) {
            move(findNextCell(grid, row, col, -1));
          }
          break;
        }
        default: {
          if (e.key.length === 1 && /[a-zA-ZáéíóúâêîôûãõçàüÁÉÍÓÚÂÊÎÔÛÃÕÇÀÜ]/.test(e.key)) {
            setTimeout(() => {
              move(findNextCell(grid, row, col, 1));
            }, 0);
          }
        }
      }
    },
    [],
  );

  const markCellCorrect = useCallback((row: number, col: number) => {
    setCorrectSet((prev) => {
      const next = new Set(prev);
      next.add(`${row}-${col}`);
      return next;
    });
  }, []);

  return {
    activeRow: active?.row ?? null,
    activeCol: active?.col ?? null,
    correctCells: correctSet,
    handleCellFocus,
    handleCellChange,
    handleCellKeyDown,
    markCellCorrect,
  };
}
