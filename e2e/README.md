# KickTalk E2E Tests

This directory contains end-to-end tests for the KickTalk Electron application using Playwright.

## Quick Start

```bash
# Run all E2E tests
pnpm run test:e2e

# Run tests in headed mode (visible)  
pnpm run test:e2e:headed

# Debug tests
pnpm run test:e2e:debug

# View test results
pnpm run test:e2e:report
```

## Test Structure

- `app-launch.electron.spec.js` - Tests for app startup and basic functionality
- `chat-functionality.electron.spec.js` - Tests for chat features and UI interactions

## Test Fixtures

- `fixtures/electron.js` - Main Electron test fixture
- `fixtures/mock-data.js` - Mock data for testing
- `fixtures/test-constants.js` - Test configuration and constants

## Helpers

- `helpers/electron-utils.js` - Utility functions for Electron testing

## How Tests Work

1. **Global Setup**: Builds the Electron app if needed (`global.setup.js`)
2. **Test Execution**: Launches Electron app for each test using fixtures
3. **Screenshots**: Captures screenshots on failure in `e2e-results/`
4. **Reports**: Generates HTML reports in `playwright-report/`

## Writing New Tests

Use the Electron fixture to get access to the app:

```javascript
import { test, expect } from './fixtures/electron.js';

test('my new test', async ({ electronApp, window }) => {
  // electronApp = Electron application instance
  // window = First window of the app
  
  // Your test code here
  await expect(window).toHaveTitle(/KickTalk/);
});
```

## Test Configuration

See `playwright.config.js` in the project root for configuration options.