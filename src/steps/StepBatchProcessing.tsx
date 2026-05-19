import { useEffect, useRef, useState } from 'react';
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
    <div style={s.wrap}>
      <h1 style={s.title}>Processando Lote</h1>

      <div style={s.overallCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>
            Progresso geral
          </span>
          <span style={{ fontSize: 24, fontWeight: 700, color: '#667eea' }}>
            {completedImages}/{totalImages}
          </span>
        </div>
        <div style={s.barTrack}>
          <div style={{ ...s.barFill, width: `${overallProgress}%` }} />
        </div>
        <div style={s.stats}>
          <span style={s.statDone}>✅ {completedImages} concluídas</span>
          {errorImages > 0 && <span style={s.statError}>❌ {errorImages} erros</span>}
          <span style={s.statPending}> {totalImages - completedImages - errorImages} pendentes</span>
        </div>
      </div>

      <div style={s.list}>
        {imageStatuses.map((img, idx) => (
          <div key={img.id} style={{ ...s.item, ...(img.status === 'processing' ? s.itemActive : {}) }}>
            <div style={s.itemLeft}>
              <span style={s.itemIndex}>{idx + 1}</span>
              <div>
                <p style={s.itemName} title={img.name}>{img.name}</p>
                {img.status === 'processing' && currentStageLabel && (
                  <p style={s.itemStage}>{currentStageLabel} — {status.progress.toFixed(0)}%</p>
                )}
                {img.status === 'error' && img.error && (
                  <p style={s.itemError}>{img.error}</p>
                )}
              </div>
            </div>
            <div style={s.itemStatus}>
              {img.status === 'done' && <span style={s.badgeDone}>Concluído</span>}
              {img.status === 'processing' && (
                <div style={s.miniBarTrack}>
                  <div style={{ ...s.miniBarFill, width: `${status.progress}%` }} />
                </div>
              )}
              {img.status === 'pending' && <span style={s.badgePending}>Pendente</span>}
              {img.status === 'error' && <span style={s.badgeError}>Erro</span>}
            </div>
          </div>
        ))}
      </div>

      {results.length === 0 && errorImages === totalImages && (
        <div style={s.errorBox}>
          <strong>Todas as imagens falharam. </strong>
          <button style={s.retryBtn} onClick={onBack}>Tentar novamente</button>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 800, margin: '0 auto' },
  title: { fontSize: 28, fontWeight: 700, marginBottom: 24, color: '#1a1a1a' },
  overallCard: { background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 24, marginBottom: 20 },
  barTrack: { width: '100%', height: 10, background: '#e5e5e5', borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', background: '#667eea', transition: 'width .3s ease' },
  stats: { display: 'flex', gap: 16, marginTop: 12, fontSize: 13, color: '#666' },
  statDone: { color: '#22c55e' },
  statError: { color: '#ef4444' },
  statPending: { color: '#999' },
  list: { background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 16 },
  item: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 8, marginBottom: 8, background: '#fafafa' },
  itemActive: { background: '#f0f4ff', border: '1px solid #667eea' },
  itemLeft: { display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  itemIndex: { width: 28, height: 28, borderRadius: '50%', background: '#e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#666', flexShrink: 0 },
  itemName: { fontSize: 14, fontWeight: 500, color: '#1a1a1a', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  itemStage: { fontSize: 12, color: '#667eea', margin: '2px 0 0' },
  itemError: { fontSize: 12, color: '#dc2626', margin: '2px 0 0' },
  itemStatus: { flexShrink: 0, marginLeft: 12 },
  badgeDone: { fontSize: 12, color: '#22c55e', fontWeight: 500 },
  badgePending: { fontSize: 12, color: '#999' },
  badgeError: { fontSize: 12, color: '#dc2626', fontWeight: 500 },
  miniBarTrack: { width: 80, height: 6, background: '#e5e5e5', borderRadius: 3, overflow: 'hidden' },
  miniBarFill: { height: '100%', background: '#667eea', transition: 'width .3s ease' },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '16px 20px', color: '#dc2626', fontSize: 14, marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  retryBtn: { background: 'none', border: '1px solid #dc2626', color: '#dc2626', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontSize: 13 },
};
