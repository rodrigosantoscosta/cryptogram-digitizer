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
      // Converter RGBA para Grayscale
      cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY);
      
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
        0, // ignorado com OTSU
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
   * @param kernelSize - Tamanho do kernel
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
   * para preparar a imagem para detecção de tabela e símbolos
   * 
   * @param imageData - Imagem original
   * @returns Imagem pré-processada pronta para análise
   */
  static async preprocess(imageData: ImageData): Promise<ImageData> {
    // 1. Converter para grayscale
    let processed = this.toGrayscale(imageData);

    // 2. Aplicar blur para remover ruído de digitalização
    processed = this.gaussianBlur(processed, 3);

    // 3. Threshold adaptativo (melhor para iluminação irregular)
    processed = this.adaptiveThreshold(processed, 255, 11, 2);

    // 4. Morfologia: fechar pequenos gaps
    // Isso ajuda a unir linhas quebradas da tabela
    processed = this.morphologyEx(
      processed,
      cv.MORPH_CLOSE,
      3,
      cv.MORPH_RECT
    );

    // 5. Morfologia: remover pequenos ruídos
    processed = this.morphologyEx(
      processed,
      cv.MORPH_OPEN,
      2,
      cv.MORPH_RECT
    );

    return processed;
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
      // Calcular nova dimensão mantendo aspect ratio
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