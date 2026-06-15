/**
 * CellNumberReader — Leitura de números nas células do criptograma
 *
 * Pipeline (EasyOCR Migration):
 *  1. Extrai célula com margem interna mínima (2% horizontal, 3% vertical)
 *  2. Converte ImageData para Blob PNG
 *  3. Envia para EasyOCR via API (backend Fastify → FastAPI + EasyOCR)
 *  4. Recebe resultado com número, confiança e texto raw
 *  5. Template matching fallback usando células de alta confiança
 *  6. Validação com frequência, vizinhos e posições conhecidas
 *
 * Racional:
 *  - EasyOCR tem melhor precisão para dígitos em criptogramas
 *  - Backend Dockerizado permite CPU-only processing
 *  - Batch processing reduz latência (16 células por request)
 */

import type { GridResult } from '@/types/image';
import type { CellNumber, CellNumberMap } from '@/types/ocr';
import { OCRApiClient } from './OCRApiClient';

declare const cv: any;

export type { CellNumber, CellNumberMap };

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

// ─── Validação de valores (Phase 1) ──────────────────────────────────────────

const MIN_VALID_VALUE = 1;
const MAX_VALID_VALUE = 27; // Includes special value 27 for Brazilian Portuguese cryptograms

/**
 * Fix 1.1: Corrige dígitos espúrios appended (34→3, 24→2)
 * Cryptogramas usam valores 1-27. Valores > 27 são erros de OCR.
 */
function fixSpuriousDigits(value: number | null): number | null {
  if (value === null) return null;
  if (value >= MIN_VALID_VALUE && value <= MAX_VALID_VALUE) return value;
  
  // Se valor tem 2 dígitos e > 27, tenta remover último dígito
  if (value >= 10 && value < 100) {
    const firstDigit = Math.floor(value / 10);
    if (firstDigit >= MIN_VALID_VALUE && firstDigit <= MAX_VALID_VALUE) {
      console.log(`[OCR] Fixed spurious digit: ${value} → ${firstDigit}`);
      return firstDigit;
    }
  }
  
  console.log(`[OCR] Invalid value: ${value} (outside ${MIN_VALID_VALUE}-${MAX_VALID_VALUE} range)`);
  return null;
}

/**
 * Fix 1.3: Correção baseada em frequência de valores
 * Valores que aparecem apenas 1x são suspeitos se tiverem baixa confiança.
 */
function buildFrequencyMap(cells: CellNumber[]): Map<number, number> {
  const frequency = new Map<number, number>();
  for (const cell of cells) {
    if (cell.number !== null) {
      frequency.set(cell.number, (frequency.get(cell.number) || 0) + 1);
    }
  }
  return frequency;
}

// ─── Pré-processamento de célula numérica ─────────────────────────────────────

/**
 * Pré-processa uma célula para OCR de dígitos.
 *
 * Pipeline (Phase 3 improvements):
 *  1. Grayscale
 *  2. Upscale adaptativo: 4× para células pequenas (<30px), 3× para demais
 *  3. Opcional: CLAHE contrast enhancement
 *  4. Opcional: binarização Otsu como fallback
 *  5. Opcional: denoising Gaussian blur
 *
 * @param cellImage - ImageData da célula recortada
 * @param options   - binary, invertPolarity, contrastEnhanced, denoised
 */
