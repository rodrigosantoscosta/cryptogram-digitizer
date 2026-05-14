// src/components/PuzzleGrid/PuzzleGrid.tsx
import { useRef, useCallback } from 'react';
import { PuzzleCell } from '@/components/PuzzleCell';
import type { GridCell, ExtractedSymbol } from '@/types';
import './PuzzleGrid.css';

interface PuzzleGridProps {
  grid: GridCell[][];
  extractedSymbols: ExtractedSymbol[];
  activeRow: number | null;
  activeCol: number | null;
  correctCells: Set<string>;
  onCellFocus: (row: number, col: number) => void;
  onCellChange: (row: number, col: number, value: string) => void;
  onCellKeyDown: (e: React.KeyboardEvent, row: number, col: number) => void;
  cellSize?: number;
}

function buildSymbolMap(symbols: ExtractedSymbol[]): Map<string, ImageData> {
  const map = new Map<string, ImageData>();
  for (const sym of symbols) {
    if (sym.imageData) map.set(sym.id, sym.imageData);
  }
  return map;
}

export function PuzzleGrid({
  grid,
  extractedSymbols,
  activeRow,
  activeCol,
  correctCells,
  onCellFocus,
  onCellChange,
  onCellKeyDown,
  cellSize = 44,
}: PuzzleGridProps) {
  const symbolMapRef = useRef<Map<string, ImageData>>(new Map());
  symbolMapRef.current = buildSymbolMap(extractedSymbols);

  const getSymbolImage = useCallback((symbolId?: string) => {
    if (!symbolId) return null;
    return symbolMapRef.current.get(symbolId) ?? null;
  }, []);

  return (
    <div
      className="puzzle-grid"
      style={{ '--cell-size': `${cellSize}px` } as React.CSSProperties}
      role="grid"
      aria-label="Grade do criptograma"
    >
      {grid.map((row, rowIdx) => (
        <div key={rowIdx} className="puzzle-grid__row" role="row">
          {row.map((cell, colIdx) => (
            <PuzzleCell
              key={`${rowIdx}-${colIdx}`}
              cell={cell}
              symbolImageData={getSymbolImage(cell.symbolId)}
              isActive={activeRow === rowIdx && activeCol === colIdx}
              isHighlighted={
                (activeRow === rowIdx || activeCol === colIdx) &&
                !(activeRow === rowIdx && activeCol === colIdx)
              }
              isCorrect={correctCells.has(`${rowIdx}-${colIdx}`)}
              onFocus={onCellFocus}
              onChange={onCellChange}
              onKeyDown={onCellKeyDown}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
