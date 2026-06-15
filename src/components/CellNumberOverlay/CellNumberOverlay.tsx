/**
 * CellNumberOverlay — visualização de debug do CellNumberMap
 *
 * Renderiza a grade do criptograma com os números detectados sobrepostos
 * sobre cada célula. Útil para validar o CellNumberReader antes de
 * conectar com o pipeline de mapeamento.
 *
 * Funcionalidades:
 * - Grade colorida por confiança (verde ≥0.8 / amarelo ≥0.5 / vermelho <0.5 / cinza = null)
 * - Tooltip com rawOcr (Tesseract literal), rawText (pós-sanitização) e confidence
 * - Estatísticas de cobertura no cabeçalho
 * - Botão "Exportar diagnóstico" — gera JSON compacto para análise
 * - Modo de edição: clique em célula → digita o valor real → ground truth inline
 * - Botão "Exportar Ground Truth" — gera JSON com overrides manuais aplicados
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { Download, AlertTriangle, Pencil, CheckCircle2 } from 'lucide-react';
import type { CellNumberMap, CellNumber } from '@/lib/ocr/CellNumberReader';
import type { GridResult } from '@/types/image';

interface Props {
  cellNumbers: CellNumberMap;
  grid: GridResult;
  backgroundImage?: ImageData;
  onCellClick?: (cell: CellNumber) => void;
  /** ID do puzzle para o export de ground truth (ex: "test", "sample_2") */
  puzzleId?: string;
  /**
   * Posição da imagem de fundo em relação à grade.
   * - 'top'  → imagem acima da grade (padrão anterior)
   * - 'side' → imagem à esquerda sticky, grade à direita (ideal para validação manual)
   */
  imagePosition?: 'top' | 'side';
}

const MAX_VALID_NUMBER = 27;

// ─── Helpers de cor ───────────────────────────────────────────────────────────

function confidenceColor(cell: CellNumber, overridden: boolean): string {
  if (overridden) return '#bfdbfe';               // azul — valor corrigido manualmente
  if (cell.number === null) return '#d1d5db';
  if (cell.number > MAX_VALID_NUMBER) return '#fca5a5';
  if (cell.confidence >= 0.8) return '#bbf7d0';
  if (cell.confidence >= 0.5) return '#fef08a';
  return '#fecaca';
}

function confidenceTextColor(cell: CellNumber, overridden: boolean): string {
  if (overridden) return '#1d4ed8';
  if (cell.number === null) return '#6b7280';
  if (cell.number > MAX_VALID_NUMBER) return '#991b1b';
  if (cell.confidence >= 0.8) return '#166534';
  if (cell.confidence >= 0.5) return '#854d0e';
  return '#991b1b';
}

// ─── Tipos para overrides ────────────────────────────────────────────────────

/** Mapa de overrides: chave "row:col" → número corrigido (null = apagar) */
type Overrides = Record<string, number | null>;

// ─── Export de diagnóstico ────────────────────────────────────────────────────

