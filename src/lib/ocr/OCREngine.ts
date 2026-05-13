// src/lib/ocr/OCREngine.ts
import Tesseract, { createWorker, PSM } from 'tesseract.js';
import type { OCRConfig, ClueResult } from '@/types';

export class OCREngine {
  private worker: Tesseract.Worker | null = null;
  private config: OCRConfig;

  constructor(config?: Partial<OCRConfig>) {
    this.config = {
      language: 'por',
      whitelist: undefined,
      pageSegMode: PSM.SINGLE_COLUMN,
      ...config,
    };
  }

  async initialize(language?: string): Promise<void> {
    const lang = language || this.config.language;
    this.worker = await createWorker(lang);

    const params: Partial<Tesseract.WorkerParams> = {
      tessedit_pageseg_mode: this.config.pageSegMode ?? PSM.SINGLE_COLUMN,
    };
    if (this.config.whitelist) {
      params['tessedit_char_whitelist'] = this.config.whitelist;
    }

    await this.worker.setParameters(params);
  }

  /**
   * Reconhece a coluna de pistas inteira de uma vez (PSM.SINGLE_COLUMN) e
   * mapeia cada bloco de texto para a linha da grade pela posição Y.
   *
   * @param columnImage  - ImageData da coluna de pistas pré-processada
   * @param rowPositions - Posições absolutas das linhas da grade (da GridResult)
   * @param scaleFactor  - Fator pelo qual a imagem foi escalada no preprocess (padrão 2)
   * @returns Array de ClueResult, um por linha da grade
   */
  async recognizeColumn(
    columnImage: ImageData,
    rowPositions: number[],
    scaleFactor = 2
  ): Promise<ClueResult[]> {
    if (!this.worker) throw new Error('OCR Engine não inicializado');

    await this.worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_COLUMN,
    });

    const canvas = document.createElement('canvas');
    canvas.width  = columnImage.width;
    canvas.height = columnImage.height;
    canvas.getContext('2d')!.putImageData(columnImage, 0, 0);

    const { data } = await this.worker.recognize(
      canvas,
      {},
      { hocr: true, text: true, blocks: true }
    );

    const numRows   = rowPositions.length - 1;
    const rowStartY = rowPositions[0];

    const rowCentersScaled = Array.from({ length: numRows }, (_, i) => {
      const top = rowPositions[i]     - rowStartY;
      const bot = rowPositions[i + 1] - rowStartY;
      return ((top + bot) / 2) * scaleFactor;
    });

    const findRow = (cy: number): number => {
      let best = 0, bestDist = Infinity;
      for (let r = 0; r < numRows; r++) {
        const d = Math.abs(cy - rowCentersScaled[r]);
        if (d < bestDist) { bestDist = d; best = r; }
      }
      return best;
    };

    interface WordEntry { text: string; confidence: number; cy: number }
    const allWords: WordEntry[] = [];

    if (data.blocks && data.blocks.length > 0) {
      for (const block of data.blocks) {
        for (const para of block.paragraphs) {
          for (const line of para.lines) {
            for (const word of line.words) {
              if (!word.text.trim()) continue;
              const cy = (word.bbox.y0 + word.bbox.y1) / 2;
              allWords.push({ text: word.text, confidence: word.confidence, cy });
            }
          }
        }
      }
    }

    if (allWords.length === 0 && data.hocr) {
      const wordRe = /title='bbox\s+\d+\s+(\d+)\s+\d+\s+(\d+)[^']*x_wconf\s+(\d+)'[^>]*>([^<]+)<\/span>/g;
      let m: RegExpExecArray | null;
      while ((m = wordRe.exec(data.hocr)) !== null) {
        const y0   = parseInt(m[1]);
        const y1   = parseInt(m[2]);
        const conf = parseInt(m[3]);
        const text = m[4].trim();
        if (text) allWords.push({ text, confidence: conf, cy: (y0 + y1) / 2 });
      }
    }

    if (allWords.length === 0 && data.text) {
      const lines = data.text.split('\n').filter(l => l.trim());
      const totalHeight = columnImage.height;
      return Array.from({ length: numRows }, (_, row) => {
        const rowTop    = (rowPositions[row]     - rowStartY) * scaleFactor;
        const rowBottom = (rowPositions[row + 1] - rowStartY) * scaleFactor;
        const lineHeight = totalHeight / Math.max(lines.length, 1);
        const chunk = lines.filter((_, i) => {
          const lineY = (i + 0.5) * lineHeight;
          return lineY >= rowTop && lineY < rowBottom;
        }).join(' ');
        return {
          row,
          text: this.postProcessText(chunk),
          confidence: (data.confidence ?? 0) / 100,
          rawText: chunk,
        };
      });
    }

    const rowWords: WordEntry[][] = Array.from({ length: numRows }, () => []);
    for (const word of allWords) {
      rowWords[findRow(word.cy)].push(word);
    }

    return rowWords.map((words, row) => {
      const rawText   = words.map(w => w.text).join(' ');
      const cleanText = this.postProcessText(rawText);
      const avgConf   = words.length > 0
        ? words.reduce((s, w) => s + w.confidence, 0) / words.length / 100
        : 0;
      return { row, text: cleanText, confidence: Math.min(1, avgConf), rawText };
    });
  }

  async recognizeClue(
    cellImage: ImageData,
    row: number,
    psm?: PSM
  ): Promise<ClueResult> {
    if (!this.worker) throw new Error('OCR Engine não inicializado');

    if (psm !== undefined) {
      await this.worker.setParameters({ tessedit_pageseg_mode: psm });
    }

    const canvas = document.createElement('canvas');
    canvas.width  = cellImage.width;
    canvas.height = cellImage.height;
    canvas.getContext('2d')!.putImageData(cellImage, 0, 0);

    const { data } = await this.worker.recognize(canvas);

    if (psm !== undefined) {
      await this.worker.setParameters({
        tessedit_pageseg_mode: this.config.pageSegMode ?? PSM.SINGLE_COLUMN,
      });
    }

    const rawText   = data.text;
    const cleanText = this.postProcessText(rawText);
    const confidence = Math.max(0, Math.min(1, (data.confidence ?? 0) / 100));

    return { row, text: cleanText, confidence, rawText };
  }

  postProcessText(rawText: string): string {
    let text = rawText
      .trim()
      .replace(/\r\n|\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/ \n/g, '\n')
      .replace(/\n /g, '\n');

    text = text
      .split('\n')
      .map(line =>
        line
          .split(' ')
          .filter(token => /[\p{L}\d]/u.test(token))
          .join(' ')
          .trim()
      )
      .filter(line => line.length > 0)
      .join('\n');

    text = text
      .split('\n')
      .map(line => line.length > 0
        ? line.charAt(0).toUpperCase() + line.slice(1)
        : line
      )
      .join('\n');

    return text;
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}
