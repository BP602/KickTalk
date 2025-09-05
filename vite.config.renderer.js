/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  
  // Vite configuration for development/build
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@components': resolve('src/renderer/src/components'),
      '@assets': resolve('src/renderer/src/assets'),
      '@utils': resolve('utils'),
      '@lexical/react': resolve('tests/mocks/lexical-react.js'),
    },
  },
  
  // CSS handling for tests
  css: {
    modules: {
      classNameStrategy: 'non-scoped'
    }
  },

  // Vitest configuration
  test: {
    name: 'renderer',
    environment: 'jsdom',
    // Ensure non-watch mode by default
    watch: false,
    // Limit concurrency to reduce memory footprint
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 2,
        minThreads: 1,
      }
    },
    
    // Test files
    include: [
      'src/renderer/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
      'src/renderer/src/**/__tests__/**/*.{js,jsx,ts,tsx}'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/.git/**',
      '**/*.focused.test.{js,jsx,ts,tsx}'
    ],
    
    // Setup files
    setupFiles: ['./vitest.setup.renderer.js'],
    
    // Global test utilities
    globals: true,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      exclude: [
        'node_modules/',
        'src/renderer/src/assets/',
        '**/*.test.{js,jsx,ts,tsx}',
        '**/*.spec.{js,jsx,ts,tsx}',
        '**/test-utils/**'
      ]
    },
    
    // Browser-like environment configuration
    css: true,
    
    // Handle static assets
    assetsInclude: ['**/*.svg', '**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif']
  }
})
