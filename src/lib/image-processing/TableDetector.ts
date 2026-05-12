/**
 * TableDetector - Detecção de estrutura de tabela
 *
 * Este módulo detecta linhas horizontais e verticais de uma tabela
 * usando Hough Line Transform e calcula a grade (grid) de células.
 */

import type { Line, Point, TableStructure, BoundingBox } from '../../types/image';

declare const cv: any;

export class TableDetector {
  /**
   * Detecta linhas na imagem usando Hough Line Transform Probabilístico
   *
   * @param imageData - Imagem binária com bordas
   * @param minLineLength - Comprimento mínimo da linha
   * @param maxLineGap - Gap máximo para considerar linha contínua
   * @param threshold - Threshold de votação
   * @returns Array de linhas detectadas
   */
  static detectLines(
    imageData: ImageData,
    minLineLength: number = 100,
    maxLineGap: number = 10,
    threshold: number = 100
  ): Line[] {
    const src = cv.matFromImageData(imageData);
    const lines = new cv.Mat();

    try {
      cv.HoughLinesP(
        src,
        lines,
        1,
        Math.PI / 180,
        threshold,
        minLineLength,
        maxLineGap
      );

      const result: Line[] = [];

      for (let i = 0; i < lines.rows; i++) {
        const x1 = lines.data32S[i * 4];
        const y1 = lines.data32S[i * 4 + 1];
        const x2 = lines.data32S[i * 4 + 2];
        const y2 = lines.data32S[i * 4 + 3];

        const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
        const length = Math.sqrt(
          Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)
        );

        result.push({
          p1: { x: x1, y: y1 },
          p2: { x: x2, y: y2 },
          angle,
          length
        });
      }

      return result;
    } finally {
      src.delete();
      lines.delete();
    }
  }

  /**
   * Separa linhas em horizontais e verticais
   *
   * @param lines - Array de linhas
   * @param angleThreshold - Threshold de ângulo em graus
   * @returns Objeto com linhas horizontais e verticais
   */
  static separateLines(
    lines: Line[],
    angleThreshold: number = 10
  ): { horizontal: Line[]; vertical: Line[] } {
    const horizontal: Line[] = [];
    const vertical: Line[] = [];

    for (const line of lines) {
      const absAngle = Math.abs(line.angle);

      if (absAngle < angleThreshold || absAngle > 180 - angleThreshold) {
        horizontal.push(line);
      } else if (Math.abs(absAngle - 90) < angleThreshold) {
        vertical.push(line);
      }
    }

    return { horizontal, vertical };
  }

  /**
   * Calcula a posição central de uma linha no eixo relevante.
   *
   * Usa a média dos dois pontos extremos em vez de apenas p1,
   * o que é mais robusto quando segmentos detectados têm offsets
   * diferentes na mesma linha real.
   *
   * @param line - Linha detectada
   * @param isHorizontal - true para linhas horizontais (eixo Y), false para verticais (eixo X)
   * @returns Posição central no eixo relevante
   */
  private static lineCenterPos(line: Line, isHorizontal: boolean): number {
    return isHorizontal
      ? (line.p1.y + line.p2.y) / 2   // Fix: média de Y (era apenas p1.y)
      : (line.p1.x + line.p2.x) / 2;  // Fix: média de X (era apenas p1.x)
  }

  /**
   * Mescla linhas que estão muito próximas
   *
   * Útil para consolidar múltiplas detecções da mesma linha.
   * Usa a posição central (média de p1+p2) para comparação, o que é mais
   * robusto que usar apenas p1 quando os segmentos têm offsets diferentes.
   *
   * @param lines - Array de linhas
   * @param threshold - Distância máxima para considerar mesma linha
   * @returns Array de linhas mescladas
   */
  static mergeCloseLines(
    lines: Line[],
    threshold: number = 15
  ): Line[] {
    if (lines.length === 0) return [];

    const isHorizontal = Math.abs(lines[0].angle) < 45;

    // Ordenar pela posição central (não apenas p1)
    const sorted = [...lines].sort((a, b) => {
      return this.lineCenterPos(a, isHorizontal) - this.lineCenterPos(b, isHorizontal);
    });

    const merged: Line[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const last = merged[merged.length - 1];

      const currentPos = this.lineCenterPos(current, isHorizontal);
      const lastPos = this.lineCenterPos(last, isHorizontal);

      if (Math.abs(currentPos - lastPos) < threshold) {
        // Substituir última linha pela média das duas
        merged[merged.length - 1] = {
          p1: {
            x: Math.round((last.p1.x + current.p1.x) / 2),
            y: Math.round((last.p1.y + current.p1.y) / 2)
          },
          p2: {
            x: Math.round((last.p2.x + current.p2.x) / 2),
            y: Math.round((last.p2.y + current.p2.y) / 2)
          },
          angle: (last.angle + current.angle) / 2,
          length: Math.max(last.length, current.length)
        };
      } else {
        merged.push(current);
      }
    }

    return merged;
  }

  /**
   * Estende linhas para cobrir toda a largura/altura da imagem
   *
   * @param lines - Array de linhas
   * @param imageWidth - Largura da imagem
   * @param imageHeight - Altura da imagem
   * @returns Array de linhas estendidas
   */
  static extendLines(
    lines: Line[],
    imageWidth: number,
    imageHeight: number
  ): Line[] {
    return lines.map(line => {
      const isHorizontal = Math.abs(line.angle) < 45;

      if (isHorizontal) {
        const y = Math.round((line.p1.y + line.p2.y) / 2);
        return {
          p1: { x: 0, y },
          p2: { x: imageWidth, y },
          angle: line.angle,
          length: imageWidth
        };
      } else {
        const x = Math.round((line.p1.x + line.p2.x) / 2);
        return {
          p1: { x, y: 0 },
          p2: { x, y: imageHeight },
          angle: line.angle,
          length: imageHeight
        };
      }
    });
  }

  /**
   * Calcula pontos de intersecção entre linhas horizontais e verticais
   *
   * @param horizontal - Linhas horizontais
   * @param vertical - Linhas verticais
   * @returns Grade de pontos de intersecção
   */
  static calculateIntersections(
    horizontal: Line[],
    vertical: Line[]
  ): Point[][] {
    const grid: Point[][] = [];

    for (const hLine of horizontal) {
      const row: Point[] = [];

      for (const vLine of vertical) {
        const x = Math.round((vLine.p1.x + vLine.p2.x) / 2);
        const y = Math.round((hLine.p1.y + hLine.p2.y) / 2);

        row.push({ x, y });
      }

      grid.push(row);
    }

    return grid;
  }

  /**
   * Filtra linhas por comprimento mínimo
   *
   * @param lines - Array de linhas
   * @param minLength - Comprimento mínimo
   * @returns Linhas filtradas
   */
  static filterByLength(lines: Line[], minLength: number): Line[] {
    return lines.filter(line => line.length >= minLength);
  }

  /**
   * Detecta a estrutura completa da tabela
   *
   * @param imageData - Imagem pré-processada
   * @returns Estrutura da tabela detectada
   */
  static async detectTableStructure(
    imageData: ImageData
  ): Promise<TableStructure> {
    // 1. Detectar bordas
    const edges = this.detectEdgesForTable(imageData);

    // 2. Detectar todas as linhas
    const allLines = this.detectLines(edges, 50, 10, 80);

    if (allLines.length === 0) {
      throw new Error('Nenhuma linha detectada na imagem');
    }

    // 3. Separar horizontal e vertical
    const { horizontal, vertical } = this.separateLines(allLines);

    if (horizontal.length < 2 || vertical.length < 2) {
      throw new Error('Tabela não detectada: linhas insuficientes');
    }

    // 4. Filtrar linhas curtas (ruído)
    const minLength = Math.min(imageData.width, imageData.height) * 0.3;
    const filteredH = this.filterByLength(horizontal, minLength);
    const filteredV = this.filterByLength(vertical, minLength);

    // 5. Mesclar linhas próximas (usando posição central — mais robusto)
    const mergedH = this.mergeCloseLines(filteredH, 15);
    const mergedV = this.mergeCloseLines(filteredV, 15);

    // 6. Estender linhas
    const extendedH = this.extendLines(mergedH, imageData.width, imageData.height);
    const extendedV = this.extendLines(mergedV, imageData.width, imageData.height);

    // 7. Calcular pontos de intersecção
    const gridPoints = this.calculateIntersections(extendedH, extendedV);

    // 8. Determinar dimensões
    const rows = extendedH.length - 1;
    const cols = extendedV.length - 1;

    if (rows < 1 || cols < 2) {
      throw new Error('Estrutura de tabela inválida');
    }

    // 9. Calcular tamanhos de células
    const cellWidth = cols > 0 ? gridPoints[0][1].x - gridPoints[0][0].x : 0;
    const cellHeight = rows > 0 ? gridPoints[1][0].y - gridPoints[0][0].y : 0;

    // 10. Identificar larguras das colunas
    const clueColumnWidth = cellWidth;
    const answerColumnWidth =
      cols > 1 ? gridPoints[0][2].x - gridPoints[0][1].x : cellWidth;

    return {
      rows,
      cols,
      cellWidth,
      cellHeight,
      gridPoints,
      clueColumnWidth,
      answerColumnWidth
    };
  }

  /**
   * Detecta bordas específicas para detecção de tabela
   *
   * @param imageData - Imagem pré-processada
   * @returns Imagem com bordas
   */
  private static detectEdgesForTable(imageData: ImageData): ImageData {
    const src = cv.matFromImageData(imageData);
    const dst = new cv.Mat();

    try {
      cv.Canny(src, dst, 50, 150, 3);

      // Fix: kernel 3×3 (ímpar) — era 2×2, o que causava dilatação assimétrica
      const kernel = cv.getStructuringElement(
        cv.MORPH_RECT,
        new cv.Size(3, 3)
      );
      cv.dilate(dst, dst, kernel);
      kernel.delete();

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
   * Extrai uma célula específica da grade
   *
   * @param imageData - Imagem completa
   * @param row - Índice da linha
   * @param col - Índice da coluna
   * @param structure - Estrutura da tabela
   * @returns ImageData da célula
   */
  static extractCell(
    imageData: ImageData,
    row: number,
    col: number,
    structure: TableStructure
  ): ImageData {
    if (
      row < 0 ||
      row >= structure.rows ||
      col < 0 ||
      col >= structure.cols
    ) {
      throw new Error('Índices de célula fora dos limites');
    }

    const src = cv.matFromImageData(imageData);

    try {
      const topLeft = structure.gridPoints[row][col];
      const bottomRight = structure.gridPoints[row + 1][col + 1];

      const margin = 2;
      const x = topLeft.x + margin;
      const y = topLeft.y + margin;
      const width = bottomRight.x - topLeft.x - 2 * margin;
      const height = bottomRight.y - topLeft.y - 2 * margin;

      if (width <= 0 || height <= 0) {
        throw new Error('Dimensões de célula inválidas');
      }

      const rect = new cv.Rect(x, y, width, height);
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
   * Visualiza a grade detectada sobre a imagem original
   *
   * @param imageData - Imagem original
   * @param structure - Estrutura da tabela
   * @returns Imagem com grade desenhada
   */
  static visualizeGrid(
    imageData: ImageData,
    structure: TableStructure
  ): ImageData {
    const src = cv.matFromImageData(imageData);
    const dst = new cv.Mat();

    try {
      if (src.channels() === 1) {
        cv.cvtColor(src, dst, cv.COLOR_GRAY2RGB);
      } else {
        src.copyTo(dst);
      }

      const color = new cv.Scalar(0, 255, 0);
      const thickness = 2;

      for (let i = 0; i <= structure.rows; i++) {
        const p1 = structure.gridPoints[i][0];
        const p2 = structure.gridPoints[i][structure.cols];
        cv.line(
          dst,
          new cv.Point(p1.x, p1.y),
          new cv.Point(p2.x, p2.y),
          color,
          thickness
        );
      }

      for (let j = 0; j <= structure.cols; j++) {
        const p1 = structure.gridPoints[0][j];
        const p2 = structure.gridPoints[structure.rows][j];
        cv.line(
          dst,
          new cv.Point(p1.x, p1.y),
          new cv.Point(p2.x, p2.y),
          color,
          thickness
        );
      }

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
}
