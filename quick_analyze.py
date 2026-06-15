"""
Quick analysis script to check for mismatches in the existing report.
Run inside the Docker container.
"""

import json
from pathlib import Path
from collections import Counter
import cv2

report_path = Path('/app/pseudo_labeled/_report.json')
with open(report_path, 'r') as f:
    report = json.load(f)

print(f'Total entries: {len(report)}')

# Check for mismatches: rawDigits length vs number
print('\n=== Checking rawDigits vs number consistency ===')

mismatches = []
for r in report:
    if r.get('status') != 'ok':
        continue
    
    number = r.get('number')
    raw_digits = r.get('rawDigits', '')
    raw_text = r.get('rawText', '')
    tier = r.get('tier')
    cell_rel = r.get('cell', '')
    
    if number is None:
        continue
    
    expected_digits = len(str(number))
    actual_digits = len(raw_digits)
    
    if expected_digits != actual_digits:
        mismatches.append({
            'cell': cell_rel,
            'number': number,
            'tier': tier,
            'raw_text': raw_text,
            'raw_digits': raw_digits,
            'expected_digits': expected_digits,
            'actual_digits': actual_digits,
        })

print(f'Total mismatches found: {len(mismatches)}')

if mismatches:
    print('\nSample mismatches:')
    for m in mismatches[:20]:
        print(f"  {m['cell']}: classified as {m['number']}, rawDigits='{m['raw_digits']}', "
              f"expected {m['expected_digits']} digits, got {m['actual_digits']}")

# Check inverse case: 1-digit number but rawText has 2+ chars
print('\n=== Checking inverse case (1-digit classified but rawText suggests 2-digits) ===')

inverse_mismatches = []
for r in report:
    if r.get('status') != 'ok':
        continue
    
    number = r.get('number')
    raw_text = r.get('rawText', '')
    raw_digits = r.get('rawDigits', '')
    tier = r.get('tier')
    cell_rel = r.get('cell', '')
    
    if number is None or number >= 10:
        continue
    
    # Number is 1-9, but rawText might have 2+ characters
    if len(raw_text.strip()) >= 2 and len(raw_digits) == 1:
        inverse_mismatches.append({
            'cell': cell_rel,
            'number': number,
            'tier': tier,
            'raw_text': raw_text,
            'raw_digits': raw_digits,
        })

print(f'Total inverse mismatches: {len(inverse_mismatches)}')

if inverse_mismatches:
    print('\nSample inverse mismatches:')
    for m in inverse_mismatches[:20]:
        print(f"  {m['cell']}: classified as {m['number']}, rawText='{m['raw_text']}', "
              f"rawDigits='{m['raw_digits']}'")

# Summary by number
print('\n=== Summary by classified number ===')
number_dist = Counter()
for r in report:
    if r.get('status') == 'ok' and r.get('number') is not None:
        number_dist[r['number']] += 1

for num in sorted(number_dist.keys()):
    print(f'  {num}: {number_dist[num]} cells')

# Summary of mismatches by number
print('\n=== Mismatches by classified number ===')
mismatch_by_number = Counter(m['number'] for m in mismatches)
for num in sorted(mismatch_by_number.keys()):
    print(f'  {num}: {mismatch_by_number[num]} mismatches')

print('\n=== Inverse mismatches by classified number ===')
inverse_by_number = Counter(m['number'] for m in inverse_mismatches)
for num in sorted(inverse_by_number.keys()):
    print(f'  {num}: {inverse_by_number[num]} mismatches')
