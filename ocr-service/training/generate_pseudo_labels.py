"""
Generate Pseudo Labels — Fase 3

Processa células extraídas (real_cells/) com EasyOCR, filtra por confiança,
aplica augmentações e salva em pseudo_labeled/ para treinamento.

Pipeline:
  real_cells/{foto}/cell_r{X}_c{Y}.png
    → Multi-strategy preprocessing (3 estratégias)
    → EasyOCR.readtext() → melhor resultado
    → sanitize_number() → número válido (1-27)
    → Filtro por confiança:
        ≥ 0.95 → pseudo_labeled/high/{digit}/ (10 variações)
        0.80-0.94 → pseudo_labeled/med/{digit}/ (5 variações)
        < 0.80 → rejeitado

Uso:
  python generate_pseudo_labels.py [--input-dir PATH] [--output-dir PATH]
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
from pathlib import Path

import cv2
import numpy as np

# Adicionar diretório pai ao path
sys.path.insert(0, str(Path(__file__).parent))


# ─── Configuração ──────────────────────────────────────────────────────────────

CONF_HIGH_MIN = 0.95
CONF_MED_MIN = 0.80
AUGMENT_HIGH = 10
AUGMENT_MED = 5

DEFAULT_INPUT_DIR = Path(__file__).parent.parent.parent / "real_cells"
DEFAULT_OUTPUT_DIR = Path(__file__).parent.parent.parent / "pseudo_labeled"

# ─── EasyOCR Reader (lazy init) ───────────────────────────────────────────────

_reader = None


def get_reader() -> "easyocr.Reader":
    """Inicializa EasyOCR reader com modelo português (lazy)."""
    global _reader
    if _reader is None:
        import easyocr
        print("[PseudoLabel] Loading EasyOCR reader (portuguese_g2)...")
        t0 = time.time()
        _reader = easyocr.Reader(['pt'], gpu=False, verbose=False, download_enabled=True)
        elapsed = time.time() - t0
        print(f"[PseudoLabel] EasyOCR loaded in {elapsed:.1f}s")
    return _reader


# ─── Multi-Strategy Preprocessing (replica ocr_engine.py) ──────────────────────

def preprocess_binary_otsu(image: np.ndarray) -> np.ndarray:
    """Strategy 1: Binary + Otsu threshold."""
    gray = image if image.ndim == 2 else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    edge_pixels = np.concatenate([binary[0, :], binary[-1, :], binary[:, 0], binary[:, -1]])
    if np.mean(edge_pixels) > 128:
        binary = cv2.bitwise_not(binary)
    return _finalize_image(binary)


def preprocess_clahe_grayscale(image: np.ndarray) -> np.ndarray:
    """Strategy 2: CLAHE contrast enhancement + grayscale."""
    gray = image if image.ndim == 2 else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    return _finalize_image(enhanced)


def preprocess_adaptive_denoise(image: np.ndarray) -> np.ndarray:
    """Strategy 3: Adaptive threshold + aggressive denoising."""
    gray = image if image.ndim == 2 else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    denoised = cv2.fastNlMeansDenoising(gray, h=10, templateWindowSize=7, searchWindowSize=21)
    adaptive = cv2.adaptiveThreshold(
        denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 11, 2
    )
    edge_pixels = np.concatenate([adaptive[0, :], adaptive[-1, :], adaptive[:, 0], adaptive[:, -1]])
    if np.mean(edge_pixels) > 128:
        adaptive = cv2.bitwise_not(adaptive)
    return _finalize_image(adaptive)


def _finalize_image(img: np.ndarray) -> np.ndarray:
    """Common finalization: upscale, padding, convert to RGB."""
    target_height = 128
    aspect_ratio = img.shape[1] / img.shape[0]
    target_width = max(int(target_height * aspect_ratio), 64)

    resized = cv2.resize(img, (target_width, target_height), interpolation=cv2.INTER_LANCZOS4)

    pad_y = int(target_height * 0.3)
    pad_x = int(target_width * 0.3)

    padded = cv2.copyMakeBorder(
        resized, pad_y, pad_y, pad_x, pad_x,
        cv2.BORDER_CONSTANT, value=0
    )

    return cv2.cvtColor(padded, cv2.COLOR_GRAY2RGB)


def get_strategies() -> list[tuple[str, callable]]:
    """Returns list of (name, preprocess_fn) tuples."""
    return [
        ("binary_otsu", preprocess_binary_otsu),
        ("clahe_grayscale", preprocess_clahe_grayscale),
        ("adaptive_denoise", preprocess_adaptive_denoise),
    ]


# ─── OCR Recognition ───────────────────────────────────────────────────────────

def sanitize_number(text: str) -> int | None:
    """
    Sanitiza texto extraído para extrair apenas números válidos (1-27).
    """
    import re
    cleaned = re.sub(r'[^0-9]', '', text)
    if not cleaned:
        return None
    if len(cleaned) > 2:
        cleaned = cleaned[:2]
    try:
        number = int(cleaned)
    except ValueError:
        return None
    if number < 1 or number > 27:
        if len(cleaned) == 2:
            first = int(cleaned[0])
            if 1 <= first <= 27:
                return first
            second = int(cleaned[1])
            if 1 <= second <= 27:
                return second
        return None
    return number


def recognize_cell(image: np.ndarray) -> dict:
    """
    Reconhece número em uma célula usando multi-strategy preprocessing.
    Retorna {number, confidence, rawText, strategy}.
    """
    reader = get_reader()
    best_result = {
        "number": None,
        "confidence": 0.0,
        "rawText": "",
        "strategy": ""
    }

    for strategy_name, preprocess_fn in get_strategies():
        try:
            processed = preprocess_fn(image)
            results = reader.readtext(
                processed,
                detail=1,
                paragraph=False,
                contrast_ths=0.10,
                text_threshold=0.7,
                low_text=0.4,
            )

            if results:
                best = max(results, key=lambda x: x[2])
                text, confidence = best[1], best[2]
                number = sanitize_number(text)

                if number is not None and confidence > best_result["confidence"]:
                    best_result = {
                        "number": number,
                        "confidence": float(confidence),
                        "rawText": text,
                        "strategy": strategy_name,
                    }

        except Exception as e:
            print(f"  [WARN] Strategy {strategy_name} failed: {e}")

    return best_result


# ─── Augmentações ──────────────────────────────────────────────────────────────

def augment_cell(image: np.ndarray, rng: random.Random) -> np.ndarray:
    """
    Aplica uma combinação aleatória de augmentações a uma célula.

    Augmentações:
      - Rotação: -3° a +3°
      - Brilho: 0.8× a 1.2×
      - Contraste: 0.8× a 1.2×
      - Gaussian blur: σ=0.5 ou σ=1.0
      - Salt & pepper noise: 1% ou 2%
    """
    result = image.copy()

    # Rotação
    angle = rng.uniform(-3, 3)
    if abs(angle) > 0.5:
        h, w = result.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        result = cv2.warpAffine(result, M, (w, h),
                                borderMode=cv2.BORDER_CONSTANT,
                                borderValue=255 if result.ndim == 2 else (255, 255, 255))

    # Brilho
    brightness = rng.uniform(0.8, 1.2)
    if abs(brightness - 1.0) > 0.05:
        if result.ndim == 2:
            result = np.clip(result.astype(np.float64) * brightness, 0, 255).astype(np.uint8)
        else:
            result = np.clip(result.astype(np.float64) * brightness, 0, 255).astype(np.uint8)

    # Contraste
    contrast = rng.uniform(0.8, 1.2)
    if abs(contrast - 1.0) > 0.05:
        mean_val = result.mean()
        if result.ndim == 2:
            result = np.clip(mean_val + (result.astype(np.float64) - mean_val) * contrast, 0, 255).astype(np.uint8)
        else:
            result = np.clip(mean_val + (result.astype(np.float64) - mean_val) * contrast, 0, 255).astype(np.uint8)

    # Gaussian blur
    if rng.random() > 0.5:
        sigma = rng.choice([0.5, 1.0])
        ksize = max(3, int(sigma * 6) | 1)
        if result.ndim == 2:
            result = cv2.GaussianBlur(result, (ksize, ksize), sigma)
        else:
            result = cv2.GaussianBlur(result, (ksize, ksize), sigma)

    # Salt & pepper noise
    if rng.random() > 0.5:
        noise_pct = rng.choice([0.01, 0.02])
        h, w = result.shape[:2]
        num_noisy = int(h * w * noise_pct)
        if result.ndim == 2:
            coords = [rng.randint(0, h - 1) for _ in range(num_noisy)], \
                     [rng.randint(0, w - 1) for _ in range(num_noisy)]
            for i in range(num_noisy):
                result[coords[0][i], coords[1][i]] = rng.choice([0, 255])
        else:
            for _ in range(num_noisy):
                y, x = rng.randint(0, h - 1), rng.randint(0, w - 1)
                result[y, x] = [0, 0, 0] if rng.random() > 0.5 else [255, 255, 255]

    return result


# ─── Processamento ────────────────────────────────────────────────────────────

def process_cell(
    cell_path: Path,
    output_dir: Path,
    rng: random.Random,
) -> dict:
    """
    Processa uma única célula: OCR → filtro → augmentação → salvar.

    Returns:
        Dict com métricas do processamento.
    """
    stats = {
        "cell": str(cell_path.relative_to(cell_path.parent.parent)),
        "status": "ok",
        "error": None,
        "number": None,
        "confidence": 0.0,
        "rawText": "",
        "strategy": "",
        "tier": None,
        "augmentations": 0,
    }

    try:
        image = cv2.imread(str(cell_path))
        if image is None:
            stats["status"] = "error"
            stats["error"] = "cv2.imread failed"
            return stats

        # OCR
        result = recognize_cell(image)

        if result["number"] is None:
            stats["status"] = "rejected"
            stats["error"] = "no_valid_number"
            return stats

        stats["number"] = result["number"]
        stats["confidence"] = result["confidence"]
        stats["rawText"] = result["rawText"]
        stats["strategy"] = result["strategy"]

        # Filtro por confiança
        conf = result["confidence"]
        if conf >= CONF_HIGH_MIN:
            tier = "high"
            n_aug = AUGMENT_HIGH
        elif conf >= CONF_MED_MIN:
            tier = "med"
            n_aug = AUGMENT_MED
        else:
            stats["status"] = "rejected"
            stats["error"] = f"confidence_too_low({conf:.3f})"
            return stats

        stats["tier"] = tier
        stats["augmentations"] = n_aug

        # Salvar augmentações
        digit_dir = output_dir / tier / str(result["number"])
        digit_dir.mkdir(parents=True, exist_ok=True)

        # Contar arquivos existentes para numerar
        existing = len(list(digit_dir.glob("cell_*.png")))

        for i in range(n_aug):
            augmented = augment_cell(image, rng)
            filename = f"cell_{existing + i:04d}.png"
            cv2.imwrite(str(digit_dir / filename), augmented)

    except Exception as e:
        stats["status"] = "error"
        stats["error"] = str(e)

    return stats


# ─── Relatório ─────────────────────────────────────────────────────────────────

def print_report(all_stats: list[dict], total_time: float) -> None:
    """Imprime relatório consolidado."""
    total = len(all_stats)
    accepted = sum(1 for s in all_stats if s["status"] == "ok")
    rejected = sum(1 for s in all_stats if s["status"] == "rejected")
    errors = sum(1 for s in all_stats if s["status"] == "error")

    high_count = sum(1 for s in all_stats if s["tier"] == "high")
    med_count = sum(1 for s in all_stats if s["tier"] == "med")

    total_augmentations = sum(s["augmentations"] for s in all_stats)

    # Distribuição por dígito
    digit_dist: dict[int, dict[str, int]] = {}
    for s in all_stats:
        if s["number"] is not None:
            d = s["number"]
            if d not in digit_dist:
                digit_dist[d] = {"high": 0, "med": 0, "total": 0}
            digit_dist[d]["total"] += 1
            if s["tier"] == "high":
                digit_dist[d]["high"] += 1
            elif s["tier"] == "med":
                digit_dist[d]["med"] += 1

    # Razões de rejeição
    rejection_reasons: dict[str, int] = {}
    for s in all_stats:
        if s["status"] == "rejected" and s["error"]:
            reason = s["error"].split("(")[0]
            rejection_reasons[reason] = rejection_reasons.get(reason, 0) + 1

    print("\n" + "=" * 60)
    print("  PSEUDO-LABELING REPORT")
    print("=" * 60)
    print(f"  Células processadas:     {total}")
    print(f"    Aceitas:               {accepted}")
    print(f"    Rejeitadas:            {rejected}")
    print(f"    Erros:                 {errors}")
    print()
    print(f"  Por tier de confiança:")
    print(f"    High (≥{CONF_HIGH_MIN:.2f}):          {high_count} células → {high_count * AUGMENT_HIGH} augmentações")
    print(f"    Med  ({CONF_MED_MIN:.2f}-{CONF_HIGH_MIN:.2f}):       {med_count} células → {med_count * AUGMENT_MED} augmentações")
    print(f"    Total augmentações:    {total_augmentations}")
    print()

    if rejection_reasons:
        print(f"  Rejeições por critério:")
        for reason, count in sorted(rejection_reasons.items(), key=lambda x: -x[1]):
            print(f"    {reason:30s} {count:5d}")
        print()

    print(f"  Distribuição por dígito:")
    print(f"    {'Dígito':<8} {'High':<8} {'Med':<8} {'Total':<8}")
    print(f"    {'-'*8} {'-'*8} {'-'*8} {'-'*8}")
    for d in sorted(digit_dist.keys()):
        info = digit_dist[d]
        print(f"    {d:<8} {info['high']:<8} {info['med']:<8} {info['total']:<8}")

    print()
    print(f"  Tempo total:             {total_time:.1f}s")
    print("=" * 60)


# ─── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate pseudo-labels from extracted cells")
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_INPUT_DIR,
                        help="Directory containing real_cells (default: real_cells/)")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR,
                        help="Output directory for pseudo-labeled data (default: pseudo_labeled/)")
    parser.add_argument("--seed", type=int, default=42,
                        help="Random seed for augmentations (default: 42)")
    args = parser.parse_args()

    input_dir: Path = args.input_dir
    output_dir: Path = args.output_dir
    rng = random.Random(args.seed)

    if not input_dir.is_dir():
        print(f"Error: input directory not found: {input_dir}")
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    # Coletar todas as células
    cell_paths = sorted(input_dir.rglob("cell_r*_c*.png"))

    if not cell_paths:
        print(f"No cells found in {input_dir}")
        print("Run batch_extract_cells.py first!")
        sys.exit(1)

    print(f"Found {len(cell_paths)} cells in {input_dir}")
    print(f"Output directory: {output_dir}")
    print(f"Confidence filters: high≥{CONF_HIGH_MIN}, med≥{CONF_MED_MIN}")
    print(f"Augmentations: high={AUGMENT_HIGH}, med={AUGMENT_MED}")
    print()

    # Processar cada célula
    all_stats = []
    t0 = time.time()

    for i, cell_path in enumerate(cell_paths, 1):
        if i % 50 == 0 or i == 1:
            print(f"[{i}/{len(cell_paths)}] Processing...")

        stats = process_cell(cell_path, output_dir, rng)
        all_stats.append(stats)

    total_time = time.time() - t0

    # Salvar relatório JSON
    report_path = output_dir / "_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(all_stats, f, indent=2, ensure_ascii=False)
    print(f"\nReport saved to {report_path}")

    # Imprimir relatório consolidado
    print_report(all_stats, total_time)


if __name__ == "__main__":
    main()