export function preprocessNumberCell(
  cellImage: ImageData,
  options: { 
    binary?: boolean; 
    invertPolarity?: boolean;
    contrastEnhanced?: boolean;
    denoised?: boolean;
  } = {}
): ImageData {
  const TARGET_H = 128;
  const src     = cv.matFromImageData(cellImage);
  let gray      = new cv.Mat();
  let resized   = new cv.Mat();
  let output    = new cv.Mat();

  try {
    // 1. Grayscale
    if (src.channels() === 4) {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    } else if (src.channels() === 3) {
      cv.cvtColor(src, gray, cv.COLOR_RGB2GRAY);
    } else {
      src.copyTo(gray);
    }

    // Fix 3.1: CLAHE contrast enhancement for low-contrast cells
    if (options.contrastEnhanced) {
      const clahe = cv.createCLAHE(2.0, new cv.Size(8, 8));
      const enhanced = new cv.Mat();
      clahe.apply(gray, enhanced);
      clahe.delete();
      enhanced.copyTo(gray);
      enhanced.delete();
    }

    // Fix 3.2: Adaptive upscaling - 4x for small cells, 3x for normal
    const rawCellWidth = cellImage.width;
    const rawCellHeight = cellImage.height;
    const isSmallCell = rawCellWidth < 30 || rawCellHeight < 30;
    const baseScale = isSmallCell ? 4 : 3;
    const scale = Math.max(baseScale, Math.ceil(TARGET_H / Math.max(gray.rows, 1)));
    const dsize = new cv.Size(gray.cols * scale, gray.rows * scale);
    
    // Use INTER_LANCZOS4 for small cells (better quality)
    const interpolation = isSmallCell ? cv.INTER_LANCZOS4 : cv.INTER_CUBIC;
    cv.resize(gray, resized, dsize, 0, 0, interpolation);

    // Fix 3.3: Noise reduction for speckle noise
    if (options.denoised) {
      cv.GaussianBlur(resized, resized, new cv.Size(5, 5), 1.0);
    }

    if (options.binary) {
      // Fallback: Otsu binarization
      if (options.invertPolarity) {
        cv.threshold(resized, output, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
      } else {
        cv.threshold(resized, output, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
      }
    } else {
      // Primary: grayscale only (LSTM expects grayscale)
      resized.copyTo(output);
    }

    const canvas = document.createElement('canvas');
    canvas.width  = output.cols;
    canvas.height = output.rows;
    canvas.getContext('2d')!.fillStyle = '#fff';
    canvas.getContext('2d')!.fillRect(0, 0, canvas.width, canvas.height);
    cv.imshow(canvas, output);
    return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);

  } finally {
    src.delete(); gray.delete(); resized.delete(); output.delete();
  }
}

// ─── Template Matching (Phase 2) ─────────────────────────────────────────────

interface Template {
  imageData: ImageData;
  number: number;
}

const TEMPLATE_MATCH_THRESHOLD = 0.70; // Lowered to allow more matches
const MAX_TEMPLATES_PER_NUMBER = 3;
const TEMPLATE_SIMILARITY_THRESHOLD = 0.85; // Slightly lower to allow more diverse templates

function normalizedCrossCorrelation(img1: ImageData, img2: ImageData): number {
  const src1 = cv.matFromImageData(img1);
  const src2 = cv.matFromImageData(img2);
  
  const targetW = Math.max(src1.cols, src2.cols);
  const targetH = Math.max(src1.rows, src2.rows);
  
  const r1 = new cv.Mat();
  const r2 = new cv.Mat();
  cv.resize(src1, r1, new cv.Size(targetW, targetH), 0, 0, cv.INTER_CUBIC);
  cv.resize(src2, r2, new cv.Size(targetW, targetH), 0, 0, cv.INTER_CUBIC);
  
  const f1 = new cv.Mat();
  const f2 = new cv.Mat();
  r1.convertTo(f1, cv.CV_32F);
  r2.convertTo(f2, cv.CV_32F);
  
  const n1 = new cv.Mat();
  const n2 = new cv.Mat();
  cv.normalize(f1, n1, 0, 1, cv.NORM_MINMAX);
  cv.normalize(f2, n2, 0, 1, cv.NORM_MINMAX);
  
  const diff = new cv.Mat();
  cv.absdiff(n1, n2, diff);
  const meanDiff = cv.mean(diff)[0];
  
  const similarity = 1.0 - meanDiff;
  
  src1.delete(); src2.delete(); r1.delete(); r2.delete();
  f1.delete(); f2.delete(); n1.delete(); n2.delete(); diff.delete();
  
  return similarity;
}

/**
 * Fix 2.3: Normaliza template para tamanho fixo (32x32) para matching consistente
 */
function normalizeForMatching(imageData: ImageData): ImageData {
  const TARGET_SIZE = 32;
  const src = cv.matFromImageData(imageData);
  const gray = new cv.Mat();
  
  if (src.channels() === 4) {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  } else if (src.channels() === 3) {
    cv.cvtColor(src, gray, cv.COLOR_RGB2GRAY);
  } else {
    src.copyTo(gray);
  }
  
  const scale = Math.min(TARGET_SIZE / gray.cols, TARGET_SIZE / gray.rows);
  const newW = Math.round(gray.cols * scale);
  const newH = Math.round(gray.rows * scale);
  
  const resized = new cv.Mat();
  cv.resize(gray, resized, new cv.Size(newW, newH), 0, 0, cv.INTER_CUBIC);
  
  const padded = new cv.Mat.zeros(TARGET_SIZE, TARGET_SIZE, cv.CV_8UC1);
  const offsetX = Math.floor((TARGET_SIZE - newW) / 2);
  const offsetY = Math.floor((TARGET_SIZE - newH) / 2);
  
  const roi = padded.roi(new cv.Rect(offsetX, offsetY, newW, newH));
  resized.copyTo(roi);
  roi.delete();
  
  const canvas = document.createElement('canvas');
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;
  cv.imshow(canvas, padded);
  
  const result = canvas.getContext('2d')!.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE);
  
  src.delete(); gray.delete(); resized.delete(); padded.delete();
  return result;
}

