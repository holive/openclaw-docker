/// <reference types="vitest" />
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, 'src/dashboard'),
  build: {
    outDir: resolve(__dirname, 'dist/dashboard'),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:18790',
      '/health': 'http://localhost:18790',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [resolve(__dirname, 'src/test/setup.ts')],
    root: __dirname,
  },
});
