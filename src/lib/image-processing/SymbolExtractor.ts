/**
 * SymbolExtractor - Extração e análise de símbolos
 *
 * Este módulo extrai símbolos individuais de células da tabela,
 * normaliza-os e extrai características para classificação.
 */

import type {
  ExtractedSymbol,
  SymbolFeatures,
  CellPosition,
} from '@/types/symbol';
import type {
  Contour,
  BoundingBox,
  GridResult
} from '@/types/image';

declare const cv: any;

export class SymbolExtractor {
  /**
   * Verifica se uma célula está vazia
   *
   * @param cellImage - ImageData da célula
   * @param threshold - Porcentagem mínima de pixels não-brancos (padrão 0.02)
   * @returns true se célula está vazia
   */
  static isEmpty(cellImage: ImageData, threshold: number = 0.02): boolean {
    const src = cv.matFromImageData(cellImage);
    let gray = new cv.Mat();

    try {
      // countNonZero exige 1 canal — converter para grayscale se necessário
      if (src.channels() > 1) {
        cv.cvtColor(src, gray, src.channels() === 4 ? cv.COLOR_RGBA2GRAY : cv.COLOR_RGB2GRAY);
      } else {
        src.copyTo(gray);
      }

      const nonWhitePixels = cv.countNonZero(gray);
      const totalPixels = gray.rows * gray.cols;

      return nonWhitePixels / totalPixels < threshold;
    } finally {
      src.delete();
      gray.delete();
    }
  }

