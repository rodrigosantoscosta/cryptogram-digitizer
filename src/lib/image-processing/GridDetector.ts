/**
 * GridDetector — Detecção da grade do criptograma
 *
 * Cadeia de abordagens (mais para menos robusta):
 *
 *  1. **detectByProjectionFFT** (primária)
 *     Analisa as projeções 1D da imagem binarizada com FFT de Cooley-Tukey.
 *     A grade regular cria um padrão periódico — o período dominante no espectro
 *     dá diretamente o tamanho da célula, sem necessidade de bordas contínuas.
 *     Funciona com até ~60% das bordas fragmentadas.
 *
 *  2. **detectByHoughIntersection** (secundária)
 *     HoughLinesP → separar segmentos H/V → votar nas interseções → projetar.
 *     Requer bordas razoavelmente contínuas.
 *
 *  3. **detectByContours** (terciária)
 *     Detecta diretamente contornos retangulares de área similar.
 *     Cada célula é detectada independentemente.
 *
 *  4. **detectByMorphology** (fallback final)
 *     Isolamento morfológico de linhas + projeção de pixels.
 *
 * @requires opencv.js carregado no escopo global como `cv`
 */

import type { BoundingBox, GridResult } from '../../types/image';

declare const cv: any;

// ─── Constantes ────────────────────────────────────────────────────────────────

/** Fração mínima da dimensão do ROI que o kernel morfológico de linhas deve cobrir */
const MORPH_KERNEL_RATIO = 0.35;

/** Margem em pixels ao redor do ROI detectado */
const ROI_MARGIN = 4;

/** Distância máxima (px) para agrupar picos na mesma linha (fallback) */
const PEAK_CLUSTER_RADIUS = 6;

/** Desvio máximo em relação à mediana do gap para aceitar uma posição (fallback) */
const GAP_OUTLIER_TOLERANCE = 0.45;

/** Número mínimo de linhas para considerar detecção válida */
const MIN_LINES = 3;

/** Tolerância de aspectRatio para considerar um contorno "quadrangular" (1.0 = quadrado perfeito) */
const CELL_ASPECT_RATIO_MAX = 2.5;

/** Fração mínima de área preenchida dentro do bounding rect (solidez mínima) */
const CELL_SOLIDITY_MIN = 0.7;

/** Um contorno é aceito como célula se sua área for entre estes múltiplos da área modal */
const CELL_AREA_MIN_FACTOR = 0.35;
const CELL_AREA_MAX_FACTOR = 2.8;

/** Tolerância em pixels para agrupar células na mesma linha/coluna */
const ROW_COL_CLUSTER_TOLERANCE = 0.4; // fração da altura/largura modal da célula

/** Número mínimo de células para considerar a detecção por contornos válida */
const MIN_CELLS_CONTOUR = 6;

// ─── Constantes — Hough Intersection ──────────────────────────────────────────

/** Votos mínimos para que um segmento HoughLinesP seja aceito */
const HOUGH_THRESHOLD = 30;

/** Comprimento mínimo de segmento = imageWidth * este fator */
const HOUGH_MIN_LINE_RATIO = 0.04;

/** Gap máximo (px) entre segmentos colineares para mesclá-los */
const HOUGH_MAX_LINE_GAP = 8;

/** Tolerância em graus para classificar um segmento como H ou V */
const HOUGH_ANGLE_TOLERANCE = 15;

/** Tamanho de cada bucket do acumulador de interseções (px) */
const INTERSECT_BUCKET_SIZE = 8;

/** Votos mínimos no acumulador para considerar um ponto como canto de grade */
const INTERSECT_MIN_VOTES = 3;

/** Razão gap/mediana acima da qual o gap é tratado como "faltando linhas" */
const MEDIAN_GAP_OUTLIER = 2.0;

/** Desvio máximo permitido em relação à mediana do tamanho de célula (validação) */
const GRID_UNIFORMITY_TOL = 0.4;

// ─── Constantes — FFT Projection Detection ────────────────────────────────────

/** Período mínimo de célula em pixels (células menores que isso são ruído/símbolos) */
const FFT_MIN_CELL_PERIOD = 15;

/** Período máximo = dimensão da imagem × este fator (evita detectar borda externa como célula) */
const FFT_MAX_CELL_PERIOD_RATIO = 0.45;

/** Razão sinal/ruído espectral mínima para aceitar a frequência dominante */
const FFT_SNR_MIN = 3.0;

/** Sigma da suavização gaussiana para detecção de fase, como fração do período */
const FFT_PEAK_SMOOTH_SIGMA_RATIO = 0.10;

/** Separação mínima entre picos de projeção, como fração do período */
const FFT_PEAK_MIN_SEPARATION_RATIO = 0.60;

// ──────────────────────────────────────────────────────────────────────────────

export class GridDetector {
  // ─── API Pública ────────────────────────────────────────────────────────────

  /**
   * Detecta a grade de células do criptograma.
   *
   * Tenta primeiro a abordagem por contornos quadrangulares.
   * Em caso de falha, usa o isolamento morfológico de linhas como fallback.
   *
   * @param imageData - Imagem pré-processada (resultado de ImageProcessor.preprocess)
   * @returns GridResult com posições absolutas de linhas, colunas e dimensões
   * @throws Error se nenhuma das abordagens detectar uma grade válida
   */
  static detect(imageData: ImageData): GridResult {
    // Tentativa 1: FFT de projeção — robusta a bordas fragmentadas
    try {
      const result = this.detectByProjectionFFT(imageData);
      console.log('[GridDetector] ✓ Detecção por FFT bem-sucedida');
      return result;
    } catch (fftError) {
      console.warn('[GridDetector] FFT falhou, tentando Hough:', fftError);
    }

    // Tentativa 2: Hough + votação de interseções
    try {
      const result = this.detectByHoughIntersection(imageData);
      console.log('[GridDetector] ✓ Detecção por Hough+Interseção bem-sucedida');
      return result;
    } catch (houghError) {
      console.warn('[GridDetector] Hough+Interseção falhou, tentando contornos:', houghError);
    }

    // Tentativa 3: contornos quadrangulares
    try {
      const result = this.detectByContours(imageData);
      console.log('[GridDetector] ✓ Detecção por contornos bem-sucedida');
      return result;
    } catch (contourError) {
      console.warn('[GridDetector] Detecção por contornos falhou, usando morfologia:', contourError);
    }

    // Fallback final: isolamento morfológico de linhas
    return this.detectByMorphology(imageData);
  }

  /**
   * Extrai uma célula individual da imagem original.
   */
  static extractCell(
    imageData: ImageData,
    row: number,
    col: number,
    grid: GridResult,
    margin = 2
  ): ImageData {
    if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) {
      throw new Error(
        `Índices fora dos limites: (${row}, ${col}) em ${grid.rows}×${grid.cols}`
      );
    }

    const x = grid.colPositions[col] + margin;
    const y = grid.rowPositions[row] + margin;
    const w = grid.colWidths[col] - margin * 2;
    const h = grid.rowHeights[row] - margin * 2;

    if (w <= 0 || h <= 0) throw new Error(`Dimensões inválidas: ${w}×${h}`);

    const src = cv.matFromImageData(imageData);

