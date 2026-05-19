/**
 * Testes unitários para useSymbolMapping hook
 *
 * Testa a lógica de filtering, sorting, progress e mapping updates.
 * A lógica pura é extraída e testada sem React.
 */

import { describe, it, expect } from 'vitest';
import type { UniqueSymbol, SymbolMapping } from '@/types';
import { SymbolMapper, MappingValidator } from '@/lib/image-processing/SymbolMapper';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUniqueSymbol(
  symbolId: string,
  occurrences: { row: number; col: number }[] = [{ row: 0, col: 0 }],
  mappedLetter: string | null = null
): UniqueSymbol {
  return {
    symbolId,
    representative: {
      id: symbolId,
      imageData: new ImageData(1, 1),
      features: {
        area: 0, perimeter: 0, aspectRatio: 1,
        moments: new Array(7).fill(0),
        histogram: new Array(256).fill(0),
        centerOfMass: { x: 0, y: 0 },
        extent: 0,
      },
      positions: occurrences,
      hash: `sym_${symbolId}`,
    },
    occurrences,
    mappedLetter,
  };
}

// ─── Lógica extraída do hook (para testar sem React) ──────────────────────────

function computeSuggestions(symbols: UniqueSymbol[]) {
  return SymbolMapper.suggestMapping(symbols);
}

function computeValidation(symbols: UniqueSymbol[], mapping: SymbolMapping) {
  return MappingValidator.validate(symbols, mapping);
}

function computeProgress(mapping: SymbolMapping, symbols: UniqueSymbol[]) {
  const mapped = Object.keys(mapping).length;
  const total = symbols.length;
  return total > 0 ? (mapped / total) * 100 : 0;
}

function computeFilteredSymbols(
  symbols: UniqueSymbol[],
  mapping: SymbolMapping,
  filter: string,
  sortBy: 'frequency' | 'alphabetical'
) {
  return symbols
    .filter((s) => {
      if (!filter) return true;
      const mappedLetter = mapping[s.symbolId];
      return mappedLetter?.toLowerCase().includes(filter.toLowerCase());
    })
    .sort((a, b) => {
      if (sortBy === 'frequency') {
        return b.occurrences.length - a.occurrences.length;
      } else {
        const letterA = mapping[a.symbolId] || 'Z';
        const letterB = mapping[b.symbolId] || 'Z';
        return letterA.localeCompare(letterB);
      }
    });
}

function updateMapping(prev: SymbolMapping, symbolId: string, letter: string): SymbolMapping {
  if (letter === '') {
    const { [symbolId]: _, ...rest } = prev;
    return rest;
  }
  return { ...prev, [symbolId]: letter.toUpperCase() };
}

// ─── computeSuggestions ──────────────────────────────────────────────────────

describe('useSymbolMapping — computeSuggestions', () => {
  it('deve retornar sugestões baseadas em frequência', () => {
    const symbols = [
      makeUniqueSymbol('sym_A', Array(20).fill(null).map((_, i) => ({ row: 0, col: i }))),
      makeUniqueSymbol('sym_B', Array(10).fill(null).map((_, i) => ({ row: 1, col: i }))),
    ];

    const suggestions = computeSuggestions(symbols);

    expect(suggestions[0].symbolId).toBe('sym_A');
    expect(suggestions[0].suggestedLetter).toBe('A');
  });
});

// ─── computeValidation ───────────────────────────────────────────────────────

