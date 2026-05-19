import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/testing/setup-tests.ts'],
    css: false,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/**', // Excluir testes Playwright (E2E) no root
      'src/tests/unit/ImageProcessor.test.ts', // Requer OpenCV real (não roda em jsdom)
    ],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
