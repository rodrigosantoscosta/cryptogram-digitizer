// src/hooks/useImageProcessor.ts
import { useState, useCallback } from 'react';
import type { ProcessedData, ProcessingStatus } from '@/types/puzzle';

export function useImageProcessor() {
  const [status, setStatus] = useState<ProcessingStatus>({
    stage: 'idle',
    progress: 0,
    currentStep: '',
    error: null,
  });

  const processImage = useCallback(async (imageData: ImageData): Promise<ProcessedData> => {
    try {
      const [
        { PipelineService },
        { RealOpenCVAdapter },
        { HttpOCRAdapter },
      ] = await Promise.all([
        import('@/lib/pipeline/PipelineService'),
        import('@/lib/pipeline/adapters/RealOpenCVAdapter'),
        import('@/lib/pipeline/adapters/HttpOCRAdapter'),
      ]);

      const cvAdapter = new RealOpenCVAdapter();
      const ocrAdapter = new HttpOCRAdapter();
      const pipeline = new PipelineService(cvAdapter, ocrAdapter);

      setStatus({ stage: 'idle', progress: 0, currentStep: 'Starting pipeline...', error: null });

      const result = await pipeline.run(imageData, (progress) => {
        const stageMap: Record<string, ProcessingStatus['stage']> = {
          preprocessing: 'preprocessing',
          gridDetection: 'detecting',
          cellExtraction: 'extracting',
          classification: 'classifying',
          clueOCR: 'ocr',
        };

        setStatus({
          stage: stageMap[progress.stage] ?? 'idle',
          progress: progress.progress,
          currentStep: progress.message,
          error: null,
        });
      });

      setStatus({ stage: 'complete', progress: 100, currentStep: 'Processing complete!', error: null });

      return result;
    } catch (error) {
      console.error('[useImageProcessor] Pipeline error:', error, (error as any)?.stack);
      setStatus({ stage: 'error', progress: 0, currentStep: 'Processing error', error: error as Error });
      throw error;
    }
  }, []);

  return { processImage, status };
}
