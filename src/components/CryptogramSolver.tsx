import { useState } from 'react';
import { StepIndicator } from '../steps/StepIndicator';
import { StepUpload } from '../steps/StepUpload';
import { StepProcessing } from '../steps/StepProcessing';
import { StepMapping } from '../steps/StepMapping';
import { StepSolution } from '../steps/StepSolution';
import type { ProcessedData } from '../types/index';
import type { SymbolMapping } from '../types/symbol';

type AppStep = 'upload' | 'processing' | 'mapping' | 'solution';

export function CryptogramSolver() {
  const [step, setStep] = useState<AppStep>('upload');
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [finalMapping, setFinalMapping] = useState<SymbolMapping>({});

  const handleImageReady = (data: ImageData) => {
    setImageData(data);
    setStep('processing');
  };

  const handleProcessingDone = (data: ProcessedData) => {
    setProcessedData(data);
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
    setStep('upload');
  };

  const indicatorStep = step === 'solution' ? 'mapping' : step as 'upload' | 'processing' | 'mapping';

  return (
    <div style={s.root}>
      {step !== 'upload' && <StepIndicator current={indicatorStep} />}
      <div style={s.content}>
        {step === 'upload' && (
          <StepUpload onImageReady={handleImageReady} />
        )}
        {step === 'processing' && imageData && (
          <StepProcessing
            imageData={imageData}
            onDone={handleProcessingDone}
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
};
