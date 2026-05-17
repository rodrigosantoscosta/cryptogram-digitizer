# EasyOCR + Docker Implementation Plan

## Overview

Replace Tesseract.js with a Dockerized EasyOCR backend for cryptogram digit recognition.

**Target Metrics:**
- Accuracy: >85% (vs ~32% with Tesseract.js)
- Speed: <30s for 96 cells (vs 2-3s/cell with Tesseract.js)
- Error rate: <5%

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Frontend      │────▶│   Backend        │────▶│   OCR Service    │
│   (React)       │     │   (Fastify:4000) │     │   (FastAPI:5000) │
│                 │     │                  │     │                  │
│ - Grid detect   │     │ - API gateway    │     │ - EasyOCR        │
│ - Cell extract  │     │ - Batch chunking │     │ - Preprocessing  │
│ - Display       │     │ - Error handling │     │ - Number sanit.  │
└─────────────────┘     └──────────────────┘     └──────────────────┘
```

---

## Phase 1: Python OCR Service ✅

**Status:** IMPLEMENTED

**Files:**
- `ocr-service/main.py` - FastAPI server
- `ocr-service/ocr_engine.py` - EasyOCR wrapper
- `ocr-service/requirements.txt` - Dependencies
- `ocr-service/Dockerfile` - CPU-only container
- `ocr-service/tests/test_ocr.py` - Unit tests
- `ocr-service/.env.example` - Environment config

**Endpoints:**
- `POST /api/ocr/cell` - Single cell OCR
- `POST /api/ocr/batch` - Batch OCR (up to 32 cells)
- `GET /health` - Health check

**Preprocessing Pipeline:**
1. Grayscale conversion
2. Binary threshold (Otsu)
3. Resize to 32px height
4. RGB conversion

**Number Validation:**
- Range: 1-27 (Brazilian cryptograms)
- Spurious digit correction (e.g., "34" → "3")

---

## Phase 2: Node.js API Gateway ✅

**Status:** IMPLEMENTED

**Files:**
- `backend/package.json` - Dependencies
- `backend/tsconfig.json` - TypeScript config
- `backend/src/server.ts` - Fastify server
- `backend/src/routes/ocr.ts` - OCR routes
- `backend/src/services/ocrService.ts` - OCR service client
- `backend/src/types/ocr.ts` - TypeScript types
- `backend/Dockerfile` - Node.js container
- `backend/README.md` - Documentation

**Endpoints:**
- `GET /api/health` - Health check (proxies to OCR service)
- `POST /api/ocr/cell` - OCR single cell
- `POST /api/ocr/batch` - OCR batch (chunks into 16-cell requests)

**Features:**
- CORS middleware
- Multipart file upload (5MB limit)
- Batch chunking (16 cells per request to OCR service)
- Error handling and logging
- Health check with OCR service dependency

---

## Phase 3: Frontend Integration ⏳

**Status:** PLANNED

**Files to Create/Modify:**
- `src/lib/ocr/OCRApiClient.ts` - NEW: API client for backend
- `src/lib/ocr/CellNumberReader.ts` - MODIFY: Replace Tesseract calls with API calls
- `src/types/ocr.ts` - UPDATE: Add new OCR result types

**OCRApiClient Implementation:**

```typescript
export class OCRApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:4000') {
    this.baseUrl = baseUrl;
  }

  async healthCheck(): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/api/health`);
    return response.ok;
  }

  async recognizeCell(imageData: Blob): Promise<OCRResult> {
    const formData = new FormData();
    formData.append('file', imageData, 'cell.png');

    const response = await fetch(`${this.baseUrl}/api/ocr/cell`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`OCR failed: ${response.status}`);
    }

    return response.json();
  }

  async recognizeBatch(cells: { imageData: Blob; index: number }[]): Promise<OCRResult[]> {
    const formData = new FormData();
    cells.forEach((cell, i) => {
      formData.append('files', cell.imageData, `cell_${i}.png`);
    });

    const response = await fetch(`${this.baseUrl}/api/ocr/batch`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Batch OCR failed: ${response.status}`);
    }

    const data = await response.json();
    return data.results;
  }
}
```

**CellNumberReader.ts Modifications:**
- Replace Tesseract.js initialization with OCRApiClient
- Update `readCellWithRetry` to use API calls
- Remove Tesseract-specific preprocessing (keep grid detection)
- Add error handling for API failures

---

## Phase 4: Docker Orchestration ✅

**Status:** IMPLEMENTED

**Files:**
- `docker-compose.yml` - Production orchestration
- `docker-compose.dev.yml` - Development with hot-reload
- `docker-compose.ocr.yml` - OCR service standalone testing

**Services:**
- `ocr-service` - Python FastAPI + EasyOCR (port 5000)
- `backend` - Node.js Fastify API gateway (port 4000)

**Network:**
- `cryptogram-net` - Bridge network for inter-service communication

**Health Checks:**
- OCR service: `curl -f http://localhost:5000/health`
- Backend: `wget -qO- http://localhost:4000/api/health`

