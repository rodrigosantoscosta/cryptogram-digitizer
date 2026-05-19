"""
Hybrid Dataset Builder — Fase 4

Combina células reais augmentadas (pseudo_labeled/) com dados sintéticos
(train_data/) em um dataset unificado para treinamento do EasyOCR.

Pipeline:
  1. Carregar células reais (high + med)
  2. Carregar dados sintéticos existentes
  3. Combinar em dataset unificado
  4. Split estratificado: 80% treino, 20% validação
  5. Gerar formato EasyOCR: all_data/train/ + gt.txt, all_data/val/ + gt.txt
  6. Relatório estatístico

Uso:
  python hybrid_dataset.py [--pseudo-dir PATH] [--synthetic-dir PATH] [--output-dir PATH]
"""

from __future__ import annotations

import argparse
import json
import random
import shutil
import sys
import time
from collections import defaultdict
from pathlib import Path

# ── Configuração ──────────────────────────────────────────────────────────────

TRAIN_SPLIT = 0.80
RANDOM_SEED = 42

DEFAULT_PSEUDO_DIR = Path(__file__).parent.parent.parent / "pseudo_labeled"
DEFAULT_SYNTHETIC_DIR = Path(__file__).parent / "train_data"
DEFAULT_OUTPUT_DIR = Path(__file__).parent / "all_data"

# ─── Helpers ───────────────────────────────────────────────────────────────────

def load_real_cells(pseudo_dir: Path) -> list[tuple[Path, int, str]]:
    """
    Carrega todas as células reais de pseudo_labeled/.

    Returns:
        Lista de (caminho_imagem, dígito, tier)
    """
    cells = []
    for tier in ["high", "med"]:
        tier_dir = pseudo_dir / tier
        if not tier_dir.is_dir():
            print(f"[WARN] Tier directory not found: {tier_dir}")
            continue

        for digit_dir in sorted(tier_dir.iterdir()):
            if not digit_dir.is_dir():
                continue
            try:
                digit = int(digit_dir.name)
            except ValueError:
                continue

            for img_path in sorted(digit_dir.glob("*.png")):
                cells.append((img_path, digit, tier))

    return cells


def load_synthetic_data(synthetic_dir: Path) -> list[tuple[Path, int]]:
    """
    Carrega dados sintéticos existentes de train_data/.

    Returns:
        Lista de (caminho_imagem, dígito)
    """
    cells = []
    gt_path = synthetic_dir / "gt.txt"

    if not gt_path.exists():
        print(f"[WARN] Ground truth file not found: {gt_path}")
        return cells

    with open(gt_path, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f if line.strip()]

    for line in lines:
        parts = line.split(",")
        if len(parts) != 2:
            continue
        filename, label = parts
        try:
            digit = int(label)
        except ValueError:
            continue

        img_path = synthetic_dir / filename
        if img_path.exists():
            cells.append((img_path, digit))

    return cells


def stratified_split(
    cells: list[tuple[Path, int, str]],
    train_ratio: float = TRAIN_SPLIT,
    seed: int = RANDOM_SEED,
) -> tuple[list[tuple[Path, int, str]], list[tuple[Path, int, str]]]:
    """
    Split estratificado por dígito.

    Garante que cada dígito tenha representação proporcional em train e val.
    """
    rng = random.Random(seed)

    # Agrupar por dígito
    by_digit: dict[int, list[tuple[Path, int, str]]] = defaultdict(list)
    for cell in cells:
        by_digit[cell[1]].append(cell)

    train_cells = []
    val_cells = []

    for digit in sorted(by_digit.keys()):
        group = by_digit[digit]
        rng.shuffle(group)

        split_idx = max(1, int(len(group) * train_ratio))
        # Garantir pelo menos 1 amostra em val se houver >= 2
        if len(group) >= 2 and split_idx == len(group):
            split_idx = len(group) - 1

        train_cells.extend(group[:split_idx])
        val_cells.extend(group[split_idx:])

    return train_cells, val_cells


