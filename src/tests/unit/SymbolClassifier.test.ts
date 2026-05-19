/**
 * Testes unitários para SymbolClassifier
 *
 * Foco nas funções de lógica pura (feature distance, comparison, clustering,
 * merge/split, buildFromNumbers). Métodos que dependem de OpenCV são testados
 * com mocks mínimos de ImageData.
 */

import { describe, it, expect } from 'vitest';
import { SymbolClassifier } from '../../lib/image-processing/SymbolClassifier';
import type { ExtractedSymbol, SymbolFeatures, UniqueSymbol, CellPosition } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFeatures(overrides: Partial<SymbolFeatures> = {}): SymbolFeatures {
  return {
    area: 100,
    perimeter: 50,
    aspectRatio: 1.0,
    moments: new Array(7).fill(0),
    histogram: new Array(256).fill(0),
    centerOfMass: { x: 32, y: 32 },
    extent: 0.8,
    ...overrides,
  };
}

function makeExtractedSymbol(
  id: string,
  features: SymbolFeatures = makeFeatures(),
  positions: CellPosition[] = [{ row: 0, col: 0 }]
): ExtractedSymbol {
  return {
    id,
    imageData: new ImageData(64, 64),
    features,
    positions,
    hash: `sym_${id}`,
  };
}

function makeUniqueSymbol(
  symbolId: string,
  occurrences: CellPosition[] = [{ row: 0, col: 0 }],
  mappedLetter: string | null = null
): UniqueSymbol {
  return {
    symbolId,
    representative: makeExtractedSymbol(symbolId),
    occurrences,
    mappedLetter,
  };
}

// ─── SymbolClassifier.calculateFeatureDistance ────────────────────────────────

describe('SymbolClassifier.calculateFeatureDistance', () => {
  it('deve retornar 0 para features idênticas', () => {
    const features = makeFeatures();

    const distance = SymbolClassifier.calculateFeatureDistance(features, features);

    expect(distance).toBe(0);
  });

  it('deve retornar distância maior para features diferentes', () => {
    const f1 = makeFeatures({ area: 100, aspectRatio: 1.0 });
    const f2 = makeFeatures({ area: 200, aspectRatio: 2.0 });

    const distance = SymbolClassifier.calculateFeatureDistance(f1, f2);

    expect(distance).toBeGreaterThan(0);
  });

  it('deve pesar aspectRatio mais que area', () => {
    // Mesma diferença absoluta, mas aspectRatio tem peso 0.3 vs area 0.2
    const f1 = makeFeatures({ area: 100, aspectRatio: 1.0, moments: new Array(7).fill(0) });
    const fArea = makeFeatures({ area: 200, aspectRatio: 1.0, moments: new Array(7).fill(0) });
    const fAspect = makeFeatures({ area: 100, aspectRatio: 2.0, moments: new Array(7).fill(0) });

    const distArea = SymbolClassifier.calculateFeatureDistance(f1, fArea);
    const distAspect = SymbolClassifier.calculateFeatureDistance(f1, fAspect);

    expect(distAspect).toBeGreaterThan(distArea);
  });

  it('deve pesar Hu Moments mais que outros features (peso 0.5)', () => {
    const base = makeFeatures({ moments: new Array(7).fill(0) });
    const fMoments = makeFeatures({ moments: [1, 1, 1, 1, 1, 1, 1] });
    const fArea = makeFeatures({ area: 200, moments: new Array(7).fill(0) });

    const distMoments = SymbolClassifier.calculateFeatureDistance(base, fMoments);
    const distArea = SymbolClassifier.calculateFeatureDistance(base, fArea);

    expect(distMoments).toBeGreaterThan(distArea);
  });

  it('deve lidar com area=0 em ambas as features', () => {
    const f1 = makeFeatures({ area: 0 });
    const f2 = makeFeatures({ area: 0 });

    const distance = SymbolClassifier.calculateFeatureDistance(f1, f2);

    expect(distance).toBeGreaterThanOrEqual(0);
  });
});

