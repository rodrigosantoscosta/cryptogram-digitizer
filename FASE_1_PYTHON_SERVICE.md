# Fase 1: Python OCR Service (FastAPI + EasyOCR)

## Objetivo

Criar o serviço Python que roda EasyOCR e expõe uma API REST via FastAPI para processamento de OCR de células de criptograma.

**Duração Estimada:** 2-3 dias
**Dependências:** Nenhuma

---

## Estrutura de Arquivos

```
ocr-service/
├── main.py                 # FastAPI server
├── ocr_engine.py           # EasyOCR wrapper
├── requirements.txt        # Dependências Python
├── Dockerfile              # Containerização
├── models/                 # Cache de modelos EasyOCR (gerado automaticamente)
└── tests/
    └── test_ocr.py         # Testes unitários
```

---

## 1.1 FastAPI Server

**Arquivo:** `ocr-service/main.py`

```python
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

# Configuração de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Cryptogram OCR Service",
    description="EasyOCR-based service for cryptogram cell number recognition",
    version="1.0.0"
)

# CORS para permitir chamadas do Node.js backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configurar para produção: ["http://localhost:4000"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instância global do OCR engine
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
    
    Request:
        file: Imagem da célula (PNG/JPG)
    
    Response:
        {
            "number": 26,           # Número reconhecido (ou null)
            "confidence": 0.95,     # Confiança (0-1)
            "rawText": "26"         # Texto raw do OCR
        }
    """
    try:
        # Ler imagem do upload
        image_data = await file.read()
        
        # Validar tamanho da imagem (max 5MB)
        if len(image_data) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Image too large (max 5MB)")
        
        # Processar com EasyOCR
        image = Image.open(io.BytesIO(image_data))
        result = await ocr_engine.recognize_number(image)
        
        logger.info(f"OCR result: number={result['number']}, confidence={result['confidence']:.2f}")
        
        return result
    
    except Exception as e:
        logger.error(f"OCR failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")

@app.post("/api/ocr/batch")
async def ocr_batch(files: list[UploadFile] = File(...)):
    """
    OCR de múltiplas células em batch.
    
    Recebe múltiplas imagens e retorna resultados para cada uma.
    
    Request:
        files: Lista de imagens das células (PNG/JPG)
    
    Response:
        {
            "results": [
                {"number": 26, "confidence": 0.95, "rawText": "26"},
                {"number": 12, "confidence": 0.88, "rawText": "12"},
                ...
            ]
        }
    """
    try:
        # Validar número de imagens (max 32 por batch)
        if len(files) > 32:
            raise HTTPException(status_code=400, detail="Too many images (max 32 per batch)")
        
        # Processar todas as imagens
        results = []
        for file in files:
            image_data = await file.read()
            image = Image.open(io.BytesIO(image_data))
            result = await ocr_engine.recognize_number(image)
            results.append(result)
        
        logger.info(f"Batch OCR completed: {len(results)} cells processed")
        
        return {"results": results}
    
    except Exception as e:
        logger.error(f"Batch OCR failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Batch OCR failed: {str(e)}")
```

---

## 1.2 EasyOCR Engine

**Arquivo:** `ocr-service/ocr_engine.py`

