/**
 * Testes unitários para OCREngine.
 *
 * postProcessText é uma função pura — testada extensivamente.
 * recognizeColumn/recognizeClue requerem worker Tesseract real,
 * então são testados via mock do worker.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OCREngine } from '@/lib/ocr/OCREngine';
import { PSM } from 'tesseract.js';

// ─── Mock Tesseract ──────────────────────────────────────────────────────────

const mockCreateWorker = vi.fn();

vi.mock('tesseract.js', () => ({
  PSM: {
    SINGLE_COLUMN: 6,
    SINGLE_WORD: 8,
    SINGLE_CHAR: 10,
  },
  createWorker: vi.fn(),
}));

beforeEach(async () => {
  const { createWorker } = await import('tesseract.js');
  vi.mocked(createWorker).mockReset();
});

function makeOCREngine(): OCREngine {
  return new OCREngine();
}

// ─── postProcessText ─────────────────────────────────────────────────────────

describe('OCREngine.postProcessText', () => {
  let engine: OCREngine;

  beforeEach(() => {
    engine = makeOCREngine();
  });

  it('deve trimar whitespace', () => {
    expect(engine.postProcessText('  hello  ')).toBe('Hello');
  });

  it('deve colapsar múltiplos newlines e filtrar linhas vazias', () => {
    expect(engine.postProcessText('a\n\n\n\nb')).toBe('A\nB');
  });

  it('deve colapsar múltiplos espaços em um', () => {
    expect(engine.postProcessText('hello    world')).toBe('Hello world');
  });

  it('deve remover espaço antes de newline', () => {
    expect(engine.postProcessText('hello \nworld')).toBe('Hello\nWorld');
  });

  it('deve remover espaço após newline', () => {
    expect(engine.postProcessText('hello\n world')).toBe('Hello\nWorld');
  });

  it('deve filtrar tokens sem letras ou dígitos', () => {
    expect(engine.postProcessText('hello !!! world ...')).toBe('Hello world');
  });

  it('deve capitalizar início de cada linha', () => {
    expect(engine.postProcessText('hello\nworld')).toBe('Hello\nWorld');
  });

  it('deve manter dígitos em tokens', () => {
    expect(engine.postProcessText('test123')).toBe('Test123');
  });

  it('deve retornar string vazia para input vazio', () => {
    expect(engine.postProcessText('')).toBe('');
  });

  it('deve retornar string vazia para input só com pontuação', () => {
    expect(engine.postProcessText('!!! ... ???')).toBe('');
  });

  it('deve preservar caracteres Unicode (acentos, ç)', () => {
    expect(engine.postProcessText('ação')).toBe('Ação');
  });

  it('deve colapsar \\r\\n em \\n', () => {
    expect(engine.postProcessText('hello\r\nworld')).toBe('Hello\nWorld');
  });

  it('deve colapsar \\r sozinho em \\n', () => {
    expect(engine.postProcessText('hello\rworld')).toBe('Hello\nWorld');
  });

  it('deve filtrar tabs como whitespace', () => {
    expect(engine.postProcessText('hello\t\tworld')).toBe('Hello world');
  });

  it('deve manter token com dígitos mesmo misturado com pontuação', () => {
    expect(engine.postProcessText('word1, word2.')).toBe('Word1, word2.');
  });
});

// ─── Constructor & config ────────────────────────────────────────────────────

describe('OCREngine constructor', () => {
  it('deve usar defaults corretos', () => {
    const engine = new OCREngine();
    expect(engine).toBeDefined();
  });

  it('deve aceitar config parcial', () => {
    const engine = new OCREngine({ language: 'eng' });
    expect(engine).toBeDefined();
  });
});

// ─── initialize / terminate ──────────────────────────────────────────────────

describe('OCREngine.initialize / terminate', () => {
  let mockWorker: any;

  beforeEach(async () => {
    mockWorker = {
      setParameters: vi.fn().mockResolvedValue(undefined),
      terminate: vi.fn().mockResolvedValue(undefined),
    };
    const { createWorker } = await import('tesseract.js');
    vi.mocked(createWorker).mockResolvedValue(mockWorker);
  });

  it('deve criar worker e setar parâmetros', async () => {
    const engine = new OCREngine();
    await engine.initialize('eng');

    const { createWorker } = await import('tesseract.js');
    expect(createWorker).toHaveBeenCalledWith('eng');
    expect(mockWorker.setParameters).toHaveBeenCalled();
  });

  it('deve terminar worker e setar como null', async () => {
    const engine = new OCREngine();
    await engine.initialize();
    await engine.terminate();

    expect(mockWorker.terminate).toHaveBeenCalled();
  });
});

// ─── recognizeClue (via mock) ────────────────────────────────────────────────

describe('OCREngine.recognizeClue', () => {
  let mockWorker: any;
  let engine: OCREngine;

  beforeEach(async () => {
    mockWorker = {
      setParameters: vi.fn().mockResolvedValue(undefined),
      recognize: vi.fn().mockResolvedValue({
        data: { text: '  hello  ', confidence: 85 },
      }),
      terminate: vi.fn().mockResolvedValue(undefined),
    };
    const { createWorker } = await import('tesseract.js');
    vi.mocked(createWorker).mockResolvedValue(mockWorker);

    engine = new OCREngine();
    await engine.initialize();
  });

  it('deve lançar se worker não inicializado', async () => {
    const engine = new OCREngine();
    await expect(
      engine.recognizeClue({} as ImageData, 0)
    ).rejects.toThrow('OCR Engine não inicializado');
  });

  it('deve retornar ClueResult com texto processado e confiança normalizada', async () => {
    const imageData = { width: 50, height: 20 } as ImageData;
    const result = await engine.recognizeClue(imageData, 3);

    expect(result.row).toBe(3);
    expect(result.text).toBe('Hello');
    expect(result.confidence).toBe(0.85);
    expect(result.rawText).toBe('  hello  ');
  });

  it('deve clampar confiança entre 0 e 1', async () => {
    mockWorker.recognize.mockResolvedValue({
      data: { text: 'test', confidence: 150 },
    });

    const result = await engine.recognizeClue({} as ImageData, 0);
    expect(result.confidence).toBe(1);
  });
});
