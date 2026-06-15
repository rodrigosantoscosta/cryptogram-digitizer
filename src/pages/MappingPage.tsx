// src/pages/MappingPage.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, CheckCircle, AlertTriangle, Gamepad2, Inbox, Camera } from 'lucide-react';

import { useSymbolMapping } from '@/hooks/useSymbolMapping';
import { SymbolMapperUI } from '@/components/Mapping/SymbolMapperUI';
import { usePuzzleStore } from '@/store/puzzleStore';
import { useGridStore } from '@/store/useGridStore';
import { useOCRStore } from '@/store/useOCRStore';
import type { UniqueSymbol } from '@/types/symbol';
import type { PuzzleState } from '@/types/puzzle';
import type { GridCell } from '@/types/grid';

export function MappingPage() {
  const uniqueSymbols = useGridStore((s) => s.uniqueSymbols);
  const extractedSymbols = useGridStore((s) => s.extractedSymbols);
  const grid = useGridStore((s) => s.grid);
  const tableStructure = useGridStore((s) => s.tableStructure);
  const cellNumbers = useOCRStore((s) => s.cellNumbers);
  const clues = useOCRStore((s) => s.clues);

  const setCurrentPuzzle = usePuzzleStore((s) => s.setCurrentPuzzle);
  const navigate = useNavigate();

  const {
    mapping,
    suggestions,
    filteredSymbols,
    updateMapping,
    applyAutoMapping,
    progress,
    validation,
  } = useSymbolMapping(uniqueSymbols);

  function buildGrid(symbols: UniqueSymbol[]): GridCell[][] {
    let maxRow = 0;
    let maxCol = 0;
    for (const sym of symbols) {
      for (const pos of sym.occurrences) {
        if (pos.row > maxRow) maxRow = pos.row;
        if (pos.col > maxCol) maxCol = pos.col;
      }
    }

    const rows = maxRow + 1;
    const cols = maxCol + 2;

    const grid: GridCell[][] = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => ({
        row: r,
        col: c,
        isClue: c === 0,
        symbolId: undefined,
        userValue: undefined,
      }))
    );

    for (const sym of symbols) {
      for (const pos of sym.occurrences) {
        const cell = grid[pos.row]?.[pos.col + 1];
        if (cell) {
          cell.symbolId = sym.symbolId;
          cell.isClue = false;
        }
      }
    }

    return grid;
  }

  const handlePlay = () => {
    if (!validation.isValid && validation.errors.length > 0) return;

    const solutionGrid = buildGrid(uniqueSymbols);

    const puzzle: PuzzleState = {
      id: crypto.randomUUID(),
      metadata: {
        id: crypto.randomUUID(),
        name: `Criptograma ${new Date().toLocaleDateString('pt-BR')}`,
        createdAt: new Date(),
        lastModified: new Date(),
        progress: 0,
      },
      processedData: {
        preprocessedImage: new ImageData(1, 1),
        tableStructure: tableStructure ?? {
          rows: solutionGrid.length,
          cols: solutionGrid[0]?.length ?? 0,
          cellWidth: 44,
          cellHeight: 44,
          gridPoints: [],
          clueColumnWidth: 160,
          answerColumnWidth: 44,
        },
        grid: grid ?? {
          roi: { x: 0, y: 0, width: 0, height: 0 },
          rowPositions: [],
          colPositions: [],
          colWidths: [],
          rowHeights: [],
          rows: solutionGrid.length,
          cols: solutionGrid[0]?.length ?? 0,
        },
        clues,
        cellNumbers,
        extractedSymbols: extractedSymbols.length > 0
          ? extractedSymbols
          : uniqueSymbols.map((s) => s.representative),
        uniqueSymbols,
        processedAt: new Date(),
      },
      mapping,
      solution: {
        grid: solutionGrid,
        mapping,
        isComplete: false,
        progress: 0,
      },
    };

    setCurrentPuzzle(puzzle);
    navigate('/puzzle');
  };

  const canPlay = uniqueSymbols.length > 0 && progress >= 50;

  return (
    <div className="max-w-5xl mx-auto py-10 px-5">
      <h1 className="text-3xl font-bold mb-6 text-ink flex items-center">
        <ClipboardList size={28} className="mr-2" />Mapeamento de Símbolos
      </h1>

      <div className="bg-surface-card border border-border-light rounded-card p-5 mb-6">
        <div className="flex justify-between items-center mb-3 text-sm text-ink-muted">
          <span>Progresso do mapeamento</span>
          <strong className="text-xl text-primary">{progress.toFixed(0)}%</strong>
        </div>
        <div className="w-full h-2 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 ease-in-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {uniqueSymbols.length > 0 ? (
        <>
          {validation.isValid && (
            <div className="bg-success-bg border border-success-border rounded-input p-4 mb-6 text-success-text text-base font-medium flex items-center">
              <CheckCircle size={18} className="mr-1.5 flex-shrink-0" />Mapeamento completo e válido!
            </div>
          )}

          {validation.errors.length > 0 && (
            <div className="bg-error-bg border border-error-border rounded-input p-4 mb-6 text-error-text">
              <strong className="flex items-center">
                <AlertTriangle size={16} className="mr-1.5 flex-shrink-0" />Problemas encontrados:
              </strong>
              <ul className="mt-2 pl-5">
                {validation.errors.map((error: string) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <SymbolMapperUI
            uniqueSymbols={filteredSymbols}
            currentMapping={mapping}
            suggestions={suggestions}
            onMappingChange={updateMapping}
            onApplyAutoMapping={() => applyAutoMapping(0.7)}
          />

          <div className="mt-8 flex flex-col items-center gap-2.5">
            <button
              className={`
                px-10 py-4 text-lg font-bold text-white rounded-card transition-all duration-200
                flex items-center gap-2
                ${canPlay
                  ? 'bg-puzzle-blue hover:bg-puzzle-blue/90 active:bg-puzzle-blue/80'
                  : 'bg-ink-faint/60 cursor-not-allowed'}
              `}
              onClick={handlePlay}
              disabled={!canPlay}
              title={
                !canPlay
                  ? 'Mapeie pelo menos 50% dos símbolos para jogar'
                  : 'Iniciar o puzzle'
              }
            >
              <Gamepad2 size={18} />Jogar Criptograma →
            </button>
            {!canPlay && uniqueSymbols.length > 0 && (
              <p className="text-xs text-ink-faint m-0">
                Mapeie pelo menos 50% dos símbolos ({Math.ceil(uniqueSymbols.length * 0.5)} de {uniqueSymbols.length}) para jogar
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-20 px-5">
          <Inbox size={64} className="mx-auto mb-4 text-ink-faint" />
          <h2 className="text-2xl font-semibold text-ink mb-2">Nenhum símbolo para mapear</h2>
          <p className="text-base text-ink-muted mb-6">
            Faça upload e processamento de um criptograma primeiro
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-primary text-white no-underline rounded-input text-base font-semibold transition-all duration-200 hover:bg-primary-hover"
          >
            <Camera size={16} className="inline mr-1.5" />Ir para Upload
          </a>
        </div>
      )}
    </div>
  );
}
