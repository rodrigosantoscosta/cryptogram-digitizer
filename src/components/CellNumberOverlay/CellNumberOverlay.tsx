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
 *   (células não reconhecidas, baixa confiança, bySymbol, rawOcr por célula)
 */

import { useRef, useEffect, useState } from 'react';
import type { CellNumberMap, CellNumber } from '@/lib/ocr/CellNumberReader';
import type { GridResult } from '@/types';

interface Props {
  cellNumbers: CellNumberMap;
  grid: GridResult;
  /** ImageData original para renderizar como fundo (opcional) */
  backgroundImage?: ImageData;
  /** Callback quando o usuário clica numa célula */
  onCellClick?: (cell: CellNumber) => void;
}

const MAX_VALID_NUMBER = 27; // Includes special value 27 for Brazilian Portuguese cryptograms

function confidenceColor(cell: CellNumber): string {
  if (cell.number === null) return '#d1d5db';
  if (cell.number > MAX_VALID_NUMBER) return '#fca5a5'; // Red for invalid (>27)
  if (cell.confidence >= 0.8)  return '#bbf7d0';
  if (cell.confidence >= 0.5)  return '#fef08a';
  return '#fecaca';
}

function confidenceTextColor(cell: CellNumber): string {
  if (cell.number === null) return '#6b7280';
  if (cell.number > MAX_VALID_NUMBER) return '#991b1b';
  if (cell.confidence >= 0.8)  return '#166534';
  if (cell.confidence >= 0.5)  return '#854d0e';
  return '#991b1b';
}

// ─── Export de diagnóstico ────────────────────────────────────────────────────

/**
 * Gera um objeto JSON compacto com os dados relevantes para análise de falhas
 * do CellNumberReader. Projetado para ser token-eficiente:
 *
 * - Só inclui células problemáticas (null ou confiança < LOW_CONF_THRESHOLD)
 * - bySymbol em formato compacto: "num": [[row,col],...]
 * - grade resumida: matriz rows×cols com o número lido (null = não lido)
 * - Fix 4: rawOcr (saída literal do Tesseract) incluído nas células problemáticas
 */
function buildDiagnosticExport(cellNumbers: CellNumberMap, grid: GridResult) {
  const LOW_CONF = 0.60;
  const colStart = 1;
  const rows = grid.rows;
  const cols = grid.cols - colStart;

  // Grade resumida rows×cols: null ou número lido
  const gridMatrix: (number | null)[][] = Array.from({ length: rows }, () =>
    new Array(cols).fill(null)
  );
  for (const c of cellNumbers.cells) {
    const ci = c.col - colStart;
    if (c.row >= 0 && c.row < rows && ci >= 0 && ci < cols) {
      gridMatrix[c.row][ci] = c.number;
    }
  }

  // Células não reconhecidas — inclui rawOcr (literal Tesseract) e rawText (pós-sanitização)
  const unrecognized = cellNumbers.cells
    .filter(c => c.number === null)
    .map(c => ({
      r: c.row,
      c: c.col,
      rawOcr:  c.rawOcr  ?? '',   // saída literal do Tesseract antes de sanitizeDigits
      rawText: c.rawText ?? '',   // após sanitizeDigits
    }));

  // Células de baixa confiança (reconhecidas mas duvidosas)
  const lowConf = cellNumbers.cells
    .filter(c => c.number !== null && c.confidence < LOW_CONF)
    .map(c => ({
      r: c.row,
      c: c.col,
      n: c.number,
      conf: Math.round(c.confidence * 100),
      rawOcr:  c.rawOcr  ?? '',
      rawText: c.rawText ?? '',
    }));

  // bySymbol compacto: {"1": [[0,1],[2,3]], ...}
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
      exportedAt: new Date().toISOString(),
    },
    // Matriz compacta: cada linha é um array de números (null = não lido)
    grid: gridMatrix,
    // Apenas células problemáticas
    unrecognized,
    lowConf,
    bySymbol: bySymbolCompact,
  };
}

