/**
 * Testes unitários para ImageProcessor
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ImageProcessor } from '../../lib/image-processing/ImageProcessor';

// Mock de OpenCV.js
declare const cv: any;

describe('ImageProcessor', () => {
  beforeAll(async () => {
    // Garantir que OpenCV está carregado
    if (typeof cv === 'undefined') {
      throw new Error('OpenCV.js não está carregado. Execute com opencv-mock ou navegador.');
    }
  });

  describe('toGrayscale', () => {
    it('deve converter imagem RGBA para grayscale', () => {
      // Criar imagem de teste 10x10 colorida
      const imageData = createColorTestImage(10, 10);

      const result = ImageProcessor.toGrayscale(imageData);

      expect(result.width).toBe(10);
      expect(result.height).toBe(10);

      // Verificar que foi convertido para grayscale
      // (em grayscale, os 3 primeiros canais devem ter o mesmo valor)
      for (let i = 0; i < result.data.length; i += 4) {
        expect(result.data[i]).toBe(result.data[i + 1]);
        expect(result.data[i + 1]).toBe(result.data[i + 2]);
      }
    });

    it('deve manter as dimensões originais', () => {
      const imageData = createColorTestImage(50, 30);
      const result = ImageProcessor.toGrayscale(imageData);

      expect(result.width).toBe(50);
      expect(result.height).toBe(30);
    });
  });

  describe('gaussianBlur', () => {
    it('deve aplicar blur com kernel size válido', () => {
      const imageData = createGrayscaleTestImage(20, 20);

      expect(() => {
        ImageProcessor.gaussianBlur(imageData, 5);
      }).not.toThrow();
    });

    it('deve lançar erro com kernel size par', () => {
      const imageData = createGrayscaleTestImage(20, 20);

      expect(() => {
        ImageProcessor.gaussianBlur(imageData, 4);
      }).toThrow('kernelSize deve ser ímpar');
    });

    it('deve suavizar imagem com ruído', () => {
      const noisy = createNoisyImage(50, 50);
      const blurred = ImageProcessor.gaussianBlur(noisy, 5);

      // Blur deve reduzir variação entre pixels adjacentes
      const noisyVariance = calculatePixelVariance(noisy);
      const blurredVariance = calculatePixelVariance(blurred);

      expect(blurredVariance).toBeLessThan(noisyVariance);
    });
  });

  describe('adaptiveThreshold', () => {
    it('deve binarizar imagem corretamente', () => {
      const imageData = createGrayscaleTestImage(30, 30);
      const result = ImageProcessor.adaptiveThreshold(imageData);

      // Verificar que resultado é binário (apenas 0 ou 255)
      const uniqueValues = new Set<number>();
      for (let i = 0; i < result.data.length; i += 4) {
        uniqueValues.add(result.data[i]);
      }

      expect(uniqueValues.size).toBeLessThanOrEqual(2);
      expect(Array.from(uniqueValues).every(v => v === 0 || v === 255)).toBe(true);
    });

    it('deve lançar erro com blockSize par', () => {
      const imageData = createGrayscaleTestImage(20, 20);

      expect(() => {
        ImageProcessor.adaptiveThreshold(imageData, 255, 10, 2);
      }).toThrow('blockSize deve ser ímpar');
    });
  });

  describe('morphologyEx', () => {
    it('deve aplicar MORPH_CLOSE', () => {
      const imageData = createBinaryTestImage(40, 40);

      expect(() => {
        ImageProcessor.morphologyEx(imageData, cv.MORPH_CLOSE, 3);
      }).not.toThrow();
    });

    it('deve aplicar MORPH_OPEN', () => {
      const imageData = createBinaryTestImage(40, 40);

      expect(() => {
        ImageProcessor.morphologyEx(imageData, cv.MORPH_OPEN, 3);
      }).not.toThrow();
    });
  });

  describe('detectEdges', () => {
    it('deve detectar bordas em imagem', () => {
      const imageData = createImageWithRectangle(100, 100);
      const edges = ImageProcessor.detectEdges(imageData);

      expect(edges.width).toBe(100);
      expect(edges.height).toBe(100);

      // Deve ter alguns pixels de borda detectados
      let edgePixels = 0;
      for (let i = 0; i < edges.data.length; i += 4) {
        if (edges.data[i] === 255) edgePixels++;
      }

      expect(edgePixels).toBeGreaterThan(0);
    });
  });

  describe('resize', () => {
    it('deve redimensionar mantendo aspect ratio', () => {
      const imageData = createGrayscaleTestImage(200, 100);
      const resized = ImageProcessor.resize(imageData, 100, 100);

      // Aspect ratio original: 2:1
      // Deve manter proporção: largura = 100, altura = 50
      expect(resized.width).toBe(100);
      expect(resized.height).toBe(50);
    });

    it('deve redimensionar imagem mais alta que larga', () => {
      const imageData = createGrayscaleTestImage(100, 200);
      const resized = ImageProcessor.resize(imageData, 100, 100);

      expect(resized.width).toBe(50);
      expect(resized.height).toBe(100);
    });
  });

  describe('invert', () => {
    it('deve inverter cores', () => {
      const imageData = createBinaryTestImage(20, 20);
      const inverted = ImageProcessor.invert(imageData);

      // Verificar que pixels foram invertidos
      for (let i = 0; i < imageData.data.length; i += 4) {
        const original = imageData.data[i];
        const result = inverted.data[i];

        expect(result).toBe(255 - original);
      }
    });
  });

  describe('preprocess (pipeline completo)', () => {
    it('deve processar imagem do início ao fim', async () => {
      const imageData = createColorTestImage(200, 200);

      const processed = await ImageProcessor.preprocess(imageData);

      expect(processed).toBeDefined();
      expect(processed.width).toBe(200);
      expect(processed.height).toBe(200);

      // Verificar que é binário (resultado do threshold)
      const uniqueValues = new Set<number>();
      for (let i = 0; i < processed.data.length; i += 4) {
        uniqueValues.add(processed.data[i]);
      }
      expect(uniqueValues.size).toBeLessThanOrEqual(2);
    });
  });
});

// ============ FUNÇÕES AUXILIARES DE TESTE ============

function createColorTestImage(width: number, height: number): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Desenhar gradiente colorido
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, 'red');
  gradient.addColorStop(0.5, 'green');
  gradient.addColorStop(1, 'blue');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  return ctx.getImageData(0, 0, width, height);
}

function createGrayscaleTestImage(width: number, height: number): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Desenhar gradiente em grayscale
  for (let y = 0; y < height; y++) {
    const value = Math.floor((y / height) * 255);
    ctx.fillStyle = `rgb(${value}, ${value}, ${value})`;
    ctx.fillRect(0, y, width, 1);
  }

  return ctx.getImageData(0, 0, width, height);
}

function createBinaryTestImage(width: number, height: number): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Fundo branco
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);

  // Algumas formas pretas
  ctx.fillStyle = 'black';
  ctx.fillRect(10, 10, 20, 20);
  ctx.fillRect(40, 40, 15, 15);

  return ctx.getImageData(0, 0, width, height);
}

function createNoisyImage(width: number, height: number): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);

  // Adicionar ruído aleatório
  for (let i = 0; i < imageData.data.length; i += 4) {
    const value = Math.floor(Math.random() * 256);
    imageData.data[i] = value;
    imageData.data[i + 1] = value;
    imageData.data[i + 2] = value;
    imageData.data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return ctx.getImageData(0, 0, width, height);
}

function createImageWithRectangle(width: number, height: number): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Fundo branco
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);

  // Retângulo preto no centro
  ctx.fillStyle = 'black';
  ctx.fillRect(width / 4, height / 4, width / 2, height / 2);

  return ctx.getImageData(0, 0, width, height);
}

function calculatePixelVariance(imageData: ImageData): number {
  const values: number[] = [];

  for (let i = 0; i < imageData.data.length; i += 4) {
    values.push(imageData.data[i]);
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    values.length;

  return variance;
}