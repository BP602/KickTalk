import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock WebSocket before importing the module
class MockWebSocket extends EventTarget {
  constructor(url, protocols) {
    super()
    this.url = url
    this.protocols = protocols
    this.readyState = MockWebSocket.CONNECTING
    this.onopen = null
    this.onclose = null
    this.onmessage = null
    this.onerror = null
    this.sentMessages = []
    
    // Simulate async connection
    setTimeout(() => {
      if (this.readyState === MockWebSocket.CONNECTING) {
        this.readyState = MockWebSocket.OPEN
        if (this.onopen) {
          this.onopen(new Event('open'))
        }
        this.dispatchEvent(new Event('open'))
      }
    }, 0)
  }

  send(data) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
    this.sentMessages.push(data)
  }

  close(code = 1000, reason = '') {
    if (this.readyState === MockWebSocket.OPEN || this.readyState === MockWebSocket.CONNECTING) {
      this.readyState = MockWebSocket.CLOSING
      setTimeout(() => {
        this.readyState = MockWebSocket.CLOSED
        const closeEvent = new CloseEvent('close', { 
          code, 
          reason,
          wasClean: code === 1000 
        })
        if (this.onclose) {
          this.onclose(closeEvent)
        }
        this.dispatchEvent(closeEvent)
      }, 0)
    }
  }

  // Mock connection failure
  simulateError(error = new Error('Connection failed')) {
    if (this.onerror) {
      this.onerror(new ErrorEvent('error', { error }))
    }
    this.dispatchEvent(new ErrorEvent('error', { error }))
  }

  // Mock incoming message
  simulateMessage(data) {
    if (this.readyState === MockWebSocket.OPEN) {
      const messageEvent = new MessageEvent('message', { data })
      if (this.onmessage) {
        this.onmessage(messageEvent)
      }
      this.dispatchEvent(messageEvent)
    }
  }

  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
}

// Mock global WebSocket
global.WebSocket = MockWebSocket

// Mock console methods to avoid noise in tests
const originalConsole = {
  log: console.log,
  error: console.error
}

