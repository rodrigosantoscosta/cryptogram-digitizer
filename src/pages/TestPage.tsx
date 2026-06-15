import { useState } from 'react';
import { Camera, CheckCircle, Waves, Ruler, Square, Grid3X3, Beaker } from 'lucide-react';
import { useImageProcessor } from '@/hooks/useImageProcessor';

export function TestPage() {
  const { processImage, status } = useImageProcessor();
  const [result, setResult] = useState<any>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [visualizeUrl, setVisualizeUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detectorLogs, setDetectorLogs] = useState<Array<{ text: string; type: 'success' | 'warn' | 'info' }>>([]);

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
            const { GridDetector } = await import('@/lib/image-processing/GridDetector');
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

  const winnerLog = detectorLogs.find(l => l.type === 'success' && l.text.includes('✓'));
  const fftPeriodLog = detectorLogs.find(l => l.text.includes('[GridDetector/FFT]'));

  return (
    <div className="py-6 px-6 max-w-4xl mx-auto font-sans">
      <h1 className="text-xl mb-1 flex items-center gap-2">
        <Beaker size={22} />Teste do Pipeline — GridDetector
      </h1>
      <p className="text-xs text-ink-muted mb-5">
        Cadeia: <strong>FFT</strong> → Hough → Contornos → Morfologia
      </p>

      <input type="file" accept="image/*" onChange={handleFileUpload}
        className="block mb-5 text-sm" />

      {/* Barra de progresso */}
      <div className="mb-5 p-3 bg-gray-100 rounded-input">
        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
            style={{ background: stageColor[status.stage] ?? '#888' }}>{status.stage}</span>
          <span className="text-sm text-ink">{status.currentStep}</span>
          <span className="ml-auto text-xs text-ink-faint">{status.progress}%</span>
        </div>
        <div className="mt-1.5 h-1 bg-gray-200 rounded-sm">
          <div className="h-full rounded-sm transition-all duration-300"
            style={{ width: `${status.progress}%`, background: stageColor[status.stage] ?? '#888' }} />
        </div>
        {(status.error || error) && (
          <div className="text-error mt-1.5 text-xs">
            <p><strong>Erro:</strong> {status.error?.message ?? error}</p>
            {status.error?.stack && (
              <pre className="text-xs mt-1 overflow-x-auto bg-red-50 p-2 rounded-sm">
                {status.error.stack}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Imagens lado a lado */}
      {(originalUrl || visualizeUrl) && (
        <div className="flex gap-4 mb-5 flex-wrap">
          {originalUrl && (
            <div className="flex-1 min-w-72">
              <p className="font-semibold mb-1.5 text-sm flex items-center gap-1.5"><Camera size={16} />Original</p>
              <img src={originalUrl} className="w-full rounded-input border border-gray-200" alt="original" />
            </div>
          )}
          {visualizeUrl && (
            <div className="flex-1 min-w-72">
              <p className="font-semibold mb-1.5 text-sm flex items-center gap-1.5"><Grid3X3 size={16} />Grade Detectada</p>
              <img src={visualizeUrl} className="w-full rounded-input border border-gray-200" alt="grade" />
            </div>
          )}
        </div>
      )}

      {/* Painel de diagnóstico do GridDetector */}
      {detectorLogs.length > 0 && (
        <div className="mb-5 bg-slate-900 rounded-input p-3.5">
          <p className="text-slate-400 text-xs mb-2 font-mono">
            ▶ GridDetector — logs de detecção
          </p>
          {detectorLogs.map((l, i) => (
            <div key={i} className={`
              font-mono text-xs py-0.5
              ${l.type === 'success' ? 'text-green-400' : l.type === 'warn' ? 'text-yellow-400' : 'text-slate-400'}
            `}>
              {l.text}
            </div>
          ))}

          {winnerLog && (
            <div className="mt-2.5 flex gap-2 items-center">
              <span className="text-xs text-slate-400">Método usado:</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
                style={{
                  background: winnerLog.text.includes('FFT') ? '#0ea5e9'
                    : winnerLog.text.includes('Hough') ? '#f97316'
                    : winnerLog.text.includes('contornos') ? '#a855f7'
                    : '#6b7280',
                }}>
                {winnerLog.text.includes('FFT') ? <><Waves size={12} className="inline mr-1" />FFT Projeção</>
                  : winnerLog.text.includes('Hough') ? <><Ruler size={12} className="inline mr-1" />Hough+Interseção</>
                  : winnerLog.text.includes('contornos') ? <><Square size={12} className="inline mr-1" />Contornos</>
                  : <><Grid3X3 size={12} className="inline mr-1" />Morfologia</>}
              </span>
              {fftPeriodLog && (
                <span className="text-xs text-cyan-300 font-mono">
                  {fftPeriodLog.text.replace('[GridDetector/FFT]', '').trim()}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Estatísticas do resultado */}
      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-input p-4">
          <h2 className="text-base mb-3 text-emerald-800 flex items-center gap-2"><CheckCircle size={18} />Resultado</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2.5 mb-3">
            {[
              { label: 'Linhas',            value: result.grid?.rows ?? '—' },
              { label: 'Colunas',           value: result.grid?.cols ?? '—' },
              { label: 'Total células',     value: ((result.grid?.rows ?? 0) * (result.grid?.cols ?? 0)) || '—' },
              { label: 'Símbolos extraídos',value: result.extractedSymbols?.length ?? '—' },
              { label: 'Símbolos únicos',   value: result.uniqueSymbols?.length ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-surface-card rounded-input p-2.5 border border-emerald-100 text-center">
                <div className="text-xl font-bold text-emerald-600">{value}</div>
                <div className="text-xs text-ink-muted">{label}</div>
              </div>
            ))}
          </div>
          <details>
            <summary className="cursor-pointer text-xs text-emerald-800">Ver JSON do grid</summary>
            <pre className="text-xs mt-2 overflow-x-auto bg-emerald-50 p-2 rounded-sm">
              {JSON.stringify(result.grid, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
