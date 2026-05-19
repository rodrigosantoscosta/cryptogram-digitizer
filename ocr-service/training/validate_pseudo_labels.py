"""
Validate Pseudo Labels — Pós-processamento

Analisa células já geradas em pseudo_labeled/ para identificar e isolar
mismatches (ex: "10" classificado como "1").

Pipeline:
  1. Lê _report.json para identificar células problemáticas
  2. Para cada célula suspeita:
     - Verifica rawText length vs número classificado
     - Verifica aspect ratio da célula original
  3. Move células suspeitas para quarantine/
  4. Gera relatório CSV com ações tomadas

Uso:
  python validate_pseudo_labels.py [--pseudo-dir PATH] [--real-cells-dir PATH]
"""

from __future__ import annotations

import argparse
import csv
import json
import shutil
import sys
from pathlib import Path

import cv2
import numpy as np

DEFAULT_PSEUDO_DIR = Path('/app/pseudo_labeled')
DEFAULT_REAL_CELLS_DIR = Path('/app/real_cells')


def validate_cell_consistency(
    cell_path: Path,
    recognized_number: int,
    raw_text: str,
    raw_digits: str,
) -> tuple[bool, str]:
    """
    Valida se uma célula é consistente com seu label.
    
    Returns:
        (is_valid, reason)
    """
    img = cv2.imread(str(cell_path))
    if img is None:
        return False, "cv2.imread_failed"
    
    h, w = img.shape[:2]
    ar = w / h
    
    # Se temos raw_digits, validar consistência de contagem
    if raw_digits:
        expected_digits = len(str(recognized_number))
        actual_digits = len(raw_digits)
        
        if actual_digits != expected_digits:
            return False, f"digit_count_mismatch(expected={expected_digits}, got={actual_digits})"
    
    # Validação por aspect ratio
    if recognized_number < 10:
        # Células com 1 dígito tendem a ser mais estreitas
        if ar > 1.3:
            return False, f"aspect_ratio_mismatch(AR={ar:.2f} too wide for 1-digit)"
    else:
        # Células com 2 dígitos tendem a ser mais largas
        if ar < 0.85:
            return False, f"aspect_ratio_mismatch(AR={ar:.2f} too narrow for 2-digits)"
    
    return True, ""


def process_report(
    report_path: Path,
    real_cells_dir: Path,
    quarantine_dir: Path,
    pseudo_dir: Path,
) -> list[dict]:
    """
    Processa o relatório e move células suspeitas para quarantine.
    
    Returns:
        Lista de ações tomadas
    """
    with open(report_path, 'r') as f:
        report = json.load(f)
    
    actions = []
    
    for entry in report:
        if entry.get('status') != 'ok':
            continue
        
        number = entry.get('number')
        tier = entry.get('tier')
        raw_text = entry.get('rawText', '')
        raw_digits = entry.get('rawDigits', '')
        cell_rel = entry.get('cell', '')
        
        if number is None or tier is None:
            continue
        
        # Encontrar células aumentadas correspondentes
        digit_dir = pseudo_dir / tier / str(number)
        if not digit_dir.exists():
            continue
        
        # Encontrar célula original
        original_path = real_cells_dir / cell_rel
        if not original_path.exists():
            continue
        
        # Validar consistência
        is_valid, reason = validate_cell_consistency(
            original_path, number, raw_text, raw_digits
        )
        
        if not is_valid:
            # Nota: Não podemos mover os arquivos aumentados porque não há mapeamento
            # direto entre células originais e arquivos aumentados.
            # Os arquivos aumentados são nomeados sequencialmente (cell_0000.png, etc.)
            # sem referência à célula original.
            # 
            # Recomendação: Re-rodar generate_pseudo_labels.py com as correções
            # para regenerar o dataset limpo.
            
            actions.append({
                'original_cell': cell_rel,
                'classified_as': number,
                'tier': tier,
                'raw_text': raw_text,
                'raw_digits': raw_digits,
                'reason': reason,
                'augmented_files_moved': 0,
                'quarantine_path': str(quarantine_subdir),
                'note': 'Cannot map to augmented files - re-run pipeline to fix',
            })
    
    return actions


def print_report(actions: list[dict]) -> None:
    """Imprime relatório consolidado."""
    if not actions:
        print("\n" + "=" * 60)
        print("  VALIDATION REPORT")
        print("=" * 60)
        print("  No mismatches detected!")
        print("=" * 60)
        return
    
    print("\n" + "=" * 60)
    print("  VALIDATION REPORT")
    print("=" * 60)
    print(f"  Total mismatches found: {len(actions)}")
    print()
    
    # Agrupar por número classificado
    from collections import Counter
    by_number = Counter(a['classified_as'] for a in actions)
    
    print("  Mismatches by classified number:")
    for num in sorted(by_number.keys()):
        print(f"    {num}: {by_number[num]} cells")
    print()
    
    # Agrupar por razão
    by_reason = Counter(a['reason'].split('(')[0] for a in actions)
    
    print("  Mismatches by reason:")
    for reason, count in sorted(by_reason.items(), key=lambda x: -x[1]):
        print(f"    {reason:40s} {count:5d}")
    print()
    
    print("  Detailed actions:")
    print(f"    {'Original Cell':<30} {'Classified':<10} {'Reason':<40} {'Moved':<6}")
    print(f"    {'-'*30} {'-'*10} {'-'*40} {'-'*6}")
    for a in actions:
        print(f"    {a['original_cell']:<30} {a['classified_as']:<10} {a['reason']:<40} {a['augmented_files_moved']:<6}")
    
    print()
    print("=" * 60)


def save_csv_report(actions: list[dict], output_path: Path) -> None:
    """Salva relatório em CSV."""
    if not actions:
        return
    
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'original_cell', 'classified_as', 'tier', 'raw_text', 'raw_digits',
            'reason', 'augmented_files_moved', 'quarantine_path'
        ])
        writer.writeheader()
        writer.writerows(actions)
    
    print(f"\nCSV report saved to {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate pseudo-labeled cells for mismatches")
    parser.add_argument("--pseudo-dir", type=Path, default=DEFAULT_PSEUDO_DIR,
                        help="Directory containing pseudo_labeled data")
    parser.add_argument("--real-cells-dir", type=Path, default=DEFAULT_REAL_CELLS_DIR,
                        help="Directory containing original real_cells")
    args = parser.parse_args()
    
    pseudo_dir: Path = args.pseudo_dir
    real_cells_dir: Path = args.real_cells_dir
    
    report_path = pseudo_dir / "_report.json"
    if not report_path.exists():
        print(f"Error: report not found at {report_path}")
        print("Run generate_pseudo_labels.py first!")
        sys.exit(1)
    
    quarantine_dir = pseudo_dir / "quarantine"
    quarantine_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"Validating cells from {pseudo_dir}")
    print(f"Original cells from {real_cells_dir}")
    print(f"Quarantine directory: {quarantine_dir}")
    print()
    
    actions = process_report(report_path, real_cells_dir, quarantine_dir, pseudo_dir)
    
    print_report(actions)
    
    csv_path = quarantine_dir / "validation_report.csv"
    save_csv_report(actions, csv_path)


if __name__ == "__main__":
    main()
