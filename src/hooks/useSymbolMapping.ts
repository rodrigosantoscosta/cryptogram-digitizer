// src/hooks/useSymbolMapping.ts
import { useState, useCallback, useMemo } from 'react';
import type { UniqueSymbol, SymbolMapping } from '@/types';
import { SymbolMapper, MappingValidator } from '@/lib/image-processing/SymbolMapper';

export function useSymbolMapping(uniqueSymbols: UniqueSymbol[]) {
  const [mapping, setMapping] = useState<SymbolMapping>({});
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<'frequency' | 'alphabetical'>('frequency');

  const suggestions = useMemo(() => {
    return SymbolMapper.suggestMapping(uniqueSymbols);
  }, [uniqueSymbols]);

  const applyAutoMapping = useCallback((minConfidence: number = 0.7) => {
    const autoMapping = SymbolMapper.applyAutoMapping(suggestions, minConfidence);
    setMapping(autoMapping);
  }, [suggestions]);

  const updateMapping = useCallback((symbolId: string, letter: string) => {
    setMapping((prev) => {
      if (letter === '') {
        const { [symbolId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [symbolId]: letter.toUpperCase() };
    });
  }, []);

  const clearMapping = useCallback(() => {
    setMapping({});
  }, []);

  const validation = useMemo(() => {
    return MappingValidator.validate(uniqueSymbols, mapping);
  }, [uniqueSymbols, mapping]);

  const filteredSymbols = useMemo(() => {
    return uniqueSymbols
      .filter((s) => {
        if (!filter) return true;
        const mappedLetter = mapping[s.symbolId];
        return mappedLetter?.toLowerCase().includes(filter.toLowerCase());
      })
      .sort((a, b) => {
        if (sortBy === 'frequency') {
          return b.occurrences.length - a.occurrences.length;
        } else {
          const letterA = mapping[a.symbolId] || 'Z';
          const letterB = mapping[b.symbolId] || 'Z';
          return letterA.localeCompare(letterB);
        }
      });
  }, [uniqueSymbols, mapping, filter, sortBy]);

  const progress = useMemo(() => {
    const mapped = Object.keys(mapping).length;
    const total = uniqueSymbols.length;
    return total > 0 ? (mapped / total) * 100 : 0;
  }, [mapping, uniqueSymbols]);

  return {
    mapping,
    suggestions,
    filteredSymbols,
    filter,
    sortBy,
    validation,
    progress,
    setFilter,
    setSortBy,
    updateMapping,
    applyAutoMapping,
    clearMapping,
  };
}
