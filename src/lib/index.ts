// src/lib/index.ts

// OCR
export { OCREngine } from './ocr/OCREngine';

// Image Processing (includes Classification and Mapping)
export { SymbolClassifier } from './image-processing/SymbolClassifier';
export { SymbolMapper, MappingValidator } from './image-processing/SymbolMapper';
export { ImageProcessor } from './image-processing/ImageProcessor';
export { TableDetector } from './image-processing/TableDetector';
export { SymbolExtractor } from './image-processing/SymbolExtractor';
