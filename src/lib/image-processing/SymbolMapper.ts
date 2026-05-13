// src/lib/image-processing/SymbolMapper.ts
import type { UniqueSymbol, SymbolMapping, SymbolSuggestion, GridCell } from '@/types';

export const PORTUGUESE_LETTER_FREQUENCY: Record<string, number> = {
  'A': 14.63, 'E': 12.57, 'O': 10.73, 'S': 7.81,
  'R': 6.53,  'I': 6.18,  'N': 5.05,  'D': 4.99,
  'M': 4.74,  'U': 4.63,  'T': 4.34,  'C': 3.88,
  'L': 2.78,  'P': 2.52,  'V': 1.67,  'G': 1.30,
  'H': 1.28,  'Q': 1.20,  'B': 1.04,  'F': 1.02,
  'Z': 0.47,  'J': 0.40,  'X': 0.21,  'K': 0.02,
  'W': 0.01,  'Y': 0.01
};

export const PORTUGUESE_BIGRAMS = [
  'DE', 'ES', 'EN', 'AS', 'OS', 'RE', 'RA', 'RA', 'ER', 'AN', 'TE', 'ON', 'OR', 'ST', 'TI'
];

export class SymbolMapper {
  /**
   * Sugere mapeamentos baseados em análise de frequência do português
   */
  static suggestMapping(symbols: UniqueSymbol[]): SymbolSuggestion[] {
    const suggestions: SymbolSuggestion[] = [];
    const totalSymbols = symbols.reduce((sum, s) => sum + s.occurrences.length, 0);
    if (totalSymbols === 0) return [];

    const symbolFrequencies = symbols.map((s) => ({
      symbolId: s.symbolId,
      frequency: (s.occurrences.length / totalSymbols) * 100,
    }));

    symbolFrequencies.sort((a, b) => b.frequency - a.frequency);

    const lettersByFrequency = Object.entries(PORTUGUESE_LETTER_FREQUENCY)
      .sort((a, b) => b[1] - a[1]);

    const count = Math.min(symbolFrequencies.length, lettersByFrequency.length);

    for (let i = 0; i < count; i++) {
      const symbolFreq = symbolFrequencies[i].frequency;
      const letterFreq = lettersByFrequency[i][1];
      const confidence = this.calculateConfidence(symbolFreq, letterFreq);

      suggestions.push({
        symbolId: symbolFrequencies[i].symbolId,
        suggestedLetter: lettersByFrequency[i][0],
        confidence,
        reason: `Frequência: ${symbolFreq.toFixed(2)}% vs ${letterFreq.toFixed(2)}%`,
      });
    }

    return suggestions;
  }

  private static calculateConfidence(symbolFreq: number, letterFreq: number): number {
    const diff = Math.abs(symbolFreq - letterFreq);
    const maxFreq = Math.max(symbolFreq, letterFreq);
    const relativeDiff = diff / maxFreq;
    const confidence = 1 - Math.min(relativeDiff, 1);
    return confidence;
  }

  /**
   * Aplica automaticamente as sugestões com confiança mínima
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
    return mapping;
  }

  /**
   * Aplica o mapeamento a uma grade de células
   */
  static applyMappingToGrid(
    gridData: GridCell[][],
    symbolMapping: SymbolMapping
  ): GridCell[][] {
    return gridData.map((row) =>
      row.map((cell) => {
        if (cell.isClue || !cell.symbolId) return cell;
        const mappedLetter = symbolMapping[cell.symbolId];
        return {
          ...cell,
          userValue: mappedLetter || '',
        };
      })
    );
  }

  /**
   * Extrai o texto de uma linha usando o mapeamento atual
   */
  static extractTextFromRow(
    row: GridCell[],
    symbolMapping: SymbolMapping
  ): string {
    let result = '';
    for (const cell of row) {
      if (!cell.isClue && cell.symbolId) {
        result += symbolMapping[cell.symbolId] || '_';
      }
    }
    return result;
  }

  static exportMapping(mapping: SymbolMapping): string {
    return JSON.stringify(mapping, null, 2);
  }

  static importMapping(json: string): SymbolMapping {
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Formato inválido');
      }
      return parsed as SymbolMapping;
    } catch (error) {
      throw new Error(`Erro ao importar mapeamento: ${error}`);
    }
  }
}

export class MappingValidator {
  static checkDuplicates(mapping: SymbolMapping): string[] {
    const letterCounts = new Map<string, number>();
    const duplicates: string[] = [];

    for (const letter of Object.values(mapping)) {
      if (!letter) continue;
      letterCounts.set(letter, (letterCounts.get(letter) || 0) + 1);
    }

    for (const [letter, count] of letterCounts.entries()) {
      if (count > 1) duplicates.push(letter);
    }

    return duplicates;
  }

  static isComplete(symbols: UniqueSymbol[], mapping: SymbolMapping): boolean {
    return symbols.every((s) => mapping[s.symbolId] !== undefined);
  }

  static getUnmappedSymbols(
    symbols: UniqueSymbol[],
    mapping: SymbolMapping
  ): UniqueSymbol[] {
    return symbols.filter((s) => !mapping[s.symbolId]);
  }

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

    const duplicates = this.checkDuplicates(mapping);
    if (duplicates.length > 0) {
      errors.push(`Letras duplicadas: ${duplicates.join(', ')}`);
    }

    const unmapped = this.getUnmappedSymbols(symbols, mapping);
    if (unmapped.length > 0) {
      warnings.push(`${unmapped.length} símbolos ainda não mapeados`);
    }

    for (const [symbolId, letter] of Object.entries(mapping)) {
      if (letter && !/^[A-ZÀ-Ü]$/i.test(letter)) {
        errors.push(`Símbolo ${symbolId} tem letra inválida: "${letter}"`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
