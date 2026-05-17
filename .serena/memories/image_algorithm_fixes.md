# Image Algorithm Fixes (applied 2026-03-07)

## ImageProcessor.ts
- **MORPH_OPEN kernel**: Changed from 2 (even, wrong) to 3 (odd, correct)
- **Added `applyCLAHE()`**: Contrast Limited Adaptive Histogram Equalization — apply after grayscale, before threshold
- **Added `deskew()`**: Skew correction using image moments + warpAffine, capped at ±15°
- **`preprocess()` pipeline updated**: grayscale → deskew → CLAHE → blur → adaptiveThreshold → MORPH_CLOSE(3) → MORPH_OPEN(3)

## TableDetector.ts
- **`detectEdgesForTable` dilation kernel**: Changed from 2×2 to 3×3 (odd)
- **`mergeCloseLines` position calculation**: Now uses midpoint (p1+p2)/2 instead of just p1, making it robust to partial segments with different offsets

## SymbolExtractor.ts
- **`isEmpty` threshold**: Lowered from 0.05 to 0.02 (better for thin symbols like dashes/dots)
- **`generateSymbolHash`**: Replaced weak sparse-sample hash with **pHash (DCT-based perceptual hash)** — 64-bit, hex-encoded, collision-resistant
- **Added `hammingDistance()`**: Utility to compare two pHashes quickly
- **`extractAllSymbols`**: Dynamic import of TableDetector moved outside the nested loop (was re-importing on every cell iteration)

## SymbolClassifier.ts
- **`calculateFeatureDistance` — double log bug fixed**: Hu Moments in `features.moments` are already log-normalized in `SymbolExtractor.extractFeatures`. The redundant `Math.log10` call in `calculateFeatureDistance` was removed.
- **`clusterSymbols` — Lloyd's re-assignment added**: After greedy initial clustering, one Lloyd's step re-assigns every symbol to the nearest cluster centroid, correcting errors caused by non-representative greedy representatives.
