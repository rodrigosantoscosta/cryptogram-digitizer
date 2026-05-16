"""
EasyOCR Engine - Wrapper para reconhecimento de números em criptogramas

Este módulo encapsula o EasyOCR com configurações otimizadas para
reconhecimento de números em células de criptograma.

Otimizações:
- Upscale para 64px de altura (EasyOCR precisa de imagens maiores)
- Grayscale simples com bom contraste
- Padding branco ao redor do dígitos
- Configurações específicas para dígitos
"""

import easyocr
import cv2
import numpy as np
from PIL import Image
import torch
import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class OCREngine:
    """Engine de OCR baseado em EasyOCR"""
    
    def __init__(self):
        self.reader = None
        self._has_gpu = torch.cuda.is_available()
        
        self.config = {
            'lang_list': ['en'],
            'gpu': False,
            'model_storage_directory': './models',
            'download_enabled': True,
            'verbose': False,
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
    
    def preprocess_image(self, image: Image.Image) -> np.ndarray:
        """
        Pré-processa imagem para otimizar reconhecimento de números.
        
        Pipeline (v4 - binary + upscale agressivo):
        1. Converter para grayscale
        2. Binary threshold (Otsu) - texto branco em fundo preto
        3. Inverter polarity se necessário
        4. Upscale para 128px de altura
        5. Padding branco significativo
        6. Converter de volta para RGB
        """
        img_array = np.array(image)
        
        # Converter para grayscale se necessário
        if len(img_array.shape) == 3:
            gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        else:
            gray = img_array
        
        # Binary threshold com Otsu
        _, binary = cv2.threshold(
            gray, 0, 255, 
            cv2.THRESH_BINARY + cv2.THRESH_OTSU
        )
        
        # Verificar se precisa inverter (texto deve ser branco em fundo preto)
        # Calcular média dos pixels de borda
        edge_pixels = np.concatenate([
            binary[0, :], binary[-1, :], binary[:, 0], binary[:, -1]
        ])
        edge_mean = np.mean(edge_pixels)
        
        # Se borda é clara (>128), inverter para texto branco em fundo preto
        if edge_mean > 128:
            binary = cv2.bitwise_not(binary)
        
        # Upscale agressivo para 128px de altura
        target_height = 128
        aspect_ratio = binary.shape[1] / binary.shape[0]
        target_width = max(int(target_height * aspect_ratio), 64)
        
        resized = cv2.resize(
            binary, 
            (target_width, target_height), 
            interpolation=cv2.INTER_CUBIC
        )
        
        # Adicionar padding branco significativo (30% de cada lado)
        pad_y = int(target_height * 0.3)
        pad_x = int(target_width * 0.3)
        
        padded = cv2.copyMakeBorder(
            resized, pad_y, pad_y, pad_x, pad_x,
            cv2.BORDER_CONSTANT, value=0  # Preto (fundo)
        )
        
        # EasyOCR espera RGB, converter de volta
        rgb = cv2.cvtColor(padded, cv2.COLOR_GRAY2RGB)
        
        return rgb
    
    def sanitize_number(self, text: str) -> Optional[int]:
        """
        Sanitiza texto extraído para extrair apenas números válidos.
        """
        digits = re.sub(r'[^0-9]', '', text)
        
        if not digits:
            return None
        
        try:
            number = int(digits)
        except ValueError:
            return None
        
        if number < 1 or number > 27:
            if len(digits) == 2:
                first_digit = int(digits[0])
                if 1 <= first_digit <= 27:
                    logger.info(f"Corrected spurious digit: {number} → {first_digit}")
                    return first_digit
            
            logger.warning(f"Invalid number: {number} (outside 1-27 range)")
            return None
        
        return number
    
    async def recognize_number(self, image: Image.Image) -> dict:
        """
        Reconhece número em uma célula de criptograma.
        """
        try:
            processed = self.preprocess_image(image)
            
            results = self.reader.readtext(
                processed,
                detail=1,
                paragraph=False,
            )
            
            if results:
                best = max(results, key=lambda x: x[2])
                text, confidence = best[1], best[2]
                
                logger.info(f"OCR raw: text='{text}', confidence={confidence:.2f}")
                
                number = self.sanitize_number(text)
                
                logger.info(f"OCR result: number={number}, confidence={confidence:.2f}")
                
                return {
                    "number": number,
                    "confidence": float(confidence),
                    "rawText": text
                }
            
            return {
                "number": None,
                "confidence": 0.0,
                "rawText": ""
            }
        
        except Exception as e:
            logger.error(f"Recognition failed: {str(e)}")
            return {
                "number": None,
                "confidence": 0.0,
                "rawText": "",
                "error": str(e)
            }
    
    async def recognize_batch(self, images: list[Image.Image]) -> list[dict]:
        """
        Processa múltiplas imagens em batch.
        """
        results = []
        for image in images:
            result = await self.recognize_number(image)
            results.append(result)
        return results
