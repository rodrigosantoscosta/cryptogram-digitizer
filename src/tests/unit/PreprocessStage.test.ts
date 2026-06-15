import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PreprocessStage } from '@/lib/pipeline/stages/PreprocessStage';
import { ImageProcessor } from '@/lib/image-processing/ImageProcessor';
import type { PipelineContext } from '@/lib/pipeline/types';

vi.mock('@/lib/image-processing/ImageProcessor', () => ({
  ImageProcessor: {
    preprocess: vi.fn(async (img: ImageData) => {
      // Return a copy to simulate preprocessing
      return new ImageData(
        new Uint8ClampedArray(img.data),
        img.width,
        img.height,
      );
    }),
  },
}));

function makeImageData(width = 8, height = 8): ImageData {
  return new ImageData(
    new Uint8ClampedArray(width * height * 4).fill(128),
    width,
    height,
  );
}

describe('PreprocessStage', () => {
  let stage: PreprocessStage;
  let inputImage: ImageData;

  beforeEach(() => {
    vi.clearAllMocks();
    stage = new PreprocessStage();
    inputImage = makeImageData();
  });

  it('should have the correct stage name', () => {
    expect(stage.name).toBe('preprocessing');
  });

  it('should call ImageProcessor.preprocess with ctx.imageData', async () => {
    const ctx: PipelineContext = { imageData: inputImage };

    await stage.execute(ctx);

    expect(ImageProcessor.preprocess).toHaveBeenCalledTimes(1);
    expect(ImageProcessor.preprocess).toHaveBeenCalledWith(inputImage);
  });

  it('should return a new context with preprocessed field set', async () => {
    const ctx: PipelineContext = { imageData: inputImage };

    const result = await stage.execute(ctx);

    // Original context should be spread
    expect(result.imageData).toBe(inputImage);
    // preprocessed should be set (a new ImageData from the mock)
    expect(result.preprocessed).toBeDefined();
    expect(result.preprocessed).toBeInstanceOf(ImageData);
  });

  it('should preserve existing context fields', async () => {
    const ctx: PipelineContext = {
      imageData: inputImage,
      grid: {} as any,
      usedFallback: true,
    };

    const result = await stage.execute(ctx);

    expect(result.imageData).toBe(inputImage);
    expect(result.grid).toBeDefined();
    expect(result.usedFallback).toBe(true);
    expect(result.preprocessed).toBeDefined();
  });

  it('should not mutate the original context object', async () => {
    const ctx: PipelineContext = { imageData: inputImage };

    const result = await stage.execute(ctx);

    expect(result).not.toBe(ctx);
    expect(ctx).not.toHaveProperty('preprocessed');
  });
});
