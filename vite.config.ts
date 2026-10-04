/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // The pdf.js worker ships as .mjs; nginx may serve that extension without a JavaScript type, and
        // nosniff then blocks the module worker. Emitted as .js it is served as JavaScript everywhere.
        assetFileNames: (asset) => (asset.names.some((n) => n.endsWith('.mjs')) ? 'assets/[name]-[hash].js' : 'assets/[name]-[hash][extname]'),
      },
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      // json-summary → coverage/coverage-summary.json, read by the coverage ratchet.
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      // Vendored design system and generated API client are not ours to cover (NFR-12).
      exclude: ['src/design-system/**', 'src/api/generated/**', 'src/test/**', 'src/**/*.test.{ts,tsx}', 'src/main.tsx'],
    },
  },
});
