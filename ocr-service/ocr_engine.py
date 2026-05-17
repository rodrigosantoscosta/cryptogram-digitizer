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
from typing import Optional, List

logger = logging.getLogger(__name__)

class OCREngine:
    """Engine de OCR baseado em EasyOCR com multi-strategy preprocessing"""
    
    def __init__(self):
        self.reader = None
        self._has_gpu = torch.cuda.is_available()
        
        self.config = {
            'lang_list': ['en'],
            'gpu': False,
            'model_storage_directory': './models',
            'download_enabled': True,
            'verbose': False,
            'recog_network': 'cryptogram_digits',  # Custom trained model
        }
    
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
    
    def _preprocess_binary_otsu(self, image: Image.Image) -> np.ndarray:
        """
        Strategy 1: Binary + Otsu threshold
        - Good for clear, high-contrast images
        - Baseline approach
        """
        img_array = np.array(image)
        
        if len(img_array.shape) == 3:
            gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        else:
            gray = img_array
        
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        edge_pixels = np.concatenate([
            binary[0, :], binary[-1, :], binary[:, 0], binary[:, -1]
        ])
        edge_mean = np.mean(edge_pixels)
        
        if edge_mean > 128:
            binary = cv2.bitwise_not(binary)
        
        return self._finalize_image(binary)
    
    def _preprocess_clahe_grayscale(self, image: Image.Image) -> np.ndarray:
        """
        Strategy 2: CLAHE contrast enhancement + grayscale
        - Better for low-contrast or faded images
        - Preserves more detail than binary
        """
        img_array = np.array(image)
        
        if len(img_array.shape) == 3:
            gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        else:
            gray = img_array
        
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        
        return self._finalize_image(enhanced)
    
    def _preprocess_adaptive_denoise(self, image: Image.Image) -> np.ndarray:
        """
        Strategy 3: Adaptive threshold + aggressive denoising
        - Best for noisy or blurry images
        - Handles uneven lighting
        """
        img_array = np.array(image)
        
        if len(img_array.shape) == 3:
            gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        else:
            gray = img_array
        
        denoised = cv2.fastNlMeansDenoising(gray, h=10, templateWindowSize=7, searchWindowSize=21)
        
        adaptive = cv2.adaptiveThreshold(
            denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 11, 2
        )
        
        edge_pixels = np.concatenate([
            adaptive[0, :], adaptive[-1, :], adaptive[:, 0], adaptive[:, -1]
        ])
        edge_mean = np.mean(edge_pixels)
        
        if edge_mean > 128:
            adaptive = cv2.bitwise_not(adaptive)
        
        return self._finalize_image(adaptive)
    
    def _finalize_image(self, img: np.ndarray) -> np.ndarray:
        """Common finalization: upscale, padding, convert to RGB"""
        target_height = 128
        aspect_ratio = img.shape[1] / img.shape[0]
        target_width = max(int(target_height * aspect_ratio), 64)
        
        resized = cv2.resize(
            img, 
            (target_width, target_height), 
            interpolation=cv2.INTER_LANCZOS4
        )
        
        pad_y = int(target_height * 0.3)
        pad_x = int(target_width * 0.3)
        
        padded = cv2.copyMakeBorder(
            resized, pad_y, pad_y, pad_x, pad_x,
            cv2.BORDER_CONSTANT, value=0
        )
        
        return cv2.cvtColor(padded, cv2.COLOR_GRAY2RGB)
    
    def preprocess_image_strategies(self, image: Image.Image) -> List[np.ndarray]:
        """Returns 3 different preprocessed versions for multi-strategy OCR"""
        return [
            self._preprocess_binary_otsu(image),
            self._preprocess_clahe_grayscale(image),
            self._preprocess_adaptive_denoise(image),
        ]
    
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
            
            except Exception as e:
                logger.error(f"[{strategy_name}] Recognition failed: {str(e)}")
        
        if best_result["number"] is None:
            logger.warning(f"All strategies failed for image")
        
        return best_result
    
    async def recognize_batch(self, images: list[Image.Image]) -> list[dict]:
        """
        Processa múltiplas imagens em batch.
        """
        results = []
        for image in images:
            result = await self.recognize_number(image)
            results.append(result)
        return results