    try {
      const rect = new cv.Rect(
        Math.max(0, x),
        Math.max(0, y),
        Math.min(w, src.cols - Math.max(0, x)),
        Math.min(h, src.rows - Math.max(0, y))
      );
      const roi = src.roi(rect);

      const canvas = document.createElement('canvas');
      canvas.width = roi.cols;
      canvas.height = roi.rows;
      const ctx = canvas.getContext('2d')!;
      cv.imshow(canvas, roi);
      roi.delete();

      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    } finally {
      src.delete();
    }
  }

  /**
   * Extrai uma fatia vertical da imagem correspondendo a uma coluna inteira da grade.
   *
   * Usado para OCR da coluna de pistas: em vez de extrair 12 células individuais
   * (com bordas horizontais entre elas), extrai a coluna completa de uma vez para
   * que o Tesseract leia o texto em contexto contínuo com PSM.SINGLE_COLUMN.
   *
   * @param imageData  - Imagem original RGBA
   * @param col        - Índice da coluna a extrair (0 = coluna de pistas)
   * @param grid       - GridResult com posições
   * @param marginX    - Margem horizontal em pixels (padrão 4)
   * @returns ImageData da fatia vertical completa
   */
  static extractColumnSlice(
    imageData: ImageData,
    col: number,
    grid: GridResult,
    marginX = 4
  ): ImageData {
    const x = grid.colPositions[col] + marginX;
    const w = grid.colWidths[col] - marginX * 2;
    const y = grid.rowPositions[0];
    const h = grid.rowPositions[grid.rowPositions.length - 1] - y;

    if (w <= 0 || h <= 0) throw new Error(`Dimensões inválidas para coluna ${col}: ${w}×${h}`);

    const src = cv.matFromImageData(imageData);
    try {
      const rect = new cv.Rect(
        Math.max(0, x),
        Math.max(0, y),
        Math.min(w, src.cols - Math.max(0, x)),
        Math.min(h, src.rows - Math.max(0, y))
      );
      const roi    = src.roi(rect);
      const canvas = document.createElement('canvas');
      canvas.width  = roi.cols;
      canvas.height = roi.rows;
      cv.imshow(canvas, roi);
      roi.delete();
      return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    } finally {
      src.delete();
    }
  }

  /**
   * Desenha a grade detectada sobre a imagem (para debug/validação).
   */
  static visualize(imageData: ImageData, grid: GridResult): ImageData {
    const src = cv.matFromImageData(imageData);
    const dst = new cv.Mat();

    try {
      if (src.channels() === 1) {
        cv.cvtColor(src, dst, cv.COLOR_GRAY2RGBA);
      } else {
        src.copyTo(dst);
      }

      const green = new cv.Scalar(0, 220, 0, 255);
      const blue  = new cv.Scalar(30, 120, 255, 255);
      const t = 2;

      for (const y of grid.rowPositions) {
        const x0 = grid.colPositions[0];
        const x1 = grid.colPositions[grid.colPositions.length - 1];
        cv.line(dst, new cv.Point(x0, y), new cv.Point(x1, y), green, t);
      }
      for (const x of grid.colPositions) {
        const y0 = grid.rowPositions[0];
        const y1 = grid.rowPositions[grid.rowPositions.length - 1];
        cv.line(dst, new cv.Point(x, y0), new cv.Point(x, y1), blue, t);
      }

      const canvas = document.createElement('canvas');
      canvas.width = dst.cols;
      canvas.height = dst.rows;
      const ctx = canvas.getContext('2d')!;
      cv.imshow(canvas, dst);
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    } finally {
      src.delete();
      dst.delete();
    }
  }

  // ─── Abordagem primária: Hough + votação de interseções ────────────────────

  /**
   * Detecta a grade usando HoughLinesP para encontrar segmentos de linha e depois
   * vota nas interseções entre segmentos H e V para localizar os cantos da grade.
   *
   * Pipeline:
   *  1. Grayscale → Canny com limiares adaptativos baseados na mediana de pixels
   *  2. HoughLinesP → separar em segmentos horizontais e verticais
   *  3. Calcular todas as interseções H×V e acumular em buckets 2D
   *  4. Extrair picos do acumulador → projetar em X e Y
   *  5. Regularização por gap mediano → GridResult
   */
  private static detectByHoughIntersection(imageData: ImageData): GridResult {
    const src = cv.matFromImageData(imageData);
    let gray = new cv.Mat();
    let edges = new cv.Mat();

    try {
      // 1. Grayscale
      if (src.channels() === 4) {
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      } else if (src.channels() === 3) {
        cv.cvtColor(src, gray, cv.COLOR_RGB2GRAY);
      } else {
        src.copyTo(gray);
      }

      // Calcular limiar adaptativo para Canny baseado na mediana dos pixels
      const pixelValues: number[] = [];
      const data = gray.data;
      const cols = gray.cols;
      for (let i = 0; i < gray.rows; i += 4) {
        for (let j = 0; j < cols; j += 4) {
          pixelValues.push(data[i * cols + j]);
        }
      }
      pixelValues.sort((a, b) => a - b);
      const medianPixel = pixelValues[Math.floor(pixelValues.length / 2)];
      const cannyLow  = Math.max(0,   Math.round(medianPixel * 0.66));
      const cannyHigh = Math.min(255, Math.round(medianPixel * 1.33));

      cv.Canny(gray, edges, cannyLow, cannyHigh);

      // 2. HoughLinesP
      const linesOut = new cv.Mat();
      const minLen = Math.round(Math.min(src.cols, src.rows) * HOUGH_MIN_LINE_RATIO);
      cv.HoughLinesP(edges, linesOut, 1, Math.PI / 180, HOUGH_THRESHOLD, minLen, HOUGH_MAX_LINE_GAP);

      if (linesOut.rows === 0) {
        linesOut.delete();
        throw new Error('HoughLinesP não encontrou segmentos');
      }

      // Separar em segmentos H e V
      const hSegs: Array<[number, number, number, number]> = [];
      const vSegs: Array<[number, number, number, number]> = [];
      const tRad = (HOUGH_ANGLE_TOLERANCE * Math.PI) / 180;

      for (let i = 0; i < linesOut.rows; i++) {
        const x1 = linesOut.data32S[i * 4];
        const y1 = linesOut.data32S[i * 4 + 1];
        const x2 = linesOut.data32S[i * 4 + 2];
        const y2 = linesOut.data32S[i * 4 + 3];
        const angle = Math.abs(Math.atan2(y2 - y1, x2 - x1));
        if (angle <= tRad || angle >= Math.PI - tRad) {
          hSegs.push([x1, y1, x2, y2]);
        } else if (Math.abs(angle - Math.PI / 2) <= tRad) {
          vSegs.push([x1, y1, x2, y2]);
        }
      }
      linesOut.delete();

      if (hSegs.length < 2 || vSegs.length < 2) {
        throw new Error(
          `Segmentos insuficientes: ${hSegs.length} H, ${vSegs.length} V`
        );
      }

      // 3. Votação de interseções em acumulador 2D
      const bW = Math.ceil(src.cols / INTERSECT_BUCKET_SIZE);
      const bH = Math.ceil(src.rows / INTERSECT_BUCKET_SIZE);
      const acc: number[][] = Array.from({ length: bH }, () => new Array(bW).fill(0));

      for (const [hx1, hy1, hx2, hy2] of hSegs) {
        for (const [vx1, vy1, vx2, vy2] of vSegs) {
          const pt = this.lineIntersect(hx1, hy1, hx2, hy2, vx1, vy1, vx2, vy2);
          if (pt === null) continue;
          const [px, py] = pt;
          if (px < 0 || py < 0 || px >= src.cols || py >= src.rows) continue;
          const bx = Math.floor(px / INTERSECT_BUCKET_SIZE);
          const by = Math.floor(py / INTERSECT_BUCKET_SIZE);
          acc[by][bx]++;
        }
      }

      // 4. Extrair picos do acumulador → coordenadas de candidatos a canto
      const candidateX: number[] = [];
      const candidateY: number[] = [];

      for (let by = 0; by < bH; by++) {
        for (let bx = 0; bx < bW; bx++) {
          if (acc[by][bx] >= INTERSECT_MIN_VOTES) {
            candidateX.push(bx * INTERSECT_BUCKET_SIZE + INTERSECT_BUCKET_SIZE / 2);
            candidateY.push(by * INTERSECT_BUCKET_SIZE + INTERSECT_BUCKET_SIZE / 2);
          }
        }
      }

      if (candidateX.length < 4) {
        throw new Error(`Cantos insuficientes no acumulador: ${candidateX.length}`);
      }

      // 5. Projetar em X e Y → posições de colunas e linhas
      const rawColPos = this.clusterPeaks(candidateX.toSorted((a, b) => a - b), INTERSECT_BUCKET_SIZE * 1.5);
      const rawRowPos = this.clusterPeaks(candidateY.toSorted((a, b) => a - b), INTERSECT_BUCKET_SIZE * 1.5);

      const colPositions = this.regularizeByMedianGap(rawColPos);
      const rowPositions = this.regularizeByMedianGap(rawRowPos);

      if (rowPositions.length < 3 || colPositions.length < 3) {
        throw new Error(
          `Grade insuficiente após regularização: ${rowPositions.length} H, ${colPositions.length} V`
        );
      }

      const colWidths  = this.computeGaps(colPositions);
      const rowHeights = this.computeGaps(rowPositions);

      // Validar uniformidade
      this.validateUniformity(colWidths, 'colunas');
      this.validateUniformity(rowHeights, 'linhas');

      const roi: BoundingBox = {
        x: colPositions[0],
        y: rowPositions[0],
        width:  colPositions[colPositions.length - 1] - colPositions[0],
        height: rowPositions[rowPositions.length - 1] - rowPositions[0],
      };

      return {
        roi,
        rowPositions,
        colPositions,
        colWidths,
        rowHeights,
        rows: rowPositions.length - 1,
        cols: colPositions.length - 1,
      };
    } finally {
      src.delete();
      gray.delete();
      edges.delete();
    }
  }

  // ─── Abordagem primária: FFT de projeção ────────────────────────────────────

  /**
   * Detecta a grade usando análise espectral (FFT) das projeções 1D da imagem.
   *
   * Uma grade regular cria um padrão periódico nas somas de pixels por linha/coluna.
   * A FFT extrai o período dominante (tamanho de célula) sem precisar detectar
   * bordas individualmente — funciona mesmo com até 60% das bordas fragmentadas.
   *
   * Pipeline:
   *  1. Grayscale → Otsu threshold (SEM fechamento morfológico — preserva periodicidade)
   *  2. hProj[y] = Σ pixels escuros na linha y; vProj[x] = idem por coluna
   *  3. FFT com janela Hanning em cada projeção → período dominante + SNR
   *  4. Suavizar projeção → picos locais → ajustar fase φ por mínimos quadrados
   *  5. Gerar posições: [φ + n×T] dentro dos bounds da imagem
   *  6. Validar uniformidade → GridResult
   */
  /**
   * Detecta a grade usando análise espectral (FFT) das projeções 1D da imagem.
   *
   * Para grades uniformes (todas as colunas com a mesma largura), a FFT encontra
   * o período diretamente. Para grades não-uniformes (ex.: criptogramas com uma
   * coluna de pistas larga + colunas numéricas estreitas), o eixo onde a FFT falha
   * (SNR < limiar) é recuperado via `detectPositionsByPeaks`, que encontra
   * diretamente os picos de borda na projeção suavizada.
   *
   * Pipeline:
   *  1. Grayscale → Otsu threshold (SEM fechamento morfológico)
   *  2. hProj[y] = Σ pixels escuros na linha y; vProj[x] = idem por coluna
   *  3. FFT com janela Hanning em cada projeção → período dominante + SNR
   *     (com supressão de harmônicos)
   *  4a. Se SNR ≥ limiar: gerar posições por fase FFT
   *  4b. Se SNR < limiar: detectar posições por picos diretos na projeção
   *  5. Validar uniformidade → GridResult
   */
  /**
   * Detecta a grade usando análise espectral das projeções 1D da imagem.
   *
   * Pipeline:
   *  1. Grayscale → Otsu threshold
   *  2. Detectar ROI da tabela (recortar título/margens via queda de densidade)
   *  3. hProj/vProj dentro da ROI
   *  4. findDominantPeriod (autocorrelação → FFT+anti-harmônico em cascata)
   *  5. Gerar posições por fase; fallback de picos diretos quando V não é uniforme
   *  6. Referenciar posições às coordenadas absolutas da imagem original
   *  7. Validar uniformidade → GridResult
   */
  /**
   * Detecta a grade usando análise espectral das projeções 1D da imagem.
   *
   * Pipeline:
   *  1. Grayscale → Otsu threshold
   *  2. Calcular projeções H e V da imagem inteira
   *  3. Detectar bordas da tabela: picos de alta densidade que definem a ROI
   *  4. findDominantPeriod na ROI (autocorrelação → FFT+anti-harmônico)
   *  5. Gerar posições por picos reais na projeção (não por fase sintética),
   *     com regularização de gaps para preencher bordas de baixo contraste
   *  6. Referenciar às coordenadas absolutas da imagem
   *  7. Validar uniformidade → GridResult
   */
  /**
   * Detecta a grade usando erosão morfológica 1D nas projeções da imagem.
   *
   * Pipeline:
   *  1. Grayscale → Otsu threshold
   *  2. Erosão horizontal (kernel = 10% da largura) → isola linhas H contínuas
   *  3. Erosão vertical   (kernel = 10% da altura)  → isola linhas V contínuas
   *  4. Calcular projeção de cada imagem erodida
   *  5. Agrupar pixels resultantes → centros ponderados = posições de borda
   *  6. Deduplicar duplicatas próximas; regularizar gaps duplos (bordas fracas)
   *  7. Para colunas com grade não-uniforme: separar em coluna de pistas + região numérica uniforme
   *  8. Validar uniformidade → GridResult
   */
  private static detectByProjectionFFT(imageData: ImageData): GridResult {
    const src    = cv.matFromImageData(imageData);
    let gray     = new cv.Mat();
    let thresh   = new cv.Mat();
    let erodedH  = new cv.Mat();
    let erodedV  = new cv.Mat();
    let kernelH  = new cv.Mat();
    let kernelV  = new cv.Mat();

    try {
      // 1. Normalizar para grayscale
      if (src.channels() === 4)       cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      else if (src.channels() === 3)  cv.cvtColor(src, gray, cv.COLOR_RGB2GRAY);
      else                            src.copyTo(gray);

      // 2. Binarizar para THRESH_BINARY_INV (tinta = 255, fundo = 0).
      //    Se a imagem já veio pré-processada pelo ImageProcessor (THRESH_BINARY:
      //    fundo=255, tinta=0), simplesmente invertemos. Caso contrário, aplicamos
      //    Otsu invertido. Detectamos se já está binarizada pelo histograma bimodal.
      {
        // Verificar se já está binarizada: calcular proporção de pixels puros (0 ou 255)
        let purePx = 0;
        const gData = gray.data as Uint8Array;
        for (let i = 0; i < gData.length; i++) {
          if (gData[i] === 0 || gData[i] === 255) purePx++;
        }
        const pureRatio = purePx / gData.length;

        if (pureRatio > 0.85) {
          // Imagem já binarizada pelo preprocess (adaptiveThreshold THRESH_BINARY):
          // fundo = 255 (branco), tinta/bordas da grade = 0 (preto).
          // A erosão precisa de linhas de grade = 255 para preservá-las.
          // → Não inverter: as bordas são os pixels ESCUROS (0), mas a erosão
          //   precisa de branco. Então invertemos para que bordas = 255.
          // Porém: o MORPH_OPEN/CLOSE do preprocess pode ter engrossado bordas.
          // Aplicar erosão diretamente sobre o thresh já invertido.
          cv.bitwise_not(gray, thresh);
          console.log('[GridDetector/FFT] Imagem já binarizada detectada (preprocess) — invertida para erosão');
        } else {
          // Imagem raw/grayscale — aplicar Otsu invertido (bordas de grade = 255)
          cv.threshold(gray, thresh, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
          console.log('[GridDetector/FFT] Imagem raw — Otsu invertido aplicado');
        }
      }

      const W    = thresh.cols;
      const H    = thresh.rows;

      // 2. Erosão horizontal: kernel 1 × (10% da largura)
      //    Apenas linhas horizontais contínuas em ≥10% da largura sobrevivem
      const kW = Math.max(5, Math.round(W * 0.10));
      kernelH  = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kW, 1));
      cv.erode(thresh, erodedH, kernelH);

      // 3. Erosão vertical: kernel (10% da altura) × 1
      const kH = Math.max(5, Math.round(H * 0.10));
      kernelV  = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, kH));
      cv.erode(thresh, erodedV, kernelV);

      const dataH = erodedH.data as Uint8Array;
      const dataV = erodedV.data as Uint8Array;

      // Helper: projeção 1D de uma imagem erodida
      const projectH = (): Float32Array => {
        const proj = new Float32Array(H);
        for (let y = 0; y < H; y++) {
          let s = 0;
          for (let x = 0; x < W; x++) s += dataH[y * W + x] > 0 ? 1 : 0;
          proj[y] = s / W;
        }
        return proj;
      };
      const projectV = (): Float32Array => {
        const proj = new Float32Array(W);
        for (let x = 0; x < W; x++) {
          let s = 0;
          for (let y = 0; y < H; y++) s += dataV[y * W + x] > 0 ? 1 : 0;
          proj[x] = s / H;
        }
        return proj;
      };

      const hProj = projectH();
      const vProj = projectV();

      // 4-6. Extrair bordas da projeção: agrupar pixels não-nulos → centros ponderados
      const extractBorderCenters = (proj: Float32Array, gapThresh = 10): Array<{c: number; a: number}> => {
        const groups: number[][] = [];
        let cur: number[] = [];
        for (let i = 0; i < proj.length; i++) {
          if (proj[i] > 0.001) {
            if (cur.length === 0 || i - cur[cur.length - 1] <= gapThresh) {
              cur.push(i);
            } else {
              groups.push(cur);
              cur = [i];
            }
          }
        }
        if (cur.length > 0) groups.push(cur);

        return groups.map(g => {
          const vals = g.map(i => proj[i]);
          const sumW = vals.reduce((a, b) => a + b, 0);
          const center = sumW > 0
            ? Math.round(g.reduce((s, i, k) => s + i * vals[k], 0) / sumW)
            : Math.round(g[Math.floor(g.length / 2)]);
          return { c: center, a: Math.max(...vals) };
        });
      };

      // Deduplicar: mesclar pares muito próximos (< minSep), manter o de maior amplitude
      const dedupe = (borders: Array<{c: number; a: number}>, minSep: number) => {
        const out: Array<{c: number; a: number}> = [];
        for (const b of borders) {
          if (out.length === 0 || b.c - out[out.length - 1].c >= minSep) {
            out.push(b);
          } else if (b.a > out[out.length - 1].a) {
            out[out.length - 1] = b;
          }
        }
        return out;
      };

      // Regularizar: inserir bordas em gaps duplos (borda de baixo contraste ausente)
      const regularize = (centers: number[], T: number): number[] => {
        const result = [centers[0]];
        for (let i = 0; i < centers.length - 1; i++) {
          const gap = centers[i + 1] - centers[i];
          const n = Math.round(gap / T);
          for (let m = 1; m < n; m++) result.push(Math.round(centers[i] + T * m));
          result.push(centers[i + 1]);
        }
        return result;
      };

      // ── Posições de linhas (H) ──────────────────────────────────────────────
      const hBordersRaw  = extractBorderCenters(hProj, 10);
      if (hBordersRaw.length < 2) {
        throw new Error(`Bordas H insuficientes pela erosão: ${hBordersRaw.length}`);
      }
      const hCenters     = hBordersRaw.map(b => b.c);
      const hSpacings    = hCenters.slice(1).map((c, i) => c - hCenters[i]);
      const hT           = this.median(hSpacings);
      const hDeduped     = dedupe(hBordersRaw, hT * 0.5).map(b => b.c);
      const rowPositions = regularize(hDeduped, hT);

      console.log(
        `[GridDetector/FFT] Erosão H: ${hBordersRaw.length} bordas brutas → ` +
        `T=${hT.toFixed(0)}px → ${rowPositions.length - 1} linhas`
      );

      // ── Posições de colunas (V) ─────────────────────────────────────────────
      const vBordersRaw = extractBorderCenters(vProj, 10);
      if (vBordersRaw.length < 2) {
        throw new Error(`Bordas V insuficientes pela erosão: ${vBordersRaw.length}`);
      }

      // Detectar se há uma coluna de pistas (gap inicial muito maior que os demais)
      const vCenters  = vBordersRaw.map(b => b.c);
      const vSpacings = vCenters.slice(1).map((c, i) => c - vCenters[i]);
      const vT_full   = this.median(vSpacings);

      // Identificar fronteira entre coluna de pistas e colunas numéricas:
      // Procurar o gap dominante (muito maior que a mediana) — esse é o separador.
      // Pode estar em qualquer posição, não apenas no início.
      let splitIdx = -1;
      {
        const sortedSp  = vSpacings.toSorted((a, b) => a - b);
        const medianSp  = sortedSp[Math.floor(sortedSp.length / 2)];
        const maxGap    = Math.max(...vSpacings);
        if (maxGap > medianSp * 2.0) {
          // Existe um gap dominante — a fronteira fica imediatamente antes do maior gap
          splitIdx = vSpacings.indexOf(maxGap);
        }
      }

      let colPositions: number[];
      if (splitIdx >= 0) {
        // Grade não-uniforme: borda esquerda (x=0) + fronteira + colunas numéricas regularizadas
        const separatorX   = vCenters[splitIdx + 1];
        const numericCenters = vCenters.slice(splitIdx + 1);
        const numSpacings    = numericCenters.slice(1).map((c, i) => c - numericCenters[i]);
        const numT           = this.median(numSpacings);
        const numDeduped     = dedupe(vBordersRaw.slice(splitIdx + 1), numT * 0.5).map(b => b.c);
        const numRegularized = regularize(numDeduped, numT);
        colPositions = [0, ...numRegularized];
        console.log(
          `[GridDetector/FFT] Erosão V: grade não-uniforme detectada, separador em x=${separatorX}px, ` +
          `T_num=${numT.toFixed(0)}px → ${colPositions.length - 1} colunas`
        );
      } else {
        // Grade uniforme
        const vDeduped = dedupe(vBordersRaw, vT_full * 0.5).map(b => b.c);
        colPositions   = regularize(vDeduped, vT_full);
        console.log(
          `[GridDetector/FFT] Erosão V: T=${vT_full.toFixed(0)}px → ${colPositions.length - 1} colunas`
        );
      }

      if (rowPositions.length < 3 || colPositions.length < 3) {
        throw new Error(
          `Grade insuficiente: ${rowPositions.length} H, ${colPositions.length} V`
        );
      }

      // 7. Gaps e validação
      const colWidths  = this.computeGaps(colPositions);
      const rowHeights = this.computeGaps(rowPositions);
      this.validateUniformity(rowHeights, 'linhas (FFT)');
      // Para grade não-uniforme (coluna de pistas + numéricas), a tol precisa
      // cobrir a razão entre a coluna larga e as estreitas sem lançar erro.
      // Desabilitar validação V quando há split (a grade é intencionalmente não-uniforme).
      if (splitIdx < 0) {
        this.validateUniformity(colWidths, 'colunas (FFT)');
      }

      const roi: BoundingBox = {
        x:      colPositions[0],
        y:      rowPositions[0],
        width:  colPositions[colPositions.length - 1] - colPositions[0],
        height: rowPositions[rowPositions.length - 1] - rowPositions[0],
      };

      return {
        roi,
        rowPositions,
        colPositions,
        colWidths,
        rowHeights,
        rows: rowPositions.length - 1,
        cols: colPositions.length - 1,
      };
    } finally {
      src.delete();
      gray.delete();
      thresh.delete();
      erodedH.delete();
      erodedV.delete();
      kernelH.delete();
      kernelV.delete();
    }
  }

  /** Mediana de um array de números. */
  private static median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = values.toSorted((a, b) => a - b);
    const mid    = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  /**
   * Detecta posições de bordas da grade encontrando picos reais na projeção 1D,
   * usando o período pré-calculado como separação mínima esperada.
   *
   * Vantagem sobre `generateGridLines`: usa as bordas reais da imagem em vez de
   * posições sintéticas, lidando melhor com desalinhamentos e imagens com margens.
   * Bordas de baixo contraste (faltando no sinal) são recuperadas por
   * `regularizeByMedianGap`.
   *
   * @param proj    - Projeção 1D normalizada (inteira imagem)
   * @param period  - Período estimado em pixels (separação mínima entre bordas)
   * @param size    - Dimensão total (H ou W)
   */
  private static detectBordersByPeaksWithPeriod(
    proj: Float32Array,
    period: number,
    size: number
  ): number[] {
    // Suavizar: σ pequeno para preservar posição das bordas mas eliminar pixel-noise
    const sigma   = Math.max(1, period * 0.05);
    const smooth  = this.gaussianSmooth(proj, sigma);

    // Threshold adaptativo: 50% do máximo global
    const maxVal  = smooth.reduce((m, v) => Math.max(m, v), 0);
    const thresh  = maxVal * 0.50;

    // Picos locais com separação mínima = 60% do período (deixar margem para ruído)
    const minSep  = period * 0.60;
    const allPeaks = this.findLocalPeaks(smooth, minSep);
    const peaks    = allPeaks.filter(p => smooth[p] >= thresh);

    if (peaks.length < 2) {
      // Threshold muito alto? Tentar com 30%
      const peaks2 = allPeaks.filter(p => smooth[p] >= maxVal * 0.30);
      if (peaks2.length < 2) return [];
      return this.regularizeByMedianGap(peaks2);
    }

    // Regularizar: preencher bordas de baixo contraste (gaps = 2× período)
    return this.regularizeByMedianGap(peaks);
  }

  // ─── Helpers FFT (TypeScript puro — sem dependência de OpenCV) ──────────────

  /**
   * FFT de Cooley-Tukey iterativa in-place.
   * Requer que `re` e `im` tenham comprimento potência de 2.
   */
  private static fft(re: Float64Array, im: Float64Array): void {
    const N = re.length;
    // Bit-reversal permutation
    for (let i = 1, j = 0; i < N; i++) {
      let bit = N >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [re[i], re[j]] = [re[j], re[i]];
        [im[i], im[j]] = [im[j], im[i]];
      }
    }
    // Butterfly
    for (let len = 2; len <= N; len <<= 1) {
      const ang = (-2 * Math.PI) / len;
      const wRe = Math.cos(ang);
      const wIm = Math.sin(ang);
      for (let i = 0; i < N; i += len) {
        let curRe = 1, curIm = 0;
        for (let j = 0; j < len >> 1; j++) {
          const uRe = re[i + j];
          const uIm = im[i + j];
          const vRe = re[i + j + (len >> 1)] * curRe - im[i + j + (len >> 1)] * curIm;
          const vIm = re[i + j + (len >> 1)] * curIm + im[i + j + (len >> 1)] * curRe;
          re[i + j]              = uRe + vRe;
          im[i + j]              = uIm + vIm;
          re[i + j + (len >> 1)] = uRe - vRe;
          im[i + j + (len >> 1)] = uIm - vIm;
          const newRe = curRe * wRe - curIm * wIm;
          curIm = curRe * wIm + curIm * wRe;
          curRe = newRe;
        }
      }
    }
  }

  /**
   * Calcula as magnitudes espectrais (metade positiva do espectro) de um sinal 1D.
   * Aplica janela de Hanning antes da FFT para reduzir vazamento espectral.
   *
   * @returns Float64Array com N/2 magnitudes (excluindo DC em [0])
   */
  private static fftMagnitudes(signal: Float32Array): Float64Array {
    // Zero-padding até próxima potência de 2
    let N = 1;
    while (N < signal.length) N <<= 1;
    N <<= 1; // dobrar para melhor resolução espectral

    const window = this.hannWindow(signal.length);
    const re = new Float64Array(N);
    const im = new Float64Array(N);

    for (let i = 0; i < signal.length; i++) {
      re[i] = signal[i] * window[i];
    }

    this.fft(re, im);

    const half = N >> 1;
    const mags = new Float64Array(half);
    for (let i = 0; i < half; i++) {
      mags[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
    }
    return mags;
  }

  /**
   * Gera uma janela de Hanning de comprimento `n`.
   */
  private static hannWindow(n: number): Float64Array {
    const w = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    }
    return w;
  }

  /**
   * Encontra o período dominante em uma projeção 1D usando FFT.
   *
   * @param projection - Array de valores da projeção normalizada
   * @param minPeriod  - Período mínimo válido em pixels
   * @param maxPeriod  - Período máximo válido em pixels
   * @returns { period, snr } onde snr é a razão mag[pico] / mean(espectro válido)
   */
  /**
   * Encontra o período dominante em uma projeção 1D usando FFT.
   *
   * Inclui **detecção de frequência fundamental** para evitar que harmônicos
   * (sub-múltiplos do período real gerados pelo conteúdo interno das células,
   * ex.: linhas de texto dentro de cada linha da grade) sejam escolhidos como
   * período da grade.
   *
   * Estratégia:
   *  1. Encontra o pico de maior magnitude na banda válida (candidato inicial).
   *  2. Verifica se existe um pico de período `T × n` (n = 2, 3, 4) com
   *     magnitude ≥ `FFT_HARMONIC_MIN_RATIO` × candidato. Se sim, eleva para
   *     esse período mais longo (frequência fundamental).
   *  3. Repete até não encontrar múltiplos maiores na banda.
   *
   * @param projection - Array de valores da projeção normalizada
   * @param minPeriod  - Período mínimo válido em pixels
   * @param maxPeriod  - Período máximo válido em pixels
   * @returns { period, snr } onde snr é a razão mag[pico] / mean(espectro válido)
   */
  /**
   * Encontra o período dominante em uma projeção 1D.
   *
   * Usa dois métodos em cascata:
   *
   * 1. **Autocorrelação** — mais robusta que FFT para sinais com conteúdo misto
   *    (texto interno + bordas de grade). O pico de autocorrelação no lag correto
   *    sobrevive mesmo quando o espectro FFT é diluído por harmônicos.
   *    Calcula SNR como: autocorr[T_pico] / mean(autocorr[T_min..T_max]).
   *
   * 2. **FFT com supressão de harmônicos** — usada quando a autocorrelação não
   *    encontra pico com SNR suficiente (sinal muito ruidoso ou muito regular).
   *    Após encontrar o pico FFT dominante, verifica se é harmônico (múltiplo) de
   *    um período maior com magnitude ≥ 30% e eleva para o fundamental.
   *    SNR calculado sobre banda estreita (±30% do pico) para evitar diluição.
   *
   * @param projection - Array de valores da projeção normalizada
   * @param minPeriod  - Período mínimo válido em pixels
   * @param maxPeriod  - Período máximo válido em pixels
   * @returns { period, snr } onde snr é a razão sinal/ruído do pico encontrado
   */
  private static findDominantPeriod(
    projection: Float32Array,
    minPeriod: number,
    maxPeriod: number
  ): { period: number; snr: number } {

    // ── Método 1: Autocorrelação ─────────────────────────────────────────────
    const acResult = this.findPeriodByAutocorrelation(projection, minPeriod, maxPeriod);
    if (acResult.snr >= FFT_SNR_MIN) {
      console.log(
        `[GridDetector/FFT] autocorrelação: T=${acResult.period.toFixed(1)}px SNR=${acResult.snr.toFixed(2)}`
      );
      return acResult;
    }

    // ── Método 2: FFT com supressão de harmônicos ────────────────────────────
    const mags = this.fftMagnitudes(projection);
    const N = mags.length * 2;

    const kMin = Math.max(1, Math.ceil(N / maxPeriod));
    const kMax = Math.min(Math.floor(N / minPeriod), mags.length - 1);

    if (kMin >= kMax) {
      throw new Error(`Banda de frequência inválida: kMin=${kMin} kMax=${kMax}`);
    }

    // Pico de maior magnitude na banda completa
    let bestK = kMin;
    let bestMag = 0;
    for (let k = kMin; k <= kMax; k++) {
      if (mags[k] > bestMag) { bestMag = mags[k]; bestK = k; }
    }

    // Supressão de harmônicos: elevar para frequência fundamental
    const HARMONIC_MIN_RATIO = 0.30;
    let elevated = true;
    while (elevated) {
      elevated = false;
      for (let n = 2; n <= 5; n++) {
        const kFundRaw = bestK / n;
        if (kFundRaw < kMin) continue;
        for (const kf of [Math.round(kFundRaw) - 1, Math.round(kFundRaw), Math.round(kFundRaw) + 1]) {
          if (kf >= kMin && kf < mags.length && mags[kf] >= bestMag * HARMONIC_MIN_RATIO) {
            console.log(
              `[GridDetector/FFT] harmônico n=${n}: T=${(N/bestK).toFixed(1)}px ` +
              `→ fundamental T=${(N/kf).toFixed(1)}px (ratio=${(mags[kf]/bestMag).toFixed(2)})`
            );
            bestK = kf; bestMag = mags[kf]; elevated = true; break;
          }
        }
        if (elevated) break;
      }
    }

    // SNR calculado sobre banda estreita centrada no pico (±30%)
    const bandLo = Math.max(kMin, Math.round(bestK * 0.70));
    const bandHi = Math.min(kMax, Math.round(bestK * 1.30));
    let sumNarrow = 0; let cntNarrow = 0;
    for (let k = bandLo; k <= bandHi; k++) { sumNarrow += mags[k]; cntNarrow++; }
    const meanNarrow = cntNarrow > 0 ? sumNarrow / cntNarrow : 1;
    const snr = meanNarrow > 0 ? bestMag / meanNarrow : 0;

    // Refinamento parabólico sub-pixel
    let refinedK = bestK;
    if (bestK > kMin && bestK < kMax) {
      const a = mags[bestK - 1], b = mags[bestK], c = mags[bestK + 1];
      const denom = a - 2 * b + c;
      if (Math.abs(denom) > 1e-10) refinedK = bestK - (c - a) / (2 * denom);
    }

    console.log(
      `[GridDetector/FFT] FFT: T=${(N/refinedK).toFixed(1)}px SNR=${snr.toFixed(2)} ` +
      `(autocorr SNR=${acResult.snr.toFixed(2)} insuficiente)`
    );

    return { period: N / refinedK, snr };
  }

  /**
   * Estima o período de um sinal periódico via autocorrelação normalizada.
   * Mais robusto que FFT quando o sinal tem conteúdo misto (harmônicos + ruído).
   *
   * @returns { period, snr } onde snr = autocorr[pico] / mean(autocorr[banda])
   */
  /**
   * Estima o período de um sinal periódico via autocorrelação normalizada.
   * Mais robusto que FFT quando o sinal tem conteúdo misto (harmônicos + ruído).
   *
   * SNR calculado como `peak_ac / rms(região)` — robusto a médias negativas,
   * que surgem quando a autocorrelação oscila entre positivo e negativo.
   *
   * @returns { period, snr } onde snr = autocorr[pico] / rms(autocorr[banda])
   */
  private static findPeriodByAutocorrelation(
    projection: Float32Array,
    minPeriod: number,
    maxPeriod: number
  ): { period: number; snr: number } {
    const n    = projection.length;
    const mean = projection.reduce((s, v) => s + v, 0) / n;

    let denom = 0;
    for (let i = 0; i < n; i++) denom += (projection[i] - mean) ** 2;
    if (denom < 1e-10) return { period: minPeriod, snr: 0 };

    const minLag = Math.max(1, Math.floor(minPeriod));
    const maxLag = Math.min(n - 1, Math.floor(maxPeriod));

    const acorr = new Float64Array(maxLag + 1);
    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i < n - lag; i++) {
        sum += (projection[i] - mean) * (projection[i + lag] - mean);
      }
      acorr[lag] = sum / denom;
    }

    // Encontrar pico máximo
    let bestLag = minLag;
    let bestAC  = acorr[minLag];
    let sumSq   = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      if (acorr[lag] > bestAC) { bestAC = acorr[lag]; bestLag = lag; }
      sumSq += acorr[lag] * acorr[lag];
    }

    // SNR = peak / RMS da região — robusto a médias negativas
    const rms = Math.sqrt(sumSq / (maxLag - minLag + 1));
    const snr = rms > 0 ? bestAC / rms : 0;

    // Refinamento parabólico
    let refinedLag = bestLag;
    if (bestLag > minLag && bestLag < maxLag) {
      const a = acorr[bestLag - 1], b = acorr[bestLag], c = acorr[bestLag + 1];
      const d = a - 2 * b + c;
      if (Math.abs(d) > 1e-10) refinedLag = bestLag - (c - a) / (2 * d);
    }

    return { period: refinedLag, snr };
  }

  /**
   * Suavização gaussiana 1D por convolução com kernel gaussiano normalizado.
   *
   * @param signal - Sinal de entrada
   * @param sigma  - Desvio padrão da gaussiana em pixels
   */
  private static gaussianSmooth(signal: Float32Array, sigma: number): Float32Array {
    if (sigma < 0.5) return Float32Array.from(signal);

    const radius = Math.ceil(sigma * 3);
    const kernel = new Float64Array(2 * radius + 1);
    let kSum = 0;
    for (let i = -radius; i <= radius; i++) {
      const v = Math.exp(-(i * i) / (2 * sigma * sigma));
      kernel[i + radius] = v;
      kSum += v;
    }
    for (let i = 0; i < kernel.length; i++) kernel[i] /= kSum;

    const out = new Float32Array(signal.length);
    for (let i = 0; i < signal.length; i++) {
      let acc = 0;
      for (let ki = -radius; ki <= radius; ki++) {
        const idx = Math.max(0, Math.min(signal.length - 1, i + ki));
        acc += signal[idx] * kernel[ki + radius];
      }
      out[i] = acc;
    }
    return out;
  }

  /**
   * Encontra índices dos máximos locais de um sinal suavizado,
   * com separação mínima entre picos.
   *
   * @param signal       - Sinal suavizado
   * @param minSep       - Separação mínima entre picos em pixels
   */
  private static findLocalPeaks(signal: Float32Array, minSep: number): number[] {
    const n = signal.length;
    const sep = Math.max(1, Math.round(minSep));

    // Encontrar todos os máximos locais
    const candidates: Array<{ idx: number; val: number }> = [];
    for (let i = 1; i < n - 1; i++) {
      if (signal[i] >= signal[i - 1] && signal[i] >= signal[i + 1] && signal[i] > 0) {
        candidates.push({ idx: i, val: signal[i] });
      }
    }

    // Non-maximum suppression com separação mínima
    candidates.sort((a, b) => b.val - a.val); // do maior para o menor
    const peaks: number[] = [];

    for (const c of candidates) {
      const tooClose = peaks.some(p => Math.abs(p - c.idx) < sep);
      if (!tooClose) {
        peaks.push(c.idx);
      }
    }

    return peaks.sort((a, b) => a - b);
  }

  /**
   * Ajusta o offset de fase `φ` dado um conjunto de picos e o período `T`.
   * Minimiza o erro quadrático médio entre os picos e a grade `φ + n×T`.
   *
   * @param peaks  - Posições dos picos detectados (em pixels)
   * @param period - Período estimado pela FFT
   * @returns Offset de fase φ ∈ [0, period)
   */
  private static fitPhase(peaks: number[], period: number): number {
    if (peaks.length === 0) return 0;
    if (period <= 0) return 0;

    // Para cada pico, calcular sua fase relativa ao período
    // e calcular a média circular das fases
    let sinSum = 0, cosSum = 0;
    for (const p of peaks) {
      const angle = (2 * Math.PI * (p % period)) / period;
      sinSum += Math.sin(angle);
      cosSum += Math.cos(angle);
    }

    const meanAngle = Math.atan2(sinSum / peaks.length, cosSum / peaks.length);
    let phase = (meanAngle / (2 * Math.PI)) * period;
    if (phase < 0) phase += period;

    return phase;
  }

  /**
   * Detecta posições de bordas da grade diretamente por picos na projeção 1D,
   * sem assumir periodicidade uniforme.
   *
   * Usado como fallback quando o SNR da FFT é insuficiente (ex.: criptogramas
   * com uma coluna de pistas larga + colunas numéricas estreitas, onde não há
   * um único período dominante no espectro).
   *
   * Estratégia:
   *  1. Suavizar a projeção com gaussiana (σ = minPeriod × 0.4)
   *  2. Encontrar todos os picos locais com separação ≥ minPeriod × 0.5
   *  3. Filtrar picos com valor < 20% do máximo (eliminar ruído)
   *  4. Adicionar borda 0 e borda imageSize se não estiverem presentes
   *
   * @param projection  - Projeção 1D normalizada
   * @param imageSize   - Dimensão total (W ou H) em pixels
   * @param minPeriod   - Separação mínima entre bordas em pixels
   */
  private static detectPositionsByPeaks(
    projection: Float32Array,
    imageSize: number,
    minPeriod: number
  ): number[] {
    // 1. Suavizar para eliminar ruído de conteúdo interno
    const sigma  = minPeriod * 0.4;
    const smooth = this.gaussianSmooth(projection, sigma);

    // 2. Picos locais com separação mínima
    const rawPeaks = this.findLocalPeaks(smooth, minPeriod * 0.5);

    // 3. Filtrar por amplitude: manter apenas picos ≥ 20% do máximo global
    const maxVal = smooth.reduce((m, v) => Math.max(m, v), 0);
    const threshold = maxVal * 0.20;
    const peaks = rawPeaks.filter(p => smooth[p] >= threshold);

    if (peaks.length < 2) return [];

    // 4. As posições de borda ficam entre picos consecutivos (vale entre picos)
    //    ou podemos tratar os próprios picos como bordas (linhas de grade = alta densidade)
    //    Neste criptograma, os picos na projeção V correspondem às bordas verticais
    //    (linhas de tinta contínuas), então usamos os picos diretamente como bordas.
    const positions: number[] = [];

    // Incluir borda esquerda (x=0) se o primeiro pico estiver longe
    if (peaks[0] > minPeriod * 0.5) positions.push(0);

    for (const p of peaks) positions.push(p);

    // Incluir borda direita se o último pico estiver longe do fim
    if (imageSize - peaks[peaks.length - 1] > minPeriod * 0.5) positions.push(imageSize);

    console.log(
      `[GridDetector/FFT] detectPositionsByPeaks: ${positions.length} bordas detectadas ` +
      `[${positions.slice(0, 6).join(', ')}${positions.length > 6 ? '...' : ''}]`
    );

    return positions;
  }

  /**
   * Gera as posições de bordas da grade dado período e fase,
   * varrendo o tamanho da imagem de 0 até `imageSize`.
   *
   * @param imageSize - Dimensão da imagem em pixels (H ou W)
   * @param period    - Período das células em pixels
   * @param phase     - Offset de fase φ
   */
  private static generateGridLines(
    imageSize: number,
    period: number,
    phase: number
  ): number[] {
    const positions: number[] = [];
    // Começar pelo primeiro pico antes ou dentro da imagem
    let pos = phase % period;
    if (pos < 0) pos += period;
    // Recuar para antes do início se necessário
    while (pos - period >= -period * 0.5) pos -= period;

    while (pos <= imageSize + period * 0.5) {
      if (pos >= -period * 0.1 && pos <= imageSize + period * 0.1) {
        const clamped = Math.max(0, Math.min(imageSize, Math.round(pos)));
        positions.push(clamped);
      }
      pos += period;
    }

    // Remover duplicatas e ordenar
    return [...new Set(positions)].toSorted((a, b) => a - b);
  }

  /**
   * Calcula a interseção (matemática) de dois segmentos definidos por seus extremos.
   * Retorna null se os segmentos forem paralelos ou se a interseção estiver muito
   * fora do alcance esperado.
   */
  private static lineIntersect(
    x1: number, y1: number, x2: number, y2: number,
    x3: number, y3: number, x4: number, y4: number
  ): [number, number] | null {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return null;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const px = x1 + t * (x2 - x1);
    const py = y1 + t * (y2 - y1);
    return [Math.round(px), Math.round(py)];
  }

  /**
   * Regulariza posições com base na mediana dos gaps entre posições consecutivas.
   * Interpola posições faltando quando um gap é múltiplo do gap mediano.
   */
  private static regularizeByMedianGap(positions: number[]): number[] {
    if (positions.length < 2) return positions;
    const gaps = this.computeGaps(positions);
    const sorted = gaps.toSorted((a, b) => a - b);
    const medianGap = sorted[Math.floor(sorted.length / 2)];
    if (medianGap <= 0) return positions;

    const result: number[] = [positions[0]];
    for (let i = 0; i < gaps.length; i++) {
      const ratio = gaps[i] / medianGap;
      if (ratio > MEDIAN_GAP_OUTLIER) {
        // Interpolar posições faltando
        const nMissing = Math.round(ratio) - 1;
        if (nMissing > 0 && nMissing <= 4) {
          for (let m = 1; m <= nMissing; m++) {
            result.push(Math.round(positions[i] + medianGap * m));
          }
        }
      }
      result.push(positions[i + 1]);
    }
    return result;
  }

  /**
   * Valida que os gaps (larguras/alturas de células) são relativamente uniformes.
   * Lança erro se o desvio relativo à mediana for muito alto.
   */
  private static validateUniformity(gaps: number[], label: string, tol?: number): void {
    if (gaps.length === 0) return;
    const effectiveTol = (tol ?? GRID_UNIFORMITY_TOL) * 2;
    const sorted = gaps.toSorted((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    for (const g of gaps) {
      if (Math.abs(g - median) / median > effectiveTol) {
        throw new Error(
          `Grade não uniforme em ${label}: gap=${g}, mediana=${median}, tol=${effectiveTol.toFixed(2)}`
        );
      }
    }
  }

  // ─── Abordagem secundária: detecção por contornos quadrangulares ─────────────

  /**
   * Detecta células encontrando diretamente os contornos retangulares
   * de tamanho similar que compõem a grade.
   *
   * Pipeline:
   *  1. Grayscale + Otsu threshold
   *  2. MORPH_CLOSE para fechar bordas quebradas das células
   *  3. findContours (RETR_TREE para capturar células internas)
   *  4. Filtrar por: retangularidade (approxPolyDP ≈ 4 lados),
   *                  aspect ratio aceitável,
   *                  área dentro do cluster modal
   *  5. Agrupar por linha/coluna → montar GridResult
   */
  private static detectByContours(imageData: ImageData): GridResult {
    const src = cv.matFromImageData(imageData);
    let gray = new cv.Mat();
    let thresh = new cv.Mat();
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

      // 2. Threshold Otsu (invertido: tinta = branco, fundo = preto)
      cv.threshold(gray, thresh, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

      // 3. MORPH_CLOSE para reconectar bordas de células fragmentadas
      //    Kernel de ~3% da menor dimensão da imagem, mínimo 3px
      const closeKernelSz = Math.max(3, Math.round(Math.min(src.rows, src.cols) * 0.03));
      const closeKernel = cv.getStructuringElement(
        cv.MORPH_RECT,
        new cv.Size(closeKernelSz, closeKernelSz)
      );
      cv.morphologyEx(thresh, closed, cv.MORPH_CLOSE, closeKernel);
      closeKernel.delete();

      // 4. Encontrar todos os contornos
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(closed, contours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);

      // 5. Filtrar contornos que parecem células (quadrangulares, similar area)
      const candidates = this.filterCellContours(contours, src.cols, src.rows);

      contours.delete();
      hierarchy.delete();

      if (candidates.length < MIN_CELLS_CONTOUR) {
        throw new Error(
          `Contornos candidatos insuficientes: ${candidates.length} (mínimo ${MIN_CELLS_CONTOUR})`
        );
      }

      // 6. Agrupar em linhas e colunas
      return this.buildGridFromCells(candidates, src.cols, src.rows);

    } finally {
      src.delete();
      gray.delete();
      thresh.delete();
      closed.delete();
    }
  }

  /**
   * Filtra os contornos detectados, mantendo apenas os que têm
   * forma quadrangular (≈ 4 vértices), aspect ratio aceitável,
   * solidez adequada, e área dentro do cluster modal.
   *
   * @param contours - MatVector de contornos
   * @param imageW   - largura da imagem (para filtrar contornos gigantes)
   * @param imageH   - altura da imagem
   * @returns Array de BoundingBox das células candidatas
   */
  private static filterCellContours(
    contours: any,
    imageW: number,
    imageH: number
  ): BoundingBox[] {
    const imageArea = imageW * imageH;
    const boxes: BoundingBox[] = [];

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      // Ignorar contornos minúsculos ou que cobrem a imagem inteira
      if (area < 50 || area > imageArea * 0.5) continue;

      // Aproximar polígono
      const peri = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.04 * peri, true);
      const nVertices = approx.rows;
      approx.delete();

      // Aceitar apenas quadriláteros (4 vértices ± tolerância)
      if (nVertices < 4 || nVertices > 6) continue;

      // Bounding rect
      const rect = cv.boundingRect(contour);

      // Aspect ratio
      const ar = rect.width / Math.max(rect.height, 1);
      if (ar > CELL_ASPECT_RATIO_MAX || ar < 1 / CELL_ASPECT_RATIO_MAX) continue;

      // Solidez (area / area do bounding rect)
      const bbArea = rect.width * rect.height;
      const solidity = area / bbArea;
      if (solidity < CELL_SOLIDITY_MIN) continue;

      boxes.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    }

    if (boxes.length === 0) return boxes;

    // Encontrar área modal das células (histograma simples de buckets)
    // para filtrar contornos de tamanho aberrante
    const areas = boxes.map(b => b.width * b.height);
    const modalArea = this.modalValue(areas, 20);

    return boxes.filter(b => {
      const a = b.width * b.height;
      return a >= modalArea * CELL_AREA_MIN_FACTOR && a <= modalArea * CELL_AREA_MAX_FACTOR;
    });
  }

  /**
   * Constrói um GridResult a partir de uma lista de BoundingBoxes de células.
   *
   * Agrupa as células por linha (Y próximo) e por coluna (X próximo),
   * ordena cada grupo, e extrai as posições das bordas.
   */
  private static buildGridFromCells(
    cells: BoundingBox[],
    imageW: number,
    imageH: number
  ): GridResult {
    // Altura e largura modal das células
    const modalH = this.modalValue(cells.map(c => c.height), 10);
    const modalW = this.modalValue(cells.map(c => c.width), 10);

    const rowTolerance = modalH * ROW_COL_CLUSTER_TOLERANCE;
    const colTolerance = modalW * ROW_COL_CLUSTER_TOLERANCE;

    // Agrupar por linha (centro Y)
    const byCenterY = cells.map(c => ({ ...c, cy: c.y + c.height / 2, cx: c.x + c.width / 2 }));
    byCenterY.sort((a, b) => a.cy - b.cy);

    const rowGroups: typeof byCenterY[] = [];
    for (const cell of byCenterY) {
      const lastGroup = rowGroups[rowGroups.length - 1];
      if (!lastGroup || Math.abs(cell.cy - lastGroup[0].cy) > rowTolerance) {
        rowGroups.push([cell]);
      } else {
        lastGroup.push(cell);
      }
    }

    if (rowGroups.length < 2) {
      throw new Error(`Linhas insuficientes detectadas: ${rowGroups.length}`);
    }

    // Dentro de cada linha, ordenar por X
    rowGroups.forEach(group => group.sort((a, b) => a.cx - b.cx));

    // Coletar todas as posições X únicas (colunas)
    const allCentersX = rowGroups.flatMap(g => g.map(c => c.cx));
    allCentersX.sort((a, b) => a - b);
    const colCenters = this.clusterPeaks(allCentersX, colTolerance);

    if (colCenters.length < 2) {
      throw new Error(`Colunas insuficientes detectadas: ${colCenters.length}`);
    }

    // Para cada coluna, coletar todas as células nessa coluna e derivar a posição X da borda
    // Usar o percentil 10 do X (borda esquerda) e percentil 90 do X+W (borda direita)
    const colLeftEdges: number[] = [];
    const colRightEdges: number[] = [];

    for (const cx of colCenters) {
      const inCol = cells.filter(c => Math.abs((c.x + c.width / 2) - cx) <= colTolerance);
      const lefts  = inCol.map(c => c.x).sort((a, b) => a - b);
      const rights = inCol.map(c => c.x + c.width).sort((a, b) => a - b);
      colLeftEdges.push(lefts[Math.floor(lefts.length * 0.1)]);
      colRightEdges.push(rights[Math.floor(rights.length * 0.9)]);
    }

    // Para cada linha, derivar a posição Y da borda
    const rowTopEdges: number[] = [];
    const rowBottomEdges: number[] = [];

    for (const group of rowGroups) {
      const tops    = group.map(c => c.y).sort((a, b) => a - b);
      const bottoms = group.map(c => c.y + c.height).sort((a, b) => a - b);
      rowTopEdges.push(tops[Math.floor(tops.length * 0.1)]);
      rowBottomEdges.push(bottoms[Math.floor(bottoms.length * 0.9)]);
    }

    // Montar posições absolutas de bordas (incluindo borda final)
    const colPositions = [...colLeftEdges, colRightEdges[colRightEdges.length - 1]];
    const rowPositions = [...rowTopEdges, rowBottomEdges[rowBottomEdges.length - 1]];

    const colWidths  = this.computeGaps(colPositions);
    const rowHeights = this.computeGaps(rowPositions);

    const roi: BoundingBox = {
      x: colPositions[0],
      y: rowPositions[0],
      width: colPositions[colPositions.length - 1] - colPositions[0],
      height: rowPositions[rowPositions.length - 1] - rowPositions[0]
    };

    return {
      roi,
      rowPositions,
      colPositions,
      colWidths,
      rowHeights,
      rows: rowGroups.length,
      cols: colCenters.length
    };
  }

  // ─── Abordagem fallback: isolamento morfológico de linhas ───────────────────

  /**
   * Detecta a grade isolando morfologicamente linhas horizontais e verticais,
   * depois projeta os pixels limpos para encontrar as posições.
   */
  private static detectByMorphology(imageData: ImageData): GridResult {
    const src = cv.matFromImageData(imageData);
    let gray = new cv.Mat();

    try {
      if (src.channels() === 4) {
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      } else if (src.channels() === 3) {
        cv.cvtColor(src, gray, cv.COLOR_RGB2GRAY);
      } else {
        src.copyTo(gray);
      }

      const roi = this.extractTableROI(gray, imageData.width, imageData.height);

      const roiRect = new cv.Rect(
        Math.max(0, roi.x - ROI_MARGIN),
        Math.max(0, roi.y - ROI_MARGIN),
        Math.min(roi.width + ROI_MARGIN * 2, gray.cols - roi.x),
        Math.min(roi.height + ROI_MARGIN * 2, gray.rows - roi.y)
      );
      const roiMat = gray.roi(roiRect);

      let binarized = new cv.Mat();
      cv.threshold(roiMat, binarized, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

      const hLinesMat = this.isolateLines(binarized, 'horizontal');
      const vLinesMat = this.isolateLines(binarized, 'vertical');

      const rawRowPositions = this.projectAndFindPeaks(hLinesMat, 'horizontal');
      const rawColPositions = this.projectAndFindPeaks(vLinesMat, 'vertical');

      const absRowPos = rawRowPositions.map(y => y + roiRect.y);
      const absColPos = rawColPositions.map(x => x + roiRect.x);

      const rowPositions = this.regularizePositions(absRowPos, roi.height);
      const colPositions = this.regularizePositions(absColPos, roi.width);

      if (rowPositions.length < MIN_LINES || colPositions.length < MIN_LINES) {
        throw new Error(
          `Grade insuficiente: ${rowPositions.length} H, ${colPositions.length} V`
        );
      }

      const colWidths  = this.computeGaps(colPositions);
      const rowHeights = this.computeGaps(rowPositions);

      roiMat.delete();
      binarized.delete();
      hLinesMat.delete();
      vLinesMat.delete();

      return {
        roi,
        rowPositions,
        colPositions,
        colWidths,
        rowHeights,
        rows: rowPositions.length - 1,
        cols: colPositions.length - 1
      };
    } finally {
      src.delete();
      gray.delete();
    }
  }

  private static extractTableROI(
    gray: any,
    imageWidth: number,
    imageHeight: number
  ): BoundingBox {
    const thresh = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    try {
      cv.threshold(gray, thresh, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
      const mean = cv.mean(thresh)[0];
      if (mean > 200) cv.bitwise_not(thresh, thresh);

      cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      if (contours.size() === 0) {
        return { x: 0, y: 0, width: imageWidth, height: imageHeight };
      }

      let maxArea = 0, maxIdx = 0;
      for (let i = 0; i < contours.size(); i++) {
        const area = cv.contourArea(contours.get(i));
        if (area > maxArea) { maxArea = area; maxIdx = i; }
      }

      const rect = cv.boundingRect(contours.get(maxIdx));
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    } finally {
      thresh.delete();
      contours.delete();
      hierarchy.delete();
    }
  }

  private static isolateLines(binarized: any, direction: 'horizontal' | 'vertical'): any {
    const dst = new cv.Mat();
    const isH  = direction === 'horizontal';
    const kw   = isH ? Math.max(Math.round(binarized.cols * MORPH_KERNEL_RATIO), 1) : 1;
    const kh   = isH ? 1 : Math.max(Math.round(binarized.rows * MORPH_KERNEL_RATIO), 1);
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kw, kh));
    try {
      cv.erode(binarized, dst, kernel);
      cv.dilate(dst, dst, kernel);
      return dst;
    } finally {
      kernel.delete();
    }
  }

  private static projectAndFindPeaks(
    linesMat: any,
    direction: 'horizontal' | 'vertical'
  ): number[] {
    const isH = direction === 'horizontal';
    const size = isH ? linesMat.rows : linesMat.cols;
    const projection: number[] = new Array(size).fill(0);

    const data = linesMat.data;
    const cols = linesMat.cols;
    for (let i = 0; i < linesMat.rows; i++) {
      const rowOffset = i * cols;
      for (let j = 0; j < cols; j++) {
        if (data[rowOffset + j] > 0) {
          projection[isH ? i : j]++;
        }
      }
    }

    const maxVal = Math.max(...projection);
    if (maxVal === 0) return [];
    const threshold = maxVal * 0.40;

    const peaks: number[] = [];
    let inRun = false;
    let runStart = 0;

    for (let i = 0; i <= size; i++) {
      const above = i < size && projection[i] > threshold;
      if (above && !inRun) {
        inRun = true;
        runStart = i;
      } else if (!above && inRun) {
        inRun = false;
        let wSum = 0, wTotal = 0;
        for (let k = runStart; k < i; k++) {
          wSum   += k * projection[k];
          wTotal += projection[k];
        }
        peaks.push(Math.round(wTotal > 0 ? wSum / wTotal : (runStart + i - 1) / 2));
      }
    }

    return peaks;
  }

  private static regularizePositions(positions: number[], roiSize: number): number[] {
    if (positions.length === 0) return positions;

    let sorted = positions.toSorted((a, b) => a - b);
    sorted = this.clusterPeaks(sorted, PEAK_CLUSTER_RADIUS);

    const gaps = this.computeGaps(sorted);
    if (gaps.length === 0) return sorted;

    const gapClusters = this.kMeans1D(gaps, 2);
    const kept: number[] = [sorted[0]];

    for (let i = 0; i < gaps.length; i++) {
      const clusterMedian = gapClusters.centroids[gapClusters.labels[i]];
      const deviation     = Math.abs(gaps[i] - clusterMedian) / clusterMedian;

      if (deviation <= GAP_OUTLIER_TOLERANCE) {
        kept.push(sorted[i + 1]);
      } else {
        const nMissing = Math.round(gaps[i] / clusterMedian) - 1;
        if (nMissing > 0 && nMissing <= 3) {
          for (let m = 1; m <= nMissing; m++) {
            kept.push(Math.round(sorted[i] + clusterMedian * m));
          }
        }
        kept.push(sorted[i + 1]);
      }
    }

    return kept;
  }

  // ─── Utilitários compartilhados ─────────────────────────────────────────────

  private static clusterPeaks(sorted: number[], radius: number): number[] {
    const result: number[] = [];
    let i = 0;
    while (i < sorted.length) {
      const group = [sorted[i]];
      while (i + 1 < sorted.length && sorted[i + 1] - sorted[i] <= radius) {
        i++;
        group.push(sorted[i]);
      }
      result.push(Math.round(group.reduce((a, b) => a + b, 0) / group.length));
      i++;
    }
    return result;
  }

  private static computeGaps(positions: number[]): number[] {
    const gaps: number[] = [];
    for (let i = 1; i < positions.length; i++) {
      gaps.push(positions[i] - positions[i - 1]);
    }
    return gaps;
  }

  private static kMeans1D(
    values: number[],
    k: number
  ): { labels: number[]; centroids: number[] } {
    if (values.length === 0) return { labels: [], centroids: [] };
    if (values.length < k) {
      return {
        labels: values.map(() => 0),
        centroids: [values.reduce((a, b) => a + b, 0) / values.length]
      };
    }

    const sorted = values.toSorted((a, b) => a - b);
    let centroids = Array.from({ length: k }, (_, i) =>
      sorted[Math.floor((i / k) * sorted.length)]
    );
    let labels: number[] = new Array(values.length).fill(0);

    for (let iter = 0; iter < 10; iter++) {
      const newLabels = values.map(v => {
        let best = 0, bestDist = Infinity;
        centroids.forEach((c, ki) => {
          const d = Math.abs(v - c);
          if (d < bestDist) { bestDist = d; best = ki; }
        });
        return best;
      });

      centroids = centroids.map((_, ki) => {
        const members = values.filter((_, vi) => newLabels[vi] === ki);
        return members.length > 0
          ? members.reduce((a, b) => a + b, 0) / members.length
          : centroids[ki];
      });

      labels = newLabels;
    }

    return { labels, centroids };
  }

  /**
   * Encontra o valor modal de um array usando histograma de buckets.
   * @param values - Valores numéricos
   * @param buckets - Número de buckets do histograma
   */
  private static modalValue(values: number[], buckets: number): number {
    if (values.length === 0) return 0;
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) return min;

    const hist = new Array(buckets).fill(0);
    const range = max - min;

    for (const v of values) {
      const b = Math.min(Math.floor(((v - min) / range) * buckets), buckets - 1);
      hist[b]++;
    }

    const maxBucket = hist.indexOf(Math.max(...hist));
    return min + (maxBucket / buckets) * range + range / (2 * buckets);
  }
}
