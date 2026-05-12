/**
 * SymbolMapper - Sistema de Mapeamento Símbolo → Letra
 * 
 * Fornece sugestões automáticas baseadas em análise de frequência
 * e permite mapeamento manual com validação.
 * 
 * @author Baseado em 03-mapeamento-e-ocr.md
 * @date 2026-02-05
 */

import type { UniqueSymbol } from './SymbolClassifier';

export interface SymbolMapping {
  [symbolId: string]: string; // symbolId -> letra
}

export interface SymbolSuggestion {
  symbolId: string;
  suggestedLetter: string;
  confidence: number; // 0-1
  reason: string;
}

export interface GridCell {
  row: number;
  col: number;
  isClue: boolean;
  symbolId?: string;
  userValue?: string;
  isMapped?: boolean;
}

/**
 * Frequências de letras em português (%)
 * Fonte: Análise de corpus de textos em português
 */
export const PORTUGUESE_LETTER_FREQUENCY: Record<string, number> = {
  'A': 14.63, 'E': 12.57, 'O': 10.73, 'S': 7.81,
  'R': 6.53,  'I': 6.18,  'N': 5.05,  'D': 4.99,
  'M': 4.74,  'U': 4.63,  'T': 4.34,  'C': 3.88,
  'L': 2.78,  'P': 2.52,  'V': 1.67,  'G': 1.30,
  'H': 1.28,  'Q': 1.20,  'B': 1.04,  'F': 1.02,
  'Z': 0.47,  'J': 0.40,  'X': 0.21,  'K': 0.02,
  'W': 0.01,  'Y': 0.01
};

/**
 * Bi-gramas mais comuns em português (%)
 */
export const PORTUGUESE_BIGRAMS: Record<string, number> = {
  'DE': 4.28, 'ES': 2.75, 'OS': 2.64, 'AS': 2.52,
  'RA': 2.29, 'DO': 2.26, 'CO': 2.10, 'RE': 1.96,
  'TE': 1.92, 'NT': 1.87, 'DA': 1.86, 'EN': 1.85,
  'AR': 1.79, 'ER': 1.73, 'SE': 1.70, 'NO': 1.69,
  'CA': 1.67, 'TA': 1.62, 'TO': 1.61, 'OR': 1.59
};

export class SymbolMapper {

  /**
   * Sugere mapeamento automático baseado em frequência de letras
   * 
   * @param symbols - Símbolos únicos identificados
   * @param language - Código do idioma (padrão: 'pt')
   * @returns Array de sugestões ordenadas por confiança
   */
  static suggestMapping(
  symbols: UniqueSymbol[]
  ): SymbolSuggestion[] {
    const suggestions: SymbolSuggestion[] = [];

    // Calcular frequência total de símbolos
    const totalSymbols = symbols.reduce(
      (sum, s) => sum + s.occurrences.length,
      0
    );

    console.log(`[SymbolMapper] Analisando ${symbols.length} símbolos únicos (${totalSymbols} total)`);

    // Calcular frequência de cada símbolo
    const symbolFrequencies = symbols.map(s => ({
      symbolId: s.clusterId,
      frequency: (s.occurrences.length / totalSymbols) * 100
    }));

    // Ordenar por frequência
    symbolFrequencies.sort((a, b) => b.frequency - a.frequency);

    // Obter letras ordenadas por frequência
    const lettersByFrequency = Object.entries(PORTUGUESE_LETTER_FREQUENCY)
      .sort((a, b) => b[1] - a[1]);

    // Mapear símbolos mais frequentes para letras mais frequentes
    const count = Math.min(
      symbolFrequencies.length,
      lettersByFrequency.length
    );

    for (let i = 0; i < count; i++) {
      const symbolFreq = symbolFrequencies[i].frequency;
      const letterFreq = lettersByFrequency[i][1];

      // Calcular confiança baseada na proximidade das frequências
      const confidence = this.calculateConfidence(symbolFreq, letterFreq);

      suggestions.push({
        symbolId: symbolFrequencies[i].symbolId,
        suggestedLetter: lettersByFrequency[i][0],
        confidence,
        reason: `Frequência: símbolo ${symbolFreq.toFixed(2)}% ≈ letra ${letterFreq.toFixed(2)}%`
      });
    }

    // Ordenar por confiança
    suggestions.sort((a, b) => b.confidence - a.confidence);

    console.log('[SymbolMapper] Top 5 sugestões:');
    for (let i = 0; i < Math.min(5, suggestions.length); i++) {
      const s = suggestions[i];
      console.log(`  ${s.symbolId} → ${s.suggestedLetter} (conf: ${(s.confidence * 100).toFixed(0)}%)`);
    }

    return suggestions;
  }

