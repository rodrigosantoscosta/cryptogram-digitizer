import { FastifyInstance } from 'fastify';
import { OCRResult, OCRBatchResponse, HealthResponse } from '../types/ocr';

export class OCRService {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = process.env.OCR_SERVICE_URL || 'http://localhost:5000', timeout: number = 30000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async healthCheck(): Promise<HealthResponse> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<HealthResponse>;
  }

  async recognizeCell(imageData: Buffer, mimeType: string = 'image/png'): Promise<OCRResult> {
    const formData = new FormData();
    const blob = new Blob([imageData], { type: mimeType });
    formData.append('file', blob, `cell.${mimeType.split('/')[1]}`);

    const response = await this.fetchWithTimeout(`${this.baseUrl}/api/ocr/cell`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OCR cell failed: ${response.status} ${error}`);
    }

    return response.json() as Promise<OCRResult>;
  }

  async recognizeBatch(images: { data: Buffer; mimeType: string }[]): Promise<OCRBatchResponse> {
    const formData = new FormData();

    images.forEach((img, index) => {
      const blob = new Blob([img.data], { type: img.mimeType });
      const ext = img.mimeType.split('/')[1] || 'png';
      formData.append('files', blob, `cell_${index}.${ext}`);
    });

    const response = await this.fetchWithTimeout(`${this.baseUrl}/api/ocr/batch`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OCR batch failed: ${response.status} ${error}`);
    }

    return response.json() as Promise<OCRBatchResponse>;
  }

  async recognizeBatchWithChunking(
    images: { data: Buffer; mimeType: string }[],
    chunkSize: number = 16
  ): Promise<OCRResult[]> {
    const allResults: OCRResult[] = [];

    for (let i = 0; i < images.length; i += chunkSize) {
      const chunk = images.slice(i, i + chunkSize);
      const response = await this.recognizeBatch(chunk);
      allResults.push(...response.results);
    }

    return allResults;
  }
}
