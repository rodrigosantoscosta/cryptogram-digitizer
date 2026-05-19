/**
 * Testes unitários para SymbolExtractor — funções puras (hash + distância)
 *
 * generateSymbolHash e hammingDistance não dependem de OpenCV,
 * usando apenas Canvas API e matemática pura.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SymbolExtractor } from '../../lib/image-processing/SymbolExtractor';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSolidImageData(width: number, height: number, r: number, g: number, b: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return { width, height, data } as ImageData;
}

function makeWhiteImage(size: number = 32): ImageData {
  return makeSolidImageData(size, size, 255, 255, 255);
}

function makeBlackImage(size: number = 32): ImageData {
  return makeSolidImageData(size, size, 0, 0, 0);
}

// ─── SymbolExtractor.generateSymbolHash ───────────────────────────────────────

describe('SymbolExtractor.generateSymbolHash', () => {
  it('deve retornar hash iniciando com "sym_"', () => {
    const img = makeWhiteImage(32);
    const hash = SymbolExtractor.generateSymbolHash(img);
    expect(hash.startsWith('sym_')).toBe(true);
  });

  it('deve retornar hash consistente para a mesma imagem', () => {
    const img = makeWhiteImage(32);
    const hash1 = SymbolExtractor.generateSymbolHash(img);
    const hash2 = SymbolExtractor.generateSymbolHash(img);
    expect(hash1).toBe(hash2);
  });

  it.skip('deve retornar hashes diferentes para imagens com padrões diferentes', () => {
    // SKIPPED: jsdom não suporta drawImage real — requer navegador ou canvas real
    const img1 = makeSolidImageData(32, 32, 255, 255, 255);
    const img2 = makeSolidImageData(32, 32, 255, 255, 255);
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        if ((x + y) % 2 === 0) {
          const idx = (y * 32 + x) * 4;
          img2.data[idx] = 0;
          img2.data[idx + 1] = 0;
          img2.data[idx + 2] = 0;
        }
      }
    }
    const hash1 = SymbolExtractor.generateSymbolHash(img1);
    const hash2 = SymbolExtractor.generateSymbolHash(img2);
    expect(hash1).not.toBe(hash2);
  });

  it('deve retornar hash com tamanho fixo (sym_ + 16 chars hex)', () => {
    const img = makeWhiteImage(64);
    const hash = SymbolExtractor.generateSymbolHash(img);
    expect(hash).toMatch(/^sym_[0-9a-f]{16}$/);
  });

  it('deve lidar com imagens de tamanhos diferentes', () => {
    const img16 = makeWhiteImage(16);
    const img64 = makeWhiteImage(64);
    const img128 = makeWhiteImage(128);

    const hash16 = SymbolExtractor.generateSymbolHash(img16);
    const hash64 = SymbolExtractor.generateSymbolHash(img64);
    const hash128 = SymbolExtractor.generateSymbolHash(img128);

    // Todas devem ser válidas
    expect(hash16).toMatch(/^sym_[0-9a-f]{16}$/);
    expect(hash64).toMatch(/^sym_[0-9a-f]{16}$/);
    expect(hash128).toMatch(/^sym_[0-9a-f]{16}$/);
  });

  it('deve gerar hashes similares para imagens visualmente similares', () => {
    // Duas imagens brancas com pequena diferença
    const img1 = makeWhiteImage(32);
    const img2 = makeWhiteImage(32);
    // Alterar apenas 1 pixel
    img2.data[0] = 250;

    const hash1 = SymbolExtractor.generateSymbolHash(img1);
    const hash2 = SymbolExtractor.generateSymbolHash(img2);

    const distance = SymbolExtractor.hammingDistance(hash1, hash2);
    // pHash deve ser robusto — distância pequena
    expect(distance).toBeLessThan(20);
  });
});

// ─── SymbolExtractor.hammingDistance ──────────────────────────────────────────

describe('SymbolExtractor.hammingDistance', () => {
  it('deve retornar 0 para hashes idênticos', () => {
    const hash = 'sym_abcdef0123456789';
    expect(SymbolExtractor.hammingDistance(hash, hash)).toBe(0);
  });

  it('deve retornar 64 para hashes completamente diferentes', () => {
    // 0x00000000 vs 0xFFFFFFFF = todos os bits diferentes
    const hash1 = 'sym_0000000000000000';
    const hash2 = 'sym_ffffffffffffffff';
    expect(SymbolExtractor.hammingDistance(hash1, hash2)).toBe(64);
  });

  it('deve retornar 1 para hashes com 1 bit de diferença', () => {
    const hash1 = 'sym_0000000000000000';
    const hash2 = 'sym_0000000000000001';
    expect(SymbolExtractor.hammingDistance(hash1, hash2)).toBe(1);
  });

  it('deve ignorar o prefixo "sym_"', () => {
    const hash1 = 'sym_abcdef0123456789';
    const hash2 = 'abcdef0123456789';
    expect(SymbolExtractor.hammingDistance(hash1, hash2)).toBe(0);
  });

  it('deve retornar 64 para hashes de tamanhos diferentes', () => {
    const hash1 = 'sym_abcdef0123456789';
    const hash2 = 'sym_abcdef012345678'; // 1 char a menos
    expect(SymbolExtractor.hammingDistance(hash1, hash2)).toBe(64);
  });

  it('deve calcular distância simétrica', () => {
    const hash1 = 'sym_abcdef0123456789';
    const hash2 = 'sym_1234567890abcdef';
    const d1 = SymbolExtractor.hammingDistance(hash1, hash2);
    const d2 = SymbolExtractor.hammingDistance(hash2, hash1);
    expect(d1).toBe(d2);
  });

  it('deve retornar valor entre 0 e 64', () => {
    const hash1 = 'sym_abcdef0123456789';
    const hash2 = 'sym_fedcba9876543210';
    const distance = SymbolExtractor.hammingDistance(hash1, hash2);
    expect(distance).toBeGreaterThanOrEqual(0);
    expect(distance).toBeLessThanOrEqual(64);
  });
});
