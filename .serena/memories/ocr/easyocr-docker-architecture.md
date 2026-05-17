# EasyOCR + Docker Architecture (2026-05-16)

## Overview
Replacing Tesseract.js with a Dockerized EasyOCR backend for better accuracy and performance on cryptogram digit recognition.

## Architecture
```
Frontend (React) → Node.js API (Fastify) → Python OCR Service (FastAPI + EasyOCR)
                     Port 4000              Port 5000
```

## Services

### 1. Python OCR Service (`ocr-service/`)
- **Framework**: FastAPI
- **OCR Engine**: EasyOCR (CPU-only)
- **Port**: 5000
- **Endpoints**:
  - `POST /api/ocr/cell` - Single cell OCR
  - `POST /api/ocr/batch` - Batch OCR (up to 32 cells)
  - `GET /health` - Health check
- **Preprocessing**: Binary threshold (Otsu) → Resize to 32px height → RGB conversion
- **Number validation**: 1-27 range for Brazilian cryptograms
- **Docker**: CPU-only, pre-cached models, ~1.5GB memory

### 2. Node.js API Gateway (`backend/`) - PLANNED
- **Framework**: Fastify
- **Port**: 4000
- **Responsibilities**:
  - Receive cell images from frontend
  - Batch cells (16 per request) to Python service
  - Cache results
  - Handle errors and retries

### 3. Frontend Integration - PLANNED
- Replace `CellNumberReader.ts` Tesseract calls with API calls
- Add `OCRApiClient` for communication with Node.js backend
- Maintain existing grid detection (OpenCV.js)

## Key Decisions
- **CPU only**: No GPU dependency for easier deployment
- **Batch processing**: 16 cells/request balances memory and HTTP overhead
- **EasyOCR only**: No Tesseract fallback (simpler architecture)
- **Docker Compose**: Orchestrate all services

## Target Metrics
- **Accuracy**: >85% (vs ~32% with Tesseract.js)
- **Speed**: <30s for 96 cells (vs 2-3s/cell with Tesseract.js)
- **Error rate**: <5%

## Files Created (Phase 1)
- `ocr-service/main.py` - FastAPI server
- `ocr-service/ocr_engine.py` - EasyOCR wrapper
- `ocr-service/requirements.txt` - Python dependencies
- `ocr-service/Dockerfile` - CPU-only container
- `ocr-service/tests/test_ocr.py` - Unit tests
- `ocr-service/.env.example` - Environment config
- `docker-compose.ocr.yml` - Docker Compose for testing
- `FASE_1_PYTHON_SERVICE.md` - Implementation documentation

## Validation
- Ground truth dataset: `tests/ocr-ground-truth.json` (96 cells, 12×8 grid)
- Test image: `legacy/sample.jpg`