---

## Phase 5: Validation & Testing ⏳

**Status:** PLANNED

**Validation Dataset:**
- `tests/ocr-ground-truth.json` - 96 cells (12×8 grid)
- `legacy/sample.jpg` - Target cryptogram image

**Test Script:**

```bash
# 1. Start services
docker compose up -d

# 2. Wait for health
docker compose ps

# 3. Run validation
node tests/validate-ocr.js

# 4. Check results
# Expected: >85% accuracy, <30s for 96 cells
```

**Metrics to Track:**
- Accuracy per cell
- Overall accuracy (%)
- Processing time (total and per cell)
- Error rate (%)
- Memory usage (docker stats)

---

## Phase 6: Production Deployment ⏳

**Status:** PLANNED

**Considerations:**
- Environment variables for production URLs
- CORS restrictions (limit to frontend domain)
- Rate limiting on API endpoints
- Logging and monitoring
- Backup and model caching strategy

**Environment Variables:**

| Service | Variable | Production Value |
|---------|----------|------------------|
| Backend | `CORS_ORIGIN` | `https://yourdomain.com` |
| Backend | `OCR_SERVICE_URL` | `http://ocr-service:5000` |
| OCR | `OCR_GPU` | `false` (CPU only) |
| OCR | `LOG_LEVEL` | `warn` |

---

## File Structure

```
cryptogram-digitizer/
├── src/                          # Frontend (React)
│   ├── lib/ocr/
│   │   ├── OCRApiClient.ts       # NEW: API client
│   │   └── CellNumberReader.ts   # MODIFIED: Use API
│   └── ...
│
├── ocr-service/                  # Python OCR Service
│   ├── main.py
│   ├── ocr_engine.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── tests/
│   └── .env.example
│
├── backend/                      # Node.js API Gateway
│   ├── src/
│   │   ├── server.ts
│   │   ├── routes/ocr.ts
│   │   ├── services/ocrService.ts
│   │   └── types/ocr.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── README.md
│
├── tests/
│   ├── ocr-ground-truth.json
│   └── validate-ocr.js           # NEW: Validation script
│
├── docker-compose.yml            # Production
├── docker-compose.dev.yml        # Development
├── docker-compose.ocr.yml        # OCR standalone
├── PLANO_EASYOCR_DOCKER.md       # This file
└── FASE_1_PYTHON_SERVICE.md      # Phase 1 details
```

---

## Implementation Checklist

### Phase 1: Python OCR Service ✅
- [x] Create FastAPI server
- [x] Implement EasyOCR wrapper
- [x] Add preprocessing pipeline
- [x] Create Dockerfile
- [x] Write unit tests
- [x] Document API

### Phase 2: Node.js API Gateway ✅
- [x] Create Fastify server
- [x] Implement OCR service client
- [x] Add batch chunking
- [x] Create Dockerfile
- [x] Write documentation

### Phase 3: Frontend Integration ⏳
- [ ] Create OCRApiClient
- [ ] Modify CellNumberReader.ts
- [ ] Update TypeScript types
- [ ] Test with mock data

### Phase 4: Docker Orchestration ✅
- [x] Create docker-compose.yml
- [x] Create docker-compose.dev.yml
- [x] Configure health checks
- [x] Set up networking

### Phase 5: Validation ⏳
- [ ] Create validation script
- [ ] Run against ground truth
- [ ] Measure accuracy
- [ ] Optimize if needed

### Phase 6: Production ⏳
- [ ] Configure production env vars
- [ ] Add rate limiting
- [ ] Set up monitoring
- [ ] Document deployment

---

## Next Steps

1. **Start Docker Desktop** - Required for testing
2. **Run services:** `docker compose up -d`
3. **Test health endpoints:**
   - `curl http://localhost:5000/health` (OCR service)
   - `curl http://localhost:4000/api/health` (Backend)
4. **Proceed to Phase 3** - Frontend integration

---

**Last Updated:** 2026-05-16
**Version:** 1.0
**Status:** Phases 1, 2, 4 complete. Phases 3, 5, 6 pending.
