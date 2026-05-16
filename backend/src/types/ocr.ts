export interface OCRResult {
  number: number | null;
  confidence: number;
  rawText: string;
  error?: string;
}

export interface OCRBatchResponse {
  results: OCRResult[];
}

export interface HealthResponse {
  status: string;
  gpu: boolean;
  version: string;
}

export interface CellImage {
  cellIndex: number;
  row: number;
  col: number;
  imageData: Buffer;
  mimeType: string;
}
