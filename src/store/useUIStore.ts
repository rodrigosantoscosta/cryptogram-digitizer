import { create } from 'zustand';
import type { ProcessingStatus } from '@/types/puzzle';

interface UIStore {
  processingStatus: ProcessingStatus;
  setProcessingStatus: (status: ProcessingStatus) => void;
  resetUI: () => void;
}

const defaultStatus: ProcessingStatus = {
  stage: 'idle',
  progress: 0,
  currentStep: '',
  error: null,
};

export const useUIStore = create<UIStore>()((set) => ({
  processingStatus: defaultStatus,
  setProcessingStatus: (processingStatus) => set({ processingStatus }),
  resetUI: () => set({ processingStatus: defaultStatus }),
}));
