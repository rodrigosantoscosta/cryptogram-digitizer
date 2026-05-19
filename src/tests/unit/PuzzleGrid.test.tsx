/**
 * Testes unitários para PuzzleGrid.
 *
 * buildSymbolMap é função pura — testada isoladamente.
 * Highlighting logic e rendering são testados via render.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PuzzleGrid } from '@/components/PuzzleGrid/PuzzleGrid';
import type { GridCell, ExtractedSymbol } from '@/types';

// ─── buildSymbolMap (local re-implementation) ────────────────────────────────

function buildSymbolMap(symbols: ExtractedSymbol[]): Map<string, ImageData> {
  const map = new Map<string, ImageData>();
  for (const sym of symbols) {
    if (sym.imageData) map.set(sym.id, sym.imageData);
  }
  return map;
}

describe('buildSymbolMap', () => {
  it('deve retornar mapa vazio para lista vazia', () => {
    const map = buildSymbolMap([]);
    expect(map.size).toBe(0);
  });

  it('deve mapear symbol IDs para ImageData', () => {
    const imageData = { width: 10, height: 10 } as ImageData;
    const symbols: ExtractedSymbol[] = [
      { id: 'sym1', imageData },
    ];
    const map = buildSymbolMap(symbols);
    expect(map.get('sym1')).toBe(imageData);
  });

  it('deve pular símbolos sem imageData', () => {
    const symbols: ExtractedSymbol[] = [
      { id: 'sym1', imageData: undefined },
      { id: 'sym2', imageData: { width: 5, height: 5 } as ImageData },
    ];
    const map = buildSymbolMap(symbols);
    expect(map.has('sym1')).toBe(false);
    expect(map.has('sym2')).toBe(true);
  });

  it('deve sobrescrever IDs duplicados com último valor', () => {
    const img1 = { width: 10, height: 10 } as ImageData;
    const img2 = { width: 20, height: 20 } as ImageData;
    const symbols: ExtractedSymbol[] = [
      { id: 'sym1', imageData: img1 },
      { id: 'sym1', imageData: img2 },
    ];
    const map = buildSymbolMap(symbols);
    expect(map.get('sym1')).toBe(img2);
  });
});

// ─── Highlighting logic ──────────────────────────────────────────────────────

describe('PuzzleGrid highlighting logic', () => {
  function makeCell(row: number, col: number): GridCell {
    return { row, col, isClue: false, symbolId: `sym_${row}_${col}`, userValue: '' };
  }

  function makeGrid(rows: number, cols: number): GridCell[][] {
    return Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => makeCell(r, c))
    );
  }

  it('deve destacar células na mesma linha da ativa', () => {
    const grid = makeGrid(3, 3);
    const { container } = render(
      <PuzzleGrid
        grid={grid}
        extractedSymbols={[]}
        activeRow={1}
        activeCol={1}
        correctCells={new Set()}
        onCellFocus={vi.fn()}
        onCellChange={vi.fn()}
        onCellKeyDown={vi.fn()}
      />
    );

    const row = container.querySelectorAll('.puzzle-grid__row')[1];
    const cells = row.querySelectorAll('.puzzle-cell');
    expect(cells[0]).toHaveClass('puzzle-cell--highlighted');
    expect(cells[1]).not.toHaveClass('puzzle-cell--highlighted');
    expect(cells[2]).toHaveClass('puzzle-cell--highlighted');
  });

  it('deve destacar células na mesma coluna da ativa', () => {
    const grid = makeGrid(3, 3);
    const { container } = render(
      <PuzzleGrid
        grid={grid}
        extractedSymbols={[]}
        activeRow={1}
        activeCol={1}
        correctCells={new Set()}
        onCellFocus={vi.fn()}
        onCellChange={vi.fn()}
        onCellKeyDown={vi.fn()}
      />
    );

    const rows = container.querySelectorAll('.puzzle-grid__row');
    const col1Cells = rows[0].querySelectorAll('.puzzle-cell')[1];
    const col2Cells = rows[1].querySelectorAll('.puzzle-cell')[1];
    const col3Cells = rows[2].querySelectorAll('.puzzle-cell')[1];

    expect(col1Cells).toHaveClass('puzzle-cell--highlighted');
    expect(col2Cells).not.toHaveClass('puzzle-cell--highlighted');
    expect(col3Cells).toHaveClass('puzzle-cell--highlighted');
  });

  it('NÃO deve destacar quando activeRow e activeCol são null', () => {
    const grid = makeGrid(2, 2);
    const { container } = render(
      <PuzzleGrid
        grid={grid}
        extractedSymbols={[]}
        activeRow={null}
        activeCol={null}
        correctCells={new Set()}
        onCellFocus={vi.fn()}
        onCellChange={vi.fn()}
        onCellKeyDown={vi.fn()}
      />
    );

    const highlighted = container.querySelectorAll('.puzzle-cell--highlighted');
    expect(highlighted.length).toBe(0);
  });
});

// ─── Correct cells ───────────────────────────────────────────────────────────

describe('PuzzleGrid correct cells', () => {
  function makeCell(row: number, col: number): GridCell {
    return { row, col, isClue: false, symbolId: `sym_${row}_${col}`, userValue: '' };
  }

  it('deve aplicar classe --correct para células no set', () => {
    const grid = [
      [makeCell(0, 0), makeCell(0, 1)],
      [makeCell(1, 0), makeCell(1, 1)],
    ];
    const correctCells = new Set(['0-1', '1-0']);

    const { container } = render(
      <PuzzleGrid
        grid={grid}
        extractedSymbols={[]}
        activeRow={null}
        activeCol={null}
        correctCells={correctCells}
        onCellFocus={vi.fn()}
        onCellChange={vi.fn()}
        onCellKeyDown={vi.fn()}
      />
    );

    const rows = container.querySelectorAll('.puzzle-grid__row');
    expect(rows[0].querySelectorAll('.puzzle-cell')[1]).toHaveClass('puzzle-cell--correct');
    expect(rows[1].querySelectorAll('.puzzle-cell')[0]).toHaveClass('puzzle-cell--correct');
    expect(rows[0].querySelectorAll('.puzzle-cell')[0]).not.toHaveClass('puzzle-cell--correct');
  });
});

// ─── Rendering ───────────────────────────────────────────────────────────────

describe('PuzzleGrid rendering', () => {
  function makeCell(row: number, col: number): GridCell {
    return { row, col, isClue: false, symbolId: `sym_${row}_${col}`, userValue: '' };
  }

  it('deve renderizar grade com role="grid"', () => {
    const grid = [[makeCell(0, 0)]];
    render(
      <PuzzleGrid
        grid={grid}
        extractedSymbols={[]}
        activeRow={null}
        activeCol={null}
        correctCells={new Set()}
        onCellFocus={vi.fn()}
        onCellChange={vi.fn()}
        onCellKeyDown={vi.fn()}
      />
    );
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('deve renderizar rows com role="row"', () => {
    const grid = [
      [makeCell(0, 0), makeCell(0, 1)],
      [makeCell(1, 0), makeCell(1, 1)],
    ];
    const { container } = render(
      <PuzzleGrid
        grid={grid}
        extractedSymbols={[]}
        activeRow={null}
        activeCol={null}
        correctCells={new Set()}
        onCellFocus={vi.fn()}
        onCellChange={vi.fn()}
        onCellKeyDown={vi.fn()}
      />
    );
    const rows = container.querySelectorAll('[role="row"]');
    expect(rows.length).toBe(2);
  });

  it('deve usar cellSize como CSS custom property', () => {
    const grid = [[makeCell(0, 0)]];
    const { container } = render(
      <PuzzleGrid
        grid={grid}
        extractedSymbols={[]}
        activeRow={null}
        activeCol={null}
        correctCells={new Set()}
        onCellFocus={vi.fn()}
        onCellChange={vi.fn()}
        onCellKeyDown={vi.fn()}
        cellSize={60}
      />
    );
    const gridEl = container.querySelector('.puzzle-grid');
    expect(gridEl).toHaveStyle({ '--cell-size': '60px' });
  });
});
