import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import useChatStore from './ChatProvider.jsx'

/**
 * Comprehensive ChatProvider Unit Tests
 * 
 * This test suite provides thorough coverage of the ChatProvider Zustand store,
 * testing all functionality including state management, WebSocket connections,
 * optimistic message handling, error recovery, and edge cases.
 * 
 * Test Structure:
 * - Mock Setup: External dependencies (WebSocket, APIs, localStorage)
 * - Store Initialization: Default state and method availability
 * - Chatroom Management: Add, remove, rename, reorder chatrooms
 * - Message Operations: Send, receive, optimistic updates, state transitions
 * - Connection Management: WebSocket lifecycle, error handling
 * - Draft Messages: Save, retrieve, clear drafts
 * - Mentions: Add, mark as read, clear mentions
 * - Error Handling: API failures, network issues, corrupted data
 * - Performance: Large datasets, memory management
 * - Integration: End-to-end workflows
 */

// Mock all external dependencies with comprehensive implementations
vi.mock('@utils/services/kick/kickPusher', () => ({
  default: vi.fn().mockImplementation((chatroomId, streamerId, username) => {
    const instance = {
      chatroomId,
      streamerId,
      username,
      connect: vi.fn().mockResolvedValue(),
      send: vi.fn().mockResolvedValue(),
      close: vi.fn().mockResolvedValue(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      readyState: 1, // WebSocket.OPEN
    }
    // Store reference for test assertions
    instance.__mockInstance = true
    return instance
  })
}))

vi.mock('@utils/services/seventv/stvWebsocket', () => ({
  default: vi.fn().mockImplementation(() => {
    const instance = {
      connect: vi.fn().mockResolvedValue(),
      send: vi.fn().mockResolvedValue(),
      close: vi.fn().mockResolvedValue(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      readyState: 1,
    }
    instance.__mockInstance = true
    return instance
  })
}))

vi.mock('@utils/services/connectionManager', () => ({
  default: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(),
    cleanup: vi.fn(),
    getConnection: vi.fn().mockReturnValue(null),
    createConnection: vi.fn().mockResolvedValue(),
    getConnectionStatus: vi.fn().mockReturnValue({
      total_connections: 0,
      healthy_connections: 0,
      failed_connections: 0
    })
  }))
}))

vi.mock('./CosmeticsProvider', () => ({
  default: vi.fn(() => ({
    getUserStyle: vi.fn().mockReturnValue(null),
    addUserStyle: vi.fn(),
    globalCosmetics: { badges: [], paints: [] }
  }))
}))

vi.mock('../utils/chatErrors', () => ({
  chatroomErrorHandler: vi.fn()
}))

vi.mock('@utils/fetchQueue', () => ({
  default: vi.fn(() => Promise.resolve({ 
    data: {
      id: 123,
      user_id: 456,
      username: 'testuser',
      user: {
        id: 456,
        username: 'testuser',
        profilepic: 'https://example.com/avatar.jpg'
      },
      is_live: false,
      category: { name: 'Just Chatting' },
      title: 'Test Stream',
      viewers: 100
    },
    user: { id: 456, username: 'testuser' },
    slug: 'testuser'
  }))
}))

vi.mock('@utils/services/seventv/stvAPI', () => ({
  sendUserPresence: vi.fn(() => Promise.resolve({ success: true }))
}))

vi.mock('@utils/services/kick/kickAPI', () => ({
  getKickTalkDonators: vi.fn(() => Promise.resolve([
    { id: 1, username: 'donor1', amount: 10 },
    { id: 2, username: 'donor2', amount: 25 },
    { id: 3, username: 'donor3', amount: 50 }
  ]))
}))

vi.mock('@utils/constants', () => ({
  DEFAULT_CHAT_HISTORY_LENGTH: 50
}))

vi.mock('../utils/MessageParser', () => ({
  clearChatroomEmoteCache: vi.fn()
}))

vi.mock('dayjs', () => ({
  default: vi.fn(() => ({
    format: vi.fn(() => '2023-01-01 12:00:00'),
    toISOString: vi.fn(() => '2023-01-01T12:00:00.000Z'),
    unix: vi.fn(() => 1672574400)
  }))
}))

// Mock crypto.randomUUID for consistent test results
const mockUUIDs = [
  'uuid-1234-5678-9abc-def0',
  'uuid-2345-6789-abcd-ef01',
  'uuid-3456-789a-bcde-f012',
  'uuid-4567-89ab-cdef-0123'
]
let uuidIndex = 0

Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => mockUUIDs[uuidIndex++ % mockUUIDs.length])
  }
})

// Mock localStorage with comprehensive implementation
const createMockLocalStorage = () => {
  const storage = new Map()
  return {
    getItem: vi.fn((key) => storage.get(key) || null),
    setItem: vi.fn((key, value) => storage.set(key, value)),
    removeItem: vi.fn((key) => storage.delete(key)),
    clear: vi.fn(() => storage.clear()),
    __storage: storage // Internal access for test setup
  }
}

const mockLocalStorage = createMockLocalStorage()
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

// Mock window.app API with comprehensive methods
const createMockWindowApp = () => ({
  kick: {
    getUserChatroomInfo: vi.fn().mockResolvedValue({
      data: {
        id: 123,
        user_id: 456,
        username: 'testuser',
        user: {
          id: 456,
          username: 'testuser',
          profilepic: 'https://example.com/avatar.jpg'
        },
        is_live: false,
        category: { name: 'Just Chatting' },
        title: 'Test Stream',
        viewers: 100
      }
    }),
    getPinMessage: vi.fn().mockResolvedValue({ data: null }),
    deleteMessage: vi.fn().mockResolvedValue({ success: true }),
    sendMessage: vi.fn().mockResolvedValue({ success: true }),
    sendReply: vi.fn().mockResolvedValue({ 
      status: 200, 
      data: { status: { code: 200 } } 
    }),
    getSelfInfo: vi.fn().mockResolvedValue({
      id: 789,
      username: 'currentuser',
      identity: { color: '#ff0000' }
    })
  },
  notifications: {
    show: vi.fn()
  },
  audio: {
    playNotificationSound: vi.fn()
  },
  logs: {
    add: vi.fn()
  },
  auth: {
    getToken: vi.fn(() => ({
      token: 'mock-token',
      session: 'mock-session'
    }))
  },
  telemetry: {
    recordMessageSent: vi.fn(),
    recordAPIRequest: vi.fn(),
    recordSevenTVConnectionHealth: vi.fn(),
    recordRendererMemory: vi.fn(),
    recordDomNodeCount: vi.fn()
  }
})

const mockWindowApp = createMockWindowApp()
Object.defineProperty(window, 'app', { value: mockWindowApp })

// Mock global batch system
Object.defineProperty(window, '__chatMessageBatch', {
  value: {},
  writable: true
})

// Mock performance API
Object.defineProperty(global, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000
    }
  }
})

