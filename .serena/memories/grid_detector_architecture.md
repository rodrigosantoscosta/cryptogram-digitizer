# GridDetector — Arquitetura de Detecção (atualizado 2026-05-10)

## Arquivo: src/lib/image-processing/GridDetector.ts

### Cadeia em detect()
1. **detectByProjectionFFT** (primária — erosão morfológica 1D)
2. **detectByHoughIntersection** (secundária)
3. **detectByContours** (terciária)
4. **detectByMorphology** (fallback final)

---

## detectByProjectionFFT — abordagem primária

### Princípio
Erosão morfológica 1D para isolar linhas de grade antes de projetar.
- Erosão horizontal (kernel 10% da largura): apenas linhas H contínuas sobrevivem
- Erosão vertical (kernel 10% da altura): apenas linhas V contínuas sobrevivem
- Projeção das imagens erodidas → picos = bordas de grade

### Pipeline completo
1. Grayscale → Otsu (THRESH_BINARY_INV)
2. cv.erode com kernel 1×kW (horizontal) e kH×1 (vertical)
3. projectH / projectV: somar pixels por linha/coluna, normalizar
4. extractBorderCenters: agrupar pixels não-nulos (gap≤10px), calcular centros ponderados
5. dedupe: mesclar pares muito próximos (<T*0.5), manter maior amplitude
6. regularize: inserir bordas em gaps duplos (borda de baixo contraste ausente)
7. Detecção de grade não-uniforme para V: se maxGap > medianGap × 2.0 → splitIdx
   - Grade não-uniforme: coluna de pistas (x=0 até fronteira) + colunas numéricas (período uniforme)
   - colPositions = [0, ...numericRegularized]
8. validateUniformity (tol=0.7 para V não-uniforme)

### Constantes usadas
kW = max(5, round(W * 0.10))  — kernel erosão H
kH = max(5, round(H * 0.10))  — kernel erosão V

### Helpers privados principais
- extractBorderCenters(proj, gap): Float32Array → Array<{c,a}>
- dedupe(borders, minSep): remover duplicatas
- regularize(centers, T): inserir bordas faltantes
- median(values): mediana simples
- findDominantPeriod: autocorrelação (SNR por RMS) → FFT anti-harmônico (fallback)
- findPeriodByAutocorrelation: SNR = peak / RMS(região), robusto a médias negativas
- detectBordersByPeaksWithPeriod: fallback quando erosão falha
- detectPositionsByPeaks: picos diretos na projeção suavizada

### Validado em sample.jpg (597×917px)
- 12 linhas × 9 colunas (ground truth confirmado)
- H: 10 bordas brutas detectadas, T=62px, 2 bordas regularizadas → 13 posições
- V: grade não-uniforme detectada (splitIdx=1, maxGap=177px vs median=47px)
  colPositions=[0, 210, 257, 299, 351, 398, 445, 492, 540, 586]

### Outros métodos (não modificados)
- findDominantPeriod: autocorrelação + FFT anti-harmônico em cascata
- findPeriodByAutocorrelation: SNR=peak/RMS (robusto a média negativa)
