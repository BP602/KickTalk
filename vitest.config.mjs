import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@utils': fileURLToPath(new URL('./utils', import.meta.url)),
      '@renderer': fileURLToPath(new URL('./src/renderer/src', import.meta.url)),
      '@components': fileURLToPath(new URL('./src/renderer/src/components', import.meta.url)),
    },
  },
});
