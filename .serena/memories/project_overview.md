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
- **OCR**: EasyOCR (Dockerized Python service) - replacing Tesseract.js
- **Backend**: Node.js/Fastify API gateway (planned)
- **Python Service**: FastAPI + EasyOCR (Phase 1 implemented)
- **Testing**: Vitest + Testing Library
- **Linting**: ESLint + typescript-eslint
- **Styling**: Tailwind CSS
- **Orchestration**: Docker Compose

## Project Structure
```
src/
  lib/image-processing/   — Core CV algorithms (ImageProcessor, GridDetector, SymbolExtractor, SymbolClassifier, SymbolMapper, TableDetector)
  lib/ocr/                — OCREngine (being replaced by OCRApiClient)
  components/Mapping/     — React UI for symbol mapping
  pages/                  — UploadPage, ProcessingPage, MappingPage, TestPage
  steps/                  — Step-based UI components (StepUpload, StepProcessing, StepMapping, StepIndicator)
  hooks/                  — useImageProcessor (orchestrator), usePuzzleSolver, useSymbolMapping
  store/                  — puzzleStore (Zustand with persistence)
  types/                  — Consolidated TypeScript definitions (image, symbol, grid, puzzle, ocr)

ocr-service/              — Python OCR Service (FastAPI + EasyOCR) [Phase 1 implemented]
  main.py                 — FastAPI server
  ocr_engine.py           — EasyOCR wrapper
  Dockerfile              — CPU-only container
  tests/                  — Unit tests

backend/                  — Node.js API Gateway (Fastify) [PLANNED]

docker-compose.yml        — Service orchestration
docker-compose.ocr.yml    — OCR service standalone testing
```

## Key Entry Points
- `index.html` — React bootstrapper
- `legacy/` — Original Vanilla JS prototype and assets (archived)
- `src/main.tsx` — React entry
- `src/App.tsx` — App root and routing
