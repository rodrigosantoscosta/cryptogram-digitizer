/**
 * Tipos para processamento de imagem
 * Define as estruturas de dados básicas de visão computacional
 */

/**
 * Ponto 2D
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Retângulo delimitador
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Linha detectada com informações geométricas
 */
export interface Line {
  p1: Point;
  p2: Point;
  angle: number;
  length: number;
}

/**
 * Contorno de um símbolo
 */
export interface Contour {
  points: Point[];
  boundingBox: BoundingBox;
  area?: number;
  perimeter?: number;
}

/**
 * Estrutura da tabela detectada
 */
export interface TableStructure {
  rows: number;
  cols: number;
  cellWidth: number;
  cellHeight: number;
  gridPoints: Point[][];
  clueColumnWidth: number;
  answerColumnWidth: number;
}

/**
 * Resultado da detecção de grade (GridDetector)
 */
export interface GridResult {
  roi: BoundingBox;
  rowPositions: number[];
  colPositions: number[];
  colWidths: number[];
  rowHeights: number[];
  rows: number;
  cols: number;
}

