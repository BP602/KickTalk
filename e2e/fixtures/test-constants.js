/**
 * Test constants and configuration
 */

// Timeouts
export const TIMEOUTS = {
  APP_LAUNCH: 30000,          // 30 seconds for app to launch
  ELEMENT_WAIT: 5000,         // 5 seconds for element to appear
  ANIMATION_WAIT: 1000,       // 1 second for animations
  NETWORK_WAIT: 10000,        // 10 seconds for network requests
  SHORT_WAIT: 500             // 500ms for short waits
};

// CSS Selectors (adjust these based on your actual app)
export const SELECTORS = {
  // Main app elements
  ROOT: '#root',
  MAIN_CONTENT: 'main, .app, .main-content',
  
  // Navigation
  NAV: 'nav, .navigation, [data-testid="navigation"]',
  NAV_ITEMS: 'nav a, .tab, .channel, button[role="tab"]',
  
  // Chat elements
  CHAT_INPUT: 'input[placeholder*="chat" i], textarea[placeholder*="chat" i], input[placeholder*="message" i]',
  CHAT_MESSAGES: '.messages, .chat-messages, [class*="message"], [data-testid*="message"]',
  EMOTE_BUTTON: '[class*="emote"], button[title*="emote" i], [data-testid*="emote"]',
  
  // User interface
  USER_ELEMENTS: '[class*="user"], [class*="profile"], [data-testid*="user"]',
  SETTINGS_BUTTON: 'button[aria-label*="settings" i], [title*="settings" i], [class*="settings"]',
  
  // Common UI elements
  BUTTONS: 'button',
  INPUTS: 'input',
  TEXTAREAS: 'textarea',
  LINKS: 'a',
  MODALS: '.modal, [role="dialog"], [data-testid*="modal"]'
};

// Test data
export const TEST_DATA = {
  SAMPLE_MESSAGE: 'Test message for E2E testing',
  LONG_MESSAGE: 'This is a longer test message that might be used to test text wrapping and display in the chat interface. It contains multiple sentences and should be long enough to test various scenarios.',
  SPECIAL_CHARACTERS: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  UNICODE_MESSAGE: '🎭 Testing unicode: 中文 العربية русский 🚀 ✨',
  
  // User data
  TEST_USERNAME: 'TestUser_E2E',
  TEST_CHANNEL: 'testchannel'
};

// App-specific constants
export const APP_CONFIG = {
  NAME: 'kick-talk',
  VERSION: '1.1.8',
  WINDOW_MIN_WIDTH: 800,
  WINDOW_MIN_HEIGHT: 600,
  
  // Expected elements that should be present
  REQUIRED_ELEMENTS: [
    SELECTORS.ROOT,
    SELECTORS.MAIN_CONTENT
  ]
};

// Test environment settings  
export const TEST_ENV = {
  HEADLESS: process.env.CI === 'true',
  DEBUG: process.env.DEBUG_E2E === 'true',
  SCREENSHOT_ON_FAILURE: true,
  VIDEO_ON_FAILURE: true,
  TRACE_ON_RETRY: true
};

// Error patterns to ignore (non-critical errors that might occur in test environment)
export const IGNORED_ERRORS = [
  /DevTools/i,
  /Extension/i,
  /WebSocket connection/i,
  /Failed to fetch/i,  // Network errors in test environment
  /Non-Error promise rejection captured/i
];