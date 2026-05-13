# Correction Plan - Critical Optimizations & Cleanup

Based on the `react-doctor` diagnostics and user preference, this plan focuses on critical performance optimizations, stability improvements, and archiving legacy code.

## 1. Archiving Legacy Files
Move legacy Vanilla JS files and prototypes to a `legacy/` directory to clean up the root.
- Move: `game.js`, `criptoBuilder.js`, `grid.js`, `prototype-vanilla.html` to `legacy/`.

## 2. Performance Optimizations (Core Pipeline)
Optimize the image processing pipeline to improve speed and follow modern standards.
- **SymbolExtractor.ts**:
    - Parallelize `extractAllSymbolsFromGrid` and `extractAllSymbols` using `Promise.all`.
    - Use `toSorted()` in `generateSymbolHash`.
- **GridDetector.ts**:
    - Replace `[...array].sort()` with `array.toSorted()` in all flagged locations (lines 401, 402, 684, 763, 1263, 1290, 1318, 1733, 1799).
- **SymbolMapper.ts**:
    - Optimize `.filter().map()` in `extractTextFromRow` into a single loop.

## 3. Correctness & Stability
Ensure data integrity and prevent React rendering bugs.
- **ProcessingPage.tsx**:
    - Change `sessionStorage` key from `processedSymbols` to `processedSymbols:v1`.
    - Replace array index keys with stable identifiers (e.g., `symbol.clusterId`).
- **MappingPage.tsx**:
    - Replace array index keys with stable identifiers.

## 4. Accessibility (Critical)
Enable keyboard navigation for core features.
- **UploadPage.tsx**:
    - Add `role="button"`, `tabIndex={0}`, and `onKeyDown` to the drop zone.

## Verification
- Run `npm run type-check` to ensure no regressions.
- Verify that image processing still works correctly.
- Check that navigation and storage persistence are functional with the new keys.
