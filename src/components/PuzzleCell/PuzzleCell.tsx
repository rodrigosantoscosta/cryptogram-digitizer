// src/components/PuzzleCell/PuzzleCell.tsx
import { memo, useRef, useEffect, useCallback } from 'react';
import type { GridCell } from '@/types/grid';
import './PuzzleCell.css';

interface PuzzleCellProps {
  cell: GridCell;
  symbolImageData?: ImageData | null;
  isActive: boolean;
  isHighlighted: boolean;
  isCorrect?: boolean;
  onFocus: (row: number, col: number) => void;
  onChange: (row: number, col: number, value: string) => void;
  onKeyDown: (e: React.KeyboardEvent, row: number, col: number) => void;
}

const offscreenCache = new WeakMap<ImageData, OffscreenCanvas>();

function drawSymbolToCanvas(canvas: HTMLCanvasElement, imageData: ImageData) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let offscreen = offscreenCache.get(imageData);
  if (!offscreen) {
    offscreen = new OffscreenCanvas(imageData.width, imageData.height);
    const octx = offscreen.getContext('2d')!;
    octx.putImageData(imageData, 0, 0);
    offscreenCache.set(imageData, offscreen);
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
}

function areEqual(prev: PuzzleCellProps, next: PuzzleCellProps) {
  return (
    prev.cell === next.cell &&
    prev.isActive === next.isActive &&
    prev.isHighlighted === next.isHighlighted &&
    prev.isCorrect === next.isCorrect &&
    prev.symbolImageData === next.symbolImageData &&
    prev.onFocus === next.onFocus &&
    prev.onChange === next.onChange &&
    prev.onKeyDown === next.onKeyDown
  );
}

export const PuzzleCell = memo(function PuzzleCell({
  cell,
  symbolImageData,
  isActive,
  isHighlighted,
  isCorrect,
  onFocus,
  onChange,
  onKeyDown,
}: PuzzleCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && symbolImageData) {
      drawSymbolToCanvas(canvasRef.current, symbolImageData);
    }
  }, [symbolImageData]);

  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, [isActive]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.toUpperCase().replace(/[^A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀÜ]/g, '');
      const letter = raw.slice(-1);
      onChange(cell.row, cell.col, letter);
    },
    [cell.row, cell.col, onChange],
  );

  const handleFocus = useCallback(() => {
    onFocus(cell.row, cell.col);
  }, [cell.row, cell.col, onFocus]);

  // Célula sem símbolo — espaçador
  if (!cell.symbolId && !cell.isClue) {
    return <div className="puzzle-cell puzzle-cell--empty" />;
  }

  // Célula de pista
  if (cell.isClue) {
    return (
      <div className="puzzle-cell puzzle-cell--clue">
        <span className="puzzle-cell__clue-text">{cell.userValue || ''}</span>
      </div>
    );
  }

  const cellClass = [
    'puzzle-cell',
    'puzzle-cell--symbol',
    isActive ? 'puzzle-cell--active' : '',
    isHighlighted ? 'puzzle-cell--highlighted' : '',
    isCorrect ? 'puzzle-cell--correct' : '',
    !cell.userValue ? 'puzzle-cell--empty-input' : 'puzzle-cell--filled',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cellClass} onClick={() => inputRef.current?.focus()}>
      {symbolImageData && (
        <canvas
          ref={canvasRef}
          width={18}
          height={18}
          className="puzzle-cell__symbol-thumb"
          aria-hidden="true"
        />
      )}
      <input
        ref={inputRef}
        type="text"
        value={cell.userValue || ''}
        maxLength={2}
        className="puzzle-cell__input"
        aria-label={`Célula linha ${cell.row + 1}, coluna ${cell.col + 1}`}
        onFocus={handleFocus}
        onChange={handleChange}
        onKeyDown={(e) => onKeyDown(e, cell.row, cell.col)}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
    </div>
  );
})