```python
"""
EasyOCR Engine - Wrapper para reconhecimento de números em criptogramas

Este módulo encapsula o EasyOCR com configurações otimizadas para
reconhecimento de números em células de criptograma.

Otimizações:
- Binary threshold para melhor contraste
- Resize para altura fixa de 32px (ideal para EasyOCR)
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
        
        # Configurações otimizadas para números
        self.config = {
            'lang_list': ['en'],  # Inglês para números
            'gpu': False,  # CPU only (configurar via env var se necessário)
            'model_storage_directory': './models',
            'download_enabled': True,
            'verbose': False,
            # Parâmetros de reconhecimento
            'contrast_ths': 0.1,  # Threshold para contraste
            'adjust_contrast': True,  # Auto-ajuste de contraste
            'decoder': 'greedy',  # Mais rápido que beamsearch
            'batch_size': 16,  # Processar em batch
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
        
        Pipeline:
        1. Converter para grayscale
        2. Binary threshold (Otsu)
        3. Resize para altura fixa de 32px
        4. Converter de volta para RGB (EasyOCR espera RGB)
        
        Args:
            image: PIL Image da célula
            
        Returns:
            np.ndarray: Imagem pré-processada (RGB)
        """
        # Converter para OpenCV (numpy array)
        img_array = np.array(image)
        
        # Converter para grayscale se necessário
        if len(img_array.shape) == 3:
            gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        else:
            gray = img_array
        
        # Binary threshold com Otsu
        # THRESH_BINARY_INV + THRESH_OTSU para texto escuro em fundo claro
        _, binary = cv2.threshold(
            gray, 0, 255, 
            cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
        )
        
        # Resize para altura fixa de 32px (ideal para EasyOCR)
        target_height = 32
        aspect_ratio = gray.shape[1] / gray.shape[0]
        target_width = max(int(target_height * aspect_ratio), 16)  # Mínimo 16px de largura
        
        resized = cv2.resize(
            binary, 
            (target_width, target_height), 
            interpolation=cv2.INTER_CUBIC
        )
        
        # EasyOCR espera RGB, converter de volta
        # Binary é grayscale, converter para 3 canais
        rgb = cv2.cvtColor(resized, cv2.COLOR_GRAY2RGB)
        
        return rgb
    
    def sanitize_number(self, text: str) -> Optional[int]:
        """
        Sanitiza texto extraído para extrair apenas números válidos.
        
        Regras:
        - Remove caracteres não numéricos
        - Converte para inteiro
        - Valida range (1-27 para criptogramas brasileiros)
        - Retorna None se inválido
        
        Args:
            text: Texto extraído pelo OCR
            
        Returns:
            int ou None: Número válido ou None
        """
        # Extrair apenas dígitos
        digits = re.sub(r'[^0-9]', '', text)
        
        if not digits:
            return None
        
        # Converter para inteiro
        try:
            number = int(digits)
        except ValueError:
            return None
        
        # Validar range (1-27 para criptogramas brasileiros)
        if number < 1 or number > 27:
            # Pode ser erro de OCR, tentar corrigir
            # Ex: "34" → "3", "24" → "2"
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
        
        Pipeline:
        1. Pré-processar imagem
        2. Executar EasyOCR
        3. Sanitizar resultado
        4. Retornar número, confiança e texto raw
        
        Args:
            image: PIL Image da célula
            
        Returns:
            dict: {
                "number": int | null,
                "confidence": float (0-1),
                "rawText": str
            }
        """
        try:
            # Pré-processar imagem
            processed = self.preprocess_image(image)
            
            # Executar EasyOCR
            results = self.reader.readtext(
                processed,
                detail=1,  # Retorna bounding box + texto + confiança
                **{k: v for k, v in self.config.items() if k not in ['lang_list', 'gpu', 'model_storage_directory', 'download_enabled', 'verbose']}
            )
            
            # Extrair melhor resultado
            if results:
                # Ordenar por confiança (decrescente)
                best = max(results, key=lambda x: x[2])
                text, confidence = best[1], best[2]
                
                # Sanitizar número
                number = self.sanitize_number(text)
                
                logger.debug(f"OCR: text='{text}', number={number}, confidence={confidence:.2f}")
                
                return {
                    "number": number,
                    "confidence": float(confidence),
                    "rawText": text
                }
            
            # Nenhum texto encontrado
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
        
        Args:
            images: Lista de PIL Images
            
        Returns:
            list[dict]: Lista de resultados
        """
        results = []
        for image in images:
            result = await self.recognize_number(image)
            results.append(result)
        return results
```

---

## 1.3 Dependencies

**Arquivo:** `ocr-service/requirements.txt`

```txt
# FastAPI e servidor
fastapi==0.109.0
uvicorn==0.27.0

# EasyOCR e dependências
easyocr==1.7.1
torch==2.2.0+cpu  # CPU only
torchvision==0.17.0+cpu  # CPU only
-f https://download.pytorch.org/whl/cpu

# Processamento de imagem
opencv-python-headless==4.9.0.80
Pillow==10.2.0
numpy==1.26.4

# Utilitários
python-multipart==0.0.9
```

---

## 1.4 Dockerfile

**Arquivo:** `ocr-service/Dockerfile`

```dockerfile
# Python OCR Service - Dockerfile
# CPU only, EasyOCR + FastAPI

FROM python:3.11-slim

# Definir variáveis de ambiente
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Instalar dependências do sistema para OpenCV
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements e instalar
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código
COPY . .

# Criar diretório para modelos
RUN mkdir -p ./models

# Pré-baixar modelos EasyOCR (evita download em runtime)
# Isso aumenta o tamanho da imagem, mas melhora o tempo de startup
RUN python -c "import easyocr; reader = easyocr.Reader(['en'], gpu=False, model_storage_directory='./models', verbose=False)"

# Expor porta
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Comando para rodar
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000", "--workers", "2", "--log-level", "info"]
```

---

## 1.5 Testes

**Arquivo:** `ocr-service/tests/test_ocr.py`

