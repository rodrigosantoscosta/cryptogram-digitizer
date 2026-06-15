export class PipelineError extends Error {
  constructor(
    message: string,
    public readonly stage: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'PipelineError';
  }
}

export class GridDetectionError extends PipelineError {
  constructor(message: string, cause?: unknown) {
    super(message, 'gridDetection', cause);
    this.name = 'GridDetectionError';
  }
}

export class OCRError extends PipelineError {
  constructor(message: string, cause?: unknown) {
    super(message, 'cellExtraction', cause);
    this.name = 'OCRError';
  }
}

export class ExtractionError extends PipelineError {
  constructor(message: string, cause?: unknown) {
    super(message, 'cellExtraction', cause);
    this.name = 'ExtractionError';
  }
}

export class ClassificationError extends PipelineError {
  constructor(message: string, cause?: unknown) {
    super(message, 'classification', cause);
    this.name = 'ClassificationError';
  }
}

export class ClueOCRError extends PipelineError {
  constructor(message: string, cause?: unknown) {
    super(message, 'clueOCR', cause);
    this.name = 'ClueOCRError';
  }
}
