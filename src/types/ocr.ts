import type { CellNumberMap } from '@/lib/ocr/CellNumberReader';
import type { PSM } from 'tesseract.js';

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
  pageSegMode?: PSM | number;
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

export type { CellNumberMap };
