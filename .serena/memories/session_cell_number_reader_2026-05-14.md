# Session: CellNumberReader — detecção de números nas células (2026-05-14)

## Status: ✅ tsc 0 erros | build OK (107 modules, 972ms)

## O que foi criado
- `src/lib/ocr/CellNumberReader.ts` — módulo dedicado à leitura de números inteiros nas células

## Arquitetura do CellNumberReader
### Exports
- `CellNumber` — { row, col, number: number|null, confidence, rawText }
- `CellNumberMap` — { cells, bySymbol, recognized, total }
- `preprocessNumberCell(cellImage)` — pré-processa ImageData para OCR de dígitos
- `CellNumberReader` — classe com initialize/terminate/readAllCells
- `CellNumberReader.read(image, grid, onProgress?)` — factory estático (cria+usa+destrói worker)

### Pipeline de preprocessNumberCell
1. Grayscale
2. Resize 4× (INTER_CUBIC) — dígitos pequenos exigem upscale agressivo
3. GaussianBlur(3×3, σ=0.5)
4. adaptiveThreshold(THRESH_BINARY_INV, 15, 8) — fundo preto / texto branco
5. MORPH_CLOSE 2×2

### Tesseract config
- lang: 'eng' (suficiente para dígitos)
- PSM.SINGLE_CHAR
- whitelist: '0123456789'
- Worker único reutilizado para todas as células (~10× mais rápido)

### extractCellInner
- Corta célula com margem interna de 3px (evita bordas da grade)
- Usa canvas drawImage sobre imagem original (RGBA)

## Integração no pipeline (useImageProcessor.ts)
- Nova Fase 3.5 entre detecção de grade (25-40%) e extração de símbolos (55%)
- Progresso: 47% → 55% durante leitura
- Resultado em ProcessedData.cellNumbers: CellNumberMap | null (null se falhar)
- Falha gracefully: try/catch, continua pipeline mesmo sem números

## Tipos atualizados
- `src/types/ocr.ts` — re-exporta CellNumberMap de @/lib/ocr/CellNumberReader
- `src/types/puzzle.ts` — ProcessedData.cellNumbers: CellNumberMap | null

## Fixes de compatibilidade
- `src/pages/MappingPage.tsx` — fallback ProcessedData agora inclui cellNumbers: null
- `src/testing/test-utils.tsx` — makeProcessedData() inclui cellNumbers: null
