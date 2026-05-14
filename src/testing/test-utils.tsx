/**
 * Utilitários compartilhados entre testes
 */
import type { ProcessedData, UniqueSymbol, ExtractedSymbol } from '@/types';
import type { SymbolFeatures } from '@/types/symbol';

/** Cria um ImageData válido de NxN pixels para uso em testes */
export function makeImageData(width = 8, height = 8): ImageData {
  return new ImageData(new Uint8ClampedArray(width * height * 4), width, height);
}

/** Cria um ExtractedSymbol mínimo válido */
export function makeExtractedSymbol(id: string, row = 0, col = 1): ExtractedSymbol {
  const features: SymbolFeatures = {
    area: 16,
    perimeter: 16,
    aspectRatio: 1,
    moments: Array(7).fill(0),
    histogram: Array(16).fill(0),
    centerOfMass: { x: 4, y: 4 },
  };
  return {
    id,
    imageData: makeImageData(),
    features,
    positions: [{ row, col }],
    hash: `hash_${id}`,
  };
}

/** Cria um UniqueSymbol mínimo válido */
export function makeUniqueSymbol(symbolId: string, row = 0, col = 1): UniqueSymbol {
  return {
    symbolId,
    representative: makeExtractedSymbol(symbolId, row, col),
    occurrences: [{ row, col }],
    mappedLetter: null,
  };
}

/** Cria um ProcessedData mínimo válido para testes de Mapping/Solution */
export function makeProcessedData(uniqueSymbols: UniqueSymbol[] = []): ProcessedData {
  return {
    preprocessedImage: makeImageData(32, 32),
    tableStructure: {
      rows: 2,
      cols: 3,
      cellWidth: 50,
      cellHeight: 50,
      gridPoints: [],
      clueColumnWidth: 100,
      answerColumnWidth: 50,
    } as any,
    grid: {
      rows: 2,
      cols: 3,
      roi: { x: 0, y: 0, width: 150, height: 100 },
      rowPositions: [0, 50, 100],
      colPositions: [0, 100, 150, 200],
      rowHeights: [50, 50],
      colWidths: [100, 50, 50],
    } as any,
    clues: [
      { row: 0, text: 'Primeira pista', confidence: 0.95, rawText: 'Primeira pista' },
      { row: 1, text: 'Segunda pista', confidence: 0.90, rawText: 'Segunda pista' },
    ],
    extractedSymbols: uniqueSymbols.map((u) => u.representative),
    uniqueSymbols,
    processedAt: new Date('2026-05-14T00:00:00Z'),
  };
}