// ─── SymbolClassifier.compareSymbols ──────────────────────────────────────────

describe('SymbolClassifier.compareSymbols', () => {
  it('deve retornar similaridade 1 para símbolos idênticos', () => {
    const features = makeFeatures();
    const sym = makeExtractedSymbol('same', features);

    const similarity = SymbolClassifier.compareSymbols(sym, sym);

    expect(similarity).toBe(1);
  });

  it('deve retornar similaridade menor para símbolos diferentes', () => {
    const sym1 = makeExtractedSymbol('s1', makeFeatures({ aspectRatio: 1.0 }));
    const sym2 = makeExtractedSymbol('s2', makeFeatures({ aspectRatio: 3.0 }));

    const similarity = SymbolClassifier.compareSymbols(sym1, sym2);

    expect(similarity).toBeLessThan(1);
    expect(similarity).toBeGreaterThan(0);
  });

  it('deve retornar valor entre 0 e 1', () => {
    const sym1 = makeExtractedSymbol('s1', makeFeatures());
    const sym2 = makeExtractedSymbol('s2', makeFeatures({ aspectRatio: 10 }));

    const similarity = SymbolClassifier.compareSymbols(sym1, sym2);

    expect(similarity).toBeGreaterThanOrEqual(0);
    expect(similarity).toBeLessThanOrEqual(1);
  });
});

// ─── SymbolClassifier.clusterSymbols ──────────────────────────────────────────

describe('SymbolClassifier.clusterSymbols', () => {
  it('deve retornar array vazio para input vazio', () => {
    const clusters = SymbolClassifier.clusterSymbols([]);
    expect(clusters).toEqual([]);
  });

  it('deve agrupar símbolos idênticos no mesmo cluster', () => {
    const features = makeFeatures();
    const symbols = [
      makeExtractedSymbol('s1', features, [{ row: 0, col: 0 }]),
      makeExtractedSymbol('s2', features, [{ row: 1, col: 1 }]),
      makeExtractedSymbol('s3', features, [{ row: 2, col: 2 }]),
    ];

    const clusters = SymbolClassifier.clusterSymbols(symbols, 0.85);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].members).toHaveLength(3);
    expect(clusters[0].count).toBe(3);
  });

  it('deve separar símbolos dissimilares em clusters diferentes', () => {
    const sym1 = makeExtractedSymbol('s1', makeFeatures({ aspectRatio: 1.0, moments: new Array(7).fill(0) }));
    const sym2 = makeExtractedSymbol('s2', makeFeatures({ aspectRatio: 1.0, moments: new Array(7).fill(0) }));
    const sym3 = makeExtractedSymbol('s3', makeFeatures({ aspectRatio: 5.0, moments: new Array(7).fill(5) }));

    const clusters = SymbolClassifier.clusterSymbols([sym1, sym2, sym3], 0.9);

    expect(clusters.length).toBeGreaterThanOrEqual(2);
  });

  it('deve atribuir IDs sequenciais aos clusters', () => {
    const symbols = [
      makeExtractedSymbol('s1', makeFeatures({ aspectRatio: 1.0, moments: new Array(7).fill(0) })),
      makeExtractedSymbol('s2', makeFeatures({ aspectRatio: 5.0, moments: new Array(7).fill(5) })),
    ];

    const clusters = SymbolClassifier.clusterSymbols(symbols, 0.9);

    expect(clusters[0].id).toBe('cluster_0');
    expect(clusters[1].id).toBe('cluster_1');
  });

  it('deve calcular avgFeatures corretamente', () => {
    const f1 = makeFeatures({ area: 100 });
    const f2 = makeFeatures({ area: 200 });
    const symbols = [
      makeExtractedSymbol('s1', f1),
      makeExtractedSymbol('s2', f2),
    ];

    const clusters = SymbolClassifier.clusterSymbols(symbols, 0.5); // threshold baixo para agrupar

    if (clusters.length === 1) {
      expect(clusters[0].avgFeatures.area).toBe(150);
    }
  });
});

