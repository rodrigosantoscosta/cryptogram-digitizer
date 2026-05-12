# SPEC — detectByProjectionFFT (nova abordagem primária)

## Por que as atuais falham
- Hough: precisa de segmentos contínuos longos; HOUGH_MIN_LINE_RATIO=0.04 é muito restritivo
- Contornos: símbolos internos passam no filtro de solidez; bordas abertas não fecham
- Morfologia: erosão com 35% da dimensão apaga linhas finas/fragmentadas

## Nova abordagem: FFT em projeções 1D
Grade regular = sinal periódico nas projeções hProj/vProj.
FFT revela período (tamanho da célula) diretamente sem detectar linhas individuais.

## Pipeline
1. Binarizar (Otsu, SEM MORPH_CLOSE)
2. hProj[y] = Σ pixels escuros na linha y; vProj[x] = idem por coluna
3. FFT com janela Hanning → magnitudes espectrais
4. Filtrar banda válida [FFT_MIN_CELL_PERIOD, W*FFT_MAX_CELL_PERIOD_RATIO]
5. Pico dominante → período T; validar SNR >= FFT_SNR_MIN
6. Suavizar projeção, encontrar picos locais, fitPhase(picos, T) → fase φ
7. generateGridLines(imageSize, T, φ) → posições
8. validateUniformity → GridResult

## Constantes
FFT_MIN_CELL_PERIOD = 15
FFT_MAX_CELL_PERIOD_RATIO = 0.45
FFT_SNR_MIN = 3.0
FFT_PEAK_SMOOTH_SIGMA_RATIO = 0.10
FFT_PEAK_MIN_SEPARATION_RATIO = 0.60

## Novos métodos privados
- fft(re, im): Cooley-Tukey iterativo (sem deps externas, ~30 linhas)
- fftMagnitudes(signal): Float32Array → Float64Array de magnitudes
- hannWindow(n): janela de apodização
- findDominantPeriod(projection, min, max): {period, snr}
- gaussianSmooth(signal, sigma): convolução 1D
- findLocalPeaks(signal, minSeparation): índices dos picos
- fitPhase(peaks, period): offset de fase por mínimos quadrados
- generateGridLines(imageSize, period, phase): número[]
- detectByProjectionFFT(imageData): GridResult

## Posição na cadeia em detect()
1. detectByProjectionFFT (nova primária)
2. detectByHoughIntersection
3. detectByContours
4. detectByMorphology

## Critérios de aceitação
- rows*cols correto com até 60% de bordas quebradas
- SNR < 3 → lança Error (não retorna grade silenciosamente errada)
- Execução <= 200ms para 2000x2000px no browser
- Sem regressão nas imagens que Hough/Contour já detectavam
