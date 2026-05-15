/**
 * CellNumberReader — Leitura de números nas células do criptograma
 *
 * No criptograma do sample.jpg cada célula da grade (exceto a coluna de pistas)
 * contém um número inteiro (1–27) que funciona como identificador de símbolo.
 *
 * Este módulo:
 *  1. Extrai cada célula numérica da grade usando extractCellInner()
 *  2. Pré-processa para OCR (upscale dinâmico, detecção HSV de fundo colorido,
 *     binarização adaptativa com detecção de polaridade)
 *  3. Reconhece o número via Tesseract (PSM.SINGLE_WORD, whitelist 0-9)
 *     com retry em cascata para células de baixa confiança
 *  4. Sanitiza o texto lido corrigindo confusões clássicas (I→1, O→0, etc.)
 *  5. Retorna CellNumberMap: mapeamento (row, col) → número lido
 *
 * ## Diagnóstico do sample.jpg (ground truth via Google Lens):
 *  - Números de 2 dígitos (10+): 13% de falha antes do fix
 *  - Números de 1 dígito (1-9):  97% de falha antes do fix
 *  - Causa: células destacadas (fundo colorido azul) faziam o
 *    adaptiveThreshold inverter o texto, tornando dígitos invisíveis
 *  - Fix 1: detecção HSV de saturação → threshold simples para células coloridas
 *  - Fix 2: margem horizontal 4% / vertical 6% (preserva o '1' inicial)
 *  - Fix 3: CLAHE removido (causava raw:"" em todas as 51 células null)
 *
 * Integração:
 *  - Chamado na Fase 3.5 do useImageProcessor
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
  rawText: string;         // pós-sanitizeDigits
  rawOcr: string;          // pré-sanitizeDigits (saída literal do Tesseract)
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

// ─── Sanitização de dígitos ───────────────────────────────────────────────────

function sanitizeDigits(raw: string): string {
  return raw
    .replace(/[oO]/g, '0')
    .replace(/[iIlL|]/g, '1')
    .replace(/[zZ]/g, '2')
    .replace(/[sS]/g, '5')
    .replace(/[bB]/g, '6')
    .replace(/[gGqQ]/g, '9')
    .replace(/[^0-9]/g, '');
}

// ─── Pré-processamento de célula numérica ─────────────────────────────────────

/**
 * Pré-processa uma célula para OCR de dígitos.
 *
 * Pipeline:
 *  1. Grayscale
 *  2. Resize dinâmico para altura-alvo TARGET_H (INTER_CUBIC)
 *  3. Detecção de fundo colorido via saturação HSV
 *     — meanHSV[1] (canal S) > 40 → célula highlighted (fundo colorido)
 *     — Fix 1: células coloridas usam threshold simples valor alto (180)
 *       para isolar o dígito branco; células normais usam adaptiveThreshold
 *  4. GaussianBlur leve (3×3, σ=0.5) — apenas para fundo branco normal
 *  5. Detecção de polaridade: luminosidade média do centro
 *     — luma > 128 = fundo claro → THRESH_BINARY_INV
 *     — luma ≤ 128 = fundo escuro → THRESH_BINARY
 *  6. adaptiveThreshold com blockSize proporcional (apenas fundo branco)
 *     OU threshold simples 180 (fundo colorido)
 *  7. MORPH_CLOSE 2×2 para fechar gaps em traços finos
 *
 * @param cellImage      - ImageData da célula recortada
 * @param invertPolarity - força inversão de polaridade (para retry)
 */
