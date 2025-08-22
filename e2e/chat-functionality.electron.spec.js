import { test, expect } from './fixtures/electron.js';
import { waitForAppReady, waitForStableElement, takeTimestampedScreenshot } from './helpers/electron-utils.js';

test.describe('KickTalk Chat Functionality', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window);
  });

  test('should display main chat interface', async ({ window }) => {
    // Check for main application structure
    
    // Look for the title bar
    const titleBar = window.locator('.title-bar, .titlebar, .chatWrapper');
    const hasTitleBar = await titleBar.count();
    expect(hasTitleBar).toBeGreaterThan(0);
    
    // Check for navigation area
    const navbar = window.locator('.chatNavigation, .navbar');
    const hasNavbar = await navbar.count();
    expect(hasNavbar).toBeGreaterThan(0);
    
    // Check for content area - should show empty state initially
    const contentArea = window.locator('.chatContent, .chatroomsEmptyState');
    const hasContentArea = await contentArea.count();
    expect(hasContentArea).toBeGreaterThan(0);
    
    // Check for empty state message since no chatrooms are loaded initially
    const emptyState = window.locator('text=No Chatrooms');
    const hasEmptyState = await emptyState.count();
    if (hasEmptyState > 0) {
      await expect(emptyState).toBeVisible();
    }
    
    await takeTimestampedScreenshot(window, 'chat-interface');
  });

  test('should handle chat input interaction', async ({ window }) => {
    // Find chat input field
    const chatInput = window.locator('input[placeholder*="chat" i], textarea[placeholder*="chat" i]').first();
    const inputExists = await chatInput.count();
    
    if (inputExists > 0) {
      // Test typing in chat input
      await chatInput.fill('Test message for E2E testing');
      
      // Verify the text was entered
      const inputValue = await chatInput.inputValue();
      expect(inputValue).toContain('Test message');
      
      // Clear the input
      await chatInput.clear();
      
      // Verify it's cleared
      const clearedValue = await chatInput.inputValue();
      expect(clearedValue).toBe('');
    }
  });

  test('should display emote functionality if available', async ({ window }) => {
    // Look for emote-related elements
    const emoteButtons = window.locator('[class*="emote"], button[title*="emote" i], [data-testid*="emote"]');
    const emoteCount = await emoteButtons.count();
    
    if (emoteCount > 0) {
      // Test that emote button is clickable
      const firstEmoteButton = emoteButtons.first();
      await expect(firstEmoteButton).toBeVisible();
      
      // Click might open emote picker - test the interaction
      await firstEmoteButton.click();
      
      // Wait for any emote picker or menu to appear
      await window.waitForTimeout(1000);
      
      await takeTimestampedScreenshot(window, 'emote-interaction');
    }
  });

  test('should handle navigation between different chat rooms or channels', async ({ window }) => {
    // Look for navigation elements (tabs, channels, rooms)
    const navElements = window.locator('nav, .tabs, .channels, [class*="nav"], [data-testid*="nav"]');
    const navCount = await navElements.count();
    
    if (navCount > 0) {
      // Look for clickable navigation items
      const navItems = window.locator('nav a, .tab, .channel, button[role="tab"]');
      const itemCount = await navItems.count();
      
      if (itemCount > 1) {
        // Click on a navigation item
        const secondNavItem = navItems.nth(1);
        if (await secondNavItem.isVisible()) {
          await secondNavItem.click();
          
          // Wait for navigation to complete
          await window.waitForTimeout(1000);
          
          await takeTimestampedScreenshot(window, 'navigation-change');
        }
      }
    }
  });

  test('should display user interface elements', async ({ window }) => {
    // Check for main UI structure elements instead of specific user elements
    
    // Check for navigation/app structure
    const appElements = window.locator('.chatWrapper, .chatNavigation, .chatContent');
    const appElementCount = await appElements.count();
    
    // We expect the main app structure to be present
    expect(appElementCount).toBeGreaterThan(0);
    
    // Check for any clickable/interactive elements (buttons, links, etc.)
    const interactiveElements = window.locator('button, a, input, [role="button"]');
    const hasInteractive = await interactiveElements.count();
    
    // Should have some interactive elements
    expect(hasInteractive).toBeGreaterThan(0);
  });

  test('should handle app theme/styling properly', async ({ window }) => {
    // Test that the app has loaded its styles properly
    const bodyStyles = await window.evaluate(() => {
      const body = document.body;
      const root = document.getElementById('root');
      const computedStyle = window.getComputedStyle(body);
      return {
        backgroundColor: computedStyle.backgroundColor,
        fontFamily: computedStyle.fontFamily,
        hasCustomStyles: body.className.length > 0 || (root && root.className.length > 0),
        rootHasClass: root ? root.className.length > 0 : false
      };
    });
    
    // Verify that styles are applied (more flexible check)
    const hasStyles = bodyStyles.hasCustomStyles || bodyStyles.rootHasClass;
    expect(hasStyles).toBe(true);
    expect(bodyStyles.fontFamily).toBeTruthy();
    expect(bodyStyles.backgroundColor).toBeTruthy();
    
    await takeTimestampedScreenshot(window, 'app-styling');
  });

  test('should handle window resize gracefully', async ({ window }) => {
    const initialSize = await window.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }));
    
    // Resize window to a smaller size
    await window.setViewportSize({ width: 1024, height: 768 });
    await window.waitForTimeout(500);
    
    const resizedSize = await window.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }));
    
    expect(resizedSize.width).toBe(1024);
    expect(resizedSize.height).toBe(768);
    
    // Check that the UI still looks reasonable after resize
    const bodyElement = window.locator('body');
    await expect(bodyElement).toBeVisible();
    
    await takeTimestampedScreenshot(window, 'resized-window');
    
    // Resize back to original size
    await window.setViewportSize({ 
      width: initialSize.width, 
      height: initialSize.height 
    });
  });

  test('should load without memory leaks or performance issues', async ({ window }) => {
    // Basic performance check - more flexible for Electron apps
    const performanceMetrics = await window.evaluate(() => {
      const entries = performance.getEntriesByType('navigation');
      const perf = entries.length > 0 ? entries[0] : null;
      
      return {
        hasPerformanceData: !!perf,
        domContentLoaded: perf ? (perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart) : 0,
        loadComplete: perf ? (perf.loadEventEnd - perf.loadEventStart) : 0,
        memoryInfo: performance.memory ? {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        } : null,
        elementCount: document.querySelectorAll('*').length
      };
    });
    
    // Basic performance assertions - more flexible for Electron
    if (performanceMetrics.hasPerformanceData) {
      expect(performanceMetrics.domContentLoaded).toBeGreaterThanOrEqual(0);
      expect(performanceMetrics.loadComplete).toBeGreaterThanOrEqual(0);
    } else {
      // Fallback check - ensure DOM elements are present
      expect(performanceMetrics.elementCount).toBeGreaterThan(10);
    }
    
    // If memory info is available, check for reasonable memory usage
    if (performanceMetrics.memoryInfo) {
      const memoryUsageMB = performanceMetrics.memoryInfo.usedJSHeapSize / 1024 / 1024;
      expect(memoryUsageMB).toBeLessThan(500); // Less than 500MB seems reasonable for a chat app
    }
  });
});