function buildDiagnosticExport(
  cellNumbers: CellNumberMap,
  grid: GridResult,
  overrides: Overrides = {},
) {
  const LOW_CONF = 0.60;
  const colStart = 1;
  const rows = grid.rows;
  const cols = grid.cols - colStart;

  const gridMatrix: (number | null)[][] = Array.from({ length: rows }, () =>
    new Array(cols).fill(null)
  );
  for (const c of cellNumbers.cells) {
    const ci = c.col - colStart;
    if (c.row >= 0 && c.row < rows && ci >= 0 && ci < cols) {
      const key = `${c.row}:${c.col}`;
      gridMatrix[c.row][ci] = key in overrides ? overrides[key] : c.number;
    }
  }

  const unrecognized = cellNumbers.cells
    .filter(c => {
      const key = `${c.row}:${c.col}`;
      return (key in overrides ? overrides[key] : c.number) === null;
    })
    .map(c => ({
      r: c.row, c: c.col,
      rawOcr: c.rawOcr ?? '',
      rawText: c.rawText ?? '',
    }));

  const lowConf = cellNumbers.cells
    .filter(c => {
      const key = `${c.row}:${c.col}`;
      const num = key in overrides ? overrides[key] : c.number;
      return num !== null && c.confidence < LOW_CONF && !(key in overrides);
    })
    .map(c => ({
      r: c.row, c: c.col, n: c.number,
      conf: Math.round(c.confidence * 100),
      rawOcr: c.rawOcr ?? '',
      rawText: c.rawText ?? '',
    }));

  const bySymbolCompact: Record<string, [number, number][]> = {};
  for (const [sym, positions] of Object.entries(cellNumbers.bySymbol)) {
    bySymbolCompact[sym] = positions.map(p => [p.row, p.col]);
  }

  return {
    meta: {
      recognized: cellNumbers.recognized,
      total: cellNumbers.total,
      coverage: `${((cellNumbers.recognized / cellNumbers.total) * 100).toFixed(1)}%`,
      uniqueSymbols: Object.keys(cellNumbers.bySymbol).length,
      gridSize: { rows, cols },
      overridesCount: Object.keys(overrides).length,
      exportedAt: new Date().toISOString(),
    },
    grid: gridMatrix,
    unrecognized,
    lowConf,
    bySymbol: bySymbolCompact,
  };
}

