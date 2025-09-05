import { vi } from 'vitest'

/**
 * Test utilities for Chat Input component tests
 */

// Mock Lexical Editor Factory
export const createMockLexicalEditor = (overrides = {}) => {
  const mockEditor = {
    focus: vi.fn(),
    update: vi.fn((fn) => {
      if (typeof fn === 'function') {
        fn()
      }
    }),
    getRootElement: vi.fn(() => {
      const element = document.createElement('div')
      element.contentEditable = true
      return element
    }),
    registerCommand: vi.fn(() => {
      // Return cleanup function
      return vi.fn()
    }),
    registerUpdateListener: vi.fn(() => {
      // Return cleanup function  
      return vi.fn()
    }),
    registerNodeTransform: vi.fn(() => {
      // Return cleanup function
      return vi.fn()
    }),
    ...overrides
  }
  
  return mockEditor
}

// Mock Chat Store Factory
export const createMockChatStore = (overrides = {}) => {
  return {
    sendMessage: vi.fn().mockResolvedValue(true),
    sendReply: vi.fn().mockResolvedValue(true),
    saveDraftMessage: vi.fn(),
    getDraftMessage: vi.fn().mockReturnValue(''),
    clearDraftMessage: vi.fn(),
    chatrooms: [
      {
        id: 'test-chatroom-1',
        username: 'testuser',
        userChatroomInfo: {
          subscription: true,
          id: 'user123'
        },
        streamerData: {
          id: 'streamer123',
          user_id: 'user123',
          user: { username: 'testuser' },
          subscriber_badges: []
        },
        emotes: [{
          emotes: [
            { id: '1', name: 'Kappa', platform: 'kick' },
            { id: '2', name: 'PogChamp', platform: 'kick' }
          ]
        }],
        channel7TVEmotes: [{
          type: 'channel',
          emotes: [
            { id: '7tv1', name: 'OMEGALUL', platform: '7tv', width: '28px', height: '28px' }
          ]
        }],
        chatroomInfo: { title: 'Test Chat' },
        initialChatroomInfo: { title: 'Test Chat' }
      }
    ],
    chatters: {
      'test-chatroom-1': [
        { id: '1', username: 'chatter1' },
        { id: '2', username: 'chatter2' }
      ]
    },
    personalEmoteSets: [],
    messages: {},
    ...overrides
  }
}

// Mock Lexical Selection
export const createMockSelection = (text = 'test text', offset = 0) => {
  return {
    anchor: {
      getNode: vi.fn(() => ({
        getTextContent: () => text,
        getType: () => 'text',
        setTextContent: vi.fn(),
        splitText: vi.fn(() => [])
      })),
      offset
    },
    insertNodes: vi.fn(),
    isCollapsed: vi.fn(() => true)
  }
}

// Mock Lexical Root
export const createMockRoot = () => {
  return {
    clear: vi.fn(),
    append: vi.fn(),
    getChildren: vi.fn(() => []),
    getFirstChild: vi.fn(() => null),
    getLastChild: vi.fn(() => null)
  }
}

// Mock Lexical TextNode
export const createMockTextNode = (text = '') => {
  return {
    getTextContent: () => text,
    setTextContent: vi.fn(),
    splitText: vi.fn(() => []),
    getParent: vi.fn(() => null),
    replace: vi.fn(),
    remove: vi.fn(),
    getKey: vi.fn(() => 'test-key'),
    getType: () => 'text'
  }
}

// Mock Window App API
export const createMockWindowApp = () => {
  return {
    reply: {
      onData: vi.fn((callback) => {
        // Store callback for manual triggering in tests
        global.mockReplyCallback = callback
        return vi.fn() // cleanup function
      })
    },
    kick: {
      getUserChatroomInfo: vi.fn().mockResolvedValue({
        data: {
          id: '123',
          username: 'testuser',
          slug: 'testuser'
        }
      })
    },
    userDialog: {
      open: vi.fn()
    }
  }
}

// Mock Emote Data
export const createMockEmote = (overrides = {}) => {
  return {
    id: '123',
    name: 'TestEmote',
    platform: 'kick',
    subscribers_only: false,
    width: '28px',
    height: '28px',
    ...overrides
  }
}

// Mock Reply Data  
export const createMockReplyData = (overrides = {}) => {
  return {
    id: 'message123',
    content: 'Original message content',
    sender: {
      id: 'user123',
      username: 'testuser'
    },
    type: 'message',
    ...overrides
  }
}

// Mock Settings
export const createMockSettings = (overrides = {}) => {
  return {
    chatrooms: {
      showInfoBar: true
    },
    sevenTV: {
      enabled: true
    },
    ...overrides
  }
}

