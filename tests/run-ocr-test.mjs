/**
 * Automated OCR Test Script
 * 
 * Extracts cells from the cryptogram image using grid detection,
 * sends them to the OCR backend, and validates against ground truth.
 * 
 * Usage:
 *   node tests/run-ocr-test.mjs [backend_url] [image_path]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BACKEND_URL = process.argv[2] || 'http://localhost:4000';
const IMAGE_PATH = process.argv[3] || path.join(__dirname, '..', 'legacy', 'sample.jpg');
const GROUND_TRUTH_PATH = path.join(__dirname, 'ocr-ground-truth.json');

// Load ground truth
const groundTruth = JSON.parse(fs.readFileSync(GROUND_TRUTH_PATH, 'utf-8'));
const { grid: expectedGrid, dimensions } = groundTruth;

printHeader('Automated OCR Test');
console.log(`Backend: ${BACKEND_URL}`);
console.log(`Image: ${IMAGE_PATH}`);
console.log(`Ground Truth: ${dimensions.rows}x${dimensions.cols} = ${dimensions.rows * dimensions.cols} cells`);

// Step 1: Health check
const healthOk = await testHealth();
if (!healthOk) {
  console.error('\n❌ Backend not healthy. Aborting.');
  process.exit(1);
}

// Step 2: Load image and extract cells
console.log('\n🔍 Loading image and extracting cells...');
const image = sharp(IMAGE_PATH);
const metadata = await image.metadata();
console.log(`Image: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);

// Estimate grid positions
// The grid is detected by OpenCV.js in the frontend
// We'll estimate based on image dimensions and grid size
const cells = await extractCells(IMAGE_PATH, dimensions, metadata);
console.log(`Extracted ${cells.length} cells`);

// Step 3: Send cells in batches
console.log('\n📤 Sending cells to OCR backend...');
const BATCH_SIZE = 16;
const allResults = [];
const startTime = Date.now();

for (let i = 0; i < cells.length; i += BATCH_SIZE) {
  const batch = cells.slice(i, i + BATCH_SIZE);
  console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: cells ${i + 1}-${i + batch.length}`);
  
  const batchResults = await sendBatchToOCR(batch);
  allResults.push(...batchResults);
}

const totalTime = Date.now() - startTime;
console.log(`\n⏱️  Total time: ${totalTime}ms (${(totalTime / cells.length).toFixed(1)}ms per cell)`);

// Step 4: Validate against ground truth
console.log('\n📊 Validation Results:');
printHeader('Cell-by-Cell Comparison');

let correct = 0;
let incorrect = 0;
let unrecognized = 0;

for (let row = 0; row < dimensions.rows; row++) {
  for (let col = 1; col < dimensions.cols; col++) {
    const cellIndex = row * (dimensions.cols - 1) + (col - 1);
    const expected = expectedGrid[row][col];
    const result = allResults[cellIndex];
    
    const actual = result?.number ?? null;
    const confidence = result?.confidence ?? 0;
    
    let status;
    if (actual === null) {
      status = 'unrecognized';
      unrecognized++;
    } else if (actual === expected) {
      status = 'correct';
      correct++;
    } else {
      status = 'incorrect';
      incorrect++;
    }
    
    const icon = status === 'correct' ? '✓' : status === 'incorrect' ? '✗' : '?';
    const color = status === 'correct' ? '\x1b[32m' : status === 'incorrect' ? '\x1b[31m' : '\x1b[33m';
    const reset = '\x1b[0m';
    
    console.log(
      `${color}${icon} [${row + 1},${col}] Expected: ${expected}, Got: ${actual ?? 'null'} (conf: ${(confidence * 100).toFixed(1)}%)${reset}`
    );
  }
}

// Summary
printHeader('Summary');
const total = dimensions.rows * (dimensions.cols - 1);
const accuracy = correct / total * 100;
const coverage = (correct + incorrect) / total * 100;

console.log(`Total cells: ${total}`);
console.log(`Correct: ${correct} (${accuracy.toFixed(1)}%)`);
console.log(`Incorrect: ${incorrect}`);
console.log(`Unrecognized: ${unrecognized}`);
console.log(`Coverage: ${coverage.toFixed(1)}%`);
console.log(`Time: ${totalTime}ms (${(totalTime / total).toFixed(1)}ms/cell)`);

if (accuracy >= 85) {
  console.log('\n✅ PASSED: Accuracy meets target (>85%)');
} else {
  console.log(`\n❌ FAILED: Accuracy ${accuracy.toFixed(1)}% below target (85%)`);
}

// Utility functions
function printHeader(text) {
  console.log('\n' + '='.repeat(60));
  console.log(text);
  console.log('='.repeat(60));
}

function testHealth() {
  return new Promise((resolve) => {
    http.get(`${BACKEND_URL}/api/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          console.log(`✅ Health: ${health.status} (GPU: ${health.gpu})`);
          resolve(true);
        } catch (e) {
          console.error(`❌ Health check failed: ${data}`);
          resolve(false);
        }
      });
    }).on('error', (e) => {
      console.error(`❌ Health check error: ${e.message}`);
      resolve(false);
    });
  });
}

function sendBatchToOCR(cells) {
  return new Promise((resolve) => {
    const url = new URL(`${BACKEND_URL}/api/ocr/batch`);
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    
    const parts = cells.map((cell, i) => {
      return Buffer.concat([
        Buffer.from(`------FormBoundary${boundary}\r\n`),
        Buffer.from(`Content-Disposition: form-data; name="files"; filename="cell_${i}.png"\r\n`),
        Buffer.from('Content-Type: image/png\r\n\r\n'),
        cell.imageData,
        Buffer.from('\r\n')
      ]);
    });
    
    const body = Buffer.concat([
      ...parts,
      Buffer.from(`------FormBoundary${boundary}--\r\n`)
    ]);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=----FormBoundary${boundary}`,
        'Content-Length': body.length
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response.results || []);
        } catch (e) {
          console.error(`Batch error: ${data}`);
          resolve([]);
        }
      });
    });
    
    req.on('error', (e) => {
      console.error(`Batch request error: ${e.message}`);
      resolve([]);
    });
    req.write(body);
    req.end();
  });
}

async function extractCells(imagePath, dimensions, metadata) {
  const { width, height } = metadata;
  const { rows, cols } = dimensions;
  
  // Estimate grid margins - mais preciso
  // A grid ocupa a maior parte da imagem com margens pequenas
  const marginX = Math.floor(width * 0.08);
  const marginY = Math.floor(height * 0.03);
  
  const gridWidth = width - 2 * marginX;
  const gridHeight = height - 2 * marginY;
  
  const cellWidth = gridWidth / cols;
  const cellHeight = gridHeight / rows;
  
  // Extract cells (skip column 0 as per frontend logic)
  const cells = [];
  
  for (let row = 0; row < rows; row++) {
    for (let col = 1; col < cols; col++) {
      const left = marginX + col * cellWidth;
      const top = marginY + row * cellHeight;
      
      // Padding agressivo para evitar linhas da grid (25% de cada lado)
      const paddingX = cellWidth * 0.25;
      const paddingY = cellHeight * 0.25;
      
      const extractLeft = Math.floor(left + paddingX);
      const extractTop = Math.floor(top + paddingY);
      const extractWidth = Math.floor(cellWidth - 2 * paddingX);
      const extractHeight = Math.floor(cellHeight - 2 * paddingY);
      
      // Extract cell image - resize para tamanho ideal do EasyOCR
      const cellBuffer = await sharp(imagePath)
        .extract({
          left: extractLeft,
          top: extractTop,
          width: extractWidth,
          height: extractHeight
        })
        // Resize para 96px de altura (bom para EasyOCR)
        .resize(null, 96, { fit: 'inside', background: { r: 255, g: 255, b: 255 } })
        // Adicionar padding branco
        .extend({
          top: 20,
          bottom: 20,
          left: 30,
          right: 30,
          background: { r: 255, g: 255, b: 255 }
        })
        .png()
        .toBuffer();
      
      cells.push({
        imageData: cellBuffer,
        row,
        col
      });
    }
  }
  
  return cells;
}
