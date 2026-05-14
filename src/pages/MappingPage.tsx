// src/pages/MappingPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useSymbolMapping } from '@/hooks';
import { SymbolMapperUI } from '@/components';
import { usePuzzleStore } from '@/store/puzzleStore';
import type { UniqueSymbol, ProcessedData, PuzzleState, GridCell } from '@/types';



export function MappingPage() {
  const [uniqueSymbols, setUniqueSymbols] = useState<UniqueSymbol[]>([]);
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);

  const setCurrentPuzzle = usePuzzleStore((s) => s.setCurrentPuzzle);
  const navigate = useNavigate();

  useEffect(() => {
    // Tenta chave nova (v1) e chave legada como fallback
    const stored =
      sessionStorage.getItem('processedSymbols:v1') ||
      sessionStorage.getItem('processedSymbols');

    if (stored) {
      try {
        const symbols: UniqueSymbol[] = JSON.parse(stored);
        setUniqueSymbols(symbols);
        console.log('Símbolos carregados:', symbols.length);
      } catch (error) {
        console.error('Erro ao carregar símbolos:', error);
      }
    }

    // Tenta carregar processedData completo (salvo pelo ProcessingPage)
    const storedData = sessionStorage.getItem('processedData');
    if (storedData) {
      try {
        setProcessedData(JSON.parse(storedData));
      } catch {
        // silencioso — processedData é opcional para construir a grade
      }
    }
  }, []);

  const {
    mapping,
    suggestions,
    filteredSymbols,
    updateMapping,
    applyAutoMapping,
    progress,
    validation,
  } = useSymbolMapping(uniqueSymbols);

  /** Constrói a grade GridCell[][] a partir dos símbolos únicos */
  function buildGrid(symbols: UniqueSymbol[]): GridCell[][] {
    // Determina bounds da grade
    let maxRow = 0;
    let maxCol = 0;
    for (const sym of symbols) {
      for (const pos of sym.occurrences) {
        if (pos.row > maxRow) maxRow = pos.row;
        if (pos.col > maxCol) maxCol = pos.col;
      }
    }

    const rows = maxRow + 1;
    const cols = maxCol + 2; // +1 para coluna de pistas

    // Grid vazio
    const grid: GridCell[][] = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => ({
        row: r,
        col: c,
        isClue: c === 0, // primeira coluna = pista
        symbolId: undefined,
        userValue: undefined,
      }))
    );

    // Preenche posições dos símbolos (offset col +1 por causa da coluna de pistas)
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

    const grid = buildGrid(uniqueSymbols);

    const puzzle: PuzzleState = {
      id: crypto.randomUUID(),
      metadata: {
        id: crypto.randomUUID(),
        name: `Criptograma ${new Date().toLocaleDateString('pt-BR')}`,
        createdAt: new Date(),
        lastModified: new Date(),
        progress: 0,
      },
      processedData: processedData ?? {
        preprocessedImage: new ImageData(1, 1),
        tableStructure: {
          rows: grid.length,
          cols: grid[0]?.length ?? 0,
          cellWidth: 44,
          cellHeight: 44,
          gridPoints: [],
          clueColumnWidth: 160,
          answerColumnWidth: 44,
        },
        grid: {
          roi: { x: 0, y: 0, width: 0, height: 0 },
          rowPositions: [],
          colPositions: [],
          colWidths: [],
          rowHeights: [],
          rows: grid.length,
          cols: grid[0]?.length ?? 0,
        },
        clues: [],
        extractedSymbols: uniqueSymbols.map((s) => s.representative),
        uniqueSymbols,
        processedAt: new Date(),
      },
      mapping,
      solution: {
        grid,
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
    <div style={styles.container}>
      <h1 style={styles.title}>📋 Mapeamento de Símbolos</h1>

      <div style={styles.progressCard}>
        <div style={styles.progressHeader}>
          <span>Progresso do mapeamento</span>
          <strong style={styles.progressValue}>{progress.toFixed(0)}%</strong>
        </div>
        <div style={styles.progressBar}>
          <div
            style={{
              ...styles.progressFill,
              width: `${progress}%`,
            }}
          />
        </div>
      </div>

      {uniqueSymbols.length > 0 ? (
        <>
          {validation.isValid && (
            <div style={styles.successBanner}>
              ✅ Mapeamento completo e válido!
            </div>
          )}

          {validation.errors.length > 0 && (
            <div style={styles.errorBanner}>
              <strong>⚠️ Problemas encontrados:</strong>
              <ul style={styles.errorList}>
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

          {/* ── Botão Jogar ── */}
          <div style={styles.playSection}>
            <button
              style={{
                ...styles.playButton,
                ...(canPlay ? {} : styles.playButtonDisabled),
              }}
              onClick={handlePlay}
              disabled={!canPlay}
              title={
                !canPlay
                  ? 'Mapeie pelo menos 50% dos símbolos para jogar'
                  : 'Iniciar o puzzle'
              }
            >
              🎮 Jogar Criptograma →
            </button>
            {!canPlay && uniqueSymbols.length > 0 && (
              <p style={styles.playHint}>
                Mapeie pelo menos 50% dos símbolos ({Math.ceil(uniqueSymbols.length * 0.5)} de {uniqueSymbols.length}) para jogar
              </p>
            )}
          </div>
        </>
      ) : (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📭</div>
          <h2 style={styles.emptyTitle}>Nenhum símbolo para mapear</h2>
          <p style={styles.emptyText}>
            Faça upload e processamento de um criptograma primeiro
          </p>
          <a href="/" style={styles.emptyButton}>
            📸 Ir para Upload
          </a>
        </div>
      )}
    </div>
  );
}
const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '40px 20px',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '24px',
    color: '#1a1a1a',
  },
  progressCard: {
    backgroundColor: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    fontSize: '14px',
    color: '#666',
  },
  progressValue: {
    fontSize: '20px',
    color: '#667eea',
  },
  progressBar: {
    width: '100%',
    height: '8px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#667eea',
    transition: 'width 0.3s ease',
  },
  successBanner: {
    backgroundColor: '#d4edda',
    border: '1px solid #c3e6cb',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
    color: '#155724',
    fontSize: '16px',
    fontWeight: '500',
  },
  errorBanner: {
    backgroundColor: '#f8d7da',
    border: '1px solid #f5c6cb',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
    color: '#721c24',
  },
  errorList: {
    margin: '8px 0 0 0',
    paddingLeft: '20px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '80px 20px',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  emptyTitle: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '8px',
  },
  emptyText: {
    fontSize: '16px',
    color: '#666',
    marginBottom: '24px',
  },
  emptyButton: {
    display: 'inline-block',
    padding: '12px 24px',
    backgroundColor: '#667eea',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    transition: 'all 0.3s',
  },
  playSection: {
    marginTop: '32px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '10px',
  },
  playButton: {
    padding: '16px 40px',
    fontSize: '18px',
    fontWeight: '700',
    color: '#fff',
    backgroundColor: '#0079d3',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'background 0.2s, transform 0.1s',
    letterSpacing: '-0.01em',
  },
  playButtonDisabled: {
    backgroundColor: '#b0bec5',
    cursor: 'not-allowed',
  },
  playHint: {
    fontSize: '13px',
    color: '#999',
    margin: 0,
  },
};
