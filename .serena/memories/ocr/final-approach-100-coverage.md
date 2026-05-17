## OCR Evolution: Tesseract.js → EasyOCR + Docker (2026-05-16)

### Tesseract.js Results (DEPRECATED)
- **Coverage**: 96/96 cells (100%)
- **Accuracy**: ~32% (poor due to grayscale-only LSTM limitations)
- **Speed**: 2-3s per cell (too slow)
- **Issues**: Systematic misreads ("26" → "2"/"12", spurious digits "34"/"24")

### What Failed with Tesseract.js:
- Grayscale-only preprocessing destroyed contrast information
- Binary images to LSTM reduced accuracy significantly
- Template matching helped but couldn't overcome poor base OCR
- Aggressive post-corrections caused cascading errors

### New Approach: EasyOCR + Docker
- **Target accuracy**: >85%
- **Target speed**: <30s for 96 cells
- **Architecture**: Python FastAPI service + Node.js API gateway + React frontend
- **Phase 1**: Python OCR service implemented (see `ocr/easyocr-docker-architecture`)

### Migration Plan:
1. ✅ Phase 1: Python OCR Service (FastAPI + EasyOCR) - IMPLEMENTED
2. ⏳ Phase 2: Node.js API Gateway (Fastify) - PLANNED
3. ⏳ Phase 3: Frontend integration (OCRApiClient) - PLANNED
4. ⏳ Phase 4: Validation against ground truth - PLANNED

### Legacy File (being replaced):
- `src/lib/ocr/CellNumberReader.ts` - Will be refactored to use API calls instead of Tesseract.js