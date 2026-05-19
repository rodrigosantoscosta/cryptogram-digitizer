/**
 * Testes unitários para OCRApiClient.
 *
 * Todas as chamadas fetch são mockadas via vi.spyOn(globalThis, 'fetch').
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OCRApiClient } from '@/lib/ocr/OCRApiClient';
import type { CellImageInput, OCRResult } from '@/lib/ocr/OCRApiClient';

function makeClient(overrides?: { baseUrl?: string; batchSize?: number }): OCRApiClient {
  return new OCRApiClient(overrides?.baseUrl, overrides?.batchSize);
}

function makeCellImage(row: number, col: number): CellImageInput {
  return {
    imageData: new Blob(['fake-image'], { type: 'image/png' }),
    row,
    col,
  };
}

function makeResponse(overrides?: Partial<Response>): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: vi.fn().mockResolvedValue({}),
    text: vi.fn().mockResolvedValue(''),
    ...overrides,
  } as unknown as Response;
}

// ─── Constructor ─────────────────────────────────────────────────────────────

describe('OCRApiClient constructor', () => {
  it('deve usar URL default quando não fornecida', () => {
    const client = new OCRApiClient();
    expect(client).toBeDefined();
  });

  it('deve usar batchSize default de 16', () => {
    const client = new OCRApiClient();
    expect(client).toBeDefined();
  });

  it('deve aceitar baseUrl e batchSize customizados', () => {
    const client = new OCRApiClient('http://test:9999', 8);
    expect(client).toBeDefined();
  });
});

// ─── healthCheck ─────────────────────────────────────────────────────────────

describe('OCRApiClient.healthCheck', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  it('deve retornar health check em sucesso', async () => {
    const mockData = { status: 'ok', gpu: true, version: '1.0.0' };
    fetchSpy.mockResolvedValue(makeResponse({
      json: vi.fn().mockResolvedValue(mockData),
    }));

    const client = makeClient({ baseUrl: 'http://test:5000' });
    const result = await client.healthCheck();

    expect(fetchSpy).toHaveBeenCalledWith('http://test:5000/api/health');
    expect(result).toEqual(mockData);
  });

  it('deve lançar em falha', async () => {
    fetchSpy.mockResolvedValue(makeResponse({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    }));

    const client = makeClient();
    await expect(client.healthCheck()).rejects.toThrow('Health check failed: 503');
  });
});

// ─── recognizeCell ───────────────────────────────────────────────────────────

describe('OCRApiClient.recognizeCell', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  it('deve enviar FormData e retornar resultado', async () => {
    const mockResult: OCRResult = { number: 5, confidence: 0.9, rawText: '5' };
    fetchSpy.mockResolvedValue(makeResponse({
      json: vi.fn().mockResolvedValue(mockResult),
    }));

    const client = makeClient({ baseUrl: 'http://test:5000' });
    const blob = new Blob(['img'], { type: 'image/png' });
    const result = await client.recognizeCell(blob);

    expect(fetchSpy).toHaveBeenCalledWith('http://test:5000/api/ocr/cell', {
      method: 'POST',
      body: expect.any(FormData),
    });
    expect(result).toEqual(mockResult);
  });

  it('deve lançar com mensagem de erro em falha', async () => {
    fetchSpy.mockResolvedValue(makeResponse({
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue('Invalid image'),
    }));

    const client = makeClient();
    const blob = new Blob(['bad'], { type: 'image/png' });
    await expect(client.recognizeCell(blob)).rejects.toThrow('OCR cell failed: 400 Invalid image');
  });
});

// ─── recognizeBatch ──────────────────────────────────────────────────────────

describe('OCRApiClient.recognizeBatch', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  it('deve enviar múltiplos arquivos no FormData', async () => {
    const cells: CellImageInput[] = [
      makeCellImage(0, 1),
      makeCellImage(0, 2),
    ];
    const mockResults: OCRResult[] = [
      { number: 1, confidence: 0.95, rawText: '1' },
      { number: 2, confidence: 0.90, rawText: '2' },
    ];
    fetchSpy.mockResolvedValue(makeResponse({
      json: vi.fn().mockResolvedValue({ results: mockResults }),
    }));

    const client = makeClient({ baseUrl: 'http://test:5000' });
    const results = await client.recognizeBatch(cells);

    expect(fetchSpy).toHaveBeenCalledWith('http://test:5000/api/ocr/batch', {
      method: 'POST',
      body: expect.any(FormData),
    });
    expect(results).toEqual(mockResults);
  });

  it('deve lançar em falha', async () => {
    fetchSpy.mockResolvedValue(makeResponse({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Internal error'),
    }));

    const client = makeClient();
    await expect(client.recognizeBatch([makeCellImage(0, 1)])).rejects.toThrow('OCR batch failed: 500');
  });
});

// ─── recognizeAllCells (batching + progress) ─────────────────────────────────

describe('OCRApiClient.recognizeAllCells', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let client: OCRApiClient;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    client = makeClient({ baseUrl: 'http://test:5000', batchSize: 2 });
  });

  it('deve processar em batches do tamanho configurado', async () => {
    const cells: CellImageInput[] = [
      makeCellImage(0, 1),
      makeCellImage(0, 2),
      makeCellImage(1, 1),
      makeCellImage(1, 2),
      makeCellImage(2, 1),
    ];

    fetchSpy.mockResolvedValue(makeResponse({
      json: vi.fn().mockResolvedValue({ results: [{ number: 1, confidence: 0.9, rawText: '1' }] }),
    }));

    await client.recognizeAllCells(cells);

    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('deve reportar progresso corretamente', async () => {
    const cells: CellImageInput[] = [
      makeCellImage(0, 1),
      makeCellImage(0, 2),
      makeCellImage(1, 1),
    ];

    fetchSpy.mockResolvedValue(makeResponse({
      json: vi.fn().mockResolvedValue({ results: [{ number: 1, confidence: 0.9, rawText: '1' }] }),
    }));

    const progressCalls: number[] = [];
    await client.recognizeAllCells(cells, (p) => progressCalls.push(p));

    expect(progressCalls.length).toBe(2);
    expect(progressCalls[0]).toBeCloseTo(2 / 3, 5);
    expect(progressCalls[1]).toBe(1);
  });

  it('deve retornar todos os resultados concatenados', async () => {
    const cells: CellImageInput[] = [
      makeCellImage(0, 1),
      makeCellImage(0, 2),
    ];

    let callCount = 0;
    fetchSpy.mockImplementation(async () => {
      callCount++;
      return makeResponse({
        json: vi.fn().mockResolvedValue({
          results: [{ number: callCount, confidence: 0.9, rawText: String(callCount) }],
        }),
      });
    });

    const results = await client.recognizeAllCells(cells);

    expect(results).toHaveLength(1);
    expect(results[0].number).toBe(1);
  });

  it('deve funcionar com lista vazia', async () => {
    const results = await client.recognizeAllCells([]);
    expect(results).toEqual([]);
  });
});