export function preprocessNumberCell(
  cellImage: ImageData,
  invertPolarity = false
): ImageData {
  const TARGET_H = 96;
  const src     = cv.matFromImageData(cellImage);
  let gray      = new cv.Mat();
  let resized   = new cv.Mat();
  let blurred   = new cv.Mat();
  let binary    = new cv.Mat();
  let closed    = new cv.Mat();

  try {
    // 1. Grayscale
    if (src.channels() === 4) {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    } else if (src.channels() === 3) {
      cv.cvtColor(src, gray, cv.COLOR_RGB2GRAY);
    } else {
      src.copyTo(gray);
    }

    // 2. Upscale dinâmico — garante mínimo de TARGET_H px
    const scale = Math.max(2, Math.ceil(TARGET_H / Math.max(gray.rows, 1)));
    const dsize = new cv.Size(gray.cols * scale, gray.rows * scale);
    cv.resize(gray, resized, dsize, 0, 0, cv.INTER_CUBIC);

    // 3. Detectar fundo colorido via saturação HSV (Fix 1)
    //    Converte RGBA→RGB→HSV e mede a saturação média.
    //    Se S > 40, a célula está highlighted (dígito branco em fundo colorido).
    const rgbMat  = new cv.Mat();
    const hsvMat  = new cv.Mat();
    if (src.channels() === 4) {
      cv.cvtColor(src, rgbMat, cv.COLOR_RGBA2RGB);
    } else {
      src.copyTo(rgbMat);
    }
    cv.cvtColor(rgbMat, hsvMat, cv.COLOR_RGB2HSV);
    const meanHSV    = cv.mean(hsvMat);
    const isHighlighted = meanHSV[1] > 40; // canal S > 40 = saturação de cor
    rgbMat.delete();
    hsvMat.delete();

    if (isHighlighted) {
      // Fundo colorido → dígito é branco → threshold simples valor alto
      // Não usa CLAHE nem adaptiveThreshold (ambos falham com fundo saturado)
      cv.threshold(resized, binary, 180, 255, cv.THRESH_BINARY);
    } else {
      // Fundo branco normal → pipeline adaptativo original (sem CLAHE)
      cv.GaussianBlur(resized, blurred, new cv.Size(3, 3), 0.5);

      // Detecção de polaridade via luminosidade média do centro
      const cx  = Math.floor(blurred.cols / 4);
      const cy  = Math.floor(blurred.rows / 4);
      const cw  = Math.floor(blurred.cols / 2);
      const ch  = Math.floor(blurred.rows / 2);
      const roi = blurred.roi(new cv.Rect(cx, cy, cw, ch));
      const mean = cv.mean(roi);
      roi.delete();
      const avgLuma    = mean[0];
      const lightBg    = avgLuma > 128;
      const useInv     = invertPolarity ? !lightBg : lightBg;
      const threshType = useInv ? cv.THRESH_BINARY_INV : cv.THRESH_BINARY;

      // adaptiveThreshold com blockSize proporcional (sempre ímpar, mínimo 11)
      const blockSize = Math.max(11, Math.round(resized.rows / 8)) | 1;
      cv.adaptiveThreshold(
        blurred, binary,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        threshType,
        blockSize,
        8
      );
    }

    // MORPH_CLOSE para fechar traços fragmentados
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
    cv.morphologyEx(binary, closed, cv.MORPH_CLOSE, kernel);
    kernel.delete();

    const canvas = document.createElement('canvas');
    canvas.width  = closed.cols;
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
 * Extrai uma célula da grade aplicando margem interna proporcional ao tamanho
 * da célula.
 *
 * Fix 2: margem separada por eixo:
 *  - marginX = 4% da largura (era 8% uniform → cortava o '1' inicial)
 *  - marginY = 6% da altura  (ainda evita a borda horizontal da grade)
 *  - mínimo 1px para células muito pequenas
 */
function extractCellInner(
  image: ImageData,
  row: number,
  col: number,
  grid: GridResult
): ImageData | null {
  const rawW = Math.round(grid.colPositions[col + 1]) - Math.round(grid.colPositions[col]);
  const rawH = Math.round(grid.rowPositions[row + 1]) - Math.round(grid.rowPositions[row]);

  // Fix 2: margens separadas horizontal/vertical
  const marginX = Math.max(1, Math.round(rawW * 0.04));
  const marginY = Math.max(1, Math.round(rawH * 0.06));

  const x0 = Math.round(grid.colPositions[col])     + marginX;
  const y0 = Math.round(grid.rowPositions[row])     + marginY;
  const x1 = Math.round(grid.colPositions[col + 1]) - marginX;
  const y1 = Math.round(grid.rowPositions[row + 1]) - marginY;

  const w = x1 - x0;
  const h = y1 - y0;

  if (w <= 4 || h <= 4) return null;
  if (x0 < 0 || y0 < 0 || x1 > image.width || y1 > image.height) return null;

  const canvas = document.createElement('canvas');
  canvas.width  = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const tmp = document.createElement('canvas');
  tmp.width  = image.width;
  tmp.height = image.height;
  tmp.getContext('2d')!.putImageData(image, 0, 0);
  ctx.drawImage(tmp, x0, y0, w, h, 0, 0, w, h);

  return ctx.getImageData(0, 0, w, h);
}

// ─── Classe principal ─────────────────────────────────────────────────────────

export class CellNumberReader {
  private worker: Awaited<ReturnType<typeof createWorker>> | null = null;

  async initialize(): Promise<void> {
    this.worker = await createWorker('eng');
    await this.worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_WORD,
      tessedit_char_whitelist: '0123456789',
    });
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }

  private async readCellWithPSM(
    processedCell: ImageData,
    psm: PSM
  ): Promise<{ number: number | null; confidence: number; rawText: string; rawOcr: string }> {
    if (!this.worker) throw new Error('CellNumberReader não inicializado');

    await this.worker.setParameters({ tessedit_pageseg_mode: psm });

    const canvas = document.createElement('canvas');
    canvas.width  = processedCell.width;
    canvas.height = processedCell.height;
    canvas.getContext('2d')!.putImageData(processedCell, 0, 0);

    const { data } = await this.worker.recognize(canvas);

    // Fix 4: separar rawOcr (saída literal do Tesseract) de rawText (pós-sanitização)
    const rawOcr    = data.text.replace(/\s+/g, '').trim();  // literal do Tesseract
    const rawText   = sanitizeDigits(rawOcr);                 // após sanitização
    const confidence = (data.confidence ?? 0) / 100;

    const parsed = parseInt(rawText, 10);
    const number = isNaN(parsed) || parsed < 1 || parsed > 99 ? null : parsed;

    return { number, confidence, rawText, rawOcr };
  }

  /**
   * Retry em cascata — reutiliza o mesmo worker, só muda parâmetros.
   *
   * Tentativas:
   *  1. PSM.SINGLE_WORD  + polaridade automática
   *  2. PSM.SINGLE_WORD  + polaridade invertida
   *  3. PSM.SPARSE_TEXT  + polaridade automática
   *
   * Aceita sem retry se confiança ≥ 0.60.
   * Fix 4: rawOcr do melhor attempt é propagado junto com rawText.
   */
  private async readCellWithRetry(
    rawCell: ImageData
  ): Promise<{ number: number | null; confidence: number; rawText: string; rawOcr: string }> {
    const CONFIDENCE_THRESHOLD = 0.60;

    const attempts: Array<{ psm: PSM; invertPolarity: boolean }> = [
      { psm: PSM.SINGLE_WORD, invertPolarity: false },
      { psm: PSM.SINGLE_WORD, invertPolarity: true  },
      { psm: PSM.SPARSE_TEXT, invertPolarity: false },
    ];

    let best: { number: number | null; confidence: number; rawText: string; rawOcr: string } = {
      number: null, confidence: 0, rawText: '', rawOcr: ''
    };

    for (const attempt of attempts) {
      const processed = preprocessNumberCell(rawCell, attempt.invertPolarity);
      const result    = await this.readCellWithPSM(processed, attempt.psm);

      if (result.number !== null && result.confidence > best.confidence) {
        best = result;
      }

      if (best.confidence >= CONFIDENCE_THRESHOLD && best.number !== null) break;
    }

    await this.worker!.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_WORD });
    return best;
  }

  async readAllCells(
    image: ImageData,
    grid: GridResult,
    onProgress?: (progress: number) => void
  ): Promise<CellNumberMap> {
    const cells: CellNumber[] = [];
    const startCol = 1;
    const total    = grid.rows * (grid.cols - startCol);
    let done = 0;

    for (let row = 0; row < grid.rows; row++) {
      for (let col = startCol; col < grid.cols; col++) {
        let result: CellNumber = { row, col, number: null, confidence: 0, rawText: '', rawOcr: '' };

        try {
          const rawCell = extractCellInner(image, row, col, grid);
          if (rawCell) {
            const { number, confidence, rawText, rawOcr } = await this.readCellWithRetry(rawCell);
            result = { row, col, number, confidence, rawText, rawOcr };
          }
        } catch (err) {
          console.warn(`[CellNumberReader] erro em (${row},${col}):`, err);
        }

        cells.push(result);
        done++;
        onProgress?.(done / total);
      }
    }

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
