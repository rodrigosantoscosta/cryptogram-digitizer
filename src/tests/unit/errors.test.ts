import { describe, it, expect } from 'vitest';
import {
  PipelineError,
  GridDetectionError,
  OCRError,
  ExtractionError,
  ClassificationError,
  ClueOCRError,
} from '@/lib/pipeline/errors';

// ─── PipelineError ───────────────────────────────────────────────────────────

describe('PipelineError', () => {
  it('should create error with message, stage, and cause', () => {
    const cause = new Error('root cause');

    const error = new PipelineError('something went wrong', 'gridDetection', cause);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PipelineError);
    expect(error.name).toBe('PipelineError');
    expect(error.message).toBe('something went wrong');
    expect(error.stage).toBe('gridDetection');
    expect(error.cause).toBe(cause);
  });

  it('should create error without cause', () => {
    const error = new PipelineError('no cause', 'preprocessing');

    expect(error.cause).toBeUndefined();
    expect(error.message).toBe('no cause');
    expect(error.stage).toBe('preprocessing');
  });

  it('should be throwable and catchable as Error', () => {
    expect(() => { throw new PipelineError('boom', 'test'); }).toThrow(Error);
    expect(() => { throw new PipelineError('boom', 'test'); }).toThrow('boom');
  });
});

// ─── GridDetectionError ──────────────────────────────────────────────────────

describe('GridDetectionError', () => {
  it('should create with correct name and stage', () => {
    const error = new GridDetectionError('grid not found');

    expect(error).toBeInstanceOf(PipelineError);
    expect(error).toBeInstanceOf(GridDetectionError);
    expect(error.name).toBe('GridDetectionError');
    expect(error.stage).toBe('gridDetection');
    expect(error.message).toBe('grid not found');
  });

  it('should propagate cause', () => {
    const cause = new Error('CV failure');
    const error = new GridDetectionError('grid failed', cause);

    expect(error.cause).toBe(cause);
  });

  it('should allow creation without cause', () => {
    const error = new GridDetectionError('no details');

    expect(error.cause).toBeUndefined();
  });
});

// ─── OCRError ────────────────────────────────────────────────────────────────

describe('OCRError', () => {
  it('should create with correct name and stage', () => {
    const error = new OCRError('ocr failed');

    expect(error).toBeInstanceOf(PipelineError);
    expect(error).toBeInstanceOf(OCRError);
    expect(error.name).toBe('OCRError');
    expect(error.stage).toBe('cellExtraction');
    expect(error.message).toBe('ocr failed');
  });

  it('should propagate cause', () => {
    const cause = new Error('Tesseract timeout');
    const error = new OCRError('ocr timed out', cause);

    expect(error.cause).toBe(cause);
  });
});

// ─── ExtractionError ─────────────────────────────────────────────────────────

describe('ExtractionError', () => {
  it('should create with correct name and stage', () => {
    const error = new ExtractionError('extraction failed');

    expect(error).toBeInstanceOf(PipelineError);
    expect(error).toBeInstanceOf(ExtractionError);
    expect(error.name).toBe('ExtractionError');
    expect(error.stage).toBe('cellExtraction');
  });

  it('should propagate cause', () => {
    const cause = new Error('image corrupt');
    const error = new ExtractionError('could not extract symbols', cause);

    expect(error.cause).toBe(cause);
  });
});

// ─── ClassificationError ─────────────────────────────────────────────────────

describe('ClassificationError', () => {
  it('should create with correct name and stage', () => {
    const error = new ClassificationError('classification failed');

    expect(error).toBeInstanceOf(PipelineError);
    expect(error).toBeInstanceOf(ClassificationError);
    expect(error.name).toBe('ClassificationError');
    expect(error.stage).toBe('classification');
  });

  it('should propagate cause', () => {
    const cause = new Error('cluster error');
    const error = new ClassificationError('could not classify', cause);

    expect(error.cause).toBe(cause);
  });
});

// ─── ClueOCRError ────────────────────────────────────────────────────────────

describe('ClueOCRError', () => {
  it('should create with correct name and stage', () => {
    const error = new ClueOCRError('clue ocr failed');

    expect(error).toBeInstanceOf(PipelineError);
    expect(error).toBeInstanceOf(ClueOCRError);
    expect(error.name).toBe('ClueOCRError');
    expect(error.stage).toBe('clueOCR');
  });

  it('should propagate cause', () => {
    const cause = new Error('segment failure');
    const error = new ClueOCRError('clue segmentation failed', cause);

    expect(error.cause).toBe(cause);
  });
});
