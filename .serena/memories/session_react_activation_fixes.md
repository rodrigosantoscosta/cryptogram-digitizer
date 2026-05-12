# session_react_activation_fixes — atualizado 2026-05-10

## Status do pipeline: FUNCIONANDO END-TO-END

### Resultado validado com sample.jpg (Playwright headless):
- GridDetector ✓ FFT Projeção: 12 linhas × 9 colunas
- SymbolExtractor: 96 símbolos extraídos (sem erros)
- SymbolClassifier: 9 clusters únicos identificados
- Pipeline completo sem erros WASM

---

## Fixes aplicados nesta sessão

### 1. useImageProcessor.ts — imagens corretas por fase
- GridDetector.detect() recebe `imageData` (original RGBA), NÃO a preprocessada
- SymbolExtractor.extractAllSymbolsFromGrid() recebe `imageData` (original RGBA)
- GridDetector.extractCell() para OCR recebe `imageData`
- Motivo: GridDetector faz sua própria binarização; extractCell usa cv.imshow que precisa de RGBA

### 2. SymbolExtractor.ts — compatibilidade RGBA
Problema raiz: cv.matFromImageData sempre cria Mat RGBA (4 canais).
Operações OpenCV que exigem 1 canal falhavam silenciosamente com erro WASM numérico.

Métodos corrigidos:
- isEmpty(): countNonZero → converter para gray antes
- removeBackground(): threshold → converter para gray antes
- findSymbolContour(): findContours → converter para gray+binary antes
- extractFeatures(): moments/countNonZero/findContours → converter para gray antes
- getBoundingBox(): findContours → converter para gray antes (defensivo)
- extractSymbol(): converter cellImage para gray UMA VEZ no início via toGray()

### 3. GridDetector.detectByProjectionFFT — detecção de imagem já binarizada
- Verificar pureRatio (>85% pixels em 0 ou 255) → imagem já binarizada pelo preprocess
- Se binarizada: bitwise_not (bordas ficam = 255 para erosão detectar)
- Se raw/grayscale: THRESH_BINARY_INV + OTSU

### 4. GridDetector.validateUniformity — grade não-uniforme
- Quando splitIdx >= 0 (coluna de pistas + colunas numéricas), não validar V
- A grade é intencionalmente não-uniforme nesse caso
