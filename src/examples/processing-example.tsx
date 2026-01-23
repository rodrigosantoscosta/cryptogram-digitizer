import React, { useState } from 'react';
import { ImageProcessor } from '../lib/image-processing/ImageProcessor';
import { TableDetector } from '../lib/image-processing/TableDetector';
import { SymbolExtractor } from '../lib/image-processing/SymbolExtractor';
import { ImageData, ProcessingOptions } from '../types/image';

export const ProcessingExample: React.FC = () => {
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [options, setOptions] = useState<ProcessingOptions>({
    grayscale: true,
    contrast: 30,
    threshold: 150,
  });

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        setImageData(imgData as unknown as ImageData);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const processImage = () => {
    if (!imageData) return;

    const processed = ImageProcessor.process(imageData, options);
    const table = TableDetector.detect(processed);
    const symbols = SymbolExtractor.extract(processed);

    console.log('Processed Image:', processed);
    console.log('Detected Table:', table);
    console.log('Extracted Symbols:', symbols);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Image Processing Example</h1>
      <input type="file" accept="image/*" onChange={handleImageUpload} />
      <button onClick={processImage} disabled={!imageData}>
        Process Image
      </button>
      <div style={{ marginTop: '20px' }}>
        <label>
          <input
            type="checkbox"
            checked={options.grayscale}
            onChange={(e) => setOptions({ ...options, grayscale: e.target.checked })}
          />
          Grayscale
        </label>
      </div>
    </div>
  );
};
