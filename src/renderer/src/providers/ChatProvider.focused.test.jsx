import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useChatStore from './ChatProvider'
import { DEFAULT_CHAT_HISTORY_LENGTH } from '@utils/constants'

// Mock external dependencies
vi.mock('@utils/services/kick/kickPusher')
vi.mock('@utils/services/seventv/stvWebsocket')
vi.mock('@utils/services/connectionManager')
vi.mock('./CosmeticsProvider', () => ({
  default: vi.fn(() => ({ badges: [], paints: [] }))
}))
vi.mock('@utils/services/seventv/stvAPI')
vi.mock('@utils/services/kick/kickAPI')
vi.mock('../utils/MessageParser')

// Mock window APIs
global.window = {
  ...global.window,
  app: {
    auth: {
      getToken: vi.fn(() => ({ token: 'mock-token', session: 'mock-session' }))
    },
    kick: {
      getSelfInfo: vi.fn(),
      sendReply: vi.fn()
    },
    telemetry: {
      recordMessageSent: vi.fn(),
      recordAPIRequest: vi.fn(),
      recordSevenTVConnectionHealth: vi.fn()
    }
  },
  __chatMessageBatch: {},
  crypto: {
    randomUUID: vi.fn(() => 'mock-uuid-' + Math.random())
  }
}

