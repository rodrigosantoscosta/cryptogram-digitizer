# Cryptogram Digitizer — Project Overview

## Purpose
A TypeScript/React web app to digitize cryptogram puzzles from scanned images.
Uses OpenCV.js (browser-side) to:
1. Pre-process the image (grayscale, blur, threshold, morphology)
2. Detect the table grid (Hough lines)
3. Extract and normalize symbols from cells
4. Classify/cluster symbols by visual similarity
5. Allow user to map symbols to letters

## Tech Stack
- **Language**: TypeScript (strict), React 18
- **Build**: Vite 5
- **CV**: Local OpenCV.js (/opencv-js/dist/opencv.js)
- **OCR**: Tesseract.js
- **Testing**: Vitest + Testing Library
- **Linting**: ESLint + typescript-eslint
- **Styling**: Tailwind CSS

## Project Structure
```
src/
  lib/image-processing/   — Core CV algorithms (ImageProcessor, GridDetector, SymbolExtractor, SymbolClassifier)
  lib/classification/     — SymbolClassifier logic
  lib/mapping/            — SymbolMapper
  lib/ocr/                — OCREngine (Tesseract wrapper)
  components/Mapping/     — React UI for symbol mapping
  pages/                  — UploadPage, ProcessingPage, MappingPage, TestPage
  hooks/                  — useImageProcessor (orchestrator), usePuzzleSolver
  store/                  — puzzleStore (Zustand with persistence)
```

## Key Entry Points
- `index.html` — React bootstrapper (newly activated)
- `prototype-vanilla.html` — Original Vanilla JS prototype (archived)
- `src/main.tsx` — React entry
- `src/App.tsx` — App root and routing
