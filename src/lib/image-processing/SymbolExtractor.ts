/**
 * SymbolExtractor - Extração e análise de símbolos
 * 
 * Este módulo extrai símbolos individuais de células da tabela,
 * normaliza-os e extrai características para classificação.
 */

import type {
  ExtractedSymbol,
  SymbolFeatures,
  Contour,
  BoundingBox,
  CellPosition
} from '../../types/image';

declare const cv: any;

export class SymbolExtractor {
  /**
   * Verifica se uma célula está vazia
   * 
   * @param cellImage - ImageData da célula
   * @param threshold - Porcentagem mínima de pixels não-brancos
   * @returns true se célula está vazia
   */
  static isEmpty(cellImage: ImageData, threshold: number = 0.05): boolean {
    const src = cv.matFromImageData(cellImage);

    try {
      // Contar pixels não-brancos (assumindo imagem binária)
      const nonWhitePixels = cv.countNonZero(src);
      const totalPixels = src.rows * src.cols;

      // Se menos de threshold% são não-brancos, considerar vazia
      return nonWhitePixels / totalPixels < threshold;
    } finally {
      src.delete();
    }
  }

  /**
   * Remove background da célula usando threshold Otsu
   * 
   * @param cellImage - ImageData da célula
   * @returns Célula com fundo removido
   */
  static removeBackground(cellImage: ImageData): ImageData {
    const src = cv.matFromImageData(cellImage);
    const dst = new cv.Mat();

    try {
      // Aplicar threshold Otsu invertido (símbolo branco, fundo preto)
      cv.threshold(
        src,
        dst,
        0,
        255,
        cv.THRESH_BINARY_INV + cv.THRESH_OTSU
      );

      const canvas = document.createElement('canvas');
      canvas.width = dst.cols;
      canvas.height = dst.rows;
      const ctx = canvas.getContext('2d')!;
      cv.imshow(canvas, dst);

      return ctx.getImageData(0, 0, dst.cols, dst.rows);
    } finally {
      src.delete();
      dst.delete();
    }
  }

  /**
   * Encontra o contorno principal do símbolo
   * 
   * @param cellImage - ImageData da célula com fundo removido
   * @returns Contorno do símbolo
   */
  static findSymbolContour(cellImage: ImageData): Contour {
    const src = cv.matFromImageData(cellImage);
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    try {
      // Encontrar todos os contornos
      cv.findContours(
        src,
        contours,
        hierarchy,
        cv.RETR_EXTERNAL,
        cv.CHAIN_APPROX_SIMPLE
      );

      if (contours.size() === 0) {
        throw new Error('Nenhum contorno encontrado');
      }

      // Encontrar o maior contorno (assumir que é o símbolo)
      let maxArea = 0;
      let maxContourIdx = -1;

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);

        if (area > maxArea) {
          maxArea = area;
          maxContourIdx = i;
        }
      }

      if (maxContourIdx === -1) {
        throw new Error('Nenhum contorno válido encontrado');
      }

      const mainContour = contours.get(maxContourIdx);

      // Obter bounding box
      const boundingRect = cv.boundingRect(mainContour);
      const boundingBox: BoundingBox = {
        x: boundingRect.x,
        y: boundingRect.y,
        width: boundingRect.width,
        height: boundingRect.height
      };

      // Calcular perímetro
      const perimeter = cv.arcLength(mainContour, true);

      // Converter contorno para array de pontos
      const points = [];
      for (let i = 0; i < mainContour.rows; i++) {
        points.push({
          x: mainContour.data32S[i * 2],
          y: mainContour.data32S[i * 2 + 1]
        });
      }