// Mock Event Factory
export const createMockKeyEvent = (key, modifiers = {}) => {
  return {
    key,
    shiftKey: modifiers.shift || false,
    ctrlKey: modifiers.ctrl || false,
    altKey: modifiers.alt || false,
    metaKey: modifiers.meta || false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...modifiers
  }
}

// Mock Editor State for Update Listeners
export const createMockEditorState = (textContent = 'test content', selection = null) => {
  return {
    read: vi.fn((fn) => {
      // Mock lexical globals during read
      const originalGetSelection = global.$getSelection
      const originalIsRangeSelection = global.$isRangeSelection
      const originalRootTextContent = global.$rootTextContent
      
      global.$getSelection = vi.fn(() => selection || createMockSelection(textContent))
      global.$isRangeSelection = vi.fn(() => true)
      global.$rootTextContent = vi.fn(() => textContent)
      
      try {
        fn()
      } finally {
        // Restore original functions
        global.$getSelection = originalGetSelection
        global.$isRangeSelection = originalIsRangeSelection  
        global.$rootTextContent = originalRootTextContent
      }
    })
  }
}

// Helper to trigger mock reply
export const triggerMockReply = (replyData) => {
  if (global.mockReplyCallback && typeof global.mockReplyCallback === 'function') {
    global.mockReplyCallback(replyData)
  }
}

// Helper to simulate key command
export const simulateKeyCommand = (editor, command, event) => {
  const commandHandlers = editor.registerCommand.mock.calls
  const handler = commandHandlers.find(call => call[0] === command)?.[1]
  
  if (handler && typeof handler === 'function') {
    return handler(event)
  }
  
  return false
}

// Helper to simulate editor update
export const simulateEditorUpdate = (editor, editorState) => {
  const updateListeners = editor.registerUpdateListener.mock.calls
  const listener = updateListeners[0]?.[0]
  
  if (listener && typeof listener === 'function') {
    listener({ editorState })
  }
}

// Helper to simulate node transform
export const simulateNodeTransform = (editor, nodeType, node) => {
  const transforms = editor.registerNodeTransform.mock.calls
  const transform = transforms.find(call => call[0] === nodeType)?.[1]
  
  if (transform && typeof transform === 'function') {
    transform(node)
  }
}

// Test Data Generators
export const generateChatters = (count = 5) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `chatter${i + 1}`,
    username: `user${i + 1}`
  }))
}

export const generateEmotes = (platform = 'kick', count = 5) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `${platform}${i + 1}`,
    name: `Emote${i + 1}`,
    platform,
    subscribers_only: i % 2 === 0,
    width: '28px',
    height: '28px'
  }))
}

export const generateMessages = (chatroomId, count = 10) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg${i + 1}`,
    content: `Test message ${i + 1}`,
    chatroom_id: chatroomId,
    sender: {
      id: `user${i + 1}`,
      username: `sender${i + 1}`
    },
    created_at: new Date(Date.now() - i * 60000).toISOString(),
    type: 'message'
  }))
}

// Custom matchers for testing
export const customMatchers = {
  toHaveBeenCalledWithEmote: (received, emote) => {
    const calls = received.mock.calls
    const found = calls.some(call => 
      call.some(arg => 
        arg && 
        arg.id === emote.id && 
        arg.name === emote.name && 
        arg.platform === emote.platform
      )
    )
    
    return {
      pass: found,
      message: () => 
        found 
          ? `Expected not to have been called with emote ${emote.name}`
          : `Expected to have been called with emote ${emote.name}`
    }
  },
  
  toHaveBeenCalledWithChatroom: (received, chatroomId) => {
    const calls = received.mock.calls
    const found = calls.some(call => call[0] === chatroomId)
    
    return {
      pass: found,
      message: () =>
        found
          ? `Expected not to have been called with chatroom ${chatroomId}`
          : `Expected to have been called with chatroom ${chatroomId}`
    }
  }
}

// Setup helpers
export const setupMockEnvironment = () => {
  // Setup window.app
  global.window.app = createMockWindowApp()
  
  // Setup localStorage mock
  const localStorageMock = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    clear: vi.fn(),
    removeItem: vi.fn()
  }
  Object.defineProperty(window, 'localStorage', { value: localStorageMock })
  
  // Setup performance mock for timing
  global.performance = {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn()
  }
  
  // Setup requestAnimationFrame mock
  global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16))
  global.cancelAnimationFrame = vi.fn()
  
  return {
    localStorage: localStorageMock,
    windowApp: global.window.app
  }
}

export const cleanupMockEnvironment = () => {
  // Clean up globals
  delete global.mockReplyCallback
  delete global.window.app
  delete global.performance
  delete global.requestAnimationFrame
  delete global.cancelAnimationFrame
}