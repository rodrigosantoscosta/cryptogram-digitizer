import { useEffect, useRef } from 'react';
import { useImageProcessor } from '../hooks/useImageProcessor';
import type { ProcessedData } from '../types/index';

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
    <div style={s.wrap}>
      <h1 style={s.title}>Processando Criptograma</h1>

      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <span style={{ fontSize: 20, fontWeight: 600, color: '#1a1a1a' }}>
            {STAGE_LABELS[status.stage] ?? status.stage}
          </span>
          <span style={{ fontSize: 28, fontWeight: 700, color: barColor }}>
            {status.progress.toFixed(0)}%
          </span>
        </div>
        <div style={s.barTrack}>
          <div style={{ ...s.barFill, width: `${status.progress}%`, background: barColor }} />
        </div>
        {status.currentStep && (
          <p style={{ fontSize: 13, color: '#666', marginTop: 10, marginBottom: 0 }}>{status.currentStep}</p>
        )}
        {status.error && (
          <div style={s.errorBox}>
            <strong>Erro: </strong>{status.error.message}
            <button style={s.retryBtn} onClick={onBack}>Tentar novamente</button>
          </div>
        )}
      </div>

      <div style={s.imgCard}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#666', marginBottom: 8 }}>
          Imagem carregada — {imageData.width}×{imageData.height}px
        </p>
        <canvas
          ref={(canvas) => {
            if (!canvas) return;
            canvas.width = imageData.width;
            canvas.height = imageData.height;
            canvas.getContext('2d')!.putImageData(imageData, 0, 0);
          }}
          style={{ width: '100%', height: 'auto', borderRadius: 8, border: '1px solid #e5e5e5' }}
        />
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 800, margin: '0 auto' },
  title: { fontSize: 28, fontWeight: 700, marginBottom: 24, color: '#1a1a1a' },
  card: { background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 28, marginBottom: 20 },
  barTrack: { width: '100%', height: 10, background: '#e5e5e5', borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', transition: 'width .3s ease, background .3s' },
  errorBox: {
    background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px',
    color: '#dc2626', fontSize: 13, marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  },
  retryBtn: { background: 'none', border: '1px solid #dc2626', color: '#dc2626', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12 },
  imgCard: { background: '#f8f9fa', border: '1px solid #e5e5e5', borderRadius: 12, padding: 20 },
};