// ─── SymbolClassifier.identifyUniqueSymbols ───────────────────────────────────

describe('SymbolClassifier.identifyUniqueSymbols', () => {
  it('deve retornar array vazio para input vazio', () => {
    const result = SymbolClassifier.identifyUniqueSymbols([]);
    expect(result).toEqual([]);
  });

  it('deve ordenar por ocorrência decrescente', () => {
    const symbols = [
      makeExtractedSymbol('s1', makeFeatures(), [{ row: 0, col: 0 }]),
      makeExtractedSymbol('s2', makeFeatures(), [
        { row: 1, col: 1 }, { row: 2, col: 2 }, { row: 3, col: 3 },
      ]),
    ];

    const result = SymbolClassifier.identifyUniqueSymbols(symbols, 0.5);

    expect(result[0].occurrences.length).toBeGreaterThanOrEqual(result[1]?.occurrences.length ?? 0);
  });

  it('deve definir mappedLetter como null', () => {
    const symbols = [makeExtractedSymbol('s1', makeFeatures())];

    const result = SymbolClassifier.identifyUniqueSymbols(symbols);

    expect(result[0].mappedLetter).toBeNull();
  });
});

// ─── SymbolClassifier.mergeClusters ───────────────────────────────────────────

describe('SymbolClassifier.mergeClusters', () => {
  it('deve combinar ocorrências de dois clusters', () => {
    const symbols: UniqueSymbol[] = [
      makeUniqueSymbol('sym_A', [{ row: 0, col: 0 }, { row: 1, col: 1 }]),
      makeUniqueSymbol('sym_B', [{ row: 2, col: 2 }]),
    ];

    const result = SymbolClassifier.mergeClusters(symbols, 'sym_A', 'sym_B');

    const merged = result.find(s => s.symbolId.includes('merged'));
    expect(merged).toBeDefined();
    expect(merged!.occurrences).toHaveLength(3);
  });

  it('deve preservar mappedLetter se um dos clusters tiver', () => {
    const symbols: UniqueSymbol[] = [
      makeUniqueSymbol('sym_A', [{ row: 0, col: 0 }], 'C'),
      makeUniqueSymbol('sym_B', [{ row: 1, col: 1 }], null),
    ];

    const result = SymbolClassifier.mergeClusters(symbols, 'sym_A', 'sym_B');

    const merged = result.find(s => s.symbolId.includes('merged'));
    expect(merged!.mappedLetter).toBe('C');
  });

  it('deve remover os clusters originais do resultado', () => {
    const symbols: UniqueSymbol[] = [
      makeUniqueSymbol('sym_A'),
      makeUniqueSymbol('sym_B'),
      makeUniqueSymbol('sym_C'),
    ];

    const result = SymbolClassifier.mergeClusters(symbols, 'sym_A', 'sym_B');

    expect(result.find(s => s.symbolId === 'sym_A')).toBeUndefined();
    expect(result.find(s => s.symbolId === 'sym_B')).toBeUndefined();
    expect(result.find(s => s.symbolId === 'sym_C')).toBeDefined();
  });

  it('deve lançar erro quando cluster não é encontrado', () => {
    const symbols: UniqueSymbol[] = [makeUniqueSymbol('sym_A')];

    expect(() => SymbolClassifier.mergeClusters(symbols, 'sym_A', 'sym_X')).toThrow();
    expect(() => SymbolClassifier.mergeClusters(symbols, 'sym_X', 'sym_A')).toThrow();
  });
});

// ─── SymbolClassifier.splitCluster ────────────────────────────────────────────

