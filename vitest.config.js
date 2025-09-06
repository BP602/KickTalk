/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Determine which reporters to use
const reporters = process.env.CI ? ['json', 'html'] : ['verbose', 'json', 'html']

// Determine max forks
const maxForks = process.env.CI ? 1 : 4

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@components': resolve('src/renderer/src/components'),
      '@assets': resolve('src/renderer/src/assets'),
      '@utils': resolve('utils'),
      '@lexical/react': resolve('tests/mocks/lexical-react.js'),
      'electron': resolve('tests/mocks/electron.js'),
    },
  },
  test: {
    globals: true,
    testTimeout: 20000,
    reporters: reporters,
    outputFile: {
      json: './test-results.json',
      html: './test-report.html'
    },
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1
      }
    },
    setupFiles: ['./vitest.setup.renderer.js'],
    environmentMatchGlobs: [
      ['src/renderer/**', 'jsdom'],
      ['src/main/**', 'node'],
      ['src/preload/**', 'node'],
      ['src/telemetry/**', 'node'],
      ['utils/**', 'node'],
    ],
    include: [
      'src/**/*.{test,spec}.{js,jsx,ts,tsx}',
      'utils/**/*.test.js'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'out/**',
      '.git/**',
      '**/*.focused.test.*',
      '**/test-utils.js',
      '**/__tests__/test-utils.js'
    ],
  }
})
