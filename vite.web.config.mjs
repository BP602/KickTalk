import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  plugins: [
    react(),
    {
      name: 'web-preview-csp-adjust',
      apply: 'serve',
      enforce: 'pre',
      transformIndexHtml(html) {
        // For web preview/dev only: remove CSP meta to avoid blocking Vite HMR and eval in dev
        return html.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i, '')
      },
    },
  ],
  define: {
    __WEB_PREVIEW__: true,
  },
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@components': resolve(__dirname, 'src/renderer/src/components'),
      '@assets': resolve(__dirname, 'src/renderer/src/assets'),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    fs: {
      // allow serving icon and other files outside root if needed
      strict: false,
      allow: [resolve(__dirname), resolve(__dirname, 'resources')],
    },
  },
  preview: {
    port: 5175,
    strictPort: true,
  },
  build: {
    outDir: resolve(__dirname, 'out/renderer-web'),
    emptyOutDir: true,
  },
})
