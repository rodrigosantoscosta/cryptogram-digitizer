/**
 * Tipos para processamento de imagem
 * Define as estruturas de dados usadas no pipeline de processamento
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
 * Estrutura da tabela detectada (legado — usar GridResult para novas implementações)
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
 *
 * Substitui TableStructure como saída primária da detecção de células.
 * Suporta colunas de larguras não-uniformes (ex.: coluna de pistas mais larga).
 */
export interface GridResult {
  /** Bounding box da tabela em coordenadas da imagem original */
  roi: BoundingBox;
  /** Posições Y das linhas horizontais — absolutas, inclui as bordas superior e inferior */
  rowPositions: number[];
  /** Posições X das linhas verticais — absolutas, inclui as bordas esquerda e direita */
  colPositions: number[];
  /** Largura de cada coluna (length === cols) */
  colWidths: number[];
  /** Altura de cada linha (length === rows) */
  rowHeights: number[];
  /** Número de linhas de células */
  rows: number;
  /** Número de colunas de células */
  cols: number;
}

/**
 * Características extraídas de um símbolo
 */
export interface SymbolFeatures {
  area: number;
  perimeter: number;
  aspectRatio: number;
  moments: number[]; // Hu Moments (7 valores) — já log-normalizados
  histogram: number[];
  centerOfMass: Point;
  extent?: number;
  solidity?: number;
}

/**
 * Símbolo extraído de uma célula
 */
export interface ExtractedSymbol {
  id: string;
  imageData: ImageData;
  features: SymbolFeatures;
  positions: CellPosition[];
  hash: string;
}

/**
 * Posição de célula no grid
 */
export interface CellPosition {
  row: number;
  col: number;
}

/**
 * Cluster de símbolos similares
 */
export interface SymbolCluster {
  id: string;
  representativeSymbol: ExtractedSymbol;
  members: ExtractedSymbol[];
  avgFeatures: SymbolFeatures;
  count: number;
}

/**
 * Símbolo único identificado
 */
export interface UniqueSymbol {
  clusterId: string;
  symbol: ExtractedSymbol;
  occurrences: CellPosition[];
  mappedLetter: string | null;
}

/**
 * Status de processamento
 */
export type ProcessingStage =
  | 'idle'
  | 'preprocessing'
  | 'detecting'
  | 'extracting'
  | 'classifying'
  | 'ocr'
  | 'complete'
  | 'error';

export interface ProcessingStatus {
  stage: ProcessingStage;
  progress: number; // 0-100
  currentStep: string;
  error: Error | null;
}

/**
 * Dados processados da imagem
 */
export interface ProcessedData {
  preprocessedImage: ImageData;
  tableStructure: TableStructure;
  grid: GridResult;
  clues: ClueResult[];
  extractedSymbols: ExtractedSymbol[];
  uniqueSymbols: UniqueSymbol[];
  processedAt: Date;
}

/**
 * Resultado de OCR de uma pista
 */
export interface ClueResult {
  row: number;
  text: string;
  confidence: number;
  rawText: string;
}
