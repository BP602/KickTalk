import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ConnectionManager from './connectionManager.js'

// Mock dependencies
const mockSharedKickPusher = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  connect: vi.fn(),
  addChatroom: vi.fn(),
  removeChatroom: vi.fn(),
  close: vi.fn(),
  getConnectionState: vi.fn().mockReturnValue('connected'),
  getChatroomCount: vi.fn().mockReturnValue(3),
  getSubscribedChannelCount: vi.fn().mockReturnValue(5)
}

const mockSharedStvWebSocket = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  connect: vi.fn(),
  addChatroom: vi.fn(),
  removeChatroom: vi.fn(),
  close: vi.fn(),
  getConnectionState: vi.fn().mockReturnValue('connected'),
  getChatroomCount: vi.fn().mockReturnValue(3),
  getSubscribedEventCount: vi.fn().mockReturnValue(8)
}

// Mock the imported modules
vi.mock('./kick/sharedKickPusher.js', () => ({
  default: vi.fn(() => mockSharedKickPusher)
}))

vi.mock('./seventv/sharedStvWebSocket.js', () => ({
  default: vi.fn(() => mockSharedStvWebSocket)
}))

// Mock window.app
const mockWindowApp = {
  kick: {
    getEmotes: vi.fn(),
    getInitialChatroomMessages: vi.fn(),
    getChannelChatroomInfo: vi.fn()
  },
  seventv: {
    getGlobalEmotes: vi.fn()
  }
}

Object.defineProperty(global, 'window', {
  value: {
    app: mockWindowApp
  },
  writable: true
})

