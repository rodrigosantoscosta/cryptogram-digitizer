import { useEffect, useRef } from 'react';
import { useImageProcessor } from '../hooks/useImageProcessor';
import type { ProcessedData } from '@/types/puzzle';

interface Props {
  imageData: ImageData;
  onDone: (data: ProcessedData) => void;
  onBack: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  idle: 'Aguardando...', preprocessing: 'Pré-processando imagem',
  detecting: 'Detectando grade', extracting: 'Extraindo símbolos',
  classifying: 'Classificando símbolos', ocr: 'Reconhecendo pistas',
  complete: 'Concluído', error: 'Erro',
};
const STAGE_COLOR: Record<string, string> = {
  complete: '#22c55e', error: '#ef4444',
};

export function StepProcessing({ imageData, onDone, onBack }: Props) {
  const { processImage, status } = useImageProcessor()
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    processImage(imageData)
      .then((result: ProcessedData) => onDone(result))
      .catch((err: unknown) => console.error('Erro no processamento', err));
  }, [imageData, processImage, onDone]);

  const barColor = STAGE_COLOR[status.stage] ?? '#667eea';

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-ink">Processando Criptograma</h1>

      <div className="bg-surface-card border border-border rounded-card p-7 mb-5">
        <div className="flex justify-between items-baseline mb-3.5">
          <span className="text-xl font-semibold text-ink">
            {STAGE_LABELS[status.stage] ?? status.stage}
          </span>
          <span className="text-3xl font-bold" style={{ color: barColor }}>
            {status.progress.toFixed(0)}%
          </span>
        </div>
        <div className="w-full h-2.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300 ease-in-out"
            style={{ width: `${status.progress}%`, background: barColor }}
          />
        </div>
        {status.currentStep && (
          <p className="text-xs text-ink-muted mt-2.5 mb-0">{status.currentStep}</p>
        )}
        {status.error && (
          <div className="bg-red-50 border border-red-200 rounded-input px-4 py-3 text-error text-sm mt-3.5 flex justify-between items-center">
            <strong>Erro: </strong>{status.error.message}
            <button
              className="bg-none border border-error text-error rounded-input px-3 py-1 cursor-pointer text-xs hover:bg-error/10 transition-colors"
              onClick={onBack}
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>

      <div className="bg-surface-subtle border border-border rounded-card p-5">
        <p className="text-xs font-semibold text-ink-muted mb-2">
          Imagem carregada — {imageData.width}×{imageData.height}px
        </p>
        <canvas
          ref={(canvas) => {
            if (!canvas) return;
            canvas.width = imageData.width;
            canvas.height = imageData.height;
            canvas.getContext('2d')!.putImageData(imageData, 0, 0);
          }}
          className="w-full h-auto rounded-input border border-border"
        />
      </div>
    </div>
  );
}