/** Ground truth no mesmo formato do GroundTruthValidator */
function buildGroundTruthExport(
  cellNumbers: CellNumberMap,
  grid: GridResult,
  overrides: Overrides,
  puzzleId: string,
) {
  const colStart = 1;
  const rows = grid.rows;
  const cols = grid.cols - colStart;

  // Grade completa com overrides aplicados
  const gridMatrix: (number | null)[][] = Array.from({ length: rows }, () =>
    new Array(cols).fill(null)
  );
  for (const c of cellNumbers.cells) {
    const ci = c.col - colStart;
    if (c.row >= 0 && c.row < rows && ci >= 0 && ci < cols) {
      const key = `${c.row}:${c.col}`;
      gridMatrix[c.row][ci] = key in overrides ? overrides[key] : c.number;
    }
  }

  // Frequência dos valores
  const freq: Record<string, number> = {};
  for (const row of gridMatrix) {
    for (const val of row) {
      if (val !== null) {
        const k = String(val);
        freq[k] = (freq[k] ?? 0) + 1;
      }
    }
  }

  const filled = gridMatrix.flat().filter(v => v !== null).length;

  return {
    puzzleId,
    type: 'numeric' as const,
    dimensions: { rows, cols },
    valueRange: { min: 1, max: 27 },
    grid: gridMatrix,
    frequency: freq,
    metadata: {
      validatedBy: 'manual-overlay',
      validatedAt: new Date().toISOString(),
      filledCells: filled,
      totalCells: rows * cols,
      completionPct: Math.round((filled / (rows * cols)) * 100),
      ocrCoverage: `${((cellNumbers.recognized / cellNumbers.total) * 100).toFixed(1)}%`,
      manualOverrides: Object.keys(overrides).length,
      notes: 'Generated via CellNumberOverlay ground truth mode in StepMapping',
    },
  };
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function CellNumberOverlay({
  cellNumbers, grid, backgroundImage, onCellClick, puzzleId = 'puzzle',
  imagePosition = 'top',
}: Props) {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);

  // Tooltip de hover
  const [tooltip, setTooltip] = useState<{ cell: CellNumber; x: number; y: number } | null>(null);

  // Modo de edição de ground truth
  const [editMode, setEditMode] = useState(false);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [activeEdit, setActiveEdit] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Desenha imagem de fundo no canvas
  useEffect(() => {
    if (!backgroundImage || !bgCanvasRef.current) return;
    const ctx = bgCanvasRef.current.getContext('2d');
    if (!ctx) return;
    bgCanvasRef.current.width = backgroundImage.width;
    bgCanvasRef.current.height = backgroundImage.height;
    ctx.putImageData(backgroundImage, 0, 0);
  }, [backgroundImage]);

  // Foca o input ao ativar edição de célula
  useEffect(() => {
    if (activeEdit) setTimeout(() => editInputRef.current?.focus(), 20);
  }, [activeEdit]);

  const cellMap = new Map<string, CellNumber>();
  for (const c of cellNumbers.cells) {
    cellMap.set(`${c.row}:${c.col}`, c);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  const { recognized, total } = cellNumbers;
  const coverage = total > 0 ? ((recognized / total) * 100).toFixed(0) : '0';
  const uniqueCount = Object.keys(cellNumbers.bySymbol).length;
  const MAX_VALID = 26;
  const invalidCells = cellNumbers.cells.filter(c => c.number !== null && c.number > MAX_VALID);
  const trulyValid = cellNumbers.cells.filter(c =>
    c.number !== null && c.number <= MAX_VALID && c.confidence >= 0.60
  ).length;
  const trueAccuracy = total > 0 ? ((trulyValid / total) * 100).toFixed(0) : '0';
  const overrideCount = Object.keys(overrides).length;

  // ── Handlers de edição ────────────────────────────────────────────────────

  const handleCellClick = useCallback((cell: CellNumber) => {
    if (!editMode) {
      onCellClick?.(cell);
      return;
    }
    setActiveEdit({ row: cell.row, col: cell.col });
    const key = `${cell.row}:${cell.col}`;
    const current = key in overrides ? overrides[key] : cell.number;
    setEditValue(current !== null ? String(current) : '');
  }, [editMode, onCellClick, overrides]);

  const commitEdit = useCallback(() => {
    if (!activeEdit) return;
    const key = `${activeEdit.row}:${activeEdit.col}`;
    const trimmed = editValue.trim();

    if (trimmed === '') {
      // Apaga override (volta ao valor OCR)
      setOverrides(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num >= 1 && num <= 27) {
        setOverrides(prev => ({ ...prev, [key]: num }));
      }
    }
    setActiveEdit(null);
    setEditValue('');
  }, [activeEdit, editValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      commitEdit();
      // Avança para próxima célula na mesma linha
      if (activeEdit) {
        const nextCol = activeEdit.col + 1;
        if (nextCol < grid.cols) {
          const nextCell = cellMap.get(`${activeEdit.row}:${nextCol}`);
          if (nextCell) {
            setActiveEdit({ row: activeEdit.row, col: nextCol });
            const nextKey = `${activeEdit.row}:${nextCol}`;
            const cur = nextKey in overrides ? overrides[nextKey] : nextCell.number;
            setEditValue(cur !== null ? String(cur) : '');
            setTimeout(() => editInputRef.current?.focus(), 10);
          }
        }
      }
    } else if (e.key === 'Escape') {
      setActiveEdit(null);
      setEditValue('');
    } else if (e.key === 'ArrowDown' && activeEdit) {
      e.preventDefault();
      commitEdit();
      const nextRow = activeEdit.row + 1;
      if (nextRow < grid.rows) {
        const nextCell = cellMap.get(`${nextRow}:${activeEdit.col}`);
        if (nextCell) {
          setActiveEdit({ row: nextRow, col: activeEdit.col });
          const key = `${nextRow}:${activeEdit.col}`;
          const cur = key in overrides ? overrides[key] : nextCell.number;
          setEditValue(cur !== null ? String(cur) : '');
          setTimeout(() => editInputRef.current?.focus(), 10);
        }
      }
    } else if (e.key === 'ArrowUp' && activeEdit) {
      e.preventDefault();
      commitEdit();
      const prevRow = activeEdit.row - 1;
      if (prevRow >= 0) {
        const prevCell = cellMap.get(`${prevRow}:${activeEdit.col}`);
        if (prevCell) {
          setActiveEdit({ row: prevRow, col: activeEdit.col });
          const key = `${prevRow}:${activeEdit.col}`;
          const cur = key in overrides ? overrides[key] : prevCell.number;
          setEditValue(cur !== null ? String(cur) : '');
          setTimeout(() => editInputRef.current?.focus(), 10);
        }
      }
    }
  }, [activeEdit, commitEdit, cellMap, grid.cols, grid.rows, overrides]);

  // ── Exports ───────────────────────────────────────────────────────────────

  const handleExportDiagnostic = () => {
    const data = buildDiagnosticExport(cellNumbers, grid, overrides);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cnr-diagnostic-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportGroundTruth = () => {
    const data = buildGroundTruthExport(cellNumbers, grid, overrides, puzzleId);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${puzzleId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Layout da grade ───────────────────────────────────────────────────────

  const rowCount = grid.rows;
  const colCount = grid.cols - 1;
  const CELL_W = 52;
  const CELL_H = 36;

  return (
    <div className="font-sans text-sm">
      {/* Cabeçalho de estatísticas */}
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <Stat label="Reconhecidas" value={`${recognized}/${total}`} color="text-green-800" bg="bg-green-100" />
        <Stat
          label="Cobertura"
          value={`${coverage}%`}
          color={Number(coverage) >= 70 ? 'text-green-800' : Number(coverage) >= 50 ? 'text-yellow-800' : 'text-red-800'}
          bg={Number(coverage) >= 70 ? 'bg-green-100' : Number(coverage) >= 50 ? 'bg-yellow-100' : 'bg-red-100'}
        />
        <Stat
          label="Precisão real"
          value={`${trueAccuracy}%`}
          color={Number(trueAccuracy) >= 90 ? 'text-green-800' : Number(trueAccuracy) >= 70 ? 'text-yellow-800' : 'text-red-800'}
          bg={Number(trueAccuracy) >= 90 ? 'bg-green-100' : Number(trueAccuracy) >= 70 ? 'bg-yellow-100' : 'bg-red-100'}
        />
        {invalidCells.length > 0 && (
          <Stat label="Inválidos (>26)" value={String(invalidCells.length)} color="text-red-800" bg="bg-red-100" />
        )}
        <Stat label="Símbolos únicos" value={String(uniqueCount)} color="text-blue-800" bg="bg-blue-100" />
        {overrideCount > 0 && (
          <Stat label="Corrigidas" value={String(overrideCount)} color="text-blue-800" bg="bg-blue-100" />
        )}

        {/* Legenda */}
        <div className="flex gap-2.5 flex-wrap ml-auto">
          <LegendDot color="#bbf7d0" textColor="#166534" label="conf ≥ 80%" />
          <LegendDot color="#fef08a" textColor="#854d0e" label="conf ≥ 50%" />
          <LegendDot color="#fecaca" textColor="#991b1b" label="conf < 50%" />
          <LegendDot color="#d1d5db" textColor="#6b7280" label="não lida" />
          {editMode && <LegendDot color="#bfdbfe" textColor="#1d4ed8" label="corrigida" />}
        </div>

        {/* Botões */}
        <div className="flex gap-2 flex-wrap">
          {/* Toggle modo de edição */}
          <button
            className={`px-3.5 py-1.5 border rounded-md text-xs cursor-pointer font-semibold whitespace-nowrap flex-shrink-0 transition-colors flex items-center gap-1.5 ${
              editMode
                ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
                : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
            }`}
            onClick={() => {
              setEditMode(v => !v);
              setActiveEdit(null);
              setEditValue('');
            }}
            title={editMode ? 'Sair do modo de edição' : 'Entrar no modo de edição para corrigir células'}
          >
            <Pencil size={13} />
            {editMode ? 'Editando…' : 'Editar células'}
          </button>

          {/* Export Ground Truth — só aparece em modo de edição ou se há overrides */}
          {(editMode || overrideCount > 0) && (
            <button
              className="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-md text-xs cursor-pointer font-semibold whitespace-nowrap flex-shrink-0 hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
              onClick={handleExportGroundTruth}
              title={`Exporta ${puzzleId}.json com os valores corrigidos`}
            >
              <CheckCircle2 size={13} />Exportar Ground Truth
            </button>
          )}

          {/* Export Diagnóstico */}
          <button
            className="px-3.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-xs cursor-pointer font-semibold whitespace-nowrap flex-shrink-0 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
            onClick={handleExportDiagnostic}
            title="Exporta JSON compacto para análise"
          >
            <Download size={13} />Exportar diagnóstico
          </button>
        </div>
      </div>

      {/* Instrução do modo de edição */}
      {editMode && (
        <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-center gap-2">
          <Pencil size={12} className="flex-shrink-0" />
          <span>
            Clique em qualquer célula para corrigir o valor OCR. Digite 1–27 e pressione{' '}
            <kbd className="px-1 py-0.5 rounded bg-white border border-blue-300 font-mono">Enter</kbd> ou{' '}
            <kbd className="px-1 py-0.5 rounded bg-white border border-blue-300 font-mono">Tab</kbd> para avançar.
            Deixe vazio e confirme para remover a correção.{' '}
            <kbd className="px-1 py-0.5 rounded bg-white border border-blue-300 font-mono">↑↓</kbd> muda de linha.
          </span>
        </div>
      )}

      {/* Layout: side-by-side ou top */}
      <div className={backgroundImage && imagePosition === 'side' ? 'flex gap-4 items-start' : ''}>

        {/* Imagem de fundo — top ou lado esquerdo sticky */}
        {backgroundImage && (
          <div className={
            imagePosition === 'side'
              ? 'shrink-0 w-72 sticky top-4 self-start'
              : 'mb-3'
          }>
            <canvas
              ref={bgCanvasRef}
              className="w-full border border-gray-200 rounded-input"
            />
            {imagePosition === 'side' && (
              <p className="text-xs text-center text-gray-400 mt-1.5">
                Imagem original — use como referência
              </p>
            )}
          </div>
        )}

        {/* Grade */}
        <div className="overflow-x-auto flex-1 min-w-0">
        <div
          className="grid gap-0.5 w-fit"
          style={{
            gridTemplateColumns: `repeat(${colCount}, ${CELL_W}px)`,
            gridTemplateRows: `repeat(${rowCount}, ${CELL_H}px)`,
          }}
        >
          {Array.from({ length: rowCount }, (_, row) =>
            Array.from({ length: colCount }, (_, colOffset) => {
              const col = colOffset + 1;
              const cell = cellMap.get(`${row}:${col}`);
              const key = `${row}:${col}`;
              const overridden = key in overrides;
              const displayNum = overridden ? overrides[key] : cell?.number ?? null;
              const isActive = activeEdit?.row === row && activeEdit?.col === col;
              const bg = cell ? confidenceColor(cell, overridden) : '#f3f4f6';
              const textColor = cell ? confidenceTextColor(cell, overridden) : '#9ca3af';

              return (
                <div
                  key={key}
                  className={`relative flex flex-col items-center justify-center rounded-sm border transition-[filter] duration-100 select-none ${
                    editMode
                      ? 'cursor-text hover:brightness-90 border-black/15'
                      : cell ? 'cursor-pointer hover:brightness-95 border-black/8' : 'border-black/8'
                  } ${isActive ? 'ring-2 ring-blue-500 ring-offset-0 z-10' : ''}`}
                  style={{ background: bg, color: textColor }}
                  onClick={() => cell && handleCellClick(cell)}
                  onMouseEnter={(e) => !editMode && cell && setTooltip({ cell, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setTooltip(null)}
                  onMouseMove={(e) => !editMode && tooltip && setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                >
                  {isActive ? (
                    // Input inline de edição
                    <input
                      ref={editInputRef}
                      type="text"
                      inputMode="numeric"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={commitEdit}
                      maxLength={2}
                      className="w-full h-full text-center font-bold text-sm bg-white text-blue-700 border-none outline-none rounded-sm"
                      style={{ fontSize: 14 }}
                    />
                  ) : (
                    <>
                      <span className="text-sm font-bold leading-none">
                        {displayNum ?? '–'}
                      </span>
                      {cell && cell.number !== null && cell.number > MAX_VALID_NUMBER && !overridden && (
                        <span className="text-xs leading-none"><AlertTriangle size={12} /></span>
                      )}
                      {overridden && (
                        <span className="absolute top-0.5 right-0.5">
                          <Pencil size={8} className="text-blue-400" />
                        </span>
                      )}
                      <span className="text-xs opacity-75 mt-0.5">
                        {overridden ? '✓' : cell ? `${(cell.confidence * 100).toFixed(0)}%` : ''}
                      </span>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
        </div>{/* fim overflow-x-auto */}
      </div>{/* fim layout wrapper */}

      {/* Tooltip de hover (só fora do modo de edição) */}
      {!editMode && tooltip && (
        <div
          className="fixed bg-gray-800 text-gray-50 rounded-input p-2 px-3 text-xs z-[9999] pointer-events-none min-w-45 shadow-lg"
          style={{ top: tooltip.y + 12, left: tooltip.x + 12 }}
        >
          <div className="flex gap-2 justify-between mb-0.75">
            <span className="text-gray-400 min-w-18">Posição</span>
            <span>({tooltip.cell.row}, {tooltip.cell.col})</span>
          </div>
          <div className="flex gap-2 justify-between mb-0.75">
            <span className="text-gray-400 min-w-18">Número</span>
            <strong className={
              tooltip.cell.number !== null && tooltip.cell.number > MAX_VALID_NUMBER
                ? 'text-error' : ''
            }>
              {tooltip.cell.number ?? 'não lido'}
              {tooltip.cell.number !== null && tooltip.cell.number > MAX_VALID_NUMBER && ' (inválido)'}
            </strong>
          </div>
          <div className="flex gap-2 justify-between mb-0.75">
            <span className="text-gray-400 min-w-18">Confiança</span>
            <span>{(tooltip.cell.confidence * 100).toFixed(1)}%</span>
          </div>
          <div className="flex gap-2 justify-between mb-0.75">
            <span className="text-gray-400 min-w-18">Raw OCR</span>
            <code className="bg-gray-700 rounded-sm px-1 font-mono text-xs">"{tooltip.cell.rawOcr}"</code>
          </div>
          <div className="flex gap-2 justify-between">
            <span className="text-gray-400 min-w-18">Sanitizado</span>
            <code className="bg-gray-700 rounded-sm px-1 font-mono text-xs">"{tooltip.cell.rawText}"</code>
          </div>
        </div>
      )}

      {/* Mapa símbolo → posições */}
      <details className="mt-4 border border-gray-200 rounded-input">
        <summary className="px-3.5 py-2.5 cursor-pointer font-semibold text-gray-700 text-sm">
          Mapa símbolo → posições ({uniqueCount} símbolos)
        </summary>
        <div className="px-3.5 py-2 pb-3 flex flex-col gap-1 max-h-80 overflow-y-auto">
          {Object.keys(cellNumbers.bySymbol)
            .sort((a, b) => Number(a) - Number(b))
            .map(num => {
              const positions = cellNumbers.bySymbol[num];
              return (
                <div key={num} className="flex items-center gap-2 text-xs">
                  <span className="bg-blue-50 text-blue-700 rounded-sm px-2 py-0.5 font-bold min-w-8 text-center">{num}</span>
                  <span className="text-ink-muted min-w-6">{positions.length}×</span>
                  <span className="text-gray-700 font-mono text-xs flex-wrap break-all">
                    {positions.map(p => `(${p.row},${p.col})`).join(' ')}
                  </span>
                </div>
              );
            })}
        </div>
      </details>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Stat({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div className={`flex flex-col items-center px-3.5 py-1.5 rounded-input min-w-20 ${bg}`}>
      <span className={`text-xl font-bold leading-tight ${color}`}>{value}</span>
      <span className={`text-xs font-medium uppercase tracking-wide mt-0.5 ${color}`}>{label}</span>
    </div>
  );
}

function LegendDot({ color, textColor, label }: { color: string; textColor: string; label: string }) {
  return (
    <div className="flex items-center gap-1.25">
      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: color, border: `1px solid ${textColor}33` }} />
      <span className="text-xs text-ink-muted">{label}</span>
    </div>
  );
}
