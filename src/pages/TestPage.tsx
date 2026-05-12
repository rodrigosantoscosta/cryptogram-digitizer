import { useState } from 'react';
import { useImageProcessor } from '@/hooks/useImageProcessor';

export function TestPage() {
  const { processImage, status } = useImageProcessor();
  const [result, setResult] = useState<any>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [visualizeUrl, setVisualizeUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detectorLogs, setDetectorLogs] = useState<Array<{ text: string; type: 'success' | 'warn' | 'info' }>>([]);

  /** Intercepta console.log/warn durante o processamento para capturar logs do GridDetector */
  const withLogCapture = (fn: () => Promise<void>) => {
    const logs: Array<{ text: string; type: 'success' | 'warn' | 'info' }> = [];
    const origLog  = console.log.bind(console);
    const origWarn = console.warn.bind(console);

    console.log  = (...args: any[]) => {
      origLog(...args);
      const s = args.join(' ');
      if (s.includes('[GridDetector]')) logs.push({ text: s, type: 'success' });
    };
    console.warn = (...args: any[]) => {
      origWarn(...args);
      const s = args.join(' ');
      if (s.includes('[GridDetector]')) logs.push({ text: s, type: 'warn' });
    };

    return fn().finally(() => {
      console.log  = origLog;
      console.warn = origWarn;
      setDetectorLogs(logs);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setResult(null);
    setVisualizeUrl(null);
    setDetectorLogs([]);

    const objectUrl = URL.createObjectURL(file);
    setOriginalUrl(objectUrl);

    const img = new Image();
    img.src = objectUrl;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      const imageData = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);

      withLogCapture(async () => {
        try {
          const data = await processImage(imageData);
          setResult(data);

          try {
            const { GridDetector } = await import('@/lib/image-processing');
            const vizData = GridDetector.visualize(data.preprocessedImage, data.grid);
            const vizCanvas = document.createElement('canvas');
            vizCanvas.width  = vizData.width;
            vizCanvas.height = vizData.height;
            const vizCtx = vizCanvas.getContext('2d')!;
            vizCtx.putImageData(vizData, 0, 0);
            setVisualizeUrl(vizCanvas.toDataURL());
          } catch (vizErr) {
            console.warn('Visualize falhou:', vizErr);
          }
        } catch (err: any) {
          setError(err?.message ?? String(err));
        }
      });
    };
  };

  const stageColor: Record<string, string> = {
    idle: '#888',
    preprocessing: '#f59e0b',
    detecting: '#3b82f6',
    extracting: '#8b5cf6',
    classifying: '#ec4899',
    ocr: '#06b6d4',
    complete: '#10b981',
    error: '#ef4444',
  };

  // Derivar qual abordagem venceu a partir dos logs capturados
  const winnerLog = detectorLogs.find(l => l.type === 'success' && l.text.includes('✓'));
  const fftPeriodLog = detectorLogs.find(l => l.text.includes('[GridDetector/FFT]'));

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '22px', marginBottom: '4px' }}>🧪 Teste do Pipeline — GridDetector</h1>
      <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>
        Cadeia: <strong>FFT</strong> → Hough → Contornos → Morfologia
      </p>

      <input type="file" accept="image/*" onChange={handleFileUpload}
        style={{ display: 'block', marginBottom: '20px', fontSize: '15px' }} />

      {/* Barra de progresso */}
      <div style={{ marginBottom: '20px', padding: '12px', background: '#f3f4f6', borderRadius: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            padding: '2px 10px',
            borderRadius: '99px',
            fontSize: '13px',
            fontWeight: 600,
            background: stageColor[status.stage] ?? '#888',
            color: '#fff'
          }}>{status.stage}</span>
          <span style={{ fontSize: '14px', color: '#444' }}>{status.currentStep}</span>
          <span style={{ marginLeft: 'auto', fontSize: '13px', color: '#888' }}>{status.progress}%</span>
        </div>
        <div style={{ marginTop: '6px', height: '4px', background: '#e5e7eb', borderRadius: '2px' }}>
          <div style={{
            height: '100%',
            width: `${status.progress}%`,
            background: stageColor[status.stage] ?? '#888',
            borderRadius: '2px',
            transition: 'width 0.3s'
          }} />
        </div>
        {(status.error || error) && (
          <div style={{ color: '#ef4444', marginTop: '6px', fontSize: '13px' }}>
            <p><strong>Erro:</strong> {status.error?.message ?? error}</p>
            {status.error?.stack && (
              <pre style={{ fontSize: '10px', marginTop: '4px', overflowX: 'auto', background: '#fee2e2', padding: '8px' }}>
                {status.error.stack}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Imagens lado a lado */}
      {(originalUrl || visualizeUrl) && (
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {originalUrl && (
            <div style={{ flex: 1, minWidth: '300px' }}>
              <p style={{ fontWeight: 600, marginBottom: '6px', fontSize: '14px' }}>📷 Original</p>
              <img src={originalUrl} style={{ width: '100%', borderRadius: '6px', border: '1px solid #e5e7eb' }} alt="original" />
            </div>
          )}
          {visualizeUrl && (
            <div style={{ flex: 1, minWidth: '300px' }}>
              <p style={{ fontWeight: 600, marginBottom: '6px', fontSize: '14px' }}>🟩 Grade Detectada</p>
              <img src={visualizeUrl} style={{ width: '100%', borderRadius: '6px', border: '1px solid #e5e7eb' }} alt="grade" />
            </div>
          )}
        </div>
      )}

      {/* Painel de diagnóstico do GridDetector */}
      {detectorLogs.length > 0 && (
        <div style={{ marginBottom: '20px', background: '#0f172a', borderRadius: '8px', padding: '14px' }}>
          <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px', fontFamily: 'monospace' }}>
            ▶ GridDetector — logs de detecção
          </p>
          {detectorLogs.map((l, i) => (
            <div key={i} style={{
              fontFamily: 'monospace',
              fontSize: '12px',
              padding: '2px 0',
              color: l.type === 'success' ? '#4ade80' : l.type === 'warn' ? '#facc15' : '#94a3b8',
            }}>
              {l.text}
            </div>
          ))}

          {/* Badge da abordagem vencedora */}
          {winnerLog && (
            <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Método usado:</span>
              <span style={{
                padding: '2px 10px',
                borderRadius: '99px',
                fontSize: '12px',
                fontWeight: 700,
                background: winnerLog.text.includes('FFT') ? '#0ea5e9'
                  : winnerLog.text.includes('Hough') ? '#f97316'
                  : winnerLog.text.includes('contornos') ? '#a855f7'
                  : '#6b7280',
                color: '#fff',
              }}>
                {winnerLog.text.includes('FFT') ? '📡 FFT Projeção'
                  : winnerLog.text.includes('Hough') ? '📐 Hough+Interseção'
                  : winnerLog.text.includes('contornos') ? '⬜ Contornos'
                  : '🔲 Morfologia'}
              </span>
              {fftPeriodLog && (
                <span style={{ fontSize: '11px', color: '#67e8f9', fontFamily: 'monospace' }}>
                  {fftPeriodLog.text.replace('[GridDetector/FFT]', '').trim()}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Estatísticas do resultado */}
      {result && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '12px', color: '#065f46' }}>✅ Resultado</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', marginBottom: '12px' }}>
            {[
              { label: 'Linhas',            value: result.grid?.rows ?? '—' },
              { label: 'Colunas',           value: result.grid?.cols ?? '—' },
              { label: 'Total células',     value: ((result.grid?.rows ?? 0) * (result.grid?.cols ?? 0)) || '—' },
              { label: 'Símbolos extraídos',value: result.extractedSymbols?.length ?? '—' },
              { label: 'Símbolos únicos',   value: result.uniqueSymbols?.length ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: '#fff',
                borderRadius: '6px',
                padding: '10px',
                border: '1px solid #d1fae5',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#059669' }}>{value}</div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>{label}</div>
              </div>
            ))}
          </div>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: '13px', color: '#065f46' }}>Ver JSON do grid</summary>
            <pre style={{
              fontSize: '11px',
              marginTop: '8px',
              overflowX: 'auto',
              background: '#ecfdf5',
              padding: '8px',
              borderRadius: '4px'
            }}>
              {JSON.stringify(result.grid, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
