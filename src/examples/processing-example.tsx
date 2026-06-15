// src/examples/processing-example.tsx
import { useState } from 'react';
import { ImageProcessor } from '@/lib/image-processing/ImageProcessor';
import { TableDetector } from '@/lib/image-processing/TableDetector';
import { SymbolExtractor } from '@/lib/image-processing/SymbolExtractor';
import type { ProcessedData } from '@/types/puzzle';

export function ProcessingExample() {
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [results, setResults] = useState<ProcessedData | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        setImageData(imgData);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const processImage = async () => {
    if (!imageData) return;

    try {
      const preprocessed = await ImageProcessor.preprocess(imageData);
      const grid = GridDetector.detect(imageData); // GridDetector needs to be imported
      const symbols = await SymbolExtractor.extractAllSymbolsFromGrid(imageData, grid);
      
      console.log('Processed symbols:', symbols.length);
    } catch (error) {
      console.error('Error processing image:', error);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} accept="image/*" />
      <button onClick={processImage} disabled={!imageData}>
        Process Image
      </button>
      {results && (
        <div>
          <h3>Results:</h3>
          <pre>{JSON.stringify(results.tableStructure, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// Mock GridDetector for example
const GridDetector = {
  detect: (_img: ImageData) => ({
    rows: 10, cols: 10, roi: { x:0,y:0,width:100,height:100 },
    rowPositions: [], colPositions: [], colWidths: [], rowHeights: []
  })
};
