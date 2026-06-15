import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import type { GridResult } from '../types/image';

// ─── Samples disponíveis ──────────────────────────────────────────────────────

const SAMPLES = [
  { id: 'test', label: 'Test', file: 'samples/test.jpg' },
  { id: 'sample', label: 'Sample (Legacy)', file: 'legacy/sample.jpg' },
  { id: 'sample_1', label: 'Sample 1', file: 'samples/sample.jpg' },
  { id: 'sample_2', label: 'Sample 2', file: 'samples/sample_2.jpg' },
  { id: 'sample_3', label: 'Sample 3', file: 'samples/sample_3.jpg' },
  { id: 'sample_4', label: 'Sample 4', file: 'samples/sample_4.jpg' },
  { id: 'sample_5', label: 'Sample 5', file: 'samples/sample_5.jpg' },
  { id: 'sample_6', label: 'Sample 6', file: 'samples/sample_6.jpg' },
  { id: 'sample_7', label: 'Sample 7', file: 'samples/sample_7.jpg' },
  { id: 'sample_8', label: 'Sample 8', file: 'samples/sample_8.jpg' },
  { id: 'sample_9', label: 'Sample 9', file: 'samples/sample_9.jpg' },
  { id: 'sample_10', label: 'Sample 10', file: 'samples/sample_10.jpg' },
  { id: 'sample_picto', label: 'Sample Picto', file: 'samples/sample_picto.jpg' },
];

// ─── Tipos ────────────────────────────────────────────────────────────────────

type CellValue = number | null;
type CellGrid = CellValue[][];