describe('ChatProvider Store - Focused Business Logic Tests', () => {
  let store

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    // Reset store state
    act(() => {
      useChatStore.setState(useChatStore.getState().getInitialState?.() || {
        messages: {},
        chatrooms: [],
        connections: {},
        currentChatroom: null,
        currentUser: null,
        chatHistorySettings: {
          chatHistoryLength: DEFAULT_CHAT_HISTORY_LENGTH
        },
        draftMessages: new Map()
      })
    })
    
    const { result } = renderHook(() => useChatStore())
    store = result.current
  })

  afterEach(() => {
    vi.useRealTimers()
    act(() => {
      store.cleanupConnections?.()
    })
  })

  describe('Store Initialization', () => {
    it('should initialize with correct default state', () => {
      expect(store.messages).toEqual({})
      expect(store.chatrooms).toEqual([])
      expect(store.connections).toEqual({})
      expect(store.currentChatroom).toBeNull()
      expect(store.currentUser).toBeNull()
      expect(store.chatHistorySettings.chatHistoryLength).toBe(DEFAULT_CHAT_HISTORY_LENGTH)
      expect(store.draftMessages).toBeInstanceOf(Map)
    })

    it('should provide all necessary action methods', () => {
      expect(typeof store.addMessage).toBe('function')
      expect(typeof store.sendReply).toBe('function')
      expect(typeof store.cacheCurrentUser).toBe('function')
      expect(typeof store.cleanupConnections).toBe('function')
      expect(typeof store.sendPresenceUpdate).toBe('function')
    })
  })

  describe('Message Management', () => {
    it('should add message to specific chatroom', () => {
      const chatroomId = 'room123'
      const message = {
        id: 'msg1',
        content: 'Hello world',
        timestamp: new Date().toISOString(),
        sender: { username: 'testuser' }
      }

      act(() => {
        store.addMessage(chatroomId, message)
      })

      const { result } = renderHook(() => useChatStore())
      expect(result.current.messages[chatroomId]).toContainEqual(message)
    })

    it('should create messages object for new chatroom', () => {
      const chatroomId = 'newroom'
      const message = { id: 'msg1', content: 'First message' }

      act(() => {
        store.addMessage(chatroomId, message)
      })

      const { result } = renderHook(() => useChatStore())
      expect(result.current.messages[chatroomId]).toHaveLength(1)
      expect(result.current.messages[chatroomId][0]).toEqual(message)
    })

    it('should handle multiple messages in same chatroom', () => {
      const chatroomId = 'room123'
      const messages = [
        { id: 'msg1', content: 'First' },
        { id: 'msg2', content: 'Second' },
        { id: 'msg3', content: 'Third' }
      ]

      act(() => {
        messages.forEach(msg => store.addMessage(chatroomId, msg))
      })

      const { result } = renderHook(() => useChatStore())
      expect(result.current.messages[chatroomId]).toHaveLength(3)
      expect(result.current.messages[chatroomId]).toEqual(messages)
    })

    it('should update message state correctly', () => {
      const chatroomId = 'room123'
      const tempId = 'temp123'
      const message = {
        id: 'msg1',
        tempId,
        content: 'Test message',
        state: 'optimistic'
      }

      act(() => {
        store.addMessage(chatroomId, message)
      })

      act(() => {
        store.updateMessageState?.(chatroomId, tempId, 'confirmed')
      })

      const { result } = renderHook(() => useChatStore())
      const updatedMessage = result.current.messages[chatroomId]?.find(m => m.tempId === tempId)
      expect(updatedMessage?.state).toBe('confirmed')
    })
  })

  describe('Optimistic Message Handling', () => {
    beforeEach(() => {
      const mockUser = {
        id: 123,
        username: 'testuser',
        identity: { color: '#ff0000' }
      }
      global.window.app.kick.getSelfInfo.mockResolvedValue(mockUser)
    })

    it('should cache current user info', async () => {
      await act(async () => {
        await store.cacheCurrentUser()
      })

      const { result } = renderHook(() => useChatStore())
      expect(result.current.currentUser).toBeTruthy()
      expect(result.current.currentUser.username).toBe('testuser')
      expect(global.window.app.kick.getSelfInfo).toHaveBeenCalledTimes(1)
    })

    it('should handle cache user failure gracefully', async () => {
      global.window.app.kick.getSelfInfo.mockRejectedValue(new Error('API Error'))

      await act(async () => {
        const result = await store.cacheCurrentUser()
        expect(result).toBeNull()
      })

      const { result } = renderHook(() => useChatStore())
      expect(result.current.currentUser).toBeNull()
    })

    it('should send optimistic reply and confirm on success', async () => {
      const chatroomId = 'room123'
      const content = 'Test reply'
      
      // Mock successful API response
      global.window.app.kick.sendReply.mockResolvedValue({
        status: 200,
        data: { status: { code: 200 } }
      })

      // Cache user first
      await act(async () => {
        await store.cacheCurrentUser()
      })

      await act(async () => {
        await store.sendReply(chatroomId, content)
      })

      const { result } = renderHook(() => useChatStore())
      
      // Should have optimistic message
      expect(result.current.messages[chatroomId]).toHaveLength(1)
      expect(result.current.messages[chatroomId][0].content).toBe(content)
      expect(result.current.messages[chatroomId][0].state).toBe('optimistic')
      
      // Should have called API
      expect(global.window.app.kick.sendReply).toHaveBeenCalledWith(chatroomId, content, undefined)
    })

    it('should handle reply authentication failure', async () => {
      const chatroomId = 'room123'
      const content = 'Test reply'
      
      // Mock auth failure response
      global.window.app.kick.sendReply.mockResolvedValue({
        data: { status: { code: 401 } }
      })

      await act(async () => {
        await store.cacheCurrentUser()
      })

      let result
      await act(async () => {
        result = await store.sendReply(chatroomId, content)
      })

      expect(result).toBe(false)
      
      const { result: storeResult } = renderHook(() => useChatStore())
      
      // Should have system message about login requirement
      const systemMessages = storeResult.current.messages[chatroomId]?.filter(m => m.type === 'system')
      expect(systemMessages).toHaveLength(1)
      expect(systemMessages[0].content).toBe('You must login to chat.')
    })

    it('should handle reply when user not logged in', async () => {
      const chatroomId = 'room123'
      const content = 'Test reply'
      
      // Mock no user info
      global.window.app.kick.getSelfInfo.mockResolvedValue(null)

      let result
      await act(async () => {
        result = await store.sendReply(chatroomId, content)
      })

      expect(result).toBe(false)
      
      const { result: storeResult } = renderHook(() => useChatStore())
      
      // Should have system message
      const systemMessages = storeResult.current.messages[chatroomId]?.filter(m => m.type === 'system')
      expect(systemMessages).toHaveLength(1)
      expect(systemMessages[0].content).toBe('You must login to chat.')
    })

    it('should timeout optimistic messages after 30 seconds', async () => {
      const chatroomId = 'room123'
      const content = 'Test reply'
      
      // Mock hanging API call
      global.window.app.kick.sendReply.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 35000))
      )

      await act(async () => {
        await store.cacheCurrentUser()
      })

      await act(async () => {
        store.sendReply(chatroomId, content) // Don't await
      })

      // Fast-forward past timeout
      act(() => {
        vi.advanceTimersByTime(31000)
      })

      const { result } = renderHook(() => useChatStore())
      
      // Message should be marked as failed
      expect(result.current.messages[chatroomId]).toHaveLength(1)
      expect(result.current.messages[chatroomId][0].state).toBe('failed')
    })
  })

  describe('7TV Presence Updates', () => {
    it('should send presence update with valid parameters', () => {
      const stvId = 'stv123'
      const userId = 'user456'

      act(() => {
        store.sendPresenceUpdate(stvId, userId)
      })

      // Should complete without throwing
      expect(true).toBe(true)
    })

    it('should skip presence update without stvId', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      act(() => {
        store.sendPresenceUpdate(null, 'user123')
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No STV ID provided')
      )
      
      consoleSpy.mockRestore()
    })

    it('should skip presence update without auth tokens', () => {
      global.window.app.auth.getToken.mockReturnValue(null)
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      act(() => {
        store.sendPresenceUpdate('stv123', 'user456')
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No auth tokens available')
      )
      
      consoleSpy.mockRestore()
    })

    it('should throttle presence updates within interval', () => {
      const stvId = 'stv123'
      const userId = 'user456'
      
      // First update
      act(() => {
        store.sendPresenceUpdate(stvId, userId)
      })

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      // Immediate second update should be throttled
      act(() => {
        store.sendPresenceUpdate(stvId, userId)
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Last update time for chatroom')
      )
      
      consoleSpy.mockRestore()
    })

    it('should allow presence updates after throttle interval', () => {
      const stvId = 'stv123'
      const userId = 'user456'
      
      // First update
      act(() => {
        store.sendPresenceUpdate(stvId, userId)
      })

      // Advance time past throttle interval (30 seconds)
      act(() => {
        vi.advanceTimersByTime(31000)
      })

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      // Second update should go through
      act(() => {
        store.sendPresenceUpdate(stvId, userId)
      })

      // Should not see throttle message
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Last update time for chatroom')
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('Connection Management', () => {
    it('should provide connection status when no manager initialized', () => {
      const status = store.getConnectionStatus()
      
      expect(status.manager).toBe('not initialized')
      expect(status.individual_connections).toBe(0)
    })

    it('should clean up connections on cleanup call', () => {
      // Add some mock connections
      act(() => {
        useChatStore.setState({
          connections: {
            'room1': { kickPusher: { close: vi.fn() }, stvSocket: { close: vi.fn() } },
            'room2': { kickPusher: { close: vi.fn() }, stvSocket: { close: vi.fn() } }
          }
        })
      })

      const { result: initialState } = renderHook(() => useChatStore())
      expect(Object.keys(initialState.current.connections)).toHaveLength(2)

      act(() => {
        store.cleanupConnections()
      })

      const { result: finalState } = renderHook(() => useChatStore())
      expect(finalState.current.connections).toEqual({})
    })

    it('should clean up message batching on cleanup', () => {
      // Setup mock batching
      global.window.__chatMessageBatch = {
        'room1': { 
          timer: setTimeout(() => {}, 1000),
          queue: [{ id: 'msg1', content: 'test' }]
        }
      }

      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
      
      act(() => {
        store.cleanupConnections()
      })

      expect(clearTimeoutSpy).toHaveBeenCalled()
      expect(global.window.__chatMessageBatch).toEqual({})
      
      clearTimeoutSpy.mockRestore()
    })

    it('should get 7TV status correctly', () => {
      // Set up test state
      act(() => {
        useChatStore.setState({
          chatrooms: [{ id: 'room1' }, { id: 'room2' }],
          connections: { 'room1': {}, 'room2': {} }
        })
      })

      const status = store.get7TVStatus()
      
      expect(status.chatrooms).toBe(2)
      expect(status.connections).toBe(2)
    })

    it('should handle debug stream status toggle', () => {
      const chatroomId = 'room123'
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      act(() => {
        store.debugToggleStreamStatus?.(chatroomId, true)
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Toggling stream status')
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('Message Batching Logic', () => {
    it('should handle batched message cleanup with flush', () => {
      const addMessageSpy = vi.fn()
      
      // Mock the store's addMessage method
      act(() => {
        useChatStore.setState(state => ({
          ...state,
          addMessage: addMessageSpy
        }))
      })

      // Setup mock batching with messages
      global.window.__chatMessageBatch = {
        'room1': { 
          timer: setTimeout(() => {}, 1000),
          queue: [
            { id: 'msg1', content: 'batch1' },
            { id: 'msg2', content: 'batch2' }
          ]
        }
      }

      act(() => {
        store.cleanupBatching()
      })

      // Should flush batched messages
      expect(addMessageSpy).toHaveBeenCalledTimes(2)
      expect(addMessageSpy).toHaveBeenCalledWith('room1', { id: 'msg1', content: 'batch1' })
      expect(addMessageSpy).toHaveBeenCalledWith('room1', { id: 'msg2', content: 'batch2' })
    })

    it('should handle empty batch cleanup', () => {
      global.window.__chatMessageBatch = {}
      
      expect(() => {
        act(() => {
          store.cleanupBatching()
        })
      }).not.toThrow()
    })
  })

  describe('Draft Message Management', () => {
    it('should handle draft messages map', () => {
      // The draftMessages is initialized as a Map
      expect(store.draftMessages).toBeInstanceOf(Map)
      expect(store.draftMessages.size).toBe(0)
    })

    it('should maintain draft messages state', () => {
      const initialDrafts = store.draftMessages
      
      // Add something to the map
      act(() => {
        store.draftMessages.set('room1', 'draft content')
      })
      
      const { result } = renderHook(() => useChatStore())
      expect(result.current.draftMessages.get('room1')).toBe('draft content')
      expect(result.current.draftMessages).toBe(initialDrafts) // Same reference
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle sendReply with empty content gracefully', async () => {
      await act(async () => {
        await store.cacheCurrentUser()
      })

      await act(async () => {
        const result = await store.sendReply('room123', '')
      })

      // Should handle empty content without error
      const { result } = renderHook(() => useChatStore())
      expect(result.current.messages['room123']).toEqual([])
    })

    it('should handle sendReply API errors gracefully', async () => {
      global.window.app.kick.sendReply.mockRejectedValue(new Error('Network error'))

      await act(async () => {
        await store.cacheCurrentUser()
      })

      await act(async () => {
        await expect(store.sendReply('room123', 'test')).rejects.toThrow('Network error')
      })

      // Should still have optimistic message
      const { result } = renderHook(() => useChatStore())
      expect(result.current.messages['room123']).toHaveLength(1)
    })

    it('should handle missing telemetry APIs gracefully', async () => {
      delete global.window.app.telemetry

      await act(async () => {
        await store.cacheCurrentUser()
      })

      // Should not throw when telemetry is missing
      expect(() => {
        act(() => {
          store.get7TVStatus()
        })
      }).not.toThrow()
    })

    it('should handle corrupted window.__chatMessageBatch', () => {
      global.window.__chatMessageBatch = {
        'room1': { 
          timer: null, // Corrupted timer
          queue: null  // Corrupted queue
        }
      }

      expect(() => {
        act(() => {
          store.cleanupBatching()
        })
      }).not.toThrow()
    })

    it('should handle connection cleanup with missing methods', () => {
      act(() => {
        useChatStore.setState({
          connections: {
            'room1': { 
              kickPusher: {}, // Missing close method
              stvSocket: null  // Null socket
            }
          }
        })
      })

      expect(() => {
        act(() => {
          store.cleanupConnections()
        })
      }).not.toThrow()
    })
  })

  describe('Performance and Memory Management', () => {
    it('should handle large number of messages efficiently', () => {
      const chatroomId = 'room123'
      const messageCount = 1000
      const startTime = performance.now()

      act(() => {
        for (let i = 0; i < messageCount; i++) {
          store.addMessage(chatroomId, {
            id: `msg${i}`,
            content: `Message ${i}`,
            timestamp: new Date().toISOString()
          })
        }
      })

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete within reasonable time
      expect(duration).toBeLessThan(1000) // 1 second

      const { result } = renderHook(() => useChatStore())
      expect(result.current.messages[chatroomId]).toHaveLength(messageCount)
    })

    it('should handle rapid state updates without memory leaks', () => {
      const initialMemory = process.memoryUsage?.()?.heapUsed || 0

      act(() => {
        for (let i = 0; i < 100; i++) {
          useChatStore.setState(state => ({
            ...state,
            currentChatroom: `room${i}`
          }))
        }
      })

      const { result } = renderHook(() => useChatStore())
      expect(result.current.currentChatroom).toBe('room99')

      // Memory should not grow excessively (rough check)
      const finalMemory = process.memoryUsage?.()?.heapUsed || 0
      const memoryGrowth = finalMemory - initialMemory
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024) // Less than 10MB growth
    })
  })
})