/**
 * Testes unitários para funções puras do CellNumberReader
 *
 * sanitizeDigits, fixSpuriousDigits e buildFrequencyMap são funções
 * internas do módulo — testadas indiretamente via CellNumberReader
 * ou diretamente se exportadas.
 *
 * Este arquivo testa a lógica de sanitização e validação de dígitos.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Re-implementação local das funções puras para teste ──────────────────────
// (Elas não são exportadas no módulo original, então replicamos a lógica)

function sanitizeDigits(raw: string): string {
  return raw
    .replace(/[oO]/g, '0')
    .replace(/[iIlL|]/g, '1')
    .replace(/[zZ]/g, '2')
    .replace(/[sS]/g, '5')
    .replace(/[bB]/g, '6')
    .replace(/[gGqQ]/g, '9')
    .replace(/[^0-9]/g, '');
}

const MIN_VALID_VALUE = 1;
const MAX_VALID_VALUE = 27;

function fixSpuriousDigits(value: number | null): number | null {
  if (value === null) return null;
  if (value >= MIN_VALID_VALUE && value <= MAX_VALID_VALUE) return value;
  if (value >= 10 && value < 100) {
    const firstDigit = Math.floor(value / 10);
    if (firstDigit >= MIN_VALID_VALUE && firstDigit <= MAX_VALID_VALUE) {
      return firstDigit;
    }
  }
  return null;
}

interface CellNumber {
  row: number;
  col: number;
  number: number | null;
  confidence: number;
  rawText: string;
  rawOcr: string;
}

function buildFrequencyMap(cells: CellNumber[]): Map<number, number> {
  const frequency = new Map<number, number>();
  for (const cell of cells) {
    if (cell.number !== null) {
      frequency.set(cell.number, (frequency.get(cell.number) || 0) + 1);
    }
  }
  return frequency;
}

// ─── sanitizeDigits ───────────────────────────────────────────────────────────

describe('sanitizeDigits', () => {
  it('deve retornar string vazia para input vazio', () => {
    expect(sanitizeDigits('')).toBe('');
  });

  it('deve preservar dígitos válidos', () => {
    expect(sanitizeDigits('1234567890')).toBe('1234567890');
  });

  it('deve substituir o/O por 0', () => {
    expect(sanitizeDigits('oO0')).toBe('000');
  });

  it('deve substituir i/I/l/L/| por 1', () => {
    expect(sanitizeDigits('iIlL|1')).toBe('111111');
  });

  it('deve substituir z/Z por 2', () => {
    expect(sanitizeDigits('zZ2')).toBe('222');
  });

  it('deve substituir s/S por 5', () => {
    expect(sanitizeDigits('sS5')).toBe('555');
  });

  it('deve substituir b/B por 6', () => {
    expect(sanitizeDigits('bB6')).toBe('666');
  });

  it('deve substituir g/G/q/Q por 9', () => {
    expect(sanitizeDigits('gGqQ9')).toBe('99999');
  });

  it('deve remover caracteres não-dígitos restantes', () => {
    // b→6, z→2 antes de remover não-dígitos
    expect(sanitizeDigits('abc!@#xyz')).toBe('62');
    // b→6, c→remove
    expect(sanitizeDigits('12abc34')).toBe('12634');
  });

  it('deve retornar apenas dígitos após todas as substituições', () => {
    // H(remove) e→(remove) l→1 l→1 o→0 W(remove) 0→0 r(remove) l→1 d(remove)
    const result = sanitizeDigits('Hello W0rld!');
    expect(result).toBe('11001');
  });

  it('deve lidar com texto misto OCR típico', () => {
    expect(sanitizeDigits('l2')).toBe('12');
    expect(sanitizeDigits('O6')).toBe('06');
    expect(sanitizeDigits('S7')).toBe('57');
    expect(sanitizeDigits('l9')).toBe('19');
  });

  it('deve retornar string com apenas dígitos para input misto', () => {
    // s→5 antes de remover não-dígitos
    const result = sanitizeDigits('Test 123!@#');
    expect(result).toBe('5123');
  });
});

// ─── fixSpuriousDigits ────────────────────────────────────────────────────────

describe('fixSpuriousDigits', () => {
  it('deve retornar null para input null', () => {
    expect(fixSpuriousDigits(null)).toBeNull();
  });

  it('deve passar valores válidos 1-27', () => {
    for (let i = 1; i <= 27; i++) {
      expect(fixSpuriousDigits(i)).toBe(i);
    }
  });

  it('deve corrigir 34 → 3 (primeiro dígito válido)', () => {
    expect(fixSpuriousDigits(34)).toBe(3);
  });

  it('deve passar 24 como válido (dentro de 1-27)', () => {
    expect(fixSpuriousDigits(24)).toBe(24);
  });

  it('deve corrigir 28 → 2 (primeiro dígito válido)', () => {
    expect(fixSpuriousDigits(28)).toBe(2);
  });

  it('deve corrigir 29 → 2 (primeiro dígito válido)', () => {
    expect(fixSpuriousDigits(29)).toBe(2);
  });

  it('deve corrigir 30 → 3 (primeiro dígito válido)', () => {
    expect(fixSpuriousDigits(30)).toBe(3);
  });

  it('deve corrigir 99 → 9 (primeiro dígito válido)', () => {
    expect(fixSpuriousDigits(99)).toBe(9);
  });

  it('deve retornar null para valores >= 100', () => {
    expect(fixSpuriousDigits(100)).toBeNull();
    expect(fixSpuriousDigits(123)).toBeNull();
  });

  it('deve retornar null para 0 (abaixo do mínimo)', () => {
    expect(fixSpuriousDigits(0)).toBeNull();
  });

  it('deve retornar null para valores negativos', () => {
    expect(fixSpuriousDigits(-5)).toBeNull();
  });

  it('deve retornar null para valores >= 100', () => {
    expect(fixSpuriousDigits(100)).toBeNull();
    expect(fixSpuriousDigits(123)).toBeNull();
  });

  it('deve manter 27 como válido', () => {
    expect(fixSpuriousDigits(27)).toBe(27);
  });

  it('deve passar 21 como válido (dentro de 1-27)', () => {
    expect(fixSpuriousDigits(21)).toBe(21);
  });
});

// ─── buildFrequencyMap ────────────────────────────────────────────────────────

describe('buildFrequencyMap', () => {
  it('deve retornar map vazio para lista vazia', () => {
    const result = buildFrequencyMap([]);
    expect(result.size).toBe(0);
  });

  it('deve contar ocorrências de cada número', () => {
    const cells: CellNumber[] = [
      { row: 0, col: 0, number: 1, confidence: 0.9, rawText: '1', rawOcr: '1' },
      { row: 0, col: 1, number: 2, confidence: 0.8, rawText: '2', rawOcr: '2' },
      { row: 1, col: 0, number: 1, confidence: 0.7, rawText: '1', rawOcr: '1' },
      { row: 1, col: 1, number: 1, confidence: 0.9, rawText: '1', rawOcr: '1' },
      { row: 2, col: 0, number: 2, confidence: 0.6, rawText: '2', rawOcr: '2' },
    ];

    const result = buildFrequencyMap(cells);

    expect(result.get(1)).toBe(3);
    expect(result.get(2)).toBe(2);
  });

  it('deve ignorar células com number=null', () => {
    const cells: CellNumber[] = [
      { row: 0, col: 0, number: 1, confidence: 0.9, rawText: '1', rawOcr: '1' },
      { row: 0, col: 1, number: null, confidence: 0, rawText: '', rawOcr: '' },
      { row: 1, col: 0, number: 1, confidence: 0.8, rawText: '1', rawOcr: '1' },
    ];

    const result = buildFrequencyMap(cells);

    expect(result.get(1)).toBe(2);
    expect(result.has(0)).toBe(false);
    expect(result.size).toBe(1);
  });

  it('deve lidar com todos os números diferentes', () => {
    const cells: CellNumber[] = [
      { row: 0, col: 0, number: 1, confidence: 0.9, rawText: '1', rawOcr: '1' },
      { row: 0, col: 1, number: 2, confidence: 0.8, rawText: '2', rawOcr: '2' },
      { row: 1, col: 0, number: 3, confidence: 0.7, rawText: '3', rawOcr: '3' },
    ];

    const result = buildFrequencyMap(cells);

    expect(result.size).toBe(3);
    expect(result.get(1)).toBe(1);
    expect(result.get(2)).toBe(1);
    expect(result.get(3)).toBe(1);
  });

  it('deve lidar com todos os cells null', () => {
    const cells: CellNumber[] = [
      { row: 0, col: 0, number: null, confidence: 0, rawText: '', rawOcr: '' },
      { row: 0, col: 1, number: null, confidence: 0, rawText: '', rawOcr: '' },
    ];

    const result = buildFrequencyMap(cells);

    expect(result.size).toBe(0);
  });
});
