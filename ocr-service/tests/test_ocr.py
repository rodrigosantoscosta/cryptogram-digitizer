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
    img_array = np.zeros((50, 100), dtype=np.uint8)
    img_array[10:40, 10:30] = 255
    img_array[10:40, 40:60] = 255
    
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
