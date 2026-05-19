/**
 * Testes unitários para SymbolMapperUI.
 *
 * isNumericMode, filtering e sorting são lógica pura testável.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SymbolMapperUI } from '@/components/Mapping/SymbolMapperUI';
import type { UniqueSymbol, SymbolMapping, SymbolSuggestion } from '@/types';

// ─── isNumericMode (local re-implementation) ─────────────────────────────────

function isNumericMode(symbols: UniqueSymbol[]): boolean {
  return symbols.length > 0 && symbols.every((s) => /^\d+$/.test(s.symbolId));
}

describe('isNumericMode', () => {
  it('deve retornar true quando todos os symbolIds são numéricos', () => {
    const symbols: UniqueSymbol[] = [
      { symbolId: '1', occurrences: [], representative: null, mappedLetter: null },
      { symbolId: '2', occurrences: [], representative: null, mappedLetter: null },
    ];
    expect(isNumericMode(symbols)).toBe(true);
  });

  it('deve retornar false quando há symbolId não numérico', () => {
    const symbols: UniqueSymbol[] = [
      { symbolId: '1', occurrences: [], representative: null, mappedLetter: null },
      { symbolId: 'cluster_0', occurrences: [], representative: null, mappedLetter: null },
    ];
    expect(isNumericMode(symbols)).toBe(false);
  });

  it('deve retornar false para lista vazia', () => {
    expect(isNumericMode([])).toBe(false);
  });

  it('deve retornar false para symbolIds mistos com letras e números', () => {
    const symbols: UniqueSymbol[] = [
      { symbolId: 'sym1', occurrences: [], representative: null, mappedLetter: null },
    ];
    expect(isNumericMode(symbols)).toBe(false);
  });
});

// ─── Filtering ───────────────────────────────────────────────────────────────

describe('SymbolMapperUI filtering', () => {
  const symbols: UniqueSymbol[] = [
    { symbolId: '1', occurrences: [{ row: 0, col: 1 }], representative: null, mappedLetter: null },
    { symbolId: '2', occurrences: [{ row: 0, col: 2 }], representative: null, mappedLetter: null },
    { symbolId: '3', occurrences: [{ row: 1, col: 1 }], representative: null, mappedLetter: null },
  ];

  const mapping: SymbolMapping = { '1': 'A', '2': 'B', '3': 'C' };

  it('deve mostrar todos os símbolos sem filtro', () => {
    render(
      <SymbolMapperUI
        uniqueSymbols={symbols}
        currentMapping={mapping}
        suggestions={[]}
        onMappingChange={vi.fn()}
      />
    );
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('deve filtrar por letra mapeada (case-insensitive)', () => {
    render(
      <SymbolMapperUI
        uniqueSymbols={symbols}
        currentMapping={mapping}
        suggestions={[]}
        onMappingChange={vi.fn()}
      />
    );
    const filterInput = screen.getByPlaceholderText('Filtrar por número ou letra...');
    fireEvent.change(filterInput, { target: { value: 'a' } });

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it('deve filtrar por número em modo numérico', () => {
    render(
      <SymbolMapperUI
        uniqueSymbols={symbols}
        currentMapping={mapping}
        suggestions={[]}
        onMappingChange={vi.fn()}
      />
    );
    const filterInput = screen.getByPlaceholderText('Filtrar por número ou letra...');
    fireEvent.change(filterInput, { target: { value: '2' } });

    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });
});

// ─── Sorting ─────────────────────────────────────────────────────────────────

describe('SymbolMapperUI sorting', () => {
  const symbols: UniqueSymbol[] = [
    { symbolId: '1', occurrences: [{ row: 0, col: 1 }, { row: 1, col: 1 }], representative: null, mappedLetter: null },
    { symbolId: '2', occurrences: [{ row: 0, col: 2 }], representative: null, mappedLetter: null },
    { symbolId: '3', occurrences: [{ row: 0, col: 3 }, { row: 1, col: 3 }, { row: 2, col: 3 }], representative: null, mappedLetter: null },
  ];

  const mapping: SymbolMapping = { '1': 'A', '2': 'B', '3': 'C' };

  it('deve ordenar por frequência decrescente por padrão', () => {
    render(
      <SymbolMapperUI
        uniqueSymbols={symbols}
        currentMapping={mapping}
        suggestions={[]}
        onMappingChange={vi.fn()}
      />
    );
    const cards = screen.getAllByText(/^\d+$/);
    expect(cards[0].textContent).toBe('3');
    expect(cards[1].textContent).toBe('1');
    expect(cards[2].textContent).toBe('2');
  });

  it('deve ordenar por número crescente quando selecionado', () => {
    render(
      <SymbolMapperUI
        uniqueSymbols={symbols}
        currentMapping={mapping}
        suggestions={[]}
        onMappingChange={vi.fn()}
      />
    );
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'id' } });

    const cards = screen.getAllByText(/^\d+$/);
    expect(cards[0].textContent).toBe('1');
    expect(cards[1].textContent).toBe('2');
    expect(cards[2].textContent).toBe('3');
  });

  it('deve ordenar alfabeticamente por letra mapeada', () => {
    render(
      <SymbolMapperUI
        uniqueSymbols={symbols}
        currentMapping={mapping}
        suggestions={[]}
        onMappingChange={vi.fn()}
      />
    );
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'alphabetical' } });

    const cards = screen.getAllByText(/^\d+$/);
    expect(cards[0].textContent).toBe('1');
    expect(cards[1].textContent).toBe('2');
    expect(cards[2].textContent).toBe('3');
  });
});

// ─── Counter & badge ─────────────────────────────────────────────────────────

describe('SymbolMapperUI counter & badge', () => {
  it('deve mostrar contador de mapeamento', () => {
    const symbols: UniqueSymbol[] = [
      { symbolId: '1', occurrences: [], representative: null, mappedLetter: null },
      { symbolId: '2', occurrences: [], representative: null, mappedLetter: null },
    ];
    const mapping: SymbolMapping = { '1': 'A' };

    render(
      <SymbolMapperUI
        uniqueSymbols={symbols}
        currentMapping={mapping}
        suggestions={[]}
        onMappingChange={vi.fn()}
      />
    );
    expect(screen.getByText(/1 de 2 símbolos mapeados/)).toBeInTheDocument();
  });

  it('deve mostrar badge "modo numérico" em modo numérico', () => {
    const symbols: UniqueSymbol[] = [
      { symbolId: '1', occurrences: [], representative: null, mappedLetter: null },
    ];

    render(
      <SymbolMapperUI
        uniqueSymbols={symbols}
        currentMapping={{}}
        suggestions={[]}
        onMappingChange={vi.fn()}
      />
    );
    expect(screen.getByText('modo numérico')).toBeInTheDocument();
  });
});

// ─── onMappingChange ─────────────────────────────────────────────────────────

describe('SymbolMapperUI onMappingChange', () => {
  it('deve chamar onMappingChange ao digitar no input', () => {
    const onMappingChange = vi.fn();
    const symbols: UniqueSymbol[] = [
      { symbolId: '1', occurrences: [], representative: null, mappedLetter: null },
    ];

    render(
      <SymbolMapperUI
        uniqueSymbols={symbols}
        currentMapping={{}}
        suggestions={[]}
        onMappingChange={onMappingChange}
      />
    );
    const inputs = screen.getAllByRole('textbox');
    const mappingInput = inputs[1];
    fireEvent.change(mappingInput, { target: { value: 'a' } });

    expect(onMappingChange).toHaveBeenCalledWith('1', 'A');
  });
});
