/**
 * OCR Validation Script (No external dependencies)
 * 
 * Validates EasyOCR service against ground truth dataset.
 * 
 * Usage:
 *   node tests/validate-ocr.mjs [backend_url] [image_path]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BACKEND_URL = process.argv[2] || 'http://localhost:4000';
const IMAGE_PATH = process.argv[3] || path.join(__dirname, '..', 'legacy', 'sample.jpg');
const GROUND_TRUTH_PATH = path.join(__dirname, 'ocr-ground-truth.json');

// Load ground truth
const groundTruth = JSON.parse(fs.readFileSync(GROUND_TRUTH_PATH, 'utf-8'));
const { grid, dimensions } = groundTruth;

// Utility functions
function printHeader(text) {
  console.log('\n' + '='.repeat(60));
  console.log(text);
  console.log('='.repeat(60));
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

async function testHealthEndpoint() {
  printHeader('Testing Health Endpoints');
  
  try {
    const health = await httpGet(`${BACKEND_URL}/api/health`);
    
    console.log(`Backend Health: ${health.status}`);
    console.log(`OCR Service GPU: ${health.gpu}`);
    console.log(`Version: ${health.version}`);
    
    return health.status === 'ok';
  } catch (error) {
    console.error(`❌ Health check failed: ${error.message}`);
    return false;
  }
}

async function runValidation() {
  printHeader('OCR Validation - EasyOCR vs Ground Truth');
  
  console.log(`Backend URL: ${BACKEND_URL}`);
  console.log(`Ground Truth: ${dimensions.rows}x${dimensions.cols} grid`);
  console.log(`Total cells: ${dimensions.rows * dimensions.cols}`);
  
  // Test 1: Health Check
  const healthOk = await testHealthEndpoint();
  if (!healthOk) {
    console.error('\n❌ Backend is not healthy. Aborting validation.');
    process.exit(1);
  }
  
  // Summary
  printHeader('Validation Summary');
  console.log('✅ Health Check: PASSED');
  console.log('⏳  Full Validation: Requires frontend integration');
  
  console.log('\n📊 Next Steps:');
  console.log('   1. Start frontend: npm run dev');
  console.log('   2. Upload cryptogram image');
  console.log('   3. Compare OCR results against ground truth');
  console.log('   4. Measure accuracy (>85% target)');
}

// Run validation
runValidation().catch(error => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});
