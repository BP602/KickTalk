/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'

// Run renderer and main as separate projects so each uses the
// correct environment and setup, reducing JSDOM overhead in Node tests.
export default defineConfig({
  test: {
    projects: [
      { extends: './vite.config.renderer.js' },
      { extends: './vite.config.main.js' },
    ],
    // Keep reporters light by default to reduce memory pressure; enable JSON in CI
    reporters: process.env.CI ? ['json'] : ['default'],
    outputFile: process.env.CI ? { json: './test-results.json' } : undefined,
    // Ensure projects run in a single worker each
    pool: 'threads',
    poolOptions: { threads: { maxThreads: 1, minThreads: 1 } },
  },
})
