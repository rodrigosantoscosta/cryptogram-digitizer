/**
 * Testes unitários para GridDetector — nova abordagem HoughLinesP + Interseção
 *
 * Estratégia: mock do OpenCV.js para testar a lógica pura de:
 *  - separação H/V de segmentos
 *  - acumulador de interseções
 *  - clusterPeaks + regularizeByMedianGap
 *  - validateUniformity
 *  - lineIntersect
 *
 * Os testes de integração (pipeline completo) devem ser feitos no navegador
 * via TestPage (npm run dev) com imagens reais.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock do OpenCV.js ────────────────────────────────────────────────────────
// GridDetector usa `cv` como global; precisamos simular o comportamento
// de Canny + HoughLinesP para controlar o que entra no acumulador.

// Grid 4×4 — cada posição duplicada 3x para garantir ≥3 votos no acumulador
const mockHSegments = [
  [10, 50, 290, 50], [11, 50, 289, 50], [12, 50, 288, 50],
  [10, 100, 290, 100], [11, 100, 289, 100], [12, 100, 288, 100],
  [10, 150, 290, 150], [11, 150, 289, 150], [12, 150, 288, 150],
  [10, 200, 290, 200], [11, 200, 289, 200], [12, 200, 288, 200],
];

const mockVSegments = [
  [50, 10, 50, 290], [50, 11, 50, 289], [50, 12, 50, 288],
  [100, 10, 100, 290], [100, 11, 100, 289], [100, 12, 100, 288],
  [150, 10, 150, 290], [150, 11, 150, 289], [150, 12, 150, 288],
  [200, 10, 200, 290], [200, 11, 200, 289], [200, 12, 200, 288],
];

// Segmentos intercalados: HoughLinesP retorna H e V misturados
const allSegments = [...mockHSegments, ...mockVSegments];

function makeMockLinesOut() {
  const flat: number[] = allSegments.flat();
  return {
    rows: allSegments.length,
    data32S: flat,
    delete: vi.fn(),
  };
}

function makeMockMat(opts?: { channels?: number; rows?: number; cols?: number }) {
  const m: any = {
    channels: () => opts?.channels ?? 1,
    rows: opts?.rows ?? 300,
    cols: opts?.cols ?? 300,
    ucharPtr: (_i: number, _j: number) => [128],
    delete: vi.fn(),
    copyTo: vi.fn(),
    roi: vi.fn(() => makeMockMat()),  // used by detectByMorphology
  };
  return m;
}

// Simula gl.global cv com os métodos usados por detectByHoughIntersection
const cvMock = {
  COLOR_RGBA2GRAY: 'COLOR_RGBA2GRAY',
  COLOR_RGB2GRAY:  'COLOR_RGB2GRAY',
  cvtColor: vi.fn((src: any, dst: any) => Object.assign(dst, makeMockMat())),
  Canny: vi.fn(),
  HoughLinesP: vi.fn((_edges: any, out: any) => {
    const mock = makeMockLinesOut();
    out.rows = mock.rows;
    out.data32S = mock.data32S;
    out.delete = mock.delete;
  }),
  matFromImageData: vi.fn(() => makeMockMat({ channels: 4, rows: 300, cols: 300 })),
  Mat: vi.fn(() => makeMockMat()),
  // Used by detectByContours / detectByMorphology fallbacks
  threshold: vi.fn(),
  findContours: vi.fn(),
  getStructuringElement: vi.fn(() => ({ delete: vi.fn() })),
  morphologyEx: vi.fn(),
  THRESH_BINARY_INV: 8,
  THRESH_OTSU: 16,
  MORPH_RECT: 0,
  MORPH_CLOSE: 3,
  RETR_TREE: 3,
  RETR_EXTERNAL: 0,
  CHAIN_APPROX_SIMPLE: 1,
  contourArea: vi.fn(() => 2500),
  arcLength: vi.fn(() => 200),
  approxPolyDP: vi.fn((_c: any, approx: any) => Object.assign(approx, { rows: 4, delete: vi.fn() })),
  boundingRect: vi.fn(() => ({ x: 10, y: 10, width: 50, height: 50 })),
  mean: vi.fn(() => [100]),
  bitwise_not: vi.fn(),
  erode: vi.fn(),
  dilate: vi.fn(),
  Size: vi.fn((w: number, h: number) => ({ width: w, height: h })),
  Rect: vi.fn((x: number, y: number, w: number, h: number) => ({ x, y, width: w, height: h })),
  Point: vi.fn((x: number, y: number) => ({ x, y })),
  Scalar: vi.fn((...args: number[]) => args),
  line: vi.fn(),
  imshow: vi.fn(),
  MatVector: vi.fn(() => ({ size: () => 0, get: vi.fn(), delete: vi.fn() })),
};

// Injetar mock no escopo global antes de importar GridDetector
(globalThis as any).cv = cvMock;

// Importar após o mock estar no global
import { GridDetector } from '../../lib/image-processing/GridDetector';

// ─── Helpers de teste ─────────────────────────────────────────────────────────

function makeImageData(width = 300, height = 300): ImageData {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4).fill(128),
    colorSpace: 'srgb',
  } as ImageData;
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('GridDetector — detectByHoughIntersection (via detect())', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restaurar comportamento padrão do HoughLinesP para retornar segmentos de grade
    cvMock.HoughLinesP.mockImplementation((_edges: any, out: any) => {
      const mock = makeMockLinesOut();
      out.rows = mock.rows; out.data32S = mock.data32S; out.delete = mock.delete;
    });
    cvMock.Mat.mockImplementation(() => makeMockMat());
    cvMock.matFromImageData.mockImplementation(() =>
      makeMockMat({ channels: 4, rows: 300, cols: 300 })
    );
  });

  it('deve detectar grade 3×3 a partir de segmentos simulados', () => {
    const result = GridDetector.detect(makeImageData());

    expect(result.rows).toBeGreaterThanOrEqual(3);
    expect(result.cols).toBeGreaterThanOrEqual(3);
  });

  it('GridResult deve ter rowPositions e colPositions com tamanho rows+1 e cols+1', () => {
    const result = GridDetector.detect(makeImageData());

    expect(result.rowPositions).toHaveLength(result.rows + 1);
    expect(result.colPositions).toHaveLength(result.cols + 1);
  });

  it('colWidths deve ter exatamente result.cols elementos', () => {
    const result = GridDetector.detect(makeImageData());
    expect(result.colWidths).toHaveLength(result.cols);
  });

  it('rowHeights deve ter exatamente result.rows elementos', () => {
    const result = GridDetector.detect(makeImageData());
    expect(result.rowHeights).toHaveLength(result.rows);
  });

  it('roi deve estar dentro dos limites da imagem', () => {
    const result = GridDetector.detect(makeImageData(300, 300));

    expect(result.roi.x).toBeGreaterThanOrEqual(0);
    expect(result.roi.y).toBeGreaterThanOrEqual(0);
    expect(result.roi.x + result.roi.width).toBeLessThanOrEqual(300);
    expect(result.roi.y + result.roi.height).toBeLessThanOrEqual(300);
  });

  it('colPositions deve estar ordenada de forma crescente', () => {
    const result = GridDetector.detect(makeImageData());
    for (let i = 1; i < result.colPositions.length; i++) {
      expect(result.colPositions[i]).toBeGreaterThan(result.colPositions[i - 1]);
    }
  });

  it('rowPositions deve estar ordenada de forma crescente', () => {
    const result = GridDetector.detect(makeImageData());
    for (let i = 1; i < result.rowPositions.length; i++) {
      expect(result.rowPositions[i]).toBeGreaterThan(result.rowPositions[i - 1]);
    }
  });

  it('colWidths deve ter todos os valores positivos', () => {
    const result = GridDetector.detect(makeImageData());
    for (const w of result.colWidths) {
      expect(w).toBeGreaterThan(0);
    }
  });

  it('rowHeights deve ter todos os valores positivos', () => {
    const result = GridDetector.detect(makeImageData());
    for (const h of result.rowHeights) {
      expect(h).toBeGreaterThan(0);
    }
  });

  it('deve usar Canny (não threshold) no caminho primário', () => {
    GridDetector.detect(makeImageData());
    expect(cvMock.Canny).toHaveBeenCalled();
  });

  it('deve chamar HoughLinesP no caminho primário', () => {
    GridDetector.detect(makeImageData());
    expect(cvMock.HoughLinesP).toHaveBeenCalled();
  });
});

describe('GridDetector — fallback quando Hough falha', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve tentar contornos quando HoughLinesP retorna 0 segmentos', () => {
    // Hough retorna vazio → deve tentar detectByContours
    cvMock.HoughLinesP.mockImplementation((_edges: any, out: any) => {
      out.rows = 0; out.data32S = []; out.delete = vi.fn();
    });
    cvMock.Mat.mockImplementation(() => makeMockMat());
    cvMock.matFromImageData.mockImplementation(() =>
      makeMockMat({ channels: 4, rows: 300, cols: 300 })
    );

    // findContours retorna 0 contornos → cai no morfológico
    cvMock.MatVector.mockImplementation(() => ({
      size: () => 0,
      get: vi.fn(),
      delete: vi.fn(),
    }));

    // Morfológico vai falhar também sem dados reais — apenas verificar que
    // o pipeline não quebra silenciosamente (lança erro gerenciado)
    expect(() => GridDetector.detect(makeImageData())).toThrow();
  });
});

describe('GridDetector.extractCell — contrato de saída', () => {
  it('deve lançar erro para índices fora dos limites', () => {
    const mockGrid = {
      roi: { x: 0, y: 0, width: 200, height: 200 },
      rowPositions: [0, 50, 100, 150, 200],
      colPositions: [0, 50, 100, 150, 200],
      colWidths: [50, 50, 50, 50],
      rowHeights: [50, 50, 50, 50],
      rows: 4,
      cols: 4,
    };

    expect(() =>
      GridDetector.extractCell(makeImageData(), 10, 0, mockGrid)
    ).toThrow('Índices fora dos limites');

    expect(() =>
      GridDetector.extractCell(makeImageData(), 0, 10, mockGrid)
    ).toThrow('Índices fora dos limites');
  });
});
