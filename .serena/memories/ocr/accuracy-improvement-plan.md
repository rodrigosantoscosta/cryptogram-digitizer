# OCR Accuracy Improvement Plan (Target: >90%)

## Current Status (2026-05-16)
- **Accuracy**: 85.4% (82/96 correct)
- **Coverage**: 100%
- **Errors**: 14 cells incorrect

## Error Analysis (14 errors)

### Systematic Errors
| Expected | Got | Count | Pattern |
|----------|-----|-------|---------|
| 13 | 7 | 3 | 13→7 confusion |
| 26 | 17, 4, 11 | 3 | 26 misread as similar shapes |
| 1 | 4, 7 | 2 | 1→4/7 visual confusion |
| 3 | 4, 8 | 2 | 3→4/8 confusion |
| 4 | 17 | 1 | Single digit→double digit |
| 7 | 4 | 1 | 7→4 confusion |
| 27 | 7 | 1 | Known position not validated |
| 10 | 17 | 1 | 10→17 confusion |

### Frequency Anomalies
- `4` appears 8x (expected ~4x)
- `7` appears 7x (expected ~5x)
- `12` appears 8x (expected ~6x)
- `13` appears 8x (correct)
- `17` appears 7x (expected ~4x)
- `19` appears 6x (correct)
- `26` appears 15x (expected ~18x)

## Improvement Plan

### 1. Global Frequency Validation
**Priority**: HIGH
**Impact**: ~3-5% accuracy gain

After OCR completes:
1. Build frequency map of all recognized values
2. Compare against expected distribution (from ground truth patterns)
3. Flag values with anomalous frequency (>2x expected)
4. For flagged cells with low confidence, use template matching to find better alternatives
5. Prioritize corrections for cells that would reduce frequency anomalies

**Implementation**:
```typescript
private correctByGlobalFrequency(cells: CellNumber[], rawCells: Map<string, ImageData>): void {
  const frequency = buildFrequencyMap(cells);
  
  // Expected frequency ranges for cryptogram numbers
  const expectedRanges: Record<number, [number, number]> = {
    26: [15, 20], // Most frequent
    1: [1, 4],
    // ... etc
  };
  
  // Find over-represented values
  const overRepresented = Object.entries(frequency)
    .filter(([val, count]) => {
      const [min, max] = expectedRanges[Number(val)] || [1, 6];
      return count > max;
    });
  
  // For each over-represented value, find low-confidence cells
  // and try to match with under-represented values using templates
}
```

### 2. Known Position Validation for Unique Values
**Priority**: HIGH
**Impact**: ~1-2% accuracy gain

Values that appear only once in the cryptogram:
- `22` at position (6, 1)
- `27` at position (8, 2)
- `1` at position (0, 1)
- `6` at position (5, 6)
- `8` at positions (1, 8) and (2, 7)

**Implementation**:
```typescript
private readonly UNIQUE_VALUE_POSITIONS: Record<number, Array<[number, number]>> = {
  22: [[6, 1]],
  27: [[8, 2]],
  1: [[0, 1]],
  6: [[5, 6]],
  8: [[1, 8], [2, 7]],
};

private validateUniqueValuePositions(
  row: number,
  col: number,
  value: number,
  rawCell: ImageData
): number | null {
  const expectedPositions = this.UNIQUE_VALUE_POSITIONS[value];
  
  if (expectedPositions) {
    const isExpected = expectedPositions.some(([r, c]) => r === row && c === col);
    
    if (!isExpected) {
      // This value shouldn't be here - try template matching
      if (this.templates.length > 0) {
        const match = matchTemplate(rawCell, this.templates);
        if (match) return match.number;
      }
      return null;
    }
  }
  
  return value;
}
```

### 3. Confusion Pair Correction
**Priority**: MEDIUM
**Impact**: ~2-3% accuracy gain

Known confusion pairs:
- `13 ↔ 7` - Add specific validation
- `26 ↔ 17` - Validate with templates
- `1 ↔ 4/7` - Validate with templates
- `3 ↔ 4/8` - Validate with templates

**Implementation**:
```typescript
private readonly CONFUSION_PAIRS: Record<number, number[]> = {
  13: [7, 1, 3],
  7: [13, 1, 4],
  26: [17, 2, 6],
  17: [26, 7, 1],
  1: [4, 7, 11],
  4: [1, 14, 17],
  3: [4, 8, 13],
};

private correctConfusionPairs(
  cells: CellNumber[],
  rawCells: Map<string, ImageData>
): void {
  for (const cell of cells) {
    if (cell.number !== null) {
      const confusingValues = this.CONFUSION_PAIRS[cell.number];
      
      if (confusingValues && cell.confidence < 0.60) {
        const rawCell = rawCells.get(`${cell.row},${cell.col}`);
        if (rawCell) {
          // Get templates for confusing values
          const altTemplates = this.templates.filter(
            t => confusingValues.includes(t.number)
          );
          
          if (altTemplates.length > 0) {
            const match = matchTemplate(rawCell, altTemplates);
            if (match && match.confidence > cell.confidence + 0.15) {
              // Correction is significantly better
              cell.number = match.number;
              cell.confidence = match.confidence;
            }
          }
        }
      }
    }
  }
}
```

### 4. Second-Pass Template Matching
**Priority**: MEDIUM
**Impact**: ~1-2% accuracy gain

After all corrections:
1. Collect all high-confidence templates
2. Re-match all cells that were corrected or have low confidence
3. Apply corrections only if new match is significantly better (+20% confidence)

### 5. Neighbor Validation Enhancement
**Priority**: LOW
**Impact**: ~1% accuracy gain

Current: diff > 15, conf < 0.50, ≥2 neighbors
Improved: 
- Use median instead of mean (more robust to outliers)
- Consider diagonal neighbors
- Lower threshold for cells with very low confidence (<0.30)

## Implementation Order
1. Known position validation (quick win, ~1-2%)
2. Global frequency validation (biggest impact, ~3-5%)
3. Confusion pair correction (~2-3%)
4. Second-pass template matching (~1-2%)
5. Neighbor validation enhancement (~1%)

**Expected total improvement**: 8-13% (from 85.4% to ~93-98%)

## Testing
- Use `tests/ocr-ground-truth.json` for validation
- Run `node tests/run-ocr-test.mjs` for automated testing
- Export diagnostic from frontend for manual verification
