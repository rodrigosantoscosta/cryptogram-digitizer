/**
 * Testes unitários para TableDetector — funções puras (sem OpenCV)
 *
 * separateLines, mergeCloseLines, extendLines, calculateIntersections,
 * filterByLength são funções estáticas que operam em dados puros.
 */

import { describe, it, expect } from 'vitest';
import { TableDetector } from '../../lib/image-processing/TableDetector';
import type { Line } from '@/types/image';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLine(
  x1: number, y1: number, x2: number, y2: number,
  overrides: Partial<Line> = {}
): Line {
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  return {
    p1: { x: x1, y: y1 },
    p2: { x: x2, y: y2 },
    angle,
    length,
    ...overrides,
  };
}

// ─── TableDetector.separateLines ──────────────────────────────────────────────

describe('TableDetector.separateLines', () => {
  it('deve classificar linha horizontal (ângulo ~0°)', () => {
    const lines: Line[] = [makeLine(0, 50, 200, 50)];
    const { horizontal, vertical } = TableDetector.separateLines(lines);
    expect(horizontal).toHaveLength(1);
    expect(vertical).toHaveLength(0);
  });

  it('deve classificar linha vertical (ângulo ~90°)', () => {
    const lines: Line[] = [makeLine(50, 0, 50, 200)];
    const { horizontal, vertical } = TableDetector.separateLines(lines);
    expect(horizontal).toHaveLength(0);
    expect(vertical).toHaveLength(1);
  });

  it('deve separar linhas mistas corretamente', () => {
    const lines: Line[] = [
      makeLine(0, 50, 200, 50),   // horizontal
      makeLine(50, 0, 50, 200),   // vertical
      makeLine(0, 100, 200, 100), // horizontal
      makeLine(150, 0, 150, 200), // vertical
    ];
    const { horizontal, vertical } = TableDetector.separateLines(lines);
    expect(horizontal).toHaveLength(2);
    expect(vertical).toHaveLength(2);
  });

  it('deve usar angleThreshold padrão de 10°', () => {
    // Linha com 5° de inclinação deve ser horizontal
    const lines: Line[] = [makeLine(0, 50, 200, 50 + Math.round(200 * Math.tan(5 * Math.PI / 180)))];
    const { horizontal, vertical } = TableDetector.separateLines(lines);
    expect(horizontal).toHaveLength(1);
    expect(vertical).toHaveLength(0);
  });

  it('deve classificar linha com ângulo ~180° como horizontal', () => {
    const lines: Line[] = [makeLine(200, 50, 0, 50)];
    const { horizontal, vertical } = TableDetector.separateLines(lines);
    expect(horizontal).toHaveLength(1);
    expect(vertical).toHaveLength(0);
  });

  it('deve classificar linha com ângulo ~-90° como vertical', () => {
    const lines: Line[] = [makeLine(50, 200, 50, 0)];
    const { horizontal, vertical } = TableDetector.separateLines(lines);
    expect(horizontal).toHaveLength(0);
    expect(vertical).toHaveLength(1);
  });

  it('deve ignorar linhas diagonais fora do threshold', () => {
    const lines: Line[] = [makeLine(0, 0, 100, 100)]; // 45°
    const { horizontal, vertical } = TableDetector.separateLines(lines);
    expect(horizontal).toHaveLength(0);
    expect(vertical).toHaveLength(0);
  });

  it('deve retornar arrays vazios para input vazio', () => {
    const { horizontal, vertical } = TableDetector.separateLines([]);
    expect(horizontal).toEqual([]);
    expect(vertical).toEqual([]);
  });

  it('deve respeitar angleThreshold customizado', () => {
    // Linha com 15° de inclinação
    const lines: Line[] = [makeLine(0, 50, 200, 50 + Math.round(200 * Math.tan(15 * Math.PI / 180)))];
    // Threshold padrão (10°) → não é horizontal
    const r1 = TableDetector.separateLines(lines);
    expect(r1.horizontal).toHaveLength(0);
    // Threshold 20° → é horizontal
    const r2 = TableDetector.separateLines(lines, 20);
    expect(r2.horizontal).toHaveLength(1);
  });
});

