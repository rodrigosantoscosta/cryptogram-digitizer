// src/components/CluePanel/CluePanel.tsx
import type { ClueResult } from '@/types/ocr';
import './CluePanel.css';

interface CluePanelProps {
  clues: ClueResult[];
  activeRow: number | null;
  cellSize: number;
  rowCount: number;
}

export function CluePanel({ clues, activeRow, cellSize, rowCount }: CluePanelProps) {
  const clueMap = new Map<number, ClueResult>();
  for (const clue of clues) {
    clueMap.set(clue.row, clue);
  }

  return (
    <aside className="clue-panel" aria-label="Pistas do criptograma">
      <div className="clue-panel__header">
        <span className="clue-panel__title">Pistas</span>
      </div>
      <div className="clue-panel__list">
        {Array.from({ length: rowCount }, (_, i) => {
          const clue = clueMap.get(i);
          const isActive = activeRow === i;

          return (
            <div
              key={i}
              className={[
                'clue-panel__item',
                isActive ? 'clue-panel__item--active' : '',
                !clue ? 'clue-panel__item--empty' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ minHeight: `${cellSize}px` }}
              aria-current={isActive ? 'true' : undefined}
            >
              <span className="clue-panel__row-num">{i + 1}</span>
              <span className="clue-panel__clue-text">
                {clue ? clue.text : '—'}
              </span>
              {clue && clue.confidence < 0.6 && (
                <span
                  className="clue-panel__confidence-warn"
                  title={`Confiança OCR: ${Math.round(clue.confidence * 100)}%`}
                  aria-label="Leitura incerta"
                >
                  ?
                </span>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
