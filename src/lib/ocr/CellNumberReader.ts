/**
 * CellNumberReader — Leitura de números nas células do criptograma
 *
 * No criptograma do sample.jpg cada célula da grade (exceto a coluna de pistas)
 * contém um número inteiro (1–27) que funciona como identificador de símbolo.
 *
 * Este módulo:
 *  1. Extrai cada célula numérica da grade usando GridDetector.extractCell()
 *  2. Pré-processa para OCR (upscale, binarização adaptativa, inversão se necessário)
 *  3. Reconhece o número via Tesseract (PSM.SINGLE_CHAR, whitelist 0-9)
 *  4. Retorna CellNumberMap: mapeamento (row, col) → número lido
 *
 * Integração:
 *  - Chamado na Fase 3 do useImageProcessor, logo após detecção da grade
 *  - Substitui / complementa o SymbolExtractor para criptogramas numéricos
 *  - O resultado alimenta SymbolClassifier via symbolId = número (string "1".."27")
 */

import { createWorker, PSM } from 'tesseract.js';
import type { GridResult } from '@/types';

declare const cv: any;

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface CellNumber {
  row: number;
  col: number;
  number: number | null;   // null = célula vazia ou não reconhecida
  confidence: number;      // 0–1
  rawText: string;
}

export interface CellNumberMap {
  cells: CellNumber[];
  /** symbolId (número como string) → lista de posições */
  bySymbol: Record<string, Array<{ row: number; col: number }>>;
  /** total de células com número reconhecido */
  recognized: number;
  /** total de células tentadas */
  total: number;
}

// ─── Pré-processamento de célula numérica ─────────────────────────────────────

/**
 * Pré-processa uma célula para OCR de dígitos.
 *
 * Pipeline:
 *  1. Grayscale
 *  2. Resize 4× (INTER_CUBIC) — dígitos pequenos exigem upscale agressivo
 *  3. GaussianBlur leve (3×3, σ=0.5) para suavizar artefatos JPEG
 *  4. adaptiveThreshold (THRESH_BINARY_INV, blockSize=15, C=8)
 *     — inverte para fundo preto / texto branco (Tesseract aceita ambos,
 *       mas branco-sobre-preto costuma ser mais robusto para dígitos)
 *  5. MORPH_CLOSE 2×2 — fecha gaps em traços finos
 */
export function preprocessNumberCell(cellImage: ImageData): ImageData {
  const src = cv.matFromImageData(cellImage);
  let gray = new cv.Mat();
  let resized = new cv.Mat();
  let blurred = new cv.Mat();
  let binary = new cv.Mat();
  let closed = new cv.Mat();

  try {
    // 1. Grayscale
    if (src.channels() === 4) {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    } else if (src.channels() === 3) {
      cv.cvtColor(src, gray, cv.COLOR_RGB2GRAY);
    } else {
      src.copyTo(gray);
    }

    // 2. Upscale 4×
    const dsize = new cv.Size(gray.cols * 4, gray.rows * 4);
    cv.resize(gray, resized, dsize, 0, 0, cv.INTER_CUBIC);

    // 3. GaussianBlur leve
    cv.GaussianBlur(resized, blurred, new cv.Size(3, 3), 0.5);

    // 4. adaptiveThreshold — fundo preto, texto branco
    cv.adaptiveThreshold(
      blurred, binary,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      15, 8
    );

    // 5. MORPH_CLOSE para fechar traços fragmentados
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
    cv.morphologyEx(binary, closed, cv.MORPH_CLOSE, kernel);
    kernel.delete();

    const canvas = document.createElement('canvas');
    canvas.width = closed.cols;
    canvas.height = closed.rows;
    canvas.getContext('2d')!.fillStyle = '#000';
    canvas.getContext('2d')!.fillRect(0, 0, canvas.width, canvas.height);
    cv.imshow(canvas, closed);
    return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);

  } finally {
    src.delete();
    gray.delete();
    resized.delete();
    blurred.delete();
    binary.delete();
    closed.delete();
  }
}

// ─── Extração de célula com margem interna ────────────────────────────────────

/**
 * Extrai uma célula da grade aplicando margem interna para evitar bordas.
 * Retorna ImageData ou null se fora dos limites.
 */
