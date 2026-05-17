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

/** Retorna true se todos os symbolIds são inteiros numéricos (modo numérico do criptograma) */
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
      // Filtra por letra mapeada OU pelo número (modo numérico)
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
    <div style={s.root}>
      {/* Toolbar */}
      <div style={s.toolbar}>
        <input
          type="text"
          placeholder={numeric ? 'Filtrar por número ou letra...' : 'Filtrar por letra...'}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={s.filterInput}
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          style={s.select}
        >
          <option value="frequency">Por frequência</option>
          {numeric && <option value="id">Por número</option>}
          <option value="alphabetical">Por letra mapeada</option>
        </select>
        {onApplyAutoMapping && (
          <button style={s.autoBtn} onClick={onApplyAutoMapping}>
            ✨ Auto-mapear
          </button>
        )}
      </div>

      {/* Contador */}
      <p style={s.counter}>
        {mapped} de {uniqueSymbols.length} símbolos mapeados
        {numeric && <span style={s.numericBadge}>modo numérico</span>}
      </p>

      {/* Lista */}
      <div style={numeric ? s.gridList : s.symbolList}>
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
    <div style={{ ...s.numCard, ...(mapped ? s.numCardMapped : {}) }}>
      {/* Número em destaque */}
      <div style={s.numBadge}>{symbol.symbolId}</div>

      {/* Frequência */}
      <div style={s.numFreq}>{symbol.occurrences.length}×</div>

      {/* Input de letra */}
      <input
        type="text"
        maxLength={1}
        value={currentLetter || ''}
        onChange={(e) => onLetterChange(e.target.value.toUpperCase())}
        placeholder="?"
        style={{ ...s.letterInput, ...(mapped ? s.letterInputMapped : {}) }}
      />

      {/* Sugestão */}
      {suggestion && !currentLetter && (
        <button
          style={s.suggBtn}
          onClick={() => onLetterChange(suggestion.suggestedLetter)}
          title={suggestion.reason}
        >
          {suggestion.suggestedLetter}
          <span style={s.suggConf}>{(suggestion.confidence * 100).toFixed(0)}%</span>
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
    <div style={s.symRow}>
      <div style={s.symPreview}>
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
          style={{ width: 44, height: 44, imageRendering: 'pixelated' }}
        />
        <span style={s.symId}>{symbol.symbolId.replace(/^cluster_/, '#')}</span>
      </div>
      <span style={s.symFreq}>{symbol.occurrences.length}×</span>
      <input
        type="text"
        maxLength={1}
        value={currentLetter || ''}
        onChange={(e) => onLetterChange(e.target.value.toUpperCase())}
        placeholder="?"
        style={s.letterInput}
      />
      {suggestion && !currentLetter && (
        <button
          style={s.suggBtn}
          onClick={() => onLetterChange(suggestion.suggestedLetter)}
          title={suggestion.reason}
        >
          💡 {suggestion.suggestedLetter} ({(suggestion.confidence * 100).toFixed(0)}%)
        </button>
      )}
    </div>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root:         { display: 'flex', flexDirection: 'column', gap: 0 },
  toolbar:      { display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' },
  filterInput:  { flex: 1, minWidth: 160, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none' },
  select:       { padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, background: '#fff', cursor: 'pointer' },
  autoBtn:      { padding: '8px 14px', background: '#667eea', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  counter:      { fontSize: 13, color: '#6b7280', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 },
  numericBadge: { background: '#eff6ff', color: '#1d4ed8', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, letterSpacing: '0.03em' },

  // Modo numérico — grid de cards
  gridList:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 },
  numCard:      { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 8px', border: '1.5px solid #e5e7eb', borderRadius: 10, background: '#fff', transition: 'border-color .15s' },
  numCardMapped:{ borderColor: '#667eea', background: '#f5f3ff' },
  numBadge:     { fontSize: 22, fontWeight: 700, color: '#1a1a1a', lineHeight: 1 },
  numFreq:      { fontSize: 11, color: '#9ca3af' },
  letterInput:  { width: 44, height: 44, textAlign: 'center', fontSize: 22, fontWeight: 700, border: '2px solid #d1d5db', borderRadius: 8, outline: 'none', cursor: 'text', background: '#f9fafb', color: '#1a1a1a', transition: 'border-color .15s' },
  letterInputMapped: { borderColor: '#667eea', background: '#fff', color: '#667eea' },
  suggBtn:      { display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#92400e', gap: 1 },
  suggConf:     { fontSize: 9, fontWeight: 400, color: '#a16207' },

  // Modo visual — lista de linhas
  symbolList:   { display: 'flex', flexDirection: 'column', gap: 6 },
  symRow:       { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff' },
  symPreview:   { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 48 },
  symId:        { fontSize: 9, color: '#9ca3af' },
  symFreq:      { fontSize: 13, color: '#6b7280', minWidth: 28 },
};
