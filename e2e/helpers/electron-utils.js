/**
 * Utility functions for Electron E2E testing
 */

/**
 * Track JavaScript errors in the window
 * @param {Page} window - The Electron window
 * @returns {Object} Error tracker with getErrors method
 */
export function checkForJavaScriptErrors(window) {
  const errors = [];
  
  // Listen for console errors
  window.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  // Listen for page errors
  window.on('pageerror', err => {
    errors.push(err.message);
  });
  
  return {
    getErrors: () => [...errors] // Return copy of errors array
  };
}

/**
 * Wait for the application to be ready and fully loaded
 * @param {Page} window - The Electron window
 * @param {number} timeout - Timeout in milliseconds
 */
export async function waitForAppReady(window, timeout = 10000) {
  // Wait for the main content to load
  await window.waitForLoadState('networkidle', { timeout });
  
  // Wait for React app to mount (looking for root element)
  await window.waitForSelector('#root', { timeout });
  
  // Additional wait for app initialization
  await window.waitForTimeout(1000);
}

/**
 * Take a screenshot with timestamp
 * @param {Page} window - The Electron window
 * @param {string} name - Base name for the screenshot
 */
export async function takeTimestampedScreenshot(window, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${timestamp}.png`;
  await window.screenshot({ 
    path: `e2e-results/${filename}`,
    fullPage: true 
  });
  return filename;
}

/**
 * Mock external APIs that might not be available during E2E testing
 * @param {Page} window - The Electron window
 */
export async function mockExternalAPIs(window) {
  // Mock WebSocket connections that might fail in test environment
  await window.addInitScript(() => {
    // Mock WebSocket if needed for testing
    window.__TEST_MODE__ = true;
    
    // You can add specific mocks here for external services
    // For example, mocking the Kick API or 7TV WebSocket
  });
}


/**
 * Wait for an element to be visible and stable
 * @param {Page} window - The Electron window
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in milliseconds
 */
export async function waitForStableElement(window, selector, timeout = 5000) {
  // Wait for element to be visible
  await window.waitForSelector(selector, { 
    state: 'visible', 
    timeout 
  });
  
  // Wait for element to be stable (not animating)
  await window.waitForSelector(selector, { 
    state: 'stable', 
    timeout: 2000 
  });
}

/**
 * Simulate app startup delay that might occur in real usage
 * @param {number} delay - Delay in milliseconds (default: 2000)
 */
export async function simulateStartupDelay(delay = 2000) {
  await new Promise(resolve => setTimeout(resolve, delay));
}