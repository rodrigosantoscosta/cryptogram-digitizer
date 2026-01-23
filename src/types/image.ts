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
 * Características extraídas de um símbolo
 */
export interface SymbolFeatures {
  area: number;
  perimeter: number;
  aspectRatio: number;
  moments: number[]; // Hu Moments (7 valores)
  histogram: number[];
  centerOfMass: Point;
  extent?: number; // Razão área/área do bounding box
  solidity?: number; // Razão área/área do convex hull
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