// ─── TableDetector.filterByLength ─────────────────────────────────────────────

describe('TableDetector.filterByLength', () => {
  it('deve filtrar linhas abaixo do comprimento mínimo', () => {
    const lines: Line[] = [
      makeLine(0, 0, 50, 0),   // length=50
      makeLine(0, 50, 200, 50), // length=200
      makeLine(0, 100, 80, 100), // length=80
    ];

    const result = TableDetector.filterByLength(lines, 100);

    expect(result).toHaveLength(1);
    expect(result[0].length).toBe(200);
  });

  it('deve retornar todas as linhas se minLength=0', () => {
    const lines: Line[] = [
      makeLine(0, 0, 10, 0),
      makeLine(0, 50, 200, 50),
    ];

    const result = TableDetector.filterByLength(lines, 0);

    expect(result).toHaveLength(2);
  });

  it('deve retornar array vazio se nenhuma linha passa', () => {
    const lines: Line[] = [
      makeLine(0, 0, 10, 0),
      makeLine(0, 50, 20, 50),
    ];

    const result = TableDetector.filterByLength(lines, 100);

    expect(result).toEqual([]);
  });

  it('deve retornar array vazio para input vazio', () => {
    expect(TableDetector.filterByLength([], 50)).toEqual([]);
  });
});

// ─── TableDetector.extendLines ────────────────────────────────────────────────

describe('TableDetector.extendLines', () => {
  it('deve estender linhas horizontais para largura total da imagem', () => {
    const lines: Line[] = [makeLine(50, 100, 150, 100)];

    const result = TableDetector.extendLines(lines, 300, 400);

    expect(result).toHaveLength(1);
    expect(result[0].p1.x).toBe(0);
    expect(result[0].p1.y).toBe(100);
    expect(result[0].p2.x).toBe(300);
    expect(result[0].p2.y).toBe(100);
    expect(result[0].length).toBe(300);
  });

  it('deve estender linhas verticais para altura total da imagem', () => {
    const lines: Line[] = [makeLine(100, 50, 100, 150)];

    const result = TableDetector.extendLines(lines, 300, 400);

    expect(result).toHaveLength(1);
    expect(result[0].p1.x).toBe(100);
    expect(result[0].p1.y).toBe(0);
    expect(result[0].p2.x).toBe(100);
    expect(result[0].p2.y).toBe(400);
    expect(result[0].length).toBe(400);
  });

  it('deve estender múltiplas linhas', () => {
    const lines: Line[] = [
      makeLine(50, 100, 150, 100), // horizontal
      makeLine(100, 50, 100, 150), // vertical
    ];

    const result = TableDetector.extendLines(lines, 300, 400);

    expect(result).toHaveLength(2);
    expect(result[0].p1.x).toBe(0);
    expect(result[1].p1.y).toBe(0);
  });

  it('deve lidar com input vazio', () => {
    expect(TableDetector.extendLines([], 300, 400)).toEqual([]);
  });

  it('deve usar a média de y para linhas horizontais', () => {
    const lines: Line[] = [makeLine(50, 98, 150, 102)]; // y médio = 100

    const result = TableDetector.extendLines(lines, 300, 400);

    expect(result[0].p1.y).toBe(100);
    expect(result[0].p2.y).toBe(100);
  });
});

// ─── TableDetector.calculateIntersections ─────────────────────────────────────

