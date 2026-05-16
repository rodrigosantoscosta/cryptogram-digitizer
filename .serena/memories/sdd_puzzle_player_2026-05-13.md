# SDD — Puzzle Player (gerado 2026-05-13)

## Objetivo
Adicionar feature de jogar o criptograma no navegador, inspirado esteticamente nas Palavras Cruzadas do G1 Globo.

## Novo fluxo
Upload → Processamento → Mapeamento → **PuzzlePage** (/puzzle) → **ResultPage** (/result)

## Referência visual
- Fundo branco, tipografia serifada para pistas, células quadradas com borda fina
- Célula ativa: highlight azul (estilo G1)
- Cada célula: símbolo original em miniatura no canto superior + letra digitada grande no centro
- Coluna de pistas à esquerda (dados do OCR — ClueResult[])

## Tarefas em ordem de prioridade

### T1 — PuzzlePage (P1)
- Rota: /puzzle
- Arquivos novos: src/pages/PuzzlePage.tsx, src/components/PuzzleGrid/, src/components/PuzzleCell/, src/components/CluePanel/
- Comportamento: grade editável, navegação por teclado, highlight linha/coluna, símbolo original em miniatura
- Usa: usePuzzleSolver (já existe), GridCell[] (já existe)

### T2 — Conectar MappingPage → PuzzlePage (P1)
- Problema: MappingPage usa sessionStorage diretamente; sem botão "Jogar"
- Mudar: MappingPage usa puzzleStore.setCurrentPuzzle(); botão "Jogar →" ao mapear ≥80%; implementar loadPuzzle() no store; adicionar /puzzle no nav

### T3 — ResultPage (P2)
- Rota: /result (ou modal no PuzzlePage)
- Exibida quando progress === 100%
- Conteúdo: grade completa, tabela símbolo→letra, tempo, pistas OCR
- Exportação: texto simples, JSON do mapeamento, botão "Novo puzzle"

### T4 — SymbolLegend sidebar (P2)
- Sidebar no PuzzlePage com todos UniqueSymbol[] e suas letras mapeadas
- Clique no símbolo foca na próxima ocorrência na grade
- Dados: UniqueSymbol.representative.imageData já disponível

### T5 — Persistência ImageData (P3)
- puzzleStore.loadPuzzle() é stub vazio
- ImageData não serializa em JSON; solução: base64 no partialize OU IndexedDB via idb-keyval
- Baixa prioridade — resolver depois do fluxo de jogo estar funcional

## Arquivos que NÃO precisam mudar
- usePuzzleSolver.ts (hook de estado da grade)
- SymbolMapper.ts (lógica de mapeamento + exportMapping)
- tipos: GridCell, UniqueSymbol, SymbolMapping
- useSymbolMapping.ts
