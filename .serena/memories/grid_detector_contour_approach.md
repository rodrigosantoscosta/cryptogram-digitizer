# GridDetector — Abordagem por Contornos Quadrangulares (implementado 2026-03-08)

## Mudança principal
GridDetector.detect() agora tenta primeiro `detectByContours()` e usa `detectByMorphology()` como fallback.

## detectByContours() — nova abordagem primária
Pipeline:
1. Grayscale + Otsu THRESH_BINARY_INV
2. MORPH_CLOSE (~3% da menor dimensão) para reconectar bordas quebradas de células
3. findContours com RETR_TREE
4. Filtrar por: 4-6 vértices (approxPolyDP 4%), aspect ratio ≤ 2.5, solidez ≥ 0.7, área no cluster modal (±fator 0.35~2.8)
5. Agrupar por linha (tolerância 40% da altura modal) e coluna (40% da largura modal)
6. Derivar bordas por percentil 10/90 das posições dentro de cada linha/coluna

## Constantes relevantes
- CELL_ASPECT_RATIO_MAX = 2.5
- CELL_SOLIDITY_MIN = 0.7
- CELL_AREA_MIN_FACTOR = 0.35, MAX = 2.8
- ROW_COL_CLUSTER_TOLERANCE = 0.4 (fração da dimensão modal)
- MIN_CELLS_CONTOUR = 6

## Por que funciona melhor
- Cada célula detectada independentemente — borda quebrada não afeta vizinhas
- Sem dependência de linhas contínuas atravessando toda a tabela
- RETR_TREE captura contornos filhos (interior das células)
- Modal area filtra texto, ruído e o contorno externo da tabela
