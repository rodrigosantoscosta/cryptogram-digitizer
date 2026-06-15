export interface ClueResult {
  row: number;
  text: string;
  confidence: number;
  rawText: string;
}

export interface OCRConfig {
  apiUrl?: string;
  batchSize?: number;
  language?: string;
  whitelist?: string;
  pageSegMode?: number;
}

export interface EasyOCRResult {
  number: number | null;
  confidence: number;
  rawText: string;
  error?: string;
}

export interface EasyOCRHealthCheck {
  status: string;
  gpu: boolean;
  version: string;
}

export interface CellNumber {
  row: number;
  col: number;
  number: number | null;
  confidence: number;
  rawText: string;
  rawOcr: string;
}

export interface CellNumberMap {
  cells: CellNumber[];
  bySymbol: Record<string, Array<{ row: number; col: number }>>;
  recognized: number;
  total: number;
  aborted?: boolean;
  abortReason?: string;
}


export interface GroundTruthPuzzle {
  puzzleId: string;
  sourceImage: string;
  type: 'numeric' | 'pictogram';
  dimensions: { rows: number; cols: number };
  valueRange: { min: number; max: number };
  grid: (number | null)[][];
  frequency: Record<string, number>;
  metadata: {
    validatedBy: string;
    validatedAt: string;
    notes?: string;
  };
}

export interface CellComparison {
  row: number;
  col: number;
  expected: number | null;
  actual: number | null;
  confidence: number;
  match: 'correct' | 'incorrect' | 'missed' | 'extra' | 'aborted';
}

export interface PuzzleMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  coverage: number;
  editDistance: number;
  normalizedEditDistance: number;
  perDigit: Record<string, DigitMetrics>;
}

export interface DigitMetrics {
  digit: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
}

export interface ComparisonResult {
  puzzleId: string;
  timestamp: string;
  cells: CellComparison[];
  metrics: PuzzleMetrics;
  aborted: boolean;
  abortReason?: string;
}

export interface BatchConfig {
  apiUrl: string;
  earlyAbortThreshold: number;
  minCellsProcessed: number;
  puzzles: string[];
}

export interface AggregateMetrics {
  totalPuzzles: number;
  totalCells: number;
  overallAccuracy: number;
  overallPrecision: number;
  overallRecall: number;
  overallF1: number;
  averageEditDistance: number;
  perPuzzleSummary: { puzzleId: string; accuracy: number; coverage: number }[];
}

export interface BatchResult {
  runId: string;
  timestamp: string;
  puzzles: ComparisonResult[];
  aggregate: AggregateMetrics;
  config: BatchConfig;
}