def copy_and_write_gt(
    cells: list[tuple[Path, int, str]],
    output_dir: Path,
    prefix: str = "",
) -> list[str]:
    """
    Copia imagens para output_dir e gera gt.txt.

    Returns:
        Lista de linhas do gt.txt
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    gt_lines = []

    for i, (img_path, digit, tier) in enumerate(cells):
        # Nome único: prefix + índice + dígito
        filename = f"{prefix}{i:05d}_d{digit}.png"
        dst = output_dir / filename

        # Copiar imagem
        shutil.copy2(img_path, dst)

        # Adicionar ao ground truth
        gt_lines.append(f"{filename},{digit}")

    # Escrever gt.txt
    gt_path = output_dir / "gt.txt"
    with open(gt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(gt_lines))

    return gt_lines


# ─── Relatório ─────────────────────────────────────────────────────────────────

def print_report(
    real_stats: dict,
    synthetic_stats: dict,
    combined_stats: dict,
    total_time: float,
) -> None:
    """Imprime relatório consolidado."""
    print("\n" + "=" * 60)
    print("  HYBRID DATASET REPORT")
    print("=" * 60)

    print(f"\n  Células reais (pseudo_labeled):")
    print(f"    Total:                 {real_stats['total']}")
    print(f"    High tier:             {real_stats['high']}")
    print(f"    Med tier:              {real_stats['med']}")
    print(f"    Dígitos únicos:        {len(real_stats['by_digit'])}")

    print(f"\n  Dados sintéticos (train_data):")
    print(f"    Total:                 {synthetic_stats['total']}")
    print(f"    Dígitos únicos:        {len(synthetic_stats['by_digit'])}")

    print(f"\n  Dataset combinado:")
    print(f"    Total:                 {combined_stats['total']}")
    print(f"    Treino ({TRAIN_SPLIT*100:.0f}%):           {combined_stats['train']}")
    print(f"    Validação ({(1-TRAIN_SPLIT)*100:.0f}%):         {combined_stats['val']}")

    print(f"\n  Distribuição por dígito (combinado):")
    print(f"    {'Dígito':<8} {'Real':<8} {'Sintético':<12} {'Total':<8} {'Train':<8} {'Val':<8}")
    print(f"    {'-'*8} {'-'*8} {'-'*12} {'-'*8} {'-'*8} {'-'*8}")

    all_digits = sorted(
        set(real_stats["by_digit"].keys()) | set(synthetic_stats["by_digit"].keys())
    )
    for d in all_digits:
        real_count = real_stats["by_digit"].get(d, 0)
        synth_count = synthetic_stats["by_digit"].get(d, 0)
        total_count = real_count + synth_count
        train_count = combined_stats["by_digit_train"].get(d, 0)
        val_count = combined_stats["by_digit_val"].get(d, 0)
        print(f"    {d:<8} {real_count:<8} {synth_count:<12} {total_count:<8} {train_count:<8} {val_count:<8}")

    print(f"\n  Tempo total:             {total_time:.1f}s")
    print("=" * 60)


# ─── Main ───────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Build hybrid dataset for EasyOCR training")
    parser.add_argument("--pseudo-dir", type=Path, default=DEFAULT_PSEUDO_DIR,
                        help="Directory containing pseudo_labeled data (default: pseudo_labeled/)")
    parser.add_argument("--synthetic-dir", type=Path, default=DEFAULT_SYNTHETIC_DIR,
                        help="Directory containing synthetic training data (default: training/train_data/)")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR,
                        help="Output directory for combined dataset (default: training/all_data/)")
    parser.add_argument("--seed", type=int, default=RANDOM_SEED,
                        help="Random seed for stratified split (default: 42)")
    args = parser.parse_args()

    pseudo_dir: Path = args.pseudo_dir
    synthetic_dir: Path = args.synthetic_dir
    output_dir: Path = args.output_dir
    rng_seed = args.seed

    t0 = time.time()

    # 1. Carregar células reais
    print(f"[1/4] Loading real cells from {pseudo_dir}...")
    real_cells = load_real_cells(pseudo_dir)
    if not real_cells:
        print(f"Error: No real cells found in {pseudo_dir}")
        print("Run generate_pseudo_labels.py first!")
        sys.exit(1)
    print(f"  Found {len(real_cells)} real cells")

    real_stats = {
        "total": len(real_cells),
        "high": sum(1 for _, _, t in real_cells if t == "high"),
        "med": sum(1 for _, _, t in real_cells if t == "med"),
        "by_digit": defaultdict(int),
    }
    for _, digit, _ in real_cells:
        real_stats["by_digit"][digit] += 1

    # 2. Carregar dados sintéticos
    print(f"[2/4] Loading synthetic data from {synthetic_dir}...")
    synthetic_cells = load_synthetic_data(synthetic_dir)
    print(f"  Found {len(synthetic_cells)} synthetic cells")

    synthetic_stats = {
        "total": len(synthetic_cells),
        "by_digit": defaultdict(int),
    }
    for _, digit in synthetic_cells:
        synthetic_stats["by_digit"][digit] += 1

    # 3. Combinar datasets
    print("[3/4] Combining datasets...")
    # Converter sintéticos para formato unificado (tier="synthetic")
    synthetic_unified = [(path, digit, "synthetic") for path, digit in synthetic_cells]
    combined = real_cells + synthetic_unified

    print(f"  Combined total: {len(combined)} cells")

    # Split estratificado
    train_cells, val_cells = stratified_split(combined, TRAIN_SPLIT, rng_seed)
    print(f"  Train: {len(train_cells)}, Val: {len(val_cells)}")

    # 4. Gerar output
    print(f"[4/4] Writing dataset to {output_dir}...")

    # Limpar output anterior se existir (handle mounted volumes)
    if output_dir.exists():
        try:
            shutil.rmtree(output_dir)
        except OSError:
            # Mounted volume - clean contents instead
            for item in output_dir.iterdir():
                if item.is_dir():
                    shutil.rmtree(item, ignore_errors=True)
                else:
                    item.unlink()

    train_dir = output_dir / "train"
    val_dir = output_dir / "val"

    train_lines = copy_and_write_gt(train_cells, train_dir, prefix="train_")
    val_lines = copy_and_write_gt(val_cells, val_dir, prefix="val_")

    # Estatísticas do split
    combined_stats = {
        "total": len(combined),
        "train": len(train_cells),
        "val": len(val_cells),
        "by_digit_train": defaultdict(int),
        "by_digit_val": defaultdict(int),
    }
    for _, digit, _ in train_cells:
        combined_stats["by_digit_train"][digit] += 1
    for _, digit, _ in val_cells:
        combined_stats["by_digit_val"][digit] += 1

    # Converter defaultdicts para dicts normais (para JSON)
    real_stats["by_digit"] = dict(real_stats["by_digit"])
    synthetic_stats["by_digit"] = dict(synthetic_stats["by_digit"])
    combined_stats["by_digit_train"] = dict(combined_stats["by_digit_train"])
    combined_stats["by_digit_val"] = dict(combined_stats["by_digit_val"])

    # Salvar relatório JSON
    report = {
        "real": real_stats,
        "synthetic": synthetic_stats,
        "combined": combined_stats,
        "config": {
            "train_split": TRAIN_SPLIT,
            "seed": rng_seed,
            "pseudo_dir": str(pseudo_dir),
            "synthetic_dir": str(synthetic_dir),
            "output_dir": str(output_dir),
        },
    }

    report_path = output_dir / "_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    total_time = time.time() - t0

    # Imprimir relatório
    print_report(real_stats, synthetic_stats, combined_stats, total_time)

    print(f"\nDataset saved to {output_dir}")
    print(f"  Train: {train_dir} ({len(train_lines)} samples)")
    print(f"  Val:   {val_dir} ({len(val_lines)} samples)")
    print(f"Report: {report_path}")


if __name__ == "__main__":
    main()
