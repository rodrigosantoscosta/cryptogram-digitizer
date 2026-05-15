import type { PSM } from 'tesseract.js';
import type { CellNumberMap } from '@/lib/ocr/CellNumberReader';

export interface ClueResult {
  row: number;
  text: string;
  confidence: number;
  rawText: string;
}

export interface OCRConfig {
  language: string;
  whitelist?: string;
  pageSegMode?: PSM;
}

export type { CellNumberMap };