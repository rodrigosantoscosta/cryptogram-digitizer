import { useState } from 'react';
import type { ProcessedData } from '../types/puzzle';

interface ProcessedPuzzle {
  id: string;
  name: string;
  data: ProcessedData;
}

interface Props {
  puzzles: ProcessedPuzzle[];
  onSelect: (puzzle: ProcessedPuzzle) => void;
  onBack: () => void;
}

export function StepPuzzleSelect({ puzzles, onSelect, onBack }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (puzzles.length === 0) {
    return (
      <div style={s.wrap}>
        <h1 style={s.title}>Nenhum criptograma processado</h1>
        <p style={s.sub}>Todas as imagens falharam no processamento.</p>
        <button style={s.backBtn} onClick={onBack}>Voltar</button>
      </div>
    );
  }

  const handleSelect = () => {
    if (selectedIndex !== null) {
      onSelect(puzzles[selectedIndex]);
    }
  };

  return (
    <div style={s.wrap}>
      <h1 style={s.title}>Processamento Concluído</h1>
      <p style={s.sub}>{puzzles.length} criptograma(s) processado(s). Selecione qual deseja resolver.</p>

      <div style={s.list}>
        {puzzles.map((puzzle, idx) => {
          const isSelected = selectedIndex === idx;
          const gridInfo = puzzle.data.grid;
          const cluesCount = puzzle.data.clues?.length ?? 0;
          const symbolsCount = puzzle.data.uniqueSymbols?.length ?? 0;

          return (
            <div
              key={puzzle.id}
              style={{ ...s.card, ...(isSelected ? s.cardSelected : {}) }}
              onClick={() => setSelectedIndex(idx)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedIndex(idx);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Selecionar criptograma ${puzzle.name}`}
            >
              <div style={s.cardHeader}>
                <span style={s.cardIndex}>{idx + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={s.cardName} title={puzzle.name}>{puzzle.name}</p>
                  <p style={s.cardMeta}>
                    {gridInfo.rows}×{gridInfo.cols} • {symbolsCount} símbolos • {cluesCount} pistas
                  </p>
                </div>
                {isSelected && <span style={s.checkmark}>✓</span>}
              </div>

              {puzzle.data.preprocessedImage && (
                <canvas
                  ref={(canvas) => {
                    if (!canvas) return;
                    const img = puzzle.data.preprocessedImage;
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d')!;
                    ctx.putImageData(img, 0, 0);
                  }}
                  style={s.preview}
                />
              )}
            </div>
          );
        })}
      </div>

      <div style={s.actions}>
        <button style={s.backBtn} onClick={onBack}>Voltar</button>
        <button
          style={{ ...s.selectBtn, ...(selectedIndex === null ? s.selectBtnDisabled : {}) }}
          onClick={handleSelect}
          disabled={selectedIndex === null}
        >
          Resolver selecionado
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 800, margin: '0 auto' },
  title: { fontSize: 28, fontWeight: 700, marginBottom: 6, color: '#1a1a1a' },
  sub: { fontSize: 15, color: '#666', marginBottom: 28 },
  list: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 },
  card: {
    background: '#fff', border: '2px solid #e5e5e5', borderRadius: 12, padding: 16,
    cursor: 'pointer', transition: 'all .2s',
  },
  cardSelected: { borderColor: '#667eea', background: '#f0f4ff' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  cardIndex: {
    width: 32, height: 32, borderRadius: '50%', background: '#e5e5e5',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 600, color: '#666', flexShrink: 0,
  },
  cardName: { fontSize: 15, fontWeight: 600, color: '#1a1a1a', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  cardMeta: { fontSize: 13, color: '#666', margin: '2px 0 0' },
  checkmark: { fontSize: 20, color: '#667eea', fontWeight: 700 },
  preview: { width: '100%', height: 'auto', maxHeight: 200, objectFit: 'contain', borderRadius: 8, border: '1px solid #e5e5e5', display: 'block' },
  actions: { display: 'flex', gap: 12, justifyContent: 'flex-end' },
  backBtn: { padding: '12px 24px', fontSize: 14, fontWeight: 500, color: '#666', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, cursor: 'pointer' },
  selectBtn: { padding: '12px 24px', fontSize: 14, fontWeight: 600, color: '#fff', background: '#667eea', border: 'none', borderRadius: 8, cursor: 'pointer' },
  selectBtnDisabled: { background: '#ccc', cursor: 'not-allowed' },
};
