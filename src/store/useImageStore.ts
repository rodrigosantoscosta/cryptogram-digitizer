import { create } from 'zustand';

interface ImageStore {
  imageData: ImageData | null;
  preprocessedImage: ImageData | null;
  setImageData: (data: ImageData | null) => void;
  setPreprocessedImage: (data: ImageData | null) => void;
  clearImage: () => void;
}

export const useImageStore = create<ImageStore>()((set) => ({
  imageData: null,
  preprocessedImage: null,
  setImageData: (data) => set({ imageData: data }),
  setPreprocessedImage: (data) => set({ preprocessedImage: data }),
  clearImage: () => set({ imageData: null, preprocessedImage: null }),
}));