  /**
   * Calcula confiança da sugestão baseada na diferença de frequências
   * 
   * @param symbolFreq - Frequência do símbolo (%)
   * @param letterFreq - Frequência esperada da letra (%)
   * @returns Confiança (0-1)
   */
  private static calculateConfidence(
    symbolFreq: number,
    letterFreq: number
  ): number {
    // Calcular diferença relativa
    const diff = Math.abs(symbolFreq - letterFreq);
    const maxFreq = Math.max(symbolFreq, letterFreq);
    const relativeDiff = diff / maxFreq;

    // Converter para confiança (0-1)
    // Menor diferença = maior confiança
    const confidence = 1 - Math.min(relativeDiff, 1);

    return confidence;
  }

  /**
   * Aplica sugestões automáticas ao mapeamento
   * 
   * @param suggestions - Sugestões geradas
   * @param minConfidence - Confiança mínima para aplicar (padrão: 0.7)
   * @returns Mapeamento inicial
   */
  static applyAutoMapping(
    suggestions: SymbolSuggestion[],
    minConfidence: number = 0.7
  ): SymbolMapping {
    const mapping: SymbolMapping = {};

    for (const suggestion of suggestions) {
      if (suggestion.confidence >= minConfidence) {
        mapping[suggestion.symbolId] = suggestion.suggestedLetter;
      }
    }

    console.log(`[SymbolMapper] Aplicado auto-mapping com ${Object.keys(mapping).length} símbolos`);

    return mapping;
  }

  /**
   * Aplica mapeamento ao grid de células
   * 
   * @param gridData - Grid com células e simbolIds
   * @param symbolMapping - Mapeamento símbolo → letra
   * @returns Grid atualizado com letras mapeadas
   */
  static applyMappingToGrid(
    gridData: GridCell[][],
    symbolMapping: SymbolMapping
  ): GridCell[][] {
    return gridData.map(row =>
      row.map(cell => {
        // Pular células de pista
        if (cell.isClue || !cell.symbolId) {
          return cell;
        }

        const mappedLetter = symbolMapping[cell.symbolId];

        return {
          ...cell,
          userValue: mappedLetter || '',
          isMapped: !!mappedLetter
        };
      })
    );
  }

  /**
   * Extrai texto de uma linha do grid
   * 
   * @param row - Linha do grid
   * @param symbolMapping - Mapeamento símbolo → letra
   * @returns Texto da linha
   */
  static extractTextFromRow(
    row: GridCell[],
    symbolMapping: SymbolMapping
  ): string {
    return row
      .filter(cell => !cell.isClue && cell.symbolId)
      .map(cell => symbolMapping[cell.symbolId!] || '_')
      .join('');
  }

  /**
   * Calcula progresso do mapeamento
   * 
   * @param symbols - Símbolos únicos
   * @param mapping - Mapeamento atual
   * @returns Percentual de símbolos mapeados (0-100)
   */
  static calculateProgress(
    symbols: UniqueSymbol[],
    mapping: SymbolMapping
  ): number {
    const mapped = symbols.filter(s => mapping[s.clusterId]).length;
    return (mapped / symbols.length) * 100;
  }

  /**
   * Exporta mapeamento para JSON
   * 
   * @param mapping - Mapeamento a exportar
   * @returns String JSON
   */
  static exportMapping(mapping: SymbolMapping): string {
    return JSON.stringify(mapping, null, 2);
  }

