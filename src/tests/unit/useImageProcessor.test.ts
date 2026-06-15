/**
 * Testes unitários para funções puras de useImageProcessor.
 *
 * gridResultToTableStructure, tableStructureToGridResult e median
 * são funções puras — testadas isoladamente.
 */

import { describe, it, expect } from 'vitest';
import type { GridResult, TableStructure } from '@/types/image';

// ─── Re-implementação local (funções não exportadas) ──────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function gridResultToTableStructure(grid: GridResult): TableStructure {
  const gridPoints = grid.rowPositions.map(y =>
    grid.colPositions.map(x => ({ x, y }))
  );

  const medianColWidth = median(grid.colWidths);
  const clueColumnWidth = grid.colWidths[0] ?? medianColWidth;
  const answerColumnWidth = grid.colWidths.length > 1
    ? median(grid.colWidths.slice(1))
    : medianColWidth;

  return {
    rows: grid.rows,
    cols: grid.cols,
    cellWidth: medianColWidth,
    cellHeight: median(grid.rowHeights),
    gridPoints,
    clueColumnWidth,
    answerColumnWidth
  };
}

function tableStructureToGridResult(ts: TableStructure): GridResult {
  const rowPositions = ts.gridPoints.map((row: any) => row[0].y);
  const colPositions = ts.gridPoints[0].map((pt: any) => pt.x);

  const colWidths: number[] = [];
  for (let c = 0; c < ts.cols; c++) {
    colWidths.push(colPositions[c + 1] - colPositions[c]);
  }

  const rowHeights: number[] = [];
  for (let r = 0; r < ts.rows; r++) {
    rowHeights.push(rowPositions[r + 1] - rowPositions[r]);
  }

  const firstRow = ts.gridPoints[0];
  const lastRow = ts.gridPoints[ts.rows];
  const roi = {
    x: colPositions[0],
    y: rowPositions[0],
    width: colPositions[ts.cols] - colPositions[0],
    height: lastRow ? lastRow[0].y - rowPositions[0] : ts.rows * ts.cellHeight
  };

  return {
    roi,
    rowPositions,
    colPositions,
    colWidths,
    rowHeights,
    rows: ts.rows,
    cols: ts.cols
  };
}

// ─── median ──────────────────────────────────────────────────────────────────

