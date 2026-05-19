/**
 * Testes unitários para usePuzzleSolver hook
 *
 * Testa a lógica de aplicação de mapping, atualização de células
 * e cálculo de progresso.
 */

import { describe, it, expect } from 'vitest';
import type { GridCell, SymbolMapping } from '@/types';
import { SymbolMapper } from '@/lib/image-processing/SymbolMapper';

// ─── Re-implementação da lógica do hook (sem React) ──────────────────────────

function applyMappingToGrid(grid: GridCell[][], mapping: SymbolMapping): GridCell[][] {
  return SymbolMapper.applyMappingToGrid(grid, mapping);
}

function calculateProgress(grid: GridCell[][]): number {
  let filled = 0;
  let total = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (!cell.isClue && cell.symbolId) {
        total++;
        if (cell.userValue) filled++;
      }
    }
  }
  return total > 0 ? (filled / total) * 100 : 0;
}

function updateCell(grid: GridCell[][], row: number, col: number, value: string): GridCell[][] {
  return grid.map((r, i) =>
    r.map((c, j) =>
      i === row && j === col ? { ...c, userValue: value.toUpperCase() } : c
    )
  );
}

function clearGrid(grid: GridCell[][]): GridCell[][] {
  return grid.map((row) =>
    row.map((cell) => ({
      ...cell,
      userValue: '',
      isError: false,
    }))
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cell(row: number, col: number, overrides: Partial<GridCell> = {}): GridCell {
  return {
    row,
    col,
    isClue: false,
    symbolId: `sym_${row}_${col}`,
    userValue: '',
    ...overrides,
  };
}

function clueCell(row: number, col: number): GridCell {
  return cell(row, col, { isClue: true, symbolId: undefined });
}

// ─── applyMapping ─────────────────────────────────────────────────────────────

describe('applyMapping', () => {
  it('deve aplicar mapping ao grid', () => {
    const grid: GridCell[][] = [
      [cell(0, 0, { symbolId: 'sym_A' }), clueCell(0, 1)],
      [cell(1, 0, { symbolId: 'sym_B' }), cell(1, 1, { symbolId: 'sym_A' })],
    ];
    const mapping: SymbolMapping = { sym_A: 'C', sym_B: 'A' };

    const result = applyMappingToGrid(grid, mapping);

    expect(result[0][0].userValue).toBe('C');
    expect(result[1][0].userValue).toBe('A');
    expect(result[1][1].userValue).toBe('C');
  });

  it('deve deixar células sem mapping vazias', () => {
    const grid: GridCell[][] = [[cell(0, 0, { symbolId: 'sym_X' })]];
    const mapping: SymbolMapping = {};

    const result = applyMappingToGrid(grid, mapping);

    expect(result[0][0].userValue).toBe('');
  });
});

// ─── updateCell ───────────────────────────────────────────────────────────────

describe('updateCell', () => {
  it('deve atualizar userValue de uma célula', () => {
    const grid: GridCell[][] = [[cell(0, 0)]];

    const result = updateCell(grid, 0, 0, 'a');

    expect(result[0][0].userValue).toBe('A');
  });

  it('deve converter para maiúsculas', () => {
    const grid: GridCell[][] = [[cell(0, 0)]];

    const result = updateCell(grid, 0, 0, 'x');

    expect(result[0][0].userValue).toBe('X');
  });

  it('não deve modificar o grid original', () => {
    const grid: GridCell[][] = [[cell(0, 0, { userValue: '' })]];

    updateCell(grid, 0, 0, 'A');

    expect(grid[0][0].userValue).toBe('');
  });
});

// ─── clearGrid ────────────────────────────────────────────────────────────────

describe('clearGrid', () => {
  it('deve limpar todas as userValues', () => {
    const grid: GridCell[][] = [
      [cell(0, 0, { userValue: 'A' }), cell(0, 1, { userValue: 'B' })],
      [cell(1, 0, { userValue: 'C' }), cell(1, 1, { userValue: 'D' })],
    ];

    const result = clearGrid(grid);

    for (const row of result) {
      for (const c of row) {
        expect(c.userValue).toBe('');
      }
    }
  });

  it('deve limpar isError', () => {
    const grid: GridCell[][] = [[cell(0, 0, { isError: true })]];

    const result = clearGrid(grid);

    expect(result[0][0].isError).toBe(false);
  });

  it('não deve modificar o grid original', () => {
    const grid: GridCell[][] = [[cell(0, 0, { userValue: 'A', isError: true })]];

    clearGrid(grid);

    expect(grid[0][0].userValue).toBe('A');
    expect(grid[0][0].isError).toBe(true);
  });
});

// ─── progress ─────────────────────────────────────────────────────────────────

describe('calculateProgress', () => {
  it('deve retornar 0 para grid sem células preenchidas', () => {
    const grid: GridCell[][] = [
      [cell(0, 0), cell(0, 1)],
      [cell(1, 0), cell(1, 1)],
    ];

    expect(calculateProgress(grid)).toBe(0);
  });

  it('deve retornar 100 para grid completamente preenchido', () => {
    const grid: GridCell[][] = [
      [cell(0, 0, { userValue: 'A' }), cell(0, 1, { userValue: 'B' })],
    ];

    expect(calculateProgress(grid)).toBe(100);
  });

  it('deve retornar 50 para grid meio preenchido', () => {
    const grid: GridCell[][] = [
      [cell(0, 0, { userValue: 'A' }), cell(0, 1)],
    ];

    expect(calculateProgress(grid)).toBe(50);
  });

  it('deve ignorar células de pista no cálculo', () => {
    const grid: GridCell[][] = [
      [clueCell(0, 0), cell(0, 1, { userValue: 'A' })],
    ];

    expect(calculateProgress(grid)).toBe(100);
  });

  it('deve ignorar células sem symbolId', () => {
    const grid: GridCell[][] = [
      [{ row: 0, col: 0, isClue: false, symbolId: undefined, userValue: 'A' }],
    ];

    expect(calculateProgress(grid)).toBe(0);
  });

  it('deve retornar 0 para grid vazio', () => {
    expect(calculateProgress([])).toBe(0);
  });
});
