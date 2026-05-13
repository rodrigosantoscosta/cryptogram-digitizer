import type { PSM } from 'tesseract.js';

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