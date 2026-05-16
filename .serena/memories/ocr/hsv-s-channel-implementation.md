## HSV S-Channel Preprocessing Implementation (2026-05-16)

### Changes Made
- **Replaced grayscale threshold with HSV S-channel threshold** for highlighted cells
- **Removed `highlightThreshold` parameter** - no longer needed since Otsu auto-detects optimal threshold
- **Simplified retry cascade** from 11 attempts to 8 (removed redundant threshold variations)
- **Added proper Mat cleanup** to prevent OpenCV.js memory leaks

### Implementation Details
```typescript
// Destacadas: threshold no canal S do HSV
const sChannel = new cv.Mat();
const channels = new cv.MatVector();
cv.split(hsvMat, channels);
const sRaw = channels.get(1); // Canal S original
cv.resize(sRaw, sChannel, dsize, 0, 0, cv.INTER_CUBIC);
cv.threshold(sChannel, binary, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
cv.bitwise_not(binary, binary);
```

### Expected Improvement
- **Before**: ~55% coverage (53/96 cells)
- **Expected**: 85%+ coverage
- **Target cells**: All 10 highlighted cells that previously failed should now work

### Why This Works
- White text has saturation ≈ 0 in HSV color space
- Colored backgrounds have S > 0
- Otsu threshold automatically finds the optimal split point
- No manual threshold tuning required across different blue shades

### Files Modified
- `src/lib/ocr/CellNumberReader.ts`: Main preprocessing pipeline

### Next Steps
- Test against `legacy/sample.jpg` to verify improvement
- Compare diagnostic output with `sample_ground_truth.json`
- If coverage < 85%, consider fallback to Gain Division approach