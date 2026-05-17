"""
Cryptogram OCR Service - FastAPI Server

Serviço de OCR baseado em EasyOCR para reconhecimento de números
em células de criptograma.

Endpoints:
- POST /api/ocr/cell: OCR de uma única célula
- POST /api/ocr/batch: OCR de múltiplas células (batch)
- GET /health: Health check
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ocr_engine import OCREngine
import base64
import io
from PIL import Image
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Cryptogram OCR Service",
    description="EasyOCR-based service for cryptogram cell number recognition",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ocr_engine = OCREngine()

@app.on_event("startup")
async def startup_event():
    """Inicializa EasyOCR durante o startup do servidor"""
    logger.info("Initializing EasyOCR engine...")
    await ocr_engine.initialize()
    logger.info(f"EasyOCR initialized successfully (GPU: {ocr_engine.has_gpu()})")

@app.get("/health")
async def health_check():
    """Health check do serviço"""
    return {
        "status": "ok",
        "gpu": ocr_engine.has_gpu(),
        "version": "1.0.0"
    }

@app.post("/api/ocr/cell")
async def ocr_cell(file: UploadFile = File(...)):
    """
    OCR de uma única célula.
    
    Recebe uma imagem PNG/JPG e retorna o número reconhecido.
    """
    try:
        image_data = await file.read()
        
        if len(image_data) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Image too large (max 5MB)")
        
        image = Image.open(io.BytesIO(image_data))
        result = await ocr_engine.recognize_number(image)
        
        logger.info(f"OCR result: number={result['number']}, confidence={result['confidence']:.2f}")
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OCR failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")

@app.post("/api/ocr/batch")
async def ocr_batch(files: list[UploadFile] = File(...)):
    """
    OCR de múltiplas células em batch.
    
    Recebe múltiplas imagens e retorna resultados para cada uma.
    """
    try:
        if len(files) > 32:
            raise HTTPException(status_code=400, detail="Too many images (max 32 per batch)")
        
        results = []
        for i, file in enumerate(files):
            image_data = await file.read()
            image = Image.open(io.BytesIO(image_data))
            logger.debug(f"Cell {i}: size={image.size}, format={image.format}, mode={image.mode}")
            result = await ocr_engine.recognize_number(image)
            logger.debug(f"Cell {i} result: number={result['number']}, confidence={result['confidence']:.2f}, rawText='{result['rawText']}'")
            results.append(result)
        
        recognized = sum(1 for r in results if r['number'] is not None)
        logger.info(f"Batch OCR completed: {len(results)} cells, {recognized} recognized")
        
        return {"results": results}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch OCR failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Batch OCR failed: {str(e)}")