describe('ConnectionManager', () => {
  let connectionManager
  let consoleLogSpy
  let consoleErrorSpy

  beforeEach(() => {
    // Mock console methods globally for all tests
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.clearAllMocks()
    connectionManager = new ConnectionManager()
  })

  afterEach(() => {
    // Restore console mocks
    consoleLogSpy?.mockRestore()
    consoleErrorSpy?.mockRestore()
    vi.clearAllMocks()
    if (connectionManager) {
      connectionManager.cleanup()
    }
  })

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      expect(connectionManager.config).toEqual({
        staggerDelay: 200,
        batchSize: 3,
        maxConcurrentEmoteFetches: 5,
      })
    })

    it('should initialize with empty state', () => {
      expect(connectionManager.initializationInProgress).toBe(false)
      expect(connectionManager.emoteCache).toBeInstanceOf(Map)
      expect(connectionManager.emoteCache.size).toBe(0)
      expect(connectionManager.globalStvEmotesCache).toBeNull()
      expect(connectionManager.storeCallbacks).toBeNull()
    })

    it('should create instances of pusher and websocket', () => {
      expect(connectionManager.kickPusher).toBeDefined()
      expect(connectionManager.stvWebSocket).toBeDefined()
    })
  })

  describe('Connection Initialization', () => {
    const mockChatrooms = [
      {
        id: 'chatroom1',
        streamerData: { id: 'streamer1', slug: 'streamer_one', user: { username: 'StreamerOne' } },
        channel7TVEmotes: [{ type: 'channel', user: { id: 'stv1' }, setInfo: { id: 'set1' } }],
        isStreamerLive: true
      },
      {
        id: 'chatroom2',
        streamerData: { id: 'streamer2', slug: 'streamer_two', user: { username: 'StreamerTwo' } },
        channel7TVEmotes: null,
        isStreamerLive: false
      }
    ]

    const mockEventHandlers = {
      onKickMessage: vi.fn(),
      onKickChannel: vi.fn(),
      onKickConnection: vi.fn(),
      onKickSubscriptionSuccess: vi.fn(),
      onStvMessage: vi.fn(),
      onStvOpen: vi.fn(),
      onStvConnection: vi.fn()
    }

    const mockStoreCallbacks = {
      handlePinnedMessageCreated: vi.fn(),
      handlePinnedMessageDeleted: vi.fn(),
      addInitialChatroomMessages: vi.fn(),
      handleStreamStatus: vi.fn()
    }

    beforeEach(() => {
      // Mock successful connections - use immediate execution for deterministic tests
      mockSharedKickPusher.addEventListener.mockImplementation((event, handler) => {
        if (event === 'connection') {
          // Use setImmediate or minimal timeout for deterministic test behavior
          if (typeof setImmediate !== 'undefined') {
            setImmediate(() => handler({ detail: { content: 'connection-success' } }))
          } else {
            setTimeout(() => handler({ detail: { content: 'connection-success' } }), 0)
          }
        }
      })

      mockSharedStvWebSocket.addEventListener.mockImplementation((event, handler) => {
        if (event === 'connection') {
          // Use setImmediate or minimal timeout for deterministic test behavior
          if (typeof setImmediate !== 'undefined') {
            setImmediate(() => handler({ detail: { content: 'connection-success' } }))
          } else {
            setTimeout(() => handler({ detail: { content: 'connection-success' } }), 0)
          }
        }
      })

      // Mock API calls
      mockWindowApp.kick.getInitialChatroomMessages.mockResolvedValue({
        data: {
          data: {
            pinned_message: { id: 'pin1', content: 'Pinned message' },
            messages: [
              { id: 'msg1', content: 'Hello' },
              { id: 'msg2', content: 'World' }
            ]
          }
        }
      })

      mockWindowApp.kick.getChannelChatroomInfo.mockResolvedValue({
        data: { livestream: { is_live: true } }
      })

      mockWindowApp.kick.getEmotes.mockResolvedValue(['emote1', 'emote2'])
    })

    it('should prevent multiple simultaneous initializations', async () => {
      connectionManager.initializationInProgress = true

      await connectionManager.initializeConnections(mockChatrooms, mockEventHandlers, mockStoreCallbacks)

      expect(consoleLogSpy).toHaveBeenCalledWith('[ConnectionManager] Initialization already in progress')
    })

    it('should successfully initialize connections', async () => {
      await connectionManager.initializeConnections(mockChatrooms, mockEventHandlers, mockStoreCallbacks)

      expect(connectionManager.initializationInProgress).toBe(false)
      expect(consoleLogSpy).toHaveBeenCalledWith('[ConnectionManager] Initialization completed successfully')
    })

    it('should handle initialization errors gracefully', async () => {
      const error = new Error('Initialization failed')
      mockSharedKickPusher.connect.mockRejectedValue(error)

      await expect(
        connectionManager.initializeConnections(mockChatrooms, mockEventHandlers, mockStoreCallbacks)
      ).rejects.toThrow('Initialization failed')

      expect(connectionManager.initializationInProgress).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ConnectionManager] Error during initialization:', error)
    })

    it('should set up all event handlers', async () => {
      await connectionManager.initializeConnections(mockChatrooms, mockEventHandlers, mockStoreCallbacks)

      // Check that all event handlers were registered
      expect(mockSharedKickPusher.addEventListener).toHaveBeenCalledWith('message', mockEventHandlers.onKickMessage)
      expect(mockSharedKickPusher.addEventListener).toHaveBeenCalledWith('channel', mockEventHandlers.onKickChannel)
      expect(mockSharedKickPusher.addEventListener).toHaveBeenCalledWith('subscription_success', mockEventHandlers.onKickSubscriptionSuccess)
      
      expect(mockSharedStvWebSocket.addEventListener).toHaveBeenCalledWith('message', mockEventHandlers.onStvMessage)
      expect(mockSharedStvWebSocket.addEventListener).toHaveBeenCalledWith('open', mockEventHandlers.onStvOpen)
    })

    it('should handle connection timeout', async () => {
      vi.useFakeTimers()
      
      // Simulate slow connections
      mockSharedKickPusher.addEventListener.mockImplementation(() => {})
      mockSharedStvWebSocket.addEventListener.mockImplementation(() => {})

      const mockChatrooms = [{ id: 'test', streamerData: { id: 'test' } }]

      const initPromise = connectionManager.initializeConnections(mockChatrooms, {}, {})
      
      // Fast-forward past the timeout (1000ms in test environment)
      await vi.advanceTimersByTimeAsync(1000)
      
      await expect(initPromise).rejects.toThrow('Connection timeout')
      
      vi.useRealTimers()
    })
  })

  describe('Chatroom Management', () => {
    const mockChatroom = {
      id: 'chatroom1',
      streamerData: { id: 'streamer1', slug: 'streamer_one', user: { username: 'StreamerOne' } },
      channel7TVEmotes: [{ type: 'channel', user: { id: 'stv1' }, setInfo: { id: 'set1' } }]
    }

    beforeEach(() => {
      connectionManager.storeCallbacks = {
        handlePinnedMessageCreated: vi.fn(),
        handlePinnedMessageDeleted: vi.fn(),
        addInitialChatroomMessages: vi.fn(),
        handleStreamStatus: vi.fn()
      }

      mockWindowApp.kick.getInitialChatroomMessages.mockResolvedValue({
        data: { data: { messages: [{ id: 'msg1' }] } }
      })

      mockWindowApp.kick.getChannelChatroomInfo.mockResolvedValue({
        data: { livestream: { is_live: true } }
      })
    })

    it('should add chatroom successfully', async () => {
      await connectionManager.addChatroom(mockChatroom)

      expect(mockSharedKickPusher.addChatroom).toHaveBeenCalledWith(
        'chatroom1',
        'streamer1',
        mockChatroom
      )

      expect(mockSharedStvWebSocket.addChatroom).toHaveBeenCalledWith(
        'chatroom1',
        'streamer1',
        'stv1',
        'set1'
      )

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ConnectionManager] Added chatroom chatroom1 (StreamerOne)'
      )
    })

    it('should handle missing 7TV emote data gracefully', async () => {
      const chatroomWithoutSTV = {
        ...mockChatroom,
        channel7TVEmotes: null
      }

      await connectionManager.addChatroom(chatroomWithoutSTV)

      expect(mockSharedStvWebSocket.addChatroom).toHaveBeenCalledWith(
        'chatroom1',
        'streamer1',
        '0',
        '0'
      )
    })

    it('should handle array format 7TV emote data', async () => {
      const chatroomWithArrayEmotes = {
        ...mockChatroom,
        channel7TVEmotes: [
          { type: 'global', user: { id: 'global' } },
          { type: 'channel', user: { id: 'channel_user' }, setInfo: { id: 'channel_set' } }
        ]
      }

      await connectionManager.addChatroom(chatroomWithArrayEmotes)

      expect(mockSharedStvWebSocket.addChatroom).toHaveBeenCalledWith(
        'chatroom1',
        'streamer1',
        'channel_user',
        'channel_set'
      )
    })

    it('should handle chatroom addition errors', async () => {
      const error = new Error('Addition failed')
      mockSharedKickPusher.addChatroom.mockImplementation(() => { throw error })

      await connectionManager.addChatroom(mockChatroom)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ConnectionManager] Error adding chatroom chatroom1:',
        error
      )
    })

    it('should remove chatroom successfully', async () => {
      await connectionManager.removeChatroom('chatroom1')

      expect(mockSharedKickPusher.removeChatroom).toHaveBeenCalledWith('chatroom1')
      expect(mockSharedStvWebSocket.removeChatroom).toHaveBeenCalledWith('chatroom1')
      expect(consoleLogSpy).toHaveBeenCalledWith('[ConnectionManager] Removed chatroom chatroom1')
    })
  })

  describe('Initial Message Fetching', () => {
    const mockChatroom = {
      id: 'chatroom1',
      streamerData: { id: 'streamer1' }
    }

    beforeEach(() => {
      connectionManager.storeCallbacks = {
        handlePinnedMessageCreated: vi.fn(),
        handlePinnedMessageDeleted: vi.fn(),
        addInitialChatroomMessages: vi.fn(),
        handleStreamStatus: vi.fn()
      }
    })

    it('should fetch and process initial messages with pinned message', async () => {
      mockWindowApp.kick.getInitialChatroomMessages.mockResolvedValue({
        data: {
          data: {
            pinned_message: { id: 'pin1', content: 'Pinned' },
            messages: [{ id: 'msg1' }, { id: 'msg2' }]
          }
        }
      })

      await connectionManager.fetchInitialMessages(mockChatroom)

      expect(connectionManager.storeCallbacks.handlePinnedMessageCreated).toHaveBeenCalledWith(
        'chatroom1',
        { id: 'pin1', content: 'Pinned' }
      )

      expect(connectionManager.storeCallbacks.addInitialChatroomMessages).toHaveBeenCalledWith(
        'chatroom1',
        [{ id: 'msg2' }, { id: 'msg1' }] // Messages are reversed
      )
    })

    it('should handle absence of pinned message', async () => {
      mockWindowApp.kick.getInitialChatroomMessages.mockResolvedValue({
        data: {
          data: {
            pinned_message: null,
            messages: [{ id: 'msg1' }]
          }
        }
      })

      await connectionManager.fetchInitialMessages(mockChatroom)

      expect(connectionManager.storeCallbacks.handlePinnedMessageDeleted).toHaveBeenCalledWith('chatroom1')
    })

    it('should handle empty messages response', async () => {
      mockWindowApp.kick.getInitialChatroomMessages.mockResolvedValue({
        data: { data: null }
      })

      await connectionManager.fetchInitialMessages(mockChatroom)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ConnectionManager] No initial messages data for chatroom chatroom1'
      )
    })

    it('should handle API errors gracefully', async () => {
      const error = new Error('API Error')
      mockWindowApp.kick.getInitialChatroomMessages.mockRejectedValue(error)

      await connectionManager.fetchInitialMessages(mockChatroom)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ConnectionManager] Error fetching initial messages for chatroom chatroom1:',
        error
      )
    })

    it('should handle missing store callbacks', async () => {
      connectionManager.storeCallbacks = null

      mockWindowApp.kick.getInitialChatroomMessages.mockResolvedValue({
        data: {
          data: {
            pinned_message: { id: 'pin1' },
            messages: [{ id: 'msg1' }]
          }
        }
      })

      // Should not throw error
      await expect(connectionManager.fetchInitialMessages(mockChatroom)).resolves.toBeUndefined()
    })
  })

  describe('Chatroom Info Fetching', () => {
    const mockChatroom = {
      id: 'chatroom1',
      streamerData: { slug: 'test_stream' }
    }

    beforeEach(() => {
      connectionManager.storeCallbacks = {
        handleStreamStatus: vi.fn()
      }
    })

    it('should fetch and process chatroom info', async () => {
      const mockResponse = {
        data: {
          livestream: { is_live: true },
          other_data: 'test'
        }
      }

      mockWindowApp.kick.getChannelChatroomInfo.mockResolvedValue(mockResponse)

      await connectionManager.fetchInitialChatroomInfo(mockChatroom)

      expect(connectionManager.storeCallbacks.handleStreamStatus).toHaveBeenCalledWith(
        'chatroom1',
        mockResponse.data,
        true
      )
    })

    it('should handle offline streams', async () => {
      mockWindowApp.kick.getChannelChatroomInfo.mockResolvedValue({
        data: { livestream: { is_live: false } }
      })

      await connectionManager.fetchInitialChatroomInfo(mockChatroom)

      expect(connectionManager.storeCallbacks.handleStreamStatus).toHaveBeenCalledWith(
        'chatroom1',
        expect.any(Object),
        false
      )
    })

    it('should handle missing livestream data', async () => {
      mockWindowApp.kick.getChannelChatroomInfo.mockResolvedValue({
        data: {}
      })

      await connectionManager.fetchInitialChatroomInfo(mockChatroom)

      expect(connectionManager.storeCallbacks.handleStreamStatus).toHaveBeenCalledWith(
        'chatroom1',
        {},
        false
      )
    })

    it('should handle API errors', async () => {
      const error = new Error('API Error')
      mockWindowApp.kick.getChannelChatroomInfo.mockRejectedValue(error)

      await connectionManager.fetchInitialChatroomInfo(mockChatroom)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ConnectionManager] Error fetching initial chatroom info for chatroom chatroom1:',
        error
      )
    })

    it('should handle null response', async () => {
      mockWindowApp.kick.getChannelChatroomInfo.mockResolvedValue(null)

      // Should not throw error
      await expect(connectionManager.fetchInitialChatroomInfo(mockChatroom)).resolves.toBeUndefined()
    })
  })

  describe('Emote Caching', () => {
    const mockChatroom = {
      streamerData: { slug: 'test_stream', user: { username: 'TestStream' } }
    }

    it('should cache and return emotes', async () => {
      const mockEmotes = ['emote1', 'emote2']
      mockWindowApp.kick.getEmotes.mockResolvedValue(mockEmotes)

      const result = await connectionManager.fetchChatroomEmotes(mockChatroom)

      expect(result).toEqual(mockEmotes)
      expect(connectionManager.emoteCache.get('test_stream')).toEqual(mockEmotes)
    })

    it('should return cached emotes on subsequent calls', async () => {
      const mockEmotes = ['cached_emote1', 'cached_emote2']
      connectionManager.emoteCache.set('test_stream', mockEmotes)

      const result = await connectionManager.fetchChatroomEmotes(mockChatroom)

      expect(result).toEqual(mockEmotes)
      expect(mockWindowApp.kick.getEmotes).not.toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ConnectionManager] Using cached emotes for TestStream'
      )
    })

    it('should handle emote fetch errors', async () => {
      const error = new Error('Emote fetch failed')
      mockWindowApp.kick.getEmotes.mockRejectedValue(error)

      const result = await connectionManager.fetchChatroomEmotes(mockChatroom)

      expect(result).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ConnectionManager] Error fetching emotes for TestStream:',
        error
      )
    })

    it('should cache global 7TV emotes', async () => {
      await connectionManager.fetchGlobalStvEmotes()

      expect(consoleLogSpy).toHaveBeenCalledWith('[ConnectionManager] Fetching global 7TV emotes...')
      expect(consoleLogSpy).toHaveBeenCalledWith('[ConnectionManager] Global 7TV emotes cached')
    })

    it('should use cached global 7TV emotes', async () => {
      connectionManager.globalStvEmotesCache = ['global_emote1']

      const result = await connectionManager.fetchGlobalStvEmotes()

      expect(result).toEqual(['global_emote1'])
      expect(consoleLogSpy).toHaveBeenCalledWith('[ConnectionManager] Using cached global 7TV emotes')
    })
  })

  describe('Batch Processing', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    
    afterEach(() => {
      vi.useRealTimers()
    })
    
    const mockChatrooms = [
      { id: 'room1', isStreamerLive: true },
      { id: 'room2', isStreamerLive: false },
      { id: 'room3', isStreamerLive: true },
      { id: 'room4', isStreamerLive: false },
      { id: 'room5', isStreamerLive: false }
    ]

    it('should prioritize live streamers', () => {
      const prioritized = connectionManager.prioritizeChatrooms(mockChatrooms)

      expect(prioritized[0].isStreamerLive).toBe(true)
      expect(prioritized[1].isStreamerLive).toBe(true)
    })

    it('should chunk arrays correctly', () => {
      const chunked = connectionManager.chunkArray([1, 2, 3, 4, 5], 2)

      expect(chunked).toEqual([[1, 2], [3, 4], [5]])
    })

    it('should handle empty arrays', () => {
      const chunked = connectionManager.chunkArray([], 3)

      expect(chunked).toEqual([])
    })

    it('should handle chunk size larger than array', () => {
      const chunked = connectionManager.chunkArray([1, 2], 5)

      expect(chunked).toEqual([[1, 2]])
    })
    it('should process chatrooms in batches with delays', async () => {
      // Mock addChatroom to resolve immediately
      vi.spyOn(connectionManager, 'addChatroom').mockResolvedValue()
      
      const initPromise = connectionManager.initializeChatroomsInBatches(mockChatrooms)
      
      // Run all timers to process batches
      await vi.runAllTimersAsync()
      
      await initPromise

      // Should be processed in batches of 3 (default batchSize)
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ConnectionManager] Processing batch 1/2 (3 chatrooms)'
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ConnectionManager] Processing batch 2/2 (2 chatrooms)'
      )
    })

    it('should batch fetch emotes with limits', async () => {
      const chatrooms = Array.from({ length: 10 }, (_, i) => ({
        streamerData: { slug: `stream${i}`, user: { username: `Stream${i}` } }
      }))

      vi.spyOn(connectionManager, 'fetchChatroomEmotes').mockResolvedValue(['emote'])
      vi.spyOn(connectionManager, 'fetchGlobalStvEmotes').mockResolvedValue()

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const fetchPromise = connectionManager.batchFetchEmotes(chatrooms)
      
      // Advance timers to handle any delays in batch processing
      await vi.runAllTimersAsync()
      await fetchPromise

      expect(consoleSpy).toHaveBeenCalledWith('[ConnectionManager] Starting batch emote fetching...')
      expect(consoleSpy).toHaveBeenCalledWith('[ConnectionManager] Batch emote fetching completed')
      
      consoleSpy.mockRestore()
    })
  })

  describe('Connection Status', () => {
    it('should return comprehensive connection status', () => {
      const status = connectionManager.getConnectionStatus()

      expect(status).toEqual({
        kick: {
          state: 'connected',
          chatrooms: 3,
          channels: 5,
        },
        stv: {
          state: 'connected',
          chatrooms: 3,
          events: 8,
        },
        emoteCache: {
          size: 0,
          globalCached: false,
        },
      })
    })

    it('should reflect emote cache state', () => {
      connectionManager.emoteCache.set('test', ['emote1'])
      connectionManager.globalStvEmotesCache = ['global1']

      const status = connectionManager.getConnectionStatus()

      expect(status.emoteCache.size).toBe(1)
      expect(status.emoteCache.globalCached).toBe(true)
    })
  })

  describe('Utility Functions', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    
    afterEach(() => {
      vi.useRealTimers()
    })

    it('should delay for specified time', async () => {
      const delayPromise = connectionManager.delay(100)
      vi.advanceTimersByTime(100)
      await delayPromise

      // Since we're using fake timers, the actual time won't advance
      expect(vi.getTimerCount()).toBe(0)
    })

    it('should handle delay with zero time', async () => {
      const delayPromise = connectionManager.delay(0)
      vi.advanceTimersByTime(0)
      await delayPromise

      expect(vi.getTimerCount()).toBe(0)
    })
  })

  describe('Cleanup', () => {
    it('should cleanup all resources', () => {
      connectionManager.emoteCache.set('test', ['emote1'])
      connectionManager.globalStvEmotesCache = ['global1']
      connectionManager.initializationInProgress = true

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      connectionManager.cleanup()

      expect(mockSharedKickPusher.close).toHaveBeenCalled()
      expect(mockSharedStvWebSocket.close).toHaveBeenCalled()
      expect(connectionManager.emoteCache.size).toBe(0)
      expect(connectionManager.globalStvEmotesCache).toBeNull()
      expect(connectionManager.initializationInProgress).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('[ConnectionManager] Cleaning up connections...')
      
      consoleSpy.mockRestore()
    })

    it('should handle cleanup with empty state', () => {
      // Should not throw error
      expect(() => connectionManager.cleanup()).not.toThrow()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle null chatroom data', async () => {
      await expect(connectionManager.addChatroom(null)).resolves.toBeUndefined()
    })

    it('should handle malformed chatroom data', async () => {
      const malformedChatroom = { id: 'test' }

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await connectionManager.addChatroom(malformedChatroom)

      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })

    it('should handle network timeouts during connection', async () => {
      vi.useFakeTimers()
      
      // Simulate connection that never resolves
      mockSharedKickPusher.addEventListener.mockImplementation(() => {})
      mockSharedStvWebSocket.addEventListener.mockImplementation(() => {})

      const mockChatrooms = [{ id: 'test', streamerData: { id: 'test' } }]

      const initPromise = connectionManager.initializeConnections(mockChatrooms, {}, {})
      
      // Fast-forward past the timeout (1000ms in test environment)
      await vi.advanceTimersByTimeAsync(1000)
      
      await expect(initPromise).rejects.toThrow('Connection timeout')
      
      vi.useRealTimers()
    })

    it('should handle partial connection failures', async () => {
      vi.useFakeTimers()
      
      // Kick connects successfully, but 7TV fails
      mockSharedKickPusher.addEventListener.mockImplementation((event, handler) => {
        if (event === 'connection') {
          // Use immediate execution for deterministic tests
          setTimeout(() => handler({ detail: { content: 'connection-success' } }), 0)
        }
      })

      mockSharedStvWebSocket.addEventListener.mockImplementation(() => {
        // Never calls the handler, simulating connection failure
      })

      const mockChatrooms = [{ id: 'test', streamerData: { id: 'test' } }]

      const initPromise = connectionManager.initializeConnections(mockChatrooms, {}, {})
      
      // Fast-forward past the timeout (1000ms in test environment)
      await vi.advanceTimersByTimeAsync(1000)
      
      await expect(initPromise).rejects.toThrow('Connection timeout')
      
      vi.useRealTimers()
    })

    it('should handle empty event handlers gracefully', async () => {
      const mockChatrooms = [
        {
          id: 'chatroom1',
          streamerData: { id: 'streamer1', slug: 'test' },
          channel7TVEmotes: null
        }
      ]

      // Setup successful connections - use immediate execution for deterministic tests
      mockSharedKickPusher.addEventListener.mockImplementation((event, handler) => {
        if (event === 'connection') {
          if (typeof setImmediate !== 'undefined') {
            setImmediate(() => handler({ detail: { content: 'connection-success' } }))
          } else {
            setTimeout(() => handler({ detail: { content: 'connection-success' } }), 0)
          }
        }
      })

      mockSharedStvWebSocket.addEventListener.mockImplementation((event, handler) => {
        if (event === 'connection') {
          if (typeof setImmediate !== 'undefined') {
            setImmediate(() => handler({ detail: { content: 'connection-success' } }))
          } else {
            setTimeout(() => handler({ detail: { content: 'connection-success' } }), 0)
          }
        }
      })

      mockWindowApp.kick.getInitialChatroomMessages.mockResolvedValue({ data: { data: null } })
      mockWindowApp.kick.getChannelChatroomInfo.mockResolvedValue({ data: {} })
      mockWindowApp.kick.getEmotes.mockResolvedValue([])

      // Should not throw with empty handlers
      await expect(
        connectionManager.initializeConnections(mockChatrooms, {}, {})
      ).resolves.toBeUndefined()
    })

    it('should handle configuration edge cases', () => {
      connectionManager.config.batchSize = 0
      connectionManager.config.maxConcurrentEmoteFetches = 0

      const chunked = connectionManager.chunkArray([1, 2, 3], 0)
      expect(chunked).toEqual([])
    })

    it('should handle very large batches', () => {
      const largeChatrooms = Array.from({ length: 1000 }, (_, i) => ({ id: `room${i}` }))
      const prioritized = connectionManager.prioritizeChatrooms(largeChatrooms)
      
      expect(prioritized).toHaveLength(1000)
    })

    it('should handle concurrent initialization attempts', async () => {
      const mockChatrooms = [{ id: 'test', streamerData: { id: 'test' } }]

      // Start first initialization
      const promise1 = connectionManager.initializeConnections(mockChatrooms, {}, {})

      // Try to start second initialization immediately
      const promise2 = connectionManager.initializeConnections(mockChatrooms, {}, {})

      await Promise.allSettled([promise1, promise2])

      // Second call should have been ignored
      expect(connectionManager.initializationInProgress).toBe(false)
    })
  })

  describe('Performance Considerations', () => {
    it('should limit concurrent emote fetches', async () => {
      const chatrooms = Array.from({ length: 20 }, (_, i) => ({
        streamerData: { slug: `stream${i}`, user: { username: `Stream${i}` } }
      }))

      let concurrentCalls = 0
      let maxConcurrentCalls = 0

      mockWindowApp.kick.getEmotes.mockImplementation(() => {
        concurrentCalls++
        maxConcurrentCalls = Math.max(maxConcurrentCalls, concurrentCalls)
        
        return new Promise(resolve => {
          setTimeout(() => {
            concurrentCalls--
            resolve(['emote'])
          }, 10)
        })
      })

      vi.spyOn(connectionManager, 'fetchGlobalStvEmotes').mockResolvedValue()

      await connectionManager.batchFetchEmotes(chatrooms)

      // Should not exceed maxConcurrentEmoteFetches
      expect(maxConcurrentCalls).toBeLessThanOrEqual(connectionManager.config.maxConcurrentEmoteFetches)
    })

    it('should implement stagger delay between batches', async () => {
      const chatrooms = Array.from({ length: 7 }, (_, i) => ({ 
        id: `room${i}`,
        streamerData: { id: `streamer${i}`, slug: `stream${i}` }
      }))

      vi.spyOn(connectionManager, 'addChatroom').mockResolvedValue()

      const delayMock = vi.spyOn(connectionManager, 'delay').mockImplementation((ms) => 
        new Promise(resolve => setTimeout(resolve, ms))
      )

      await connectionManager.initializeChatroomsInBatches(chatrooms)

      // Should have called delay between batches (7 chatrooms = 3 batches with default batchSize of 3)
      // So 2 delays should be called (between batch 1->2 and batch 2->3)
      expect(delayMock).toHaveBeenCalledWith(200) // staggerDelay
      expect(delayMock).toHaveBeenCalledTimes(2)

      delayMock.mockRestore()
    })

    it('should handle memory cleanup effectively', () => {
      // Fill cache with data
      for (let i = 0; i < 100; i++) {
        connectionManager.emoteCache.set(`stream${i}`, [`emote${i}`])
      }

      connectionManager.globalStvEmotesCache = new Array(1000).fill('global_emote')

      expect(connectionManager.emoteCache.size).toBe(100)
      expect(connectionManager.globalStvEmotesCache.length).toBe(1000)

      connectionManager.cleanup()

      expect(connectionManager.emoteCache.size).toBe(0)
      expect(connectionManager.globalStvEmotesCache).toBeNull()
    })
  })

  describe('Configuration Management', () => {
    it('should use custom configuration', () => {
      const customConfig = {
        staggerDelay: 500,
        batchSize: 5,
        maxConcurrentEmoteFetches: 10
      }

      connectionManager.config = customConfig

      expect(connectionManager.config).toEqual(customConfig)
    })

    it('should validate configuration bounds', () => {
      // Test with extreme values
      connectionManager.config.staggerDelay = -100
      connectionManager.config.batchSize = 0
      connectionManager.config.maxConcurrentEmoteFetches = -5

      // The implementation should handle these gracefully
      expect(() => connectionManager.chunkArray([1, 2, 3], connectionManager.config.batchSize))
        .not.toThrow()
    })
  })

  describe('State Management', () => {
    it('should maintain consistent state during operations', async () => {
      expect(connectionManager.initializationInProgress).toBe(false)

      const initPromise = connectionManager.initializeConnections([], {}, {})
      
      expect(connectionManager.initializationInProgress).toBe(true)

      await initPromise

      expect(connectionManager.initializationInProgress).toBe(false)
    })

    it('should preserve state callbacks', async () => {
      const callbacks = {
        handlePinnedMessageCreated: vi.fn(),
        handlePinnedMessageDeleted: vi.fn(),
        addInitialChatroomMessages: vi.fn(),
        handleStreamStatus: vi.fn()
      }

      await connectionManager.initializeConnections([], {}, callbacks)

      expect(connectionManager.storeCallbacks).toBe(callbacks)
    })

    it('should handle null store callbacks', async () => {
      await connectionManager.initializeConnections([], {}, null)

      expect(connectionManager.storeCallbacks).toBeNull()

      // Should not throw when callbacks are null
      const mockChatroom = { id: 'test', streamerData: { id: 'streamer1' } }
      
      mockWindowApp.kick.getInitialChatroomMessages.mockResolvedValue({
        data: { data: { messages: [] } }
      })

      await expect(connectionManager.fetchInitialMessages(mockChatroom)).resolves.toBeUndefined()
    })
  })
})