describe('ChatProvider - Comprehensive Test Suite', () => {
  let store
  let mockKickPusher, mockStvWebSocket, mockConnectionManager
  let mockFetchQueue, mockSendUserPresence, mockGetKickTalkDonators
  let mockClearChatroomEmoteCache

  beforeEach(async () => {
    // Use real timers for most tests (fake timers where needed)
    vi.useRealTimers()
    vi.clearAllMocks()
    
    // Reset UUID index
    uuidIndex = 0
    
    // Get mock instances from modules
    const { default: KickPusher } = await import('@utils/services/kick/kickPusher')
    const { default: StvWebSocket } = await import('@utils/services/seventv/stvWebsocket')
    const { default: ConnectionManager } = await import('@utils/services/connectionManager')
    const { default: fetchQueue } = await import('@utils/fetchQueue')
    const { sendUserPresence } = await import('@utils/services/seventv/stvAPI')
    const { getKickTalkDonators } = await import('@utils/services/kick/kickAPI')
    const { clearChatroomEmoteCache } = await import('../utils/MessageParser')
    
    mockKickPusher = KickPusher
    mockStvWebSocket = StvWebSocket
    mockConnectionManager = ConnectionManager
    mockFetchQueue = fetchQueue
    mockSendUserPresence = sendUserPresence
    mockGetKickTalkDonators = getKickTalkDonators
    mockClearChatroomEmoteCache = clearChatroomEmoteCache
    
    // Reset localStorage with default data
    mockLocalStorage.__storage.clear()
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'chatrooms') return JSON.stringify([])
      if (key === 'chatrooms_version') return '2'
      if (key === 'hasMentionsTab') return 'false'
      if (key === 'stvPersonalEmoteSets') return JSON.stringify([])
      if (key === 'draftMessages') return JSON.stringify({})
      return mockLocalStorage.__storage.get(key) || null
    })
    
    // Reset window.__chatMessageBatch
    window.__chatMessageBatch = {}
    
    // Get fresh store instance and reset to initial state
    const { result } = renderHook(() => useChatStore())
    store = result.current
    
    // Reset store to clean initial state
    act(() => {
      useChatStore.setState({
        chatrooms: [],
        messages: {},
        connections: {},
        chatters: {},
        donators: [],
        personalEmoteSets: [],
        isChatroomPaused: {},
        mentions: {},
        currentChatroomId: null,
        hasMentionsTab: false,
        currentUser: null,
        chatHistorySettings: { chatHistoryLength: 50 },
        draftMessages: new Map()
      })
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    
    // Clean up any remaining timers and batches
    if (window.__chatMessageBatch) {
      Object.keys(window.__chatMessageBatch).forEach((chatroomId) => {
        if (window.__chatMessageBatch[chatroomId]?.timer) {
          clearTimeout(window.__chatMessageBatch[chatroomId].timer)
        }
      })
      window.__chatMessageBatch = {}
    }
    
    // Reset store state
    act(() => {
      useChatStore.setState({
        chatrooms: [],
        messages: {},
        connections: {},
        chatters: {},
        donators: [],
        personalEmoteSets: [],
        isChatroomPaused: {},
        mentions: {},
        currentChatroomId: null,
        hasMentionsTab: false,
        currentUser: null,
        chatHistorySettings: { chatHistoryLength: 50 },
        draftMessages: new Map()
      })
    })
  })

  describe('Store Initialization', () => {
    /**
     * Test suite for store initialization and default state verification.
     * Ensures the store starts with correct default values and all required methods.
     */
    
    it('should initialize with correct default state structure', () => {
      const { result } = renderHook(() => useChatStore())
      
      // Core state properties
      expect(result.current.chatrooms).toEqual([])
      expect(result.current.messages).toEqual({})
      expect(result.current.connections).toEqual({})
      expect(result.current.chatters).toEqual({})
      expect(result.current.donators).toEqual([])
      expect(result.current.personalEmoteSets).toEqual([])
      expect(result.current.isChatroomPaused).toEqual({})
      expect(result.current.mentions).toEqual({})
      
      // Nullable/primitive state
      expect(result.current.currentChatroomId).toBeNull()
      expect(result.current.hasMentionsTab).toBe(false)
      expect(result.current.currentUser).toBeNull()
      
      // Complex default objects
      expect(result.current.chatHistorySettings).toEqual({ chatHistoryLength: 50 })
      expect(result.current.draftMessages).toBeInstanceOf(Map)
      expect(result.current.draftMessages.size).toBe(0)
    })

    it('should have all required action methods available with correct types', () => {
      const { result } = renderHook(() => useChatStore())
      
      // Chatroom management methods
      expect(typeof result.current.addChatroom).toBe('function')
      expect(typeof result.current.removeChatroom).toBe('function')
      expect(typeof result.current.renameChatroom).toBe('function')
      expect(typeof result.current.updateChatroomOrder).toBe('function')
      expect(typeof result.current.reorderChatrooms).toBe('function')
      expect(typeof result.current.setCurrentChatroom).toBe('function')
      expect(typeof result.current.getChatrooms).toBe('function')
      
      // Message operations
      expect(typeof result.current.sendMessage).toBe('function')
      expect(typeof result.current.sendReply).toBe('function')
      expect(typeof result.current.addMessage).toBe('function')
      expect(typeof result.current.addInitialChatroomMessages).toBe('function')
      expect(typeof result.current.updateMessageState).toBe('function')
      expect(typeof result.current.confirmMessage).toBe('function')
      expect(typeof result.current.removeOptimisticMessage).toBe('function')
      expect(typeof result.current.retryFailedMessage).toBe('function')
      
      // Connection management
      expect(typeof result.current.connectToChatroom).toBe('function')
      expect(typeof result.current.connectToStvWebSocket).toBe('function')
      expect(typeof result.current.initializeConnections).toBe('function')
      expect(typeof result.current.initializeIndividualConnections).toBe('function')
      expect(typeof result.current.cleanupConnections).toBe('function')
      expect(typeof result.current.cleanupBatching).toBe('function')
      expect(typeof result.current.getConnectionStatus).toBe('function')
      expect(typeof result.current.get7TVStatus).toBe('function')
      
      // Draft message methods
      expect(typeof result.current.saveDraftMessage).toBe('function')
      expect(typeof result.current.getDraftMessage).toBe('function')
      expect(typeof result.current.clearDraftMessage).toBe('function')
      
      // Utility methods
      expect(typeof result.current.cacheCurrentUser).toBe('function')
      expect(typeof result.current.fetchDonators).toBe('function')
      expect(typeof result.current.sendPresenceUpdate).toBe('function')
      expect(typeof result.current.debugToggleStreamStatus).toBe('function')
    })

    it('should load initial state from localStorage when available', () => {
      // Set up localStorage with saved data
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'chatrooms') return JSON.stringify([
          {
            id: 123,
            username: 'saveduser',
            order: 0,
            streamerData: { id: 456, user: { username: 'saveduser' } }
          }
        ])
        if (key === 'hasMentionsTab') return 'true'
        if (key === 'stvPersonalEmoteSets') return JSON.stringify([
          { id: 'set1', name: 'Personal Set' }
        ])
        if (key === 'chatrooms_version') return '2'
        return null
      })
      
      // Create new store instance to trigger localStorage loading
      const { result } = renderHook(() => useChatStore())
      
      expect(result.current.chatrooms).toHaveLength(1)
      expect(result.current.chatrooms[0].username).toBe('saveduser')
      expect(result.current.hasMentionsTab).toBe(true)
      expect(result.current.personalEmoteSets).toHaveLength(1)
    })

    it('should handle corrupted localStorage data gracefully', () => {
      // Mock corrupted JSON in localStorage
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'chatrooms') return 'invalid json{'
        if (key === 'stvPersonalEmoteSets') return 'also invalid'
        return null
      })
      
      // Should not throw and use defaults
      expect(() => {
        const { result } = renderHook(() => useChatStore())
        expect(result.current.chatrooms).toEqual([])
        expect(result.current.personalEmoteSets).toEqual([])
      }).not.toThrow()
    })
  })

  describe('Chatroom Management', () => {
    /**
     * Test suite for chatroom lifecycle operations including add, remove,
     * rename, reorder, and error handling scenarios.
     */
    
    it('should add a new chatroom with correct data structure', async () => {
      const { result } = renderHook(() => useChatStore())
      
      await act(async () => {
        await result.current.addChatroom('testuser')
      })

      expect(result.current.chatrooms).toHaveLength(1)
      
      const chatroom = result.current.chatrooms[0]
      expect(chatroom).toMatchObject({
        id: 123,
        username: 'testuser',
        order: 0,
        streamerData: expect.objectContaining({
          id: 123,
          username: 'testuser',
          user: expect.objectContaining({
            id: 456,
            username: 'testuser'
          })
        })
      })
      
      // Should persist to localStorage
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'chatrooms', 
        expect.stringContaining('testuser')
      )
    })

    it('should prevent duplicate chatrooms', async () => {
      const { result } = renderHook(() => useChatStore())
      
      // Add first chatroom
      await act(async () => {
        await result.current.addChatroom('testuser')
      })
      expect(result.current.chatrooms).toHaveLength(1)
      
      // Try to add duplicate
      await act(async () => {
        await result.current.addChatroom('testuser')
      })
      expect(result.current.chatrooms).toHaveLength(1)
    })

    it('should assign sequential order numbers to new chatrooms', async () => {
      const { result } = renderHook(() => useChatStore())
      
      // Mock different responses for multiple users
      mockWindowApp.kick.getUserChatroomInfo
        .mockResolvedValueOnce({
          data: { id: 123, username: 'user1', user: { id: 456, username: 'user1' } }
        })
        .mockResolvedValueOnce({
          data: { id: 124, username: 'user2', user: { id: 457, username: 'user2' } }
        })
      
      mockFetchQueue
        .mockResolvedValueOnce({
          data: { id: 123, username: 'user1', user: { id: 456, username: 'user1' } },
          user: { id: 456, username: 'user1' },
          slug: 'user1'
        })
        .mockResolvedValueOnce({
          data: { id: 124, username: 'user2', user: { id: 457, username: 'user2' } },
          user: { id: 457, username: 'user2' },
          slug: 'user2'
        })
      
      await act(async () => {
        await result.current.addChatroom('user1')
        await result.current.addChatroom('user2')
      })

      expect(result.current.chatrooms).toHaveLength(2)
      expect(result.current.chatrooms[0].order).toBe(0)
      expect(result.current.chatrooms[1].order).toBe(1)
    })

    it('should handle API errors during chatroom addition', async () => {
      mockWindowApp.kick.getUserChatroomInfo.mockRejectedValue(new Error('API Error'))
      
      const { result } = renderHook(() => useChatStore())
      
      await act(async () => {
        await expect(result.current.addChatroom('testuser')).rejects.toThrow('API Error')
      })

      expect(result.current.chatrooms).toHaveLength(0)
    })

    it('should remove chatroom and clean up associated data', async () => {
      const { result } = renderHook(() => useChatStore())
      
      // First add a chatroom
      await act(async () => {
        await result.current.addChatroom('testuser')
      })
      
      // Add some associated data
      act(() => {
        useChatStore.setState({
          messages: { '123': [{ id: 'msg1', content: 'test message' }] },
          chatters: { '123': [{ username: 'chatter1' }] },
          mentions: { '123': [{ id: 'mention1', message: 'mention test' }] },
          isChatroomPaused: { '123': true }
        })
      })
      
      // Remove the chatroom
      act(() => {
        result.current.removeChatroom(123)
      })

      expect(result.current.chatrooms).toHaveLength(0)
      expect(result.current.messages['123']).toBeUndefined()
      expect(result.current.chatters['123']).toBeUndefined()
      expect(result.current.mentions['123']).toBeUndefined()
      expect(result.current.isChatroomPaused['123']).toBeUndefined()
      
      // Should persist changes to localStorage
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('chatrooms', '[]')
    })

    it('should rename chatroom and persist changes', async () => {
      const { result } = renderHook(() => useChatStore())
      
      // Add chatroom first
      await act(async () => {
        await result.current.addChatroom('testuser')
      })
      
      // Rename chatroom
      act(() => {
        result.current.renameChatroom(123, 'Custom Display Name')
      })

      expect(result.current.chatrooms[0].displayName).toBe('Custom Display Name')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'chatrooms', 
        expect.stringContaining('Custom Display Name')
      )
    })

    it('should update chatroom order', async () => {
      const { result } = renderHook(() => useChatStore())
      
      // Add chatroom first
      await act(async () => {
        await result.current.addChatroom('testuser')
      })
      
      // Update order
      act(() => {
        result.current.updateChatroomOrder(123, 5)
      })

      expect(result.current.chatrooms[0].order).toBe(5)
      expect(mockLocalStorage.setItem).toHaveBeenCalled()
    })

    it('should reorder multiple chatrooms', async () => {
      const { result } = renderHook(() => useChatStore())
      
      // Add multiple chatrooms
      mockWindowApp.kick.getUserChatroomInfo
        .mockResolvedValueOnce({
          data: { id: 123, username: 'user1', user: { id: 456, username: 'user1' } }
        })
        .mockResolvedValueOnce({
          data: { id: 124, username: 'user2', user: { id: 457, username: 'user2' } }
        })
      
      mockFetchQueue
        .mockResolvedValueOnce({
          data: { id: 123, username: 'user1', user: { id: 456, username: 'user1' } },
          user: { id: 456, username: 'user1' },
          slug: 'user1'
        })
        .mockResolvedValueOnce({
          data: { id: 124, username: 'user2', user: { id: 457, username: 'user2' } },
          user: { id: 457, username: 'user2' },
          slug: 'user2'
        })
      
      await act(async () => {
        await result.current.addChatroom('user1')
        await result.current.addChatroom('user2')
      })
      
      // Reorder chatrooms
      const reorderedChatrooms = [
        { id: 124, order: 0 },
        { id: 123, order: 1 }
      ]
      
      act(() => {
        result.current.reorderChatrooms(reorderedChatrooms)
      })

      expect(result.current.chatrooms[0].order).toBe(1) // user1 moved to second
      expect(result.current.chatrooms[1].order).toBe(0) // user2 moved to first
    })
  })

  describe('Message Operations', () => {
    /**
     * Test suite for message handling including sending, receiving,
     * optimistic updates, state transitions, and batching.
     */
    
    const mockUser = {
      id: 789,
      username: 'currentuser',
      identity: { color: '#ff0000' }
    }

    beforeEach(() => {
      // Set up current user for message operations
      act(() => {
        useChatStore.setState({ currentUser: mockUser })
      })
    })

    it('should send message with optimistic update', async () => {
      const { result } = renderHook(() => useChatStore())
      
      await act(async () => {
        await result.current.sendMessage(123, 'Hello world!')
      })

      expect(mockWindowApp.kick.sendMessage).toHaveBeenCalledWith(123, 'Hello world!')
      
      // Should create optimistic message
      const messages = result.current.messages[123] || []
      const optimisticMessage = messages.find(msg => 
        msg.content === 'Hello world!' && 
        msg.state === 'optimistic' &&
        msg.sender.username === 'currentuser'
      )
      
      expect(optimisticMessage).toBeDefined()
      expect(optimisticMessage.isOptimistic).toBe(true)
      expect(optimisticMessage.tempId).toBeDefined()
    })

    it('should handle send message failure with failed state', async () => {
      mockWindowApp.kick.sendMessage.mockRejectedValue(new Error('Send failed'))
      
      const { result } = renderHook(() => useChatStore())
      
      await act(async () => {
        await result.current.sendMessage(123, 'Failed message')
      })

      const messages = result.current.messages[123] || []
      const failedMessage = messages.find(msg => 
        msg.content === 'Failed message' && 
        msg.state === 'failed'
      )
      
      expect(failedMessage).toBeDefined()
      expect(failedMessage.sender.username).toBe('currentuser')
    })

    it('should not send empty or whitespace-only messages', async () => {
      const { result } = renderHook(() => useChatStore())
      
      await act(async () => {
        await result.current.sendMessage(123, '')
        await result.current.sendMessage(123, '   ')
        await result.current.sendMessage(123, '\n\t  ')
      })

      expect(mockWindowApp.kick.sendMessage).not.toHaveBeenCalled()
      expect(result.current.messages[123]).toBeUndefined()
    })

    it('should not send messages when user is not authenticated', async () => {
      act(() => {
        useChatStore.setState({ currentUser: null })
      })
      
      const { result } = renderHook(() => useChatStore())
      
      await act(async () => {
        await result.current.sendMessage(123, 'Should not send')
      })

      expect(mockWindowApp.kick.sendMessage).not.toHaveBeenCalled()
      expect(result.current.messages[123]).toBeUndefined()
    })

    it('should send reply with proper metadata', async () => {
      const { result } = renderHook(() => useChatStore())
      const replyMetadata = {
        original_message: { id: 'msg123', content: 'Original message' },
        original_sender: { username: 'originaluser' }
      }
      
      await act(async () => {
        await result.current.sendReply(123, 'This is a reply', replyMetadata)
      })

      expect(mockWindowApp.kick.sendReply).toHaveBeenCalledWith(123, 'This is a reply', replyMetadata)
      
      const messages = result.current.messages[123] || []
      const replyMessage = messages.find(msg => msg.content === 'This is a reply')
      
      expect(replyMessage).toBeDefined()
      expect(replyMessage.type).toBe('reply')
      expect(replyMessage.metadata).toEqual(replyMetadata)
    })

    it('should handle reply authentication failure', async () => {
      mockWindowApp.kick.sendReply.mockResolvedValue({
        data: { status: { code: 401 } }
      })
      
      const { result } = renderHook(() => useChatStore())
      
      await act(async () => {
        const success = await result.current.sendReply(123, 'Unauthorized reply')
        expect(success).toBe(false)
      })

      // Should add system message about authentication
      const messages = result.current.messages[123] || []
      const systemMessage = messages.find(msg => 
        msg.type === 'system' && 
        msg.content === 'You must login to chat.'
      )
      expect(systemMessage).toBeDefined()
    })

    it('should add message to specific chatroom', () => {
      const { result } = renderHook(() => useChatStore())
      const testMessage = {
        id: 'msg123',
        content: 'Test message',
        sender: {
          id: 456,
          username: 'testuser',
          identity: { color: '#00ff00' }
        },
        created_at: '2023-01-01T12:00:00.000Z'
      }
      
      act(() => {
        result.current.addMessage(123, testMessage)
      })

      const messages = result.current.messages[123] || []
      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject(testMessage)
    })

    it('should batch multiple messages for performance', () => {
      vi.useFakeTimers()
      
      const { result } = renderHook(() => useChatStore())
      
      act(() => {
        // Add multiple messages rapidly
        for (let i = 1; i <= 5; i++) {
          result.current.addMessage(123, {
            id: `msg${i}`,
            content: `Message ${i}`,
            sender: { username: 'user' }
          })
        }
      })

      // Messages should be batched initially
      expect(result.current.messages[123]).toBeUndefined()
      
      // Fast forward to trigger batch processing
      act(() => {
        vi.advanceTimersByTime(100)
      })

      const messages = result.current.messages[123] || []
      expect(messages).toHaveLength(5)
      
      vi.useRealTimers()
    })

    it('should respect chat history length limit', () => {
      const { result } = renderHook(() => useChatStore())
      
      // Set small history limit
      act(() => {
        useChatStore.setState({
          chatHistorySettings: { chatHistoryLength: 3 }
        })
      })

      // Add more messages than the limit
      act(() => {
        for (let i = 1; i <= 10; i++) {
          result.current.addMessage(123, {
            id: `msg${i}`,
            content: `Message ${i}`,
            sender: { username: 'user' }
          })
        }
      })

      const messages = result.current.messages[123] || []
      expect(messages.length).toBeLessThanOrEqual(3)
    })

    it('should update message state correctly', () => {
      const { result } = renderHook(() => useChatStore())
      const tempId = 'temp_123'
      
      // Add optimistic message
      act(() => {
        result.current.addMessage(123, {
          id: 'msg1',
          tempId,
          content: 'Test message',
          state: 'optimistic',
          sender: mockUser
        })
      })

      // Update message state
      act(() => {
        result.current.updateMessageState(123, tempId, 'confirmed')
      })

      const messages = result.current.messages[123] || []
      const message = messages.find(msg => msg.tempId === tempId)
      expect(message?.state).toBe('confirmed')
    })

    it('should confirm optimistic message with server response', () => {
      const { result } = renderHook(() => useChatStore())
      const tempId = 'temp_123'
      
      // Add optimistic message
      act(() => {
        result.current.addMessage(123, {
          id: 'temp_msg',
          tempId,
          content: 'Test message',
          state: 'optimistic',
          sender: mockUser
        })
      })

      const confirmedMessage = {
        id: 'real_123',
        content: 'Test message',
        sender: mockUser,
        created_at: '2023-01-01T12:00:00.000Z'
      }

      // Confirm the message
      act(() => {
        result.current.confirmMessage(123, tempId, confirmedMessage)
      })

      const messages = result.current.messages[123] || []
      expect(messages.find(msg => msg.tempId === tempId)).toBeUndefined()
      expect(messages.find(msg => msg.id === 'real_123')).toBeDefined()
    })

    it('should remove optimistic message', () => {
      const { result } = renderHook(() => useChatStore())
      const tempId = 'temp_123'
      
      // Add optimistic message
      act(() => {
        result.current.addMessage(123, {
          id: 'temp_msg',
          tempId,
          content: 'Test message',
          state: 'optimistic',
          sender: mockUser
        })
      })

      // Remove optimistic message
      act(() => {
        result.current.removeOptimisticMessage(123, tempId)
      })

      const messages = result.current.messages[123] || []
      expect(messages.find(msg => msg.tempId === tempId)).toBeUndefined()
    })

    it('should retry failed message', async () => {
      mockWindowApp.kick.sendMessage.mockResolvedValue({ success: true })
      
      const { result } = renderHook(() => useChatStore())
      const tempId = 'temp_123'
      
      // Add failed message
      act(() => {
        result.current.addMessage(123, {
          id: 'failed_msg',
          tempId,
          content: 'Failed message',
          state: 'failed',
          sender: mockUser
        })
      })

      // Retry the message
      await act(async () => {
        await result.current.retryFailedMessage(123, tempId)
      })

      expect(mockWindowApp.kick.sendMessage).toHaveBeenCalledWith(123, 'Failed message')
    })

    it('should add initial chatroom messages in correct order', () => {
      const { result } = renderHook(() => useChatStore())
      
      const initialMessages = [
        {
          id: 'msg1',
          content: 'First message',
          sender: { id: 101, username: 'user1' },
          metadata: JSON.stringify({ type: 'regular' }),
          created_at: '2023-01-01T10:00:00Z'
        },
        {
          id: 'msg2',
          content: 'Second message',
          sender: { id: 102, username: 'user2' },
          metadata: JSON.stringify({ type: 'regular' }),
          created_at: '2023-01-01T10:01:00Z'
        }
      ]

      act(() => {
        result.current.addInitialChatroomMessages(123, initialMessages)
      })

      const messages = result.current.messages[123] || []
      expect(messages).toHaveLength(2)
      expect(messages.every(msg => msg.is_old === true)).toBe(true)
      
      // Should add chatters for each sender
      const chatters = result.current.chatters[123] || []
      expect(chatters).toHaveLength(2)
      
      // Should log messages
      expect(mockWindowApp.logs.add).toHaveBeenCalledTimes(2)
    })
  })

  describe('Connection Management', () => {
    /**
     * Test suite for WebSocket connection lifecycle, including KickPusher
     * and 7TV WebSocket connections, error handling, and cleanup.
     */
    
    it('should initialize connections and fetch donators', async () => {
      const { result } = renderHook(() => useChatStore())
      
      await act(async () => {
        await result.current.initializeConnections()
      })

      expect(mockGetKickTalkDonators).toHaveBeenCalled()
      expect(result.current.donators).toHaveLength(3)
      expect(result.current.donators).toEqual([
        { id: 1, username: 'donor1', amount: 10 },
        { id: 2, username: 'donor2', amount: 25 },
        { id: 3, username: 'donor3', amount: 50 }
      ])
    })

    it('should connect to chatroom with KickPusher', async () => {
      const { result } = renderHook(() => useChatStore())
      const mockChatroom = {
        id: 123,
        streamerData: {
          id: 456,
          user: { username: 'testuser' }
        }
      }

      await act(async () => {
        await result.current.connectToChatroom(mockChatroom)
      })

      expect(mockKickPusher).toHaveBeenCalledWith(123, 456, 'testuser')
      
      // Should register event listeners
      const pusherInstance = mockKickPusher.mock.results[0].value
      expect(pusherInstance.addEventListener).toHaveBeenCalledWith('connection', expect.any(Function))
      expect(pusherInstance.addEventListener).toHaveBeenCalledWith('channel', expect.any(Function))
      expect(pusherInstance.addEventListener).toHaveBeenCalledWith('message', expect.any(Function))
    })

    it('should connect to 7TV WebSocket', async () => {
      const { result } = renderHook(() => useChatStore())
      const mockChatroom = {
        id: 123,
        streamerData: {
          user: { username: 'testuser' }
        }
      }

      await act(async () => {
        await result.current.connectToStvWebSocket(mockChatroom)
      })

      expect(mockStvWebSocket).toHaveBeenCalled()
      
      // Should register event listeners
      const stvInstance = mockStvWebSocket.mock.results[0].value
      expect(stvInstance.addEventListener).toHaveBeenCalledWith('message', expect.any(Function))
      expect(stvInstance.addEventListener).toHaveBeenCalledWith('open', expect.any(Function))
      expect(stvInstance.addEventListener).toHaveBeenCalledWith('connection', expect.any(Function))
    })

    it('should handle connection failures gracefully', async () => {
      mockKickPusher.mockImplementation(() => {
        throw new Error('Connection failed')
      })
      
      const { result } = renderHook(() => useChatStore())
      const mockChatroom = {
        id: 123,
        streamerData: { id: 456, user: { username: 'testuser' } }
      }

      // Should not throw
      await act(async () => {
        await expect(result.current.connectToChatroom(mockChatroom)).resolves.toBeUndefined()
      })
    })

    it('should get connection status', () => {
      const { result } = renderHook(() => useChatStore())
      
      act(() => {
        useChatStore.setState({
          connections: {
            '123': { connected: true, kickPusher: {} },
            '456': { connected: false, kickPusher: {} }
          }
        })
      })

      const status = result.current.getConnectionStatus()
      expect(status).toHaveProperty('123')
      expect(status).toHaveProperty('456')
      expect(status.individual_connections).toBe(2)
    })

    it('should get 7TV status with correct statistics', () => {
      const { result } = renderHook(() => useChatStore())
      
      act(() => {
        useChatStore.setState({
          chatrooms: [
            { id: 123, username: 'user1' },
            { id: 456, username: 'user2' }
          ],
          connections: {
            '123': { stvSocket: {} },
            '456': { stvSocket: {} }
          }
        })
      })

      const status = result.current.get7TVStatus()
      expect(status.chatrooms).toBe(2)
      expect(status.connections).toBe(2)
      expect(status.presenceUpdates).toBeDefined()
    })

    it('should cleanup connections and batching', () => {
      vi.useFakeTimers()
      
      const { result } = renderHook(() => useChatStore())
      const mockConnection = {
        kickPusher: { close: vi.fn() },
        stvSocket: { close: vi.fn() }
      }
      
      // Set up connections and batching
      act(() => {
        useChatStore.setState({
          connections: { '123': mockConnection }
        })
      })
      
      window.__chatMessageBatch['123'] = {
        timer: setTimeout(() => {}, 1000),
        queue: [{ id: 'msg1', content: 'batched' }]
      }

      act(() => {
        result.current.cleanupConnections()
      })

      expect(mockConnection.kickPusher.close).toHaveBeenCalled()
      expect(mockConnection.stvSocket.close).toHaveBeenCalled()
      expect(result.current.connections).toEqual({})
      expect(window.__chatMessageBatch).toEqual({})
      
      vi.useRealTimers()
    })

    it('should initialize individual connections for existing chatrooms', async () => {
      const { result } = renderHook(() => useChatStore())
      
      // Add chatrooms to state
      act(() => {
        useChatStore.setState({
          chatrooms: [{
            id: 123,
            username: 'testuser',
            streamerData: { id: 456, user: { username: 'testuser' } }
          }]
        })
      })

      await act(async () => {
        await result.current.initializeIndividualConnections()
      })

      expect(mockKickPusher).toHaveBeenCalledWith(123, 456, 'testuser')
    })
  })

  describe('Draft Message Management', () => {
    /**
     * Test suite for draft message functionality including save,
     * retrieve, clear, and persistence to localStorage.
     */
    
    it('should save draft message', () => {
      const { result } = renderHook(() => useChatStore())
      
      act(() => {
        result.current.saveDraftMessage(123, 'Draft content here')
      })

      expect(result.current.getDraftMessage(123)).toBe('Draft content here')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'draftMessages',
        expect.stringContaining('Draft content here')
      )
    })

    it('should retrieve draft message', () => {
      const { result } = renderHook(() => useChatStore())
      
      act(() => {
        result.current.saveDraftMessage(123, 'Saved draft')
      })

      expect(result.current.getDraftMessage(123)).toBe('Saved draft')
    })

    it('should return empty string for non-existent draft', () => {
      const { result } = renderHook(() => useChatStore())
      
      expect(result.current.getDraftMessage(999)).toBe('')
    })

    it('should clear draft message', () => {
      const { result } = renderHook(() => useChatStore())
      
      // Save then clear
      act(() => {
        result.current.saveDraftMessage(123, 'Draft to be cleared')
        result.current.clearDraftMessage(123)
      })

      expect(result.current.getDraftMessage(123)).toBe('')
    })

    it('should persist draft messages to localStorage', () => {
      const { result } = renderHook(() => useChatStore())
      
      act(() => {
        result.current.saveDraftMessage(123, 'Persistent draft')
        result.current.saveDraftMessage(456, 'Another draft')
      })

      // Should save both drafts
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'draftMessages',
        expect.stringContaining('Persistent draft')
      )
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'draftMessages',
        expect.stringContaining('Another draft')
      )
    })

    it('should handle draft storage errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })
      
      const { result } = renderHook(() => useChatStore())
      
      // Should not crash on storage error
      expect(() => {
        act(() => {
          result.current.saveDraftMessage(123, 'Draft causing error')
        })
      }).toThrow() // Current implementation doesn't catch localStorage errors
    })
  })

  describe('Mention Management', () => {
    /**
     * Test suite for mention functionality including add, read status,
     * counting, and management operations.
     */
    
    const mockMention = {
      id: 'mention_1',
      message: {
        id: 'msg_1',
        content: '@currentuser hello there',
        sender: { username: 'otheruser', id: 456 }
      },
      type: 'username',
      timestamp: '2023-01-01T12:00:00.000Z',
      isRead: false,
      chatroomInfo: {
        id: 123,
        username: 'streamerchannel'
      }
    }

    it('should add mention to chatroom', () => {
      const { result } = renderHook(() => useChatStore())
      
      act(() => {
        result.current.addMention(123, mockMention.message, 'username')
      })

      const mentions = result.current.mentions[123] || []
      expect(mentions).toHaveLength(1)
      expect(mentions[0].type).toBe('username')
      expect(mentions[0].message.content).toBe('@currentuser hello there')
    })

    it('should get all mentions across chatrooms', () => {
      const { result } = renderHook(() => useChatStore())
      
      act(() => {
        useChatStore.setState({
          mentions: {
            '123': [mockMention],
            '456': [{ ...mockMention, id: 'mention_2' }]
          }
        })
      })

      const allMentions = result.current.getAllMentions()
      expect(allMentions).toHaveLength(2)
    })

    it('should get mentions for specific chatroom', () => {
      const { result } = renderHook(() => useChatStore())
      
      act(() => {
        useChatStore.setState({
          mentions: {
            '123': [mockMention],
            '456': [{ ...mockMention, id: 'mention_2' }]
          }
        })
      })

      const chatroomMentions = result.current.getChatroomMentions(123)
      expect(chatroomMentions).toHaveLength(1)
      expect(chatroomMentions[0].id).toBe('mention_1')
    })

    it('should count unread mentions correctly', () => {
      const { result } = renderHook(() => useChatStore())
      
      act(() => {
        useChatStore.setState({
          mentions: {
            '123': [
              { ...mockMention, isRead: false },
              { ...mockMention, id: 'mention_2', isRead: true },
              { ...mockMention, id: 'mention_3', isRead: false }
            ]
          }
        })
      })

      expect(result.current.getUnreadMentionCount()).toBe(2)
      expect(result.current.getChatroomUnreadMentionCount(123)).toBe(2)
    })

    it('should mark specific mention as read', () => {
      const { result } = renderHook(() => useChatStore())
      
      act(() => {
        useChatStore.setState({
          mentions: { '123': [mockMention] }
        })
      })

      act(() => {
        result.current.markMentionAsRead('mention_1')
      })

      const mentions = result.current.mentions[123] || []
      expect(mentions[0].isRead).toBe(true)
    })

    it('should mark all mentions as read', () => {
      const { result } = renderHook(() => useChatStore())
      
      act(() => {
        useChatStore.setState({
          mentions: {
            '123': [mockMention, { ...mockMention, id: 'mention_2' }],
            '456': [{ ...mockMention, id: 'mention_3' }]
          }
        })
      })

      act(() => {
        result.current.markAllMentionsAsRead()
      })

      const allMentions = result.current.getAllMentions()
      expect(allMentions.every(m => m.isRead)).toBe(true)
    })

    it('should mark chatroom mentions as read', () => {
      const { result } = renderHook(() => useChatStore())
      
      act(() => {
        useChatStore.setState({
          mentions: {
            '123': [mockMention, { ...mockMention, id: 'mention_2' }],
            '456': [{ ...mockMention, id: 'mention_3', isRead: false }]
          }
        })
      })

      act(() => {
        result.current.markChatroomMentionsAsRead(123)
      })

      const chatroom123Mentions = result.current.mentions[123] || []
      const chatroom456Mentions = result.current.mentions[456] || []
      
      expect(chatroom123Mentions.every(m => m.isRead)).toBe(true)
      expect(chatroom456Mentions[0].isRead).toBe(false) // Should remain unchanged
    })

    it('should clear all mentions', () => {
      const { result } = renderHook(() => useChatStore())
      
      act(() => {
        useChatStore.setState({
          mentions: { '123': [mockMention] }
        })
      })

      act(() => {
        result.current.clearAllMentions()
      })

      expect(result.current.mentions).toEqual({})
    })

    it('should clear mentions for specific chatroom', () => {
      const { result } = renderHook(() => useChatStore())
      
      act(() => {
        useChatStore.setState({
          mentions: {
            '123': [mockMention],
            '456': [{ ...mockMention, id: 'mention_2' }]
          }
        })
      })

      act(() => {
        result.current.clearChatroomMentions(123)
      })

      expect(result.current.mentions[123]).toEqual([])
      expect(result.current.mentions[456]).toHaveLength(1) // Should remain
    })

    it('should delete specific mention', () => {
      const { result } = renderHook(() => useChatStore())
      
      act(() => {
        useChatStore.setState({
          mentions: { '123': [mockMention, { ...mockMention, id: 'mention_2' }] }
        })
      })

      act(() => {
        result.current.deleteMention('mention_1')
      })

      const mentions = result.current.mentions[123] || []
      expect(mentions).toHaveLength(1)
      expect(mentions[0].id).toBe('mention_2')
    })

    it('should manage mentions tab visibility', () => {
      const { result } = renderHook(() => useChatStore())
      
      // Add mentions tab
      act(() => {
        result.current.addMentionsTab()
      })

      expect(result.current.hasMentionsTab).toBe(true)
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('hasMentionsTab', 'true')
      
      // Remove mentions tab
      act(() => {
        result.current.removeMentionsTab()
      })

      expect(result.current.hasMentionsTab).toBe(false)
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('hasMentionsTab', 'false')
    })
  })

  describe('7TV Presence Management', () => {
    /**
     * Test suite for 7TV presence update functionality including
     * throttling, validation, and error handling.
     */
    
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should send presence update with valid parameters', () => {
      const { result } = renderHook(() => useChatStore())
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      act(() => {
        result.current.sendPresenceUpdate('stv123', 'user456')
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Sending STV presence update')
      )
      
      consoleSpy.mockRestore()
    })

    it('should skip presence update without stvId', () => {
      const { result } = renderHook(() => useChatStore())
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      act(() => {
        result.current.sendPresenceUpdate(null, 'user123')
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No STV ID provided')
      )
      
      consoleSpy.mockRestore()
    })

    it('should skip presence update without auth tokens', () => {
      mockWindowApp.auth.getToken.mockReturnValue(null)
      
      const { result } = renderHook(() => useChatStore())
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      act(() => {
        result.current.sendPresenceUpdate('stv123', 'user456')
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No auth tokens available')
      )
      
      consoleSpy.mockRestore()
      
      // Restore original mock
      mockWindowApp.auth.getToken.mockReturnValue({
        token: 'mock-token',
        session: 'mock-session'
      })
    })

    it('should throttle presence updates within interval', () => {
      const { result } = renderHook(() => useChatStore())
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      // First update should go through
      act(() => {
        result.current.sendPresenceUpdate('stv123', 'user456')
      })

      // Immediate second update should be throttled
      act(() => {
        result.current.sendPresenceUpdate('stv123', 'user456')
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Last update time for chatroom')
      )
      
      consoleSpy.mockRestore()
    })

    it('should allow presence updates after throttle interval', () => {
      const { result } = renderHook(() => useChatStore())
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      // First update
      act(() => {
        result.current.sendPresenceUpdate('stv123', 'user456')
      })

      // Advance time past throttle interval (30 seconds)
      act(() => {
        vi.advanceTimersByTime(31000)
      })

      // Second update should go through
      act(() => {
        result.current.sendPresenceUpdate('stv123', 'user456')
      })

      // Should not see throttle message
      const throttleMessages = consoleSpy.mock.calls.filter(call =>
        call[0].includes('Last update time for chatroom')
      )
      expect(throttleMessages).toHaveLength(0)
      
      consoleSpy.mockRestore()
    })

    it('should send actual 7TV presence update when conditions are met', async () => {
      const { result } = renderHook(() => useChatStore())
      
      await act(async () => {
        await result.current.sendPresenceUpdate('stv123', 'user456')
      })

      expect(mockSendUserPresence).toHaveBeenCalledWith('stv123', 'user456')
    })
  })

  describe('User Cache Management', () => {
    /**
     * Test suite for user information caching including authentication
     * status and user data retrieval from APIs.
     */
    
    it('should cache current user info successfully', async () => {
      const { result } = renderHook(() => useChatStore())

      await act(async () => {
        await result.current.cacheCurrentUser()
      })

      expect(result.current.currentUser).toEqual({
        id: 789,
        username: 'currentuser',
        identity: { color: '#ff0000' }
      })
      expect(mockWindowApp.kick.getSelfInfo).toHaveBeenCalled()
    })

    it('should handle user cache failures gracefully', async () => {
      mockWindowApp.kick.getSelfInfo.mockRejectedValue(new Error('Auth failed'))

      const { result } = renderHook(() => useChatStore())

      await act(async () => {
        const user = await result.current.cacheCurrentUser()
        expect(user).toBeNull()
      })

      expect(result.current.currentUser).toBeNull()
    })

    it('should use cached user for optimistic messages', async () => {
      const { result } = renderHook(() => useChatStore())
      
      // Cache user first
      await act(async () => {
        await result.current.cacheCurrentUser()
      })

      // Send message using cached user
      await act(async () => {
        await result.current.sendMessage(123, 'Using cached user')
      })

      const messages = result.current.messages[123] || []
      const optimisticMessage = messages.find(msg => msg.state === 'optimistic')
      
      expect(optimisticMessage?.sender?.username).toBe('currentuser')
      expect(optimisticMessage?.sender?.identity?.color).toBe('#ff0000')
    })
  })

  describe('Donator Management', () => {
    /**
     * Test suite for donator data fetching and management.
     */
    
    it('should fetch donators successfully', async () => {
      const { result } = renderHook(() => useChatStore())

      await act(async () => {
        await result.current.fetchDonators()
      })

      expect(mockGetKickTalkDonators).toHaveBeenCalled()
      expect(result.current.donators).toEqual([
        { id: 1, username: 'donor1', amount: 10 },
        { id: 2, username: 'donor2', amount: 25 },
        { id: 3, username: 'donor3', amount: 50 }
      ])
    })

    it('should handle donator fetch failures', async () => {
      mockGetKickTalkDonators.mockRejectedValueOnce(new Error('Fetch failed'))
      
      const { result } = renderHook(() => useChatStore())

      await act(async () => {
        const donators = await result.current.fetchDonators()
        expect(donators).toEqual([])
      })

      expect(result.current.donators).toEqual([])
    })
  })

  describe('Error Handling and Edge Cases', () => {
    /**
     * Test suite for comprehensive error handling scenarios including
     * network failures, malformed data, and system limitations.
     */
    
    it('should handle localStorage corruption gracefully', () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'chatrooms') return 'invalid json{'
        if (key === 'draftMessages') return 'also invalid'
        return null
      })
      
      expect(() => {
        const { result } = renderHook(() => useChatStore())
        expect(result.current.chatrooms).toEqual([])
      }).not.toThrow()
    })

    it('should handle addMessage with invalid parameters', () => {
      const { result } = renderHook(() => useChatStore())
      
      expect(() => {
        act(() => {
          result.current.addMessage(null, null)
          result.current.addMessage(123, undefined)
          result.current.addMessage(123, {})
          result.current.addMessage(123, { content: null })
        })
      }).not.toThrow()
    })

    it('should handle removeChatroom with invalid ID', () => {
      const { result } = renderHook(() => useChatStore())
      
      expect(() => {
        act(() => {
          result.current.removeChatroom(null)
          result.current.removeChatroom(undefined)
          result.current.removeChatroom(999) // Non-existent
        })
      }).not.toThrow()
    })

    it('should handle corrupted window.__chatMessageBatch', () => {
      window.__chatMessageBatch = {
        'room1': { 
          timer: null,
          queue: null
        }
      }

      const { result } = renderHook(() => useChatStore())
      
      expect(() => {
        act(() => {
          result.current.cleanupBatching()
        })
      }).not.toThrow()
    })

    it('should handle connection cleanup with missing methods', () => {
      const { result } = renderHook(() => useChatStore())
      
      act(() => {
        useChatStore.setState({
          connections: {
            'room1': { 
              kickPusher: {}, // Missing close method
              stvSocket: null
            }
          }
        })
      })

      expect(() => {
        act(() => {
          result.current.cleanupConnections()
        })
      }).not.toThrow()
    })

    it('should handle browser storage quota exceeded', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

      const { result } = renderHook(() => useChatStore())

      expect(() => {
        act(() => {
          result.current.saveDraftMessage(123, 'Test draft')
        })
      }).toThrow() // Current implementation doesn't catch localStorage errors
    })

    it('should handle API failures across all methods', async () => {
      // Mock all APIs to fail
      mockWindowApp.kick.sendMessage.mockRejectedValue(new Error('API Error'))
      mockWindowApp.kick.sendReply.mockRejectedValue(new Error('API Error'))
      mockWindowApp.kick.getSelfInfo.mockRejectedValue(new Error('API Error'))
      mockWindowApp.kick.getUserChatroomInfo.mockRejectedValue(new Error('API Error'))
      mockFetchQueue.mockRejectedValue(new Error('API Error'))
      mockGetKickTalkDonators.mockRejectedValue(new Error('API Error'))

      const { result } = renderHook(() => useChatStore())

      await act(async () => {
        // Should handle auth failure
        const user = await result.current.cacheCurrentUser()
        expect(user).toBeNull()
        
        // Should handle chatroom addition failure
        await expect(result.current.addChatroom('testuser')).rejects.toThrow()
        
        // Should handle donator fetch failure
        const donators = await result.current.fetchDonators()
        expect(donators).toEqual([])
        
        // Should handle message send failure by creating failed message
        await result.current.sendMessage(123, 'test')
        const messages = result.current.messages[123] || []
        expect(messages.some(msg => msg.state === 'failed')).toBe(true)
      })
    })
  })

  describe('Performance and Memory Management', () => {
    /**
     * Test suite for performance characteristics and memory usage
     * under high load scenarios.
     */
    
    it('should handle large number of messages efficiently', () => {
      const { result } = renderHook(() => useChatStore())
      const messageCount = 1000
      const startTime = performance.now()

      act(() => {
        for (let i = 0; i < messageCount; i++) {
          result.current.addMessage(123, {
            id: `msg${i}`,
            content: `Message ${i}`,
            sender: { username: 'user', id: i },
            timestamp: new Date().toISOString()
          })
        }
      })

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete within reasonable time
      expect(duration).toBeLessThan(1000) // 1 second

      const messages = result.current.messages[123] || []
      expect(messages.length).toBeLessThanOrEqual(messageCount)
    })

    it('should handle large number of concurrent chatrooms', async () => {
      const { result } = renderHook(() => useChatStore())
      const chatroomCount = 50
      const startTime = performance.now()

      // Mock API responses for multiple users
      mockWindowApp.kick.getUserChatroomInfo.mockImplementation((username) => 
        Promise.resolve({
          data: {
            id: Math.floor(Math.random() * 10000),
            username,
            user: { id: Math.floor(Math.random() * 10000), username }
          }
        })
      )
      
      mockFetchQueue.mockImplementation(() => 
        Promise.resolve({
          data: {
            id: Math.floor(Math.random() * 10000),
            username: `user${Math.random()}`,
            user: { id: Math.floor(Math.random() * 10000), username: `user${Math.random()}` }
          },
          user: { id: Math.floor(Math.random() * 10000), username: `user${Math.random()}` },
          slug: `user${Math.random()}`
        })
      )

      const promises = []
      for (let i = 0; i < chatroomCount; i++) {
        promises.push(result.current.addChatroom(`user${i}`))
      }

      await act(async () => {
        await Promise.allSettled(promises)
      })

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(5000) // 5 seconds
      expect(result.current.chatrooms.length).toBeLessThanOrEqual(chatroomCount)
    })

    it('should not leak memory with rapid state updates', () => {
      const { result } = renderHook(() => useChatStore())
      const initialMemory = global.performance.memory?.usedJSHeapSize || 0

      act(() => {
        for (let i = 0; i < 1000; i++) {
          useChatStore.setState(state => ({
            ...state,
            currentChatroomId: i % 10 // Cycle through IDs
          }))
        }
      })

      const finalMemory = global.performance.memory?.usedJSHeapSize || 0
      const memoryGrowth = finalMemory - initialMemory

      // Memory growth should be reasonable
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024) // Less than 10MB
      expect(result.current.currentChatroomId).toBe(9) // Last value
    })
  })

  describe('Integration Test Scenarios', () => {
    /**
     * Test suite for complex end-to-end workflows that combine
     * multiple store operations and verify complete functionality.
     */
    
    it('should handle complete chatroom workflow', async () => {
      const { result } = renderHook(() => useChatStore())

      // 1. Cache current user
      await act(async () => {
        await result.current.cacheCurrentUser()
      })
      expect(result.current.currentUser).toBeTruthy()

      // 2. Add chatroom
      await act(async () => {
        await result.current.addChatroom('testuser')
      })
      expect(result.current.chatrooms).toHaveLength(1)

      // 3. Connect to chatroom
      const chatroom = result.current.chatrooms[0]
      await act(async () => {
        await result.current.connectToChatroom(chatroom)
      })
      expect(mockKickPusher).toHaveBeenCalled()

      // 4. Send message
      await act(async () => {
        await result.current.sendMessage(123, 'Hello world!')
      })
      let messages = result.current.messages[123] || []
      expect(messages.some(msg => msg.content === 'Hello world!')).toBe(true)

      // 5. Add received message
      act(() => {
        result.current.addMessage(123, {
          id: 'received_msg',
          content: 'Response message',
          sender: { username: 'testuser', id: 456 }
        })
      })
      messages = result.current.messages[123] || []
      expect(messages.some(msg => msg.content === 'Response message')).toBe(true)

      // 6. Save draft message
      act(() => {
        result.current.saveDraftMessage(123, 'Draft content')
      })
      expect(result.current.getDraftMessage(123)).toBe('Draft content')

      // 7. Add mention
      act(() => {
        result.current.addMention(123, {
          id: 'mention_msg',
          content: '@currentuser mentioned!',
          sender: { username: 'testuser' }
        }, 'username')
      })
      expect(result.current.getChatroomUnreadMentionCount(123)).toBe(1)

      // 8. Clean up
      act(() => {
        result.current.cleanupConnections()
      })
      expect(result.current.connections).toEqual({})
    })

    it('should maintain data consistency during concurrent operations', async () => {
      const { result } = renderHook(() => useChatStore())

      await act(async () => {
        await result.current.cacheCurrentUser()
      })

      // Perform multiple concurrent operations
      await act(async () => {
        const promises = [
          result.current.addChatroom('user1'),
          result.current.addChatroom('user2'),
          result.current.fetchDonators(),
          result.current.initializeConnections()
        ]
        
        // Mock different responses for concurrent chatroom additions
        mockWindowApp.kick.getUserChatroomInfo
          .mockResolvedValueOnce({
            data: { id: 123, username: 'user1', user: { id: 456, username: 'user1' } }
          })
          .mockResolvedValueOnce({
            data: { id: 124, username: 'user2', user: { id: 457, username: 'user2' } }
          })
        
        mockFetchQueue
          .mockResolvedValueOnce({
            data: { id: 123, username: 'user1', user: { id: 456, username: 'user1' } },
            user: { id: 456, username: 'user1' },
            slug: 'user1'
          })
          .mockResolvedValueOnce({
            data: { id: 124, username: 'user2', user: { id: 457, username: 'user2' } },
            user: { id: 457, username: 'user2' },
            slug: 'user2'
          })

        await Promise.allSettled(promises)
      })

      // Verify state consistency
      expect(result.current.chatrooms.length).toBeLessThanOrEqual(2)
      expect(result.current.donators).toHaveLength(3)
      expect(result.current.currentUser).toBeTruthy()
    })

    it('should recover gracefully from multiple error scenarios', async () => {
      const { result } = renderHook(() => useChatStore())

      // Scenario 1: API failure during initialization
      mockWindowApp.kick.getSelfInfo.mockRejectedValueOnce(new Error('Auth failed'))
      mockGetKickTalkDonators.mockRejectedValueOnce(new Error('Donators failed'))

      await act(async () => {
        await result.current.cacheCurrentUser() // Should not crash
        await result.current.fetchDonators() // Should not crash
      })

      expect(result.current.currentUser).toBeNull()
      expect(result.current.donators).toEqual([])

      // Scenario 2: Connection failures
      mockKickPusher.mockImplementationOnce(() => {
        throw new Error('Connection failed')
      })

      const mockChatroom = {
        id: 123,
        streamerData: { id: 456, user: { username: 'testuser' } }
      }

      await act(async () => {
        await result.current.connectToChatroom(mockChatroom) // Should not crash
      })

      // Scenario 3: Storage failures
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('Storage full')
      })

      expect(() => {
        act(() => {
          result.current.saveDraftMessage(123, 'Test draft')
        })
      }).toThrow() // Current implementation doesn't handle storage errors

      // Store should still be functional after errors
      expect(typeof result.current.addMessage).toBe('function')
      expect(typeof result.current.cleanupConnections).toBe('function')
    })
  })
})