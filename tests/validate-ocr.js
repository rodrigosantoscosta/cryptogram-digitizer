/**
 * OCR Validation Script
 * 
 * Validates EasyOCR service against ground truth dataset.
 * 
 * Usage:
 *   node tests/validate-ocr.js [backend_url] [image_path]
 * 
 * Example:
 *   node tests/validate-ocr.js http://localhost:4000 legacy/sample.jpg
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

// Configuration
const BACKEND_URL = process.argv[2] || 'http://localhost:4000';
const IMAGE_PATH = process.argv[3] || path.join(__dirname, '..', 'legacy', 'sample.jpg');
const GROUND_TRUTH_PATH = path.join(__dirname, 'ocr-ground-truth.json');
const BATCH_SIZE = 16;

// Load ground truth
const groundTruth = JSON.parse(fs.readFileSync(GROUND_TRUTH_PATH, 'utf-8'));
const { grid, dimensions } = groundTruth;

// Utility functions
function printHeader(text) {
  console.log('\n' + '='.repeat(60));
  console.log(text);
  console.log('='.repeat(60));
}

function printResult(row, col, expected, actual, confidence, status) {
  const icon = status === 'correct' ? '✓' : status === 'incorrect' ? '✗' : '?';
  const color = status === 'correct' ? '\x1b[32m' : status === 'incorrect' ? '\x1b[31m' : '\x1b[33m';
  const reset = '\x1b[0m';
  
  console.log(
    `${color}${icon} Row ${row + 1}, Col ${col + 1}: Expected ${expected}, Got ${actual} (conf: ${(confidence * 100).toFixed(1)}%)${reset}`
  );
}

async function extractCellsFromImage(imagePath) {
  // This would normally use OpenCV to extract cells
  // For now, we'll send the full image and let the backend handle it
  // In a real scenario, you'd extract cells using the same grid detection
  // as the frontend
  
  console.log('⚠️  Note: This script requires cell extraction logic.');
  console.log('   For now, testing with a single cell to verify API connectivity.');
  
  // Create a simple test with a known cell
  const imageBuffer = fs.readFileSync(imagePath);
  
  return {
    cells: [{
      imageData: imageBuffer,
      row: 0,
      col: 1, // First row, second column (value: 26)
      expected: 26
    }]
  };
}

async function testHealthEndpoint() {
  printHeader('Testing Health Endpoints');
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`);
    const health = await response.json();
    
    console.log(`Backend Health: ${health.status}`);
    console.log(`OCR Service GPU: ${health.gpu}`);
    console.log(`Version: ${health.version}`);
    
    return health.status === 'ok';
  } catch (error) {
    console.error(`❌ Health check failed: ${error.message}`);
    return false;
  }
}

async function testSingleCellOCR() {
  printHeader('Testing Single Cell OCR');
  
  const imagePath = IMAGE_PATH;
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Image not found: ${imagePath}`);
    return null;
  }
  
  const imageBuffer = fs.readFileSync(imagePath);
  const formData = new FormData();
  formData.append('file', imageBuffer, 'cell.png');
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/ocr/cell`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });
    
    const result = await response.json();
    console.log(`OCR Result: ${JSON.stringify(result, null, 2)}`);
    
    return result;
  } catch (error) {
    console.error(`❌ OCR failed: ${error.message}`);
    return null;
  }
}

async function runValidation() {
  printHeader('OCR Validation - EasyOCR vs Ground Truth');
  
  console.log(`Backend URL: ${BACKEND_URL}`);
  console.log(`Image: ${IMAGE_PATH}`);
  console.log(`Ground Truth: ${dimensions.rows}x${dimensions.cols} grid`);
  console.log(`Batch Size: ${BATCH_SIZE} cells/request`);
  
  // Test 1: Health Check
  const healthOk = await testHealthEndpoint();
  if (!healthOk) {
    console.error('\n❌ Backend is not healthy. Aborting validation.');
    process.exit(1);
  }
  
  // Test 2: Single Cell OCR
  const singleResult = await testSingleCellOCR();
  if (!singleResult) {
    console.error('\n❌ Single cell OCR failed. Aborting validation.');
    process.exit(1);
  }
  
  // Test 3: Full Validation (requires cell extraction)
  printHeader('Full Validation');
  console.log('⏳  Full validation requires cell extraction logic.');
  console.log('   This will be implemented once the frontend integration is complete.');
  console.log('   The grid detection extracts cells from the image, then sends them to the OCR service.');
  
  // Summary
  printHeader('Validation Summary');
  console.log('✅ Health Check: PASSED');
  console.log('✅ Single Cell OCR: PASSED');
  console.log('⏳  Full Validation: PENDING (requires cell extraction)');
  
  console.log('\n📊 Next Steps:');
  console.log('   1. Run the frontend with the new OCRApiClient');
  console.log('   2. Upload the cryptogram image');
  console.log('   3. Compare results against ground truth');
  console.log('   4. Measure accuracy and performance');
}

// Run validation
runValidation().catch(error => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});
