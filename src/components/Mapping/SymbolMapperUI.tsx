// src/components/Mapping/SymbolMapperUI.tsx
import { useState } from 'react';
import { Sparkles, Lightbulb } from 'lucide-react';
import type { UniqueSymbol, SymbolMapping, SymbolSuggestion } from '@/types/symbol';

interface SymbolMapperUIProps {
  uniqueSymbols: UniqueSymbol[];
  currentMapping: SymbolMapping;
  suggestions: SymbolSuggestion[];
  onMappingChange: (symbolId: string, letter: string) => void;
  onApplyAutoMapping?: () => void;
}

function isNumericMode(symbols: UniqueSymbol[]): boolean {
  return symbols.length > 0 && symbols.every((s) => /^\d+$/.test(s.symbolId));
}

export function SymbolMapperUI({
  uniqueSymbols,
  currentMapping,
  suggestions,
  onMappingChange,
  onApplyAutoMapping,
}: SymbolMapperUIProps) {
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<'frequency' | 'id' | 'alphabetical'>('frequency');

  const numeric = isNumericMode(uniqueSymbols);

  const filteredSymbols = uniqueSymbols
    .filter((s) => {
      if (!filter) return true;
      const mappedLetter = currentMapping[s.symbolId];
      return (
        mappedLetter?.toLowerCase().includes(filter.toLowerCase()) ||
        (numeric && s.symbolId.includes(filter))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'frequency') return b.occurrences.length - a.occurrences.length;
      if (sortBy === 'id' && numeric) return Number(a.symbolId) - Number(b.symbolId);
      const letterA = currentMapping[a.symbolId] || 'Ω';
      const letterB = currentMapping[b.symbolId] || 'Ω';
      return letterA.localeCompare(letterB);
    });

  const mapped = Object.values(currentMapping).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-0">
      {/* Toolbar */}
      <div className="flex gap-2.5 mb-2.5 flex-wrap items-center">
        <input
          type="text"
          placeholder={numeric ? 'Filtrar por número ou letra...' : 'Filtrar por letra...'}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 min-w-40 px-3 py-2 border border-gray-300 rounded-input text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-2.5 py-2 border border-gray-300 rounded-input text-sm bg-surface-card cursor-pointer"
        >
          <option value="frequency">Por frequência</option>
          {numeric && <option value="id">Por número</option>}
          <option value="alphabetical">Por letra mapeada</option>
        </select>
        {onApplyAutoMapping && (
          <button
            className="px-3.5 py-2 bg-primary text-white border-none rounded-input text-sm font-semibold cursor-pointer whitespace-nowrap hover:bg-primary-hover transition-colors flex items-center"
            onClick={onApplyAutoMapping}
          >
            <Sparkles size={16} className="mr-1.5" />Auto-mapear
          </button>
        )}
      </div>

      {/* Contador */}
      <p className="text-sm text-ink-muted mb-4 flex items-center gap-2">
        {mapped} de {uniqueSymbols.length} símbolos mapeados
        {numeric && (
          <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full tracking-wide">
            modo numérico
          </span>
        )}
      </p>

      {/* Lista */}
      <div className={numeric ? 'grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2' : 'flex flex-col gap-1.5'}>
        {filteredSymbols.map((symbol) => {
          const suggestion = suggestions.find((sg) => sg.symbolId === symbol.symbolId);
          return numeric ? (
            <NumericMappingCard
              key={symbol.symbolId}
              symbol={symbol}
              currentLetter={currentMapping[symbol.symbolId]}
              suggestion={suggestion}
              onLetterChange={(letter) => onMappingChange(symbol.symbolId, letter)}
            />
          ) : (
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

// ─── Modo numérico: card compacto ────────────────────────────────────────────

interface NumericCardProps {
  symbol: UniqueSymbol;
  currentLetter?: string;
  suggestion?: SymbolSuggestion;
  onLetterChange: (letter: string) => void;
}

function NumericMappingCard({ symbol, currentLetter, suggestion, onLetterChange }: NumericCardProps) {
  const mapped = Boolean(currentLetter);
  return (
    <div className={`
      flex flex-col items-center gap-1.5 p-3 rounded-input border transition-colors
      ${mapped ? 'border-primary bg-purple-50' : 'border-gray-200 bg-surface-card hover:border-primary/50'}
    `}>
      <div className="text-2xl font-bold text-ink leading-none">{symbol.symbolId}</div>
      <div className="text-xs text-ink-faint">{symbol.occurrences.length}×</div>
      <input
        type="text"
        maxLength={1}
        value={currentLetter || ''}
        onChange={(e) => onLetterChange(e.target.value.toUpperCase())}
        placeholder="?"
        className={`
          w-11 h-11 text-center text-2xl font-bold border-2 rounded-input outline-none cursor-text
          transition-colors
          ${mapped
            ? 'border-primary bg-surface-card text-primary'
            : 'border-gray-300 bg-gray-50 text-ink'}
        `}
      />
      {suggestion && !currentLetter && (
        <button
          className="flex flex-col items-center bg-yellow-50 border border-yellow-200 rounded-md px-2 py-0.5 cursor-pointer text-sm font-bold text-yellow-800 gap-0.5 hover:bg-yellow-100 transition-colors"
          onClick={() => onLetterChange(suggestion.suggestedLetter)}
          title={suggestion.reason}
        >
          {suggestion.suggestedLetter}
          <span className="text-xs font-normal text-yellow-700">{(suggestion.confidence * 100).toFixed(0)}%</span>
        </button>
      )}
    </div>
  );
}

// ─── Modo visual: linha com canvas ────────────────────────────────────────────

interface SymbolRowProps {
  symbol: UniqueSymbol;
  currentLetter?: string;
  suggestion?: SymbolSuggestion;
  onLetterChange: (letter: string) => void;
}

function SymbolMappingRow({ symbol, currentLetter, suggestion, onLetterChange }: SymbolRowProps) {
  return (
    <div className="flex items-center gap-3 p-2.5 px-3.5 border border-gray-200 rounded-input bg-surface-card">
      <div className="flex flex-col items-center gap-0.5 min-w-12">
        <canvas
          ref={(canvas) => {
            if (!canvas) return;
            const imgData = symbol.representative?.imageData;
            if (!(imgData instanceof ImageData) || imgData.width <= 1) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            canvas.width = imgData.width;
            canvas.height = imgData.height;
            ctx.putImageData(imgData, 0, 0);
          }}
          className="w-11 h-11 image-render-pixelated"
          style={{ imageRendering: 'pixelated' }}
        />
        <span className="text-xs text-gray-400">{symbol.symbolId.replace(/^cluster_/, '#')}</span>
      </div>
      <span className="text-sm text-ink-muted min-w-7">{symbol.occurrences.length}×</span>
      <input
        type="text"
        maxLength={1}
        value={currentLetter || ''}
        onChange={(e) => onLetterChange(e.target.value.toUpperCase())}
        placeholder="?"
        className="w-11 h-11 text-center text-2xl font-bold border-2 border-gray-300 rounded-input outline-none cursor-text bg-gray-50 text-ink transition-colors"
      />
      {suggestion && !currentLetter && (
        <button
          className="flex items-center gap-1 bg-yellow-50 border border-yellow-200 rounded-md px-2 py-1 cursor-pointer text-sm font-bold text-yellow-800 hover:bg-yellow-100 transition-colors"
          onClick={() => onLetterChange(suggestion.suggestedLetter)}
          title={suggestion.reason}
        >
          <Lightbulb size={14} />
          {suggestion.suggestedLetter}
          <span className="text-xs font-normal text-yellow-700">({(suggestion.confidence * 100).toFixed(0)}%)</span>
        </button>
      )}
    </div>
  );
}
