import { useState } from 'react';
import { StepIndicator } from '../steps/StepIndicator';
import { StepUpload } from '../steps/StepUpload';
import { StepBatchUpload } from '../steps/StepBatchUpload';
import { StepProcessing } from '../steps/StepProcessing';
import { StepBatchProcessing } from '../steps/StepBatchProcessing';
import { StepPuzzleSelect } from '../steps/StepPuzzleSelect';
import { StepMapping } from '../steps/StepMapping';
import { StepSolution } from '../steps/StepSolution';
import type { ProcessedData } from '../types/index';
import type { SymbolMapping } from '../types/symbol';

type AppStep = 'upload' | 'processing' | 'mapping' | 'solution';
type UploadMode = 'single' | 'batch';

interface BatchImage {
  id: string;
  imageData: ImageData;
  name: string;
}

interface ProcessedPuzzle {
  id: string;
  name: string;
  data: ProcessedData;
}

export function CryptogramSolver() {
  const [uploadMode, setUploadMode] = useState<UploadMode>('single');
  const [step, setStep] = useState<AppStep>('upload');
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [finalMapping, setFinalMapping] = useState<SymbolMapping>({});

  const [batchImages, setBatchImages] = useState<BatchImage[]>([]);
  const [processedPuzzles, setProcessedPuzzles] = useState<ProcessedPuzzle[]>([]);

  const handleImageReady = (data: ImageData) => {
    setImageData(data);
    setStep('processing');
  };

  const handleBatchImagesReady = (images: BatchImage[]) => {
    setBatchImages(images);
    setStep('processing');
  };

  const handleProcessingDone = (data: ProcessedData) => {
    setProcessedData(data);
    setStep('mapping');
  };

  const handleBatchProcessingDone = (results: ProcessedPuzzle[]) => {
    setProcessedPuzzles(results);
    setStep('upload');
  };

  const handlePuzzleSelect = (puzzle: ProcessedPuzzle) => {
    setProcessedData(puzzle.data);
    setStep('mapping');
  };

  const handleMappingComplete = (mapping: SymbolMapping) => {
    setFinalMapping(mapping);
    setStep('solution');
  };

  const handleRestart = () => {
    setImageData(null);
    setProcessedData(null);
    setFinalMapping({});
    setBatchImages([]);
    setProcessedPuzzles([]);
    setStep('upload');
  };

  const indicatorStep = step === 'solution' ? 'mapping' : step as 'upload' | 'processing' | 'mapping';

  return (
    <div style={s.root}>
      {step !== 'upload' && <StepIndicator current={indicatorStep} />}
      <div style={s.content}>
        {step === 'upload' && processedPuzzles.length === 0 && (
          <>
            <div style={s.modeToggle}>
              <button
                style={{ ...s.modeBtn, ...(uploadMode === 'single' ? s.modeBtnActive : {}) }}
                onClick={() => setUploadMode('single')}
              >
                📷 Imagem única
              </button>
              <button
                style={{ ...s.modeBtn, ...(uploadMode === 'batch' ? s.modeBtnActive : {}) }}
                onClick={() => setUploadMode('batch')}
              >
                📁 Lote de imagens
              </button>
            </div>
            {uploadMode === 'single' ? (
              <StepUpload onImageReady={handleImageReady} />
            ) : (
              <StepBatchUpload onImagesReady={handleBatchImagesReady} />
            )}
          </>
        )}

        {step === 'upload' && processedPuzzles.length > 0 && (
          <StepPuzzleSelect
            puzzles={processedPuzzles}
            onSelect={handlePuzzleSelect}
            onBack={handleRestart}
          />
        )}

        {step === 'processing' && imageData && batchImages.length === 0 && (
          <StepProcessing
            imageData={imageData}
            onDone={handleProcessingDone}
            onBack={handleRestart}
          />
        )}

        {step === 'processing' && batchImages.length > 0 && (
          <StepBatchProcessing
            images={batchImages}
            onDone={handleBatchProcessingDone}
            onBack={handleRestart}
          />
        )}

        {step === 'mapping' && processedData && (
          <StepMapping
            processedData={processedData}
            onRestart={handleRestart}
            onSolve={handleMappingComplete}
          />
        )}

        {step === 'solution' && processedData && (
          <StepSolution
            processedData={processedData}
            mapping={finalMapping}
            onBack={() => setStep('mapping')}
            onRestart={handleRestart}
          />
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column' },
  content: { flex: 1, padding: '32px 20px', maxWidth: 1200, margin: '0 auto', width: '100%', boxSizing: 'border-box' },
  modeToggle: { display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 },
  modeBtn: {
    padding: '10px 20px', fontSize: 14, fontWeight: 500, color: '#666',
    background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, cursor: 'pointer',
    transition: 'all .2s',
  },
  modeBtnActive: { color: '#667eea', borderColor: '#667eea', background: '#f0f4ff' },
};
