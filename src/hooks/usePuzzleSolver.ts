// src/hooks/usePuzzleSolver.ts
import { useState, useCallback, useMemo } from 'react';
import type { GridCell, SymbolMapping } from '@/types';
import { SymbolMapper } from '@/lib/image-processing/SymbolMapper';

export function usePuzzleSolver(
  initialGrid: GridCell[][],
  initialMapping: SymbolMapping
) {
  const [grid, setGrid] = useState<GridCell[][]>(initialGrid);
  const [mapping, setMapping] = useState<SymbolMapping>(initialMapping);

  const applyMapping = useCallback((newMapping: SymbolMapping) => {
    setMapping(newMapping);
    setGrid((prevGrid) => SymbolMapper.applyMappingToGrid(prevGrid, newMapping));
  }, []);

  const updateCell = useCallback((row: number, col: number, value: string) => {
    setGrid((prevGrid) => {
      const newGrid = prevGrid.map((r) => r.map((c) => ({ ...c })));
      newGrid[row][col].userValue = value.toUpperCase();
      return newGrid;
    });
  }, []);

  const clearGrid = useCallback(() => {
    setGrid((prevGrid) =>
      prevGrid.map((row) =>
        row.map((cell) => ({
          ...cell,
          userValue: '',
          isError: false,
        }))
      )
    );
  }, []);

  const progress = useMemo(() => {
    let filled = 0;
    let total = 0;

    for (const row of grid) {
      for (const cell of row) {
        if (!cell.isClue && cell.symbolId) {
          total++;
          if (cell.userValue) filled++;
        }
      }
    }

    return total > 0 ? (filled / total) * 100 : 0;
  }, [grid]);

  return {
    grid,
    mapping,
    progress,
    applyMapping,
    updateCell,
    clearGrid,
  };
}
