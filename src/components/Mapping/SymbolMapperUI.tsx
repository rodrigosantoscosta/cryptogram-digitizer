// src/components/Mapping/SymbolMapperUI.tsx
import { useState } from 'react';
import type { UniqueSymbol, SymbolMapping, SymbolSuggestion } from '@/types';

interface SymbolMapperUIProps {
  uniqueSymbols: UniqueSymbol[];
  currentMapping: SymbolMapping;
  suggestions: SymbolSuggestion[];
  onMappingChange: (symbolId: string, letter: string) => void;
  onApplyAutoMapping?: () => void;
}

export function SymbolMapperUI({
  uniqueSymbols,
  currentMapping,
  suggestions,
  onMappingChange,
  onApplyAutoMapping,
}: SymbolMapperUIProps) {
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<'frequency' | 'alphabetical'>('frequency');

  const filteredSymbols = uniqueSymbols
    .filter((s) => {
      if (!filter) return true;
      const mappedLetter = currentMapping[s.symbolId];
      return mappedLetter?.toLowerCase().includes(filter.toLowerCase());
    })
    .sort((a, b) => {
      if (sortBy === 'frequency') {
        return b.occurrences.length - a.occurrences.length;
      } else {
        const letterA = currentMapping[a.symbolId] || 'Z';
        const letterB = currentMapping[b.symbolId] || 'Z';
        return letterA.localeCompare(letterB);
      }
    });

  return (
    <div className="symbol-mapper">
      <div className="controls">
        <input
          type="text"
          placeholder="Filtrar por letra..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />

        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
          <option value="frequency">Ordenar por Frequência</option>
          <option value="alphabetical">Ordenar Alfabeticamente</option>
        </select>

        {onApplyAutoMapping && (
          <button onClick={onApplyAutoMapping}>
            ✨ Aplicar Sugestões Automáticas
          </button>
        )}
      </div>

      <div className="symbol-list">
        {filteredSymbols.map((symbol) => {
          const suggestion = suggestions.find((s) => s.symbolId === symbol.symbolId);

          return (
            <SymbolMappingRow
              key={symbol.symbolId}
              symbol={symbol}
              currentLetter={currentMapping[symbol.symbolId]}
              suggestion={suggestion}
              onLetterChange={(letter) => onMappingChange(symbol.symbolId, letter)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface SymbolMappingRowProps {
  symbol: UniqueSymbol;
  currentLetter?: string;
  suggestion?: SymbolSuggestion;
  onLetterChange: (letter: string) => void;
}

function SymbolMappingRow({
  symbol,
  currentLetter,
  suggestion,
  onLetterChange,
}: SymbolMappingRowProps) {
  return (
    <div className="symbol-row">
      <div className="symbol-preview">
        <canvas
          ref={(canvas) => {
            if (canvas) {
              const ctx = canvas.getContext('2d');
              if (ctx) {
                canvas.width = symbol.representative.imageData.width;
                canvas.height = symbol.representative.imageData.height;
                ctx.putImageData(symbol.representative.imageData, 0, 0);
              }
            }
          }}
        />
      </div>

      <div className="frequency">
        {symbol.occurrences.length}×
      </div>

      <input
        type="text"
        maxLength={1}
        value={currentLetter || ''}
        onChange={(e) => onLetterChange(e.target.value.toUpperCase())}
        placeholder="?"
        className="letter-input"
      />

      {suggestion && (
        <div
          className="suggestion"
          onClick={() => onLetterChange(suggestion.suggestedLetter)}
          title={suggestion.reason}
        >
          💡 {suggestion.suggestedLetter} ({(suggestion.confidence * 100).toFixed(0)}%)
        </div>
      )}
    </div>
  );
}
