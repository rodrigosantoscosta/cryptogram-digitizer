# Cryptogram Digitizer

Aplicação web que converte imagens de puzzles de criptograma em versões digitais interativas, permitindo que você resolva os puzzles diretamente no navegador com estética inspirada nas **Cruzadas do G1 Globo**.

---

##  Funcionalidades

-  **Upload de imagem** — suporta fotos e scans de criptogramas em tabela
-  **Detecção automática de grade** — algoritmo FFT com erosão morfológica 1D detecta linhas e colunas mesmo com bordas parcialmente apagadas
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
- ![Tesseract](https://img.shields.io/badge/Tesseract.js-4285F4?style=flat&logo=google&logoColor=white)
- ![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat&logo=vitest&logoColor=white) ![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=flat&logo=playwright&logoColor=white)

## Como rodar

### Pré-requisitos

- Node.js 18+
- npm ou pnpm

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