function matchTemplate(
  cellImage: ImageData,
  templates: Template[]
): { number: number; confidence: number } | null {
  if (templates.length === 0) return null;
  
  let bestMatch: { number: number; confidence: number } | null = null;
  let bestScore = 0;
  
  for (const template of templates) {
    const score = normalizedCrossCorrelation(cellImage, template.imageData);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { number: template.number, confidence: score };
    }
  }
  
  return bestScore > TEMPLATE_MATCH_THRESHOLD ? bestMatch : null;
}

/**
 * Fix 2.4: Correção específica para "26" (AGORA MAIS CONSERVADORA)
 * "26" aparece 18x mas é lido corretamente apenas 28% das vezes.
 * Só corrige quando:
 * - OCR lê "2" ou "12" (os erros mais comuns para "26")
 * - Confiança MUITO baixa (<0.40)
 * - Match com templates "26" tem confiança ALTA (>0.80)
 * - Temos pelo menos 2 templates "26" disponíveis
 */
function tryCorrect26(
  rawCell: ImageData,
  templates: Template[],
  ocrResult: { number: number | null; confidence: number }
): { number: number | null; confidence: number } {
  // Only correct the most common misreads of "26"
  const suspiciousFor26 = [2, 12];
  
  if (ocrResult.number !== null && 
      suspiciousFor26.includes(ocrResult.number) && 
      ocrResult.confidence < 0.40) {
    
    const templates26 = templates.filter(t => t.number === 26);
    
    // Require at least 2 templates for "26" to ensure quality
    if (templates26.length >= 2) {
      const match = matchTemplate(rawCell, templates26);
      
      // Require HIGH confidence for the correction
      if (match && match.confidence > 0.80) {
        console.log(`[OCR] Corrected to 26: was ${ocrResult.number} (conf: ${ocrResult.confidence.toFixed(2)} → ${match.confidence.toFixed(2)})`);
        return { number: 26, confidence: match.confidence };
      }
    }
  }
  
  return ocrResult;
}

