import { test as base, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import { join } from 'path';

/**
 * Electron test fixture that provides a launched Electron app instance
 */
export const test = base.extend({
  electronApp: async ({}, use) => {
    // Launch Electron app with proper configuration
    const electronApp = await electron.launch({
      args: [join(process.cwd(), 'out/main/index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ELECTRON_IS_DEV: '0',
        // Disable telemetry for testing to avoid network issues
        OTEL_SDK_DISABLED: 'true',
      },
      timeout: 30000,
    });

    // Set up console logging for debugging
    electronApp.on('console', async msg => {
      const values = [];
      for (const arg of msg.args()) {
        try {
          values.push(await arg.jsonValue());
        } catch (error) {
          values.push('[Unable to serialize]');
        }
      }
      console.log('[Electron Main]:', ...values);
    });

    // Use the app in the test
    await use(electronApp);

    // Cleanup: Close the app
    await electronApp.close();
  },

  // First window fixture - properly waits for window using Playwright patterns
  window: async ({ electronApp }, use) => {
    // Use firstWindow method which waits for the first window to be created and loaded
    const window = await electronApp.firstWindow({ timeout: 30000 });
    
    // Set up error logging for the window
    window.on('console', msg => {
      console.log('[Renderer Console]:', msg.text());
    });
    
    window.on('pageerror', err => {
      console.log('[Renderer Error]:', err.message);
    });
    
    // Try different load states - Electron apps may behave differently
    try {
      // First try domcontentloaded which is usually sufficient for Electron apps
      await window.waitForLoadState('domcontentloaded', { timeout: 10000 });
    } catch (error) {
      console.log('domcontentloaded timeout, trying networkidle...');
      try {
        // If that fails, try networkidle since the logs show it fired
        await window.waitForLoadState('networkidle', { timeout: 10000 });
      } catch (error2) {
        console.log('networkidle timeout, proceeding without load state wait...');
        // If all else fails, just proceed - the window is available
      }
    }
    
    // Check if window is still open before looking for elements
    if (window.isClosed()) {
      throw new Error('Window closed unexpectedly during setup');
    }
    
    // Get some debug info about the page state
    try {
      const url = window.url();
      const title = await window.title();
      console.log(`Window URL: ${url}, Title: ${title}`);
      
      // Check if the root element exists in the DOM
      const rootExists = await window.locator('#root').count();
      console.log(`Root element count: ${rootExists}`);
      
      if (rootExists === 0) {
        // If no root, let's see what's in the body
        const bodyContent = await window.locator('body').innerHTML();
        console.log('Body content:', bodyContent.substring(0, 500));
      } else {
        // Root exists, wait for it to be visible
        await window.waitForSelector('#root', { timeout: 10000 });
      }
    } catch (error) {
      console.log('Error during window setup:', error.message);
      // Still try to use the window - maybe it will work in the test
    }
    
    await use(window);
  },
});

// Re-export expect for convenience
export { expect };