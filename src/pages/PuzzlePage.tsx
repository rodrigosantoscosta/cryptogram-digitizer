// src/pages/PuzzlePage.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PuzzleGrid } from '@/components/PuzzleGrid';
import { CluePanel } from '@/components/CluePanel';
import { usePuzzleSolver } from '@/hooks/usePuzzleSolver';
import { usePuzzleNavigation } from '@/hooks/usePuzzleNavigation';
import { usePuzzleStore } from '@/store/puzzleStore';
import './PuzzlePage.css';

// ─── Responsive cell size ─────────────────────────────────────────────────────
const BASE_CELL_SIZE = 44;
const MIN_CELL_SIZE = 28;
const CLUE_PANEL_WIDTH = 168;
const GRID_PADDING = 48;

function calcCellSize(colCount: number, containerWidth: number): number {
  const available = containerWidth - CLUE_PANEL_WIDTH - GRID_PADDING;
  const ideal = Math.floor(available / colCount);
  return Math.max(MIN_CELL_SIZE, Math.min(BASE_CELL_SIZE, ideal));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div
      className="puzzle-progress"
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="puzzle-progress__track">
        <div className="puzzle-progress__fill" style={{ width: `${progress}%` }} />
      </div>
      <span className="puzzle-progress__label">{Math.round(progress)}%</span>
    </div>
  );
}

function PuzzleHeader({
  progress,
  elapsedSeconds,
  onReset,
  onBack,
}: {
  progress: number;
  elapsedSeconds: number;
  onReset: () => void;
  onBack: () => void;
}) {
  const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
  const secs = String(elapsedSeconds % 60).padStart(2, '0');

  return (
    <header className="puzzle-header">
      <div className="puzzle-header__left">
        <button className="puzzle-header__btn" onClick={onBack} aria-label="Voltar ao mapeamento">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Mapeamento
        </button>
      </div>

      <div className="puzzle-header__center">
        <span className="puzzle-header__logo">Criptograma</span>
        <ProgressBar progress={progress} />
      </div>

      <div className="puzzle-header__right">
        <span className="puzzle-header__timer" aria-label="Tempo decorrido">
          {mins}:{secs}
        </span>
        <button
          className="puzzle-header__btn puzzle-header__btn--danger"
          onClick={onReset}
          aria-label="Limpar respostas"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 4h12M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M2.5 4l.7 7.5a.5.5 0 00.5.5h6.6a.5.5 0 00.5-.5L11.5 4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Limpar
        </button>
      </div>
    </header>
  );
}

function CompletionBanner({ onNewPuzzle }: { onNewPuzzle: () => void }) {
  return (
    <div className="puzzle-completion" role="status" aria-live="polite">
      <div className="puzzle-completion__inner">
        <span className="puzzle-completion__icon" aria-hidden="true">✓</span>
        <div>
          <p className="puzzle-completion__title">Criptograma resolvido!</p>
          <p className="puzzle-completion__sub">Todas as letras foram preenchidas.</p>
        </div>
        <button className="puzzle-completion__btn" onClick={onNewPuzzle}>
          Novo puzzle
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function PuzzlePage() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(BASE_CELL_SIZE);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const currentPuzzle = usePuzzleStore((s) => s.currentPuzzle);
  const clearPuzzle = usePuzzleStore((s) => s.clearPuzzle);

  // Redireciona se não há puzzle carregado
  useEffect(() => {
    if (!currentPuzzle) {
      navigate('/');
    }
  }, [currentPuzzle, navigate]);

  const initialGrid = currentPuzzle?.solution?.grid ?? [];
  const initialMapping = currentPuzzle?.mapping ?? {};
  const clues = currentPuzzle?.processedData?.clues ?? [];
  const extractedSymbols = currentPuzzle?.processedData?.extractedSymbols ?? [];
  const colCount = initialGrid[0]?.length ?? 12;
  const rowCount = initialGrid.length;

  // Estado da grade e progresso
  const { grid, mapping, progress, updateCell, clearGrid } = usePuzzleSolver(
    initialGrid,
    initialMapping,
  );

  // Navegação e célula ativa
  const {
    activeRow,
    activeCol,
    correctCells,
    handleCellFocus,
    handleCellChange,
    handleCellKeyDown,
  } = usePuzzleNavigation();

  // Timer
  useEffect(() => {
    if (isComplete) return;
    const id = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isComplete]);

  // Detecção de conclusão
  useEffect(() => {
    if (progress >= 100 && !isComplete) {
      setIsComplete(true);
    }
  }, [progress, isComplete]);

  // Tamanho responsivo da célula
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
    (row: number, col: number, value: string) => {
      handleCellChange(row, col, value, updateCell);
    },
    [handleCellChange, updateCell],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, row: number, col: number) => {
      handleCellKeyDown(e, row, col, grid);
    },
    [handleCellKeyDown, grid],
  );

  const handleReset = useCallback(() => {
    if (window.confirm('Limpar todas as respostas?')) {
      clearGrid();
      setIsComplete(false);
      setElapsedSeconds(0);
    }
  }, [clearGrid]);

  const handleBack = useCallback(() => navigate('/mapping'), [navigate]);

  const handleNewPuzzle = useCallback(() => {
    clearPuzzle();
    navigate('/');
  }, [clearPuzzle, navigate]);

  if (!currentPuzzle) return null;

  return (
    <div className="puzzle-page" ref={containerRef}>
      <PuzzleHeader
        progress={progress}
        elapsedSeconds={elapsedSeconds}
        onReset={handleReset}
        onBack={handleBack}
      />

      {isComplete && <CompletionBanner onNewPuzzle={handleNewPuzzle} />}

      <main className="puzzle-page__body">
        <CluePanel
          clues={clues}
          activeRow={activeRow}
          cellSize={cellSize}
          rowCount={rowCount}
        />

        <div className="puzzle-page__grid-wrap">
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

      {/* Legenda do mapeamento ativo */}
      <footer className="puzzle-legend">
        <p className="puzzle-legend__title">Mapeamento ativo</p>
        <div className="puzzle-legend__chips">
          {Object.entries(mapping).map(([symbolId, letter]) =>
            letter ? (
              <span key={symbolId} className="puzzle-legend__chip">
                <span className="puzzle-legend__chip-id">
                  {symbolId.replace('symbol_', '#').replace('symbol-', '#')}
                </span>
                <span className="puzzle-legend__chip-arrow">→</span>
                <span className="puzzle-legend__chip-letter">{letter}</span>
              </span>
            ) : null,
          )}
        </div>
      </footer>
    </div>
  );
}
