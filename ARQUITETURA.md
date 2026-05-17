# Arquitetura: EasyOCR com Docker

## Visão Geral do Sistema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CRIPTOGRAMA DIGITIZER                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐      HTTP/JSON      ┌──────────────┐      HTTP/JSON      │
│  │   Frontend   │ ──────────────────→ │   Backend    │ ──────────────────→ │
│  │  (React/TS)  │ ←────────────────── │  (Fastify)   │ ←────────────────── │
│  │  Port: 5173  │                     │  Port: 4000  │                     │
│  └──────────────┘                     ──────────────┘                     │
│         │                                    │                              │
│         │                                    │                              │
│         ▼                                    ▼                              │
│  ┌──────────────┐                     ┌──────────────┐                     │
│  │ Grid Detect  │                     │ OCR Service  │                     │
│  │ (OpenCV.js)  │                     │  (FastAPI)   │                     │
│  │              │                     │  Port: 5000  │                     │
│  │ • HoughLines │                     │              │                     │
│  │ • Cell Crop  │                     │  ┌────────  │                     │
│  │ • Margins    │                     │  │EasyOCR │  │                     │
│  └──────────────┘                     │  │PyTorch │  │                     │
│                                       │  └────────┘  │                     │
│                                       │  CPU Only    │                     │
│                                       └──────────────┘                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Fluxo de Dados

### 1. Upload e Processamento Inicial

```
Usuário
   │
   ▼
┌─────────────────────────────────────────┐
│         Frontend (React/TS)             │
│                                         │
│  1. Usuário faz upload da imagem        │
│  2. Converte para ImageData             │
│  3. Chama processImage()                │
└─────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────┐
│      Grid Detection (OpenCV.js)         │
│                                         │
│  1. Detecta linhas da grade             │
│  2. Calcula posições de células         │
│  3. Extrai células individuais          │
│  4. Aplica margens internas             │
└─────────────────────────────────────────┘
   │
   ▼
Array de ImageData (96 células)
```

### 2. OCR Batch Processing

```
Array de ImageData (96 células)
   │
   ▼
┌─────────────────────────────────────────┐
│      OCRApiClient (Frontend)            │
│                                         │
│  1. Converte ImageData → base64         │
│  2. Agrupa em chunks de 16              │
│  3. Envia POST /api/ocr/batch           │
└─────────────────────────────────────────┘
   │
   │ HTTP POST /api/ocr/batch
   │ Body: { cells: [{ id, imageData }, ...] }
   ▼
┌─────────────────────────────────────────┐
│      Backend (Fastify/Node.js)          │
│                                         │
│  1. Recebe request                      │
│  2. Valida dados                        │
│  3. Encaminha para OCR Service          │
│  4. Agrega resultados                   │
└─────────────────────────────────────────┘
   │
   │ HTTP POST http://ocr-service:5000/api/ocr/cell
   │ (16 requests paralelos)
   ▼
┌─────────────────────────────────────────┐
│      OCR Service (FastAPI/Python)       │
│                                         │
│  1. Recebe imagem base64                │
│  2. Decodifica para PIL Image           │
│  3. Pré-processa (binary + resize)      │
│  4. EasyOCR.readtext()                  │
│  5. Retorna { number, confidence, text }│
└─────────────────────────────────────────┘
   │
   │ Response: { number: 26, confidence: 0.95, rawText: "26" }
   ▼
┌─────────────────────────────────────────┐
│      Backend (Fastify/Node.js)          │
│                                         │
│  1. Recebe respostas                    │
│  2. Formata para frontend               │
│  3. Retorna array de resultados         │
└─────────────────────────────────────────┘
   │
   │ HTTP Response
   ▼
┌─────────────────────────────────────────┐
│      OCRApiClient (Frontend)            │
│                                         │
│  1. Recebe resultados                   │
│  2. Converte para CellNumber[]          │
│  3. Aplica correções:                   │
│     • fixSpuriousDigits()               │
│     • validateKnownPositions()          │
│  4. Template matching (fallback)        │
└─────────────────────────────────────────┘
   │
   ▼
CellNumberMap { cells, bySymbol, recognized, total }
```

---

## Componentes Detalhados

### Frontend (React/TypeScript)

**Responsabilidades:**
- Grid detection com OpenCV.js
- Extração de células
- Chamadas HTTP para backend
- Correções pós-OCR
- Template matching (fallback)
- UI/UX

**Arquivos Principais:**
- `src/lib/ocr/CellNumberReader.ts` - Orquestrador principal
- `src/lib/ocr/OCRApiClient.ts` - Cliente HTTP
- `src/hooks/useImageProcessor.ts` - Hook de processamento
- `src/components/CellNumberOverlay/` - UI de visualização

### Backend (Node.js/Fastify)

**Responsabilidades:**
- API REST para frontend
- Comunicação com OCR service
- Batch processing
- Error handling
- Logging

**Endpoints:**
- `POST /api/ocr/cell` - OCR de uma célula
- `POST /api/ocr/batch` - OCR de múltiplas células
- `GET /api/ocr/health` - Health check

