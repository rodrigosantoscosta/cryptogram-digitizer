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
