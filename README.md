# Cryptogram Digitizer

Aplicação web que converte imagens de puzzles de criptograma em versões digitais interativas, permitindo que você resolva os puzzles diretamente no navegador com estética inspirada nas **Cruzadas do G1 Globo**.

---

##  Funcionalidades

-  **Upload de imagem** — suporta fotos e scans de criptogramas em tabela
-  **Detecção automática de grade** — algoritmo FFT com erosão morfológica 1D detecta linhas e colunas mesmo com bordas parcialmente apagadas
-  **OCR de números** — reconhecimento automático dos números nas células via EasyOCR (Docker) + Tesseract.js (fallback)
-  **OCR das pistas** — extração automática do texto da coluna de pistas via Tesseract.js
-  **Mapeamento símbolo → letra** — interface visual para associar cada símbolo único a uma letra
-  **Grade jogável** — resolva o criptograma no navegador com navegação por teclado, timer e barra de progresso
-  **Persistência local** — puzzles salvos via Zustand + IndexedDB

---

## Stack

- ![React](https://img.shields.io/badge/React_18-20232A?style=flat&logo=react&logoColor=61DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
- ![Tailwind](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white) ![Lucide](https://img.shields.io/badge/Lucide_React-F56565?style=flat&logo=lucide&logoColor=white)
- ![React Router](https://img.shields.io/badge/React_Router_6-CA4245?style=flat&logo=reactrouter&logoColor=white)
- ![Zustand](https://img.shields.io/badge/Zustand-443E38?style=flat&logo=react&logoColor=white)
- ![OpenCV](https://img.shields.io/badge/OpenCV.js_WASM-5C3EE8?style=flat&logo=opencv&logoColor=white)
- ![EasyOCR](https://img.shields.io/badge/EasyOCR-FF6B6B?style=flat&logo=python&logoColor=white) ![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white) ![Fastify](https://img.shields.io/badge/Fastify-000000?style=flat&logo=fastify&logoColor=white) ![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)
- ![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat&logo=vitest&logoColor=white) ![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=flat&logo=playwright&logoColor=white)

## Como rodar

### Pré-requisitos

- Node.js 18+
- npm ou pnpm
- Docker e Docker Compose (para OCR com EasyOCR)

### Instalação

```bash
git clone https://github.com/rodrigosantoscosta/cryptogram-digitizer.git
cd cryptogram-digitizer
npm install
```

### Dev

```bash
npm run dev
```

Acesse `http://localhost:5173`. Para a página de diagnóstico do pipeline: `http://localhost:5173/test`.

### Build

```bash
npm run build
```

---

## Docker (OCR Service)

O OCR de números das células utiliza EasyOCR rodando em containers Docker para melhor precisão (>85% de acurácia).

### Subir todos os serviços

```bash
docker compose up -d
```

Isso inicia:
- **OCR Service** (Python FastAPI + EasyOCR CPU) — porta 5000
- **Backend API** (Node.js Fastify) — porta 4000

### Desenvolvimento com hot-reload

```bash
docker compose -f docker-compose.dev.yml up -d
```

### Verificar status

```bash
docker compose ps
docker compose logs -f ocr-service
```

### Parar serviços

```bash
docker compose down
```

### Arquitetura OCR

```
Frontend (React:5173) → Backend (Fastify:4000) → OCR Service (FastAPI:5000)
```

---

## Ground Truth Testing

Framework para comparar a saída do pipeline OCR com dados de referência validados manualmente, medindo acurácia, precisão, recall e distância de edição.

### Criando ground truth

Crie um arquivo JSON em `tests/fixtures/ground-truth/{puzzleId}.json`:

```json
{
  "puzzleId": "sample",
  "sourceImage": "samples/sample_1.jpg",
  "type": "numeric",
  "dimensions": { "rows": 12, "cols": 8 },
  "valueRange": { "min": 1, "max": 27 },
  "grid": [
    [1, 26, 12, 3, 10, 26, 2, 13],
    [13, 1, 19, 14, 26, 12, 18, 3]
  ],
  "frequency": { "26": 18, "2": 10 },
  "metadata": {
    "validatedBy": "manual",
    "validatedAt": "2026-06-07T00:00:00Z",
    "notes": "Descrição opcional"
  }
}
```

Valide o schema: `JSON Schema` disponível em `tests/fixtures/ground-truth-schema.json`.

### Rodando comparações

```bash
# Todos os puzzles com ground truth
npm run test:ground-truth

# Com threshold de 85% (CI)
npm run test:ground-truth:ci
```

Ou diretamente:

```bash
node tests/scripts/run-ground-truth.mjs --all --threshold 85
```

### Interpretando o relatório HTML

Após executar, o relatório HTML é gerado em `tests/results/batch/{runId}.html` com:

- **Métricas gerais**: acurácia, precisão, recall, F1, cobertura
- **Grade lado a lado**: esperado vs. obtido, com cores:
  - Verde = correto
  - Vermelho = incorreto
  - Amarelo = ausente (esperado mas não reconhecido)
  - Cinza = abortado (pipeline interrompido)
- **Tabela de discrepâncias**: lista detalhada com row/col, valor esperado/obtido, confiança
- **Métricas por dígito**: breakdown de precision/recall/F1 para cada símbolo (1–27)

### Histórico de acurácia

Resultados são persistidos em `tests/results/{puzzleId}/{timestamp}.json` para rastrear tendências ao longo do tempo:

```typescript
import { getAccuracyTrend } from '../../src/lib/testing/result-store';
const trend = await getAccuracyTrend('sample');
// [{ timestamp: '...', accuracy: 0.95 }, ...]
```

---

## Changelog

### 1.0.0 (2026-06)

- **Batch processing** — suporte para processar múltiplas imagens de criptograma em lote
- **Hybrid training pipeline** — pipeline de treinamento híbrido com extração de células, pseudo-labeling e dataset builder
- **OCR accuracy improvements** — EasyOCR em Docker (85%+ acurácia), fallback Tesseract.js, custom model training infraestrutura
- **Cell Number Reader** — PSM.SINGLE_WORD, retry cascade, dynamic upscale, polarity detection, equalizeHist + CLAHE, digit sanitizer
- **Ground Truth Testing** — framework de comparação com relatório HTML, métricas por dígito, histórico de acurácia
- **263 unit tests** — cobertura de testes com Vitest, jsdom polyfills
- **Grid detection** — FFT com projeção como método primário de detecção de grade
- **SPA restructure** — arquitetura React + TypeScript com roteamento e estado global
- **Numeric OCR** — reconhecimento de números com overlay de diagnóstico
- **Clue OCR** — extração de texto da coluna de pistas via Tesseract.js PSM.SINGLE_COLUMN

### 0.1.0 (2026-05)

- Prova de conceito inicial com pipeline OCR básico
- Upload de imagem e detecção de grade via OpenCV.js
- Interface React funcional com etapa de mapeamento símbolo → letra
