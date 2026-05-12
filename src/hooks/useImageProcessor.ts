// src/hooks/useImageProcessor.ts
import { useState, useCallback } from 'react';
import type {
  ProcessedData,
  ProcessingStatus,
  ExtractedSymbol,
  UniqueSymbol,
  ClueResult,
  GridResult,
  TableStructure
} from '@/types';
import { ImageProcessor } from '@/lib/image-processing/ImageProcessor';
import { GridDetector } from '@/lib/image-processing/GridDetector';
import { TableDetector } from '@/lib/image-processing/TableDetector';
import { SymbolExtractor } from '@/lib/image-processing/SymbolExtractor';
import { SymbolClassifier } from '@/lib/image-processing/SymbolClassifier';
import { OCREngine } from '@/lib/ocr/OCREngine';
import { PSM } from 'tesseract.js';

export function useImageProcessor() {
  const [status, setStatus] = useState<ProcessingStatus>({
    stage: 'idle',
    progress: 0,
    currentStep: '',
    error: null,
  });

  const processImage = useCallback(async (imageData: ImageData): Promise<ProcessedData> => {
    try {
      // Garantir que OpenCV está carregado
      if (typeof cv === 'undefined' || !cv.Mat) {
        setStatus({ stage: 'idle', progress: 0, currentStep: 'Aguardando OpenCV.js...', error: null });
        await new Promise<void>((resolve) => {
          const check = () => {
            if (typeof cv !== 'undefined' && cv.Mat) resolve();
            else setTimeout(check, 100);
          };
          check();
        });
      }

      // ── Fase 1: Pré-processamento ────────────────────────────────────────
      setStatus({ stage: 'preprocessing', progress: 10, currentStep: 'Pré-processando imagem...', error: null });

      const preprocessed = await ImageProcessor.preprocess(imageData);

      // ── Fase 2: Detecção de grade ────────────────────────────────────────
      // IMPORTANTE: GridDetector recebe a imagem ORIGINAL (não preprocessada)
      // pois faz sua própria binarização interna. A morfologia do preprocess
      // (MORPH_CLOSE + MORPH_OPEN) distorce as bordas finas da grade.
      setStatus({ stage: 'detecting', progress: 25, currentStep: 'Detectando grade (GridDetector)...', error: null });

      let grid: GridResult;
      let tableStructure: TableStructure;
      let usedFallback = false;

      try {
        // Caminho primário: passar imagem original para o GridDetector
        grid = GridDetector.detect(imageData);

        // Construir TableStructure compatível com legado a partir do GridResult
        console.log('[useImageProcessor] Grid OK:', JSON.stringify({ rows: grid.rows, cols: grid.cols, roi: grid.roi }));
        tableStructure = gridResultToTableStructure(grid);
        console.log('[useImageProcessor] TableStructure OK');

        setStatus({
          stage: 'detecting',
          progress: 40,
          currentStep: `Grade detectada: ${grid.rows} × ${grid.cols} células`,
          error: null
        });

      } catch (gridError) {
        // Fallback: Hough Line Transform (TableDetector)
        console.warn('[useImageProcessor] GridDetector falhou, usando fallback TableDetector:', gridError);
        usedFallback = true;

        setStatus({ stage: 'detecting', progress: 35, currentStep: 'Fallback: detectando via Hough...', error: null });

        tableStructure = await TableDetector.detectTableStructure(imageData);

        // Construir GridResult a partir do TableStructure legado
        grid = tableStructureToGridResult(tableStructure);

        setStatus({
          stage: 'detecting',
          progress: 40,
          currentStep: `Grade detectada (fallback): ${tableStructure.rows} × ${tableStructure.cols}`,
          error: null
        });
      }

      // ── Fase 3: Extração de símbolos ─────────────────────────────────────
      setStatus({ stage: 'extracting', progress: 55, currentStep: 'Extraindo símbolos...', error: null });

      // extractCell usa cv.imshow que exige RGBA — passar a imagem original (4 canais)
      // A preprocessed é grayscale (1 canal) e causa erro WASM no imshow
      console.log('[useImageProcessor] Iniciando extração de símbolos, usedFallback=', usedFallback);
      const extractedSymbols: ExtractedSymbol[] = usedFallback
        ? await SymbolExtractor.extractAllSymbols(imageData, tableStructure, true)
        : await SymbolExtractor.extractAllSymbolsFromGrid(imageData, grid, true);
      console.log('[useImageProcessor] Extração concluída:', extractedSymbols.length);

      setStatus({
        stage: 'extracting',
        progress: 65,
        currentStep: `${extractedSymbols.length} símbolos extraídos`,
        error: null
      });

      // ── Fase 4: Classificação ────────────────────────────────────────────
      setStatus({ stage: 'classifying', progress: 75, currentStep: 'Classificando símbolos únicos...', error: null });

      const uniqueSymbols: UniqueSymbol[] = SymbolClassifier.identifyUniqueSymbols(extractedSymbols);

      setStatus({
        stage: 'classifying',
        progress: 82,
        currentStep: `${uniqueSymbols.length} símbolos únicos identificados`,
        error: null
      });

      // ── Fase 5: OCR das pistas (coluna inteira, PSM.SINGLE_COLUMN) ───────
      setStatus({ stage: 'ocr', progress: 88, currentStep: 'Reconhecendo pistas...', error: null });

      let clues: ClueResult[] = [];
      const ocrEngine = new OCREngine({ pageSegMode: PSM.SINGLE_COLUMN });

      try {
        await ocrEngine.initialize('por');

        // 1. Extrair a coluna de pistas inteira (col=0) de uma vez
        //    Sem bordas horizontais entre células — o Tesseract lê contexto contínuo
        const columnSlice = GridDetector.extractColumnSlice(imageData, 0, grid);
        console.log(`[OCR] coluna de pistas: ${columnSlice.width}×${columnSlice.height}px`);

        // 2. Pré-processar: denoising + upscale 2× + CLAHE + adaptiveThreshold
        const processed = ImageProcessor.preprocessClueCell(columnSlice);
        console.log(`[OCR] coluna processada: ${processed.width}×${processed.height}px`);

        // 3. OCR único da coluna inteira — mapear palavras → linhas da grade por Y
        setStatus({ stage: 'ocr', progress: 92, currentStep: 'Processando OCR...', error: null });
        clues = await ocrEngine.recognizeColumn(processed, grid.rowPositions, 2);

        const cluesWithText = clues.filter(c => c.text.trim().length > 0).length;
        clues.forEach(c =>
          console.log(`[OCR] pista ${c.row + 1}: "${c.text.substring(0, 50)}" conf=${(c.confidence * 100).toFixed(0)}%`)
        );
        console.log(`[OCR] concluído: ${cluesWithText}/${grid.rows} pistas reconhecidas`);

      } catch (ocrErr) {
        console.error('[OCR] falha:', ocrErr);
        clues = Array.from({ length: grid.rows }, (_, i) => ({
          row: i, text: '', confidence: 0, rawText: '',
        }));
      } finally {
        await ocrEngine.terminate();
      }

      // ── Completo ─────────────────────────────────────────────────────────
      setStatus({ stage: 'complete', progress: 100, currentStep: 'Processamento concluído!', error: null });

      return {
        preprocessedImage: preprocessed,
        tableStructure,
        grid,
        clues,
        extractedSymbols,
        uniqueSymbols,
        processedAt: new Date(),
      };

    } catch (error) {
      console.error('[useImageProcessor] ERRO CAPTURADO:', error, (error as any)?.stack);
      setStatus({ stage: 'error', progress: 0, currentStep: 'Erro no processamento', error: error as Error });
      throw error;
    }
  }, []);

  return { processImage, status };
}

