/**
 * Testes unitários para SymbolMapper e MappingValidator
 *
 * Estes são testes de lógica pura — sem dependências de OpenCV, DOM ou React.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SymbolMapper,
  MappingValidator,
  PORTUGUESE_LETTER_FREQUENCY,
} from '../../lib/image-processing/SymbolMapper';
import type { UniqueSymbol, SymbolMapping, SymbolSuggestion, GridCell } from '@/types';

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
        area: 0,
        perimeter: 0,
        aspectRatio: 1,
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

function makeGridCell(
  row: number,
  col: number,
  overrides: Partial<GridCell> = {}
): GridCell {
  return {
    row,
    col,
    isClue: false,
    symbolId: `sym_${row}_${col}`,
    userValue: '',
    ...overrides,
  };
}

// ─── SymbolMapper.suggestMapping ──────────────────────────────────────────────

describe('SymbolMapper.suggestMapping', () => {
  it('deve retornar array vazio para lista vazia de símbolos', () => {
    const result = SymbolMapper.suggestMapping([]);
    expect(result).toEqual([]);
  });

  it('deve retornar array vazio quando símbolos não têm ocorrências', () => {
    const symbols = [makeUniqueSymbol('sym_1', [])];
    const result = SymbolMapper.suggestMapping(symbols);
    expect(result).toEqual([]);
  });

  it('deve sugerir letras baseado em frequência do português', () => {
    // Criar símbolos com contagens de ocorrência claramente diferentes
    const symbols = [
      makeUniqueSymbol('sym_A', Array(30).fill(null).map((_, i) => ({ row: 0, col: i }))),
      makeUniqueSymbol('sym_B', Array(20).fill(null).map((_, i) => ({ row: 1, col: i }))),
      makeUniqueSymbol('sym_C', Array(10).fill(null).map((_, i) => ({ row: 2, col: i }))),
    ];

    const result = SymbolMapper.suggestMapping(symbols);

    expect(result).toHaveLength(3);
    // O mais frequente deve ser sugerido como 'A' (letra mais frequente em PT)
    expect(result[0].suggestedLetter).toBe('A');
    expect(result[0].symbolId).toBe('sym_A');
  });

  it('deve calcular confidence entre 0 e 1', () => {
    const symbols = [
      makeUniqueSymbol('sym_1', Array(10).fill(null).map((_, i) => ({ row: 0, col: i }))),
      makeUniqueSymbol('sym_2', Array(5).fill(null).map((_, i) => ({ row: 1, col: i }))),
    ];

    const result = SymbolMapper.suggestMapping(symbols);

    for (const suggestion of result) {
      expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
      expect(suggestion.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('deve incluir razão na sugestão', () => {
    const symbols = [
      makeUniqueSymbol('sym_1', Array(10).fill(null).map((_, i) => ({ row: 0, col: i }))),
    ];

    const result = SymbolMapper.suggestMapping(symbols);

    expect(result[0].reason).toContain('Frequência');
    expect(result[0].reason).toContain('vs');
  });

  it('não deve sugerir mais letras do que existem no alfabeto português', () => {
    // Criar 30 símbolos (mais do que letras disponíveis)
    const symbols = Array.from({ length: 30 }, (_, i) =>
      makeUniqueSymbol(`sym_${i}`, [{ row: 0, col: i }])
    );

    const result = SymbolMapper.suggestMapping(symbols);

    const letterCount = Object.keys(PORTUGUESE_LETTER_FREQUENCY).length;
    expect(result.length).toBeLessThanOrEqual(letterCount);
  });

  it('deve ordenar sugestões por frequência decrescente do símbolo', () => {
    const symbols = [
      makeUniqueSymbol('sym_raro', [{ row: 0, col: 0 }]),
      makeUniqueSymbol('sym_comum', Array(20).fill(null).map((_, i) => ({ row: 0, col: i }))),
      makeUniqueSymbol('sym_medio', Array(10).fill(null).map((_, i) => ({ row: 1, col: i }))),
    ];

    const result = SymbolMapper.suggestMapping(symbols);

    expect(result[0].symbolId).toBe('sym_comum');
    expect(result[1].symbolId).toBe('sym_medio');
    expect(result[2].symbolId).toBe('sym_raro');
  });
});

// ─── SymbolMapper.applyAutoMapping ────────────────────────────────────────────

describe('SymbolMapper.applyAutoMapping', () => {
  it('deve retornar mapping vazio quando nenhuma sugestão atinge confiança mínima', () => {
    const suggestions: SymbolSuggestion[] = [
      { symbolId: 'sym_1', suggestedLetter: 'A', confidence: 0.3, reason: '' },
      { symbolId: 'sym_2', suggestedLetter: 'B', confidence: 0.5, reason: '' },
    ];

    const result = SymbolMapper.applyAutoMapping(suggestions, 0.7);

    expect(result).toEqual({});
  });

  it('deve aplicar apenas sugestões acima do threshold', () => {
    const suggestions: SymbolSuggestion[] = [
      { symbolId: 'sym_1', suggestedLetter: 'A', confidence: 0.9, reason: '' },
      { symbolId: 'sym_2', suggestedLetter: 'B', confidence: 0.4, reason: '' },
      { symbolId: 'sym_3', suggestedLetter: 'C', confidence: 0.8, reason: '' },
    ];

    const result = SymbolMapper.applyAutoMapping(suggestions, 0.7);

    expect(result).toEqual({ sym_1: 'A', sym_3: 'C' });
    expect(result).not.toHaveProperty('sym_2');
  });

  it('deve aplicar todas as sugestões quando minConfidence é 0', () => {
    const suggestions: SymbolSuggestion[] = [
      { symbolId: 'sym_1', suggestedLetter: 'A', confidence: 0.1, reason: '' },
      { symbolId: 'sym_2', suggestedLetter: 'B', confidence: 0.01, reason: '' },
    ];

    const result = SymbolMapper.applyAutoMapping(suggestions, 0);

    expect(Object.keys(result)).toHaveLength(2);
  });

  it('deve usar threshold padrão de 0.7', () => {
    const suggestions: SymbolSuggestion[] = [
      { symbolId: 'sym_1', suggestedLetter: 'A', confidence: 0.69, reason: '' },
      { symbolId: 'sym_2', suggestedLetter: 'B', confidence: 0.7, reason: '' },
      { symbolId: 'sym_3', suggestedLetter: 'C', confidence: 0.71, reason: '' },
    ];

    const result = SymbolMapper.applyAutoMapping(suggestions);

    expect(result).toHaveProperty('sym_2');
    expect(result).toHaveProperty('sym_3');
    expect(result).not.toHaveProperty('sym_1');
  });
});

// ─── SymbolMapper.applyMappingToGrid ──────────────────────────────────────────

describe('SymbolMapper.applyMappingToGrid', () => {
  it('deve aplicar mapping a células não-pista com symbolId', () => {
    const grid: GridCell[][] = [
      [makeGridCell(0, 0, { symbolId: 'sym_A' }), makeGridCell(0, 1, { symbolId: 'sym_B' })],
      [makeGridCell(1, 0, { symbolId: 'sym_A' }), makeGridCell(1, 1, { symbolId: 'sym_C' })],
    ];
    const mapping: SymbolMapping = { sym_A: 'X', sym_B: 'Y' };

    const result = SymbolMapper.applyMappingToGrid(grid, mapping);

    expect(result[0][0].userValue).toBe('X');
    expect(result[0][1].userValue).toBe('Y');
    expect(result[1][0].userValue).toBe('X');
    expect(result[1][1].userValue).toBe(''); // sym_C não está no mapping
  });

  it('deve pular células de pista (isClue=true)', () => {
    const grid: GridCell[][] = [
      [makeGridCell(0, 0, { isClue: true, symbolId: 'sym_A' })],
    ];
    const mapping: SymbolMapping = { sym_A: 'X' };

    const result = SymbolMapper.applyMappingToGrid(grid, mapping);

    expect(result[0][0].userValue).toBe('');
  });

  it('deve pular células sem symbolId', () => {
    const grid: GridCell[][] = [
      [makeGridCell(0, 0, { symbolId: undefined })],
    ];
    const mapping: SymbolMapping = { sym_A: 'X' };

    const result = SymbolMapper.applyMappingToGrid(grid, mapping);

    expect(result[0][0].userValue).toBe('');
  });

  it('não deve modificar o grid original', () => {
    const grid: GridCell[][] = [
      [makeGridCell(0, 0, { symbolId: 'sym_A', userValue: '' })],
    ];
    const mapping: SymbolMapping = { sym_A: 'X' };

    SymbolMapper.applyMappingToGrid(grid, mapping);

    expect(grid[0][0].userValue).toBe('');
  });
});

// ─── SymbolMapper.extractTextFromRow ──────────────────────────────────────────

describe('SymbolMapper.extractTextFromRow', () => {
  it('deve extrair texto mapeado de uma linha', () => {
    const row: GridCell[] = [
      makeGridCell(0, 0, { symbolId: 'sym_A' }),
      makeGridCell(0, 1, { symbolId: 'sym_B' }),
      makeGridCell(0, 2, { symbolId: 'sym_A' }),
    ];
    const mapping: SymbolMapping = { sym_A: 'C', sym_B: 'A' };

    const result = SymbolMapper.extractTextFromRow(row, mapping);

    expect(result).toBe('CAC');
  });

  it('deve usar underscore para símbolos não mapeados', () => {
    const row: GridCell[] = [
      makeGridCell(0, 0, { symbolId: 'sym_A' }),
      makeGridCell(0, 1, { symbolId: 'sym_B' }),
    ];
    const mapping: SymbolMapping = { sym_A: 'C' };

    const result = SymbolMapper.extractTextFromRow(row, mapping);

    expect(result).toBe('C_');
  });

  it('deve pular células de pista', () => {
    const row: GridCell[] = [
      makeGridCell(0, 0, { isClue: true, symbolId: 'sym_A' }),
      makeGridCell(0, 1, { symbolId: 'sym_B' }),
    ];
    const mapping: SymbolMapping = { sym_A: 'X', sym_B: 'Y' };

    const result = SymbolMapper.extractTextFromRow(row, mapping);

    expect(result).toBe('Y');
  });

  it('deve retornar string vazia para linha sem células de conteúdo', () => {
    const row: GridCell[] = [
      makeGridCell(0, 0, { isClue: true }),
      makeGridCell(0, 1, { isClue: true }),
    ];

    const result = SymbolMapper.extractTextFromRow(row, {});

    expect(result).toBe('');
  });
});

// ─── SymbolMapper.exportMapping ───────────────────────────────────────────────

describe('SymbolMapper.exportMapping', () => {
  it('deve exportar mapping como JSON formatado', () => {
    const mapping: SymbolMapping = { sym_A: 'C', sym_B: 'A' };

    const result = SymbolMapper.exportMapping(mapping);

    const parsed = JSON.parse(result);
    expect(parsed).toEqual(mapping);
    expect(result).toContain('\n'); // formatado com indentação
  });

  it('deve exportar mapping vazio', () => {
    const result = SymbolMapper.exportMapping({});
    expect(JSON.parse(result)).toEqual({});
  });
});

// ─── SymbolMapper.importMapping ───────────────────────────────────────────────

describe('SymbolMapper.importMapping', () => {
  it('deve importar JSON válido', () => {
    const json = JSON.stringify({ sym_A: 'C', sym_B: 'A' });

    const result = SymbolMapper.importMapping(json);

    expect(result).toEqual({ sym_A: 'C', sym_B: 'A' });
  });

  it('deve lançar erro para JSON inválido', () => {
    expect(() => SymbolMapper.importMapping('not json')).toThrow();
    expect(() => SymbolMapper.importMapping('{broken')).toThrow();
  });

  it('deve lançar erro para array JSON', () => {
    const json = JSON.stringify(['sym_A', 'sym_B']);
    expect(() => SymbolMapper.importMapping(json)).toThrow('Formato inválido');
  });

  it('deve lançar erro para JSON que não é objeto', () => {
    expect(() => SymbolMapper.importMapping(JSON.stringify(42))).toThrow();
    expect(() => SymbolMapper.importMapping(JSON.stringify('string'))).toThrow();
    expect(() => SymbolMapper.importMapping(JSON.stringify(null))).toThrow();
  });
});

// ─── MappingValidator.checkDuplicates ─────────────────────────────────────────

describe('MappingValidator.checkDuplicates', () => {
  it('deve retornar array vazio para mapping sem duplicatas', () => {
    const mapping: SymbolMapping = { sym_A: 'C', sym_B: 'A', sym_C: 'S' };

    const result = MappingValidator.checkDuplicates(mapping);

    expect(result).toEqual([]);
  });

  it('deve retornar letras duplicadas', () => {
    const mapping: SymbolMapping = { sym_A: 'C', sym_B: 'A', sym_C: 'C' };

    const result = MappingValidator.checkDuplicates(mapping);

    expect(result).toContain('C');
    expect(result).toHaveLength(1);
  });

  it('deve ignorar valores vazios', () => {
    const mapping: SymbolMapping = { sym_A: '', sym_B: 'A', sym_C: '' };

    const result = MappingValidator.checkDuplicates(mapping);

    expect(result).toEqual([]);
  });

  it('deve detectar múltiplas letras duplicadas', () => {
    const mapping: SymbolMapping = {
      sym_A: 'C',
      sym_B: 'A',
      sym_C: 'C',
      sym_D: 'A',
      sym_E: 'S',
    };

    const result = MappingValidator.checkDuplicates(mapping);

    expect(result).toContain('C');
    expect(result).toContain('A');
    expect(result).toHaveLength(2);
  });
});

// ─── MappingValidator.isComplete ──────────────────────────────────────────────

describe('MappingValidator.isComplete', () => {
  it('deve retornar true quando todos os símbolos estão mapeados', () => {
    const symbols = [
      makeUniqueSymbol('sym_A'),
      makeUniqueSymbol('sym_B'),
      makeUniqueSymbol('sym_C'),
    ];
    const mapping: SymbolMapping = { sym_A: 'C', sym_B: 'A', sym_C: 'S' };

    expect(MappingValidator.isComplete(symbols, mapping)).toBe(true);
  });

  it('deve retornar false quando algum símbolo não está mapeado', () => {
    const symbols = [
      makeUniqueSymbol('sym_A'),
      makeUniqueSymbol('sym_B'),
      makeUniqueSymbol('sym_C'),
    ];
    const mapping: SymbolMapping = { sym_A: 'C', sym_B: 'A' };

    expect(MappingValidator.isComplete(symbols, mapping)).toBe(false);
  });

  it('deve retornar true para lista vazia de símbolos', () => {
    expect(MappingValidator.isComplete([], {})).toBe(true);
  });
});

// ─── MappingValidator.getUnmappedSymbols ──────────────────────────────────────

describe('MappingValidator.getUnmappedSymbols', () => {
  it('deve retornar todos os símbolos quando mapping está vazio', () => {
    const symbols = [
      makeUniqueSymbol('sym_A'),
      makeUniqueSymbol('sym_B'),
    ];

    const result = MappingValidator.getUnmappedSymbols(symbols, {});

    expect(result).toHaveLength(2);
    expect(result.map(s => s.symbolId)).toContain('sym_A');
    expect(result.map(s => s.symbolId)).toContain('sym_B');
  });

  it('deve retornar array vazio quando todos estão mapeados', () => {
    const symbols = [
      makeUniqueSymbol('sym_A'),
      makeUniqueSymbol('sym_B'),
    ];
    const mapping: SymbolMapping = { sym_A: 'C', sym_B: 'A' };

    const result = MappingValidator.getUnmappedSymbols(symbols, mapping);

    expect(result).toEqual([]);
  });

  it('deve retornar apenas símbolos não mapeados', () => {
    const symbols = [
      makeUniqueSymbol('sym_A'),
      makeUniqueSymbol('sym_B'),
      makeUniqueSymbol('sym_C'),
    ];
    const mapping: SymbolMapping = { sym_A: 'C' };

    const result = MappingValidator.getUnmappedSymbols(symbols, mapping);

    expect(result).toHaveLength(2);
    expect(result.map(s => s.symbolId)).toContain('sym_B');
    expect(result.map(s => s.symbolId)).toContain('sym_C');
  });
});

// ─── MappingValidator.validate ────────────────────────────────────────────────

describe('MappingValidator.validate', () => {
  it('deve retornar isValid=true quando mapping é válido e completo', () => {
    const symbols = [makeUniqueSymbol('sym_A')];
    const mapping: SymbolMapping = { sym_A: 'C' };

    const result = MappingValidator.validate(symbols, mapping);

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('deve reportar letras duplicadas como errors', () => {
    const symbols = [makeUniqueSymbol('sym_A'), makeUniqueSymbol('sym_B')];
    const mapping: SymbolMapping = { sym_A: 'C', sym_B: 'C' };

    const result = MappingValidator.validate(symbols, mapping);

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('duplicadas');
  });

  it('deve reportar símbolos não mapeados como warnings', () => {
    const symbols = [makeUniqueSymbol('sym_A'), makeUniqueSymbol('sym_B')];
    const mapping: SymbolMapping = { sym_A: 'C' };

    const result = MappingValidator.validate(symbols, mapping);

    expect(result.isValid).toBe(true); // warnings não invalidam
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('não mapeados');
  });

  it('deve reportar caracteres inválidos como errors', () => {
    const symbols = [makeUniqueSymbol('sym_A')];
    const mapping: SymbolMapping = { sym_A: '1' }; // número não é letra válida

    const result = MappingValidator.validate(symbols, mapping);

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('inválida');
  });

  it('deve aceitar letras com acento como válidas', () => {
    const symbols = [makeUniqueSymbol('sym_A')];
    const mapping: SymbolMapping = { sym_A: 'Á' };

    const result = MappingValidator.validate(symbols, mapping);

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('deve aceitar letras minúsculas como válidas', () => {
    const symbols = [makeUniqueSymbol('sym_A')];
    const mapping: SymbolMapping = { sym_A: 'c' };

    const result = MappingValidator.validate(symbols, mapping);

    expect(result.isValid).toBe(true);
  });

  it('deve retornar errors e warnings simultaneamente', () => {
    const symbols = [
      makeUniqueSymbol('sym_A'),
      makeUniqueSymbol('sym_B'),
      makeUniqueSymbol('sym_C'),
    ];
    const mapping: SymbolMapping = { sym_A: 'C', sym_B: 'C' }; // duplicata + sym_C não mapeado

    const result = MappingValidator.validate(symbols, mapping);

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
