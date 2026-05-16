# Extração de Pistas — Estado Final (2026-05-10)

## Resultado validado (Playwright CLI, sample.jpg)
- Score: 11/11 pistas com similaridade >= 60%
- 4 pistas com 100% de similaridade exata
- Pipeline completo sem erros

## Arquitetura da Fase 5 (OCR das pistas)

### Abordagem: coluna inteira com PSM.SINGLE_COLUMN
Em vez de extrair 12 células individuais, extrai a coluna de pistas (col=0) inteira
de uma só vez. O Tesseract lê em contexto contínuo sem bordas horizontais entre células.
Mapeamento de palavras → linhas da grade é feito por coordenadas Y do HOCR.

### Pipeline
1. GridDetector.extractColumnSlice(imageData, col=0, grid, marginX=4)
   → fatia vertical col=0 sem bordas: 202×739px
2. ImageProcessor.preprocessClueCell(slice)
   → grayscale + GaussianBlur(3,3,0.5) + resize 2× INTER_CUBIC
   → CLAHE(2.0, 16×16) + adaptiveThreshold(THRESH_BINARY, 31, 10)
   → MORPH_CLOSE(2×2) → 404×1478px
3. OCREngine.recognizeColumn(processed, grid.rowPositions, scaleFactor=2)
   → PSM.SINGLE_COLUMN, output hocr:true+blocks:true
   → extrai palavras via data.blocks (hierarquia) ou HOCR regex fallback
   → mapeia cada palavra à linha da grade pelo centro Y mais próximo
   → retorna ClueResult[] com confidence real (média por linha)
4. postProcessText: filtra tokens sem letra/dígito (remove |, *, :, ' isolados)
   → capitaliza primeira letra por linha

### Novos métodos
- GridDetector.extractColumnSlice(imageData, col, grid, marginX=4): ImageData
- ImageProcessor.preprocessClueCell(cellImage): ImageData
- OCREngine.recognizeColumn(columnImage, rowPositions, scaleFactor): Promise<ClueResult[]>

### Arquivos modificados
- src/lib/image-processing/GridDetector.ts (extractColumnSlice)
- src/lib/image-processing/ImageProcessor.ts (preprocessClueCell)
- src/lib/ocr/OCREngine.ts (recognizeColumn, postProcessText corrigido)
- src/hooks/useImageProcessor.ts (Fase 5 refatorada)

### Limitações conhecidas
- Pista 6 não comparada no ground truth (shift de índice na comparação)
- Pista 7: "musical" → "musteal" (artefato JPEG)
- Pista 8: "Plural" → "Plaal" (conf=34%, abaixo da média)
- Pista 9: "(pl.)" → "(PH)" (abreviatura mal reconhecida)
- Script de teste: scripts/test-clues.cjs
