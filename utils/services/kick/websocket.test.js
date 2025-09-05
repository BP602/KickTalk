import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import KickWebSocket from './websocket.js'

// Mock global WebSocket
const createMockWebSocket = () => ({
  readyState: WebSocket.CONNECTING,
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  url: '',
  protocol: '',
  extensions: '',
  bufferedAmount: 0,
  binaryType: 'blob'
})

global.WebSocket = vi.fn()

describe('KickWebSocket', () => {
  let mockWebSocket
  let webSocketService
  let openHandler, closeHandler, errorHandler, messageHandler
  const testUrl = 'wss://test.websocket.com'
  const defaultOptions = {
    reconnectDelay: 1000,
    maxReconnectDelay: 5000,
    reconnectMultiplier: 1.5,
    maxReconnectAttempts: 3,
    connectionTimeout: 5000,
    heartbeatInterval: 10000,
    maxConsecutiveErrors: 2
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    mockWebSocket = createMockWebSocket()
    
    // Mock addEventListener to capture handlers
    mockWebSocket.addEventListener = vi.fn((event, handler) => {
      if (event === 'open') openHandler = handler
      else if (event === 'close') closeHandler = handler
      else if (event === 'error') errorHandler = handler
      else if (event === 'message') messageHandler = handler
    })

    global.WebSocket.mockImplementation(() => mockWebSocket)
    webSocketService = new KickWebSocket(testUrl, defaultOptions)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    webSocketService?.disconnect()
    openHandler = closeHandler = errorHandler = messageHandler = null
  })

  describe('Constructor', () => {
    it('should initialize with correct properties', () => {
      expect(webSocketService.url).toBe(testUrl)
      expect(webSocketService.connectionState).toBe('disconnected')
      expect(webSocketService.shouldReconnect).toBe(true)
      expect(webSocketService.reconnectAttempts).toBe(0)
      expect(webSocketService.consecutiveErrors).toBe(0)
      expect(webSocketService.websocket).toBeNull()
      expect(webSocketService.socketId).toBeNull()
      expect(webSocketService.messageQueue).toEqual([])
    })

    it('should merge default options with provided options', () => {
      const customOptions = {
        reconnectDelay: 2000,
        maxReconnectAttempts: 5
      }
      
      const ws = new KickWebSocket(testUrl, customOptions)
      
      expect(ws.options.reconnectDelay).toBe(2000)
      expect(ws.options.maxReconnectAttempts).toBe(5)
      expect(ws.options.connectionTimeout).toBe(30000) // default
    })

    it('should work with empty options', () => {
      const ws = new KickWebSocket(testUrl)
      
      expect(ws.options.reconnectDelay).toBe(5000) // default
      expect(ws.options.maxReconnectAttempts).toBe(10) // default
    })
  })

  describe('Connection Management', () => {
    describe('connect()', () => {
      it('should not connect when reconnect is disabled', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        webSocketService.shouldReconnect = false

        await webSocketService.connect()

        expect(global.WebSocket).not.toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalledWith('WebSocket connection disabled, not connecting')
        
        consoleSpy.mockRestore()
      })

      it('should not connect when already connecting or connected', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        webSocketService.connectionState = 'connecting'

        await webSocketService.connect()

        expect(global.WebSocket).not.toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalledWith('WebSocket already connecting or connected')
        
        consoleSpy.mockRestore()
      })

      it('should not connect when circuit breaker is open', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        webSocketService.circuitBreakerOpen = true
        webSocketService.circuitBreakerResetTime = Date.now() + 10000

        await webSocketService.connect()

        expect(global.WebSocket).not.toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalledWith('Circuit breaker open, connection blocked')
        
        consoleSpy.mockRestore()
      })

      it('should create WebSocket connection with correct URL', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        const connectPromise = webSocketService.connect()
        
        // Simulate successful connection
        if (openHandler) {
          setTimeout(() => openHandler(), 0)
        }
        vi.runAllTimers()
        await connectPromise

        expect(global.WebSocket).toHaveBeenCalledWith(testUrl)
        expect(webSocketService.websocket).toBe(mockWebSocket)
        expect(consoleSpy).toHaveBeenCalledWith('Connecting to WebSocket (attempt 1/3)')
        
        consoleSpy.mockRestore()
      })

      it('should handle connection timeout', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        
        // Don't trigger open event - let it timeout
        const connectPromise = webSocketService.connect()
        
        // Advance timer past connection timeout
        vi.advanceTimersByTime(defaultOptions.connectionTimeout + 1000)
        
        await connectPromise

        expect(consoleSpy).toHaveBeenCalledWith('Failed to connect to WebSocket:', expect.any(Error))
        
        consoleSpy.mockRestore()
      })

      it('should handle connection errors', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        global.WebSocket.mockImplementation(() => {
          throw new Error('Connection failed')
        })

        await webSocketService.connect()

        expect(consoleSpy).toHaveBeenCalledWith('Failed to connect to WebSocket:', expect.any(Error))
        
        consoleSpy.mockRestore()
      })
    })

    describe('WebSocket Event Handlers', () => {
      beforeEach(async () => {
        // Start connection to set up handlers
        const connectPromise = webSocketService.connect()
        
        // Simulate successful connection
        if (openHandler) {
          setTimeout(() => openHandler(), 0)
        }
        vi.runAllTimers()
        await connectPromise
      })

      describe('open event', () => {
        it('should handle successful connection', () => {
          const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
          const eventSpy = vi.spyOn(webSocketService, 'dispatchEvent')
          webSocketService.connectionStartTime = Date.now() - 1000

          openHandler()

          expect(webSocketService.connectionState).toBe('connected')
          expect(webSocketService.reconnectAttempts).toBe(0)
          expect(webSocketService.consecutiveErrors).toBe(0)
          expect(webSocketService.circuitBreakerOpen).toBe(false)
          
          expect(consoleSpy).toHaveBeenCalledWith('WebSocket connected (1000ms)')
          expect(eventSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'open',
              detail: {
                connectionDuration: 1000,
                url: testUrl
              }
            })
          )

          consoleSpy.mockRestore()
        })

        it('should start heartbeat mechanism', () => {
          const startHeartbeatSpy = vi.spyOn(webSocketService, 'startHeartbeat')

          openHandler()

          expect(startHeartbeatSpy).toHaveBeenCalled()
        })

        it('should process queued messages', () => {
          const processQueueSpy = vi.spyOn(webSocketService, 'processMessageQueue')
          webSocketService.messageQueue = [{ message: { test: 'data' }, timestamp: Date.now(), retries: 0 }]

          openHandler()

          expect(processQueueSpy).toHaveBeenCalled()
        })
      })

      describe('close event', () => {
        it('should handle connection closure', () => {
          const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
          const eventSpy = vi.spyOn(webSocketService, 'dispatchEvent')
          const stopHeartbeatSpy = vi.spyOn(webSocketService, 'stopHeartbeat')
          
          const closeEvent = { code: 1000, reason: 'Normal closure', wasClean: true }
          closeHandler(closeEvent)

          expect(webSocketService.connectionState).toBe('disconnected')
          expect(stopHeartbeatSpy).toHaveBeenCalled()
          
          expect(consoleSpy).toHaveBeenCalledWith('WebSocket closed (code: 1000, reason: Normal closure)')
          expect(eventSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'close',
              detail: {
                code: 1000,
                reason: 'Normal closure',
                wasClean: true
              }
            })
          )

          consoleSpy.mockRestore()
        })

        it('should schedule reconnect when should reconnect is true', () => {
          const scheduleReconnectSpy = vi.spyOn(webSocketService, 'scheduleReconnect')
          
          const closeEvent = { code: 1006, reason: '', wasClean: false }
          closeHandler(closeEvent)

          expect(scheduleReconnectSpy).toHaveBeenCalled()
        })

        it('should not schedule reconnect when disabled', () => {
          const scheduleReconnectSpy = vi.spyOn(webSocketService, 'scheduleReconnect')
          webSocketService.shouldReconnect = false
          
          const closeEvent = { code: 1000, reason: 'Manual close', wasClean: true }
          closeHandler(closeEvent)

          expect(scheduleReconnectSpy).not.toHaveBeenCalled()
        })

        it('should dispatch max reconnects event when limit reached', () => {
          const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
          const eventSpy = vi.spyOn(webSocketService, 'dispatchEvent')
          webSocketService.reconnectAttempts = defaultOptions.maxReconnectAttempts
          
          const closeEvent = { code: 1006, reason: '', wasClean: false }
          closeHandler(closeEvent)

          expect(consoleSpy).toHaveBeenCalledWith('Max reconnection attempts reached')
          expect(eventSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'max_reconnects_reached',
              detail: { attempts: defaultOptions.maxReconnectAttempts }
            })
          )

          consoleSpy.mockRestore()
        })
      })

      describe('error event', () => {
        it('should handle WebSocket error', () => {
          const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
          const eventSpy = vi.spyOn(webSocketService, 'dispatchEvent')
          const mockError = new Error('Connection error')

          errorHandler(mockError)

          expect(webSocketService.consecutiveErrors).toBe(1)
          expect(webSocketService.lastErrorTime).toBeDefined()
          
          expect(consoleSpy).toHaveBeenCalledWith('WebSocket error (consecutive: 1):', mockError)
          expect(eventSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'error',
              detail: {
                error: mockError,
                consecutiveErrors: 1,
                timestamp: webSocketService.lastErrorTime
              }
            })
          )

          consoleSpy.mockRestore()
        })

        it('should open circuit breaker after max consecutive errors', () => {
          const openCircuitBreakerSpy = vi.spyOn(webSocketService, 'openCircuitBreaker')
          const mockError = new Error('Connection error')

          // Trigger enough errors to exceed threshold
          for (let i = 0; i < defaultOptions.maxConsecutiveErrors; i++) {
            errorHandler(mockError)
          }

          expect(openCircuitBreakerSpy).toHaveBeenCalled()
        })
      })

      describe('message event', () => {
        it('should handle valid JSON messages', () => {
          const eventSpy = vi.spyOn(webSocketService, 'dispatchEvent')
          const testData = { event: 'test_event', data: 'test_data' }
          const mockEvent = { data: JSON.stringify(testData) }

          messageHandler(mockEvent)

          expect(eventSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'message',
              detail: {
                data: testData,
                raw: mockEvent.data,
                timestamp: expect.any(Number)
              }
            })
          )
        })

        it('should handle connection established event', () => {
          const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
          const testData = {
            event: 'pusher:connection_established',
            data: JSON.stringify({ socket_id: 'test_socket_123' })
          }
          const mockEvent = { data: JSON.stringify(testData) }

          messageHandler(mockEvent)

          expect(webSocketService.socketId).toBe('test_socket_123')
          expect(consoleSpy).toHaveBeenCalledWith('Connection established: socket ID - test_socket_123')

          consoleSpy.mockRestore()
        })

        it('should handle ping messages', () => {
          const handlePingSpy = vi.spyOn(webSocketService, 'handlePing')
          const testData = { event: 'ping', data: { timestamp: Date.now() } }
          const mockEvent = { data: JSON.stringify(testData) }

          messageHandler(mockEvent)

          expect(handlePingSpy).toHaveBeenCalledWith(testData)
        })

        it('should handle pong messages', () => {
          const handlePongSpy = vi.spyOn(webSocketService, 'handlePong')
          const testData = { event: 'pong', data: { timestamp: Date.now() } }
          const mockEvent = { data: JSON.stringify(testData) }

          messageHandler(mockEvent)

          expect(handlePongSpy).toHaveBeenCalledWith(testData)
        })

        it('should handle invalid JSON gracefully', () => {
          const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
          const eventSpy = vi.spyOn(webSocketService, 'dispatchEvent')
          const mockEvent = { data: 'invalid json' }

          messageHandler(mockEvent)

          expect(consoleSpy).toHaveBeenCalledWith('Error parsing WebSocket message:', expect.any(Error))
          expect(eventSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'parse_error',
              detail: {
                error: expect.any(Error),
                data: 'invalid json'
              }
            })
          )

          consoleSpy.mockRestore()
        })
      })
    })
  })

  describe('Message Sending', () => {
    beforeEach(() => {
      webSocketService.websocket = mockWebSocket
      mockWebSocket.readyState = WebSocket.OPEN
      webSocketService.connectionState = 'connected'
    })

    describe('send()', () => {
      it('should send string message when connected', () => {
        const message = 'test message'
        const result = webSocketService.send(message)

        expect(result).toBe(true)
        expect(mockWebSocket.send).toHaveBeenCalledWith(message)
      })

      it('should stringify object messages', () => {
        const message = { event: 'test', data: 'test_data' }
        const result = webSocketService.send(message)

        expect(result).toBe(true)
        expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message))
      })

      it('should queue messages when not connected', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        webSocketService.connectionState = 'disconnected'
        webSocketService.websocket = null
        const message = { event: 'test' }

        const result = webSocketService.send(message)

        expect(result).toBe(false)
        expect(webSocketService.messageQueue).toHaveLength(1)
        expect(webSocketService.messageQueue[0]).toEqual({
          message,
          timestamp: expect.any(Number),
          retries: 0
        })
        expect(consoleSpy).toHaveBeenCalledWith('Message queued (WebSocket not connected)')

        consoleSpy.mockRestore()
      })

      it('should drop messages when queue is full', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        webSocketService.connectionState = 'disconnected'
        webSocketService.websocket = null
        webSocketService.maxQueueSize = 2
        
        // Fill queue
        webSocketService.messageQueue = [
          { message: 'msg1', timestamp: Date.now(), retries: 0 },
          { message: 'msg2', timestamp: Date.now(), retries: 0 }
        ]

        const result = webSocketService.send({ event: 'test' })

        expect(result).toBe(false)
        expect(webSocketService.messageQueue).toHaveLength(2)
        expect(consoleSpy).toHaveBeenCalledWith('Message queue full, dropping message')

        consoleSpy.mockRestore()
      })

      it('should handle send errors', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const eventSpy = vi.spyOn(webSocketService, 'dispatchEvent')
        const sendError = new Error('Send failed')
        mockWebSocket.send.mockImplementation(() => {
          throw sendError
        })

        const message = { event: 'test' }
        const result = webSocketService.send(message)

        expect(result).toBe(false)
        expect(consoleSpy).toHaveBeenCalledWith('Error sending WebSocket message:', sendError)
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'send_error',
            detail: { error: sendError, message }
          })
        )

        consoleSpy.mockRestore()
      })
    })

    describe('subscribe()', () => {
      it('should send subscription message', () => {
        const channel = 'test-channel'
        const auth = 'auth-token'

        const result = webSocketService.subscribe(channel, auth)

        expect(result).toBe(true)
        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({
            event: 'pusher:subscribe',
            data: { auth, channel }
          })
        )
      })

      it('should subscribe without auth', () => {
        const channel = 'test-channel'

        const result = webSocketService.subscribe(channel)

        expect(result).toBe(true)
        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({
            event: 'pusher:subscribe',
            data: { auth: '', channel }
          })
        )
      })
    })

    describe('unsubscribe()', () => {
      it('should send unsubscription message', () => {
        const channel = 'test-channel'

        const result = webSocketService.unsubscribe(channel)

        expect(result).toBe(true)
        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({
            event: 'pusher:unsubscribe',
            data: { channel }
          })
        )
      })
    })

    describe('processMessageQueue()', () => {
      it('should process queued messages successfully', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const messages = [
          { message: { event: 'test1' }, timestamp: Date.now(), retries: 0 },
          { message: { event: 'test2' }, timestamp: Date.now(), retries: 0 }
        ]
        webSocketService.messageQueue = messages

        webSocketService.processMessageQueue()

        expect(consoleSpy).toHaveBeenCalledWith('Processing 2 queued messages')
        expect(mockWebSocket.send).toHaveBeenCalledTimes(2)
        expect(webSocketService.messageQueue).toHaveLength(0)

        consoleSpy.mockRestore()
      })

      it('should re-queue failed messages with retry count', () => {
        mockWebSocket.send.mockImplementation(() => {
          throw new Error('Send failed')
        })
        
        const messages = [
          { message: { event: 'test1' }, timestamp: Date.now(), retries: 0 }
        ]
        webSocketService.messageQueue = messages

        webSocketService.processMessageQueue()

        expect(webSocketService.messageQueue).toHaveLength(1)
        expect(webSocketService.messageQueue[0].retries).toBe(1)
      })

      it('should drop messages after max retries', () => {
        mockWebSocket.send.mockImplementation(() => {
          throw new Error('Send failed')
        })
        
        const messages = [
          { message: { event: 'test1' }, timestamp: Date.now(), retries: 3 }
        ]
        webSocketService.messageQueue = messages

        webSocketService.processMessageQueue()

        expect(webSocketService.messageQueue).toHaveLength(0)
      })

      it('should handle empty queue gracefully', () => {
        webSocketService.messageQueue = []

        webSocketService.processMessageQueue()

        expect(mockWebSocket.send).not.toHaveBeenCalled()
      })
    })
  })

  describe('Heartbeat Mechanism', () => {
    describe('startHeartbeat()', () => {
      it('should start heartbeat timer', () => {
        webSocketService.startHeartbeat()

        expect(webSocketService.heartbeatTimer).toBeDefined()
      })

      it('should clear existing timer before starting new one', () => {
        const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
        webSocketService.heartbeatTimer = 123

        webSocketService.startHeartbeat()

        expect(clearIntervalSpy).toHaveBeenCalledWith(123)
      })
    })

    describe('stopHeartbeat()', () => {
      it('should clear heartbeat timer', () => {
        const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
        webSocketService.heartbeatTimer = 123

        webSocketService.stopHeartbeat()

        expect(clearIntervalSpy).toHaveBeenCalledWith(123)
        expect(webSocketService.heartbeatTimer).toBeNull()
      })

      it('should handle no timer gracefully', () => {
        webSocketService.heartbeatTimer = null

        webSocketService.stopHeartbeat()

        expect(webSocketService.heartbeatTimer).toBeNull()
      })
    })

    describe('handleHeartbeat()', () => {
      beforeEach(() => {
        webSocketService.websocket = mockWebSocket
        mockWebSocket.readyState = WebSocket.OPEN
        webSocketService.connectionState = 'connected'
      })

      it('should send ping when connected', () => {
        webSocketService.handleHeartbeat()

        expect(webSocketService.lastPingTime).toBeDefined()
        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({
            event: 'ping',
            data: { timestamp: expect.any(Number) }
          })
        )
      })

      it('should not send ping when disconnected', () => {
        webSocketService.connectionState = 'disconnected'

        webSocketService.handleHeartbeat()

        expect(mockWebSocket.send).not.toHaveBeenCalled()
      })

      it('should detect heartbeat timeout', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const handleFailureSpy = vi.spyOn(webSocketService, 'handleConnectionFailure')
        
        webSocketService.lastPingTime = Date.now() - (defaultOptions.heartbeatInterval * 3)
        webSocketService.lastPongTime = Date.now() - (defaultOptions.heartbeatInterval * 4)

        webSocketService.handleHeartbeat()

        expect(consoleSpy).toHaveBeenCalledWith('Heartbeat timeout, connection may be stale')
        expect(handleFailureSpy).toHaveBeenCalledWith(expect.any(Error))

        consoleSpy.mockRestore()
      })
    })

    describe('handlePing()', () => {
      beforeEach(() => {
        webSocketService.websocket = mockWebSocket
        mockWebSocket.readyState = WebSocket.OPEN
        webSocketService.connectionState = 'connected'
      })

      it('should respond with pong', () => {
        const pingData = { event: 'ping', data: { timestamp: 12345 } }

        webSocketService.handlePing(pingData)

        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({
            event: 'pong',
            data: { timestamp: 12345 }
          })
        )
      })
    })

    describe('handlePong()', () => {
      it('should update pong time and calculate latency', () => {
        const eventSpy = vi.spyOn(webSocketService, 'dispatchEvent')
        const timestamp = Date.now() - 100
        webSocketService.lastPingTime = timestamp
        const pongData = { event: 'pong', data: { timestamp } }

        webSocketService.handlePong(pongData)

        expect(webSocketService.lastPongTime).toBeDefined()
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'pong',
            detail: {
              latency: expect.any(Number),
              timestamp: webSocketService.lastPongTime
            }
          })
        )
      })
    })
  })

  describe('Reconnection Logic', () => {
    describe('scheduleReconnect()', () => {
      it('should schedule reconnection with exponential backoff', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const connectSpy = vi.spyOn(webSocketService, 'connect').mockResolvedValue()

        webSocketService.scheduleReconnect()

        expect(webSocketService.reconnectAttempts).toBe(1)
        
        const expectedDelay = Math.min(
          defaultOptions.reconnectDelay * Math.pow(defaultOptions.reconnectMultiplier, 0),
          defaultOptions.maxReconnectDelay
        )
        
        expect(consoleSpy).toHaveBeenCalledWith(`Scheduling reconnect in ${expectedDelay}ms (attempt 1/3)`)

        consoleSpy.mockRestore()
      })

      it('should clear existing reconnect timer', () => {
        const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
        webSocketService.reconnectTimer = 123

        webSocketService.scheduleReconnect()

        expect(clearTimeoutSpy).toHaveBeenCalledWith(123)
      })

      it('should dispatch reconnecting event', () => {
        const eventSpy = vi.spyOn(webSocketService, 'dispatchEvent')
        const connectSpy = vi.spyOn(webSocketService, 'connect').mockResolvedValue()

        webSocketService.scheduleReconnect()
        vi.advanceTimersByTime(defaultOptions.reconnectDelay)

        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'reconnecting',
            detail: {
              attempt: 1,
              delay: defaultOptions.reconnectDelay
            }
          })
        )
      })

      it('should respect maximum reconnect delay', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        webSocketService.reconnectAttempts = 10 // High number to trigger max delay

        webSocketService.scheduleReconnect()

        const expectedDelay = defaultOptions.maxReconnectDelay
        expect(consoleSpy).toHaveBeenCalledWith(`Scheduling reconnect in ${expectedDelay}ms (attempt 11/3)`)

        consoleSpy.mockRestore()
      })
    })

    describe('handleConnectionFailure()', () => {
      it('should log error and dispatch event', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const eventSpy = vi.spyOn(webSocketService, 'dispatchEvent')
        const error = new Error('Connection failed')

        webSocketService.handleConnectionFailure(error)

        expect(webSocketService.connectionState).toBe('disconnected')
        expect(consoleSpy).toHaveBeenCalledWith('Connection failure:', 'Connection failed')
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'connection_failure',
            detail: {
              error,
              consecutiveErrors: webSocketService.consecutiveErrors,
              reconnectAttempts: webSocketService.reconnectAttempts
            }
          })
        )

        consoleSpy.mockRestore()
      })

      it('should trigger circuit breaker on max errors', () => {
        const openCircuitBreakerSpy = vi.spyOn(webSocketService, 'openCircuitBreaker')
        webSocketService.consecutiveErrors = defaultOptions.maxConsecutiveErrors
        const error = new Error('Connection failed')

        webSocketService.handleConnectionFailure(error)

        expect(openCircuitBreakerSpy).toHaveBeenCalled()
      })
    })

    describe('openCircuitBreaker()', () => {
      it('should open circuit breaker and set reset time', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const eventSpy = vi.spyOn(webSocketService, 'dispatchEvent')

        webSocketService.openCircuitBreaker()

        expect(webSocketService.circuitBreakerOpen).toBe(true)
        expect(webSocketService.circuitBreakerResetTime).toBeGreaterThan(Date.now())
        expect(consoleSpy).toHaveBeenCalledWith(
          'Circuit breaker opened, blocking connections for',
          expect.any(Number),
          'ms'
        )
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'circuit_breaker_open',
            detail: {
              resetTime: webSocketService.circuitBreakerResetTime,
              consecutiveErrors: webSocketService.consecutiveErrors
            }
          })
        )

        consoleSpy.mockRestore()
      })
    })
  })

  describe('Connection Health and State Management', () => {
    describe('getConnectionHealth()', () => {
      it('should return comprehensive health status when connected', () => {
        webSocketService.websocket = mockWebSocket
        mockWebSocket.readyState = WebSocket.OPEN
        webSocketService.connectionState = 'connected'
        webSocketService.socketId = 'test_socket'
        webSocketService.reconnectAttempts = 1
        webSocketService.consecutiveErrors = 0
        webSocketService.lastErrorTime = Date.now() - 1000
        webSocketService.lastPingTime = Date.now() - 50
        webSocketService.lastPongTime = Date.now()
        webSocketService.messageQueue = [{ message: 'test' }]

        const health = webSocketService.getConnectionHealth()

        expect(health).toEqual({
          isConnected: true,
          connectionState: 'connected',
          reconnectAttempts: 1,
          consecutiveErrors: 0,
          shouldReconnect: true,
          circuitBreakerOpen: false,
          lastErrorTime: expect.any(Number),
          connectionStartTime: expect.any(Number),
          queuedMessages: 1,
          socketId: 'test_socket',
          latency: expect.any(Number),
          uptime: expect.any(Number)
        })
      })

      it('should return correct status when disconnected', () => {
        const health = webSocketService.getConnectionHealth()

        expect(health).toEqual({
          isConnected: false,
          connectionState: 'disconnected',
          reconnectAttempts: 0,
          consecutiveErrors: 0,
          shouldReconnect: true,
          circuitBreakerOpen: false,
          lastErrorTime: null,
          connectionStartTime: null,
          queuedMessages: 0,
          socketId: null,
          latency: null,
          uptime: null
        })
      })
    })

    describe('resetConnectionState()', () => {
      it('should reset all connection-related properties', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const eventSpy = vi.spyOn(webSocketService, 'dispatchEvent')
        
        // Set some state
        webSocketService.reconnectAttempts = 5
        webSocketService.consecutiveErrors = 3
        webSocketService.shouldReconnect = false
        webSocketService.circuitBreakerOpen = true
        webSocketService.circuitBreakerResetTime = Date.now() + 1000
        webSocketService.messageQueue = [{ message: 'test' }]

        webSocketService.resetConnectionState()

        expect(webSocketService.reconnectAttempts).toBe(0)
        expect(webSocketService.consecutiveErrors).toBe(0)
        expect(webSocketService.shouldReconnect).toBe(true)
        expect(webSocketService.circuitBreakerOpen).toBe(false)
        expect(webSocketService.circuitBreakerResetTime).toBeNull()
        expect(webSocketService.messageQueue).toEqual([])
        
        expect(consoleSpy).toHaveBeenCalledWith('Connection state reset')
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'state_reset'
          })
        )

        consoleSpy.mockRestore()
      })
    })
  })

  describe('Cleanup and Disconnect', () => {
    describe('cleanup()', () => {
      it('should clear all timers and remove event listeners', () => {
        const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
        const stopHeartbeatSpy = vi.spyOn(webSocketService, 'stopHeartbeat')
        
        webSocketService.connectionTimeout = 123
        webSocketService.reconnectTimer = 456
        webSocketService.websocket = mockWebSocket

        webSocketService.cleanup()

        expect(clearTimeoutSpy).toHaveBeenCalledWith(123)
        expect(clearTimeoutSpy).toHaveBeenCalledWith(456)
        expect(stopHeartbeatSpy).toHaveBeenCalled()
        expect(mockWebSocket.removeEventListener).toHaveBeenCalledTimes(4)
      })

      it('should handle cleanup when no websocket exists', () => {
        webSocketService.websocket = null

        expect(() => webSocketService.cleanup()).not.toThrow()
      })
    })

    describe('disconnect()', () => {
      it('should properly disconnect and clean up', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const eventSpy = vi.spyOn(webSocketService, 'dispatchEvent')
        const cleanupSpy = vi.spyOn(webSocketService, 'cleanup')
        
        webSocketService.websocket = mockWebSocket
        mockWebSocket.readyState = WebSocket.OPEN
        webSocketService.messageQueue = [{ message: 'test' }]

        webSocketService.disconnect()

        expect(webSocketService.shouldReconnect).toBe(false)
        expect(webSocketService.connectionState).toBe('disconnected')
        expect(webSocketService.websocket).toBeNull()
        expect(webSocketService.messageQueue).toEqual([])
        
        expect(consoleSpy).toHaveBeenCalledWith('Disconnecting WebSocket')
        expect(cleanupSpy).toHaveBeenCalled()
        expect(mockWebSocket.close).toHaveBeenCalledWith(1000, 'Client disconnect')
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'disconnected'
          })
        )

        consoleSpy.mockRestore()
      })

      it('should handle disconnect when websocket is not open', () => {
        webSocketService.websocket = mockWebSocket
        mockWebSocket.readyState = WebSocket.CLOSED

        webSocketService.disconnect()

        expect(mockWebSocket.close).not.toHaveBeenCalled()
      })

      it('should handle disconnect when no websocket exists', () => {
        webSocketService.websocket = null

        expect(() => webSocketService.disconnect()).not.toThrow()
      })
    })
  })

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle rapid connect/disconnect cycles', async () => {
      for (let i = 0; i < 5; i++) {
        const connectPromise = webSocketService.connect()
        if (openHandler) {
          setTimeout(() => openHandler(), 0)
        }
        vi.runAllTimers()
        await connectPromise
        webSocketService.disconnect()
      }

      expect(webSocketService.connectionState).toBe('disconnected')
      expect(webSocketService.websocket).toBeNull()
    })

    it('should handle multiple error events in succession', () => {
      const mockError = new Error('Connection error')

      for (let i = 0; i < 5; i++) {
        if (errorHandler) {
          errorHandler(mockError)
        }
      }

      expect(webSocketService.consecutiveErrors).toBe(5)
      expect(webSocketService.circuitBreakerOpen).toBe(true)
    })

    it('should handle message overflow scenarios', () => {
      webSocketService.websocket = mockWebSocket
      mockWebSocket.readyState = WebSocket.OPEN
      webSocketService.connectionState = 'connected'

      // Simulate processing many messages rapidly
      for (let i = 0; i < 1000; i++) {
        const mockEvent = {
          data: JSON.stringify({ event: `test_event_${i}`, data: `data_${i}` })
        }
        if (messageHandler) {
          messageHandler(mockEvent)
        }
      }

      // Should not crash or cause memory issues
      expect(webSocketService.connectionState).toBe('connected')
    })

    it('should handle undefined or null message data', () => {
      // Test various edge case inputs
      const edgeCases = [
        { data: null },
        { data: undefined },
        { data: '' },
        { data: '{}' },
        { data: '[]' }
      ]

      edgeCases.forEach(testCase => {
        if (messageHandler) {
          expect(() => messageHandler(testCase)).not.toThrow()
        }
      })
    })

    it('should handle WebSocket state inconsistencies', () => {
      webSocketService.websocket = mockWebSocket
      webSocketService.connectionState = 'connected'
      mockWebSocket.readyState = WebSocket.CLOSED

      const health = webSocketService.getConnectionHealth()
      expect(health.isConnected).toBe(false)
    })

    it('should handle timer cleanup edge cases', () => {
      webSocketService.connectionTimeout = null
      webSocketService.reconnectTimer = null
      webSocketService.heartbeatTimer = null

      expect(() => webSocketService.cleanup()).not.toThrow()
    })

    it('should handle message queue edge cases', () => {
      webSocketService.messageQueue = []
      webSocketService.processMessageQueue()

      expect(webSocketService.messageQueue).toEqual([])
    })
  })

  describe('Performance and Memory Management', () => {
    it('should limit message queue size', () => {
      webSocketService.connectionState = 'disconnected'
      webSocketService.maxQueueSize = 3

      // Try to queue more messages than allowed
      for (let i = 0; i < 5; i++) {
        webSocketService.send({ event: `test_${i}` })
      }

      expect(webSocketService.messageQueue.length).toBeLessThanOrEqual(3)
    })

    it('should clean up event listeners on disconnect', () => {
      webSocketService.websocket = mockWebSocket

      webSocketService.disconnect()

      expect(mockWebSocket.removeEventListener).toHaveBeenCalledWith('open', expect.any(Function))
      expect(mockWebSocket.removeEventListener).toHaveBeenCalledWith('close', expect.any(Function))
      expect(mockWebSocket.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function))
      expect(mockWebSocket.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function))
    })

    it('should handle concurrent connection attempts', async () => {
      // Start multiple connection attempts simultaneously
      const promises = []
      for (let i = 0; i < 3; i++) {
        promises.push(webSocketService.connect())
      }

      // Simulate successful connection for all attempts
      if (openHandler) {
        setTimeout(() => openHandler(), 0)
      }
      vi.runAllTimers()

      await Promise.all(promises)

      // Should only create one WebSocket instance due to connection state checks
      expect(global.WebSocket).toHaveBeenCalledTimes(1)
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle complete connection lifecycle', async () => {
      const eventSpy = vi.spyOn(webSocketService, 'dispatchEvent')

      // Connect
      const connectPromise = webSocketService.connect()
      if (openHandler) {
        setTimeout(() => openHandler(), 0)
      }
      vi.runAllTimers()
      await connectPromise

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'connecting' }))
      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'open' }))

      // Send messages
      mockWebSocket.readyState = WebSocket.OPEN
      webSocketService.connectionState = 'connected'
      
      expect(webSocketService.send({ event: 'test' })).toBe(true)
      expect(webSocketService.subscribe('test-channel')).toBe(true)

      // Simulate disconnection
      if (closeHandler) {
        closeHandler({ code: 1000, reason: 'Normal close', wasClean: true })
      }
      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'close' }))

      // Disconnect manually
      webSocketService.disconnect()
      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'disconnected' }))
    })

    it('should handle reconnection with queued messages', async () => {
      // Connect initially
      const connectPromise = webSocketService.connect()
      if (openHandler) {
        setTimeout(() => openHandler(), 0)
      }
      vi.runAllTimers()
      await connectPromise
      
      // Queue messages while disconnected
      webSocketService.connectionState = 'disconnected'
      webSocketService.send({ event: 'queued1' })
      webSocketService.send({ event: 'queued2' })

      expect(webSocketService.messageQueue).toHaveLength(2)

      // Reconnect and process queue
      webSocketService.connectionState = 'connected'
      mockWebSocket.readyState = WebSocket.OPEN
      if (openHandler) {
        openHandler()
      }

      // Messages should be processed
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify({ event: 'queued1' }))
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify({ event: 'queued2' }))
      expect(webSocketService.messageQueue).toHaveLength(0)
    })

    it('should handle heartbeat timeout and recovery', () => {
      webSocketService.websocket = mockWebSocket
      mockWebSocket.readyState = WebSocket.OPEN
      webSocketService.connectionState = 'connected'

      // Start heartbeat
      webSocketService.startHeartbeat()

      // Simulate missed pong responses
      webSocketService.lastPingTime = Date.now() - (defaultOptions.heartbeatInterval * 3)
      webSocketService.lastPongTime = Date.now() - (defaultOptions.heartbeatInterval * 4)

      const handleFailureSpy = vi.spyOn(webSocketService, 'handleConnectionFailure')

      // Trigger heartbeat check
      webSocketService.handleHeartbeat()

      expect(handleFailureSpy).toHaveBeenCalledWith(expect.any(Error))
    })
  })
})