export function CellNumberOverlay({ cellNumbers, grid, backgroundImage, onCellClick }: Props) {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<{ cell: CellNumber; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!backgroundImage || !bgCanvasRef.current) return;
    const ctx = bgCanvasRef.current.getContext('2d');
    if (!ctx) return;
    bgCanvasRef.current.width = backgroundImage.width;
    bgCanvasRef.current.height = backgroundImage.height;
    ctx.putImageData(backgroundImage, 0, 0);
  }, [backgroundImage]);

  const cellMap = new Map<string, CellNumber>();
  for (const c of cellNumbers.cells) {
    cellMap.set(`${c.row}:${c.col}`, c);
  }

  const { recognized, total } = cellNumbers;
  const coverage = total > 0 ? ((recognized / total) * 100).toFixed(0) : '0';
  const uniqueCount = Object.keys(cellNumbers.bySymbol).length;

  // Calculate true accuracy (excluding invalid values > 26)
  const MAX_VALID_NUMBER = 26;
  const invalidCells = cellNumbers.cells.filter(c => c.number !== null && c.number > MAX_VALID_NUMBER);
  const lowConfCells = cellNumbers.cells.filter(c => c.number !== null && c.confidence < 0.60);
  const trulyValid = cellNumbers.cells.filter(c => 
    c.number !== null && c.number <= MAX_VALID_NUMBER && c.confidence >= 0.60
  ).length;
  const trueAccuracy = total > 0 ? ((trulyValid / total) * 100).toFixed(0) : '0';

  const rowCount = grid.rows;
  const colCount = grid.cols - 1;
  const CELL_W = 52;
  const CELL_H = 36;

  const handleExportDiagnostic = () => {
    const data = buildDiagnosticExport(cellNumbers, grid);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `cnr-diagnostic-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={s.root}>
      {/* Cabeçalho de estatísticas + botão export */}
      <div style={s.statsBar}>
        <Stat label="Reconhecidas" value={`${recognized}/${total}`} color="#166534" bg="#bbf7d0" />
        <Stat
          label="Cobertura"
          value={`${coverage}%`}
          color={Number(coverage) >= 70 ? '#166534' : Number(coverage) >= 50 ? '#854d0e' : '#991b1b'}
          bg={Number(coverage) >= 70 ? '#bbf7d0' : Number(coverage) >= 50 ? '#fef08a' : '#fecaca'}
        />
        <Stat
          label="Precisão real"
          value={`${trueAccuracy}%`}
          color={Number(trueAccuracy) >= 90 ? '#166534' : Number(trueAccuracy) >= 70 ? '#854d0e' : '#991b1b'}
          bg={Number(trueAccuracy) >= 90 ? '#bbf7d0' : Number(trueAccuracy) >= 70 ? '#fef08a' : '#fecaca'}
        />
        {invalidCells.length > 0 && (
          <Stat label="Inválidos (>26)" value={String(invalidCells.length)} color="#991b1b" bg="#fecaca" />
        )}
        <Stat label="Símbolos únicos" value={String(uniqueCount)} color="#1e40af" bg="#bfdbfe" />
        <div style={s.legend}>
          <LegendDot color="#bbf7d0" textColor="#166534" label="conf ≥ 80%" />
          <LegendDot color="#fef08a" textColor="#854d0e" label="conf ≥ 50%" />
          <LegendDot color="#fecaca" textColor="#991b1b" label="conf < 50%" />
          <LegendDot color="#d1d5db" textColor="#6b7280" label="não lida" />
        </div>
        <button style={s.exportBtn} onClick={handleExportDiagnostic} title="Exporta JSON compacto para análise">
          💾 Exportar diagnóstico
        </button>
      </div>

      {backgroundImage && (
        <div style={{ marginBottom: 12 }}>
          <canvas
            ref={bgCanvasRef}
            style={{ maxWidth: '100%', border: '1px solid #e5e7eb', borderRadius: 6 }}
          />
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${colCount}, ${CELL_W}px)`,
            gridTemplateRows: `repeat(${rowCount}, ${CELL_H}px)`,
            gap: 2,
            width: 'fit-content',
          }}
        >
          {Array.from({ length: rowCount }, (_, row) =>
            Array.from({ length: colCount }, (_, colOffset) => {
              const col = colOffset + 1;
              const cell = cellMap.get(`${row}:${col}`);
              const bg = cell ? confidenceColor(cell) : '#f3f4f6';
              const textColor = cell ? confidenceTextColor(cell) : '#9ca3af';

              return (
                <div
                  key={`${row}:${col}`}
                  style={{
                    ...s.cell,
                    background: bg,
                    color: textColor,
                    cursor: cell ? 'pointer' : 'default',
                  }}
                  onClick={() => cell && onCellClick?.(cell)}
                  onMouseEnter={(e) => cell && setTooltip({ cell, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setTooltip(null)}
                  onMouseMove={(e) => tooltip && setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                  title={cell
                    ? `(${row},${col}) → ${cell.number ?? '?'} | conf: ${(cell.confidence * 100).toFixed(0)}% | ocr: "${cell.rawOcr}" | sanitized: "${cell.rawText}"`
                    : `(${row},${col}) sem dado`}
                >
                  <span style={s.cellNum}>{cell?.number ?? '–'}</span>
                  {cell && cell.number !== null && cell.number > MAX_VALID_NUMBER && (
                    <span style={s.invalidBadge}>⚠️</span>
                  )}
                  <span style={s.cellConf}>{cell ? `${(cell.confidence * 100).toFixed(0)}%` : ''}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {tooltip && (
        <div style={{ ...s.tooltip, top: tooltip.y + 12, left: tooltip.x + 12 }}>
          <div style={s.tooltipRow}>
            <span style={s.tooltipLabel}>Posição</span>
            <span>({tooltip.cell.row}, {tooltip.cell.col})</span>
          </div>
          <div style={s.tooltipRow}>
            <span style={s.tooltipLabel}>Número</span>
            <strong style={
              tooltip.cell.number !== null && tooltip.cell.number > MAX_VALID_NUMBER
                ? { color: '#ef4444' }
                : {}
            }>
              {tooltip.cell.number ?? 'não lido'}
              {tooltip.cell.number !== null && tooltip.cell.number > MAX_VALID_NUMBER && ' (inválido)'}
            </strong>
          </div>
          <div style={s.tooltipRow}>
            <span style={s.tooltipLabel}>Confiança</span>
            <span>{(tooltip.cell.confidence * 100).toFixed(1)}%</span>
          </div>
          <div style={s.tooltipRow}>
            <span style={s.tooltipLabel}>Raw OCR</span>
            <code style={s.tooltipCode}>"{tooltip.cell.rawOcr}"</code>
          </div>
          <div style={s.tooltipRow}>
            <span style={s.tooltipLabel}>Sanitizado</span>
            <code style={s.tooltipCode}>"{tooltip.cell.rawText}"</code>
          </div>
        </div>
      )}

      <details style={s.details}>
        <summary style={s.summary}>Mapa símbolo → posições ({uniqueCount} símbolos)</summary>
        <div style={s.symbolTable}>
          {Object.keys(cellNumbers.bySymbol)
            .sort((a, b) => Number(a) - Number(b))
            .map(num => {
              const positions = cellNumbers.bySymbol[num];
              return (
                <div key={num} style={s.symbolRow}>
                  <span style={s.symbolBadge}>{num}</span>
                  <span style={s.symbolCount}>{positions.length}×</span>
                  <span style={s.symbolPositions}>
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

function Stat({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div style={{ ...s.statCard, background: bg }}>
      <span style={{ ...s.statValue, color }}>{value}</span>
      <span style={{ ...s.statLabel, color }}>{label}</span>
    </div>
  );
}

function LegendDot({ color, textColor, label }: { color: string; textColor: string; label: string }) {
  return (
    <div style={s.legendItem}>
      <div style={{ ...s.legendDot, background: color, border: `1px solid ${textColor}33` }} />
      <span style={{ fontSize: 11, color: '#6b7280' }}>{label}</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root:            { fontFamily: 'system-ui, sans-serif', fontSize: 13 },
  statsBar:        { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  statCard:        { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 14px', borderRadius: 8, minWidth: 80 },
  statValue:       { fontSize: 20, fontWeight: 700, lineHeight: 1.2 },
  statLabel:       { fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 },
  legend:          { display: 'flex', gap: 10, flexWrap: 'wrap', marginLeft: 'auto' },
  legendItem:      { display: 'flex', alignItems: 'center', gap: 5 },
  legendDot:       { width: 12, height: 12, borderRadius: 3, flexShrink: 0 },
  exportBtn:       { padding: '6px 14px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 },
  cell:            { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: '1px solid rgba(0,0,0,0.08)', transition: 'filter 0.1s', userSelect: 'none' },
  cellNum:         { fontSize: 15, fontWeight: 700, lineHeight: 1 },
  invalidBadge:    { fontSize: 10, lineHeight: 1 },
  cellConf:        { fontSize: 9, opacity: 0.75, marginTop: 1 },
  tooltip:         { position: 'fixed', background: '#1f2937', color: '#f9fafb', borderRadius: 8, padding: '8px 12px', fontSize: 12, zIndex: 9999, pointerEvents: 'none', minWidth: 180, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' },
  tooltipRow:      { display: 'flex', gap: 8, justifyContent: 'space-between', marginBottom: 3 },
  tooltipLabel:    { color: '#9ca3af', minWidth: 75 },
  tooltipCode:     { background: '#374151', borderRadius: 3, padding: '0 4px', fontFamily: 'monospace', fontSize: 11 },
  details:         { marginTop: 16, border: '1px solid #e5e7eb', borderRadius: 8 },
  summary:         { padding: '10px 14px', cursor: 'pointer', fontWeight: 600, color: '#374151', fontSize: 13 },
  symbolTable:     { padding: '8px 14px 12px', display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' },
  symbolRow:       { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 },
  symbolBadge:     { background: '#eff6ff', color: '#1d4ed8', borderRadius: 4, padding: '2px 8px', fontWeight: 700, minWidth: 32, textAlign: 'center' },
  symbolCount:     { color: '#6b7280', minWidth: 24 },
  symbolPositions: { color: '#374151', fontFamily: 'monospace', fontSize: 11, flexWrap: 'wrap', wordBreak: 'break-all' },
};