      return {
        points,
        boundingBox,
        area: maxArea,
        perimeter
      };
    } finally {
      src.delete();
      contours.delete();
      hierarchy.delete();
    }
  }

  /**
   * Recorta símbolo usando o bounding box
   * 
   * @param cellImage - ImageData da célula
   * @param contour - Contorno do símbolo
   * @returns Imagem recortada do símbolo
   */
  static cropSymbol(cellImage: ImageData, contour: Contour): ImageData {
    const src = cv.matFromImageData(cellImage);

    try {
      const { x, y, width, height } = contour.boundingBox;

      // Adicionar pequena margem
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
   * Normaliza símbolo para tamanho padrão
   * 
   * @param symbolImage - ImageData do símbolo
   * @param size - Tamanho padrão (width = height)
   * @returns Símbolo normalizado
   */
  static normalizeSymbol(
    symbolImage: ImageData,
    size: number = 64
  ): ImageData {
    const src = cv.matFromImageData(symbolImage);
    const dst = new cv.Mat();

    try {
      // Redimensionar mantendo aspect ratio
      const aspectRatio = src.cols / src.rows;
      let newWidth = size;
      let newHeight = size;

      if (aspectRatio > 1) {
        // Mais largo que alto
        newHeight = Math.round(size / aspectRatio);
      } else {
        // Mais alto que largo
        newWidth = Math.round(size * aspectRatio);
      }

      const dsize = new cv.Size(newWidth, newHeight);
      cv.resize(src, dst, dsize, 0, 0, cv.INTER_AREA);

      // Criar imagem quadrada com padding
      const square = new cv.Mat.zeros(size, size, dst.type());
      const xOffset = Math.floor((size - newWidth) / 2);
      const yOffset = Math.floor((size - newHeight) / 2);

      const roi = square.roi(
        new cv.Rect(xOffset, yOffset, newWidth, newHeight)
      );
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
   * Extrai características (features) do símbolo
   * 
   * @param symbolImage - ImageData do símbolo normalizado
   * @returns Características extraídas
   */
  static extractFeatures(symbolImage: ImageData): SymbolFeatures {
    const src = cv.matFromImageData(symbolImage);

    try {
      // 1. Calcular momentos
      const moments = cv.moments(src, true);

      // 2. Calcular Hu Moments (invariantes geométricos)
      const huMoments = new cv.Mat();
      cv.HuMoments(moments, huMoments);

      const huMomentsArray: number[] = [];
      for (let i = 0; i < 7; i++) {
        // Aplicar log para normalizar valores
        const value = huMoments.data64F[i];
        const logValue = -Math.sign(value) * Math.log10(Math.abs(value) + 1);
        huMomentsArray.push(logValue);
      }

      huMoments.delete();

      // 3. Calcular área
      const area = cv.countNonZero(src);

      // 4. Encontrar contorno para perímetro
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(
        src,
        contours,
        hierarchy,
        cv.RETR_EXTERNAL,
        cv.CHAIN_APPROX_SIMPLE
      );

      let perimeter = 0;
      if (contours.size() > 0) {
        const mainContour = contours.get(0);
        perimeter = cv.arcLength(mainContour, true);
      }

      contours.delete();
      hierarchy.delete();

      // 5. Calcular aspect ratio
      const boundingBox = this.getBoundingBox(src);
      const aspectRatio = boundingBox.width / boundingBox.height;

      // 6. Calcular centro de massa
      const centerOfMass = {
        x: moments.m10 / moments.m00,
        y: moments.m01 / moments.m00
      };

      // 7. Calcular histograma
      const histogram = this.calculateHistogram(src);

      // 8. Calcular extent (razão área/área do bounding box)
      const bbArea = boundingBox.width * boundingBox.height;
      const extent = bbArea > 0 ? area / bbArea : 0;

      return {
        area,
        perimeter,
        aspectRatio,
        moments: huMomentsArray,
        histogram,
        centerOfMass,
        extent
      };
    } finally {
      src.delete();
    }
  }

  /**
   * Calcula histograma de pixels
   * 
   * @param src - cv.Mat da imagem
   * @returns Array com histograma
   */
  private static calculateHistogram(src: any): number[] {
    const histogram: number[] = [];
    const hist = new cv.Mat();
    const srcVec = new cv.MatVector();
    srcVec.push_back(src);

    try {
      cv.calcHist(
        srcVec,
        [0], // canais
        new cv.Mat(), // máscara
        hist,
        [256], // histSize
        [0, 256] // ranges
      );

      for (let i = 0; i < hist.rows; i++) {
        histogram.push(hist.data32F[i]);
      }

      return histogram;
    } finally {
      hist.delete();
      srcVec.delete();
    }
  }

  /**
   * Obtém bounding box de uma imagem
   * 
   * @param src - cv.Mat da imagem
   * @returns BoundingBox
   */
  private static getBoundingBox(src: any): BoundingBox {
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    try {
      cv.findContours(
        src,
        contours,
        hierarchy,
        cv.RETR_EXTERNAL,
        cv.CHAIN_APPROX_SIMPLE
      );

      if (contours.size() === 0) {
        return { x: 0, y: 0, width: src.cols, height: src.rows };
      }

      const rect = cv.boundingRect(contours.get(0));

      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      };
    } finally {
      contours.delete();
      hierarchy.delete();
    }
  }

  /**
   * Gera hash único para um símbolo baseado em suas características
   * 
   * @param symbolImage - ImageData do símbolo
   * @returns Hash string
   */
  static generateSymbolHash(symbolImage: ImageData): string {
    // Simples hash baseado em pixels
    const data = symbolImage.data;
    let hash = 0;

    // Amostrar pixels em grid 8x8
    const step = Math.floor(symbolImage.width / 8);

    for (let y = 0; y < symbolImage.height; y += step) {
      for (let x = 0; x < symbolImage.width; x += step) {
        const idx = (y * symbolImage.width + x) * 4;
        const value = data[idx];
        hash = (hash << 5) - hash + value;
        hash = hash & hash; // Converter para 32-bit integer
      }
    }

    return `sym_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Pipeline completo de extração de símbolo
   * 
   * @param cellImage - ImageData da célula
   * @param position - Posição da célula no grid
   * @returns Símbolo extraído com características
   */
  static async extractSymbol(
    cellImage: ImageData,
    position: CellPosition
  ): Promise<ExtractedSymbol | null> {
    // 1. Verificar se célula está vazia
    if (this.isEmpty(cellImage)) {
      return null;
    }

    try {
      // 2. Remover background
      const cleaned = this.removeBackground(cellImage);

      // 3. Encontrar contorno
      const contour = this.findSymbolContour(cleaned);

      // 4. Recortar símbolo
      const cropped = this.cropSymbol(cleaned, contour);

      // 5. Normalizar
      const normalized = this.normalizeSymbol(cropped, 64);

      // 6. Extrair características
      const features = this.extractFeatures(normalized);

      // 7. Gerar hash
      const hash = this.generateSymbolHash(normalized);

      return {
        id: hash,
        imageData: normalized,
        features,
        positions: [position],
        hash
      };
    } catch (error) {
      console.error(`Erro ao extrair símbolo em (${position.row}, ${position.col}):`, error);
      return null;
    }
  }

  /**
   * Extrai todos os símbolos de uma tabela
   * 
   * @param preprocessedImage - Imagem pré-processada
   * @param tableStructure - Estrutura da tabela
   * @param skipFirstColumn - Pular primeira coluna (pistas)
   * @returns Array de símbolos extraídos
   */
  static async extractAllSymbols(
    preprocessedImage: ImageData,
    tableStructure: any,
    skipFirstColumn: boolean = true
  ): Promise<ExtractedSymbol[]> {
    const symbols: ExtractedSymbol[] = [];
    const startCol = skipFirstColumn ? 1 : 0;

    for (let row = 0; row < tableStructure.rows; row++) {
      for (let col = startCol; col < tableStructure.cols; col++) {
        // Extrair célula
        const cellImage = await this.extractCellFromTable(
          preprocessedImage,
          row,
          col,
          tableStructure
        );

        // Extrair símbolo
        const symbol = await this.extractSymbol(cellImage, { row, col });

        if (symbol) {
          symbols.push(symbol);
        }
      }
    }

    return symbols;
  }

  /**
   * Método auxiliar para extrair célula
   * (Delegaria para TableDetector.extractCell em produção)
   */
  private static async extractCellFromTable(
    imageData: ImageData,
    row: number,
    col: number,
    structure: any
  ): Promise<ImageData> {
    // Importar dinamicamente para evitar dependência circular
    const { TableDetector } = await import('./TableDetector');
    return TableDetector.extractCell(imageData, row, col, structure);
  }
}