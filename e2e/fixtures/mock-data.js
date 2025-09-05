/**
 * Mock data and test fixtures for E2E testing
 */

export const mockChatMessages = [
  {
    id: 'msg1',
    user: 'TestUser1',
    message: 'Hello everyone!',
    timestamp: new Date().toISOString(),
    badges: ['viewer']
  },
  {
    id: 'msg2', 
    user: 'TestUser2',
    message: 'How is everyone doing today?',
    timestamp: new Date(Date.now() - 60000).toISOString(),
    badges: ['subscriber', 'vip']
  },
  {
    id: 'msg3',
    user: 'TestModerator',
    message: 'Welcome to the stream!',
    timestamp: new Date(Date.now() - 120000).toISOString(),
    badges: ['moderator', 'subscriber']
  }
];

export const mockUser = {
  id: 'test-user-123',
  username: 'TestUser',
  displayName: 'Test User',
  badges: ['subscriber'],
  isSubscriber: true,
  isModerator: false,
  followDate: '2024-01-01T00:00:00Z'
};

export const mockChannelData = {
  id: 'test-channel-456',
  slug: 'testchannel',
  displayName: 'Test Channel',
  isLive: true,
  viewerCount: 1337,
  category: 'Just Chatting'
};

export const mockEmotes = [
  {
    id: 'emote1',
    name: 'Kappa',
    url: 'https://example.com/emote1.png'
  },
  {
    id: 'emote2', 
    name: 'PogChamp',
    url: 'https://example.com/emote2.png'
  }
];

/**
 * Inject mock data into the Electron app for testing
 * @param {Page} window - The Electron window
 */
export async function injectMockData(window) {
  await window.addInitScript((mockData) => {
    // Set test mode
    window.__TEST_MODE__ = true;
    
    // Inject mock data
    window.__MOCK_DATA__ = mockData;
    
    // Mock WebSocket connections for testing
    window.__MOCK_WEBSOCKET__ = true;
    
    // Override console methods to track test output
    const originalLog = console.log;
    window.__TEST_LOGS__ = [];
    console.log = (...args) => {
      window.__TEST_LOGS__.push(args.join(' '));
      originalLog.apply(console, args);
    };
    
  }, {
    chatMessages: mockChatMessages,
    user: mockUser,
    channel: mockChannelData,
    emotes: mockEmotes
  });
}

/**
 * Get test logs from the application
 * @param {Page} window - The Electron window
 */
export async function getTestLogs(window) {
  return await window.evaluate(() => window.__TEST_LOGS__ || []);
}

/**
 * Clear test logs
 * @param {Page} window - The Electron window  
 */
export async function clearTestLogs(window) {
  await window.evaluate(() => {
    window.__TEST_LOGS__ = [];
  });
}