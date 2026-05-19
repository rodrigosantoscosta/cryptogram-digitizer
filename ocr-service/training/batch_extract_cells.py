"""
Batch Cell Extractor — Fase 2

Processa todas as 43 fotos em samples/, corrige perspectiva, detecta o grid,
extrai células individuais com validação de qualidade e salva em real_cells/.

Uso:
  python batch_extract_cells.py [--samples-dir PATH] [--output-dir PATH]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import cv2
import numpy as np

# Adicionar diretório pai ao path para importar grid_detector
sys.path.insert(0, str(Path(__file__).parent))
from grid_detector import GridResult, correct_perspective, GridDetector


# ─── Configuração ──────────────────────────────────────────────────────────────

CELL_MARGIN = 3
MIN_LAPLACIAN_VAR = 50.0
MIN_BRIGHTNESS = 30
MAX_BRIGHTNESS = 230
MIN_STD = 5.0

DEFAULT_SAMPLES_DIR = Path(__file__).parent.parent.parent / "samples"
DEFAULT_OUTPUT_DIR = Path(__file__).parent.parent.parent / "real_cells"


# ─── Validação de Qualidade ────────────────────────────────────────────────────

def validate_cell(cell: np.ndarray) -> tuple[bool, str]:
    """
    Valida qualidade de uma célula extraída.

    Critérios:
      - Brightness: mean ∈ [30, 230]
      - Blur: Laplacian variance > 50
      - Empty: std > 5

    Returns:
        (is_valid, reason) — reason é "" se válida, descrição do problema se inválida.
    """
    if cell.size == 0:
        return False, "empty_array"

    gray = cell if cell.ndim == 2 else cv2.cvtColor(cell, cv2.COLOR_BGR2GRAY)

    # Brightness
    mean_val = float(np.mean(gray))
    if mean_val < MIN_BRIGHTNESS:
        return False, f"too_dark(mean={mean_val:.0f})"
    if mean_val > MAX_BRIGHTNESS:
        return False, f"too_bright(mean={mean_val:.0f})"

    # Empty (sem conteúdo)
    std_val = float(np.std(gray))
    if std_val < MIN_STD:
        return False, f"empty_cell(std={std_val:.1f})"

    # Blur (Laplacian variance)
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    lap_var = laplacian.var()
    if lap_var < MIN_LAPLACIAN_VAR:
        return False, f"blurry(lap_var={lap_var:.0f})"

    return True, ""


# ─── Processamento de uma Foto ─────────────────────────────────────────────────

def process_photo(
    image_path: Path,
    output_dir: Path,
) -> dict:
    """
    Processa uma única foto: corrige perspectiva, detecta grid, extrai células.

    Returns:
        Dict com métricas do processamento.
    """
    stem = image_path.stem
    photo_out = output_dir / stem
    photo_out.mkdir(parents=True, exist_ok=True)

    stats = {
        "photo": stem,
        "status": "ok",
        "error": None,
        "rows": 0,
        "cols": 0,
        "cells_total": 0,
        "cells_valid": 0,
        "cells_rejected": 0,
        "rejection_reasons": {},
        "perspective_corrected": False,
        "processing_time_s": 0.0,
    }

    t0 = time.time()

    try:
        # 1. Carregar imagem
        image = cv2.imread(str(image_path))
        if image is None:
            stats["status"] = "error"
            stats["error"] = "cv2.imread failed"
            return stats

        h_orig, w_orig = image.shape[:2]

        # 2. Corrigir perspectiva
        corrected = correct_perspective(image)
        stats["perspective_corrected"] = (corrected is not image)

        # 3. Detectar grid
        grid: GridResult = GridDetector.detect(corrected)
        stats["rows"] = grid.rows
        stats["cols"] = grid.cols

        # 4. Salvar overlay de debug
        overlay = GridDetector.visualize(corrected, grid)
        overlay_path = photo_out / "_grid_overlay.png"
        cv2.imwrite(str(overlay_path), overlay)

        # 5. Extrair células
        for row in range(grid.rows):
            for col in range(grid.cols):
                stats["cells_total"] += 1

                cell = GridDetector.extract_cell(corrected, row, col, grid, margin=CELL_MARGIN)

                is_valid, reason = validate_cell(cell)

                if is_valid:
                    cell_path = photo_out / f"cell_r{row}_c{col}.png"
                    cv2.imwrite(str(cell_path), cell)
                    stats["cells_valid"] += 1
                else:
                    stats["cells_rejected"] += 1
                    stats["rejection_reasons"][reason] = (
                        stats["rejection_reasons"].get(reason, 0) + 1
                    )

    except Exception as e:
        stats["status"] = "error"
        stats["error"] = str(e)

    stats["processing_time_s"] = round(time.time() - t0, 2)
    return stats


# ─── Relatório ─────────────────────────────────────────────────────────────────

def print_report(all_stats: list[dict]) -> None:
    """Imprime relatório consolidado no stdout."""
    total_photos = len(all_stats)
    success_photos = sum(1 for s in all_stats if s["status"] == "ok")
    error_photos = total_photos - success_photos

    total_cells = sum(s["cells_total"] for s in all_stats)
    total_valid = sum(s["cells_valid"] for s in all_stats)
    total_rejected = sum(s["cells_rejected"] for s in all_stats)

    # Agregação de razões de rejeição
    all_reasons: dict[str, int] = {}
    for s in all_stats:
        for reason, count in s.get("rejection_reasons", {}).items():
            all_reasons[reason] = all_reasons.get(reason, 0) + count

    total_time = sum(s["processing_time_s"] for s in all_stats)

    print("\n" + "=" * 60)
    print("  BATCH EXTRACTION REPORT")
    print("=" * 60)
    print(f"  Fotos processadas:       {total_photos}")
    print(f"    Sucesso:               {success_photos}")
    print(f"    Erro:                  {error_photos}")
    print()
    print(f"  Células totais:          {total_cells}")
    print(f"    Válidas:               {total_valid}")
    print(f"    Rejeitadas:            {total_rejected}")
    if total_cells > 0:
        print(f"    Taxa de aceitação:     {total_valid / total_cells * 100:.1f}%")
    print()

    if all_reasons:
        print(f"  Rejeições por critério:")
        for reason, count in sorted(all_reasons.items(), key=lambda x: -x[1]):
            pct = count / total_rejected * 100 if total_rejected > 0 else 0
            print(f"    {reason:25s} {count:5d}  ({pct:.1f}%)")
        print()

    print(f"  Grid dimensions detectados:")
    for s in all_stats:
        if s["status"] == "ok":
            persp = "perspective corrected" if s["perspective_corrected"] else "no perspective change"
            print(f"    {s['photo']:30s} {s['rows']:3d}x{s['cols']:<3d}  ({s['cells_valid']:4d} cells, {s['processing_time_s']:.1f}s, {persp})")
        else:
            print(f"    {s['photo']:30s} ERROR: {s['error']}")

    print()
    print(f"  Tempo total:             {total_time:.1f}s")
    print("=" * 60)


# ─── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Batch extract cells from cryptogram photos")
    parser.add_argument("--samples-dir", type=Path, default=DEFAULT_SAMPLES_DIR,
                        help="Directory containing sample photos (default: samples/)")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR,
                        help="Output directory for extracted cells (default: real_cells/)")
    args = parser.parse_args()

    samples_dir: Path = args.samples_dir
    output_dir: Path = args.output_dir

    if not samples_dir.is_dir():
        print(f"Error: samples directory not found: {samples_dir}")
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    # Coletar todas as fotos
    image_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".tiff"}
    photo_paths = sorted([
        p for p in samples_dir.iterdir()
        if p.suffix.lower() in image_extensions
    ])

    if not photo_paths:
        print(f"No images found in {samples_dir}")
        sys.exit(1)

    print(f"Found {len(photo_paths)} photos in {samples_dir}")
    print(f"Output directory: {output_dir}")
    print(f"Cell margin: {CELL_MARGIN}px")
    print(f"Validation: brightness=[{MIN_BRIGHTNESS},{MAX_BRIGHTNESS}], "
          f"laplacian_var>{MIN_LAPLACIAN_VAR}, std>{MIN_STD}")
    print()

    # Processar cada foto
    all_stats = []
    for i, photo_path in enumerate(photo_paths, 1):
        print(f"[{i}/{len(photo_paths)}] Processing {photo_path.name}...")
        stats = process_photo(photo_path, output_dir)
        all_stats.append(stats)

        status_icon = "OK" if stats["status"] == "ok" else "ERR"
        if stats["status"] == "ok":
            print(f"  -> {status_icon}: {stats['rows']}x{stats['cols']} grid, "
                  f"{stats['cells_valid']}/{stats['cells_total']} cells valid "
                  f"({stats['processing_time_s']:.1f}s)")
        else:
            print(f"  -> {status_icon}: {stats['error']}")

    # Salvar relatório JSON
    report_path = output_dir / "_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(all_stats, f, indent=2, ensure_ascii=False)
    print(f"\nReport saved to {report_path}")

    # Imprimir relatório consolidado
    print_report(all_stats)


if __name__ == "__main__":
    main()
