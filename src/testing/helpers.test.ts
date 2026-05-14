/**
 * Testes unitários dos helpers puros (sem DOM, sem React)
 * Cobrem: reviveImageData, makeImageData, makeUniqueSymbol
 */
import { describe, it, expect } from 'vitest';
import { makeImageData, makeExtractedSymbol, makeUniqueSymbol, makeProcessedData } from './test-utils';

describe('makeImageData', () => {
  it('retorna instância válida de ImageData', () => {
    const img = makeImageData(16, 16);
    expect(img).toBeInstanceOf(ImageData);
    expect(img.width).toBe(16);
    expect(img.height).toBe(16);
    expect(img.data.length).toBe(16 * 16 * 4);
  });

  it('padrão é 8x8', () => {
    const img = makeImageData();
    expect(img.width).toBe(8);
    expect(img.height).toBe(8);
  });
});

describe('makeExtractedSymbol', () => {
  it('retorna símbolo com imageData válido', () => {
    const sym = makeExtractedSymbol('sym_1');
    expect(sym.id).toBe('sym_1');
    expect(sym.imageData).toBeInstanceOf(ImageData);
    expect(sym.positions).toHaveLength(1);
    expect(sym.features.area).toBeGreaterThan(0);
  });
});

describe('makeUniqueSymbol', () => {
  it('retorna UniqueSymbol com representative válido', () => {
    const u = makeUniqueSymbol('symbol_1');
    expect(u.symbolId).toBe('symbol_1');
    expect(u.representative.imageData).toBeInstanceOf(ImageData);
    expect(u.occurrences).toHaveLength(1);
    expect(u.mappedLetter).toBeNull();
  });
});

describe('makeProcessedData', () => {
  it('retorna estrutura com campos obrigatórios preenchidos', () => {
    const data = makeProcessedData([makeUniqueSymbol('symbol_1')]);
    expect(data.uniqueSymbols).toHaveLength(1);
    expect(data.clues).toHaveLength(2);
    expect(data.preprocessedImage).toBeInstanceOf(ImageData);
    expect(data.processedAt).toBeInstanceOf(Date);
  });

  it('aceita lista vazia de uniqueSymbols', () => {
    const data = makeProcessedData([]);
    expect(data.uniqueSymbols).toHaveLength(0);
    expect(data.extractedSymbols).toHaveLength(0);
  });
});

describe('reviveImageData (inline)', () => {
  function reviveImageData(
    value: ImageData | { data: ArrayLike<number>; width: number; height: number } | null | undefined
  ): ImageData | null {
    if (!value) return null;
    if (value instanceof ImageData) return value;
    if (
      typeof value === 'object' &&
      typeof value.width === 'number' &&
      typeof value.height === 'number' &&
      'data' in value
    ) {
      const copied = new Uint8ClampedArray(Array.from(value.data as ArrayLike<number>));
      return new ImageData(copied, value.width, value.height);
    }
    return null;
  }

  it('retorna null para undefined', () => {
    expect(reviveImageData(undefined)).toBeNull();
  });

  it('retorna null para null', () => {
    expect(reviveImageData(null)).toBeNull();
  });

  it('retorna o próprio objeto se já é ImageData', () => {
    const img = makeImageData(4, 4);
    const result = reviveImageData(img);
    expect(result).toBe(img);
  });

  it('reconstrói ImageData a partir de plain object', () => {
    const original = makeImageData(4, 4);
    // simular serialização/deserialização (ex: sessionStorage)
    const plain = {
      data: Array.from(original.data),
      width: original.width,
      height: original.height,
    };
    const revived = reviveImageData(plain);
    expect(revived).toBeInstanceOf(ImageData);
    expect(revived!.width).toBe(4);
    expect(revived!.height).toBe(4);
    expect(revived!.data.length).toBe(original.data.length);
  });

  it('preserva os valores dos pixels ao reanimar', () => {
    const data = new Uint8ClampedArray([255, 0, 128, 255, 10, 20, 30, 255]);
    const img = new ImageData(data, 2, 1);
    const plain = { data: Array.from(img.data), width: img.width, height: img.height };
    const revived = reviveImageData(plain)!;
    expect(Array.from(revived.data)).toEqual([255, 0, 128, 255, 10, 20, 30, 255]);
  });
});
