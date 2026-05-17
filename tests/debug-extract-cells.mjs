/**
 * Debug Script: Extract and save cells for visual inspection
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMAGE_PATH = path.join(__dirname, '..', 'legacy', 'sample.jpg');
const OUTPUT_DIR = path.join(__dirname, 'debug-cells');

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Grid dimensions
const dimensions = { rows: 12, cols: 8 };

// Load image
const image = sharp(IMAGE_PATH);
const metadata = await image.metadata();
console.log(`Image: ${metadata.width}x${metadata.height}`);

// Estimate grid positions
const marginX = Math.floor(metadata.width * 0.05);
const marginY = Math.floor(metadata.height * 0.05);

const gridWidth = metadata.width - 2 * marginX;
const gridHeight = metadata.height - 2 * marginY;

const cellWidth = gridWidth / dimensions.cols;
const cellHeight = gridHeight / dimensions.rows;

console.log(`Margins: X=${marginX}, Y=${marginY}`);
console.log(`Cell size: ${cellWidth.toFixed(1)}x${cellHeight.toFixed(1)}`);

// Extract and save cells
for (let row = 0; row < dimensions.rows; row++) {
  for (let col = 1; col < dimensions.cols; col++) {
    const left = marginX + col * cellWidth;
    const top = marginY + row * cellHeight;
    
    const padding = Math.min(cellWidth, cellHeight) * 0.15;
    const extractLeft = Math.floor(left + padding);
    const extractTop = Math.floor(top + padding);
    const extractWidth = Math.floor(cellWidth - 2 * padding);
    const extractHeight = Math.floor(cellHeight - 2 * padding);
    
    const cellBuffer = await sharp(IMAGE_PATH)
      .extract({
        left: extractLeft,
        top: extractTop,
        width: extractWidth,
        height: extractHeight
      })
      .png()
      .toBuffer();
    
    const filename = `cell_r${row + 1}_c${col}.png`;
    fs.writeFileSync(path.join(OUTPUT_DIR, filename), cellBuffer);
  }
}

console.log(`\nSaved ${dimensions.rows * (dimensions.cols - 1)} cells to ${OUTPUT_DIR}`);
console.log('Open the folder to visually inspect the extracted cells.');