/** Célula com coordenadas no canvas (pixels reais da imagem) */
interface CellRect {
  row: number;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

type LoadStatus = 'idle' | 'loading-image' | 'detecting-grid' | 'ready' | 'error';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeFrequency(grid: CellGrid): Record<string, number> {
  const freq: Record<string, number> = {};
  for (const row of grid) {
    for (const cell of row) {
      if (cell !== null) {
        const key = String(cell);
        freq[key] = (freq[key] ?? 0) + 1;
      }
    }
  }
  return freq;
}

function filledCount(grid: CellGrid, skipCol0 = true): number {
  let n = 0;
  for (const row of grid)
    for (let c = 0; c < row.length; c++)
      if ((!skipCol0 || c > 0) && row[c] !== null) n++;
  return n;
}

function totalEditable(grid: CellGrid): number {
  if (!grid.length) return 0;
  return grid.length * (grid[0].length - 1); // exclui coluna 0 (pista)
}

/** Extrai ImageData de um HTMLImageElement via canvas offscreen */
function imageToImageData(img: HTMLImageElement): ImageData {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

/** Converte GridResult em lista plana de CellRect */
function buildCellRects(grid: GridResult): CellRect[] {
  const rects: CellRect[] = [];
  const { roi, rowPositions, colPositions, rowHeights, colWidths } = grid;

  for (let r = 0; r < rowPositions.length; r++) {
    for (let c = 0; c < colPositions.length; c++) {
      rects.push({
        row: r,
        col: c,
        x: roi.x + colPositions[c],
        y: roi.y + rowPositions[r],
        w: colWidths[c] ?? (colWidths[colWidths.length - 1] ?? 40),
        h: rowHeights[r] ?? (rowHeights[rowHeights.length - 1] ?? 40),
      });
    }
  }
  return rects;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function GroundTruthValidator() {
  const [selectedSample, setSelectedSample] = useState<typeof SAMPLES[0] | null>(null);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Imagem original
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);

  // Grid detectado
  const [gridResult, setGridResult] = useState<GridResult | null>(null);
  const [cellRects, setCellRects] = useState<CellRect[]>([]);

  // Valores editados pelo usuário
  const [cellValues, setCellValues] = useState<CellGrid>([]);

  // Célula ativa no overlay
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [inputValue, setInputValue] = useState('');

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Escala canvas→display
  const [scale, setScale] = useState(1);

  // ── Carrega imagem + detecta grade ──────────────────────────────────────────

  const loadSample = useCallback(async (sample: typeof SAMPLES[0]) => {
    setSelectedSample(sample);
    setStatus('loading-image');
    setErrorMsg('');
    setGridResult(null);
    setCellRects([]);
    setCellValues([]);
    setActiveCell(null);
    setImgEl(null);

    // 1. Carrega a imagem
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Falha ao carregar /${sample.file}`));
      el.src = `/${sample.file}`;
    }).catch((err: Error) => {
      setStatus('error');
      setErrorMsg(err.message);
      return null;
    });

    if (!img) return;
    setImgEl(img);

    // 2. Desenha no canvas
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
    }

    // 3. Detecta grade via GridDetector
    setStatus('detecting-grid');
    try {
      const { GridDetector } = await import('../lib/image-processing/GridDetector');
      const imageData = imageToImageData(img);
      const result = GridDetector.detect(imageData);

      setGridResult(result);
      const rects = buildCellRects(result);
      setCellRects(rects);

      // Inicializa grid de valores vazio
      const emptyGrid: CellGrid = Array(result.rows).fill(null)
        .map(() => Array(result.cols).fill(null));
      setCellValues(emptyGrid);

      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setErrorMsg(`Detecção de grade falhou: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  // ── Atualiza escala quando canvas é redimensionado ─────────────────────────

  useEffect(() => {
    if (!canvasRef.current || !imgEl) return;

    const update = () => {
      const canvas = canvasRef.current!;
      const displayW = canvas.getBoundingClientRect().width;
      setScale(displayW / canvas.width);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, [imgEl]);

  // ── Foca input quando célula ativa muda ────────────────────────────────────

  useEffect(() => {
    if (activeCell) {
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [activeCell]);

  // ── Handlers de célula ────────────────────────────────────────────────────

  const handleCellClick = useCallback((row: number, col: number) => {
    if (col === 0) return; // coluna de pista — somente leitura
    setActiveCell({ row, col });
    setInputValue(cellValues[row]?.[col]?.toString() ?? '');
  }, [cellValues]);

  const commitCell = useCallback(() => {
    if (!activeCell) return;
    const { row, col } = activeCell;
    const trimmed = inputValue.trim();
    const num = trimmed === '' ? null : parseInt(trimmed, 10);

    if (num !== null && (isNaN(num) || num < 1 || num > 27)) return; // valor inválido — não salva

    setCellValues(prev => {
      const next = prev.map(r => [...r]);
      next[row][col] = num;
      return next;
    });
    setActiveCell(null);
    setInputValue('');
  }, [activeCell, inputValue]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      commitCell();

      // Avança para próxima célula editável
      if (activeCell && gridResult) {
        let nextCol = activeCell.col + 1;
        let nextRow = activeCell.row;
        if (nextCol >= gridResult.cols) { nextCol = 1; nextRow++; }
        if (nextRow < gridResult.rows) handleCellClick(nextRow, nextCol);
      }
    } else if (e.key === 'Escape') {
      setActiveCell(null);
      setInputValue('');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      commitCell();
      if (activeCell && gridResult) {
        const nextCol = activeCell.col + 1;
        if (nextCol < gridResult.cols) handleCellClick(activeCell.row, nextCol);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      commitCell();
      if (activeCell) {
        const prevCol = activeCell.col - 1;
        if (prevCol >= 1) handleCellClick(activeCell.row, prevCol);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      commitCell();
      if (activeCell && gridResult) {
        const nextRow = activeCell.row + 1;
        if (nextRow < gridResult.rows) handleCellClick(nextRow, activeCell.col);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      commitCell();
      if (activeCell) {
        const prevRow = activeCell.row - 1;
        if (prevRow >= 0) handleCellClick(prevRow, activeCell.col);
      }
    }
  }, [activeCell, commitCell, gridResult, handleCellClick]);

  // ── Export ────────────────────────────────────────────────────────────────

  const buildGroundTruth = useCallback(() => {
    if (!selectedSample || !gridResult) return null;
    return {
      puzzleId: selectedSample.id,
      sourceImage: selectedSample.file,
      type: 'numeric' as const,
      dimensions: { rows: gridResult.rows, cols: gridResult.cols },
      valueRange: { min: 1, max: 27 },
      grid: cellValues,
      frequency: computeFrequency(cellValues),
      metadata: {
        validatedBy: 'manual',
        validatedAt: new Date().toISOString(),
        notes: 'Validated via Ground Truth Validator UI (overlay mode)',
      },
    };
  }, [selectedSample, gridResult, cellValues]);

  const exportJSON = useCallback(() => {
    const gt = buildGroundTruth();
    if (!gt) return;
    const blob = new Blob([JSON.stringify(gt, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${gt.puzzleId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [buildGroundTruth]);

  const copyJSON = useCallback(() => {
    const gt = buildGroundTruth();
    if (!gt) return;
    navigator.clipboard.writeText(JSON.stringify(gt, null, 2));
  }, [buildGroundTruth]);

  // ── Cálculo do input flutuante ────────────────────────────────────────────

  const activeCellRect = activeCell
    ? cellRects.find(r => r.row === activeCell.row && r.col === activeCell.col)
    : null;

  const inputStyle: React.CSSProperties = activeCellRect
    ? {
        position: 'absolute',
        left: activeCellRect.x * scale,
        top: activeCellRect.y * scale,
        width: activeCellRect.w * scale,
        height: activeCellRect.h * scale,
        fontSize: Math.max(10, Math.min(18, activeCellRect.h * scale * 0.55)),
        zIndex: 20,
      }
    : { display: 'none' };

  // ── Stats ─────────────────────────────────────────────────────────────────

  const filled = filledCount(cellValues);
  const total = totalEditable(cellValues);
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-page">
      <div className="max-w-screen-xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink">Ground Truth Validator</h1>
            <p className="text-sm text-ink-muted mt-1">
              Clique em uma célula na imagem para preencher o número (1–27). Tab avança.
            </p>
          </div>
          {status === 'ready' && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink-muted">{filled}/{total} ({pct}%)</span>
              <Button variant="secondary" size="sm" onClick={copyJSON}>Copiar JSON</Button>
              <Button variant="primary" size="sm" onClick={exportJSON}>Exportar JSON</Button>
            </div>
          )}
        </div>

        <div className="flex gap-4">

          {/* Sidebar — lista de samples */}
          <div className="w-52 shrink-0">
            <Card>
              <h2 className="text-sm font-semibold text-ink mb-3">Puzzles</h2>
              <div className="space-y-1 max-h-[80vh] overflow-y-auto">
                {SAMPLES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => loadSample(s)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedSample?.id === s.id
                        ? 'bg-primary text-white font-medium'
                        : 'hover:bg-surface-subtle text-ink'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* Área principal — canvas + overlay */}
          <div className="flex-1 min-w-0">
            {status === 'idle' && (
              <div className="flex items-center justify-center h-96 rounded-xl border border-dashed border-border text-ink-muted">
                Selecione um puzzle à esquerda
              </div>
            )}

            {(status === 'loading-image' || status === 'detecting-grid') && (
              <div className="flex flex-col items-center justify-center h-96 gap-3 text-ink-muted">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">
                  {status === 'loading-image' ? 'Carregando imagem…' : 'Detectando grade (OpenCV.js)…'}
                </span>
              </div>
            )}

            {status === 'error' && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
                <strong>Erro:</strong> {errorMsg}
              </div>
            )}

            {status === 'ready' && (
              <Card>
                {/* Barra de progresso */}
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex-1 h-2 bg-surface-subtle rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <Badge variant={pct === 100 ? 'success' : 'info'}>
                    {pct}% preenchido
                  </Badge>
                  <span className="text-xs text-ink-muted whitespace-nowrap">
                    {gridResult?.rows}×{gridResult?.cols} grade
                  </span>
                </div>

                {/* Atalhos */}
                <p className="text-xs text-ink-muted mb-3">
                  <kbd className="px-1 py-0.5 rounded bg-surface-subtle border border-border font-mono">Tab</kbd> ou{' '}
                  <kbd className="px-1 py-0.5 rounded bg-surface-subtle border border-border font-mono">Enter</kbd> avança ·{' '}
                  <kbd className="px-1 py-0.5 rounded bg-surface-subtle border border-border font-mono">↑↓←→</kbd> navega ·{' '}
                  <kbd className="px-1 py-0.5 rounded bg-surface-subtle border border-border font-mono">Esc</kbd> cancela ·{' '}
                  vazio = apaga célula · col. pista (col 0) é ignorada
                </p>

                {/* Container relativo: canvas + SVG overlay + input flutuante */}
                <div
                  ref={containerRef}
                  className="relative inline-block w-full"
                  // Fecha célula ativa ao clicar fora do SVG
                  onMouseDown={e => {
                    if ((e.target as Element).tagName === 'DIV') commitCell();
                  }}
                >
                  {/* Imagem de referência */}
                  <canvas
                    ref={canvasRef}
                    className="w-full rounded-lg border border-border"
                    style={{ display: 'block' }}
                  />

                  {/* SVG overlay — retângulos das células */}
                  <svg
                    ref={overlayRef}
                    className="absolute inset-0 w-full h-full"
                    style={{ pointerEvents: 'none' }}
                    viewBox={imgEl ? `0 0 ${imgEl.naturalWidth} ${imgEl.naturalHeight}` : '0 0 100 100'}
                    preserveAspectRatio="none"
                  >
                    {cellRects.map(rect => {
                      const val = cellValues[rect.row]?.[rect.col];
                      const isActive = activeCell?.row === rect.row && activeCell?.col === rect.col;
                      const isClue = rect.col === 0;
                      const isFilled = val !== null && !isClue;

                      return (
                        <g
                          key={`${rect.row}-${rect.col}`}
                          style={{ pointerEvents: 'all', cursor: isClue ? 'not-allowed' : 'pointer' }}
                          onClick={() => handleCellClick(rect.row, rect.col)}
                        >
                          {/* Fundo da célula */}
                          <rect
                            x={rect.x}
                            y={rect.y}
                            width={rect.w}
                            height={rect.h}
                            fill={
                              isActive ? 'rgba(59,130,246,0.25)' :
                              isClue ? 'rgba(0,0,0,0.06)' :
                              isFilled ? 'rgba(34,197,94,0.20)' :
                              'rgba(255,255,255,0.01)'
                            }
                            stroke={
                              isActive ? '#3b82f6' :
                              isClue ? '#9ca3af' :
                              isFilled ? '#16a34a' :
                              'rgba(100,116,139,0.35)'
                            }
                            strokeWidth={isActive ? 2.5 : 1}
                          />

                          {/* Valor preenchido */}
                          {isFilled && !isActive && (
                            <text
                              x={rect.x + rect.w / 2}
                              y={rect.y + rect.h / 2}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize={Math.max(8, Math.min(20, rect.h * 0.52))}
                              fontWeight="600"
                              fill="#15803d"
                              fontFamily="monospace"
                            >
                              {val}
                            </text>
                          )}

                          {/* Indicador de linha/coluna no hover — coordenadas para referência */}
                          {isActive && (
                            <text
                              x={rect.x + 2}
                              y={rect.y + 10}
                              fontSize={8}
                              fill="#3b82f6"
                              fontFamily="monospace"
                            >
                              {rect.row},{rect.col}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>

                  {/* Input flutuante sobre a célula ativa */}
                  {activeCell && activeCellRect && (
                    <input
                      ref={inputRef}
                      type="text"
                      inputMode="numeric"
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      onBlur={commitCell}
                      maxLength={2}
                      placeholder="—"
                      style={inputStyle}
                      className="absolute bg-blue-50 border-2 border-blue-500 rounded text-center font-mono font-bold text-ink outline-none"
                    />
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