// ─── Extração de célula com margem interna ───────────────────────────────────

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
  // Reduzidas para capturar mais do conteúdo da célula
  const marginX = Math.max(1, Math.round(rawW * 0.02));
  const marginY = Math.max(1, Math.round(rawH * 0.03));

  let x0 = Math.round(grid.colPositions[col])     + marginX;
  let y0 = Math.round(grid.rowPositions[row])     + marginY;
  let x1 = Math.round(grid.colPositions[col + 1]) - marginX;
  let y1 = Math.round(grid.rowPositions[row + 1]) - marginY;

  // Clamp to image bounds
  x0 = Math.max(0, Math.min(x0, image.width - 1));
  y0 = Math.max(0, Math.min(y0, image.height - 1));
  x1 = Math.max(x0 + 1, Math.min(x1, image.width));
  y1 = Math.max(y0 + 1, Math.min(y1, image.height));

  const w = x1 - x0;
  const h = y1 - y0;

  if (w <= 4 || h <= 4) return null;

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
  private apiClient: OCRApiClient;
  private templates: Template[] = [];
  
  private readonly CONFUSION_PAIRS: Record<number, number[]> = {
    13: [7, 1, 3],
    7: [13, 1, 4],
    26: [17, 2, 6],
    17: [26, 7, 1],
    1: [4, 7, 11],
    4: [1, 14, 17],
    3: [4, 8, 13],
  };

  constructor(apiUrl?: string) {
    this.apiClient = new OCRApiClient(apiUrl);
    this.templates = [];
  }

  async initialize(): Promise<void> {
    this.templates = [];
    await this.apiClient.healthCheck();
  }

  async terminate(): Promise<void> {
    this.templates = [];
  }

  private imageDataToBlob(imageData: ImageData): Promise<Blob> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob((blob) => resolve(blob!), 'image/png');
    });
  }

  /**
   * Fix 2.2: Adiciona template com verificação de diversidade
   * Mantém até 3 templates por número, apenas se forem suficientemente diferentes.
   */
  private addTemplate(rawCell: ImageData, number: number): void {
    const existingTemplates = this.templates.filter(t => t.number === number);
    
    if (existingTemplates.length >= MAX_TEMPLATES_PER_NUMBER) return;
    
    const isDifferent = existingTemplates.length === 0 || 
      existingTemplates.every(t => {
        const similarity = normalizedCrossCorrelation(rawCell, t.imageData);
        return similarity < TEMPLATE_SIMILARITY_THRESHOLD;
      });
    
    if (isDifferent) {
      this.templates.push({ imageData: rawCell, number });
    }
  }

  /**
   * Accuracy Improvement Plan: Confusion pair correction
   * Corrects known confusion pairs when confidence is low.
   */
  private correctConfusionPairs(
    cells: CellNumber[],
    rawCells: Map<string, ImageData>
  ): void {
    let corrections = 0;
    
    for (const cell of cells) {
      if (cell.number !== null) {
        const confusingValues = this.CONFUSION_PAIRS[cell.number];
        
        if (confusingValues && cell.confidence < 0.60) {
          const key = `${cell.row},${cell.col}`;
          const rawCell = rawCells.get(key);
          
          if (rawCell) {
            // Get templates for confusing values
            const altTemplates = this.templates.filter(
              t => confusingValues.includes(t.number)
            );
            
            if (altTemplates.length > 0) {
              const match = matchTemplate(rawCell, altTemplates);
              if (match && match.confidence > cell.confidence + 0.15) {
                console.log(`[OCR] Confusion pair correction: ${cell.number} → ${match.number} at (${cell.row},${cell.col}) [conf: ${cell.confidence.toFixed(2)} → ${match.confidence.toFixed(2)}]`);
                cell.number = match.number;
                cell.confidence = match.confidence;
                cell.rawText = String(match.number);
                cell.rawOcr = String(match.number);
                corrections++;
              }
            }
          }
        }
      }
    }
    
    console.log(`[OCR] Confusion pair corrections: ${corrections}`);
  }

  /**
   * Fix 4.1: Validação baseada em vizinhos (MELHORADA COM MEDIANA E DIAGONAIS)
   * Usa mediana ao invés de média para ser mais robusta a outliers.
   * Considera vizinhos diagonais também.
   * Threshold mais baixo para células com confiança muito baixa (<0.30).
   */
  private validateWithNeighbors(
    row: number,
    col: number,
    value: number,
    confidence: number,
    gridMatrix: (number | null)[][]
  ): { value: number | null; confidence: number } {
    const neighbors: number[] = [];
    
    // Orthogonal neighbors
    if (row > 0 && gridMatrix[row - 1][col] !== null) neighbors.push(gridMatrix[row - 1][col]!);
    if (row < gridMatrix.length - 1 && gridMatrix[row + 1][col] !== null) neighbors.push(gridMatrix[row + 1][col]!);
    if (col > 0 && gridMatrix[row][col - 1] !== null) neighbors.push(gridMatrix[row][col - 1]!);
    if (col < gridMatrix[0].length - 1 && gridMatrix[row][col + 1] !== null) neighbors.push(gridMatrix[row][col + 1]!);
    
    // Diagonal neighbors
    if (row > 0 && col > 0 && gridMatrix[row - 1][col - 1] !== null) neighbors.push(gridMatrix[row - 1][col - 1]!);
    if (row > 0 && col < gridMatrix[0].length - 1 && gridMatrix[row - 1][col + 1] !== null) neighbors.push(gridMatrix[row - 1][col + 1]!);
    if (row < gridMatrix.length - 1 && col > 0 && gridMatrix[row + 1][col - 1] !== null) neighbors.push(gridMatrix[row + 1][col - 1]!);
    if (row < gridMatrix.length - 1 && col < gridMatrix[0].length - 1 && gridMatrix[row + 1][col + 1] !== null) neighbors.push(gridMatrix[row + 1][col + 1]!);
    
    if (neighbors.length < 3) return { value, confidence };
    
    // Use median instead of mean for robustness
    const sorted = [...neighbors].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    
    // Lower threshold for very low confidence
    const threshold = confidence < 0.30 ? 12 : 15;
    const isOutlier = Math.abs(value - median) > threshold;
    
    if (isOutlier && confidence < 0.50) {
      console.log(`[OCR] Neighbor validation: (${row},${col}) value ${value} is outlier (median: ${median.toFixed(1)}, conf: ${confidence.toFixed(2)})`);
      return { value: null, confidence: 0 };
    }
    
    return { value, confidence };
  }

  /**
   * Fix 1.3: Correção baseada em frequência (AGRESSIVA)
   * Corrige quando:
   * - Valor aparece apenas 1-2x (suspicious)
   * - Confiança baixa (<0.60)
   * - Template alternativo tem confiança ALTA (>0.70)
   */
  private correctByFrequency(
    cells: CellNumber[],
    rawCells: Map<string, ImageData>
  ): void {
    const frequency = buildFrequencyMap(cells);
    
    // Values appearing 1-2 times are suspicious
    const suspiciousValues = Array.from(frequency.entries())
      .filter(([_, count]) => count <= 2)
      .map(([value]) => value);
    
    if (suspiciousValues.length === 0) return;
    
    // Frequent values (>=4 occurrences) as alternatives
    const frequentValues = Array.from(frequency.entries())
      .filter(([_, count]) => count >= 4)
      .map(([value]) => value)
      .sort((a, b) => b - a);
    
    if (frequentValues.length === 0) return;
    
    let corrections = 0;
    
    for (const cell of cells) {
      if (cell.number !== null && suspiciousValues.includes(cell.number)) {
        if (cell.confidence < 0.60) {
          const key = `${cell.row},${cell.col}`;
          const rawCell = rawCells.get(key);
          
          if (rawCell) {
            for (const altValue of frequentValues) {
              const altTemplates = this.templates.filter(t => t.number === altValue);
              if (altTemplates.length > 0) {
                const match = matchTemplate(rawCell, altTemplates);
                if (match && match.confidence > 0.70) {
                  console.log(`[OCR] Frequency correction: ${cell.number} → ${altValue} at (${cell.row},${cell.col}) [conf: ${cell.confidence.toFixed(2)} → ${match.confidence.toFixed(2)}]`);
                  cell.number = altValue;
                  cell.confidence = match.confidence;
                  cell.rawText = String(altValue);
                  cell.rawOcr = String(altValue);
                  corrections++;
                  break;
                }
              }
            }
          }
        }
      }
    }
    
    console.log(`[OCR] Frequency corrections: ${corrections}`);
  }

  async readAllCells(
    image: ImageData,
    grid: GridResult,
    onProgress?: (progress: number) => void,
    options?: {
      earlyAbortThreshold?: number;
      minCellsProcessed?: number;
    }
  ): Promise<CellNumberMap> {
    const startCol = 0;
    const total = grid.rows * (grid.cols - startCol);
    let extractionFailures = 0;

    const earlyAbortThreshold = options?.earlyAbortThreshold ?? 0.25;
    const minCellsProcessed = options?.minCellsProcessed ?? 10;

    console.log(`[CellNumberReader] Processing ${grid.rows} rows x ${grid.cols} cols, startCol=${startCol}, total=${total}`);
    console.log(`[CellNumberReader] Image size: ${image.width}x${image.height}`);
    console.log(`[CellNumberReader] Early abort: threshold=${earlyAbortThreshold}, minCells=${minCellsProcessed}`);

    const rawCells: Map<string, ImageData> = new Map();
    const cellInputs: { imageData: Blob; row: number; col: number }[] = [];
    const cellOrder: { row: number; col: number }[] = [];

    for (let row = 0; row < grid.rows; row++) {
      for (let col = startCol; col < grid.cols; col++) {
        try {
          const rawCell = extractCellInner(image, row, col, grid);
          if (rawCell) {
            rawCells.set(`${row},${col}`, rawCell);
            const blob = await this.imageDataToBlob(rawCell);
            cellInputs.push({ imageData: blob, row, col });
            cellOrder.push({ row, col });
          } else {
            extractionFailures++;
            console.warn(`[CellNumberReader] Extraction failed for cell (${row},${col})`);
          }
        } catch (err) {
          console.warn(`[CellNumberReader] erro em (${row},${col}):`, err);
        }
      }
    }

    console.log(`[CellNumberReader] Extraction failures: ${extractionFailures}/${total}`);

    let aborted = false;
    let abortReason = '';

    const apiResults = await this.apiClient.recognizeAllCells(
      cellInputs,
      onProgress,
      (resultsSoFar, progress) => {
        const processedCount = resultsSoFar.length;
        if (processedCount < minCellsProcessed) return false;

        const recognizedSoFar = resultsSoFar.filter(r => r.number !== null).length;
        const coverageSoFar = recognizedSoFar / processedCount;

        if (coverageSoFar < earlyAbortThreshold) {
          aborted = true;
          abortReason = `LOW_COVERAGE: ${(coverageSoFar * 100).toFixed(1)}% < ${(earlyAbortThreshold * 100).toFixed(0)}% after ${processedCount}/${cellInputs.length} cells`;
          console.log(`[CellNumberReader] Early abort: ${abortReason}`);
          return true;
        }
        return false;
      }
    );

    if (aborted) {
      return {
        cells: [],
        bySymbol: {},
        recognized: 0,
        total: cellInputs.length,
        aborted: true,
        abortReason,
      };
    }

    const cells: CellNumber[] = [];
    for (let i = 0; i < cellOrder.length; i++) {
      const { row, col } = cellOrder[i];
      const apiResult = apiResults[i];
      const rawCell = rawCells.get(`${row},${col}`);

      let number = apiResult.number;
      let confidence = apiResult.confidence;

      number = fixSpuriousDigits(number);

      if (number !== null && rawCell) {
        const corrected26 = tryCorrect26(rawCell, this.templates, { number, confidence });
        number = corrected26.number;
        confidence = corrected26.confidence;
      }

      const result: CellNumber = {
        row,
        col,
        number,
        confidence,
        rawText: number ? String(number) : '',
        rawOcr: number ? String(number) : '',
      };

      cells.push(result);

      if (confidence >= 0.50 && number !== null && rawCell) {
        this.addTemplate(rawCell, number);
      }
    }

    console.log(`[CellNumberReader] Templates collected: ${this.templates.length}`);

    // Accuracy Improvement Plan: Confusion pair correction
    this.correctConfusionPairs(cells, rawCells);

    // Phase 4: Template matching for remaining unrecognized cells
    if (this.templates.length > 0) {
      let templateMatches = 0;
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (cell.number === null) {
          const key = `${cell.row},${cell.col}`;
          const rawCell = rawCells.get(key);
          if (rawCell) {
            const match = matchTemplate(rawCell, this.templates);
            if (match) {
              cells[i] = {
                row: cell.row,
                col: cell.col,
                number: match.number,
                confidence: match.confidence,
                rawText: String(match.number),
                rawOcr: String(match.number),
              };
              templateMatches++;
            }
          }
        }
      }
      console.log(`[CellNumberReader] Template matches: ${templateMatches}`);
    }

    // Phase 4b: Second pass - template matching for low-confidence cells
    if (this.templates.length > 0) {
      let lowConfCorrections = 0;
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (cell.number !== null && cell.confidence < 0.50) {
          const key = `${cell.row},${cell.col}`;
          const rawCell = rawCells.get(key);
          if (rawCell) {
            // Get templates for different numbers
            const altTemplates = this.templates.filter(t => t.number !== cell.number);
            if (altTemplates.length > 0) {
              const match = matchTemplate(rawCell, altTemplates);
              if (match && match.confidence > 0.75) {
                console.log(`[OCR] Low-conf correction: ${cell.number} → ${match.number} at (${cell.row},${cell.col}) [conf: ${cell.confidence.toFixed(2)} → ${match.confidence.toFixed(2)}]`);
                cells[i] = {
                  row: cell.row,
                  col: cell.col,
                  number: match.number,
                  confidence: match.confidence,
                  rawText: String(match.number),
                  rawOcr: String(match.number),
                };
                lowConfCorrections++;
              }
            }
          }
        }
      }
      console.log(`[CellNumberReader] Low-confidence corrections: ${lowConfCorrections}`);
    }

    // Accuracy Improvement Plan: Second-pass template matching
    // Collect all high-confidence templates after corrections
    if (this.templates.length > 0) {
      const highConfTemplates = this.templates.filter(t => {
        const matchingCells = cells.filter(c => c.number === t.number && c.confidence >= 0.70);
        return matchingCells.length > 0;
      });

      if (highConfTemplates.length > 0) {
        let secondPassCorrections = 0;
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          const wasCorrected = cell.rawOcr !== String(cell.number);
          
          if ((wasCorrected || cell.confidence < 0.60) && cell.number !== null) {
            const key = `${cell.row},${cell.col}`;
            const rawCell = rawCells.get(key);
            
            if (rawCell) {
              const match = matchTemplate(rawCell, highConfTemplates);
              if (match && match.confidence > cell.confidence + 0.20) {
                console.log(`[OCR] Second-pass correction: ${cell.number} → ${match.number} at (${cell.row},${cell.col}) [conf: ${cell.confidence.toFixed(2)} → ${match.confidence.toFixed(2)}]`);
                cells[i] = {
                  row: cell.row,
                  col: cell.col,
                  number: match.number,
                  confidence: match.confidence,
                  rawText: String(match.number),
                  rawOcr: String(match.number),
                };
                secondPassCorrections++;
              }
            }
          }
        }
        console.log(`[CellNumberReader] Second-pass corrections: ${secondPassCorrections}`);
      }
    }

    // Fix: Frequency cap - prevent any value from appearing >20% of cells
    const MAX_FREQUENCY_RATIO = 0.20;
    const frequency = buildFrequencyMap(cells);
    const maxAllowed = Math.floor(total * MAX_FREQUENCY_RATIO);

    let frequencyCapCorrections = 0;
    for (const [value, count] of frequency.entries()) {
      if (count > maxAllowed) {
        console.log(`[OCR] Frequency cap: value ${value} appears ${count} times (max: ${maxAllowed}), flagging excess for review`);

        const cellsWithValue = cells
          .filter(c => c.number === value)
          .sort((a, b) => a.confidence - b.confidence);

        const excessCount = count - maxAllowed;
        for (let i = 0; i < excessCount && i < cellsWithValue.length; i++) {
          const cell = cellsWithValue[i];
          if (cell.confidence < 0.60) {
            cell.number = null;
            cell.confidence = 0;
            cell.rawText = '';
            cell.rawOcr = '';
            frequencyCapCorrections++;
          }
        }
      }
    }
    console.log(`[OCR] Frequency cap corrections: ${frequencyCapCorrections}`);

    // Fix 4.1: Neighbor-based validation (final pass)
    const gridMatrix: (number | null)[][] = Array.from({ length: grid.rows }, () =>
      new Array(grid.cols).fill(null)
    );
    for (const cell of cells) {
      if (cell.number !== null) {
        gridMatrix[cell.row][cell.col] = cell.number;
      }
    }

    let neighborCorrections = 0;
    for (const cell of cells) {
      if (cell.number !== null && cell.confidence < 0.30) {
        const validated = this.validateWithNeighbors(
          cell.row, cell.col, cell.number, cell.confidence, gridMatrix
        );
        if (validated.value === null) {
          cell.number = null;
          cell.confidence = 0;
          cell.rawText = '';
          cell.rawOcr = '';
          neighborCorrections++;
        }
      }
    }
    console.log(`[CellNumberReader] Neighbor corrections: ${neighborCorrections}`);

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
    onProgress?: (progress: number) => void,
    apiUrl?: string,
    options?: {
      earlyAbortThreshold?: number;
      minCellsProcessed?: number;
    }
  ): Promise<CellNumberMap> {
    const reader = new CellNumberReader(apiUrl);
    try {
      await reader.initialize();
      return await reader.readAllCells(image, grid, onProgress, options);
    } finally {
      await reader.terminate();
    }
  }
}