describe('useSymbolMapping — computeValidation', () => {
  it('deve validar mapping corretamente', () => {
    const symbols = [makeUniqueSymbol('sym_A'), makeUniqueSymbol('sym_B')];
    const mapping: SymbolMapping = { sym_A: 'C' };

    const result = computeValidation(symbols, mapping);

    expect(result.isValid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('deve detectar duplicatas', () => {
    const symbols = [makeUniqueSymbol('sym_A'), makeUniqueSymbol('sym_B')];
    const mapping: SymbolMapping = { sym_A: 'C', sym_B: 'C' };

    const result = computeValidation(symbols, mapping);

    expect(result.isValid).toBe(false);
  });
});

// ─── computeProgress ─────────────────────────────────────────────────────────

describe('useSymbolMapping — computeProgress', () => {
  it('deve retornar 0 para mapping vazio', () => {
    const symbols = [makeUniqueSymbol('sym_A'), makeUniqueSymbol('sym_B')];
    expect(computeProgress({}, symbols)).toBe(0);
  });

  it('deve retornar 50 para mapping meio completo', () => {
    const symbols = [makeUniqueSymbol('sym_A'), makeUniqueSymbol('sym_B')];
    expect(computeProgress({ sym_A: 'C' }, symbols)).toBe(50);
  });

  it('deve retornar 100 para mapping completo', () => {
    const symbols = [makeUniqueSymbol('sym_A'), makeUniqueSymbol('sym_B')];
    expect(computeProgress({ sym_A: 'C', sym_B: 'A' }, symbols)).toBe(100);
  });

  it('deve retornar 0 para lista vazia de símbolos', () => {
    expect(computeProgress({}, [])).toBe(0);
  });
});

// ─── computeFilteredSymbols ──────────────────────────────────────────────────

describe('useSymbolMapping — computeFilteredSymbols', () => {
  it('deve retornar todos os símbolos sem filtro', () => {
    const symbols = [makeUniqueSymbol('sym_A'), makeUniqueSymbol('sym_B')];
    const result = computeFilteredSymbols(symbols, {}, '', 'frequency');
    expect(result).toHaveLength(2);
  });

  it('deve filtrar por letra mapeada', () => {
    const symbols = [
      makeUniqueSymbol('sym_A'),
      makeUniqueSymbol('sym_B'),
    ];
    const mapping: SymbolMapping = { sym_A: 'C' };

    const result = computeFilteredSymbols(symbols, mapping, 'c', 'frequency');

    expect(result).toHaveLength(1);
    expect(result[0].symbolId).toBe('sym_A');
  });

  it('deve ordenar por frequência (decrescente)', () => {
    const symbols = [
      makeUniqueSymbol('sym_raro', [{ row: 0, col: 0 }]),
      makeUniqueSymbol('sym_comum', Array(10).fill(null).map((_, i) => ({ row: 0, col: i }))),
    ];

    const result = computeFilteredSymbols(symbols, {}, '', 'frequency');

    expect(result[0].symbolId).toBe('sym_comum');
    expect(result[1].symbolId).toBe('sym_raro');
  });

  it('deve ordenar alfabeticamente por letra mapeada', () => {
    const symbols = [
      makeUniqueSymbol('sym_A'),
      makeUniqueSymbol('sym_B'),
    ];
    const mapping: SymbolMapping = { sym_A: 'Z', sym_B: 'A' };

    const result = computeFilteredSymbols(symbols, mapping, '', 'alphabetical');

    expect(result[0].symbolId).toBe('sym_B'); // A vem antes de Z
    expect(result[1].symbolId).toBe('sym_A');
  });

  it('deve usar "Z" como valor padrão para símbolos não mapeados na ordenação alfabética', () => {
    const symbols = [
      makeUniqueSymbol('sym_A'),
      makeUniqueSymbol('sym_B'),
    ];
    const mapping: SymbolMapping = { sym_A: 'C' };

    const result = computeFilteredSymbols(symbols, mapping, '', 'alphabetical');

    expect(result[0].symbolId).toBe('sym_A'); // C vem antes de Z
    expect(result[1].symbolId).toBe('sym_B');
  });
});

// ─── updateMapping ────────────────────────────────────────────────────────────

describe('useSymbolMapping — updateMapping', () => {
  it('deve adicionar mapping com letra maiúscula', () => {
    const result = updateMapping({}, 'sym_A', 'c');
    expect(result).toEqual({ sym_A: 'C' });
  });

  it('deve remover entry quando letra é vazia', () => {
    const prev: SymbolMapping = { sym_A: 'C', sym_B: 'A' };
    const result = updateMapping(prev, 'sym_A', '');
    expect(result).toEqual({ sym_B: 'A' });
  });

  it('deve atualizar letra existente', () => {
    const prev: SymbolMapping = { sym_A: 'C' };
    const result = updateMapping(prev, 'sym_A', 'X');
    expect(result).toEqual({ sym_A: 'X' });
  });

  it('não deve modificar o objeto anterior', () => {
    const prev: SymbolMapping = { sym_A: 'C' };
    updateMapping(prev, 'sym_A', 'X');
    expect(prev).toEqual({ sym_A: 'C' });
  });
});
