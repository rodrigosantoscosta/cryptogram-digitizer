import { useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { useImageProcessor } from '../hooks/useImageProcessor';
import type { ProcessedData } from '../types/puzzle';

interface BatchImage {
  id: string;
  imageData: ImageData;
  name: string;
}

interface Props {
  images: BatchImage[];
  onDone: (results: { id: string; name: string; data: ProcessedData }[]) => void;
  onBack: () => void;
}

interface ImageStatus {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  error: string | null;
}

const STAGE_LABELS: Record<string, string> = {
  idle: 'Aguardando...',
  preprocessing: 'Pré-processando imagem',
  detecting: 'Detectando grade',
  extracting: 'Extraindo símbolos',
  classifying: 'Classificando símbolos',
  ocr: 'Reconhecendo pistas',
  complete: 'Concluído',
  error: 'Erro',
};

export function StepBatchProcessing({ images, onDone, onBack }: Props) {
  const { processImage, status } = useImageProcessor();
  const [imageStatuses, setImageStatuses] = useState<ImageStatus[]>(
    images.map((img) => ({
      id: img.id,
      name: img.name,
      status: 'pending',
      progress: 0,
      error: null,
    }))
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<{ id: string; name: string; data: ProcessedData }[]>([]);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current || images.length === 0) return;
    ranRef.current = true;

    const processNext = async (index: number) => {
      if (index >= images.length) {
        onDone(results);
        return;
      }

      const img = images[index];

      setImageStatuses((prev) =>
        prev.map((s) => (s.id === img.id ? { ...s, status: 'processing', progress: 0, error: null } : s))
      );

      try {
        const result = await processImage(img.imageData);
        setResults((prev) => [...prev, { id: img.id, name: img.name, data: result }]);

        setImageStatuses((prev) =>
          prev.map((s) => (s.id === img.id ? { ...s, status: 'done', progress: 100, error: null } : s))
        );

        setCurrentIndex(index + 1);
        processNext(index + 1);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
        setImageStatuses((prev) =>
          prev.map((s) => (s.id === img.id ? { ...s, status: 'error', progress: 0, error: errorMsg } : s))
        );

        setCurrentIndex(index + 1);
        processNext(index + 1);
      }
    };

    processNext(0);
  }, []);

  const totalImages = images.length;
  const completedImages = imageStatuses.filter((s) => s.status === 'done').length;
  const errorImages = imageStatuses.filter((s) => s.status === 'error').length;
  const overallProgress = totalImages > 0 ? (completedImages / totalImages) * 100 : 0;

  const currentImage = imageStatuses[currentIndex];
  const currentStageLabel = currentImage?.status === 'processing' ? STAGE_LABELS[status.stage] ?? status.stage : '';

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-ink">Processando Lote</h1>

      <div className="bg-surface-card border border-border rounded-card p-6 mb-5">
        <div className="flex justify-between items-baseline mb-3.5">
          <span className="text-lg font-semibold text-ink">Progresso geral</span>
          <span className="text-2xl font-bold text-primary">{completedImages}/{totalImages}</span>
        </div>
        <div className="w-full h-2.5 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all duration-300 ease-in-out" style={{ width: `${overallProgress}%` }} />
        </div>
        <div className="flex gap-4 mt-3 text-xs text-ink-muted">
          <span className="text-success flex items-center gap-1">
            <CheckCircle size={14} />{completedImages} concluídas
          </span>
          {errorImages > 0 && (
            <span className="text-error flex items-center gap-1">
              <XCircle size={14} />{errorImages} erros
            </span>
          )}
          <span>{totalImages - completedImages - errorImages} pendentes</span>
        </div>
      </div>

      <div className="bg-surface-card border border-border rounded-card p-4">
        {imageStatuses.map((img, idx) => (
          <div
            key={img.id}
            className={`
              flex justify-between items-center p-3 px-4 rounded-input mb-2 bg-surface-subtle transition-colors
              ${img.status === 'processing' ? 'bg-primary-active border border-primary' : ''}
            `}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="w-7 h-7 rounded-full bg-border flex items-center justify-center text-xs font-semibold text-ink-muted flex-shrink-0">
                {idx + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink m-0 whitespace-nowrap overflow-hidden text-ellipsis" title={img.name}>{img.name}</p>
                {img.status === 'processing' && currentStageLabel && (
                  <p className="text-xs text-primary m-0 mt-0.5">{currentStageLabel} — {status.progress.toFixed(0)}%</p>
                )}
                {img.status === 'error' && img.error && (
                  <p className="text-xs text-error m-0 mt-0.5">{img.error}</p>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 ml-3">
              {img.status === 'done' && <span className="text-xs text-success font-medium">Concluído</span>}
              {img.status === 'processing' && (
                <div className="w-20 h-1.5 bg-border rounded-sm overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300 ease-in-out" style={{ width: `${status.progress}%` }} />
                </div>
              )}
              {img.status === 'pending' && <span className="text-xs text-ink-faint">Pendente</span>}
              {img.status === 'error' && <span className="text-xs text-error font-medium">Erro</span>}
            </div>
          </div>
        ))}
      </div>

      {results.length === 0 && errorImages === totalImages && (
        <div className="bg-red-50 border border-red-200 rounded-input px-5 py-4 text-error text-sm mt-5 flex justify-between items-center">
          <strong>Todas as imagens falharam. </strong>
          <button className="bg-none border border-error text-error rounded-input px-4 py-1.5 cursor-pointer text-sm hover:bg-error/10 transition-colors" onClick={onBack}>Tentar novamente</button>
        </div>
      )}
    </div>
  );
}
