/**
 * OCR Validation Script
 * 
 * Analyzes diagnostic JSON to validate OCR accuracy against cryptogram constraints.
 * 
 * Usage: npx tsx scripts/validate-ocr.ts <path-to-diagnostic-json>
 */

import * as fs from 'fs';
import * as path from 'path';

interface DiagnosticData {
  meta: {
    recognized: number;
    total: number;
    coverage: string;
    uniqueSymbols: number;
    gridSize: { rows: number; cols: number };
  };
  grid: (number | null)[][];
  unrecognized: Array<{ r: number; c: number; rawOcr: string; rawText: string }>;
  lowConf: Array<{ r: number; c: number; n: number; conf: number; rawOcr: string; rawText: string }>;
  bySymbol: Record<string, Array<[number, number]>>;
}

interface ValidationResult {
  totalCells: number;
  validCells: number;
  invalidCells: Array<{
    row: number;
    col: number;
    value: number;
    reason: string;
    confidence: number;
  }>;
  lowConfidenceCells: Array<{
    row: number;
    col: number;
    value: number;
    confidence: number;
  }>;
  trueAccuracy: number;
  coverage: number;
}

function validateDiagnostic(data: DiagnosticData, maxValue: number = 26): ValidationResult {
  const invalidCells: ValidationResult['invalidCells'] = [];
  const lowConfidenceCells: ValidationResult['lowConfidenceCells'] = [];
  let validCells = 0;

  // Check all cells in the grid
  for (let row = 0; row < data.grid.length; row++) {
    for (let col = 0; col < data.grid[row].length; col++) {
      const value = data.grid[row][col];
      
      if (value === null) {
        continue; // Unrecognized cells are already tracked
      }

      // Check for invalid values
      if (value < 1) {
        invalidCells.push({
          row, col, value,
          reason: `Value ${value} < 1 (invalid)`,
          confidence: 0
        });
      } else if (value > maxValue) {
        invalidCells.push({
          row, col, value,
          reason: `Value ${value} > ${maxValue} (likely OCR error)`,
          confidence: 0
        });
      } else {
        validCells++;
      }
    }
  }

  // Check low confidence cells
  const lowConfSet = new Set<string>();
  for (const cell of data.lowConf) {
    const key = `${cell.r},${cell.c}`;
    lowConfSet.add(key);
    
    if (cell.conf < 60) {
      lowConfidenceCells.push({
        row: cell.r,
        col: cell.c,
        value: cell.n,
        confidence: cell.conf
      });
    }
  }

  // Cross-reference invalid cells with low confidence
  for (const invalid of invalidCells) {
    const key = `${invalid.row},${invalid.col}`;
    const lowConfCell = data.lowConf.find(c => c.r === invalid.row && c.c === invalid.col);
    if (lowConfCell) {
      invalid.confidence = lowConfCell.conf;
    }
  }

  const totalCells = data.meta.total;
  const trulyValid = validCells - lowConfidenceCells.filter(
    lc => !invalidCells.some(i => i.row === lc.row && i.col === lc.col)
  ).length;

  return {
    totalCells,
    validCells: validCells,
    invalidCells,
    lowConfidenceCells,
    trueAccuracy: (trulyValid / totalCells) * 100,
    coverage: (data.meta.recognized / totalCells) * 100
  };
}

function printReport(result: ValidationResult, data: DiagnosticData): void {
  console.log('\n' + '='.repeat(60));
  console.log('OCR VALIDATION REPORT');
  console.log('='.repeat(60));
  
  console.log(`\nTotal cells: ${result.totalCells}`);
  console.log(`Coverage: ${result.coverage.toFixed(1)}% (${data.meta.recognized}/${result.totalCells})`);
  console.log(`True accuracy: ${result.trueAccuracy.toFixed(1)}%`);
  
  console.log(`\nValid cells: ${result.validCells}`);
  console.log(`Invalid cells: ${result.invalidCells.length}`);
  console.log(`Low confidence (<60%): ${result.lowConfidenceCells.length}`);

  if (result.invalidCells.length > 0) {
    console.log('\n' + '-'.repeat(60));
    console.log('INVALID CELLS (likely OCR errors):');
    console.log('-'.repeat(60));
    for (const cell of result.invalidCells) {
      console.log(`  (${cell.row},${cell.col}): ${cell.value} - ${cell.reason} [conf: ${cell.confidence}%]`);
    }
  }

  if (result.lowConfidenceCells.length > 0) {
    console.log('\n' + '-'.repeat(60));
    console.log('LOW CONFIDENCE CELLS (may be errors):');
    console.log('-'.repeat(60));
    for (const cell of result.lowConfidenceCells.sort((a, b) => a.confidence - b.confidence)) {
      console.log(`  (${cell.row},${cell.col}): ${cell.value} [conf: ${cell.confidence}%]`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('RECOMMENDATIONS:');
  console.log('='.repeat(60));
  
  if (result.invalidCells.length > 0) {
    console.log(`- ${result.invalidCells.length} cells have invalid values and need manual correction`);
  }
  if (result.lowConfidenceCells.length > 0) {
    console.log(`- ${result.lowConfidenceCells.length} cells have low confidence and should be verified`);
  }
  if (result.trueAccuracy < 95) {
    console.log('- True accuracy is below 95%, consider improving OCR preprocessing');
  }
  console.log('');
}

// Main execution
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: npx tsx scripts/validate-ocr.ts <path-to-diagnostic-json>');
  console.log('Example: npx tsx scripts/validate-ocr.ts cnr-diagnostic-2026-05-16.json');
  process.exit(1);
}

const filePath = path.resolve(args[0]);
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const rawData = fs.readFileSync(filePath, 'utf-8');
const data: DiagnosticData = JSON.parse(rawData);

const result = validateDiagnostic(data);
printReport(result, data);
