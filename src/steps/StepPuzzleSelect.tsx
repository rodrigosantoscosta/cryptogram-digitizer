import { useState } from 'react';
import { Check } from 'lucide-react';
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
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-1.5 text-ink">Nenhum criptograma processado</h1>
        <p className="text-sm text-ink-muted mb-7">Todas as imagens falharam no processamento.</p>
        <button className="px-6 py-3 text-sm font-medium text-ink-muted bg-surface-card border border-border rounded-input cursor-pointer hover:bg-surface-subtle transition-colors" onClick={onBack}>Voltar</button>
      </div>
    );
  }

  const handleSelect = () => {
    if (selectedIndex !== null) {
      onSelect(puzzles[selectedIndex]);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-1.5 text-ink">Processamento Concluído</h1>
      <p className="text-sm text-ink-muted mb-7">{puzzles.length} criptograma(s) processado(s). Selecione qual deseja resolver.</p>

      <div className="flex flex-col gap-3 mb-6">
        {puzzles.map((puzzle, idx) => {
          const isSelected = selectedIndex === idx;
          const gridInfo = puzzle.data.grid;
          const cluesCount = puzzle.data.clues?.length ?? 0;
          const symbolsCount = puzzle.data.uniqueSymbols?.length ?? 0;

          return (
            <div
              key={puzzle.id}
              className={`
                bg-surface-card border-2 rounded-card p-4 cursor-pointer transition-all duration-200
                ${isSelected ? 'border-primary bg-primary-active' : 'border-border hover:border-primary/50'}
              `}
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
              <div className="flex items-center gap-3 mb-3">
                <span className="w-8 h-8 rounded-full bg-border flex items-center justify-center text-sm font-semibold text-ink-muted flex-shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink m-0 whitespace-nowrap overflow-hidden text-ellipsis" title={puzzle.name}>{puzzle.name}</p>
                  <p className="text-xs text-ink-muted m-0 mt-0.5">
                    {gridInfo.rows}×{gridInfo.cols} • {symbolsCount} símbolos • {cluesCount} pistas
                  </p>
                </div>
                {isSelected && <Check size={20} className="text-primary font-bold" />}
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
                  className="w-full h-auto max-h-50 object-contain rounded-input border border-border block"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 justify-end">
        <button className="px-6 py-3 text-sm font-medium text-ink-muted bg-surface-card border border-border rounded-input cursor-pointer hover:bg-surface-subtle transition-colors" onClick={onBack}>Voltar</button>
        <button
          className={`
            px-6 py-3 text-sm font-semibold rounded-input cursor-pointer transition-all duration-200
            ${selectedIndex === null
              ? 'bg-ink-faint cursor-not-allowed text-white'
              : 'bg-primary text-white hover:bg-primary-hover'}
          `}
          onClick={handleSelect}
          disabled={selectedIndex === null}
        >
          Resolver selecionado
        </button>
      </div>
    </div>
  );
}
