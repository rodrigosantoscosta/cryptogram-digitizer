import { useCallback, useEffect, useRef, useState } from 'react';
import { PuzzleGrid } from '../components/PuzzleGrid';
import { CluePanel } from '../components/CluePanel';
import { usePuzzleSolver } from '../hooks/usePuzzleSolver';
import { usePuzzleNavigation } from '../hooks/usePuzzleNavigation';
import type { ProcessedData } from '../types/index';
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

  // Build initial grid from extractedSymbols
  const initialGrid = buildGrid(processedData);
  const colCount = initialGrid[0]?.length ?? 9;
  const rowCount = initialGrid.length;

  const { grid, mapping, progress, updateCell, clearGrid } = usePuzzleSolver(initialGrid, initialMapping);

  const { activeRow, activeCol, correctCells, handleCellFocus, handleCellChange, handleCellKeyDown } =
    usePuzzleNavigation();

  // Timer
  useEffect(() => {
    if (isComplete) return;
    const id = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isComplete]);

  // Completion detection
  useEffect(() => {
    if (progress >= 100 && !isComplete) setIsComplete(true);
  }, [progress, isComplete]);

  // Responsive cell size
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
    <div style={s.page} ref={containerRef}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.headerLeft}>
          <button style={s.headerBtn} onClick={onBack}>← Mapeamento</button>
        </div>
        <div style={s.headerCenter}>
          <span style={s.headerLogo}>🔤 Criptograma</span>
          <div style={s.progressWrap}>
            <div style={s.progressTrack}>
              <div style={{ ...s.progressFill, width: `${progress}%` }} />
            </div>
            <span style={s.progressLabel}>{Math.round(progress)}%</span>
          </div>
        </div>
        <div style={s.headerRight}>
          <span style={s.timer}>{mins}:{secs}</span>
          <button
            style={s.dangerBtn}
            onClick={() => { if (window.confirm('Limpar todas as respostas?')) { clearGrid(); setIsComplete(false); setElapsedSeconds(0); } }}
          >
            🗑 Limpar
          </button>
        </div>
      </header>

      {/* Completion banner */}
      {isComplete && (
        <div style={s.completionBanner}>
          <span>✅ Criptograma resolvido! Todas as letras foram preenchidas.</span>
          <button style={s.newPuzzleBtn} onClick={onRestart}>Novo puzzle</button>
        </div>
      )}

      {/* Body */}
      <main style={s.body}>
        <CluePanel clues={clues} activeRow={activeRow} cellSize={cellSize} rowCount={rowCount} />
        <div style={s.gridWrap}>
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
      <footer style={s.legend}>
        <p style={s.legendTitle}>Mapeamento ativo</p>
        <div style={s.legendChips}>
          {Object.entries(mapping).map(([symbolId, letter]) =>
            letter ? (
              <span key={symbolId} style={s.chip}>
                <span style={s.chipId}>{symbolId.replace('symbol_', '#').replace('symbol-', '#')}</span>
                <span style={s.chipArrow}>→</span>
                <span style={s.chipLetter}>{letter}</span>
              </span>
            ) : null,
          )}
        </div>
      </footer>
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

import type { GridCell } from '../types/grid';

function buildGrid(data: ProcessedData): GridCell[][] {
  const { grid, uniqueSymbols } = data;
  const rows = grid.rows;
  const cols = grid.cols - 1; // skip clue column 0

  const matrix: GridCell[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      row: r,
      col: c,
      symbolId: undefined,
      isClue: false,
    } satisfies GridCell)),
  );

  // uniqueSymbols.occurrences contém as posições reais (col já inclui offset da coluna de pistas)
  for (const sym of uniqueSymbols) {
    for (const pos of sym.occurrences) {
      const r = pos.row;
      const c = pos.col - 1; // remove coluna de pistas (col 0)
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        matrix[r][c] = { ...matrix[r][c], symbolId: sym.symbolId };
      }
    }
  }

  return matrix;
}

// ─── styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page:            { display: 'flex', flexDirection: 'column', minHeight: '70vh' },
  header:          { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: '12px 20px', marginBottom: 20 },
  headerLeft:      { flex: 1 },
  headerCenter:    { flex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  headerRight:     { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 },
  headerLogo:      { fontSize: 16, fontWeight: 700, color: '#1a1a1a' },
  headerBtn:       { background: 'none', border: '1px solid #e5e5e5', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: '#444' },
  dangerBtn:       { background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: '#dc2626' },
  progressWrap:    { display: 'flex', alignItems: 'center', gap: 8, width: 180 },
  progressTrack:   { flex: 1, height: 6, background: '#e5e5e5', borderRadius: 3, overflow: 'hidden' },
  progressFill:    { height: '100%', background: '#667eea', transition: 'width .3s' },
  progressLabel:   { fontSize: 12, color: '#667eea', fontWeight: 700, minWidth: 32 },
  timer:           { fontSize: 13, fontWeight: 600, color: '#555', fontVariantNumeric: 'tabular-nums' },
  completionBanner:{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 10, padding: '12px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#065f46', fontSize: 15, fontWeight: 500 },
  newPuzzleBtn:    { background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  body:            { display: 'flex', gap: 0, flex: 1 },
  gridWrap:        { flex: 1, overflowX: 'auto' },
  legend:          { background: '#f8f9fa', border: '1px solid #e5e5e5', borderRadius: 10, padding: '12px 16px', marginTop: 20 },
  legendTitle:     { fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  legendChips:     { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip:            { display: 'inline-flex', alignItems: 'center', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 6, padding: '3px 8px', fontSize: 12, gap: 4 },
  chipId:          { color: '#667eea', fontWeight: 700 },
  chipArrow:       { color: '#aaa' },
  chipLetter:      { color: '#1a1a1a', fontWeight: 600 },
};