function extractCellInner(
  image: ImageData,
  row: number,
  col: number,
  grid: GridResult,
  marginPx: number = 3
): ImageData | null {
  const x0 = Math.round(grid.colPositions[col])     + marginPx;
  const y0 = Math.round(grid.rowPositions[row])     + marginPx;
  const x1 = Math.round(grid.colPositions[col + 1]) - marginPx;
  const y1 = Math.round(grid.rowPositions[row + 1]) - marginPx;

  const w = x1 - x0;
  const h = y1 - y0;

  if (w <= 4 || h <= 4) return null;
  if (x0 < 0 || y0 < 0 || x1 > image.width || y1 > image.height) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Desenhar a fatia da imagem original na posição (x0, y0)
  const tmp = document.createElement('canvas');
  tmp.width = image.width;
  tmp.height = image.height;
  tmp.getContext('2d')!.putImageData(image, 0, 0);
  ctx.drawImage(tmp, x0, y0, w, h, 0, 0, w, h);

  return ctx.getImageData(0, 0, w, h);
}

// ─── Classe principal ─────────────────────────────────────────────────────────

export class CellNumberReader {
  private worker: Awaited<ReturnType<typeof createWorker>> | null = null;

  /**
   * Inicializa o worker Tesseract configurado para dígitos.
   * Reutilizar a mesma instância para todas as células é ~10× mais rápido
   * do que criar um worker por célula.
   */
  async initialize(): Promise<void> {
    // 'eng' é suficiente para dígitos (0-9); 'por' não adiciona nada
    this.worker = await createWorker('eng');
    await this.worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_CHAR,
      tessedit_char_whitelist: '0123456789',
    });
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Lê um número de uma única célula pré-processada.
   * Retorna { number, confidence, rawText }.
   */
  private async readCell(processedCell: ImageData): Promise<{ number: number | null; confidence: number; rawText: string }> {
    if (!this.worker) throw new Error('CellNumberReader não inicializado');

    const canvas = document.createElement('canvas');
    canvas.width = processedCell.width;
    canvas.height = processedCell.height;
    canvas.getContext('2d')!.putImageData(processedCell, 0, 0);

    const { data } = await this.worker.recognize(canvas);
    const rawText = data.text.replace(/\s+/g, '').trim();
    const confidence = (data.confidence ?? 0) / 100;

    const parsed = parseInt(rawText, 10);
    const number = isNaN(parsed) || parsed < 1 || parsed > 99 ? null : parsed;

    return { number, confidence, rawText };
  }

  /**
   * Processa todas as células numéricas da grade (colunas 1..N-1).
   *
   * @param image  - Imagem original (RGBA) usada para recorte
   * @param grid   - GridResult da detecção de grade
   * @param onProgress - Callback de progresso opcional (0–1)
   */
  async readAllCells(
    image: ImageData,
    grid: GridResult,
    onProgress?: (progress: number) => void
  ): Promise<CellNumberMap> {
    const cells: CellNumber[] = [];
    const startCol = 1; // pular coluna de pistas
    const total = grid.rows * (grid.cols - startCol);
    let done = 0;

    for (let row = 0; row < grid.rows; row++) {
      for (let col = startCol; col < grid.cols; col++) {
        let result: CellNumber = { row, col, number: null, confidence: 0, rawText: '' };

        try {
          const rawCell = extractCellInner(image, row, col, grid, 3);

          if (rawCell) {
            const processed = preprocessNumberCell(rawCell);
            const { number, confidence, rawText } = await this.readCell(processed);
            result = { row, col, number, confidence, rawText };
          }
        } catch (err) {
          console.warn(`[CellNumberReader] erro em (${row},${col}):`, err);
        }

        cells.push(result);
        done++;
        onProgress?.(done / total);
      }
    }

    // Construir índice bySymbol
    const bySymbol: Record<string, Array<{ row: number; col: number }>> = {};
    for (const cell of cells) {
      if (cell.number !== null) {
        const key = String(cell.number);
        if (!bySymbol[key]) bySymbol[key] = [];
        bySymbol[key].push({ row: cell.row, col: cell.col });
      }
    }

    const recognized = cells.filter(c => c.number !== null).length;

    return { cells, bySymbol, recognized, total };
  }

  // ─── Factory: leitura completa sem gerenciar ciclo de vida manualmente ────

  /**
   * Lê todos os números da grade inicializando e encerrando o worker internamente.
   * Conveniente para uso único sem reutilizar a instância.
   */
  static async read(
    image: ImageData,
    grid: GridResult,
    onProgress?: (progress: number) => void
  ): Promise<CellNumberMap> {
    const reader = new CellNumberReader();
    try {
      await reader.initialize();
      return await reader.readAllCells(image, grid, onProgress);
    } finally {
      await reader.terminate();
    }
  }
}
