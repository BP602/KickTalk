import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import KickPusher from './kickPusher'

// Mock global WebSocket
global.WebSocket = vi.fn()
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}

// Mock window.app
global.window = {
  app: {
    kick: {
      getKickAuthForEvents: vi.fn()
    },
    telemetry: {
      recordWebSocketConnection: vi.fn(),
      recordConnectionError: vi.fn(),
      recordReconnection: vi.fn(),
      recordMessageReceived: vi.fn()
    }
  }
}

describe('KickPusher', () => {
  let mockWebSocket
  let kickPusher
  const chatroomNumber = 12345
  const streamerId = 67890
  const streamerName = 'teststreamer'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Mock WebSocket implementation
    mockWebSocket = {
      readyState: WebSocket.CONNECTING,
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }

    global.WebSocket.mockImplementation(() => mockWebSocket)

    // Mock localStorage data
    global.localStorage.getItem.mockImplementation((key) => {
      if (key === 'kickId') return '123456'
      if (key === 'chatrooms') {
        return JSON.stringify([
          {
            id: chatroomNumber,
            streamerData: {
              livestream: { id: 'livestream123' }
            }
          }
        ])
      }
      return null
    })

    kickPusher = new KickPusher(chatroomNumber, streamerId, streamerName)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Constructor', () => {
    it('should initialize with correct properties', () => {
      expect(kickPusher.chatroomNumber).toBe(chatroomNumber)
      expect(kickPusher.streamerId).toBe(streamerId)
      expect(kickPusher.streamerName).toBe(streamerName)
      expect(kickPusher.shouldReconnect).toBe(true)
      expect(kickPusher.reconnectDelay).toBe(5000)
      expect(kickPusher.socketId).toBeNull()
      expect(kickPusher.chat).toBeNull()
    })

    it('should work without streamer name', () => {
      const pusher = new KickPusher(chatroomNumber, streamerId)
      expect(pusher.streamerName).toBeNull()
    })
  })

  describe('Connection Management', () => {
    describe('connect()', () => {
      it('should not connect when reconnect is disabled', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        kickPusher.shouldReconnect = false

        kickPusher.connect()

        expect(global.WebSocket).not.toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalledWith('Not connecting to chatroom. Disabled reconnect.')
        
        consoleSpy.mockRestore()
      })

      it('should create WebSocket connection with correct URL', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        kickPusher.connect()

        expect(global.WebSocket).toHaveBeenCalledWith(
          'wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false'
        )
        expect(kickPusher.chat).toBe(mockWebSocket)
        expect(consoleSpy).toHaveBeenCalledWith(
          `Connecting to chatroom: ${chatroomNumber} and streamerId: ${streamerId}`
        )
        
        consoleSpy.mockRestore()
      })

      it('should dispatch connection pending event', () => {
        const eventSpy = vi.spyOn(kickPusher, 'dispatchEvent')
        
        kickPusher.connect()

        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'connection',
            detail: {
              type: 'system',
              content: 'connection-pending',
              chatroomNumber: chatroomNumber
            }
          })
        )
      })

      it('should set up event listeners', () => {
        kickPusher.connect()

        expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('open', expect.any(Function))
        expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('error', expect.any(Function))
        expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('close', expect.any(Function))
        expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('message', expect.any(Function))
      })
    })

    describe('WebSocket open event', () => {
      let openHandler

      beforeEach(() => {
        kickPusher.connect()
        openHandler = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'open')[1]
      })

      it('should log connection success and record telemetry', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        mockWebSocket.readyState = WebSocket.OPEN

        await openHandler()

        expect(consoleSpy).toHaveBeenCalledWith(`Connected to Kick.com Streamer Chat: ${chatroomNumber}`)
        expect(window.app.telemetry.recordWebSocketConnection).toHaveBeenCalledWith(
          chatroomNumber,
          streamerId,
          true,
          streamerName
        )

        consoleSpy.mockRestore()
      })

      it('should subscribe to channels after delay', async () => {
        mockWebSocket.readyState = WebSocket.OPEN

        await openHandler()
        vi.advanceTimersByTime(1000)

        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({
            event: 'pusher:subscribe',
            data: { auth: '', channel: `channel_${streamerId}` }
          })
        )
        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({
            event: 'pusher:subscribe',
            data: { auth: '', channel: `chatrooms.${chatroomNumber}.v2` }
          })
        )
      })

      it('should handle telemetry errors gracefully', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        window.app.telemetry.recordWebSocketConnection.mockRejectedValue(new Error('Telemetry error'))

        await openHandler()

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[Telemetry]: Failed to record WebSocket connection:',
          expect.any(Error)
        )

        consoleWarnSpy.mockRestore()
      })

      it('should use fallback streamer name when not provided', async () => {
        const pusher = new KickPusher(chatroomNumber, streamerId) // No streamer name
        pusher.connect()
        const handler = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'open')[1]

        await handler()

        expect(window.app.telemetry.recordWebSocketConnection).toHaveBeenCalledWith(
          chatroomNumber,
          streamerId,
          true,
          `chatroom_${chatroomNumber}`
        )
      })
    })

    describe('WebSocket error event', () => {
      let errorHandler

      beforeEach(() => {
        kickPusher.connect()
        errorHandler = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'error')[1]
      })

      it('should log error and record telemetry', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const eventSpy = vi.spyOn(kickPusher, 'dispatchEvent')
        const mockError = { message: 'WebSocket error' }

        errorHandler(mockError)

        expect(consoleSpy).toHaveBeenCalledWith('Error occurred: WebSocket error')
        expect(window.app.telemetry.recordConnectionError).toHaveBeenCalledWith(
          chatroomNumber,
          'WebSocket error'
        )
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            detail: mockError
          })
        )

        consoleSpy.mockRestore()
      })

      it('should handle telemetry errors gracefully', () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        window.app.telemetry.recordConnectionError.mockImplementation(() => {
          throw new Error('Telemetry error')
        })

        errorHandler({ message: 'Test error' })

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[Telemetry]: Failed to record connection error:',
          expect.any(Error)
        )

        consoleWarnSpy.mockRestore()
      })
    })

    describe('WebSocket close event', () => {
      let closeHandler

      beforeEach(() => {
        kickPusher.connect()
        closeHandler = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'close')[1]
      })

      it('should log closure and record telemetry', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const eventSpy = vi.spyOn(kickPusher, 'dispatchEvent')

        closeHandler()

        expect(consoleSpy).toHaveBeenCalledWith(`Connection closed for chatroom: ${chatroomNumber}`)
        expect(window.app.telemetry.recordWebSocketConnection).toHaveBeenCalledWith(
          chatroomNumber,
          streamerId,
          false,
          streamerName
        )
        expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'close' }))

        consoleSpy.mockRestore()
      })

      it('should attempt reconnect after delay when enabled', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const connectSpy = vi.spyOn(kickPusher, 'connect')

        closeHandler()

        expect(window.app.telemetry.recordReconnection).toHaveBeenCalledWith(
          chatroomNumber,
          'websocket_close'
        )

        vi.advanceTimersByTime(5000)

        expect(consoleSpy).toHaveBeenCalledWith(`Attempting to reconnect to chatroom: ${chatroomNumber}...`)
        expect(connectSpy).toHaveBeenCalledTimes(2) // Initial + reconnect

        consoleSpy.mockRestore()
      })

      it('should not reconnect when disabled', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const connectSpy = vi.spyOn(kickPusher, 'connect')
        kickPusher.shouldReconnect = false

        closeHandler()

        vi.advanceTimersByTime(5000)

        expect(consoleSpy).toHaveBeenCalledWith('Not reconnecting - connection was closed intentionally')
        expect(connectSpy).toHaveBeenCalledTimes(1) // Only initial

        consoleSpy.mockRestore()
      })
    })
  })

  describe('Message Handling', () => {
    let messageHandler

    beforeEach(() => {
      kickPusher.connect()
      messageHandler = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'message')[1]
    })

    it('should handle connection established event', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      window.app.kick.getKickAuthForEvents.mockResolvedValue({ auth: 'auth_token_123' })
      
      const mockEvent = {
        data: JSON.stringify({
          event: 'pusher:connection_established',
          data: JSON.stringify({ socket_id: 'socket_123' })
        })
      }

      await messageHandler(mockEvent)

      expect(kickPusher.socketId).toBe('socket_123')
      expect(consoleSpy).toHaveBeenCalledWith('Connection established: socket ID - socket_123')

      consoleSpy.mockRestore()
    })

    it('should subscribe to user events when user ID is available', async () => {
      window.app.kick.getKickAuthForEvents.mockResolvedValue({ auth: 'auth_token_123' })
      
      const mockEvent = {
        data: JSON.stringify({
          event: 'pusher:connection_established',
          data: JSON.stringify({ socket_id: 'socket_123' })
        })
      }

      await messageHandler(mockEvent)

      expect(window.app.kick.getKickAuthForEvents).toHaveBeenCalledWith(
        'private-userfeed.123456',
        'socket_123'
      )
      expect(window.app.kick.getKickAuthForEvents).toHaveBeenCalledWith(
        'private-channelpoints-123456',
        'socket_123'
      )
    })

    it('should subscribe to livestream events when streamer is live', async () => {
      window.app.kick.getKickAuthForEvents.mockResolvedValue({ auth: 'auth_token_123' })
      
      const mockEvent = {
        data: JSON.stringify({
          event: 'pusher:connection_established',
          data: JSON.stringify({ socket_id: 'socket_123' })
        })
      }

      await messageHandler(mockEvent)

      expect(window.app.kick.getKickAuthForEvents).toHaveBeenCalledWith(
        'private-livestream.livestream123',
        'socket_123'
      )
    })

    it('should skip private subscriptions when no user ID', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      global.localStorage.getItem.mockImplementation((key) => {
        if (key === 'kickId') return null
        return null
      })
      
      const mockEvent = {
        data: JSON.stringify({
          event: 'pusher:connection_established',
          data: JSON.stringify({ socket_id: 'socket_123' })
        })
      }

      await messageHandler(mockEvent)

      expect(consoleSpy).toHaveBeenCalledWith('[KickPusher] No user ID found, skipping private event subscriptions')
      expect(window.app.kick.getKickAuthForEvents).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should handle subscription success event', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const eventSpy = vi.spyOn(kickPusher, 'dispatchEvent')
      
      const mockEvent = {
        data: JSON.stringify({
          channel: `chatrooms.${chatroomNumber}.v2`,
          event: 'pusher_internal:subscription_succeeded'
        })
      }

      await messageHandler(mockEvent)

      expect(consoleSpy).toHaveBeenCalledWith(`Subscription successful for chatroom: ${chatroomNumber}`)
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'connection',
          detail: {
            type: 'system',
            content: 'connection-success',
            chatroomNumber: chatroomNumber
          }
        })
      )

      consoleSpy.mockRestore()
    })

    it('should dispatch chat message events with telemetry', async () => {
      const eventSpy = vi.spyOn(kickPusher, 'dispatchEvent')
      
      const mockMessageData = {
        type: 'regular',
        sender: { id: 'user123' },
        content: 'Hello world'
      }
      
      const mockEvent = {
        data: JSON.stringify({
          event: 'App\\Events\\ChatMessageEvent',
          data: JSON.stringify(mockMessageData)
        })
      }

      await messageHandler(mockEvent)

      expect(window.app.telemetry.recordMessageReceived).toHaveBeenCalledWith(
        chatroomNumber,
        'regular',
        'user123',
        streamerName
      )
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'message',
          detail: expect.objectContaining({
            event: 'App\\Events\\ChatMessageEvent'
          })
        })
      )
    })

    it('should handle channel events', async () => {
      const eventSpy = vi.spyOn(kickPusher, 'dispatchEvent')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      const mockEvent = {
        data: JSON.stringify({
          event: 'App\\Events\\PinnedMessageCreatedEvent',
          data: JSON.stringify({ message: 'Pinned message' })
        })
      }

      await messageHandler(mockEvent)

      expect(consoleSpy).toHaveBeenCalledWith('[KickPusher] Pin created event received before dispatching')
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'channel',
          detail: expect.objectContaining({
            event: 'App\\Events\\PinnedMessageCreatedEvent'
          })
        })
      )

      consoleSpy.mockRestore()
    })

    it('should handle various channel event types', async () => {
      const eventSpy = vi.spyOn(kickPusher, 'dispatchEvent')
      
      const events = [
        'App\\Events\\LivestreamUpdated',
        'App\\Events\\StreamerIsLive',
        'App\\Events\\StopStreamBroadcast',
        'App\\Events\\ChatroomUpdatedEvent',
        'App\\Events\\PollUpdateEvent',
        'App\\Events\\PollDeleteEvent'
      ]

      for (const eventType of events) {
        const mockEvent = {
          data: JSON.stringify({
            event: eventType,
            data: JSON.stringify({ test: 'data' })
          })
        }

        await messageHandler(mockEvent)

        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'channel',
            detail: expect.objectContaining({
              event: eventType
            })
          })
        )
      }
    })

    it('should handle malformed JSON gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const eventSpy = vi.spyOn(kickPusher, 'dispatchEvent')
      
      const mockEvent = {
        data: 'invalid json'
      }

      await messageHandler(mockEvent)

      expect(consoleSpy).toHaveBeenCalledWith('Error in message processing: Unexpected token i in JSON at position 0')
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          detail: expect.any(Error)
        })
      )

      consoleSpy.mockRestore()
    })

    it('should handle message events without body', async () => {
      const mockEvent = {
        data: JSON.stringify({
          event: 'some_event',
          // no data field
        })
      }

      // Should not throw an error
      await expect(messageHandler(mockEvent)).resolves.not.toThrow()
    })

    it('should handle telemetry errors in message handling', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      window.app.telemetry.recordMessageReceived.mockImplementation(() => {
        throw new Error('Telemetry error')
      })
      
      const mockEvent = {
        data: JSON.stringify({
          event: 'App\\Events\\ChatMessageEvent',
          data: JSON.stringify({ sender: { id: 'user123' } })
        })
      }

      await messageHandler(mockEvent)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Telemetry]: Failed to record received message:',
        expect.any(Error)
      )

      consoleWarnSpy.mockRestore()
    })

    it('should handle user and moderation events', async () => {
      const eventSpy = vi.spyOn(kickPusher, 'dispatchEvent')
      
      const events = [
        'App\\Events\\MessageDeletedEvent',
        'App\\Events\\UserBannedEvent',
        'App\\Events\\UserUnbannedEvent'
      ]

      for (const eventType of events) {
        const mockEvent = {
          data: JSON.stringify({
            event: eventType,
            data: JSON.stringify({ user: 'testuser' })
          })
        }

        await messageHandler(mockEvent)

        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'message',
            detail: expect.objectContaining({
              event: eventType
            })
          })
        )
      }
    })
  })

  describe('Connection Closure', () => {
    describe('close()', () => {
      beforeEach(() => {
        kickPusher.connect()
        mockWebSocket.readyState = WebSocket.OPEN
      })

      it('should unsubscribe from all channels before closing', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        kickPusher.close()

        const expectedChannels = [
          `channel_${streamerId}`,
          `channel.${streamerId}`,
          `chatrooms.${chatroomNumber}`,
          `chatrooms.${chatroomNumber}.v2`,
          `chatroom_${chatroomNumber}`
        ]

        expectedChannels.forEach(channel => {
          expect(mockWebSocket.send).toHaveBeenCalledWith(
            JSON.stringify({
              event: 'pusher:unsubscribe',
              data: { channel }
            })
          )
        })

        expect(mockWebSocket.close).toHaveBeenCalled()
        expect(kickPusher.chat).toBeNull()
        expect(kickPusher.shouldReconnect).toBe(false)

        consoleSpy.mockRestore()
      })

      it('should handle closure when WebSocket is in CONNECTING state', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        mockWebSocket.readyState = WebSocket.CONNECTING

        kickPusher.close()

        expect(consoleSpy).toHaveBeenCalledWith('WebSocket state: 0, closing...')
        expect(mockWebSocket.close).toHaveBeenCalled()

        consoleSpy.mockRestore()
      })

      it('should handle closure when no active connection', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        kickPusher.chat = null

        kickPusher.close()

        expect(consoleSpy).toHaveBeenCalledWith(
          `No active connection to close for chatroom ${chatroomNumber}`
        )

        consoleSpy.mockRestore()
      })

      it('should handle errors during closure gracefully', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const mockError = new Error('Close error')
        mockWebSocket.send.mockImplementation(() => {
          throw mockError
        })

        kickPusher.close()

        expect(consoleSpy).toHaveBeenCalledWith(
          `Error during closing of connection for chatroom ${chatroomNumber}:`,
          mockError
        )

        consoleSpy.mockRestore()
      })

      it('should disable reconnect when closing', () => {
        kickPusher.close()
        expect(kickPusher.shouldReconnect).toBe(false)
      })
    })
  })

  describe('Event Subscription Edge Cases', () => {
    let messageHandler

    beforeEach(() => {
      kickPusher.connect()
      messageHandler = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'message')[1]
    })

    it('should handle missing chatroom in localStorage', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      global.localStorage.getItem.mockImplementation((key) => {
        if (key === 'kickId') return '123456'
        if (key === 'chatrooms') return JSON.stringify([])
        return null
      })
      
      const mockEvent = {
        data: JSON.stringify({
          event: 'pusher:connection_established',
          data: JSON.stringify({ socket_id: 'socket_123' })
        })
      }

      await messageHandler(mockEvent)

      expect(consoleSpy).toHaveBeenCalledWith(
        `[KickPusher] Could not find chatroom data for ${chatroomNumber}`
      )

      consoleSpy.mockRestore()
    })

    it('should handle chatroom with null livestream', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      global.localStorage.getItem.mockImplementation((key) => {
        if (key === 'kickId') return '123456'
        if (key === 'chatrooms') {
          return JSON.stringify([
            {
              id: chatroomNumber,
              streamerData: {
                livestream: null
              }
            }
          ])
        }
        return null
      })
      
      const mockEvent = {
        data: JSON.stringify({
          event: 'pusher:connection_established',
          data: JSON.stringify({ socket_id: 'socket_123' })
        })
      }

      await messageHandler(mockEvent)

      expect(consoleSpy).toHaveBeenCalledWith(
        `[KickPusher] Chatroom ${chatroomNumber} is not live, skipping livestream subscription`
      )

      consoleSpy.mockRestore()
    })

    it('should handle auth token errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      window.app.kick.getKickAuthForEvents.mockRejectedValue(new Error('Auth failed'))
      
      const mockEvent = {
        data: JSON.stringify({
          event: 'pusher:connection_established',
          data: JSON.stringify({ socket_id: 'socket_123' })
        })
      }

      await messageHandler(mockEvent)

      expect(consoleSpy).toHaveBeenCalledWith(
        '[KickPusher] Error subscribing to event:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it('should handle auth responses without auth field', async () => {
      window.app.kick.getKickAuthForEvents.mockResolvedValue({}) // No auth field
      
      const mockEvent = {
        data: JSON.stringify({
          event: 'pusher:connection_established',
          data: JSON.stringify({ socket_id: 'socket_123' })
        })
      }

      await messageHandler(mockEvent)

      // Should not send subscription message without auth
      const subscriptionCalls = mockWebSocket.send.mock.calls.filter(call => {
        const data = JSON.parse(call[0])
        return data.event === 'pusher:subscribe' && data.data.channel.startsWith('private-')
      })
      
      expect(subscriptionCalls).toHaveLength(0)
    })
  })

  describe('Rate Limiting and Performance', () => {
    it('should handle rapid connection attempts', () => {
      for (let i = 0; i < 10; i++) {
        kickPusher.connect()
      }
      
      // Should not create multiple WebSocket instances
      expect(global.WebSocket).toHaveBeenCalledTimes(10)
    })

    it('should handle large message volume', async () => {
      kickPusher.connect()
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'message')[1]
      
      // Simulate 100 rapid messages
      const promises = []
      for (let i = 0; i < 100; i++) {
        const mockEvent = {
          data: JSON.stringify({
            event: 'App\\Events\\ChatMessageEvent',
            data: JSON.stringify({ content: `Message ${i}` })
          })
        }
        promises.push(messageHandler(mockEvent))
      }

      await Promise.all(promises)
      
      // All messages should be processed without error
      expect(promises).toHaveLength(100)
    })
  })

  describe('Memory Management', () => {
    it('should clean up event listeners on close', () => {
      kickPusher.connect()
      kickPusher.close()
      
      expect(kickPusher.chat).toBeNull()
    })

    it('should handle multiple open/close cycles', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      for (let i = 0; i < 5; i++) {
        kickPusher.connect()
        kickPusher.close()
      }
      
      expect(kickPusher.shouldReconnect).toBe(false)
      expect(kickPusher.chat).toBeNull()
      
      consoleSpy.mockRestore()
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined window.app gracefully', async () => {
      global.window.app = undefined
      
      kickPusher.connect()
      const openHandler = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'open')[1]
      
      // Should not throw errors
      await expect(openHandler()).resolves.not.toThrow()
    })

    it('should handle malformed localStorage data', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      global.localStorage.getItem.mockImplementation((key) => {
        if (key === 'chatrooms') return 'invalid json'
        return null
      })
      
      kickPusher.connect()
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'message')[1]
      
      const mockEvent = {
        data: JSON.stringify({
          event: 'pusher:connection_established',
          data: JSON.stringify({ socket_id: 'socket_123' })
        })
      }

      // Should handle JSON parse error gracefully
      await expect(messageHandler(mockEvent)).resolves.not.toThrow()
      
      consoleSpy.mockRestore()
    })

    it('should handle empty socket ID', async () => {
      kickPusher.connect()
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'message')[1]
      
      const mockEvent = {
        data: JSON.stringify({
          event: 'pusher:connection_established',
          data: JSON.stringify({ socket_id: '' })
        })
      }

      await messageHandler(mockEvent)
      
      expect(kickPusher.socketId).toBe('')
    })
  })
})