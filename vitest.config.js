/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'

// Import the separate configs
import rendererConfig from './vite.config.renderer.js'
import mainConfig from './vite.config.main.js'

export default defineConfig({
  // Multi-project configuration
  test: {
    projects: [
      // Renderer process tests (React components, hooks, utilities)
      {
        ...rendererConfig,
        test: {
          ...rendererConfig.test,
          name: 'renderer',
        }
      },
      
      // Main process tests (Electron main, telemetry, services)
      {
        ...mainConfig,
        test: {
          ...mainConfig.test,
          name: 'main',
        }
      }
    ],

    // Global test configuration
    reporter: ['verbose', 'json', 'html'],
    
    // Output configuration
    outputFile: {
      json: './test-results.json',
      html: './test-report.html'
    },

    // Watch configuration
    watch: true,
    
    // UI configuration
    ui: true,
    
    // Global coverage settings (can be overridden by individual projects)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'out/',
        'dist/',
        '**/*.config.{js,ts}',
        '**/*.test.{js,jsx,ts,tsx}',
        '**/*.spec.{js,jsx,ts,tsx}',
        '**/test-utils/**',
        'coverage/**'
      ]
    }
  }
})