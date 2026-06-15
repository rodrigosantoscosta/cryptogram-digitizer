import { useState } from 'react';
import { Camera, FolderOpen, Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StepIndicator } from '../steps/StepIndicator';
import { StepUpload } from '../steps/StepUpload';
import { StepBatchUpload } from '../steps/StepBatchUpload';
import { StepProcessing } from '../steps/StepProcessing';
import { StepBatchProcessing } from '../steps/StepBatchProcessing';
import { StepPuzzleSelect } from '../steps/StepPuzzleSelect';
import { StepMapping } from '../steps/StepMapping';
import { StepSolution } from '../steps/StepSolution';
import type { ProcessedData } from '@/types/puzzle';
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

  const [puzzleId, setPuzzleId] = useState<string>('puzzle');
  const [batchImages, setBatchImages] = useState<BatchImage[]>([]);
  const [processedPuzzles, setProcessedPuzzles] = useState<ProcessedPuzzle[]>([]);

  const handleImageReady = (data: ImageData, fileName?: string) => {
    if (fileName) {
      // "test.jpg" → "test", "sample_2.jpg" → "sample_2"
      setPuzzleId(fileName.replace(/\.[^/.]+$/, ''));
    }
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
    setPuzzleId(puzzle.name.replace(/\.[^/.]+$/, ''));
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
    setPuzzleId('puzzle');
    setStep('upload');
  };

  const indicatorStep = step === 'solution' ? 'mapping' : step as 'upload' | 'processing' | 'mapping';

  return (
    <div className="min-h-screen bg-surface-page flex flex-col">
      {/* Navigation Bar */}
      <nav className="bg-surface-card border-b border-border px-4 py-2">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera size={20} className="text-primary" />
            <span className="font-semibold text-ink">Cryptogram Digitizer</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-sm text-ink-muted hover:text-ink transition-colors"
            >
              Solver
            </Link>
            <Link
              to="/ground-truth"
              className="text-sm text-ink-muted hover:text-ink transition-colors flex items-center gap-1"
            >
              <Database size={14} />
              Ground Truth
            </Link>
          </div>
        </div>
      </nav>

      {step !== 'upload' && <StepIndicator current={indicatorStep} />}
      <div className="flex-1 py-8 px-5 max-w-5xl mx-auto w-full box-border">
        {step === 'upload' && processedPuzzles.length === 0 && (
          <>
            <div className="flex gap-2 justify-center mb-6">
              <button
                className={`
                  px-5 py-2.5 text-sm font-medium rounded-input transition-all duration-200
                  ${uploadMode === 'single'
                    ? 'text-primary border-primary bg-primary-active'
                    : 'text-ink-muted bg-surface-card border border-border hover:bg-surface-subtle'}
                `}
                onClick={() => setUploadMode('single')}
              >
                <Camera size={16} className="inline mr-1.5" /> Imagem única
              </button>
              <button
                className={`
                  px-5 py-2.5 text-sm font-medium rounded-input transition-all duration-200
                  ${uploadMode === 'batch'
                    ? 'text-primary border-primary bg-primary-active'
                    : 'text-ink-muted bg-surface-card border border-border hover:bg-surface-subtle'}
                `}
                onClick={() => setUploadMode('batch')}
              >
                <FolderOpen size={16} className="inline mr-1.5" /> Lote de imagens
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
            puzzleId={puzzleId}
            originalImage={imageData ?? undefined}
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