  /**
   * Remove background da célula usando threshold Otsu
   */
  static removeBackground(cellImage: ImageData): ImageData {
    const src = cv.matFromImageData(cellImage);
    let gray = new cv.Mat();
    const dst = new cv.Mat();

    try {
      // Converter para grayscale se necessário (threshold requer 1 canal)
      if (src.channels() === 4) {
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      } else if (src.channels() === 3) {
        cv.cvtColor(src, gray, cv.COLOR_RGB2GRAY);
      } else {
        src.copyTo(gray);
      }

      cv.threshold(gray, dst, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

      const canvas = document.createElement('canvas');
      canvas.width = dst.cols;
      canvas.height = dst.rows;
      const ctx = canvas.getContext('2d')!;
      cv.imshow(canvas, dst);

      return ctx.getImageData(0, 0, dst.cols, dst.rows);
    } finally {
      src.delete();
      gray.delete();
      dst.delete();
    }
  }

  /**
   * Encontra o contorno principal do símbolo
   */
  static findSymbolContour(cellImage: ImageData): Contour {
    const src = cv.matFromImageData(cellImage);
    let binary = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    try {
      // findContours exige 8-bit single-channel — converter se necessário
      if (src.channels() > 1) {
        const gray = new cv.Mat();
        cv.cvtColor(src, gray, src.channels() === 4 ? cv.COLOR_RGBA2GRAY : cv.COLOR_RGB2GRAY);
        cv.threshold(gray, binary, 127, 255, cv.THRESH_BINARY);
        gray.delete();
      } else {
        src.copyTo(binary);
      }

      cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      if (contours.size() === 0) {
        throw new Error('Nenhum contorno encontrado');
      }

      let maxArea = 0;
      let maxContourIdx = -1;

      for (let i = 0; i < contours.size(); i++) {
        const area = cv.contourArea(contours.get(i));
        if (area > maxArea) {
          maxArea = area;
          maxContourIdx = i;
        }
      }

      if (maxContourIdx === -1) throw new Error('Nenhum contorno válido encontrado');

      const mainContour = contours.get(maxContourIdx);
      const boundingRect = cv.boundingRect(mainContour);
      const boundingBox: BoundingBox = {
        x: boundingRect.x,
        y: boundingRect.y,
        width: boundingRect.width,
        height: boundingRect.height
      };

      const perimeter = cv.arcLength(mainContour, true);
      const points = [];
      for (let i = 0; i < mainContour.rows; i++) {
        points.push({ x: mainContour.data32S[i * 2], y: mainContour.data32S[i * 2 + 1] });
      }

      return { points, boundingBox, area: maxArea, perimeter };
    } finally {
      src.delete();
      binary.delete();
      contours.delete();
      hierarchy.delete();
    }
  }

  /**
   * Recorta símbolo usando o bounding box
   */
  static cropSymbol(cellImage: ImageData, contour: Contour): ImageData {
    const src = cv.matFromImageData(cellImage);

    try {
      const { x, y, width, height } = contour.boundingBox;
      const margin = 5;
      const rect = new cv.Rect(
        Math.max(0, x - margin),
        Math.max(0, y - margin),
        Math.min(width + 2 * margin, src.cols - x),
        Math.min(height + 2 * margin, src.rows - y)
      );

      const roi = src.roi(rect);
      const canvas = document.createElement('canvas');
      canvas.width = roi.cols;
      canvas.height = roi.rows;
      const ctx = canvas.getContext('2d')!;
      cv.imshow(canvas, roi);
      const result = ctx.getImageData(0, 0, roi.cols, roi.rows);
      roi.delete();

      return result;
    } finally {
      src.delete();
    }
  }

  /**
   * Normaliza símbolo para tamanho padrão com padding centralizado
   */
  static normalizeSymbol(symbolImage: ImageData, size: number = 64): ImageData {
    const src = cv.matFromImageData(symbolImage);
    const dst = new cv.Mat();

    try {
      const aspectRatio = src.cols / src.rows;
      let newWidth = size;
      let newHeight = size;

      if (aspectRatio > 1) {
        newHeight = Math.round(size / aspectRatio);
      } else {
        newWidth = Math.round(size * aspectRatio);
      }

      const dsize = new cv.Size(newWidth, newHeight);
      cv.resize(src, dst, dsize, 0, 0, cv.INTER_AREA);

      const square = new cv.Mat.zeros(size, size, dst.type());
      const xOffset = Math.floor((size - newWidth) / 2);
      const yOffset = Math.floor((size - newHeight) / 2);
      const roi = square.roi(new cv.Rect(xOffset, yOffset, newWidth, newHeight));
      dst.copyTo(roi);
      roi.delete();

      const canvas = document.createElement('canvas');
      canvas.width = square.cols;
      canvas.height = square.rows;
      const ctx = canvas.getContext('2d')!;
      cv.imshow(canvas, square);
      const result = ctx.getImageData(0, 0, square.cols, square.rows);
      square.delete();

      return result;
    } finally {
      src.delete();
      dst.delete();
    }
  }

  /**
   * Extrai características (features) do símbolo.
   * Os Hu Moments são log-normalizados AQUI e não devem ser re-normalizados downstream.
   */
  static extractFeatures(symbolImage: ImageData): SymbolFeatures {
    const raw = cv.matFromImageData(symbolImage);
    let src = new cv.Mat();
    // moments, countNonZero, findContours, calcHist precisam de 1 canal
    if (raw.channels() > 1) {
      cv.cvtColor(raw, src, raw.channels() === 4 ? cv.COLOR_RGBA2GRAY : cv.COLOR_RGB2GRAY);
    } else {
      raw.copyTo(src);
    }
    raw.delete();

    try {
      const moments = cv.moments(src, true);

      const huMoments = new cv.Mat();
      cv.HuMoments(moments, huMoments);
      const huMomentsArray: number[] = [];
      for (let i = 0; i < 7; i++) {
        const value = huMoments.data64F[i];
        huMomentsArray.push(-Math.sign(value) * Math.log10(Math.abs(value) + 1));
      }
      huMoments.delete();

      const area = cv.countNonZero(src);

      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(src, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      let perimeter = 0;
      if (contours.size() > 0) {
        perimeter = cv.arcLength(contours.get(0), true);
      }
      contours.delete();
      hierarchy.delete();

      const boundingBox = this.getBoundingBox(src);
      const aspectRatio = boundingBox.width / (boundingBox.height || 1);
      const centerOfMass = {
        x: moments.m00 > 0 ? moments.m10 / moments.m00 : 0,
        y: moments.m00 > 0 ? moments.m01 / moments.m00 : 0
      };
      const histogram = this.calculateHistogram(src);
      const bbArea = boundingBox.width * boundingBox.height;
      const extent = bbArea > 0 ? area / bbArea : 0;

      return { area, perimeter, aspectRatio, moments: huMomentsArray, histogram, centerOfMass, extent };
    } finally {
      src.delete();
    }
  }

  private static calculateHistogram(src: any): number[] {
    const histogram: number[] = [];
    const hist = new cv.Mat();
    const srcVec = new cv.MatVector();
    srcVec.push_back(src);

    try {
      cv.calcHist(srcVec, [0], new cv.Mat(), hist, [256], [0, 256]);
      for (let i = 0; i < hist.rows; i++) histogram.push(hist.data32F[i]);
      return histogram;
    } finally {
      hist.delete();
      srcVec.delete();
    }
  }

  private static getBoundingBox(src: any): BoundingBox {
    // src já deve ser 1 canal — mas proteger defensivamente
    let gray = src;
    let needsDelete = false;
    if (src.channels && src.channels() > 1) {
      gray = new cv.Mat();
      cv.cvtColor(src, gray, src.channels() === 4 ? cv.COLOR_RGBA2GRAY : cv.COLOR_RGB2GRAY);
      needsDelete = true;
    }

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    try {
      cv.findContours(gray, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      if (contours.size() === 0) return { x: 0, y: 0, width: gray.cols, height: gray.rows };
      const rect = cv.boundingRect(contours.get(0));
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    } finally {
      contours.delete();
      hierarchy.delete();
      if (needsDelete) gray.delete();
    }
  }

  /**
   * Gera um perceptual hash (pHash) via DCT — robusto a colisões.
   *
   * Algoritmo:
   *  1. Redimensionar para 32×32
   *  2. DCT 2D sobre bloco 8×8 de baixas frequências
   *  3. Comparar cada coeficiente com a mediana → 64 bits
   *  4. Retornar como string hex "sym_XXXXXXXXXXXXXXXX"
   */
  static generateSymbolHash(symbolImage: ImageData): string {
    const SIZE = 32;
    const HASH_SIZE = 8;

    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = symbolImage.width;
    tmpCanvas.height = symbolImage.height;
    tmpCanvas.getContext('2d')!.putImageData(symbolImage, 0, 0);

    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(tmpCanvas, 0, 0, SIZE, SIZE);
    const resized = ctx.getImageData(0, 0, SIZE, SIZE);

    const pixels: number[][] = [];
    for (let y = 0; y < SIZE; y++) {
      pixels[y] = [];
      for (let x = 0; x < SIZE; x++) {
        const idx = (y * SIZE + x) * 4;
        pixels[y][x] =
          0.299 * resized.data[idx] +
          0.587 * resized.data[idx + 1] +
          0.114 * resized.data[idx + 2];
      }
    }

    const dct: number[][] = [];
    for (let u = 0; u < HASH_SIZE; u++) {
      dct[u] = [];
      for (let v = 0; v < HASH_SIZE; v++) {
        let sum = 0;
        for (let y = 0; y < SIZE; y++) {
          for (let x = 0; x < SIZE; x++) {
            sum +=
              pixels[y][x] *
              Math.cos(((2 * x + 1) * u * Math.PI) / (2 * SIZE)) *
              Math.cos(((2 * y + 1) * v * Math.PI) / (2 * SIZE));
          }
        }
        dct[u][v] = sum;
      }
    }

    const flatDct: number[] = [];
    for (let u = 0; u < HASH_SIZE; u++) {
      for (let v = 0; v < HASH_SIZE; v++) {
        if (u === 0 && v === 0) continue;
        flatDct.push(dct[u][v]);
      }
    }

    const sorted = flatDct.toSorted((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    let hashHigh = 0;
    let hashLow = 0;
    for (let i = 0; i < flatDct.length; i++) {
      const bit = flatDct[i] > median ? 1 : 0;
      if (i < 32) hashHigh = (hashHigh << 1) | bit;
      else hashLow = (hashLow << 1) | bit;
    }

    return `sym_${(hashHigh >>> 0).toString(16).padStart(8, '0')}${(hashLow >>> 0).toString(16).padStart(8, '0')}`;
  }

  /**
   * Calcula distância de Hamming entre dois pHashes.
   * 0 = idêntico, 64 = completamente diferente.
   */
  static hammingDistance(hash1: string, hash2: string): number {
    const h1 = hash1.replace('sym_', '');
    const h2 = hash2.replace('sym_', '');
    if (h1.length !== h2.length) return 64;

    let distance = 0;
    for (let i = 0; i < h1.length; i += 8) {
      const v1 = parseInt(h1.slice(i, i + 8), 16);
      const v2 = parseInt(h2.slice(i, i + 8), 16);
      let xor = (v1 ^ v2) >>> 0;
      xor = xor - ((xor >> 1) & 0x55555555);
      xor = (xor & 0x33333333) + ((xor >> 2) & 0x33333333);
      distance += (((xor + (xor >> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
    }
    return distance;
  }

  /**
   * Pipeline completo de extração de um símbolo de uma célula.
   */
  static async extractSymbol(
    cellImage: ImageData,
    position: CellPosition
  ): Promise<ExtractedSymbol | null> {
    // Converter para grayscale uma vez (todas as operações cv precisam de 1 canal)
    const toGray = (img: ImageData): ImageData => {
      const src = cv.matFromImageData(img);
      const dst = new cv.Mat();
      try {
        if (src.channels() === 4)      cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY);
        else if (src.channels() === 3) cv.cvtColor(src, dst, cv.COLOR_RGB2GRAY);
        else                           src.copyTo(dst);
        const c = document.createElement('canvas');
        c.width = dst.cols; c.height = dst.rows;
        cv.imshow(c, dst);
        return c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
      } finally { src.delete(); dst.delete(); }
    };

    const gray = toGray(cellImage);

    if (this.isEmpty(gray)) return null;

    try {
      const cleaned    = this.removeBackground(gray);
      const contour    = this.findSymbolContour(cleaned);
      const cropped    = this.cropSymbol(cleaned, contour);
      const normalized = this.normalizeSymbol(cropped, 64);
      const features   = this.extractFeatures(normalized);
      const hash       = this.generateSymbolHash(normalized);

      return { id: hash, imageData: normalized, features, positions: [position], hash };
    } catch (error) {
      console.error(`Erro ao extrair símbolo em (${position.row}, ${position.col}):`, error);
      return null;
    }
  }

  // ─── Caminho primário: GridDetector ──────────────────────────────────────

  /**
   * Extrai todos os símbolos usando GridResult (caminho primário).
   *
   * Utiliza GridDetector.extractCell() que opera diretamente sobre as
   * posições absolutas da grade, sem depender de gridPoints[][] interpolados.
   *
   * @param preprocessedImage - Imagem pré-processada
   * @param grid              - Grade detectada por GridDetector.detect()
   * @param skipFirstColumn   - Pular primeira coluna (coluna de pistas)
   */
  static async extractAllSymbolsFromGrid(
    preprocessedImage: ImageData,
    grid: GridResult,
    skipFirstColumn: boolean = true
  ): Promise<ExtractedSymbol[]> {
    const { GridDetector } = await import('./GridDetector');
    const startCol = skipFirstColumn ? 1 : 0;
    const tasks: Promise<ExtractedSymbol | null>[] = [];

    for (let row = 0; row < grid.rows; row++) {
      for (let col = startCol; col < grid.cols; col++) {
        tasks.push((async () => {
          try {
            const cellImage = GridDetector.extractCell(preprocessedImage, row, col, grid);
            return await this.extractSymbol(cellImage, { row, col });
          } catch (err: any) {
            const msg = err?.message || String(err);
            if (row === 0 && col === 1) {
              console.error(`[SymbolExtractor] erro detalhado (0,1): msg="${msg}" stack=${err?.stack || '(no stack)'}`);
            }
            return null;
          }
        })());
      }
    }

    const results = await Promise.all(tasks);
    return results.filter((s: ExtractedSymbol | null): s is ExtractedSymbol => s !== null);
  }

  // ─── Caminho legado: TableDetector ───────────────────────────────────────

  /**
   * Extrai todos os símbolos de uma tabela via TableDetector (fallback legado).
   *
   * @param preprocessedImage - Imagem pré-processada
   * @param tableStructure    - Estrutura da tabela (TableDetector)
   * @param skipFirstColumn   - Pular primeira coluna
   */
  static async extractAllSymbols(
    preprocessedImage: ImageData,
    tableStructure: any,
    skipFirstColumn: boolean = true
  ): Promise<ExtractedSymbol[]> {
    const { TableDetector } = await import('./TableDetector');
    const startCol = skipFirstColumn ? 1 : 0;
    const tasks: Promise<ExtractedSymbol | null>[] = [];

    for (let row = 0; row < tableStructure.rows; row++) {
      for (let col = startCol; col < tableStructure.cols; col++) {
        tasks.push((async () => {
          try {
            const cellImage = TableDetector.extractCell(preprocessedImage, row, col, tableStructure);
            return await this.extractSymbol(cellImage, { row, col });
          } catch (err) {
            return null;
          }
        })());
      }
    }

    const results = await Promise.all(tasks);
    return results.filter((s: ExtractedSymbol | null): s is ExtractedSymbol => s !== null);
  }
}
