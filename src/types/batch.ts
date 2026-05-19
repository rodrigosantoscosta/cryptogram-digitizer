// src/types/batch.ts
import type { ProcessedData } from './puzzle';

export interface BatchImage {
  id: string;
  file: File;
  name: string;
  preview: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  processedData: ProcessedData | null;
  error: string | null;
}

export interface BatchState {
  images: BatchImage[];
  currentIndex: number;
  isProcessing: boolean;
}
