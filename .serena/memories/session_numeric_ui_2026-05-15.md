# Session: UI numérica e integração CellNumberOverlay (2026-05-15)

## Status: ✅ tsc 0 erros | build OK (109 modules, 2.94s)

## Arquivos criados / modificados

### Criados
- `src/components/CellNumberOverlay/CellNumberOverlay.tsx` — grade de debug colorida por confiança
- `src/components/CellNumberOverlay/index.ts` — barrel export

### Modificados
- `src/components/Mapping/SymbolMapperUI.tsx` — refatorado para suportar modo numérico e modo visual
- `src/steps/StepMapping.tsx` — painel de diagnóstico recolhível com CellNumberOverlay + banner de cobertura
- `src/steps/StepSolution.tsx` — legenda da rodapé adaptada para symbolId numérico
- `src/lib/image-processing/SymbolClassifier.ts` — novo método estático `buildFromNumbers(cellNumbers, extractedSymbols?)`
- `src/hooks/useImageProcessor.ts` — usa buildFromNumbers quando cobertura >= 70%, fallback para pHash visual

## Arquitetura do modo numérico

### Detecção automática
- `SymbolClassifier.buildFromNumbers()` é chamado quando `cellNumbers.recognized / total >= 0.70`
- symbolId = número como string ("1".."27") — determinístico, sem erros de clustering
- `isNumericMode()` no SymbolMapperUI detecta se todos symbolIds são inteiros → renderização diferente

### SymbolMapperUI — modo numérico
- Layout: grid de cards compactos (auto-fill, minmax 100px)
- Cada card: número grande em destaque + frequência + input de letra + sugestão opcional
- Ordenação adicional: "Por número" (numérica real, não lexicográfica)
- Filtro aceita número OU letra mapeada

### SymbolMapperUI — modo visual (fallback)
- Layout: lista de linhas com canvas do símbolo + id + frequência
- Mantém comportamento anterior, com fix: canvas ignorado se imageData.width <= 1

### CellNumberOverlay
- Grid colorido por confiança: verde ≥80% / amarelo ≥50% / vermelho <50% / cinza = null
- Tooltip flutuante com rawText, confidence, posição
- Tabela colapsável símbolo → posições no rodapé
- Acessado via botão "Ver diagnóstico" no banner do StepMapping

## Fluxo completo
1. Upload → StepProcessing (barra de progresso)
2. Fase 3.5: CellNumberReader.read() → CellNumberMap
3. Fase 4: if cobertura >= 70% → buildFromNumbers() else identifyUniqueSymbols()
4. StepMapping: banner de cobertura + painel diagnóstico recolhível + SymbolMapperUI em modo numérico
5. StepSolution: legenda usa "#26" para symbolId numérico

## Próximos passos sugeridos
- T5 (SDD): persistência de ImageData com IndexedDB (idb-keyval) — atualmente stub no puzzleStore
- Testes unitários para buildFromNumbers e isNumericMode
- Ajuste fino do threshold (atualmente 0.70) com mais amostras de criptogramas
