# Session: git review + fixes (2026-05-14)

## O que você fez (commits detectados)
- `cc8a400` — Refatoração completa para SPA: App.tsx agora só renderiza CryptogramSolver
  - src/components/CryptogramSolver.tsx — orquestra steps via estado React (imageData e processedData fluem por props, sem sessionStorage)
  - src/steps/StepMapping.tsx — botão "Jogar Criptograma" chama onSolve(mapping)
  - src/steps/StepSolution.tsx — tela jogável (PuzzlePage reimplementada como step)
- `f25ab1b` — Testes: vitest setup + testes unitários para App, CryptogramSolver, StepMapping, StepSolution, helpers
  - @testing-library/user-event e jsdom adicionados ao package.json

## Arquitetura atual (pós-refatoração)
- App.tsx → CryptogramSolver → [StepUpload | StepProcessing | StepMapping | StepSolution]
- Dados fluem por props React puras em memória — sem sessionStorage, sem Zustand para ImageData
- PuzzlePage.tsx / MappingPage.tsx em src/pages/ são código morto (não usados pelo roteador)

## Fixes aplicados nesta sessão
1. StepSolution.tsx buildGrid(): reescrito para usar uniqueSymbols.occurrences (CellPosition[]) em vez de extractedSymbols.row/.col/.symbolId inexistentes
   - symbolId: null → undefined (tipo GridCell)
2. SymbolMapperUI.tsx canvas ref: guard defensivo `if (!(imgData instanceof ImageData)) return`
   - Evita crash quando imageData é null/undefined por qualquer motivo

## Status
- npx tsc --noEmit: 0 erros
- npm run build: ✅ 106 modules, 1.95s
