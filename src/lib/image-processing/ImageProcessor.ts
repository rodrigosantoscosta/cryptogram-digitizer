/**
 * ImageProcessor - Pré-processamento de imagem
 *
 * Este módulo fornece métodos para preparar imagens de criptogramas
 * para processamento posterior, incluindo conversão para grayscale,
 * remoção de ruído, e aplicação de threshold.
 *
 * @requires opencv.js - Deve estar carregado antes de usar esta classe
 */

declare const cv: any;

export class ImageProcessor {
  /**
   * Converte ImageData para cv.Mat
   */
  private static imageDataToMat(imageData: ImageData): any {
    const mat = cv.matFromImageData(imageData);
    return mat;
  }

  /**
   * Converte cv.Mat para ImageData
   */
  private static matToImageData(mat: any): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = mat.cols;
    canvas.height = mat.rows;
    const ctx = canvas.getContext('2d')!;

    cv.imshow(canvas, mat);

    return ctx.getImageData(0, 0, mat.cols, mat.rows);
  }

  /**
   * Converte imagem para grayscale (escala de cinza)
   *
   * @param imageData - Imagem original em RGBA
   * @returns Imagem em grayscale
   */
  static toGrayscale(imageData: ImageData): ImageData {
    const src = this.imageDataToMat(imageData);
    const dst = new cv.Mat();

    try {
      cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY);

      return this.matToImageData(dst);
    } finally {
      src.delete();
      dst.delete();
    }
  }

  /**
   * Aplica CLAHE (Contrast Limited Adaptive Histogram Equalization)
   *
   * Melhora contraste local, especialmente útil para imagens capturadas
   * com iluminação irregular (fotos com celular, scanners de baixa qualidade).
   * Deve ser aplicado após conversão para grayscale, antes do threshold.
   *
   * @param imageData - Imagem em grayscale
   * @param clipLimit - Limite de contraste (padrão 2.0)
   * @param tileSize - Tamanho do bloco de equalização (padrão 8)
   * @returns Imagem com contraste equalizado
   */
  static applyCLAHE(
    imageData: ImageData,
    clipLimit: number = 2.0,
    tileSize: number = 8
  ): ImageData {
    const src = this.imageDataToMat(imageData);
    const dst = new cv.Mat();

    try {
      const clahe = cv.createCLAHE(clipLimit, new cv.Size(tileSize, tileSize));
      clahe.apply(src, dst);
      clahe.delete();

      return this.matToImageData(dst);
    } finally {
      src.delete();
      dst.delete();
    }
  }

  /**
   * Corrige inclinação (deskew) da imagem
   *
   * Imagens capturadas com câmera ou scanner frequentemente têm pequena
   * rotação. Este método detecta o ângulo de inclinação via momentos dos
   * pixels não-zero e aplica warpAffine para corrigir.
   *
   * @param imageData - Imagem em grayscale ou binária
   * @returns Imagem com inclinação corrigida
   */
  static deskew(imageData: ImageData): ImageData {
    const src = this.imageDataToMat(imageData);
    const dst = new cv.Mat();

    try {
      // Calcular momentos para encontrar ângulo de inclinação
      const moments = cv.moments(src, true);

      if (Math.abs(moments.mu02) < 1e-2) {
        // Imagem já está alinhada
        src.copyTo(dst);
        return this.matToImageData(dst);
      }

      // Ângulo em radianos baseado nos momentos centrais
      const skewAngle = 0.5 * Math.atan2(2 * moments.mu11, moments.mu20 - moments.mu02);
      const angleDeg = (skewAngle * 180) / Math.PI;

      // Limitar a correção a ±15° para evitar rotações errôneas em imagens ruidosas
      if (Math.abs(angleDeg) > 15) {
        src.copyTo(dst);
        return this.matToImageData(dst);
      }

      const center = new cv.Point(src.cols / 2, src.rows / 2);
      const M = cv.getRotationMatrix2D(center, angleDeg, 1.0);
      const dsize = new cv.Size(src.cols, src.rows);

      cv.warpAffine(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_REPLICATE);
      M.delete();

      return this.matToImageData(dst);
    } finally {
      src.delete();
      dst.delete();
    }
  }

  /**
   * Aplica Gaussian Blur para remover ruído
   *
   * @param imageData - Imagem em grayscale
   * @param kernelSize - Tamanho do kernel (deve ser ímpar: 3, 5, 7, etc.)
   * @param sigma - Desvio padrão (0 = automático)
   * @returns Imagem suavizada
   */
  static gaussianBlur(
    imageData: ImageData,
    kernelSize: number = 5,
    sigma: number = 0
  ): ImageData {
    if (kernelSize % 2 === 0) {
      throw new Error('kernelSize deve ser ímpar');
    }

    const src = this.imageDataToMat(imageData);
    const dst = new cv.Mat();

    try {
      const ksize = new cv.Size(kernelSize, kernelSize);
      cv.GaussianBlur(src, dst, ksize, sigma);

      return this.matToImageData(dst);
    } finally {
      src.delete();
      dst.delete();
    }
  }

  /**
   * Aplica threshold adaptativo
   *
   * Melhor que threshold global para imagens com iluminação irregular
   *
   * @param imageData - Imagem em grayscale
   * @param maxValue - Valor máximo (normalmente 255)
   * @param blockSize - Tamanho do bloco para cálculo local (ímpar)
   * @param C - Constante subtraída da média
   * @returns Imagem binarizada
   */
  static adaptiveThreshold(
    imageData: ImageData,
    maxValue: number = 255,
    blockSize: number = 11,
    C: number = 2
  ): ImageData {
    if (blockSize % 2 === 0) {
      throw new Error('blockSize deve ser ímpar');
    }

    const src = this.imageDataToMat(imageData);
    const dst = new cv.Mat();

    try {
      cv.adaptiveThreshold(
        src,
        dst,
        maxValue,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY,
        blockSize,
        C
      );

      return this.matToImageData(dst);
    } finally {
      src.delete();
      dst.delete();
    }
  }

  /**
   * Aplica threshold global usando método Otsu
   *
   * @param imageData - Imagem em grayscale
   * @returns Imagem binarizada
   */
  static otsuThreshold(imageData: ImageData): ImageData {
    const src = this.imageDataToMat(imageData);
    const dst = new cv.Mat();

    try {
      cv.threshold(
        src,
        dst,
        0,
        255,
        cv.THRESH_BINARY + cv.THRESH_OTSU
      );

      return this.matToImageData(dst);
    } finally {
      src.delete();
      dst.delete();
    }
  }

  /**
   * Aplica operação morfológica
   *
   * @param imageData - Imagem binária
   * @param operation - Tipo de operação (MORPH_OPEN, MORPH_CLOSE, etc.)
   * @param kernelSize - Tamanho do kernel (deve ser ímpar)
   * @param kernelShape - Formato do kernel (MORPH_RECT, MORPH_ELLIPSE, MORPH_CROSS)
   * @returns Imagem processada
   */
  static morphologyEx(
    imageData: ImageData,
    operation: number,
    kernelSize: number = 3,
    kernelShape: number = cv.MORPH_RECT
  ): ImageData {
    const src = this.imageDataToMat(imageData);
    const dst = new cv.Mat();
    const kernel = cv.getStructuringElement(
      kernelShape,
      new cv.Size(kernelSize, kernelSize)
    );

    try {
      cv.morphologyEx(src, dst, operation, kernel);

      return this.matToImageData(dst);
    } finally {
      src.delete();
      dst.delete();
      kernel.delete();
    }
  }

  /**
   * Detecta bordas usando Canny
   *
   * @param imageData - Imagem em grayscale
   * @param threshold1 - Primeiro threshold
   * @param threshold2 - Segundo threshold
   * @returns Imagem com bordas detectadas
   */
  static detectEdges(
    imageData: ImageData,
    threshold1: number = 50,
    threshold2: number = 150
  ): ImageData {
    const src = this.imageDataToMat(imageData);
    const dst = new cv.Mat();

    try {
      cv.Canny(src, dst, threshold1, threshold2);

      return this.matToImageData(dst);
    } finally {
      src.delete();
      dst.delete();
    }
  }

  /**
   * Dilata a imagem (expande áreas brancas)
   *
   * @param imageData - Imagem binária
   * @param kernelSize - Tamanho do kernel
   * @param iterations - Número de iterações
   * @returns Imagem dilatada
   */
  static dilate(
    imageData: ImageData,
    kernelSize: number = 3,
    iterations: number = 1
  ): ImageData {
    const src = this.imageDataToMat(imageData);
    const dst = new cv.Mat();
    const kernel = cv.getStructuringElement(
      cv.MORPH_RECT,
      new cv.Size(kernelSize, kernelSize)
    );

    try {
      cv.dilate(src, dst, kernel, new cv.Point(-1, -1), iterations);

      return this.matToImageData(dst);
    } finally {
      src.delete();
      dst.delete();
      kernel.delete();
    }
  }

  /**
   * Erode a imagem (contrai áreas brancas)
   *
   * @param imageData - Imagem binária
   * @param kernelSize - Tamanho do kernel
   * @param iterations - Número de iterações
   * @returns Imagem erodida
   */
  static erode(
    imageData: ImageData,
    kernelSize: number = 3,
    iterations: number = 1
  ): ImageData {
    const src = this.imageDataToMat(imageData);
    const dst = new cv.Mat();
    const kernel = cv.getStructuringElement(
      cv.MORPH_RECT,
      new cv.Size(kernelSize, kernelSize)
    );

    try {
      cv.erode(src, dst, kernel, new cv.Point(-1, -1), iterations);

      return this.matToImageData(dst);
    } finally {
      src.delete();
      dst.delete();
      kernel.delete();
    }
  }

  /**
   * Inverte cores da imagem (preto ↔ branco)
   *
   * @param imageData - Imagem binária
   * @returns Imagem invertida
   */
  static invert(imageData: ImageData): ImageData {
    const src = this.imageDataToMat(imageData);
    const dst = new cv.Mat();

    try {
      cv.bitwise_not(src, dst);

      return this.matToImageData(dst);
    } finally {
      src.delete();
      dst.delete();
    }
  }

  /**
   * Pipeline completo de pré-processamento
   *
   * Este é o método principal que aplica todas as etapas necessárias
   * para preparar a imagem para detecção de tabela e símbolos.
   *
   * Ordem das etapas:
   *  1. Grayscale
   *  2. Deskew (corrigir inclinação)
   *  3. CLAHE (equalização de contraste adaptativa)
   *  4. Gaussian Blur (remover ruído)
   *  5. Adaptive Threshold (binarização)
   *  6. MORPH_CLOSE (fechar gaps em linhas)
   *  7. MORPH_OPEN (remover ruído — kernel 3, ímpar)
   *
   * @param imageData - Imagem original
   * @returns Imagem pré-processada pronta para análise
   */
  /**
   * Pipeline completo de pré-processamento
   *
   * Este é o método principal que aplica todas as etapas necessárias
   * para preparar a imagem para detecção de tabela e símbolos.
   *
   * Ordem das etapas:
   *  1. Grayscale
   *  2. Deskew (corrigir inclinação)
   *  3. CLAHE (equalização de contraste adaptativa)
   *  4. Gaussian Blur (remover ruído)
   *  5. Adaptive Threshold (binarização)
   *  6. MORPH_CLOSE (fechar gaps em linhas)
   *  7. MORPH_OPEN (remover ruído)
   *
   * @param imageData - Imagem original
   * @returns Imagem pré-processada pronta para análise
   */
  static async preprocess(imageData: ImageData): Promise<ImageData> {
    console.log('[ImageProcessor] Iniciando preprocess...');
    
    const src = cv.matFromImageData(imageData);
    let current = new cv.Mat();
    
    try {
      // 1. Grayscale
      cv.cvtColor(src, current, cv.COLOR_RGBA2GRAY);
      console.log('[ImageProcessor] Grayscale concluído');

      // 2. Corrige inclinação (deskew)
      // Nota: deskew() foi refatorada para aceitar e retornar Mat internamente se desejado,
      // mas aqui vamos implementar a lógica diretamente para eficiência.
      const moments = cv.moments(current, true);
      if (Math.abs(moments.mu02) >= 1e-2) {
        const skewAngle = 0.5 * Math.atan2(2 * moments.mu11, moments.mu20 - moments.mu02);
        const angleDeg = (skewAngle * 180) / Math.PI;

        if (Math.abs(angleDeg) <= 15) {
          const center = new cv.Point(current.cols / 2, current.rows / 2);
          const M = cv.getRotationMatrix2D(center, angleDeg, 1.0);
          const rotated = new cv.Mat();
          cv.warpAffine(current, rotated, M, current.size(), cv.INTER_LINEAR, cv.BORDER_REPLICATE);
          current.delete();
          current = rotated;
          M.delete();
          console.log(`[ImageProcessor] Deskew aplicado: ${angleDeg.toFixed(2)}°`);
        }
      }

      // 3. CLAHE
      const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
      const claheDst = new cv.Mat();
      clahe.apply(current, claheDst);
      current.delete();
      current = claheDst;
      clahe.delete();
      console.log('[ImageProcessor] CLAHE concluído');

      // 4. Gaussian Blur
      const blurred = new cv.Mat();
      cv.GaussianBlur(current, blurred, new cv.Size(3, 3), 0);
      current.delete();
      current = blurred;
      console.log('[ImageProcessor] Blur concluído');

      // 5. Adaptive Threshold
      const thresh = new cv.Mat();
      cv.adaptiveThreshold(
        current,
        thresh,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY,
        11,
        2
      );
      current.delete();
      current = thresh;
      console.log('[ImageProcessor] Threshold concluído');

      // 6. MORPH_CLOSE
      const kernelClose = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
      const closed = new cv.Mat();
      cv.morphologyEx(current, closed, cv.MORPH_CLOSE, kernelClose);
      current.delete();
      current = closed;
      kernelClose.delete();

      // 7. MORPH_OPEN
      const kernelOpen = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
      const opened = new cv.Mat();
      cv.morphologyEx(current, opened, cv.MORPH_OPEN, kernelOpen);
      current.delete();
      current = opened;
      kernelOpen.delete();

      console.log('[ImageProcessor] Pipeline concluído');
      return this.matToImageData(current);

    } catch (e) {
      console.error('[ImageProcessor] Erro no pipeline:', e);
      throw e;
    } finally {
      src.delete();
      current.delete();
    }
  }

  /**
   * Pré-processa uma célula de pista (coluna 0) para OCR com Tesseract.
   *
   * Células de pista (~210×60px) têm texto pequeno em fundo branco/cinza.
   * O pipeline abaixo melhora significativamente a taxa de reconhecimento:
   *
   *  1. Grayscale
   *  2. Upscale 3× com INTER_CUBIC (de ~210×60 para ~630×180)
   *  3. CLAHE (clipLimit=3.0, tileGridSize=4×4)
   *  4. adaptiveThreshold THRESH_BINARY (blockSize=15, C=7)
   *  5. MORPH_CLOSE 2×2 — fecha quebras em letras sem engrossar demais
   *
   * @param cellImage - ImageData da célula extraída por GridDetector.extractCell
   * @returns ImageData pronta para Tesseract (escala ampliada, binarizada)
   */
  static preprocessClueCell(cellImage: ImageData): ImageData {
    const src    = cv.matFromImageData(cellImage);
    let gray     = new cv.Mat();
    let denoised = new cv.Mat();
    let upscaled = new cv.Mat();
    let claheOut = new cv.Mat();
    let binary   = new cv.Mat();
    let closed   = new cv.Mat();
    let kernel   = new cv.Mat();

    try {
      // 1. Grayscale
      if (src.channels() === 4)       cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      else if (src.channels() === 3)  cv.cvtColor(src, gray, cv.COLOR_RGB2GRAY);
      else                            src.copyTo(gray);

      // 2. Denoising leve (elimina artefatos JPEG antes do upscale)
      cv.GaussianBlur(gray, denoised, new cv.Size(3, 3), 0.5);

      // 3. Upscale 2× com INTER_CUBIC
      //    Para coluna inteira (~210×740px → ~420×1480px): 2× é suficiente e
      //    evita o excesso de artefatos do 3× em texto pequeno
      const newSize = new cv.Size(denoised.cols * 2, denoised.rows * 2);
      cv.resize(denoised, upscaled, newSize, 0, 0, cv.INTER_CUBIC);

      // 4. CLAHE — equalização de contraste local
      //    tileSize maior (16) para acomodar a coluna inteira
      const clahe = new cv.CLAHE(2.0, new cv.Size(16, 16));
      clahe.apply(upscaled, claheOut);
      clahe.collectGarbage();

      // 5. Binarização adaptativa
      //    blockSize=31 acomodado ao upscale 2× (texto ~24px de altura após upscale)
      cv.adaptiveThreshold(
        claheOut, binary,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY,
        31,
        10
      );

      // 6. MORPH_CLOSE 2×2 — fecha brechas em letras
      kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
      cv.morphologyEx(binary, closed, cv.MORPH_CLOSE, kernel);

      return this.matToImageData(closed);
    } finally {
      src.delete();
      gray.delete();
      denoised.delete();
      upscaled.delete();
      claheOut.delete();
      binary.delete();
      closed.delete();
      kernel.delete();
    }
  }

  /**
   * Redimensiona imagem mantendo aspect ratio
   *
   * @param imageData - Imagem original
   * @param maxWidth - Largura máxima
   * @param maxHeight - Altura máxima
   * @returns Imagem redimensionada
   */
  static resize(
    imageData: ImageData,
    maxWidth: number,
    maxHeight: number
  ): ImageData {
    const src = this.imageDataToMat(imageData);
    const dst = new cv.Mat();

    try {
      const aspectRatio = src.cols / src.rows;
      let newWidth = maxWidth;
      let newHeight = maxHeight;

      if (src.cols > src.rows) {
        newHeight = Math.round(maxWidth / aspectRatio);
      } else {
        newWidth = Math.round(maxHeight * aspectRatio);
      }

      const dsize = new cv.Size(newWidth, newHeight);
      cv.resize(src, dst, dsize, 0, 0, cv.INTER_AREA);

      return this.matToImageData(dst);
    } finally {
      src.delete();
      dst.delete();
    }
  }

  /**
   * Rotaciona imagem
   *
   * @param imageData - Imagem original
   * @param angle - Ângulo de rotação em graus
   * @returns Imagem rotacionada
   */
  static rotate(imageData: ImageData, angle: number): ImageData {
    const src = this.imageDataToMat(imageData);
    const dst = new cv.Mat();

    try {
      const center = new cv.Point(src.cols / 2, src.rows / 2);
      const M = cv.getRotationMatrix2D(center, angle, 1.0);
      const dsize = new cv.Size(src.cols, src.rows);

      cv.warpAffine(src, dst, M, dsize);

      M.delete();

      return this.matToImageData(dst);
    } finally {
      src.delete();
      dst.delete();
    }
  }
}
