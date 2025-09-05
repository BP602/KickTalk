import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import KickWebSocket from './websocket.js'

// Mock WebSocket globally
const mockWebSocket = vi.fn(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: WebSocket.OPEN,
  CONNECTING: WebSocket.CONNECTING,
  OPEN: WebSocket.OPEN,
  CLOSING: WebSocket.CLOSING,
  CLOSED: WebSocket.CLOSED,
}))

global.WebSocket = mockWebSocket
global.WebSocket.CONNECTING = 0
global.WebSocket.OPEN = 1
global.WebSocket.CLOSING = 2
global.WebSocket.CLOSED = 3

describe('KickWebSocket - Focused Business Logic Tests', () => {
  let websocket
  let mockWSInstance

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    mockWSInstance = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      readyState: WebSocket.OPEN,
    }
    
    mockWebSocket.mockReturnValue(mockWSInstance)
    
    websocket = new KickWebSocket('ws://test.example.com')
  })

  afterEach(() => {
    vi.useRealTimers()
    if (websocket) {
      websocket.disconnect()
    }
  })

  describe('Connection State Management', () => {
    it('should initialize with correct default state', () => {
      expect(websocket.connectionState).toBe('disconnected')
      expect(websocket.reconnectAttempts).toBe(0)
      expect(websocket.shouldReconnect).toBe(true)
      expect(websocket.consecutiveErrors).toBe(0)
    })

    it('should transition to connecting state when connect is called', async () => {
      const connectPromise = websocket.connect()
      
      expect(websocket.connectionState).toBe('connecting')
      
      // Clean up
      await connectPromise.catch(() => {}) // Ignore errors
    })

    it('should not attempt connection when shouldReconnect is false', async () => {
      websocket.shouldReconnect = false
      await websocket.connect()
      
      expect(mockWebSocket).not.toHaveBeenCalled()
      expect(websocket.connectionState).toBe('disconnected')
    })

    it('should not create duplicate connections when already connecting', async () => {
      const promise1 = websocket.connect()
      const promise2 = websocket.connect()
      
      expect(mockWebSocket).toHaveBeenCalledTimes(1)
      
      // Clean up
      await Promise.allSettled([promise1, promise2])
    })

    it('should handle connection state after successful open', () => {
      websocket.handleOpen()
      
      expect(websocket.connectionState).toBe('connected')
      expect(websocket.reconnectAttempts).toBe(0)
      expect(websocket.consecutiveErrors).toBe(0)
      expect(websocket.circuitBreakerOpen).toBe(false)
    })

    it('should handle connection state after close', () => {
      const closeEvent = { code: 1000, reason: 'Normal closure', wasClean: true }
      websocket.handleClose(closeEvent)
      
      expect(websocket.connectionState).toBe('disconnected')
    })
  })

  describe('Circuit Breaker Pattern', () => {
    it('should open circuit breaker after consecutive errors', () => {
      websocket.consecutiveErrors = 2
      websocket.handleConnectionFailure(new Error('Test error'))
      
      expect(websocket.circuitBreakerOpen).toBe(true)
      expect(websocket.circuitBreakerResetTime).toBeGreaterThan(Date.now())
    })

    it('should prevent connections when circuit breaker is open', async () => {
      websocket.circuitBreakerOpen = true
      websocket.circuitBreakerResetTime = Date.now() + 10000
      
      await websocket.connect()
      
      expect(mockWebSocket).not.toHaveBeenCalled()
    })

    it('should allow connections after circuit breaker reset time', async () => {
      websocket.circuitBreakerOpen = true
      websocket.circuitBreakerResetTime = Date.now() - 1000 // Past time
      
      const connectPromise = websocket.connect()
      
      expect(websocket.circuitBreakerOpen).toBe(false)
      expect(mockWebSocket).toHaveBeenCalled()
      
      // Clean up
      await connectPromise.catch(() => {})
    })

    it('should reset circuit breaker on successful connection', () => {
      websocket.circuitBreakerOpen = true
      websocket.consecutiveErrors = 3
      
      websocket.handleOpen()
      
      expect(websocket.circuitBreakerOpen).toBe(false)
      expect(websocket.consecutiveErrors).toBe(0)
    })
  })

  describe('Message Queue Management', () => {
    it('should queue messages when not connected', () => {
      websocket.connectionState = 'disconnected'
      const message = { test: 'message' }
      
      const result = websocket.send(message)
      
      expect(result).toBe(false)
      expect(websocket.messageQueue).toHaveLength(1)
      expect(websocket.messageQueue[0].message).toEqual(message)
    })

    it('should send messages immediately when connected', () => {
      websocket.connectionState = 'connected'
      websocket.websocket = mockWSInstance
      const message = { test: 'message' }
      
      const result = websocket.send(message)
      
      expect(result).toBe(true)
      expect(mockWSInstance.send).toHaveBeenCalledWith(JSON.stringify(message))
      expect(websocket.messageQueue).toHaveLength(0)
    })

    it('should handle string messages without JSON conversion', () => {
      websocket.connectionState = 'connected'
      websocket.websocket = mockWSInstance
      const message = 'plain string message'
      
      const result = websocket.send(message)
      
      expect(result).toBe(true)
      expect(mockWSInstance.send).toHaveBeenCalledWith(message)
    })

    it('should drop messages when queue is full', () => {
      websocket.connectionState = 'disconnected'
      websocket.maxQueueSize = 2
      
      // Fill queue
      websocket.send({ msg: 1 })
      websocket.send({ msg: 2 })
      
      // This should be dropped
      const result = websocket.send({ msg: 3 })
      
      expect(result).toBe(false)
      expect(websocket.messageQueue).toHaveLength(2)
    })

    it('should process queued messages on connection', () => {
      // Queue some messages
      websocket.connectionState = 'disconnected'
      websocket.send({ msg: 1 })
      websocket.send({ msg: 2 })
      
      // Connect and process queue
      websocket.connectionState = 'connected'
      websocket.websocket = mockWSInstance
      websocket.processMessageQueue()
      
      expect(mockWSInstance.send).toHaveBeenCalledTimes(2)
      expect(websocket.messageQueue).toHaveLength(0)
    })

    it('should retry failed messages with retry limit', () => {
      websocket.connectionState = 'connected'
      websocket.websocket = mockWSInstance
      mockWSInstance.send.mockImplementation(() => {
        throw new Error('Send failed')
      })
      
      // Add message to queue with retries
      websocket.messageQueue.push({ 
        message: { test: 'retry' }, 
        timestamp: Date.now(), 
        retries: 2 
      })
      
      websocket.processMessageQueue()
      
      // Should try to send, fail, and re-queue with incremented retry count
      expect(mockWSInstance.send).toHaveBeenCalled()
      expect(websocket.messageQueue).toHaveLength(1)
      expect(websocket.messageQueue[0].retries).toBe(3)
    })

    it('should drop messages after max retry attempts', () => {
      websocket.connectionState = 'connected'
      websocket.websocket = mockWSInstance
      mockWSInstance.send.mockImplementation(() => {
        throw new Error('Send failed')
      })
      
      // Add message that has already reached retry limit
      websocket.messageQueue.push({ 
        message: { test: 'maxed' }, 
        timestamp: Date.now(), 
        retries: 3 
      })
      
      websocket.processMessageQueue()
      
      // Should not re-queue after max retries
      expect(websocket.messageQueue).toHaveLength(0)
    })
  })

  describe('Reconnection Logic', () => {
    it('should schedule reconnection with exponential backoff', () => {
      websocket.reconnectAttempts = 0
      websocket.handleClose({ code: 1006, reason: 'Abnormal closure', wasClean: false })
      
      expect(websocket.reconnectAttempts).toBe(1)
      // Timer should be scheduled
      expect(vi.getTimerCount()).toBeGreaterThan(0)
    })

    it('should calculate correct exponential backoff delay', () => {
      websocket.options.reconnectDelay = 1000
      websocket.options.reconnectMultiplier = 2
      websocket.options.maxReconnectDelay = 10000
      
      // First attempt: 1000ms
      websocket.reconnectAttempts = 1
      websocket.scheduleReconnect()
      let timers = vi.getAllTimers()
      expect(Object.values(timers)[0].delay).toBe(1000)
      
      vi.clearAllTimers()
      
      // Second attempt: 2000ms
      websocket.reconnectAttempts = 2
      websocket.scheduleReconnect()
      timers = vi.getAllTimers()
      expect(Object.values(timers)[0].delay).toBe(2000)
      
      vi.clearAllTimers()
      
      // Third attempt: 4000ms
      websocket.reconnectAttempts = 3
      websocket.scheduleReconnect()
      timers = vi.getAllTimers()
      expect(Object.values(timers)[0].delay).toBe(4000)
    })

    it('should cap reconnection delay at maximum', () => {
      websocket.options.reconnectDelay = 1000
      websocket.options.reconnectMultiplier = 2
      websocket.options.maxReconnectDelay = 5000
      websocket.reconnectAttempts = 10 // Would be 512000ms without cap
      
      websocket.scheduleReconnect()
      const timers = vi.getAllTimers()
      expect(Object.values(timers)[0].delay).toBe(5000)
    })

    it('should stop reconnecting after max attempts', () => {
      websocket.reconnectAttempts = websocket.options.maxReconnectAttempts
      
      const eventSpy = vi.fn()
      websocket.addEventListener('max_reconnects_reached', eventSpy)
      
      websocket.handleClose({ code: 1006, reason: 'Error', wasClean: false })
      
      expect(eventSpy).toHaveBeenCalled()
      expect(vi.getTimerCount()).toBe(0) // No reconnection timer scheduled
    })

    it('should not reconnect when shouldReconnect is false', () => {
      websocket.shouldReconnect = false
      websocket.handleClose({ code: 1000, reason: 'Normal', wasClean: true })
      
      expect(vi.getTimerCount()).toBe(0)
    })

    it('should reset connection state properly', () => {
      websocket.reconnectAttempts = 5
      websocket.consecutiveErrors = 3
      websocket.circuitBreakerOpen = true
      websocket.messageQueue = [{ msg: 'test' }]
      
      websocket.resetConnectionState()
      
      expect(websocket.reconnectAttempts).toBe(0)
      expect(websocket.consecutiveErrors).toBe(0)
      expect(websocket.shouldReconnect).toBe(true)
      expect(websocket.circuitBreakerOpen).toBe(false)
      expect(websocket.messageQueue).toHaveLength(0)
    })
  })

  describe('Heartbeat Mechanism', () => {
    it('should start heartbeat timer on connection', () => {
      websocket.handleOpen()
      
      expect(websocket.heartbeatTimer).not.toBeNull()
      expect(vi.getTimerCount()).toBeGreaterThan(0)
    })

    it('should stop heartbeat timer on disconnection', () => {
      websocket.startHeartbeat()
      expect(websocket.heartbeatTimer).not.toBeNull()
      
      websocket.stopHeartbeat()
      expect(websocket.heartbeatTimer).toBeNull()
    })

    it('should send ping when heartbeat timer fires', () => {
      websocket.connectionState = 'connected'
      websocket.websocket = mockWSInstance
      
      websocket.handleHeartbeat()
      
      expect(mockWSInstance.send).toHaveBeenCalledWith(
        expect.stringContaining('ping')
      )
      expect(websocket.lastPingTime).toBeTruthy()
    })

    it('should not send ping when disconnected', () => {
      websocket.connectionState = 'disconnected'
      websocket.websocket = mockWSInstance
      
      websocket.handleHeartbeat()
      
      expect(mockWSInstance.send).not.toHaveBeenCalled()
    })

    it('should detect heartbeat timeout', () => {
      websocket.connectionState = 'connected'
      websocket.lastPingTime = Date.now() - (websocket.options.heartbeatInterval * 3)
      websocket.lastPongTime = websocket.lastPingTime - 1000
      
      const errorSpy = vi.fn()
      websocket.addEventListener('connection_failure', errorSpy)
      
      websocket.handleHeartbeat()
      
      expect(errorSpy).toHaveBeenCalled()
    })

    it('should handle pong response correctly', () => {
      const pingTime = Date.now() - 100
      websocket.lastPingTime = pingTime
      
      const eventSpy = vi.fn()
      websocket.addEventListener('pong', eventSpy)
      
      websocket.handlePong({ data: { timestamp: pingTime } })
      
      expect(websocket.lastPongTime).toBeGreaterThan(pingTime)
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            latency: expect.any(Number)
          })
        })
      )
    })

    it('should respond to ping with pong', () => {
      websocket.websocket = mockWSInstance
      const pingData = { timestamp: Date.now() }
      
      websocket.handlePing({ data: pingData })
      
      expect(mockWSInstance.send).toHaveBeenCalledWith(
        JSON.stringify({ event: 'pong', data: pingData })
      )
    })
  })

  describe('Channel Subscription Management', () => {
    it('should send proper subscription message', () => {
      websocket.websocket = mockWSInstance
      const channel = 'chatroom.123'
      const auth = 'auth-token'
      
      const result = websocket.subscribe(channel, auth)
      
      expect(result).toBe(true)
      expect(mockWSInstance.send).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'pusher:subscribe',
          data: { auth, channel }
        })
      )
    })

    it('should handle subscription without auth token', () => {
      websocket.websocket = mockWSInstance
      const channel = 'public.channel'
      
      websocket.subscribe(channel)
      
      expect(mockWSInstance.send).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'pusher:subscribe',
          data: { auth: '', channel }
        })
      )
    })

    it('should send proper unsubscription message', () => {
      websocket.websocket = mockWSInstance
      const channel = 'chatroom.123'
      
      const result = websocket.unsubscribe(channel)
      
      expect(result).toBe(true)
      expect(mockWSInstance.send).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'pusher:unsubscribe',
          data: { channel }
        })
      )
    })

    it('should queue subscription when not connected', () => {
      websocket.connectionState = 'disconnected'
      const channel = 'test.channel'
      
      const result = websocket.subscribe(channel)
      
      expect(result).toBe(false)
      expect(websocket.messageQueue).toHaveLength(1)
    })
  })

  describe('Message Parsing and Events', () => {
    it('should parse JSON messages correctly', () => {
      const eventSpy = vi.fn()
      websocket.addEventListener('message', eventSpy)
      
      const messageData = { event: 'test', data: { content: 'hello' } }
      const event = { data: JSON.stringify(messageData) }
      
      websocket.handleMessage(event)
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            data: messageData,
            raw: event.data
          })
        })
      )
    })

    it('should handle ping messages automatically', () => {
      websocket.websocket = mockWSInstance
      const pingEvent = { 
        data: JSON.stringify({ 
          event: 'ping', 
          data: { timestamp: Date.now() } 
        }) 
      }
      
      const eventSpy = vi.fn()
      websocket.addEventListener('message', eventSpy)
      
      websocket.handleMessage(pingEvent)
      
      expect(mockWSInstance.send).toHaveBeenCalledWith(
        expect.stringContaining('pong')
      )
      expect(eventSpy).not.toHaveBeenCalled() // Ping is handled internally
    })

    it('should handle pong messages automatically', () => {
      websocket.lastPingTime = Date.now() - 50
      const pongEvent = { 
        data: JSON.stringify({ 
          event: 'pong', 
          data: { timestamp: websocket.lastPingTime } 
        }) 
      }
      
      const eventSpy = vi.fn()
      websocket.addEventListener('pong', eventSpy)
      
      websocket.handleMessage(pongEvent)
      
      expect(eventSpy).toHaveBeenCalled()
      expect(websocket.lastPongTime).toBeTruthy()
    })

    it('should extract socket ID from connection established message', () => {
      const connectionData = { socket_id: 'socket-123-456' }
      const event = { 
        data: JSON.stringify({
          event: 'pusher:connection_established',
          data: JSON.stringify(connectionData)
        })
      }
      
      websocket.handleMessage(event)
      
      expect(websocket.socketId).toBe('socket-123-456')
    })

    it('should handle malformed JSON messages', () => {
      const eventSpy = vi.fn()
      websocket.addEventListener('parse_error', eventSpy)
      
      const malformedEvent = { data: 'invalid json {' }
      
      websocket.handleMessage(malformedEvent)
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            error: expect.any(Error),
            data: malformedEvent.data
          })
        })
      )
    })
  })

  describe('Connection Health and Status', () => {
    it('should provide accurate connection health status', () => {
      websocket.connectionState = 'connected'
      websocket.websocket = { readyState: WebSocket.OPEN }
      websocket.reconnectAttempts = 2
      websocket.consecutiveErrors = 1
      websocket.messageQueue = [{ msg: 'queued' }]
      websocket.socketId = 'test-socket'
      websocket.connectionStartTime = Date.now() - 5000
      
      const health = websocket.getConnectionHealth()
      
      expect(health.isConnected).toBe(true)
      expect(health.connectionState).toBe('connected')
      expect(health.reconnectAttempts).toBe(2)
      expect(health.consecutiveErrors).toBe(1)
      expect(health.queuedMessages).toBe(1)
      expect(health.socketId).toBe('test-socket')
      expect(health.uptime).toBeGreaterThan(4900)
    })

    it('should report disconnected status correctly', () => {
      websocket.connectionState = 'disconnected'
      websocket.websocket = null
      
      const health = websocket.getConnectionHealth()
      
      expect(health.isConnected).toBe(false)
      expect(health.uptime).toBeNull()
    })

    it('should calculate latency from ping/pong times', () => {
      websocket.lastPingTime = 1000
      websocket.lastPongTime = 1050
      
      const health = websocket.getConnectionHealth()
      
      expect(health.latency).toBe(50)
    })
  })

  describe('Error Handling and Resilience', () => {
    it('should handle send errors gracefully', () => {
      websocket.connectionState = 'connected'
      websocket.websocket = mockWSInstance
      mockWSInstance.send.mockImplementation(() => {
        throw new Error('Network error')
      })
      
      const eventSpy = vi.fn()
      websocket.addEventListener('send_error', eventSpy)
      
      const result = websocket.send({ test: 'message' })
      
      expect(result).toBe(false)
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            error: expect.any(Error)
          })
        })
      )
    })

    it('should increment error counter on errors', () => {
      const initialErrors = websocket.consecutiveErrors
      
      websocket.handleError(new Error('Test error'))
      
      expect(websocket.consecutiveErrors).toBe(initialErrors + 1)
      expect(websocket.lastErrorTime).toBeTruthy()
    })

    it('should open circuit breaker after max consecutive errors', () => {
      websocket.consecutiveErrors = websocket.options.maxConsecutiveErrors - 1
      
      const eventSpy = vi.fn()
      websocket.addEventListener('circuit_breaker_open', eventSpy)
      
      websocket.handleError(new Error('Final error'))
      
      expect(websocket.circuitBreakerOpen).toBe(true)
      expect(eventSpy).toHaveBeenCalled()
    })

    it('should handle connection timeout', async () => {
      websocket.options.connectionTimeout = 100
      
      // Mock WebSocket that never opens
      mockWebSocket.mockImplementation(() => ({
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
        readyState: WebSocket.CONNECTING,
      }))
      
      const connectPromise = websocket.connect()
      
      // Advance timers to trigger timeout
      vi.advanceTimersByTime(200)
      
      await expect(connectPromise).rejects.toThrow('Connection timeout')
    })
  })

  describe('Cleanup and Disconnection', () => {
    it('should clean up all resources on disconnect', () => {
      websocket.connectionTimeout = setTimeout(() => {}, 1000)
      websocket.reconnectTimer = setTimeout(() => {}, 1000)
      websocket.startHeartbeat()
      websocket.websocket = mockWSInstance
      websocket.messageQueue = [{ msg: 'test' }]
      
      websocket.disconnect()
      
      expect(websocket.shouldReconnect).toBe(false)
      expect(websocket.connectionState).toBe('disconnected')
      expect(websocket.websocket).toBeNull()
      expect(websocket.messageQueue).toHaveLength(0)
      expect(websocket.heartbeatTimer).toBeNull()
    })

    it('should close WebSocket with proper code when disconnecting', () => {
      websocket.websocket = mockWSInstance
      mockWSInstance.readyState = WebSocket.OPEN
      
      websocket.disconnect()
      
      expect(mockWSInstance.close).toHaveBeenCalledWith(1000, 'Client disconnect')
    })

    it('should remove all event listeners on cleanup', () => {
      websocket.websocket = mockWSInstance
      websocket.cleanup()
      
      expect(mockWSInstance.removeEventListener).toHaveBeenCalledWith('open', websocket.handleOpen)
      expect(mockWSInstance.removeEventListener).toHaveBeenCalledWith('close', websocket.handleClose)
      expect(mockWSInstance.removeEventListener).toHaveBeenCalledWith('error', websocket.handleError)
      expect(mockWSInstance.removeEventListener).toHaveBeenCalledWith('message', websocket.handleMessage)
    })

    it('should emit disconnected event on cleanup', () => {
      const eventSpy = vi.fn()
      websocket.addEventListener('disconnected', eventSpy)
      
      websocket.disconnect()
      
      expect(eventSpy).toHaveBeenCalled()
    })
  })

  describe('Event Emission and Listening', () => {
    it('should emit events with proper detail data', () => {
      const eventSpy = vi.fn()
      websocket.addEventListener('connecting', eventSpy)
      
      websocket.connect()
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            attempt: 1,
            maxAttempts: websocket.options.maxReconnectAttempts
          })
        })
      )
    })

    it('should emit open event with connection duration', () => {
      const eventSpy = vi.fn()
      websocket.addEventListener('open', eventSpy)
      
      websocket.connectionStartTime = Date.now() - 100
      websocket.handleOpen()
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            connectionDuration: expect.any(Number),
            url: websocket.url
          })
        })
      )
    })

    it('should emit close event with proper details', () => {
      const eventSpy = vi.fn()
      websocket.addEventListener('close', eventSpy)
      
      const closeEvent = { code: 1006, reason: 'Connection lost', wasClean: false }
      websocket.handleClose(closeEvent)
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            code: 1006,
            reason: 'Connection lost',
            wasClean: false
          })
        })
      )
    })
  })
})