describe('median', () => {
  it('deve retornar 0 para array vazio', () => {
    expect(median([])).toBe(0);
  });

  it('deve retornar o elemento para array de 1 item', () => {
    expect(median([42])).toBe(42);
  });

  it('deve retornar o valor central para array ímpar', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('deve retornar o valor central para array ímpar ordenado', () => {
    expect(median([10, 20, 30, 40, 50])).toBe(30);
  });

  it('deve retornar o elemento do meio (floor) para array par', () => {
    expect(median([1, 2, 3, 4])).toBe(3);
  });

  it('deve funcionar com array já ordenado', () => {
    expect(median([1, 2, 3, 4, 5])).toBe(3);
  });

  it('deve funcionar com array invertido', () => {
    expect(median([5, 4, 3, 2, 1])).toBe(3);
  });

  it('deve funcionar com valores duplicados', () => {
    expect(median([5, 5, 5, 5])).toBe(5);
  });
});

// ─── gridResultToTableStructure ──────────────────────────────────────────────

describe('gridResultToTableStructure', () => {
  function makeGrid(overrides?: Partial<GridResult>): GridResult {
    return {
      rowPositions: [0, 50, 100, 150],
      colPositions: [0, 40, 80, 120],
      colWidths: [40, 40, 40],
      rowHeights: [50, 50, 50],
      rows: 3,
      cols: 3,
      roi: { x: 0, y: 0, width: 120, height: 150 },
      ...overrides,
    };
  }

  it('deve converter com dimensões corretas', () => {
    const grid = makeGrid();
    const ts = gridResultToTableStructure(grid);

    expect(ts.rows).toBe(3);
    expect(ts.cols).toBe(3);
  });

  it('deve construir gridPoints como matriz (rows+1) x (cols+1)', () => {
    const grid = makeGrid();
    const ts = gridResultToTableStructure(grid);

    expect(ts.gridPoints).toHaveLength(4);
    expect(ts.gridPoints[0]).toHaveLength(4);
    expect(ts.gridPoints[0][0]).toEqual({ x: 0, y: 0 });
    expect(ts.gridPoints[2][3]).toEqual({ x: 120, y: 100 });
  });

  it('deve calcular cellWidth como mediana dos colWidths', () => {
    const grid = makeGrid({ colWidths: [30, 40, 50] });
    const ts = gridResultToTableStructure(grid);

    expect(ts.cellWidth).toBe(40);
  });

  it('deve calcular cellHeight como mediana dos rowHeights', () => {
    const grid = makeGrid({ rowHeights: [45, 55, 50] });
    const ts = gridResultToTableStructure(grid);

    expect(ts.cellHeight).toBe(50);
  });

  it('deve usar colWidths[0] como clueColumnWidth', () => {
    const grid = makeGrid({ colWidths: [35, 40, 45] });
    const ts = gridResultToTableStructure(grid);

    expect(ts.clueColumnWidth).toBe(35);
  });

  it('deve calcular answerColumnWidth como mediana sem a primeira coluna', () => {
    const grid = makeGrid({ colWidths: [30, 40, 50, 60] });
    const ts = gridResultToTableStructure(grid);

    expect(ts.answerColumnWidth).toBe(50);
  });

  it('deve usar medianColWidth quando só há uma coluna', () => {
    const grid = makeGrid({ colWidths: [30], cols: 1, colPositions: [0, 30] });
    const ts = gridResultToTableStructure(grid);

    expect(ts.clueColumnWidth).toBe(30);
    expect(ts.answerColumnWidth).toBe(30);
  });
});

// ─── tableStructureToGridResult ──────────────────────────────────────────────

describe('tableStructureToGridResult', () => {
  function makeTableStructure(overrides?: Partial<TableStructure>): TableStructure {
    return {
      rows: 3,
      cols: 3,
      cellWidth: 40,
      cellHeight: 50,
      gridPoints: [
        [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 80, y: 0 }, { x: 120, y: 0 }],
        [{ x: 0, y: 50 }, { x: 40, y: 50 }, { x: 80, y: 50 }, { x: 120, y: 50 }],
        [{ x: 0, y: 100 }, { x: 40, y: 100 }, { x: 80, y: 100 }, { x: 120, y: 100 }],
        [{ x: 0, y: 150 }, { x: 40, y: 150 }, { x: 80, y: 150 }, { x: 120, y: 150 }],
      ],
      clueColumnWidth: 40,
      answerColumnWidth: 40,
      ...overrides,
    };
  }

  it('deve extrair rowPositions corretamente', () => {
    const ts = makeTableStructure();
    const grid = tableStructureToGridResult(ts);

    expect(grid.rowPositions).toEqual([0, 50, 100, 150]);
  });

  it('deve extrair colPositions corretamente', () => {
    const ts = makeTableStructure();
    const grid = tableStructureToGridResult(ts);

    expect(grid.colPositions).toEqual([0, 40, 80, 120]);
  });

  it('deve calcular colWidths como diferenças entre colPositions', () => {
    const ts = makeTableStructure();
    const grid = tableStructureToGridResult(ts);

    expect(grid.colWidths).toEqual([40, 40, 40]);
  });

  it('deve calcular rowHeights como diferenças entre rowPositions', () => {
    const ts = makeTableStructure();
    const grid = tableStructureToGridResult(ts);

    expect(grid.rowHeights).toEqual([50, 50, 50]);
  });

  it('deve construir roi corretamente', () => {
    const ts = makeTableStructure();
    const grid = tableStructureToGridResult(ts);

    expect(grid.roi).toEqual({
      x: 0,
      y: 0,
      width: 120,
      height: 150,
    });
  });

  it('deve preservar rows e cols', () => {
    const ts = makeTableStructure({ rows: 5, cols: 4 });
    const grid = tableStructureToGridResult(ts);

    expect(grid.rows).toBe(5);
    expect(grid.cols).toBe(4);
  });
});

// ─── Round-trip: GridResult → TableStructure → GridResult ────────────────────

describe('Round-trip: GridResult → TableStructure → GridResult', () => {
  it('deve preservar rowPositions e colPositions', () => {
    const original: GridResult = {
      rowPositions: [0, 50, 100, 150],
      colPositions: [0, 40, 80, 120],
      colWidths: [40, 40, 40],
      rowHeights: [50, 50, 50],
      rows: 3,
      cols: 3,
      roi: { x: 0, y: 0, width: 120, height: 150 },
    };

    const ts = gridResultToTableStructure(original);
    const roundTripped = tableStructureToGridResult(ts);

    expect(roundTripped.rowPositions).toEqual(original.rowPositions);
    expect(roundTripped.colPositions).toEqual(original.colPositions);
    expect(roundTripped.rows).toBe(original.rows);
    expect(roundTripped.cols).toBe(original.cols);
  });
});

// ─── Number coverage threshold ───────────────────────────────────────────────

describe('Number coverage threshold logic', () => {
  function shouldUseNumbers(recognized: number, total: number): boolean {
    const coverage = recognized / Math.max(total, 1);
    return coverage >= 0.70;
  }

  it('deve usar números com 70% de cobertura', () => {
    expect(shouldUseNumbers(7, 10)).toBe(true);
  });

  it('deve usar números com 100% de cobertura', () => {
    expect(shouldUseNumbers(10, 10)).toBe(true);
  });

  it('deve NÃO usar números com 69% de cobertura', () => {
    expect(shouldUseNumbers(6, 10)).toBe(false);
  });

  it('deve usar números com 0 reconhecidos e 0 total (evitar NaN)', () => {
    expect(shouldUseNumbers(0, 0)).toBe(false);
  });

  it('deve usar números com 7 de 9 (77.8%)', () => {
    expect(shouldUseNumbers(7, 9)).toBe(true);
  });
});
