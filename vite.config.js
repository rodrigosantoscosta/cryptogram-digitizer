import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
  },
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
      'tests/**',
      'src/tests/unit/ImageProcessor.test.ts',
    ],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    typecheck: {
      tsconfig: 'tsconfig.test.json',
    },
  },
});