  /**
   * Importa mapeamento de JSON
   * 
   * @param json - String JSON com mapeamento
   * @returns Mapeamento importado
   */
  static importMapping(json: string): SymbolMapping {
    try {
      const mapping = JSON.parse(json);

      // Validar estrutura
      if (typeof mapping !== 'object') {
        throw new Error('Formato inválido');
      }

      return mapping as SymbolMapping;
    } catch (error) {
      console.error('[SymbolMapper] Erro ao importar mapeamento:', error);
      throw new Error('Falha ao importar mapeamento JSON');
    }
  }
}

/**
 * Validador de mapeamento
 */
export class MappingValidator {

  /**
   * Verifica se há letras duplicadas no mapeamento
   * 
   * @param mapping - Mapeamento a validar
   * @returns Array de letras duplicadas
   */
  static checkDuplicates(mapping: SymbolMapping): string[] {
    const letterCounts = new Map<string, number>();
    const duplicates: string[] = [];

    for (const letter of Object.values(mapping)) {
      letterCounts.set(letter, (letterCounts.get(letter) || 0) + 1);
    }

    letterCounts.forEach((count, letter) => {
      if (count > 1) {
        duplicates.push(letter);
      }
    });

    if (duplicates.length > 0) {
      console.warn(`[MappingValidator] Letras duplicadas: ${duplicates.join(', ')}`);
    }

    return duplicates;
  }

  /**
   * Verifica se todos os símbolos foram mapeados
   * 
   * @param symbols - Símbolos únicos
   * @param mapping - Mapeamento atual
   * @returns true se completo
   */
  static isComplete(
    symbols: UniqueSymbol[],
    mapping: SymbolMapping
  ): boolean {
    const complete = symbols.every(s => mapping[s.clusterId] !== undefined);

    if (complete) {
      console.log('[MappingValidator] ✓ Mapeamento completo');
    } else {
      const unmapped = this.getUnmappedSymbols(symbols, mapping);
      console.warn(`[MappingValidator] ${unmapped.length} símbolos não mapeados`);
    }

    return complete;
  }

  /**
   * Obtém símbolos que ainda não foram mapeados
   * 
   * @param symbols - Símbolos únicos
   * @param mapping - Mapeamento atual
   * @returns Array de símbolos não mapeados
   */
  static getUnmappedSymbols(
    symbols: UniqueSymbol[],
    mapping: SymbolMapping
  ): UniqueSymbol[] {
    return symbols.filter(s => !mapping[s.clusterId]);
  }

  /**
   * Valida se um caractere é uma letra válida
   * 
   * @param char - Caractere a validar
   * @returns true se válido
   */
  static isValidLetter(char: string): boolean {
    return /^[A-ZÀ-Ÿ]$/i.test(char);
  }

  /**
   * Valida mapeamento completo
   * 
   * @param symbols - Símbolos únicos
   * @param mapping - Mapeamento a validar
   * @returns Objeto com resultado da validação
   */
  static validate(
    symbols: UniqueSymbol[],
    mapping: SymbolMapping
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Verificar duplicatas
    const duplicates = this.checkDuplicates(mapping);
    if (duplicates.length > 0) {
      errors.push(`Letras duplicadas: ${duplicates.join(', ')}`);
    }

    // Verificar caracteres inválidos
    for (const [symbolId, letter] of Object.entries(mapping)) {
      if (!this.isValidLetter(letter)) {
        errors.push(`Símbolo ${symbolId} mapeado para caractere inválido: "${letter}"`);
      }
    }

    // Verificar completude
    if (!this.isComplete(symbols, mapping)) {
      warnings.push('Mapeamento incompleto');
    }

    const isValid = errors.length === 0;

    if (isValid) {
      console.log('[MappingValidator] ✓ Validação passou');
    } else {
      console.error('[MappingValidator] Erros de validação:', errors);
    }

    return { isValid, errors, warnings };
  }
}