describe('SymbolClassifier.splitCluster', () => {
  it('deve retornar array original para cluster com uma ocorrência', () => {
    const symbols: UniqueSymbol[] = [makeUniqueSymbol('sym_A', [{ row: 0, col: 0 }])];

    const result = SymbolClassifier.splitCluster(symbols, 'sym_A');

    expect(result).toBe(symbols);
  });

  it('deve lançar erro quando cluster não é encontrado', () => {
    const symbols: UniqueSymbol[] = [makeUniqueSymbol('sym_A')];

    expect(() => SymbolClassifier.splitCluster(symbols, 'sym_X')).toThrow('Cluster não encontrado');
  });

  it('deve criar novos clusters com IDs contendo "split"', () => {
    const symbols: UniqueSymbol[] = [
      makeUniqueSymbol('sym_A', [
        { row: 0, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 2 },
      ]),
    ];

    const result = SymbolClassifier.splitCluster(symbols, 'sym_A', 0.5);

    const splitClusters = result.filter(s => s.symbolId.includes('split'));
    expect(splitClusters.length).toBeGreaterThan(0);
  });

  it('deve preservar mappedLetter nos novos clusters', () => {
    const symbols: UniqueSymbol[] = [
      makeUniqueSymbol('sym_A', [{ row: 0, col: 0 }, { row: 1, col: 1 }], 'C'),
    ];

    const result = SymbolClassifier.splitCluster(symbols, 'sym_A', 0.5);

    for (const s of result) {
      if (s.symbolId.includes('split')) {
        expect(s.mappedLetter).toBe('C');
      }
    }
  });
});

// ─── SymbolClassifier.buildFromNumbers ────────────────────────────────────────

describe('SymbolClassifier.buildFromNumbers', () => {
  it('deve criar UniqueSymbol para cada número único', () => {
    const cellNumbers = {
      bySymbol: {
        '1': [{ row: 0, col: 0 }, { row: 1, col: 0 }],
        '2': [{ row: 0, col: 1 }],
      },
      grid: {},
    };

    const result = SymbolClassifier.buildFromNumbers(cellNumbers);

    expect(result).toHaveLength(2);
    expect(result.map(s => s.symbolId)).toContain('1');
    expect(result.map(s => s.symbolId)).toContain('2');
  });

  it('deve ordenar por valor numérico', () => {
    const cellNumbers = {
      bySymbol: {
        '10': [{ row: 0, col: 0 }],
        '2': [{ row: 0, col: 1 }],
        '1': [{ row: 1, col: 0 }],
      },
      grid: {},
    };

    const result = SymbolClassifier.buildFromNumbers(cellNumbers);

    expect(result[0].symbolId).toBe('1');
    expect(result[1].symbolId).toBe('2');
    expect(result[2].symbolId).toBe('10');
  });

  it('deve definir mappedLetter como null', () => {
    const cellNumbers = {
      bySymbol: { '1': [{ row: 0, col: 0 }] },
      grid: {},
    };

    const result = SymbolClassifier.buildFromNumbers(cellNumbers);

    expect(result[0].mappedLetter).toBeNull();
  });

  it('deve usar extractedSymbols para enriquecer representative quando disponível', () => {
    const cellNumbers = {
      bySymbol: { '1': [{ row: 0, col: 0 }] },
      grid: {},
    };
    const extractedSymbols = [
      makeExtractedSymbol('s1', makeFeatures(), [{ row: 0, col: 0 }]),
    ];

    const result = SymbolClassifier.buildFromNumbers(cellNumbers, extractedSymbols);

    expect(result[0].representative.imageData.width).toBe(64);
  });

  it('deve retornar array vazio para cellNumbers vazio', () => {
    const cellNumbers = { bySymbol: {}, grid: {} };

    const result = SymbolClassifier.buildFromNumbers(cellNumbers);

    expect(result).toEqual([]);
  });

  it('deve criar hash no formato num_XXX', () => {
    const cellNumbers = {
      bySymbol: { '5': [{ row: 0, col: 0 }] },
      grid: {},
    };

    const result = SymbolClassifier.buildFromNumbers(cellNumbers);

    expect(result[0].representative.hash).toBe('num_005');
  });
});
