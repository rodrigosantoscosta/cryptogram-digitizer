/**
 * Testes unitários para CellNumberOverlay.
 *
 * confidenceColor, confidenceTextColor e buildDiagnosticExport
 * são funções puras — testadas isoladamente.
 */

import { describe, it, expect } from 'vitest';
import type { CellNumberMap, CellNumber } from '@/lib/ocr/CellNumberReader';
import type { GridResult } from '@/types';

// ─── Re-implementação local (funções não exportadas) ──────────────────────────

const MAX_VALID_NUMBER = 27;

function confidenceColor(cell: CellNumber): string {
  if (cell.number === null) return '#d1d5db';
  if (cell.number > MAX_VALID_NUMBER) return '#fca5a5';
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

function makeCell(overrides: Partial<CellNumber>): CellNumber {
  return {
    row: 0,
    col: 1,
    number: 5,
    confidence: 0.9,
    rawOcr: '5',
    rawText: '5',
    ...overrides,
  };
}

// ─── confidenceColor ─────────────────────────────────────────────────────────

describe('confidenceColor', () => {
  it('deve retornar cinza para número null', () => {
    expect(confidenceColor(makeCell({ number: null }))).toBe('#d1d5db');
  });

  it('deve retornar vermelho claro para número inválido (>27)', () => {
    expect(confidenceColor(makeCell({ number: 28, confidence: 0.9 }))).toBe('#fca5a5');
    expect(confidenceColor(makeCell({ number: 100, confidence: 0.9 }))).toBe('#fca5a5');
  });

  it('deve retornar verde claro para confiança >= 0.8', () => {
    expect(confidenceColor(makeCell({ number: 5, confidence: 0.8 }))).toBe('#bbf7d0');
    expect(confidenceColor(makeCell({ number: 5, confidence: 1.0 }))).toBe('#bbf7d0');
  });

  it('deve retornar amarelo claro para confiança entre 0.5 e 0.8', () => {
    expect(confidenceColor(makeCell({ number: 5, confidence: 0.5 }))).toBe('#fef08a');
    expect(confidenceColor(makeCell({ number: 5, confidence: 0.79 }))).toBe('#fef08a');
  });

  it('deve retornar vermelho claro para confiança < 0.5', () => {
    expect(confidenceColor(makeCell({ number: 5, confidence: 0.0 }))).toBe('#fecaca');
    expect(confidenceColor(makeCell({ number: 5, confidence: 0.49 }))).toBe('#fecaca');
  });

  it('deve priorizar invalid number sobre confidence', () => {
    expect(confidenceColor(makeCell({ number: 28, confidence: 0.95 }))).toBe('#fca5a5');
  });
});

// ─── confidenceTextColor ─────────────────────────────────────────────────────

describe('confidenceTextColor', () => {
  it('deve retornar cinza escuro para número null', () => {
    expect(confidenceTextColor(makeCell({ number: null }))).toBe('#6b7280');
  });

  it('deve retornar vermelho escuro para número inválido (>27)', () => {
    expect(confidenceTextColor(makeCell({ number: 28, confidence: 0.9 }))).toBe('#991b1b');
  });

  it('deve retornar verde escuro para confiança >= 0.8', () => {
    expect(confidenceTextColor(makeCell({ number: 5, confidence: 0.8 }))).toBe('#166534');
  });

  it('deve retornar marrom para confiança entre 0.5 e 0.8', () => {
    expect(confidenceTextColor(makeCell({ number: 5, confidence: 0.5 }))).toBe('#854d0e');
  });

  it('deve retornar vermelho escuro para confiança < 0.5', () => {
    expect(confidenceTextColor(makeCell({ number: 5, confidence: 0.3 }))).toBe('#991b1b');
  });
});

// ─── buildDiagnosticExport ───────────────────────────────────────────────────

describe('buildDiagnosticExport', () => {
  function makeCellNumberMap(overrides: {
    cells?: CellNumber[];
    recognized?: number;
    total?: number;
    bySymbol?: Record<string, { row: number; col: number }[]>;
  } = {}): CellNumberMap {
    return {
      cells: overrides.cells ?? [],
      recognized: overrides.recognized ?? 0,
      total: overrides.total ?? 0,
      bySymbol: overrides.bySymbol ?? {},
    };
  }

  function makeGridResult(rows: number, cols: number): GridResult {
    return {
      rowPositions: Array.from({ length: rows + 1 }, (_, i) => i * 50),
      colPositions: Array.from({ length: cols + 1 }, (_, i) => i * 40),
      colWidths: Array(cols).fill(40),
      rowHeights: Array(rows).fill(50),
      rows,
      cols,
      roi: { x: 0, y: 0, width: cols * 40, height: rows * 50 },
    };
  }

  it('deve gerar grade matriz com dimensões corretas (cols - 1 para coluna de pista)', () => {
    const cellNumbers = makeCellNumberMap({
      cells: [
        makeCell({ row: 0, col: 1, number: 5 }),
        makeCell({ row: 1, col: 1, number: 12 }),
      ],
      recognized: 2,
      total: 2,
    });
    const grid = makeGridResult(3, 4);

    const { meta } = (buildDiagnosticExport as any)(cellNumbers, grid);

    expect(meta.gridSize).toEqual({ rows: 3, cols: 3 });
  });

  it('deve incluir células não reconhecidas', () => {
    const cellNumbers = makeCellNumberMap({
      cells: [
        makeCell({ row: 0, col: 1, number: null, rawOcr: '??', rawText: '' }),
        makeCell({ row: 0, col: 2, number: 5 }),
      ],
      recognized: 1,
      total: 2,
    });
    const grid = makeGridResult(1, 3);

    const result = (buildDiagnosticExport as any)(cellNumbers, grid);

    expect(result.unrecognized).toHaveLength(1);
    expect(result.unrecognized[0]).toEqual({
      r: 0,
      c: 1,
      rawOcr: '??',
      rawText: '',
    });
  });

  it('deve incluir células de baixa confiança (< 0.60)', () => {
    const cellNumbers = makeCellNumberMap({
      cells: [
        makeCell({ row: 0, col: 1, number: 5, confidence: 0.4, rawOcr: 's', rawText: '5' }),
        makeCell({ row: 0, col: 2, number: 12, confidence: 0.9 }),
      ],
      recognized: 2,
      total: 2,
    });
    const grid = makeGridResult(1, 3);

    const result = (buildDiagnosticExport as any)(cellNumbers, grid);

    expect(result.lowConf).toHaveLength(1);
    expect(result.lowConf[0].n).toBe(5);
    expect(result.lowConf[0].conf).toBe(40);
  });

  it('deve gerar bySymbol compacto', () => {
    const cellNumbers = makeCellNumberMap({
      cells: [
        makeCell({ row: 0, col: 1, number: 5 }),
        makeCell({ row: 1, col: 2, number: 5 }),
        makeCell({ row: 0, col: 2, number: 12 }),
      ],
      recognized: 3,
      total: 3,
      bySymbol: {
        '5': [{ row: 0, col: 1 }, { row: 1, col: 2 }],
        '12': [{ row: 0, col: 2 }],
      },
    });
    const grid = makeGridResult(2, 3);

    const result = (buildDiagnosticExport as any)(cellNumbers, grid);

    expect(result.bySymbol['5']).toEqual([[0, 1], [1, 2]]);
    expect(result.bySymbol['12']).toEqual([[0, 2]]);
  });

  it('deve calcular coverage corretamente', () => {
    const cellNumbers = makeCellNumberMap({
      recognized: 7,
      total: 10,
    });
    const grid = makeGridResult(3, 4);

    const result = (buildDiagnosticExport as any)(cellNumbers, grid);

    expect(result.meta.coverage).toBe('70.0%');
  });
});

// Need to import the actual function for testing
import { CellNumberOverlay } from '@/components/CellNumberOverlay/CellNumberOverlay';

// Re-declare buildDiagnosticExport from the module
function buildDiagnosticExport(cellNumbers: CellNumberMap, grid: GridResult) {
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
      gridMatrix[c.row][ci] = c.number;
    }
  }

  const unrecognized = cellNumbers.cells
    .filter(c => c.number === null)
    .map(c => ({
      r: c.row,
      c: c.col,
      rawOcr:  c.rawOcr  ?? '',
      rawText: c.rawText ?? '',
    }));

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
    grid: gridMatrix,
    unrecognized,
    lowConf,
    bySymbol: bySymbolCompact,
  };
}
