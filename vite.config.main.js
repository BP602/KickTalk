/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  // Vite configuration for development/build
  resolve: {
    alias: {
      '@utils': resolve('utils'),
      electron: resolve('tests/mocks/electron.js'),
      'electron-store': resolve('tests/mocks/electron-store.js'),
    },
  },

  // Vitest configuration
  test: {
    name: 'main',
    environment: 'node',
    // Ensure non-watch mode by default
    watch: false,
    deps: {
      optimizer: {
        ssr: {
          // Ensure these packages are processed by Vite so vi.mock/vi.doMock can intercept CJS require()
          include: ['electron', 'electron-store', /@opentelemetry\//]
        }
      }
    },
    
    // Test files for main process
    include: [
      'src/main/**/*.{test,spec}.{js,ts}',
      'src/main/**/__tests__/**/*.{js,ts}',
      'src/preload/**/*.{test,spec}.{js,ts}',
      'src/preload/**/__tests__/**/*.{js,ts}',
      'src/telemetry/**/*.{test,spec}.{js,ts}',
      'utils/**/*.{test,spec}.{js,ts}'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/.git/**',
      '**/*.focused.test.{js,ts}'
    ],
    
    // Setup files
    setupFiles: ['./vitest.setup.main.js'],
    
    // Global test utilities
    globals: true,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      exclude: [
        'node_modules/',
        '**/*.test.{js,ts}',
        '**/*.spec.{js,ts}',
        '**/test-utils/**'
      ]
    },

    // Node.js specific configuration
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true // Safer for Electron main process testing
      }
    }
  }
})
