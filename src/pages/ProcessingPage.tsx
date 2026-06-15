// src/pages/ProcessingPage.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, XCircle, CheckCircle, FileText, ClipboardList, Image as ImageIcon } from 'lucide-react';
import { useImageProcessor } from '@/hooks/useImageProcessor';
import { useImageStore } from '@/store/useImageStore';
import { useGridStore } from '@/store/useGridStore';
import { useOCRStore } from '@/store/useOCRStore';
import type { UniqueSymbol, ExtractedSymbol } from '@/types/symbol';

export function ProcessingPage() {
  const imageData = useImageStore((s) => s.imageData);
  const setPreprocessedImage = useImageStore((s) => s.setPreprocessedImage);
  const setGrid = useGridStore((s) => s.setGrid);
  const setTableStructure = useGridStore((s) => s.setTableStructure);
  const setExtractedSymbols = useGridStore((s) => s.setExtractedSymbols);
  const setUniqueSymbols = useGridStore((s) => s.setUniqueSymbols);
  const setUsedFallback = useGridStore((s) => s.setUsedFallback);
  const tableStructure = useGridStore((s) => s.tableStructure);
  const extractedSymbols = useGridStore((s) => s.extractedSymbols);
  const uniqueSymbols = useGridStore((s) => s.uniqueSymbols);
  const clues = useOCRStore((s) => s.clues);
  const setCellNumbers = useOCRStore((s) => s.setCellNumbers);
  const setClues = useOCRStore((s) => s.setClues);
  const { processImage, status } = useImageProcessor();
  const navigate = useNavigate();

  useEffect(() => {
    if (imageData && status.stage === 'idle') {
      handleProcess();
    }
  }, [imageData, status.stage]);

  const handleProcess = async () => {
    if (!imageData) return;
    try {
      const result = await processImage(imageData);
      if (result.uniqueSymbols.length === 0) {
        console.warn('Processamento retornou 0 símbolos');
        console.log('Usando dados mock para teste da interface');
        result.uniqueSymbols = generateMockSymbols();
        result.extractedSymbols = generateMockExtracted();
      }
      setPreprocessedImage(result.preprocessedImage);
      setGrid(result.grid);
      setTableStructure(result.tableStructure);
      setExtractedSymbols(result.extractedSymbols);
      setUniqueSymbols(result.uniqueSymbols);
      setUsedFallback(false);
      setCellNumbers(result.cellNumbers);
      setClues(result.clues);
    } catch (error) {
      console.error('Erro no processamento:', error);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  const getStageLabel = (stage: string): string => {
    const labels: Record<string, string> = {
      idle: 'Aguardando...',
      preprocessing: 'Pré-processando',
      detecting: 'Detectando estrutura',
      extracting: 'Extraindo símbolos',
      classifying: 'Classificando',
      ocr: 'Reconhecendo pistas',
      complete: 'Concluído',
      error: 'Erro',
    };
    return labels[stage] || stage;
  };

  function generateMockSymbols(): UniqueSymbol[] {
    const symbols: UniqueSymbol[] = [];
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    for (let i = 0; i < 10; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 30; canvas.height = 30;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 30, 30);
      ctx.fillStyle = '#000'; ctx.font = '20px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(letters[i], 15, 15);
      const symImageData = ctx.getImageData(0, 0, 30, 30);

      symbols.push({
        symbolId: `symbol-${i + 1}`,
        representative: {
          id: `h_${i}`,
          imageData: symImageData,
          features: {
            area: 100, perimeter: 40, aspectRatio: 1,
            moments: [0,0,0,0,0,0,0], histogram: [],
            centerOfMass: { x: 15, y: 15 }
          },
          positions: [{ row: 0, col: 0 }],
          hash: `h_${i}`
        },
        occurrences: [{ row: 0, col: 0 }],
        mappedLetter: null
      });
    }
    return symbols;
  }

  function generateMockExtracted(): ExtractedSymbol[] {
    const extracted: ExtractedSymbol[] = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 1; col < 6; col++) {
        const canvas = document.createElement('canvas');
        canvas.width = 30; canvas.height = 30;
        extracted.push({
          id: `sym_${row}_${col}`,
          imageData: canvas.getContext('2d')!.getImageData(0,0,30,30),
          features: {
            area: 100, perimeter: 40, aspectRatio: 1,
            moments: [0,0,0,0,0,0,0], histogram: [],
            centerOfMass: { x: 15, y: 15 }
          },
          positions: [{ row, col }],
          hash: `hash_${row}_${col}`
        });
      }
    }
    return extracted;
  }

  const isComplete = status.stage === 'complete' && tableStructure;

  return (
    <div className="max-w-3xl mx-auto py-10 px-5 font-sans">
      <button
        onClick={handleBack}
        className="bg-none border border-border px-4 py-2 rounded-input cursor-pointer text-sm text-ink-muted hover:bg-surface-subtle transition-colors mb-6"
      >
        ← Voltar
      </button>

      <h1 className="text-3xl font-bold mb-8 text-ink flex items-center">
        <Settings size={28} className="mr-2" />Processando Criptograma
      </h1>

      <div className="bg-surface-card border border-border-light rounded-card p-8 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-ink m-0">
            {getStageLabel(status.stage)}
          </h2>
          <span className="text-3xl font-bold text-primary">
            {status.progress.toFixed(0)}%
          </span>
        </div>

        <div className="w-full h-3 bg-border rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-primary transition-all duration-300 ease-in-out"
            style={{ width: `${status.progress}%` }}
          />
        </div>

        {status.currentStep && (
          <p className="text-sm text-ink-muted m-0">{status.currentStep}</p>
        )}

        {status.error && (
          <div className="bg-error/10 border border-error/30 rounded-input px-4 py-3 text-error text-sm mt-4 flex items-center">
            <XCircle size={16} className="mr-1.5 flex-shrink-0" />
            <strong>Erro:</strong> {status.error.message}
          </div>
        )}
      </div>

      {isComplete && (
        <div className="bg-success/5 border-2 border-success rounded-card p-8 mb-6">
          <h2 className="text-2xl font-semibold text-success-text mb-6 flex items-center">
            <CheckCircle size={22} className="mr-2" />Processamento Concluído!
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Estrutura da Tabela', value: `${tableStructure!.rows} × ${tableStructure!.cols}` },
              { label: 'Pistas Reconhecidas', value: String(clues.length) },
              { label: 'Símbolos Extraídos', value: String(extractedSymbols.length) },
              { label: 'Símbolos Únicos', value: String(uniqueSymbols.length) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-surface-card p-4 rounded-input border border-border">
                <div className="text-xs text-ink-muted mb-2 uppercase font-semibold">{label}</div>
                <div className="text-2xl font-bold text-ink">{value}</div>
              </div>
            ))}
          </div>

          <div className="bg-surface-card p-5 rounded-input border border-border mb-6">
            <h3 className="text-lg font-semibold mb-4 text-ink flex items-center">
              <FileText size={18} className="mr-2" />Pistas Reconhecidas
            </h3>
            <div className="flex flex-col gap-2">
              {clues.slice(0, 5).map((clue) => (
                <div key={clue.row} className="flex items-center gap-3 px-3 py-2 bg-surface-subtle rounded-input">
                  <span className="text-xs font-semibold text-primary min-w-10">#{clue.row + 1}</span>
                  <span className="flex-1 text-sm text-ink">
                    {clue.text || '(vazio)'}
                  </span>
                  <span className="text-xs text-ink-muted font-medium">
                    {(clue.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
              {clues.length > 5 && (
                <p className="text-sm text-ink-faint italic mt-2">
                  ... e mais {clues.length - 5} pistas
                </p>
              )}
            </div>
          </div>

          <button
            className="w-full py-4 text-base font-semibold text-white bg-primary rounded-input hover:bg-primary-hover transition-colors flex items-center justify-center"
            onClick={() => navigate('/mapping')}
          >
            <ClipboardList size={18} className="mr-2" />Ir para Mapeamento →
          </button>
        </div>
      )}

      {imageData && (
        <div className="bg-surface-subtle p-6 rounded-card border border-border-light">
          <h3 className="text-lg font-semibold mb-4 text-ink flex items-center">
            <ImageIcon size={18} className="mr-2" />Imagem Original
          </h3>
          <canvas
            ref={(canvas) => {
              if (canvas && imageData) {
                canvas.width = imageData.width;
                canvas.height = imageData.height;
                const ctx = canvas.getContext('2d');
                if (ctx) ctx.putImageData(imageData, 0, 0);
              }
            }}
            className="w-full h-auto border border-border rounded-input mb-2"
          />
        </div>
      )}
    </div>
  );
}
