import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test directory
  testDir: './e2e',
  
  // Run tests in files in parallel
  fullyParallel: false, // Electron apps should not run in parallel
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: 1, // Electron tests should run sequentially
  
  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-results.json' }],
    process.env.CI ? ['github'] : ['list']
  ],
  // Stop early on CI to avoid wasting resources
  maxFailures: process.env.CI ? 1 : undefined,
  
  // Shared settings for all the projects below
  use: {
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Capture screenshot after each test failure
    screenshot: 'only-on-failure',
    
    // Record video on failure
    video: 'retain-on-failure',
  },

  // Configure projects for major browsers and Electron
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.electron.spec.js',
      use: {
        // Electron-specific configuration will be handled in test files
      },
    },
    
    // Optional: Web version testing (if you have a web version)
    {
      name: 'chromium-web',
      testMatch: '**/*.web.spec.js',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Global setup and teardown
  globalSetup: './e2e/global.setup.js',
  globalTeardown: './e2e/global.teardown.js',
  
  // Output directories
  outputDir: 'e2e-results/',
  
  // Timeout settings
  timeout: 30000, // 30 seconds per test
  expect: {
    timeout: 5000, // 5 seconds for assertions
  },

  // Test match patterns
  testMatch: [
    '**/*.e2e.spec.js',
    '**/*.electron.spec.js'
  ],
  
  // Test ignore patterns  
  testIgnore: [
    '**/node_modules/**',
    '**/out/**',
    '**/dist/**'
  ]
});
