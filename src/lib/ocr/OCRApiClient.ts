export interface OCRResult {
  number: number | null;
  confidence: number;
  rawText: string;
  error?: string;
}

export interface OCRBatchResult {
  results: OCRResult[];
}

export interface OCRHealthCheck {
  status: string;
  gpu: boolean;
  version: string;
}

export interface CellImageInput {
  imageData: Blob;
  row: number;
  col: number;
}

export class OCRApiClient {
  private baseUrl: string;
  private batchSize: number;

  constructor(baseUrl: string = (import.meta as any).env?.VITE_OCR_API_URL || 'http://localhost:4000', batchSize: number = 16) {
    this.baseUrl = baseUrl;
    this.batchSize = batchSize;
  }

  async healthCheck(): Promise<OCRHealthCheck> {
    const response = await fetch(`${this.baseUrl}/api/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  async recognizeCell(imageData: Blob): Promise<OCRResult> {
    const formData = new FormData();
    formData.append('file', imageData, 'cell.png');

    const response = await fetch(`${this.baseUrl}/api/ocr/cell`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OCR cell failed: ${response.status} ${error}`);
    }

    return response.json();
  }

  async recognizeBatch(cells: CellImageInput[]): Promise<OCRResult[]> {
    const formData = new FormData();

    cells.forEach((cell, index) => {
      formData.append('files', cell.imageData, `cell_${index}.png`);
    });

    const response = await fetch(`${this.baseUrl}/api/ocr/batch`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OCR batch failed: ${response.status} ${error}`);
    }

    const data: OCRBatchResult = await response.json();
    return data.results;
  }

  async recognizeAllCells(cells: CellImageInput[], onProgress?: (progress: number) => void): Promise<OCRResult[]> {
    const allResults: OCRResult[] = [];
    const total = cells.length;

    for (let i = 0; i < cells.length; i += this.batchSize) {
      const chunk = cells.slice(i, i + this.batchSize);
      const results = await this.recognizeBatch(chunk);
      allResults.push(...results);

      if (onProgress) {
        onProgress(Math.min((i + chunk.length) / total, 1));
      }
    }

    return allResults;
  }
}
