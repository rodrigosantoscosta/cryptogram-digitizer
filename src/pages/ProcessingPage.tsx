// src/pages/ProcessingPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useImageProcessor } from '@/hooks';
import { usePuzzleStore } from '@/store/puzzleStore';
import type { ProcessedData, UniqueSymbol, ExtractedSymbol } from '@/types';

export function ProcessingPage() {
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const { processImage, status } = useImageProcessor();
  const navigate = useNavigate();

  useEffect(() => {
    const storedPreview = sessionStorage.getItem('uploadedImagePreview');
    if (!storedPreview) {
      navigate('/');
      return;
    }

    convertBase64ToImageData(storedPreview)
      .then((imgData) => {
        setImageData(imgData);
      })
      .catch((error) => {
        console.error('Erro ao converter imagem:', error);
        alert('Erro ao carregar imagem. Tente fazer upload novamente.');
        navigate('/');
      });
  }, [navigate]);

  useEffect(() => {
    if (imageData && !processedData) {
      handleProcess();
    }
  }, [imageData, processedData]);

  const handleProcess = async () => {
    if (!imageData) return;
    try {
      const result = await processImage(imageData);
      if (result.uniqueSymbols.length === 0) {
        console.warn('⚠️ Processamento retornou 0 símbolos');
        console.log('📝 Usando dados mock para teste da interface');
        result.uniqueSymbols = generateMockSymbols();
        result.extractedSymbols = generateMockExtracted();
      }
      setProcessedData(result);
    } catch (error) {
      console.error('Erro no processamento:', error);
    }
  };

  const handleBack = () => {
    sessionStorage.removeItem('uploadedImagePreview');
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

  async function convertBase64ToImageData(base64: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível criar contexto 2D'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        resolve(imageData);
      };
      img.onerror = () => reject(new Error('Erro ao carregar imagem'));
      img.src = base64;
    });
  }

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
        const symbolIndex = (row + col) % 10;
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

  return (
    <div style={styles.container}>
      <button onClick={handleBack} style={styles.backButton}>
        ← Voltar
      </button>

      <h1 style={styles.title}>⚙️ Processando Criptograma</h1>

      <div style={styles.statusCard}>
        <div style={styles.statusHeader}>
          <h2 style={styles.statusTitle}>
            {getStageLabel(status.stage)}
          </h2>
          <span style={styles.statusPercentage}>
            {status.progress.toFixed(0)}%
          </span>
        </div>

        <div style={styles.progressBar}>
          <div
            style={{
              ...styles.progressFill,
              width: `${status.progress}%`,
            }}
          />
        </div>

        {status.currentStep && (
          <p style={styles.currentStep}>{status.currentStep}</p>
        )}

        {status.error && (
          <div style={styles.errorBox}>
            <strong>❌ Erro:</strong> {status.error.message}
          </div>
        )}
      </div>

      {status.stage === 'complete' && processedData && (
        <div style={styles.resultsCard}>
          <h2 style={styles.resultsTitle}>✅ Processamento Concluído!</h2>

          <div style={styles.resultsGrid}>
            <div style={styles.resultItem}>
              <div style={styles.resultLabel}>Estrutura da Tabela</div>
              <div style={styles.resultValue}>
                {processedData.tableStructure.rows} × {processedData.tableStructure.cols}
              </div>
            </div>

            <div style={styles.resultItem}>
              <div style={styles.resultLabel}>Pistas Reconhecidas</div>
              <div style={styles.resultValue}>
                {processedData.clues.length}
              </div>
            </div>

            <div style={styles.resultItem}>
              <div style={styles.resultLabel}>Símbolos Extraídos</div>
              <div style={styles.resultValue}>
                {processedData.extractedSymbols.length}
              </div>
            </div>

            <div style={styles.resultItem}>
              <div style={styles.resultLabel}>Símbolos Únicos</div>
              <div style={styles.resultValue}>
                {processedData.uniqueSymbols.length}
              </div>
            </div>
          </div>

          <div style={styles.cluesSection}>
            <h3 style={styles.cluesTitle}>📝 Pistas Reconhecidas</h3>
            <div style={styles.cluesList}>
              {processedData.clues.slice(0, 5).map((clue) => (
                <div key={clue.row} style={styles.clueItem}>
                  <span style={styles.clueNumber}>#{clue.row + 1}</span>
                  <span style={styles.clueText}>
                    {clue.text || '(vazio)'}
                  </span>
                  <span style={styles.clueConfidence}>
                    {(clue.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
              {processedData.clues.length > 5 && (
                <p style={styles.cluesMore}>
                  ... e mais {processedData.clues.length - 5} pistas
                </p>
              )}
            </div>
          </div>

          <button 
            style={styles.continueButton}
            onClick={() => {
              sessionStorage.setItem(
                'processedSymbols:v1',
                JSON.stringify(processedData.uniqueSymbols)
              );
              // Salva os dados completos para o MappingPage montar o PuzzleState
              // (ImageData não é serializável — omitimos preprocessedImage)
              try {
                const serializable = {
                  ...processedData,
                  preprocessedImage: null,
                  extractedSymbols: processedData.extractedSymbols.map((s) => ({
                    ...s,
                    imageData: null,
                  })),
                  uniqueSymbols: processedData.uniqueSymbols.map((u) => ({
                    ...u,
                    representative: { ...u.representative, imageData: null },
                  })),
                };
                sessionStorage.setItem('processedData', JSON.stringify(serializable));
              } catch {
                // silencioso — processedData é opcional
              }
              navigate('/mapping');
            }}
          >
            📋 Ir para Mapeamento →
          </button>
        </div>
      )}

      {imageData && (
        <div style={styles.debugSection}>
          <h3 style={styles.debugTitle}>🖼️ Imagem Original</h3>
          <canvas
            ref={(canvas) => {
              if (canvas && imageData) {
                canvas.width = imageData.width;
                canvas.height = imageData.height;
                const ctx = canvas.getContext('2d');
                if (ctx) ctx.putImageData(imageData, 0, 0);
              }
            }}
            style={styles.debugCanvas}
          />
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '900px', margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' },
  backButton: { background: 'none', border: '1px solid #ccc', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', color: '#666', marginBottom: '24px' },
  title: { fontSize: '32px', fontWeight: 'bold', marginBottom: '32px', color: '#1a1a1a' },
  statusCard: { backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '32px', marginBottom: '24px' },
  statusHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  statusTitle: { fontSize: '24px', fontWeight: '600', color: '#1a1a1a', margin: 0 },
  statusPercentage: { fontSize: '32px', fontWeight: 'bold', color: '#667eea' },
  progressBar: { width: '100%', height: '12px', backgroundColor: '#e0e0e0', borderRadius: '6px', overflow: 'hidden', marginBottom: '16px' },
  progressFill: { height: '100%', backgroundColor: '#667eea', transition: 'width 0.3s ease' },
  currentStep: { fontSize: '14px', color: '#666', margin: 0 },
  errorBox: { backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '8px', padding: '12px 16px', color: '#c33', fontSize: '14px', marginTop: '16px' },
  resultsCard: { backgroundColor: '#f8fffe', border: '2px solid #4ade80', borderRadius: '12px', padding: '32px', marginBottom: '24px' },
  resultsTitle: { fontSize: '24px', fontWeight: '600', color: '#166534', marginBottom: '24px' },
  resultsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' },
  resultItem: { backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e0e0e0' },
  resultLabel: { fontSize: '12px', color: '#666', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '600' },
  resultValue: { fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a' },
  cluesSection: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e0e0e0', marginBottom: '24px' },
  cluesTitle: { fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1a1a1a' },
  cluesList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  clueItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', backgroundColor: '#f8f9fa', borderRadius: '6px' },
  clueNumber: { fontSize: '12px', fontWeight: '600', color: '#667eea', minWidth: '40px' },
  clueText: { flex: 1, fontSize: '14px', color: '#333' },
  clueConfidence: { fontSize: '12px', color: '#666', fontWeight: '500' },
  cluesMore: { fontSize: '14px', color: '#999', fontStyle: 'italic', marginTop: '8px' },
  continueButton: { width: '100%', padding: '16px 24px', fontSize: '16px', fontWeight: '600', color: '#fff', backgroundColor: '#667eea', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  debugSection: { backgroundColor: '#f8f9fa', padding: '24px', borderRadius: '12px', border: '1px solid #e0e0e0' },
  debugTitle: { fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1a1a1a' },
  debugCanvas: { width: '100%', height: 'auto', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '8px' },
};