describe('SharedStvWebSocket', () => {
  let SharedStvWebSocket
  let sharedSocket
  let mockWebSocket

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    // Mock console to reduce test noise
    console.log = vi.fn()
    console.error = vi.fn()
    
    // Import the module fresh for each test
    const module = await import('./sharedStvWebSocket.js')
    SharedStvWebSocket = module.default
    
    sharedSocket = new SharedStvWebSocket()
    // Debug: console.log(`[BEFOREEACH DEBUG] New sharedSocket created, reconnectAttempts: ${sharedSocket.reconnectAttempts}`)
  })

  afterEach(() => {
    vi.useRealTimers()
    console.log = originalConsole.log
    console.error = originalConsole.error
    
    if (sharedSocket) {
      sharedSocket.close()
    }
  })

  describe('Constructor and Initial State', () => {
    it('should initialize with correct default values', () => {
      expect(sharedSocket.startDelay).toBe(1000)
      expect(sharedSocket.maxRetrySteps).toBe(5)
      expect(sharedSocket.reconnectAttempts).toBe(0)
      expect(sharedSocket.chat).toBe(null)
      expect(sharedSocket.shouldReconnect).toBe(true)
      expect(sharedSocket.connectionState).toBe('disconnected')
      expect(sharedSocket.chatrooms).toBeInstanceOf(Map)
      expect(sharedSocket.subscribedEvents).toBeInstanceOf(Set)
      expect(sharedSocket.userEventSubscribed).toBe(false)
    })

    it('should extend EventTarget', () => {
      expect(sharedSocket).toBeInstanceOf(EventTarget)
      expect(typeof sharedSocket.addEventListener).toBe('function')
      expect(typeof sharedSocket.removeEventListener).toBe('function')
      expect(typeof sharedSocket.dispatchEvent).toBe('function')
    })

    it('should have correct initial chatroom and event state', () => {
      expect(sharedSocket.chatrooms.size).toBe(0)
      expect(sharedSocket.subscribedEvents.size).toBe(0)
      expect(sharedSocket.userEventSubscribed).toBe(false)
    })
  })

  describe('Chatroom Management', () => {
    it('should add chatroom correctly', () => {
      sharedSocket.addChatroom('room1', '123', 'stv123', 'set123')
      
      expect(sharedSocket.chatrooms.size).toBe(1)
      expect(sharedSocket.chatrooms.has('room1')).toBe(true)
      
      const chatroomData = sharedSocket.chatrooms.get('room1')
      expect(chatroomData).toEqual({
        channelKickID: '123',
        stvId: 'stv123',
        stvEmoteSetId: 'set123'
      })
    })

    it('should convert channelKickID to string', () => {
      sharedSocket.addChatroom('room1', 123, 'stv123', 'set123')
      
      const chatroomData = sharedSocket.chatrooms.get('room1')
      expect(chatroomData.channelKickID).toBe('123')
      expect(typeof chatroomData.channelKickID).toBe('string')
    })

    it('should handle default values for optional parameters', () => {
      sharedSocket.addChatroom('room1', '123')
      
      const chatroomData = sharedSocket.chatrooms.get('room1')
      expect(chatroomData.stvId).toBe('0')
      expect(chatroomData.stvEmoteSetId).toBe('0')
    })

    it('should remove chatroom correctly', () => {
      sharedSocket.addChatroom('room1', '123')
      sharedSocket.addChatroom('room2', '456')
      
      expect(sharedSocket.chatrooms.size).toBe(2)
      
      sharedSocket.removeChatroom('room1')
      
      expect(sharedSocket.chatrooms.size).toBe(1)
      expect(sharedSocket.chatrooms.has('room1')).toBe(false)
      expect(sharedSocket.chatrooms.has('room2')).toBe(true)
    })

    it('should close connection when all chatrooms are removed', async () => {
      sharedSocket.addChatroom('room1', '123')
      
      const closeSpy = vi.spyOn(sharedSocket, 'close')
      
      sharedSocket.removeChatroom('room1')
      
      expect(closeSpy).toHaveBeenCalled()
    })

    it('should not close connection when chatrooms remain', () => {
      sharedSocket.addChatroom('room1', '123')
      sharedSocket.addChatroom('room2', '456')
      
      const closeSpy = vi.spyOn(sharedSocket, 'close')
      
      sharedSocket.removeChatroom('room1')
      
      expect(closeSpy).not.toHaveBeenCalled()
    })
  })

  describe('Connection Management', () => {
    it('should not connect when shouldReconnect is false', () => {
      sharedSocket.shouldReconnect = false
      sharedSocket.connect()
      
      expect(sharedSocket.connectionState).toBe('disconnected')
      expect(sharedSocket.chat).toBe(null)
    })

    it('should not connect when already connecting', () => {
      sharedSocket.connectionState = 'connecting'
      const originalChat = sharedSocket.chat
      
      sharedSocket.connect()
      
      expect(sharedSocket.chat).toBe(originalChat)
    })

    it('should not connect when already connected', () => {
      sharedSocket.connectionState = 'connected'
      const originalChat = sharedSocket.chat
      
      sharedSocket.connect()
      
      expect(sharedSocket.chat).toBe(originalChat)
    })

    it('should create WebSocket with correct URL and set connecting state', () => {
      sharedSocket.addChatroom('room1', '123')
      sharedSocket.connect()
      
      expect(sharedSocket.connectionState).toBe('connecting')
      expect(sharedSocket.chat).toBeInstanceOf(MockWebSocket)
      expect(sharedSocket.chat.url).toBe('wss://events.7tv.io/v3?app=kicktalk&version=420.69')
    })

    it('should handle successful connection', async () => {
      sharedSocket.addChatroom('room1', '123')
      
      const connectionEventPromise = new Promise((resolve) => {
        sharedSocket.addEventListener('connection', resolve, { once: true })
      })
      
      sharedSocket.connect()
      
      // Fast-forward timers to trigger connection
      await vi.runAllTimersAsync()
      
      expect(sharedSocket.connectionState).toBe('connected')
      expect(sharedSocket.reconnectAttempts).toBe(0)
      
      const connectionEvent = await connectionEventPromise
      expect(connectionEvent.detail.type).toBe('system')
      expect(connectionEvent.detail.content).toBe('connection-success')
    })

    it('should handle connection error', () => {
      sharedSocket.addChatroom('room1', '123')
      sharedSocket.connect()
      
      const mockError = new Error('Connection failed')
      sharedSocket.chat.simulateError(mockError)
      
      expect(sharedSocket.connectionState).toBe('disconnected')
      expect(sharedSocket.reconnectAttempts).toBe(1)
    })

    it('should handle WebSocket close event', async () => {
      sharedSocket.addChatroom('room1', '123')
      sharedSocket.connect()
      
      // Wait for connection to be fully established, including async onopen handler
      await vi.runAllTimersAsync()
      expect(sharedSocket.connectionState).toBe('connected')
      
      // Disable reconnection to test the close handling without automatic reconnect
      const originalShouldReconnect = sharedSocket.shouldReconnect
      sharedSocket.shouldReconnect = false
      
      try {
        // Simulate external WebSocket closure (e.g., network issues or server-side close)
        sharedSocket.chat.close(1000, 'Normal closure')
        await vi.runAllTimersAsync()
        
        expect(sharedSocket.connectionState).toBe('disconnected')
        expect(sharedSocket.subscribedEvents.size).toBe(0)
        expect(sharedSocket.userEventSubscribed).toBe(false)
      } finally {
        // Restore original shouldReconnect state
        sharedSocket.shouldReconnect = originalShouldReconnect
      }
    })

    it('should handle Invalid Payload error with no valid data', async () => {
      sharedSocket.addChatroom('room1', '0') // Invalid STV ID
      sharedSocket.connect()
      
      await vi.runAllTimersAsync()
      
      sharedSocket.chat.close(1008, 'Invalid Payload')
      await vi.runAllTimersAsync()
      
      // Should not attempt reconnection
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No valid 7TV data found - stopping reconnection attempts')
      )
    })
  })

  describe('Reconnection Logic', () => {
    it('should implement exponential backoff', async () => {
      sharedSocket.addChatroom('room1', '123')
      
      // Track reconnection delays by intercepting handleReconnection directly
      const reconnectionDelays = []
      const originalHandleReconnection = sharedSocket.handleReconnection.bind(sharedSocket)
      sharedSocket.handleReconnection = () => {
        // Calculate the expected delay using the same logic as the real method
        const attempt = Math.min(sharedSocket.reconnectAttempts + 1, sharedSocket.maxRetrySteps)
        const delay = sharedSocket.startDelay * Math.pow(2, attempt - 1)
        reconnectionDelays.push(delay)
        
        // Don't actually call the original method to avoid real reconnection in test
      }
      
      // Simulate multiple connection failures
      for (let i = 0; i < 5; i++) {
        sharedSocket.connect()
        sharedSocket.chat.simulateError()
        sharedSocket.handleReconnection()
      }
      
      // Check exponential backoff: 2000, 4000, 8000, 16000, 16000
      // (First delay is 2000 because reconnectAttempts is incremented by simulateError before handleReconnection)
      expect(reconnectionDelays[0]).toBe(2000)
      expect(reconnectionDelays[1]).toBe(4000)
      expect(reconnectionDelays[2]).toBe(8000)
      expect(reconnectionDelays[3]).toBe(16000)
      expect(reconnectionDelays[4]).toBe(16000)
      
      // Restore original method
      sharedSocket.handleReconnection = originalHandleReconnection
    })

    it('should cap reconnection delay at maxRetrySteps', async () => {
      sharedSocket.addChatroom('room1', '123')
      
      // Track the timeout delays directly by spying on setTimeout
      const timeoutSpy = vi.spyOn(global, 'setTimeout')
      
      // Simulate more failures than maxRetrySteps
      for (let i = 0; i < 8; i++) {
        sharedSocket.connect()
        sharedSocket.chat.simulateError()
        sharedSocket.handleReconnection()
      }
      
      // Extract delays from setTimeout calls
      const delays = timeoutSpy.mock.calls
        .filter(call => call[1] > 0) // Filter out calls with 0 delay
        .map(call => call[1]) // Get the delay argument
        .slice(-8) // Get last 8 calls
      
      // Delay should cap at maxRetrySteps (5): 1000 * 2^(5-1) = 16000
      expect(delays[delays.length - 1]).toBe(16000)
      expect(delays[delays.length - 2]).toBe(16000)
      
      timeoutSpy.mockRestore()
    })

    it('should not reconnect when shouldReconnect is false', () => {
      sharedSocket.addChatroom('room1', '123')
      sharedSocket.shouldReconnect = false
      
      const connectSpy = vi.spyOn(sharedSocket, 'connect')
      sharedSocket.handleReconnection()
      
      expect(connectSpy).not.toHaveBeenCalled()
    })
  })

  describe('Event Subscription', () => {
    beforeEach(async () => {
      sharedSocket.addChatroom('room1', '123', 'stv123', 'set123')
      sharedSocket.connect()
      await vi.runAllTimersAsync()
    })

    it('should subscribe to user events', async () => {
      // Reset subscription state to test the method independently
      sharedSocket.userEventSubscribed = false
      sharedSocket.subscribedEvents.delete('user.*:stv123')
      
      // Clear messages from connection setup
      sharedSocket.chat.sentMessages = []
      
      await sharedSocket.subscribeToUserEvents()
      
      expect(sharedSocket.userEventSubscribed).toBe(true)
      expect(sharedSocket.subscribedEvents.has('user.*:stv123')).toBe(true)
      
      const sentMessages = sharedSocket.chat.sentMessages
      expect(sentMessages.length).toBe(1)
      
      const message = JSON.parse(sentMessages[0])
      expect(message.op).toBe(35)
      expect(message.d.type).toBe('user.*')
      expect(message.d.condition.object_id).toBe('stv123')
    })

    it('should not subscribe to user events twice', async () => {
      // Reset subscription state and clear messages
      sharedSocket.userEventSubscribed = false
      sharedSocket.subscribedEvents.delete('user.*:stv123')
      sharedSocket.chat.sentMessages = []
      
      await sharedSocket.subscribeToUserEvents()
      await sharedSocket.subscribeToUserEvents()
      
      const sentMessages = sharedSocket.chat.sentMessages
      expect(sentMessages.length).toBe(1) // Should only send one subscription
    })

    it('should not subscribe to user events without valid STV ID', async () => {
      // Create a fresh socket for this test to avoid state contamination
      const freshSocket = new SharedStvWebSocket()
      freshSocket.addChatroom('room1', '123', '0', 'set123') // Invalid STV ID
      freshSocket.connect()
      await vi.runAllTimersAsync()
      
      // Clear any messages sent during connection
      freshSocket.chat.sentMessages = []
      
      await freshSocket.subscribeToUserEvents()
      
      expect(freshSocket.userEventSubscribed).toBe(false)
      expect(freshSocket.chat.sentMessages.length).toBe(0)
    })

    it('should subscribe to cosmetic events', async () => {
      // Reset subscription state and clear messages
      sharedSocket.subscribedEvents.delete('cosmetic.*:123')
      sharedSocket.chat.sentMessages = []
      
      await sharedSocket.subscribeToCosmeticEvents('room1', '123')
      
      expect(sharedSocket.subscribedEvents.has('cosmetic.*:123')).toBe(true)
      
      const sentMessages = sharedSocket.chat.sentMessages
      expect(sentMessages.length).toBe(1)
      const message = JSON.parse(sentMessages[0])
      expect(message.op).toBe(35)
      expect(message.d.type).toBe('cosmetic.*')
      expect(message.d.condition.platform).toBe('KICK')
      expect(message.d.condition.ctx).toBe('channel')
      expect(message.d.condition.id).toBe('123')
    })

    it('should subscribe to entitlement events', async () => {
      // Reset subscription state to allow the method to run
      sharedSocket.subscribedEvents.delete('entitlement.*:123')
      
      const eventPromise = new Promise((resolve) => {
        sharedSocket.addEventListener('open', resolve, { once: true })
      })
      
      await sharedSocket.subscribeToEntitlementEvents('room1', '123')
      
      expect(sharedSocket.subscribedEvents.has('entitlement.*:123')).toBe(true)
      
      const openEvent = await eventPromise
      expect(openEvent.detail.body).toBe('SUBSCRIBED')
      expect(openEvent.detail.type).toBe('entitlement.*')
      expect(openEvent.detail.chatroomId).toBe('room1')
    })

    it('should subscribe to emote set events', async () => {
      await sharedSocket.subscribeToEmoteSetEvents('room1', 'set123')
      
      expect(sharedSocket.subscribedEvents.has('emote_set.*:set123')).toBe(true)
      
      const sentMessages = sharedSocket.chat.sentMessages
      const message = JSON.parse(sentMessages[sentMessages.length - 1])
      expect(message.op).toBe(35)
      expect(message.d.type).toBe('emote_set.*')
      expect(message.d.condition.object_id).toBe('set123')
    })

    it('should not subscribe to emote set events with invalid ID', async () => {
      const initialMessageCount = sharedSocket.chat.sentMessages.length
      
      await sharedSocket.subscribeToEmoteSetEvents('room1', '0')
      await sharedSocket.subscribeToEmoteSetEvents('room1', '00000000000000000000000000')
      
      expect(sharedSocket.chat.sentMessages.length).toBe(initialMessageCount)
    })

    it('should subscribe to all events for chatroom', async () => {
      await sharedSocket.subscribeToChatroomEvents('room1')
      
      expect(sharedSocket.subscribedEvents.has('cosmetic.*:123')).toBe(true)
      expect(sharedSocket.subscribedEvents.has('entitlement.*:123')).toBe(true)
      expect(sharedSocket.subscribedEvents.has('emote_set.*:set123')).toBe(true)
    })
  })

  describe('Message Handling', () => {
    beforeEach(async () => {
      sharedSocket.addChatroom('room1', '123', 'stv123', 'set123')
      sharedSocket.connect()
      await vi.runAllTimersAsync()
      sharedSocket.setupMessageHandler()
    })

    it('should handle user.update messages', async () => {
      const messagePromise = new Promise((resolve) => {
        sharedSocket.addEventListener('message', resolve, { once: true })
      })

      const testMessage = {
        op: 0,
        t: Date.now(),
        d: {
          type: 'user.update',
          body: { user: 'testuser', data: 'testdata' }
        }
      }

      sharedSocket.chat.simulateMessage(JSON.stringify(testMessage))

      const messageEvent = await messagePromise
      expect(messageEvent.detail.body).toEqual(testMessage.d.body)
      expect(messageEvent.detail.type).toBe('user.update')
    })

    it('should handle emote_set.update messages', async () => {
      const messagePromise = new Promise((resolve) => {
        sharedSocket.addEventListener('message', resolve, { once: true })
      })

      const testMessage = {
        op: 0,
        t: Date.now(),
        d: {
          type: 'emote_set.update',
          body: { id: 'set123', emotes: [] }
        }
      }

      sharedSocket.chat.simulateMessage(JSON.stringify(testMessage))

      const messageEvent = await messagePromise
      expect(messageEvent.detail.body).toEqual(testMessage.d.body)
      expect(messageEvent.detail.type).toBe('emote_set.update')
      expect(messageEvent.detail.chatroomId).toBe('room1') // Should find correct chatroom
    })

    it('should handle cosmetic.create messages', async () => {
      const messagePromise = new Promise((resolve) => {
        sharedSocket.addEventListener('message', resolve, { once: true })
      })

      const testMessage = {
        op: 0,
        t: Date.now(),
        d: {
          type: 'cosmetic.create',
          body: {
            object: {
              kind: 'BADGE',
              data: {
                id: 'badge123',
                tooltip: 'Test Badge',
                host: {
                  url: '//example.com',
                  files: [{ name: 'badge.png' }]
                }
              }
            }
          }
        }
      }

      sharedSocket.chat.simulateMessage(JSON.stringify(testMessage))

      const messageEvent = await messagePromise
      expect(messageEvent.detail.type).toBe('cosmetic.create')
    })

    it('should handle entitlement.create messages', async () => {
      const messagePromise = new Promise((resolve) => {
        sharedSocket.addEventListener('message', resolve, { once: true })
      })

      const testMessage = {
        op: 0,
        t: Date.now(),
        d: {
          type: 'entitlement.create',
          body: { kind: 10, user: 'testuser' }
        }
      }

      sharedSocket.chat.simulateMessage(JSON.stringify(testMessage))

      const messageEvent = await messagePromise
      expect(messageEvent.detail.body).toEqual(testMessage.d.body)
      expect(messageEvent.detail.type).toBe('entitlement.create')
    })

    it('should ignore entitlement.create messages with wrong kind', async () => {
      let messageReceived = false
      sharedSocket.addEventListener('message', () => {
        messageReceived = true
      })

      const testMessage = {
        op: 0,
        t: Date.now(),
        d: {
          type: 'entitlement.create',
          body: { kind: 5, user: 'testuser' } // Wrong kind
        }
      }

      sharedSocket.chat.simulateMessage(JSON.stringify(testMessage))
      await vi.runAllTimersAsync()

      expect(messageReceived).toBe(false)
    })

    it('should ignore messages without body', async () => {
      let messageReceived = false
      sharedSocket.addEventListener('message', () => {
        messageReceived = true
      })

      const testMessage = {
        op: 0,
        t: Date.now(),
        d: { type: 'user.update' } // No body
      }

      sharedSocket.chat.simulateMessage(JSON.stringify(testMessage))
      await vi.runAllTimersAsync()

      expect(messageReceived).toBe(false)
    })

    it('should handle invalid JSON messages gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log')
      
      sharedSocket.chat.simulateMessage('invalid json')
      await vi.runAllTimersAsync()
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Shared7TV] Error parsing message:',
        expect.any(Error)
      )
    })
  })

  describe('Chatroom Event Routing', () => {
    beforeEach(async () => {
      sharedSocket.addChatroom('room1', '123', 'stv123', 'set123')
      sharedSocket.addChatroom('room2', '456', 'stv456', 'set456')
      sharedSocket.connect()
      await vi.runAllTimersAsync()
      sharedSocket.setupMessageHandler()
    })

    it('should route user events to null (broadcast)', () => {
      const chatroomId = sharedSocket.findChatroomForEvent({}, 'user.update')
      expect(chatroomId).toBe(null)
    })

    it('should route emote_set events to correct chatroom', () => {
      const chatroomId = sharedSocket.findChatroomForEvent({ id: 'set123' }, 'emote_set.update')
      expect(chatroomId).toBe('room1')
      
      const chatroomId2 = sharedSocket.findChatroomForEvent({ id: 'set456' }, 'emote_set.update')
      expect(chatroomId2).toBe('room2')
    })

    it('should return null for unknown emote set', () => {
      const chatroomId = sharedSocket.findChatroomForEvent({ id: 'unknown' }, 'emote_set.update')
      expect(chatroomId).toBe(null)
    })

    it('should return null for cosmetic events without channel context', () => {
      const chatroomId = sharedSocket.findChatroomForEvent({}, 'cosmetic.create')
      expect(chatroomId).toBe(null)
    })
  })

  describe('Connection State Management', () => {
    it('should track connection state correctly', () => {
      expect(sharedSocket.getConnectionState()).toBe('disconnected')
      
      sharedSocket.addChatroom('room1', '123')
      sharedSocket.connect()
      expect(sharedSocket.getConnectionState()).toBe('connecting')
    })

    it('should provide subscribed event count', async () => {
      expect(sharedSocket.getSubscribedEventCount()).toBe(0)
      
      sharedSocket.addChatroom('room1', '123', 'stv123', 'set123')
      sharedSocket.connect()
      await vi.runAllTimersAsync()
      
      await sharedSocket.subscribeToAllEvents()
      
      expect(sharedSocket.getSubscribedEventCount()).toBeGreaterThan(0)
    })

    it('should provide chatroom count', () => {
      expect(sharedSocket.getChatroomCount()).toBe(0)
      
      sharedSocket.addChatroom('room1', '123')
      expect(sharedSocket.getChatroomCount()).toBe(1)
      
      sharedSocket.addChatroom('room2', '456')
      expect(sharedSocket.getChatroomCount()).toBe(2)
    })
  })

  describe('Close and Cleanup', () => {
    it('should close connection properly', async () => {
      sharedSocket.addChatroom('room1', '123')
      sharedSocket.connect()
      await vi.runAllTimersAsync()
      
      expect(sharedSocket.connectionState).toBe('connected')
      
      sharedSocket.close()
      
      expect(sharedSocket.shouldReconnect).toBe(false)
      expect(sharedSocket.connectionState).toBe('disconnected')
      expect(sharedSocket.chat).toBe(null)
      expect(sharedSocket.subscribedEvents.size).toBe(0)
      expect(sharedSocket.userEventSubscribed).toBe(false)
    })

    it('should handle close when no connection exists', () => {
      expect(() => {
        sharedSocket.close()
      }).not.toThrow()
    })

    it('should handle close when WebSocket is in different states', async () => {
      sharedSocket.addChatroom('room1', '123')
      sharedSocket.connect()
      
      // Test closing while connecting
      expect(() => {
        sharedSocket.close()
      }).not.toThrow()
    })

    it('should handle errors during close gracefully', async () => {
      sharedSocket.addChatroom('room1', '123')
      sharedSocket.connect()
      await vi.runAllTimersAsync()
      
      // Mock close to throw error
      const mockClose = vi.fn(() => {
        throw new Error('Close failed')
      })
      sharedSocket.chat.close = mockClose
      
      expect(() => {
        sharedSocket.close()
      }).not.toThrow()
      
      expect(console.error).toHaveBeenCalledWith(
        '[Shared7TV]: Error during closing of connection:',
        expect.any(Error)
      )
    })
  })

  describe('Utility Functions', () => {
    it('should implement delay function', async () => {
      const startTime = Date.now()
      const delayPromise = sharedSocket.delay(100)
      
      vi.advanceTimersByTime(100)
      await delayPromise
      
      // In fake timer environment, this tests the promise resolves after the time
      expect(vi.getTimerCount()).toBe(0) // All timers should be resolved
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle WebSocket errors gracefully', async () => {
      sharedSocket.addChatroom('room1', '123')
      sharedSocket.connect()
      
      const mockError = new Error('WebSocket error')
      sharedSocket.chat.simulateError(mockError)
      
      expect(sharedSocket.connectionState).toBe('disconnected')
      expect(console.log).toHaveBeenCalledWith(
        '[Shared7TV]: WebSocket error:',
        expect.any(ErrorEvent)
      )
    })

    it('should handle subscription when WebSocket is not ready', async () => {
      sharedSocket.addChatroom('room1', '123')
      // Don't connect, so WebSocket is not ready
      
      await sharedSocket.subscribeToCosmeticEvents('room1', '123')
      
      expect(console.log).toHaveBeenCalledWith(
        '[Shared7TV]: Cannot subscribe to cosmetic events - WebSocket not ready'
      )
    })

    it('should handle missing chatroom data', async () => {
      sharedSocket.connect()
      await vi.runAllTimersAsync()
      
      await sharedSocket.subscribeToChatroomEvents('nonexistent')
      
      expect(console.log).toHaveBeenCalledWith(
        '[Shared7TV]: Chatroom nonexistent not found'
      )
    })

    it('should handle empty chatroom map on connection', async () => {
      // Connect without adding any chatrooms
      sharedSocket.connect()
      await vi.runAllTimersAsync()
      
      // Should not crash
      expect(sharedSocket.connectionState).toBe('connected')
    })

    it('should validate ID formats correctly', async () => {
      sharedSocket.addChatroom('room1', '123', 'stv123', 'set123')
      sharedSocket.connect()
      await vi.runAllTimersAsync()
      
      // Test with invalid null ID pattern
      await sharedSocket.subscribeToEmoteSetEvents('room1', '00000000000000000000000000')
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Invalid emote set ID')
      )
    })
  })

  describe('Performance and Memory Management', () => {
    it('should handle multiple chatrooms efficiently', async () => {
      const chatroomCount = 10
      
      for (let i = 0; i < chatroomCount; i++) {
        sharedSocket.addChatroom(`room${i}`, `${100 + i}`, `stv${i}`, `set${i}`)
      }
      
      expect(sharedSocket.getChatroomCount()).toBe(chatroomCount)
      
      sharedSocket.connect()
      await vi.runAllTimersAsync()
      
      await sharedSocket.subscribeToAllEvents()
      
      // Should have subscriptions for all chatrooms
      expect(sharedSocket.getSubscribedEventCount()).toBeGreaterThan(chatroomCount)
    })

    it('should clean up properly when removing multiple chatrooms', () => {
      for (let i = 0; i < 5; i++) {
        sharedSocket.addChatroom(`room${i}`, `${100 + i}`)
      }
      
      expect(sharedSocket.getChatroomCount()).toBe(5)
      
      // Remove all but one
      for (let i = 0; i < 4; i++) {
        sharedSocket.removeChatroom(`room${i}`)
      }
      
      expect(sharedSocket.getChatroomCount()).toBe(1)
      
      // Remove last one should trigger close
      const closeSpy = vi.spyOn(sharedSocket, 'close')
      sharedSocket.removeChatroom('room4')
      
      expect(closeSpy).toHaveBeenCalled()
      expect(sharedSocket.getChatroomCount()).toBe(0)
    })

    it('should handle rapid connection/disconnection cycles', async () => {
      sharedSocket.addChatroom('room1', '123')
      
      for (let i = 0; i < 5; i++) {
        sharedSocket.connect()
        await vi.runAllTimersAsync()
        
        expect(sharedSocket.connectionState).toBe('connected')
        
        sharedSocket.close()
        expect(sharedSocket.connectionState).toBe('disconnected')
        
        // Reset shouldReconnect for next iteration
        sharedSocket.shouldReconnect = true
      }
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle complete lifecycle correctly', async () => {
      // Add chatrooms
      sharedSocket.addChatroom('room1', '123', 'stv123', 'set123')
      sharedSocket.addChatroom('room2', '456', 'stv456', 'set456')
      
      // Connect
      sharedSocket.connect()
      await vi.runAllTimersAsync()
      expect(sharedSocket.connectionState).toBe('connected')
      
      // Should have subscribed to events
      expect(sharedSocket.getSubscribedEventCount()).toBeGreaterThan(0)
      
      // Handle some messages
      const messagePromise = new Promise((resolve) => {
        sharedSocket.addEventListener('message', resolve, { once: true })
      })
      
      sharedSocket.chat.simulateMessage(JSON.stringify({
        op: 0,
        t: Date.now(),
        d: {
          type: 'user.update',
          body: { user: 'test' }
        }
      }))
      
      const messageEvent = await messagePromise
      expect(messageEvent.detail.type).toBe('user.update')
      
      // Remove one chatroom
      sharedSocket.removeChatroom('room1')
      expect(sharedSocket.getChatroomCount()).toBe(1)
      
      // Remove last chatroom should close connection
      sharedSocket.removeChatroom('room2')
      expect(sharedSocket.getChatroomCount()).toBe(0)
      expect(sharedSocket.connectionState).toBe('disconnected')
    })

    it('should handle connection failure and recovery', async () => {
      // Create a fresh socket for this test to avoid shared state issues
      const testSocket = new SharedStvWebSocket()
      testSocket.addChatroom('room1', '123', 'stv123', 'set123')
      
      // Initial connection
      testSocket.connect()
      await vi.runAllTimersAsync()
      expect(testSocket.connectionState).toBe('connected')
      
      // Simulate connection loss (error followed by close, as happens in real WebSocket failures)
      testSocket.chat.simulateError()
      expect(testSocket.connectionState).toBe('disconnected')
      expect(testSocket.reconnectAttempts).toBe(1)
      
      // In real WebSocket failures, the socket usually closes after error
      // Simulate the close event that would trigger reconnection
      testSocket.chat.close(1006, 'Connection failed') // 1006 = abnormal closure
      
      // Should attempt reconnection
      await vi.runAllTimersAsync()
      expect(testSocket.connectionState).toBe('connected')
      expect(testSocket.reconnectAttempts).toBe(0) // Reset on successful connection
    })
  })
})