describe('TableDetector.calculateIntersections', () => {
  it('deve calcular grade de intersecções H×V', () => {
    const horizontal: Line[] = [
      makeLine(0, 0, 300, 0),
      makeLine(0, 100, 300, 100),
      makeLine(0, 200, 300, 200),
    ];
    const vertical: Line[] = [
      makeLine(0, 0, 0, 200),
      makeLine(100, 0, 100, 200),
      makeLine(200, 0, 200, 200),
      makeLine(300, 0, 300, 200),
    ];

    const grid = TableDetector.calculateIntersections(horizontal, vertical);

    expect(grid).toHaveLength(3); // 3 rows
    expect(grid[0]).toHaveLength(4); // 4 cols
    expect(grid[0][0]).toEqual({ x: 0, y: 0 });
    expect(grid[1][1]).toEqual({ x: 100, y: 100 });
    expect(grid[2][3]).toEqual({ x: 300, y: 200 });
  });

  it('deve usar a média dos pontos para calcular intersecção', () => {
    const horizontal: Line[] = [makeLine(0, 98, 300, 102)]; // y médio = 100
    const vertical: Line[] = [makeLine(98, 0, 102, 200)]; // x médio = 100

    const grid = TableDetector.calculateIntersections(horizontal, vertical);

    expect(grid[0][0]).toEqual({ x: 100, y: 100 });
  });

  it('deve lidar com listas vazias', () => {
    expect(TableDetector.calculateIntersections([], [])).toEqual([]);
    expect(TableDetector.calculateIntersections([makeLine(0, 0, 100, 0)], [])).toEqual([[]]);
    expect(TableDetector.calculateIntersections([], [makeLine(0, 0, 0, 100)])).toEqual([]);
  });
});

// ─── TableDetector.mergeCloseLines ────────────────────────────────────────────

describe('TableDetector.mergeCloseLines', () => {
  it('deve retornar array vazio para input vazio', () => {
    expect(TableDetector.mergeCloseLines([])).toEqual([]);
  });

  it('deve retornar linha única se não há linhas próximas', () => {
    const lines: Line[] = [
      makeLine(0, 0, 200, 0),
      makeLine(0, 100, 200, 100),
    ];

    const result = TableDetector.mergeCloseLines(lines, 15);

    expect(result).toHaveLength(2);
  });

  it('deve mesclar linhas próximas (dentro do threshold)', () => {
    const lines: Line[] = [
      makeLine(0, 50, 200, 50),
      makeLine(0, 55, 200, 55), // 5px de distância
    ];

    const result = TableDetector.mergeCloseLines(lines, 15);

    expect(result).toHaveLength(1);
    // Posição média = 52.5
    expect(result[0].p1.y).toBe(53); // arredondado
    expect(result[0].p2.y).toBe(53);
  });

  it('deve mesclar múltiplas linhas próximas em uma', () => {
    const lines: Line[] = [
      makeLine(0, 50, 200, 50),
      makeLine(0, 53, 200, 53),
      makeLine(0, 56, 200, 56),
    ];

    const result = TableDetector.mergeCloseLines(lines, 15);

    expect(result).toHaveLength(1);
  });

  it('deve mesclar linhas verticais próximas', () => {
    const lines: Line[] = [
      makeLine(50, 0, 50, 200),
      makeLine(55, 0, 55, 200),
    ];

    const result = TableDetector.mergeCloseLines(lines, 15);

    expect(result).toHaveLength(1);
    expect(result[0].p1.x).toBe(53); // média arredondada
  });

  it('deve usar o maior comprimento ao mesclar', () => {
    const lines: Line[] = [
      makeLine(0, 50, 100, 50),  // length=100
      makeLine(0, 55, 200, 55),  // length=200
    ];

    const result = TableDetector.mergeCloseLines(lines, 15);

    expect(result[0].length).toBe(200);
  });

  it('deve mesclar linhas não ordenadas corretamente', () => {
    const lines: Line[] = [
      makeLine(0, 60, 200, 60),
      makeLine(0, 50, 200, 50),
      makeLine(0, 55, 200, 55),
    ];

    const result = TableDetector.mergeCloseLines(lines, 15);

    expect(result).toHaveLength(1);
  });
});