**Arquivos Principais:**
- `src/index.ts` - Server setup
- `src/routes/ocr.ts` - Rotas
- `src/services/ocrService.ts` - Lógica de OCR

### OCR Service (Python/FastAPI)

**Responsabilidades:**
- Inicialização do EasyOCR
- Pré-processamento de imagens
- Reconhecimento de texto
- Batch processing

**Endpoints:**
- `POST /api/ocr/cell` - Reconhece número em uma célula
- `POST /api/ocr/batch` - Reconhece múltiplas células
- `GET /health` - Health check

**Arquivos Principais:**
- `main.py` - FastAPI server
- `ocr_engine.py` - EasyOCR wrapper
- `requirements.txt` - Dependências Python

---

## Comunicação entre Serviços

### Frontend → Backend

```typescript
// Request
POST http://localhost:4000/api/ocr/batch
Content-Type: application/json

{
  "cells": [
    { "id": "cell_0", "imageData": "base64..." },
    { "id": "cell_1", "imageData": "base64..." },
    // ... até 16 células por chunk
  ]
}

// Response
{
  "results": [
    { "id": "cell_0", "number": 26, "confidence": 0.95, "rawText": "26" },
    { "id": "cell_1", "number": 12, "confidence": 0.88, "rawText": "12" },
    // ...
  ]
}
```

### Backend → OCR Service

```python
# Request
POST http://ocr-service:5000/api/ocr/cell
Content-Type: multipart/form-data

file: cell.png (binary)

# Response
{
  "number": 26,
  "confidence": 0.95,
  "rawText": "26"
}
```

---

## Docker Networking

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network                            │
│                     (bridge)                                 │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   frontend   │  │   backend    │  │ ocr-service  │      │
│  │  :5173       │  │  :4000       │  │  :5000       │      │
│  │              │  │              │  │              │      │
│  │  Exposto     │  │  Exposto     │  │  Interno     │      │
│  │  para host   │  │  para host   │  │  (backend    │      │
│  │              │  │              │  │   apenas)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
│                     Comunicação interna:                     │
│                     frontend → backend:4000                  │
│                     backend → ocr-service:5000               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Fluxo de Erros

```
┌─────────────────────────────────────────────────────────────┐
│                    Tratamento de Erros                       │
└─────────────────────────────────────────────────────────────┘

Frontend
   │
   ├── Success → Processa resultados
   │
   └── Error (Backend indisponível)
        │
        ├── ❌ Sem fallback (EasyOCR only)
        │   └── Mostra erro para usuário
        │
        └── Timeout (> 5s por célula)
             │
             └── Marca célula como não reconhecida

Backend
   │
   ├── Success → Retorna resultados
   │
   └── Error (OCR Service indisponível)
        │
        ├── ❌ Sem fallback (EasyOCR only)
        │   └── Retorna 503 Service Unavailable
        │
        └── Timeout (> 5s)
             │
             └── Retorna 504 Gateway Timeout

OCR Service
   │
   ├── Success → Retorna { number, confidence, rawText }
   │
   └── Error (EasyOCR falhou)
        │
        ├── Retorna { number: null, confidence: 0, rawText: "" }
        │
        └── Error (Modelo não carregado)
             │
             └── Retorna 500 Internal Server Error
```

---

## Escalabilidade

### Horizontal (CPU Only)

```
┌─────────────────────────────────────────────────────────────┐
│                    Escalabilidade Horizontal                 │
└─────────────────────────────────────────────────────────────┘

Frontend (1 instância)
   │
   ▼
Backend (1-2 instâncias)
   │
   ├──→ OCR Service (instância 1)
   ├──→ OCR Service (instância 2)
   └──→ OCR Service (instância N)
   
   Load balancing via Docker Compose
   ou reverse proxy (nginx/traefik)
```

### Batch Processing

```
96 células
   │
   ├── Chunk 1: 16 células → OCR Service
   ├── Chunk 2: 16 células → OCR Service
   ├── Chunk 3: 16 células → OCR Service
   ├── Chunk 4: 16 células → OCR Service
   ├── Chunk 5: 16 células → OCR Service
   └── Chunk 6: 16 células → OCR Service
   
   Processamento paralelo dentro de cada chunk
   Tempo total: ~30-50 segundos (CPU)
```

---

## Monitoramento

### Métricas

```
┌─────────────────────────────────────────────────────────────┐
│                       Monitoramento                          │
└─────────────────────────────────────────────────────────────┘

Frontend:
   • Tempo de processamento total
   • Número de células processadas
   • Taxa de sucesso/falha

Backend:
   • Requests por segundo
   • Latência média
   • Taxa de erro
   • Uso de memória

OCR Service:
   • Tempo por célula
   • Acurácia (vs ground truth)
   • Uso de CPU
   • Uso de memória
```

### Health Checks

```yaml
# docker-compose.yml

services:
  ocr-service:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s  # Tempo para carregar modelos
  
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

**Documento criado em:** 2026-05-16
**Versão:** 1.0