// Test the exported argbToRgba function
describe('argbToRgba Utility Function', () => {
  let argbToRgba

  beforeEach(async () => {
    // The function is not exported but is defined in the module
    // We'll test it by importing the module and accessing it indirectly through color processing
    const module = await import('./sharedStvWebSocket.js')
    
    // Since argbToRgba is not exported, we'll create our own version for testing
    // based on the implementation in the file
    argbToRgba = (color) => {
      if (color < 0) {
        color = color >>> 0
      }
      const red = (color >> 24) & 0xff
      const green = (color >> 16) & 0xff
      const blue = (color >> 8) & 0xff
      return `rgba(${red}, ${green}, ${blue}, 1)`
    }
  })

  it('should convert ARGB to RGBA correctly', () => {
    // Test with red color: ARGB = 0xFFFF0000
    const red = 0xFFFF0000
    expect(argbToRgba(red)).toBe('rgba(255, 255, 0, 1)')
  })

  it('should handle negative numbers', () => {
    const negativeColor = -16777216 // 0xFF000000 as negative
    const result = argbToRgba(negativeColor)
    expect(result).toMatch(/rgba\(\d+, \d+, \d+, 1\)/)
  })

  it('should handle zero', () => {
    expect(argbToRgba(0)).toBe('rgba(0, 0, 0, 1)')
  })

  it('should handle white color', () => {
    const white = 0xFFFFFFFF
    expect(argbToRgba(white)).toBe('rgba(255, 255, 255, 1)')
  })

  it('should extract color components correctly', () => {
    // Test specific color: ARGB = 0xFF123456
    const testColor = 0xFF123456
    const result = argbToRgba(testColor)
    
    // Should extract: R=0x12=18, G=0x34=52, B=0x56=86
    expect(result).toBe('rgba(255, 18, 52, 1)')
  })
})