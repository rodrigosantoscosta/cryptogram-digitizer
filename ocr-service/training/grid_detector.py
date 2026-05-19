"""
GridDetector — Detecção da grade do criptograma (Python port)

Port fiel do GridDetector.ts para Python com OpenCV + NumPy.

Cadeia de abordagens (mais para menos robusta):

  1. detect_by_projection_fft (primária)
     Erosão morfológica 1D + projeção 1D + FFT/autocorrelação para achar período dominante.
     Funciona com até ~60% das bordas fragmentadas.

  2. detect_by_hough_intersection (secundária)
     HoughLinesP → separar segmentos H/V → votação de interseções → projetar.

  3. detect_by_contours (terciária)
     Detecta diretamente contornos retangulares de área similar.

  4. detect_by_morphology (fallback final)
     Isolamento morfológico de linhas + projeção de pixels.

Adicional: correct_perspective() para correção de perspectiva via homografia.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

import cv2
import numpy as np


# ─── Data Structures ───────────────────────────────────────────────────────────

@dataclass
class BoundingBox:
    x: int
    y: int
    width: int
    height: int


@dataclass
class GridResult:
    roi: BoundingBox
    row_positions: list[int]
    col_positions: list[int]
    col_widths: list[int]
    row_heights: list[int]
    rows: int
    cols: int


# ─── Constants ─────────────────────────────────────────────────────────────────

MORPH_KERNEL_RATIO = 0.35
ROI_MARGIN = 4
PEAK_CLUSTER_RADIUS = 6
GAP_OUTLIER_TOLERANCE = 0.45
MIN_LINES = 3
CELL_ASPECT_RATIO_MAX = 2.5
CELL_SOLIDITY_MIN = 0.7
CELL_AREA_MIN_FACTOR = 0.35
CELL_AREA_MAX_FACTOR = 2.8
ROW_COL_CLUSTER_TOLERANCE = 0.4
MIN_CELLS_CONTOUR = 6

HOUGH_THRESHOLD = 30
HOUGH_MIN_LINE_RATIO = 0.04
HOUGH_MAX_LINE_GAP = 8
HOUGH_ANGLE_TOLERANCE = 15
INTERSECT_BUCKET_SIZE = 8
INTERSECT_MIN_VOTES = 3
MEDIAN_GAP_OUTLIER = 2.0
GRID_UNIFORMITY_TOL = 0.4

FFT_MIN_CELL_PERIOD = 15
FFT_MAX_CELL_PERIOD_RATIO = 0.45
FFT_SNR_MIN = 3.0
FFT_PEAK_SMOOTH_SIGMA_RATIO = 0.10
FFT_PEAK_MIN_SEPARATION_RATIO = 0.60


# ─── Perspective Correction ────────────────────────────────────────────────────

def correct_perspective(image: np.ndarray) -> np.ndarray:
    """
    Corrige perspectiva detectando o contorno do papel e aplicando warp perspective.

    Pipeline:
      1. Grayscale → blur → Canny edges
      2. findContours → maior quadrilátero
      3. Calcular homografia para retângulo fronto-paralelo
      4. warpPerspective

    Args:
        image: Imagem BGR ou grayscale (H, W, C) ou (H, W)

    Returns:
        Imagem corrigida com perspectiva fronto-paralela.
        Se não encontrar quadrilátero válido, retorna a imagem original.
    """
    if image.ndim == 2:
        gray = image.copy()
    else:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    h, w = gray.shape[:2]

    # Blur + Canny
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)

    # Dilatar para fechar gaps nas bordas do papel
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    dilated = cv2.dilate(edges, kernel, iterations=3)

    # Encontrar contornos
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return image

    # Encontrar o maior contorno quadrilátero
    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    paper_contour = None

    for cnt in contours[:5]:  # verificar os 5 maiores
        area = cv2.contourArea(cnt)
        if area < h * w * 0.1:  # pelo menos 10% da imagem
            continue
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
        if len(approx) == 4:
            paper_contour = approx
            break

    if paper_contour is None:
        # Fallback: usar o maior contorno mesmo que não seja quadrilátero
        paper_contour = cv2.approxPolyDP(contours[0], 0.02 * cv2.arcLength(contours[0], True), True)
        if len(paper_contour) != 4:
            return image

    # Ordenar pontos: top-left, top-right, bottom-right, bottom-left
    pts = order_points(paper_contour.reshape(4, 2))

    # Calcular dimensões do output
    width_a = np.linalg.norm(pts[1] - pts[0])
    width_b = np.linalg.norm(pts[2] - pts[3])
    max_width = max(int(width_a), int(width_b))

    height_a = np.linalg.norm(pts[1] - pts[2])
    height_b = np.linalg.norm(pts[0] - pts[3])
    max_height = max(int(height_a), int(height_b))

    # Pontos de destino (retângulo fronto-paralelo)
    dst = np.array([
        [0, 0],
        [max_width - 1, 0],
        [max_width - 1, max_height - 1],
        [0, max_height - 1],
    ], dtype=np.float32)

    # Homografia + warp
    matrix = cv2.getPerspectiveTransform(pts.astype(np.float32), dst)
    warped = cv2.warpPerspective(image, matrix, (max_width, max_height))

    return warped


def order_points(pts: np.ndarray) -> np.ndarray:
    """
    Ordena 4 pontos 2D em: top-left, top-right, bottom-right, bottom-left.

    Args:
        pts: Array (4, 2) de pontos (x, y)

    Returns:
        Array ordenado (4, 2)
    """
    rect = np.zeros((4, 2), dtype=np.float32)

    # Top-left: menor soma (x+y); Bottom-right: maior soma
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]

    # Top-right: menor diferença (y-x); Bottom-left: maior diferença
    diff = np.diff(pts, axis=1).flatten()
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]

    return rect


# ─── GridDetector ──────────────────────────────────────────────────────────────

class GridDetector:
    """Detecta a grade de células do criptograma."""

    # ─── API Pública ───────────────────────────────────────────────────────────

    @staticmethod
    def detect(image: np.ndarray) -> GridResult:
        """
        Detecta a grade de células do criptograma.

        Tenta as 4 abordagens em cascata: FFT → Hough → Contours → Morphology.

        Args:
            image: Imagem BGR ou grayscale (numpy array)

        Returns:
            GridResult com posições de linhas, colunas e dimensões

        Raises:
            ValueError se nenhuma abordagem detectar uma grade válida
        """
        # Tentativa 1: FFT de projeção
        try:
            result = GridDetector._detect_by_projection_fft(image)
            print(f"[GridDetector] OK Detecção por FFT bem-sucedida: {result.rows}x{result.cols}")
            return result
        except Exception as e:
            print(f"[GridDetector] FFT falhou, tentando Hough: {e}")

        # Tentativa 2: Hough + votação de interseções
        try:
            result = GridDetector._detect_by_hough_intersection(image)
            print(f"[GridDetector] OK Detecção por Hough+Interseção bem-sucedida: {result.rows}x{result.cols}")
            return result
        except Exception as e:
            print(f"[GridDetector] Hough+Interseção falhou, tentando contornos: {e}")

        # Tentativa 3: contornos quadrangulares
        try:
            result = GridDetector._detect_by_contours(image)
            print(f"[GridDetector] OK Detecção por contornos bem-sucedida: {result.rows}x{result.cols}")
            return result
        except Exception as e:
            print(f"[GridDetector] Detecção por contornos falhou, usando morfologia: {e}")

        # Fallback final: isolamento morfológico de linhas
        return GridDetector._detect_by_morphology(image)

    @staticmethod
    def extract_cell(image: np.ndarray, row: int, col: int, grid: GridResult, margin: int = 2) -> np.ndarray:
        """
        Extrai uma célula individual da imagem.

        Args:
            image: Imagem original (BGR ou grayscale)
            row: Índice da linha
            col: Índice da coluna
            grid: GridResult com posições
            margin: Margem em pixels para cortar

        Returns:
            Crop da célula como numpy array
        """
        if row < 0 or row >= grid.rows or col < 0 or col >= grid.cols:
            raise ValueError(f"Índices fora dos limites: ({row}, {col}) em {grid.rows}x{grid.cols}")

        x = grid.col_positions[col] + margin
        y = grid.row_positions[row] + margin
        w = grid.col_widths[col] - margin * 2
        h = grid.row_heights[row] - margin * 2

        if w <= 0 or h <= 0:
            raise ValueError(f"Dimensões inválidas: {w}x{h}")

        h_img, w_img = image.shape[:2]
        x = max(0, x)
        y = max(0, y)
        w = min(w, w_img - x)
        h = min(h, h_img - y)

        return image[y:y + h, x:x + w].copy()

    @staticmethod
    def extract_column_slice(image: np.ndarray, col: int, grid: GridResult, margin_x: int = 4) -> np.ndarray:
        """
        Extrai uma fatia vertical da imagem correspondendo a uma coluna inteira.

        Args:
            image: Imagem original
            col: Índice da coluna
            grid: GridResult com posições
            margin_x: Margem horizontal em pixels

        Returns:
            Crop da coluna completa como numpy array
        """
        x = grid.col_positions[col] + margin_x
        w = grid.col_widths[col] - margin_x * 2
        y = grid.row_positions[0]
        h = grid.row_positions[-1] - y

        if w <= 0 or h <= 0:
            raise ValueError(f"Dimensões inválidas para coluna {col}: {w}x{h}")

        h_img, w_img = image.shape[:2]
        x = max(0, x)
        y = max(0, y)
        w = min(w, w_img - x)
        h = min(h, h_img - y)

        return image[y:y + h, x:x + w].copy()

    @staticmethod
    def visualize(image: np.ndarray, grid: GridResult) -> np.ndarray:
        """
        Desenha a grade detectada sobre a imagem (para debug/validação).

        Args:
            image: Imagem original
            grid: GridResult com posições

        Returns:
            Imagem com grade desenhada em verde (linhas) e azul (colunas)
        """
        if image.ndim == 2:
            dst = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
        else:
            dst = image.copy()

        green = (0, 220, 0)
        blue = (255, 120, 30)
        thickness = 2

        x0 = grid.col_positions[0]
        x1 = grid.col_positions[-1]
        for y in grid.row_positions:
            cv2.line(dst, (x0, y), (x1, y), green, thickness)

        y0 = grid.row_positions[0]
        y1 = grid.row_positions[-1]
        for x in grid.col_positions:
            cv2.line(dst, (x, y0), (x, y1), blue, thickness)

        return dst

    # ─── Abordagem primária: FFT de projeção ───────────────────────────────────

    @staticmethod
    def _detect_by_projection_fft(image: np.ndarray) -> GridResult:
        """
        Detecta a grade usando erosão morfológica 1D nas projeções da imagem.

        Pipeline:
          1. Grayscale → Otsu threshold
          2. Erosão horizontal (kernel = 10% da largura) → isola linhas H contínuas
          3. Erosão vertical   (kernel = 10% da altura)  → isola linhas V contínuas
          4. Calcular projeção de cada imagem erodida
          5. Agrupar pixels resultantes → centros ponderados = posições de borda
          6. Deduplicar duplicatas próximas; regularizar gaps duplos
          7. Para colunas com grade não-uniforme: separar coluna de pistas + região numérica
          8. Validar uniformidade → GridResult
        """
        gray = GridDetector._to_grayscale(image)
        h_img, w_img = gray.shape[:2]

        # Binarizar: detectar se já está binarizada
        pure_px = np.sum((gray == 0) | (gray == 255))
        pure_ratio = pure_px / gray.size

        if pure_ratio > 0.85:
            thresh = cv2.bitwise_not(gray)
        else:
            _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        # Erosão horizontal: kernel 1 × (10% da largura)
        kw = max(5, round(w_img * 0.10))
        kernel_h = cv2.getStructuringElement(cv2.MORPH_RECT, (kw, 1))
        eroded_h = cv2.erode(thresh, kernel_h)

        # Erosão vertical: kernel (10% da altura) × 1
        kh = max(5, round(h_img * 0.10))
        kernel_v = cv2.getStructuringElement(cv2.MORPH_RECT, (1, kh))
        eroded_v = cv2.erode(thresh, kernel_v)

        # Projeções 1D
        h_proj = np.sum(eroded_h > 0, axis=1).astype(np.float64) / w_img
        v_proj = np.sum(eroded_v > 0, axis=0).astype(np.float64) / h_img

        # Extrair bordas da projeção
        h_borders_raw = GridDetector._extract_border_centers(h_proj, gap_thresh=10)
        if len(h_borders_raw) < 2:
            raise ValueError(f"Bordas H insuficientes pela erosão: {len(h_borders_raw)}")

        h_centers = [b[0] for b in h_borders_raw]
        h_spacings = [h_centers[i + 1] - h_centers[i] for i in range(len(h_centers) - 1)]
        h_t = GridDetector._median(h_spacings)
        h_deduped = GridDetector._dedupe_borders(h_borders_raw, h_t * 0.5)
        row_positions = GridDetector._regularize([b[0] for b in h_deduped], h_t)

        print(f"[GridDetector/FFT] Erosão H: {len(h_borders_raw)} bordas brutas → T={h_t:.0f}px → {len(row_positions) - 1} linhas")

        # Posições de colunas (V)
        v_borders_raw = GridDetector._extract_border_centers(v_proj, gap_thresh=10)
        if len(v_borders_raw) < 2:
            raise ValueError(f"Bordas V insuficientes pela erosão: {len(v_borders_raw)}")

        v_centers = [b[0] for b in v_borders_raw]
        v_spacings = [v_centers[i + 1] - v_centers[i] for i in range(len(v_centers) - 1)]
        v_t_full = GridDetector._median(v_spacings)

        # Detectar coluna de pistas (gap dominante)
        split_idx = -1
        sorted_sp = sorted(v_spacings)
        median_sp = sorted_sp[len(sorted_sp) // 2]
        max_gap = max(v_spacings)
        if max_gap > median_sp * 2.0:
            split_idx = v_spacings.index(max_gap)

        if split_idx >= 0:
            # Grade não-uniforme
            numeric_centers = v_centers[split_idx + 1:]
            num_spacings = [numeric_centers[i + 1] - numeric_centers[i] for i in range(len(numeric_centers) - 1)]
            num_t = GridDetector._median(num_spacings)
            num_deduped = GridDetector._dedupe_borders(v_borders_raw[split_idx + 1:], num_t * 0.5)
            num_regularized = GridDetector._regularize([b[0] for b in num_deduped], num_t)
            col_positions = [0] + num_regularized
            print(f"[GridDetector/FFT] Erosão V: grade não-uniforme detectada, T_num={num_t:.0f}px → {len(col_positions) - 1} colunas")
        else:
            v_deduped = GridDetector._dedupe_borders(v_borders_raw, v_t_full * 0.5)
            col_positions = GridDetector._regularize([b[0] for b in v_deduped], v_t_full)
            print(f"[GridDetector/FFT] Erosão V: T={v_t_full:.0f}px → {len(col_positions) - 1} colunas")

        if len(row_positions) < 3 or len(col_positions) < 3:
            raise ValueError(f"Grade insuficiente: {len(row_positions)} H, {len(col_positions)} V")

        col_widths = GridDetector._compute_gaps(col_positions)
        row_heights = GridDetector._compute_gaps(row_positions)

        GridDetector._validate_uniformity(row_heights, "linhas (FFT)")
        if split_idx < 0:
            GridDetector._validate_uniformity(col_widths, "colunas (FFT)")

        roi = BoundingBox(
            x=col_positions[0],
            y=row_positions[0],
            width=col_positions[-1] - col_positions[0],
            height=row_positions[-1] - row_positions[0],
        )

        return GridResult(
            roi=roi,
            row_positions=row_positions,
            col_positions=col_positions,
            col_widths=col_widths,
            row_heights=row_heights,
            rows=len(row_positions) - 1,
            cols=len(col_positions) - 1,
        )

    # ─── Abordagem secundária: Hough + interseção ──────────────────────────────

    @staticmethod
    def _detect_by_hough_intersection(image: np.ndarray) -> GridResult:
        """
        Detecta a grade usando HoughLinesP e votação de interseções.

        Pipeline:
          1. Grayscale → Canny com limiares adaptativos
          2. HoughLinesP → separar segmentos H e V
          3. Calcular interseções H×V e acumular em buckets 2D
          4. Extrair picos do acumulador → projetar em X e Y
          5. Regularização por gap mediano → GridResult
        """
        gray = GridDetector._to_grayscale(image)
        h_img, w_img = gray.shape[:2]

        # Canny adaptativo
        sampled = gray[::4, ::4].flatten()
        median_pixel = float(np.median(sampled))
        canny_low = max(0, round(median_pixel * 0.66))
        canny_high = min(255, round(median_pixel * 1.33))
        edges = cv2.Canny(gray, canny_low, canny_high)

        # HoughLinesP
        min_len = round(min(w_img, h_img) * HOUGH_MIN_LINE_RATIO)
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, HOUGH_THRESHOLD,
                                minLineLength=min_len, maxLineGap=HOUGH_MAX_LINE_GAP)

        if lines is None or len(lines) == 0:
            raise ValueError("HoughLinesP não encontrou segmentos")

        # Separar segmentos H e V
        t_rad = math.radians(HOUGH_ANGLE_TOLERANCE)
        h_segs = []
        v_segs = []

        for line in lines:
            x1, y1, x2, y2 = line[0]
            angle = abs(math.atan2(y2 - y1, x2 - x1))
            if angle <= t_rad or angle >= math.pi - t_rad:
                h_segs.append((x1, y1, x2, y2))
            elif abs(angle - math.pi / 2) <= t_rad:
                v_segs.append((x1, y1, x2, y2))

        if len(h_segs) < 2 or len(v_segs) < 2:
            raise ValueError(f"Segmentos insuficientes: {len(h_segs)} H, {len(v_segs)} V")

        # Votação de interseções
        bw = math.ceil(w_img / INTERSECT_BUCKET_SIZE)
        bh = math.ceil(h_img / INTERSECT_BUCKET_SIZE)
        acc = np.zeros((bh, bw), dtype=np.int32)

        for hx1, hy1, hx2, hy2 in h_segs:
            for vx1, vy1, vx2, vy2 in v_segs:
                pt = GridDetector._line_intersect(hx1, hy1, hx2, hy2, vx1, vy1, vx2, vy2)
                if pt is None:
                    continue
                px, py = pt
                if 0 <= px < w_img and 0 <= py < h_img:
                    bx = px // INTERSECT_BUCKET_SIZE
                    by = py // INTERSECT_BUCKET_SIZE
                    acc[by, bx] += 1

        # Extrair picos do acumulador
        candidates = np.argwhere(acc >= INTERSECT_MIN_VOTES)
        if len(candidates) < 4:
            raise ValueError(f"Cantos insuficientes no acumulador: {len(candidates)}")

        candidate_x = (candidates[:, 1] * INTERSECT_BUCKET_SIZE + INTERSECT_BUCKET_SIZE / 2).tolist()
        candidate_y = (candidates[:, 0] * INTERSECT_BUCKET_SIZE + INTERSECT_BUCKET_SIZE / 2).tolist()

        raw_col_pos = GridDetector._cluster_peaks(sorted(candidate_x), INTERSECT_BUCKET_SIZE * 1.5)
        raw_row_pos = GridDetector._cluster_peaks(sorted(candidate_y), INTERSECT_BUCKET_SIZE * 1.5)

        col_positions = GridDetector._regularize_by_median_gap(raw_col_pos)
        row_positions = GridDetector._regularize_by_median_gap(raw_row_pos)

        if len(row_positions) < 3 or len(col_positions) < 3:
            raise ValueError(f"Grade insuficiente após regularização: {len(row_positions)} H, {len(col_positions)} V")

        col_widths = GridDetector._compute_gaps(col_positions)
        row_heights = GridDetector._compute_gaps(row_positions)

        GridDetector._validate_uniformity(col_widths, "colunas")
        GridDetector._validate_uniformity(row_heights, "linhas")

        roi = BoundingBox(
            x=col_positions[0],
            y=row_positions[0],
            width=col_positions[-1] - col_positions[0],
            height=row_positions[-1] - row_positions[0],
        )

        return GridResult(
            roi=roi,
            row_positions=row_positions,
            col_positions=col_positions,
            col_widths=col_widths,
            row_heights=row_heights,
            rows=len(row_positions) - 1,
            cols=len(col_positions) - 1,
        )

    # ─── Abordagem terciária: Contornos ────────────────────────────────────────

    @staticmethod
    def _detect_by_contours(image: np.ndarray) -> GridResult:
        """
        Detecta células encontrando contornos retangulares de tamanho similar.

        Pipeline:
          1. Grayscale + Otsu threshold
          2. MORPH_CLOSE para fechar bordas quebradas
          3. findContours (RETR_TREE)
          4. Filtrar por retangularidade, aspect ratio, área modal
          5. Agrupar por linha/coluna → GridResult
        """
        gray = GridDetector._to_grayscale(image)
        h_img, w_img = gray.shape[:2]

        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        close_kernel_sz = max(3, round(min(h_img, w_img) * 0.03))
        close_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (close_kernel_sz, close_kernel_sz))
        closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, close_kernel)

        contours, _ = cv2.findContours(closed, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

        candidates = GridDetector._filter_cell_contours(contours, w_img, h_img)

        if len(candidates) < MIN_CELLS_CONTOUR:
            raise ValueError(f"Contornos candidatos insuficientes: {len(candidates)} (mínimo {MIN_CELLS_CONTOUR})")

        return GridDetector._build_grid_from_cells(candidates, w_img, h_img)

    # ─── Fallback: Morfologia ──────────────────────────────────────────────────

    @staticmethod
    def _detect_by_morphology(image: np.ndarray) -> GridResult:
        """
        Detecta a grade isolando morfologicamente linhas H e V,
        depois projeta os pixels para encontrar posições.
        """
        gray = GridDetector._to_grayscale(image)
        h_img, w_img = gray.shape[:2]

        roi = GridDetector._extract_table_roi(gray, w_img, h_img)

        roi_rect = (
            max(0, roi.x - ROI_MARGIN),
            max(0, roi.y - ROI_MARGIN),
            min(roi.width + ROI_MARGIN * 2, w_img - roi.x),
            min(roi.height + ROI_MARGIN * 2, h_img - roi.y),
        )
        roi_mat = gray[roi_rect[1]:roi_rect[1] + roi_rect[3],
                       roi_rect[0]:roi_rect[0] + roi_rect[2]]

        _, binarized = cv2.threshold(roi_mat, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        h_lines = GridDetector._isolate_lines(binarized, "horizontal")
        v_lines = GridDetector._isolate_lines(binarized, "vertical")

        raw_row_pos = GridDetector._project_and_find_peaks(h_lines, "horizontal")
        raw_col_pos = GridDetector._project_and_find_peaks(v_lines, "vertical")

        abs_row_pos = [y + roi_rect[1] for y in raw_row_pos]
        abs_col_pos = [x + roi_rect[0] for x in raw_col_pos]

        row_positions = GridDetector._regularize_positions(abs_row_pos, roi.height)
        col_positions = GridDetector._regularize_positions(abs_col_pos, roi.width)

        if len(row_positions) < MIN_LINES or len(col_positions) < MIN_LINES:
            raise ValueError(f"Grade insuficiente: {len(row_positions)} H, {len(col_positions)} V")

        col_widths = GridDetector._compute_gaps(col_positions)
        row_heights = GridDetector._compute_gaps(row_positions)

        return GridResult(
            roi=roi,
            row_positions=row_positions,
            col_positions=col_positions,
            col_widths=col_widths,
            row_heights=row_heights,
            rows=len(row_positions) - 1,
            cols=len(col_positions) - 1,
        )

    # ─── Helpers — Contours ────────────────────────────────────────────────────

    @staticmethod
    def _filter_cell_contours(contours, image_w: int, image_h: int) -> list[BoundingBox]:
        image_area = image_w * image_h
        boxes: list[BoundingBox] = []

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < 50 or area > image_area * 0.5:
                continue

            peri = cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, 0.04 * peri, True)
            n_vertices = len(approx)
            if n_vertices < 4 or n_vertices > 6:
                continue

            x, y, w, h = cv2.boundingRect(cnt)
            ar = w / max(h, 1)
            if ar > CELL_ASPECT_RATIO_MAX or ar < 1 / CELL_ASPECT_RATIO_MAX:
                continue

            bb_area = w * h
            solidity = area / bb_area
            if solidity < CELL_SOLIDITY_MIN:
                continue

            boxes.append(BoundingBox(x=x, y=y, width=w, height=h))

        if not boxes:
            return boxes

        areas = [b.width * b.height for b in boxes]
        modal_area = GridDetector._modal_value(areas, 20)

        return [b for b in boxes if modal_area * CELL_AREA_MIN_FACTOR <= b.width * b.height <= modal_area * CELL_AREA_MAX_FACTOR]

    @staticmethod
    def _build_grid_from_cells(cells: list[BoundingBox], image_w: int, image_h: int) -> GridResult:
        modal_h = GridDetector._modal_value([c.height for c in cells], 10)
        modal_w = GridDetector._modal_value([c.width for c in cells], 10)

        row_tol = modal_h * ROW_COL_CLUSTER_TOLERANCE
        col_tol = modal_w * ROW_COL_CLUSTER_TOLERANCE

        by_center = [(c, c.y + c.height / 2, c.x + c.width / 2) for c in cells]
        by_center.sort(key=lambda t: t[1])

        row_groups: list[list[BoundingBox]] = []
        for cell, cy, cx in by_center:
            if not row_groups or abs(cy - (row_groups[-1][0].y + row_groups[-1][0].height / 2)) > row_tol:
                row_groups.append([cell])
            else:
                row_groups[-1].append(cell)

        if len(row_groups) < 2:
            raise ValueError(f"Linhas insuficientes detectadas: {len(row_groups)}")

        for group in row_groups:
            group.sort(key=lambda c: c.x + c.width / 2)

        all_cx = sorted([c.x + c.width / 2 for g in row_groups for c in g])
        col_centers = GridDetector._cluster_peaks(all_cx, col_tol)

        if len(col_centers) < 2:
            raise ValueError(f"Colunas insuficientes detectadas: {len(col_centers)}")

        col_left_edges = []
        col_right_edges = []
        for cx in col_centers:
            in_col = [c for c in cells if abs((c.x + c.width / 2) - cx) <= col_tol]
            lefts = sorted([c.x for c in in_col])
            rights = sorted([c.x + c.width for c in in_col])
            col_left_edges.append(lefts[max(0, int(len(lefts) * 0.1))])
            col_right_edges.append(rights[min(len(rights) - 1, int(len(rights) * 0.9))])

        row_top_edges = []
        row_bottom_edges = []
        for group in row_groups:
            tops = sorted([c.y for c in group])
            bottoms = sorted([c.y + c.height for c in group])
            row_top_edges.append(tops[max(0, int(len(tops) * 0.1))])
            row_bottom_edges.append(bottoms[min(len(bottoms) - 1, int(len(bottoms) * 0.9))])

        col_positions = col_left_edges + [col_right_edges[-1]]
        row_positions = row_top_edges + [row_bottom_edges[-1]]

        col_widths = GridDetector._compute_gaps(col_positions)
        row_heights = GridDetector._compute_gaps(row_positions)

        roi = BoundingBox(
            x=col_positions[0],
            y=row_positions[0],
            width=col_positions[-1] - col_positions[0],
            height=row_positions[-1] - row_positions[0],
        )

        return GridResult(
            roi=roi,
            row_positions=row_positions,
            col_positions=col_positions,
            col_widths=col_widths,
            row_heights=row_heights,
            rows=len(row_groups),
            cols=len(col_centers),
        )

    # ─── Helpers — Morphology ──────────────────────────────────────────────────

    @staticmethod
    def _extract_table_roi(gray: np.ndarray, image_w: int, image_h: int) -> BoundingBox:
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        mean_val = cv2.mean(thresh)[0]
        if mean_val > 200:
            thresh = cv2.bitwise_not(thresh)

        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if not contours:
            return BoundingBox(x=0, y=0, width=image_w, height=image_h)

        max_area = 0
        max_idx = 0
        for i, cnt in enumerate(contours):
            area = cv2.contourArea(cnt)
            if area > max_area:
                max_area = area
                max_idx = i

        x, y, w, h = cv2.boundingRect(contours[max_idx])
        return BoundingBox(x=x, y=y, width=w, height=h)

    @staticmethod
    def _isolate_lines(binarized: np.ndarray, direction: str) -> np.ndarray:
        is_h = direction == "horizontal"
        kw = max(round(binarized.shape[1] * MORPH_KERNEL_RATIO), 1) if is_h else 1
        kh = max(round(binarized.shape[0] * MORPH_KERNEL_RATIO), 1) if not is_h else 1
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kw, kh))
        dst = cv2.erode(binarized, kernel)
        dst = cv2.dilate(dst, kernel)
        return dst

    @staticmethod
    def _project_and_find_peaks(lines_mat: np.ndarray, direction: str) -> list[int]:
        is_h = direction == "horizontal"
        size = lines_mat.shape[0] if is_h else lines_mat.shape[1]
        projection = np.zeros(size, dtype=np.float64)

        if is_h:
            projection = np.sum(lines_mat > 0, axis=1).astype(np.float64)
        else:
            projection = np.sum(lines_mat > 0, axis=0).astype(np.float64)

        max_val = projection.max()
        if max_val == 0:
            return []

        threshold = max_val * 0.40
        peaks = []
        in_run = False
        run_start = 0

        for i in range(size + 1):
            above = i < size and projection[i] > threshold
            if above and not in_run:
                in_run = True
                run_start = i
            elif not above and in_run:
                in_run = False
                run_slice = projection[run_start:i]
                indices = np.arange(run_start, i)
                w_total = run_slice.sum()
                if w_total > 0:
                    peaks.append(round((indices * run_slice).sum() / w_total))
                else:
                    peaks.append(round((run_start + i - 1) / 2))

        return peaks

    @staticmethod
    def _regularize_positions(positions: list[int], roi_size: int) -> list[int]:
        if not positions:
            return positions

        sorted_pos = sorted(positions)
        sorted_pos = GridDetector._cluster_peaks(sorted_pos, PEAK_CLUSTER_RADIUS)

        gaps = GridDetector._compute_gaps(sorted_pos)
        if not gaps:
            return sorted_pos

        gap_clusters = GridDetector._kmeans_1d(gaps, 2)
        kept = [sorted_pos[0]]

        for i, gap in enumerate(gaps):
            cluster_median = gap_clusters["centroids"][gap_clusters["labels"][i]]
            deviation = abs(gap - cluster_median) / cluster_median if cluster_median > 0 else 0

            if deviation <= GAP_OUTLIER_TOLERANCE:
                kept.append(sorted_pos[i + 1])
            else:
                n_missing = round(gap / cluster_median) - 1
                if 0 < n_missing <= 3:
                    for m in range(1, n_missing + 1):
                        kept.append(round(sorted_pos[i] + cluster_median * m))
                kept.append(sorted_pos[i + 1])

        return kept

    # ─── Helpers — FFT / Projection ────────────────────────────────────────────

    @staticmethod
    def _extract_border_centers(proj: np.ndarray, gap_thresh: int = 10) -> list[tuple[int, float]]:
        groups: list[list[int]] = []
        cur: list[int] = []
        for i in range(len(proj)):
            if proj[i] > 0.001:
                if not cur or i - cur[-1] <= gap_thresh:
                    cur.append(i)
                else:
                    groups.append(cur)
                    cur = [i]
        if cur:
            groups.append(cur)

        result = []
        for g in groups:
            vals = proj[g]
            sum_w = vals.sum()
            if sum_w > 0:
                center = round(np.dot(np.array(g, dtype=np.float64), vals) / sum_w)
            else:
                center = g[len(g) // 2]
            result.append((center, float(vals.max())))
        return result

    @staticmethod
    def _dedupe_borders(borders: list[tuple[int, float]], min_sep: float) -> list[tuple[int, float]]:
        out: list[tuple[int, float]] = []
        for b in borders:
            if not out or b[0] - out[-1][0] >= min_sep:
                out.append(b)
            elif b[1] > out[-1][1]:
                out[-1] = b
        return out

    @staticmethod
    def _regularize(centers: list[int], t: float) -> list[int]:
        if not centers:
            return centers
        result = [centers[0]]
        for i in range(len(centers) - 1):
            gap = centers[i + 1] - centers[i]
            n = round(gap / t)
            for m in range(1, n):
                result.append(round(centers[i] + t * m))
            result.append(centers[i + 1])
        return result

    @staticmethod
    def _regularize_by_median_gap(positions: list[int]) -> list[int]:
        if len(positions) < 2:
            return positions
        gaps = GridDetector._compute_gaps(positions)
        median_gap = GridDetector._median(gaps)
        if median_gap <= 0:
            return positions

        result = [positions[0]]
        for i in range(len(gaps)):
            ratio = gaps[i] / median_gap
            if ratio > MEDIAN_GAP_OUTLIER:
                n_missing = round(ratio) - 1
                if 0 < n_missing <= 4:
                    for m in range(1, n_missing + 1):
                        result.append(round(positions[i] + median_gap * m))
            result.append(positions[i + 1])
        return result

    # ─── Helpers — FFT (pure numpy) ────────────────────────────────────────────

    @staticmethod
    def _fft(re: np.ndarray, im: np.ndarray) -> None:
        """Cooley-Tukey iterative in-place FFT."""
        n = len(re)
        # Bit-reversal
        j = 0
        for i in range(1, n):
            bit = n >> 1
            while j & bit:
                j ^= bit
                bit >>= 1
            j ^= bit
            if i < j:
                re[i], re[j] = re[j], re[i]
                im[i], im[j] = im[j], im[i]

        # Butterfly
        length = 2
        while length <= n:
            ang = (-2 * math.pi) / length
            w_re = math.cos(ang)
            w_im = math.sin(ang)
            for i in range(0, n, length):
                cur_re, cur_im = 1.0, 0.0
                for jj in range(length // 2):
                    u_re = re[i + jj]
                    u_im = im[i + jj]
                    v_re = re[i + jj + length // 2] * cur_re - im[i + jj + length // 2] * cur_im
                    v_im = re[i + jj + length // 2] * cur_im + im[i + jj + length // 2] * cur_re
                    re[i + jj] = u_re + v_re
                    im[i + jj] = u_im + v_im
                    re[i + jj + length // 2] = u_re - v_re
                    im[i + jj + length // 2] = u_im - v_im
                    new_re = cur_re * w_re - cur_im * w_im
                    cur_im = cur_re * w_im + cur_im * w_re
                    cur_re = new_re
            length <<= 1

    @staticmethod
    def _fft_magnitudes(signal: np.ndarray) -> np.ndarray:
        """Calcula magnitudes espectrais (metade positiva) com janela de Hanning."""
        n = 1
        while n < len(signal):
            n <<= 1
        n <<= 1  # dobrar para melhor resolução

        window = GridDetector._hann_window(len(signal))
        re = np.zeros(n, dtype=np.float64)
        im = np.zeros(n, dtype=np.float64)
        re[:len(signal)] = signal * window

        GridDetector._fft(re, im)

        half = n >> 1
        mags = np.sqrt(re[:half] ** 2 + im[:half] ** 2)
        return mags

    @staticmethod
    def _hann_window(n: int) -> np.ndarray:
        return 0.5 * (1 - np.cos(2 * math.pi * np.arange(n) / (n - 1)))

    @staticmethod
    def _find_dominant_period(projection: np.ndarray, min_period: float, max_period: float) -> tuple[float, float]:
        """
        Encontra período dominante via autocorrelação → FFT (cascata).
        Returns (period, snr).
        """
        ac_result = GridDetector._find_period_by_autocorrelation(projection, min_period, max_period)
        if ac_result[1] >= FFT_SNR_MIN:
            print(f"[GridDetector/FFT] autocorrelação: T={ac_result[0]:.1f}px SNR={ac_result[1]:.2f}")
            return ac_result

        # FFT com supressão de harmônicos
        mags = GridDetector._fft_magnitudes(projection)
        n = len(mags) * 2

        k_min = max(1, math.ceil(n / max_period))
        k_max = min(math.floor(n / min_period), len(mags) - 1)

        if k_min >= k_max:
            raise ValueError(f"Banda de frequência inválida: kMin={k_min} kMax={k_max}")

        best_k = int(np.argmax(mags[k_min:k_max + 1])) + k_min
        best_mag = mags[best_k]

        # Supressão de harmônicos
        harmonic_min_ratio = 0.30
        elevated = True
        while elevated:
            elevated = False
            for n_h in range(2, 6):
                k_fund_raw = best_k / n_h
                if k_fund_raw < k_min:
                    continue
                for kf in [round(k_fund_raw) - 1, round(k_fund_raw), round(k_fund_raw) + 1]:
                    if k_min <= kf < len(mags) and mags[kf] >= best_mag * harmonic_min_ratio:
                        best_k = kf
                        best_mag = mags[kf]
                        elevated = True
                        break
                if elevated:
                    break

        # SNR banda estreita
        band_lo = max(k_min, round(best_k * 0.70))
        band_hi = min(k_max, round(best_k * 1.30))
        narrow_slice = mags[band_lo:band_hi + 1]
        mean_narrow = narrow_slice.mean() if len(narrow_slice) > 0 else 1.0
        snr = best_mag / mean_narrow if mean_narrow > 0 else 0

        # Refinamento parabólico
        refined_k = float(best_k)
        if best_k > k_min and best_k < k_max:
            a, b, c = mags[best_k - 1], mags[best_k], mags[best_k + 1]
            denom = a - 2 * b + c
            if abs(denom) > 1e-10:
                refined_k = best_k - (c - a) / (2 * denom)

        period = n / refined_k
        print(f"[GridDetector/FFT] FFT: T={period:.1f}px SNR={snr:.2f} (autocorr SNR={ac_result[1]:.2f} insuficiente)")
        return period, snr

    @staticmethod
    def _find_period_by_autocorrelation(projection: np.ndarray, min_period: float, max_period: float) -> tuple[float, float]:
        n = len(projection)
        mean = projection.mean()

        denom = np.sum((projection - mean) ** 2)
        if denom < 1e-10:
            return float(min_period), 0.0

        min_lag = max(1, int(min_period))
        max_lag = min(n - 1, int(max_period))

        acorr = np.zeros(max_lag + 1, dtype=np.float64)
        for lag in range(min_lag, max_lag + 1):
            acorr[lag] = np.sum((projection[:n - lag] - mean) * (projection[lag:] - mean)) / denom

        best_lag = int(np.argmax(acorr[min_lag:max_lag + 1])) + min_lag
        best_ac = acorr[best_lag]

        rms = math.sqrt(np.mean(acorr[min_lag:max_lag + 1] ** 2))
        snr = best_ac / rms if rms > 0 else 0

        # Refinamento parabólico
        refined_lag = float(best_lag)
        if best_lag > min_lag and best_lag < max_lag:
            a, b, c = acorr[best_lag - 1], acorr[best_lag], acorr[best_lag + 1]
            d = a - 2 * b + c
            if abs(d) > 1e-10:
                refined_lag = best_lag - (c - a) / (2 * d)

        return refined_lag, snr

    @staticmethod
    def _gaussian_smooth(signal: np.ndarray, sigma: float) -> np.ndarray:
        if sigma < 0.5:
            return signal.copy()
        radius = math.ceil(sigma * 3)
        kernel = np.exp(-np.arange(-radius, radius + 1) ** 2 / (2 * sigma * sigma))
        kernel /= kernel.sum()
        return np.convolve(signal, kernel, mode="same")

    @staticmethod
    def _find_local_peaks(signal: np.ndarray, min_sep: float) -> list[int]:
        n = len(signal)
        sep = max(1, round(min_sep))

        candidates = []
        for i in range(1, n - 1):
            if signal[i] >= signal[i - 1] and signal[i] >= signal[i + 1] and signal[i] > 0:
                candidates.append((i, float(signal[i])))

        candidates.sort(key=lambda x: x[1], reverse=True)
        peaks = []
        for idx, _ in candidates:
            if all(abs(idx - p) >= sep for p in peaks):
                peaks.append(idx)
        return sorted(peaks)

    # ─── Utilitários compartilhados ────────────────────────────────────────────

    @staticmethod
    def _to_grayscale(image: np.ndarray) -> np.ndarray:
        if image.ndim == 2:
            return image
        if image.shape[2] == 4:
            return cv2.cvtColor(image, cv2.COLOR_BGRA2GRAY)
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    @staticmethod
    def _median(values: list[float]) -> float:
        if not values:
            return 0.0
        s = sorted(values)
        mid = len(s) // 2
        return (s[mid - 1] + s[mid]) / 2 if len(s) % 2 == 0 else float(s[mid])

    @staticmethod
    def _compute_gaps(positions: list[int]) -> list[int]:
        return [positions[i] - positions[i - 1] for i in range(1, len(positions))]

    @staticmethod
    def _cluster_peaks(sorted_vals: list[float], radius: float) -> list[int]:
        result = []
        i = 0
        while i < len(sorted_vals):
            group = [sorted_vals[i]]
            while i + 1 < len(sorted_vals) and sorted_vals[i + 1] - sorted_vals[i] <= radius:
                i += 1
                group.append(sorted_vals[i])
            result.append(round(sum(group) / len(group)))
            i += 1
        return result

    @staticmethod
    def _validate_uniformity(gaps: list[int], label: str, tol: Optional[float] = None) -> None:
        if not gaps:
            return
        effective_tol = (tol if tol is not None else GRID_UNIFORMITY_TOL) * 2
        median = GridDetector._median(gaps)
        for g in gaps:
            if median > 0 and abs(g - median) / median > effective_tol:
                raise ValueError(f"Grade não uniforme em {label}: gap={g}, mediana={median}, tol={effective_tol:.2f}")

    @staticmethod
    def _line_intersect(x1, y1, x2, y2, x3, y3, x4, y4) -> Optional[tuple[int, int]]:
        denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
        if abs(denom) < 1e-10:
            return None
        t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
        px = x1 + t * (x2 - x1)
        py = y1 + t * (y2 - y1)
        return round(px), round(py)

    @staticmethod
    def _kmeans_1d(values: list[float], k: int) -> dict:
        if not values:
            return {"labels": [], "centroids": []}
        if len(values) < k:
            return {"labels": [0] * len(values), "centroids": [sum(values) / len(values)]}

        sorted_vals = sorted(values)
        centroids = [sorted_vals[round((i / k) * len(sorted_vals))] for i in range(k)]
        labels = [0] * len(values)

        for _ in range(10):
            new_labels = []
            for v in values:
                best_ki = 0
                best_dist = float("inf")
                for ki, c in enumerate(centroids):
                    d = abs(v - c)
                    if d < best_dist:
                        best_dist = d
                        best_ki = ki
                new_labels.append(best_ki)

            new_centroids = []
            for ki in range(k):
                members = [values[vi] for vi in range(len(values)) if new_labels[vi] == ki]
                new_centroids.append(sum(members) / len(members) if members else centroids[ki])

            centroids = new_centroids
            labels = new_labels

        return {"labels": labels, "centroids": centroids}

    @staticmethod
    def _modal_value(values: list[float], buckets: int) -> float:
        if not values:
            return 0.0
        min_v = min(values)
        max_v = max(values)
        if min_v == max_v:
            return min_v

        hist = [0] * buckets
        range_v = max_v - min_v
        for v in values:
            b = min(int(((v - min_v) / range_v) * buckets), buckets - 1)
            hist[b] += 1

        max_bucket = hist.index(max(hist))
        return min_v + (max_bucket / buckets) * range_v + range_v / (2 * buckets)
