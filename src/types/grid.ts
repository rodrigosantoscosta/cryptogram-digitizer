// src/types/grid.ts

export interface GridCell {
  row: number;
  col: number;
  isClue: boolean;
  symbolId?: string;   // ex.: "symbol_12"
  userValue?: string;  // Letra aplicada pelo usuário
  isLocked?: boolean;  // Célula bloqueada (não editável)
  isError?: boolean;   // Validação indica erro
}
