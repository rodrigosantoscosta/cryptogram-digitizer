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
from contextlib import asynccontextmanager
from ocr_engine import OCREngine
import io
import os
from PIL import Image
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration via environment variables
MAX_IMAGE_SIZE = int(os.getenv("MAX_IMAGE_SIZE", 5 * 1024 * 1024))  # 5MB
MAX_BATCH_SIZE = int(os.getenv("MAX_BATCH_SIZE", 32))
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
ALLOWED_MIME_TYPES = {"image/png", "image/jpeg", "image/webp"}

ocr_engine = OCREngine()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    logger.info("Initializing EasyOCR engine...")
    await ocr_engine.initialize()
    logger.info(f"EasyOCR initialized successfully (GPU: {ocr_engine.has_gpu()})")
    yield
    # Shutdown
    logger.info("Shutting down OCR service...")

app = FastAPI(
    title="Cryptogram OCR Service",
    description="EasyOCR-based service for cryptogram cell number recognition",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        # Validate mime type
        if file.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported image format. Allowed: {', '.join(ALLOWED_MIME_TYPES)}"
            )
        
        image_data = await file.read()
        
        if len(image_data) > MAX_IMAGE_SIZE:
            raise HTTPException(status_code=400, detail=f"Image too large (max {MAX_IMAGE_SIZE // (1024*1024)}MB)")
        
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
        if len(files) > MAX_BATCH_SIZE:
            raise HTTPException(status_code=400, detail=f"Too many images (max {MAX_BATCH_SIZE} per batch)")
        
        images = []
        for i, file in enumerate(files):
            # Validate mime type
            if file.content_type not in ALLOWED_MIME_TYPES:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Image {i}: unsupported format '{file.content_type}'"
                )
            
            image_data = await file.read()
            image = Image.open(io.BytesIO(image_data))
            logger.debug(f"Cell {i}: size={image.size}, format={image.format}, mode={image.mode}")
            images.append(image)
        
        results = await ocr_engine.recognize_batch(images)
        
        recognized = sum(1 for r in results if r['number'] is not None)
        logger.info(f"Batch OCR completed: {len(results)} cells, {recognized} recognized")
        
        return {"results": results}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch OCR failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Batch OCR failed: {str(e)}")
