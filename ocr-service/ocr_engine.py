"""
EasyOCR Engine - Wrapper para reconhecimento de números em criptogramas

Este módulo encapsula o EasyOCR com configurações otimizadas para
reconhecimento de números em células de criptograma.

Multi-Strategy Preprocessing:
- Strategy 1: Binary + Otsu (baseline)
- Strategy 2: CLAHE contrast enhancement + grayscale
- Strategy 3: Adaptive threshold + aggressive denoising

Each strategy is tried and the best result is selected.
"""

import easyocr
import cv2
import numpy as np
from PIL import Image
import torch
import re
import logging
from pathlib import Path
from typing import Optional, List
from preprocessing import get_all_strategies

logger = logging.getLogger(__name__)

class OCREngine:
    """Engine de OCR baseado em EasyOCR com multi-strategy preprocessing"""
    
    def __init__(self):
        self.reader = None
        self._has_gpu = torch.cuda.is_available()
        
        # Check if custom model exists, fallback to default if not
        model_path = Path(__file__).parent / 'models' / 'cryptogram_digits.pth'
        recog_network = 'cryptogram_digits' if model_path.exists() else None
        
        if recog_network is None:
            logger.warning("Custom model not found, using default English model")
        
        self.config = {
            'lang_list': ['en'],
            'gpu': False,
            'model_storage_directory': './models',
            'download_enabled': True,
            'verbose': False,
        }
        if recog_network:
            self.config['recog_network'] = recog_network
    
    async def initialize(self):
        """Inicializa o leitor EasyOCR"""
        try:
            logger.info("Loading EasyOCR models...")
            self.reader = easyocr.Reader(**self.config)
            logger.info("EasyOCR models loaded successfully")
        except Exception as e:
            logger.error(f"Failed to initialize EasyOCR: {str(e)}")
            raise
    
    def has_gpu(self) -> bool:
        """Verifica se GPU está disponível"""
        return self._has_gpu
    
    def preprocess_image_strategies(self, image: Image.Image) -> List[np.ndarray]:
        """Returns 3 different preprocessed versions for multi-strategy OCR"""
        img_array = np.array(image)
        # Convert RGB to BGR for OpenCV
        if len(img_array.shape) == 3:
            img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        
        return [preprocess_fn(img_array) for _, preprocess_fn in get_all_strategies()]
    
    def sanitize_number(self, text: str) -> Optional[int]:
        """
        Sanitiza texto extraído para extrair apenas números válidos.
        Enhanced with confusion pair awareness.
        """
        cleaned = re.sub(r'[^0-9]', '', text)
        
        if not cleaned:
            return None
        
        if len(cleaned) > 2:
            cleaned = cleaned[:2]
        
        try:
            number = int(cleaned)
        except ValueError:
            return None
        
        if number < 1 or number > 27:
            if len(cleaned) == 2:
                first_digit = int(cleaned[0])
                if 1 <= first_digit <= 27:
                    logger.info(f"Corrected spurious digit: {number} -> {first_digit}")
                    return first_digit
                second_digit = int(cleaned[1])
                if 1 <= second_digit <= 27:
                    logger.info(f"Corrected spurious digit: {number} -> {second_digit}")
                    return second_digit
            
            logger.warning(f"Invalid number: {number} (outside 1-27 range)")
            return None
        
        return number
    
    async def recognize_number(self, image: Image.Image) -> dict:
        """
        Reconhece número em uma célula de criptograma.
        Tries all 3 preprocessing strategies and returns the best result.
        Early exits when confidence > 0.95 is found.
        """
        best_result = {
            "number": None,
            "confidence": 0.0,
            "rawText": ""
        }
        
        strategies = self.preprocess_image_strategies(image)
        strategy_names = ["binary_otsu", "clahe_grayscale", "adaptive_denoise"]
        
        for i, (processed, strategy_name) in enumerate(zip(strategies, strategy_names)):
            try:
                results = self.reader.readtext(
                    processed,
                    detail=1,
                    paragraph=False,
                    contrast_ths=0.10,
                    text_threshold=0.7,
                    low_text=0.4,
                )
                
                if results:
                    best = max(results, key=lambda x: x[2])
                    text, confidence = best[1], best[2]
                    
                    logger.info(f"[{strategy_name}] OCR raw: text='{text}', confidence={confidence:.2f}")
                    
                    number = self.sanitize_number(text)
                    
                    if number is not None and confidence > best_result["confidence"]:
                        best_result = {
                            "number": number,
                            "confidence": float(confidence),
                            "rawText": text
                        }
                        logger.info(f"[{strategy_name}] New best: number={number}, confidence={confidence:.2f}")
                        
                        # Early exit on high confidence
                        if confidence > 0.95:
                            logger.info(f"[{strategy_name}] Early exit: confidence > 0.95")
                            return best_result
            
            except Exception as e:
                logger.error(f"[{strategy_name}] Recognition failed: {str(e)}")
        
        if best_result["number"] is None:
            logger.warning(f"All strategies failed for image")
        
        return best_result
    
    async def recognize_batch(self, images: list[Image.Image]) -> list[dict]:
        """
        Processa múltiplas imagens em batch sequentially.
        EasyOCR's readtext() is CPU-bound (neural network inference),
        so asyncio.gather won't provide true parallelism due to Python's GIL.
        Sequential processing avoids thread contention and is more predictable.
        """
        results = []
        for img in images:
            result = await self.recognize_number(img)
            results.append(result)
        return results
