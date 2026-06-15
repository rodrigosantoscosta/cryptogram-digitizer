import { useCallback, useEffect, useRef, useState } from 'react';
import { Type, Trash2, CheckCircle, ArrowLeft } from 'lucide-react';
import { PuzzleGrid } from '../components/PuzzleGrid';
import { CluePanel } from '../components/CluePanel';
import { usePuzzleSolver } from '../hooks/usePuzzleSolver';
import { usePuzzleNavigation } from '../hooks/usePuzzleNavigation';
import type { ProcessedData } from '@/types/puzzle';
import type { SymbolMapping } from '../types/symbol';

const BASE_CELL_SIZE = 44;
const MIN_CELL_SIZE = 28;
const CLUE_PANEL_WIDTH = 168;
const GRID_PADDING = 48;

function calcCellSize(colCount: number, containerWidth: number): number {
  const available = containerWidth - CLUE_PANEL_WIDTH - GRID_PADDING;
  const ideal = Math.floor(available / colCount);
  return Math.max(MIN_CELL_SIZE, Math.min(BASE_CELL_SIZE, ideal));
}

interface Props {
  processedData: ProcessedData;
  mapping: SymbolMapping;
  onBack: () => void;
  onRestart: () => void;
}

export function StepSolution({ processedData, mapping: initialMapping, onBack, onRestart }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(BASE_CELL_SIZE);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const { clues, extractedSymbols } = processedData;

  const initialGrid = buildGrid(processedData);
  const colCount = initialGrid[0]?.length ?? 9;
  const rowCount = initialGrid.length;

  const { grid, mapping, progress, updateCell, clearGrid } = usePuzzleSolver(initialGrid, initialMapping);

  const { activeRow, activeCol, correctCells, handleCellFocus, handleCellChange, handleCellKeyDown } =
    usePuzzleNavigation();

  useEffect(() => {
    if (isComplete) return;
    const id = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isComplete]);

  useEffect(() => {
    if (progress >= 100 && !isComplete) setIsComplete(true);
  }, [progress, isComplete]);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setCellSize(calcCellSize(colCount, containerRef.current.clientWidth));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [colCount]);

  const handleChange = useCallback(
    (row: number, col: number, value: string) => handleCellChange(row, col, value, updateCell),
    [handleCellChange, updateCell],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, row: number, col: number) => handleCellKeyDown(e, row, col, grid),
    [handleCellKeyDown, grid],
  );

  const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
  const secs = String(elapsedSeconds % 60).padStart(2, '0');

  return (
    <div className="flex flex-col min-h-[70vh]" ref={containerRef}>
      {/* Header */}
      <header className="flex items-center justify-between bg-surface-card border border-border rounded-card px-5 py-3 mb-5">
        <div className="flex-1">
          <button
            className="bg-none border border-border rounded-input px-3 py-1.5 cursor-pointer text-xs text-ink-muted hover:bg-surface-subtle transition-colors flex items-center gap-1.5"
            onClick={onBack}
          >
            <ArrowLeft size={14} />Mapeamento
          </button>
        </div>
        <div className="flex-2 flex flex-col items-center gap-1">
          <span className="text-base font-bold text-ink flex items-center gap-1">
            <Type size={18} />Criptograma
          </span>
          <div className="flex items-center gap-2 w-45">
            <div className="flex-1 h-1.5 bg-border rounded-sm overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-primary font-bold min-w-8">{Math.round(progress)}%</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-end gap-3">
          <span className="text-xs font-semibold text-ink-muted tabular-nums">{mins}:{secs}</span>
          <button
            className="bg-none border border-red-200 rounded-input px-3 py-1.5 cursor-pointer text-xs text-error hover:bg-error/10 transition-colors flex items-center gap-1"
            onClick={() => { if (window.confirm('Limpar todas as respostas?')) { clearGrid(); setIsComplete(false); setElapsedSeconds(0); } }}
          >
            <Trash2 size={14} />Limpar
          </button>
        </div>
      </header>

      {/* Completion banner */}
      {isComplete && (
        <div className="bg-emerald-100 border border-emerald-300 rounded-input px-5 py-3 mb-4 flex items-center justify-between text-emerald-800 text-sm font-medium">
          <span className="flex items-center gap-1.5">
            <CheckCircle size={18} />Criptograma resolvido! Todas as letras foram preenchidas.
          </span>
          <button className="bg-emerald-500 text-white border-none rounded-input px-3.5 py-1.5 cursor-pointer text-xs font-semibold hover:bg-emerald-600 transition-colors" onClick={onRestart}>Novo puzzle</button>
        </div>
      )}

      {/* Body */}
      <main className="flex gap-0 flex-1">
        <CluePanel clues={clues} activeRow={activeRow} cellSize={cellSize} rowCount={rowCount} />
        <div className="flex-1 overflow-x-auto">
          <PuzzleGrid
            grid={grid}
            extractedSymbols={extractedSymbols}
            activeRow={activeRow}
            activeCol={activeCol}
            correctCells={correctCells}
            onCellFocus={handleCellFocus}
            onCellChange={handleChange}
            onCellKeyDown={handleKeyDown}
            cellSize={cellSize}
          />
        </div>
      </main>

      {/* Mapping legend */}
      <footer className="bg-surface-subtle border border-border rounded-input px-4 py-3 mt-5">
        <p className="text-xs font-bold text-ink-muted mb-2 uppercase tracking-widest">Mapeamento ativo</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(mapping).map(([symbolId, letter]) =>
            letter ? (
              <span key={symbolId} className="inline-flex items-center bg-surface-card border border-border rounded-input px-2 py-0.5 text-xs gap-1">
                <span className="text-primary font-bold">{/^\d+$/.test(symbolId) ? `#${symbolId}` : symbolId.replace(/^cluster_/, '#').replace(/^symbol[-_]/, '#')}</span>
                <span className="text-gray-400">→</span>
                <span className="text-ink font-semibold">{letter}</span>
              </span>
            ) : null,
          )}
        </div>
      </footer>
    </div>
  );
}

import type { GridCell } from '../types/grid';

function buildGrid(data: ProcessedData): GridCell[][] {
  const { grid, uniqueSymbols } = data;
  const rows = grid.rows;
  const cols = grid.cols - 1;

  const matrix: GridCell[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      row: r,
      col: c,
      symbolId: undefined,
      isClue: false,
    } satisfies GridCell)),
  );

  for (const sym of uniqueSymbols) {
    for (const pos of sym.occurrences) {
      const r = pos.row;
      const c = pos.col - 1;
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        matrix[r][c] = { ...matrix[r][c], symbolId: sym.symbolId };
      }
    }
  }

  return matrix;
}