```python
"""
Testes unitários para o OCR Service
"""

import pytest
from fastapi.testclient import TestClient
from main import app
from PIL import Image
import io
import numpy as np

client = TestClient(app)

def test_health_check():
    """Testa health check do serviço"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "gpu" in data
    assert "version" in data

def test_ocr_cell_with_number():
    """Testa OCR com imagem contendo número"""
    # Criar imagem de teste com número "26"
    # Usar uma imagem simples preta com texto branco
    img_array = np.zeros((50, 100), dtype=np.uint8)
    # Desenhar "26" simples (apenas para teste)
    img_array[10:40, 10:30] = 255  # "2"
    img_array[10:40, 40:60] = 255  # "6"
    
    img = Image.fromarray(img_array, mode='L')
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    response = client.post(
        "/api/ocr/cell",
        files={"file": ("test.png", buffer, "image/png")}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "number" in data
    assert "confidence" in data
    assert "rawText" in data

def test_ocr_cell_empty():
    """Testa OCR com imagem vazia"""
    # Criar imagem totalmente branca (sem texto)
    img = Image.new('RGB', (100, 50), color='white')
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    response = client.post(
        "/api/ocr/cell",
        files={"file": ("empty.png", buffer, "image/png")}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["number"] is None
    assert data["confidence"] == 0.0
    assert data["rawText"] == ""

def test_ocr_cell_too_large():
    """Testa rejeição de imagem muito grande"""
    # Criar imagem grande (> 5MB)
    img = Image.new('RGB', (5000, 5000), color='white')
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    response = client.post(
        "/api/ocr/cell",
        files={"file": ("large.png", buffer, "image/png")}
    )
    
    assert response.status_code == 400
    assert "too large" in response.json()["detail"].lower()

def test_ocr_batch():
    """Testa OCR em batch"""
    # Criar múltiplas imagens de teste
    files = []
    for i in range(3):
        img = Image.new('RGB', (100, 50), color='white')
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        files.append(("files", (f"test_{i}.png", buffer, "image/png")))
    
    response = client.post(
        "/api/ocr/batch",
        files=files
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert len(data["results"]) == 3

def test_ocr_batch_too_many():
    """Testa rejeição de batch muito grande"""
    # Criar 33 imagens (> 32)
    files = []
    for i in range(33):
        img = Image.new('RGB', (100, 50), color='white')
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        files.append(("files", (f"test_{i}.png", buffer, "image/png")))
    
    response = client.post(
        "/api/ocr/batch",
        files=files
    )
    
    assert response.status_code == 400
    assert "too many" in response.json()["detail"].lower()
```

---

## 1.6 Configuração de Ambiente

**Arquivo:** `ocr-service/.env.example`

```bash
# OCR Service Environment Variables

# Server configuration
HOST=0.0.0.0
PORT=5000
WORKERS=2

# EasyOCR configuration
OCR_LANG=en
OCR_GPU=false
OCR_MODEL_DIR=./models

# Logging
LOG_LEVEL=info
```

---

## 1.7 Instruções de Desenvolvimento

### Setup Local (sem Docker)

```bash
# Entrar no diretório
cd ocr-service

# Criar virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate  # Windows

# Instalar dependências
pip install -r requirements.txt

# Rodar servidor
uvicorn main:app --reload --host 0.0.0.0 --port 5000

# Acessar documentação
# http://localhost:5000/docs (Swagger UI)
# http://localhost:5000/redoc (ReDoc)
```

### Setup com Docker

```bash
# Build da imagem
docker build -t ocr-service .

# Rodar container
docker run -p 5000:5000 ocr-service

# Testar health check
curl http://localhost:5000/health
```

### Testes

```bash
# Rodar testes
pytest tests/ -v

# Com coverage
pytest tests/ --cov=. --cov-report=html

# Abrir relatório de coverage
open htmlcov/index.html  # Mac/Linux
start htmlcov/index.html  # Windows
```

---

## 1.8 Métricas de Sucesso

| Métrica | Target | Como Medir |
|---------|--------|------------|
| **Startup time** | < 60s | Tempo para `/health` responder |
| **OCR time per cell** | < 0.5s | Benchmark com 96 células |
| **Memory usage** | < 1.5GB | `docker stats` |
| **Accuracy** | > 85% | Validação com ground truth |
| **Error rate** | < 5% | Logs de erro / total requests |

---

## 1.9 Checklist de Implementação

- [ ] Criar estrutura de arquivos
- [ ] Implementar `main.py` (FastAPI server)
- [ ] Implementar `ocr_engine.py` (EasyOCR wrapper)
- [ ] Criar `requirements.txt`
- [ ] Criar `Dockerfile`
- [ ] Implementar testes unitários
- [ ] Testar localmente (sem Docker)
- [ ] Testar com Docker
- [ ] Validar com imagens de teste
- [ ] Documentar API (Swagger UI)

---

**Documento criado em:** 2026-05-16
**Versão:** 1.0
**Status:** Pronto para implementação