// ─── Helpers de conversão entre GridResult e TableStructure ───────────────────

/**
 * Converte GridResult → TableStructure para compatibilidade com código legado.
 */
function gridResultToTableStructure(grid: GridResult): TableStructure {
  // Reconstruir gridPoints como matriz (rows+1) × (cols+1) de intersecções
  const gridPoints = grid.rowPositions.map(y =>
    grid.colPositions.map(x => ({ x, y }))
  );

  const medianColWidth = median(grid.colWidths);
  const clueColumnWidth = grid.colWidths[0] ?? medianColWidth;
  const answerColumnWidth = grid.colWidths.length > 1
    ? median(grid.colWidths.slice(1))
    : medianColWidth;

  return {
    rows: grid.rows,
    cols: grid.cols,
    cellWidth: medianColWidth,
    cellHeight: median(grid.rowHeights),
    gridPoints,
    clueColumnWidth,
    answerColumnWidth
  };
}

/**
 * Converte TableStructure → GridResult para uso com o novo pipeline.
 */
function tableStructureToGridResult(ts: TableStructure): GridResult {
  const rowPositions = ts.gridPoints.map(row => row[0].y);
  const colPositions = ts.gridPoints[0].map(pt => pt.x);

  const colWidths: number[] = [];
  for (let c = 0; c < ts.cols; c++) {
    colWidths.push(colPositions[c + 1] - colPositions[c]);
  }

  const rowHeights: number[] = [];
  for (let r = 0; r < ts.rows; r++) {
    rowHeights.push(rowPositions[r + 1] - rowPositions[r]);
  }

  const firstRow = ts.gridPoints[0];
  const lastRow = ts.gridPoints[ts.rows];
  const roi = {
    x: colPositions[0],
    y: rowPositions[0],
    width: colPositions[ts.cols] - colPositions[0],
    height: lastRow ? lastRow[0].y - rowPositions[0] : ts.rows * ts.cellHeight
  };

  return {
    roi,
    rowPositions,
    colPositions,
    colWidths,
    rowHeights,
    rows: ts.rows,
    cols: ts.cols
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
