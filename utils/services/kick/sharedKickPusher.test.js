import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import SharedKickPusher from './sharedKickPusher.js'

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
    }
  }
}

describe('SharedKickPusher', () => {
  let mockWebSocket
  let sharedPusher
  const chatroomId = '12345'
  const streamerId = '67890'
  const chatroomData = {
    streamerData: {
      livestream: { id: 'livestream123' }
    }
  }

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
      return null
    })

    // Mock window.app.kick.getKickAuthForEvents with default return value
    window.app.kick.getKickAuthForEvents.mockResolvedValue({ auth: 'default_auth_token' })

    sharedPusher = new SharedKickPusher()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Constructor', () => {
    it('should initialize with correct properties', () => {
      expect(sharedPusher.reconnectDelay).toBe(5000)
      expect(sharedPusher.chat).toBeNull()
      expect(sharedPusher.shouldReconnect).toBe(true)
      expect(sharedPusher.socketId).toBeNull()
      expect(sharedPusher.chatrooms).toBeInstanceOf(Map)
      expect(sharedPusher.subscribedChannels).toBeInstanceOf(Set)
      expect(sharedPusher.userEventsSubscribed).toBe(false)
      expect(sharedPusher.connectionState).toBe('disconnected')
      expect(sharedPusher.reconnectAttempts).toBe(0)
      expect(sharedPusher.maxReconnectAttempts).toBe(10)
    })

    it('should inherit from EventTarget', () => {
      expect(sharedPusher).toBeInstanceOf(EventTarget)
      expect(typeof sharedPusher.addEventListener).toBe('function')
      expect(typeof sharedPusher.removeEventListener).toBe('function')
      expect(typeof sharedPusher.dispatchEvent).toBe('function')
    })
  })

  describe('Chatroom Management', () => {
    describe('addChatroom()', () => {
      it('should add chatroom with correct channel configuration', () => {
        sharedPusher.addChatroom(chatroomId, streamerId, chatroomData)

        const chatroom = sharedPusher.chatrooms.get(chatroomId)
        expect(chatroom).toEqual({
          chatroomId,
          streamerId,
          chatroomData,
          channels: [
            `channel_${streamerId}`,
            `channel.${streamerId}`,
            `chatrooms.${chatroomId}`,
            `chatrooms.${chatroomId}.v2`,
            `chatroom_${chatroomId}`,
          ],
        })
      })

      it('should subscribe to channels when already connected', () => {
        const subscribeSpy = vi.spyOn(sharedPusher, 'subscribeToChatroomChannels')
        sharedPusher.connectionState = 'connected'

        sharedPusher.addChatroom(chatroomId, streamerId, chatroomData)

        expect(subscribeSpy).toHaveBeenCalledWith(chatroomId)
      })

      it('should not subscribe when not connected', () => {
        const subscribeSpy = vi.spyOn(sharedPusher, 'subscribeToChatroomChannels')
        sharedPusher.connectionState = 'disconnected'

        sharedPusher.addChatroom(chatroomId, streamerId, chatroomData)

        expect(subscribeSpy).not.toHaveBeenCalled()
      })

      it('should handle multiple chatrooms', () => {
        const chatroom2Id = '54321'
        const streamer2Id = '09876'

        sharedPusher.addChatroom(chatroomId, streamerId, chatroomData)
        sharedPusher.addChatroom(chatroom2Id, streamer2Id, chatroomData)

        expect(sharedPusher.chatrooms.size).toBe(2)
        expect(sharedPusher.chatrooms.has(chatroomId)).toBe(true)
        expect(sharedPusher.chatrooms.has(chatroom2Id)).toBe(true)
      })
    })

    describe('removeChatroom()', () => {
      beforeEach(() => {
        sharedPusher.addChatroom(chatroomId, streamerId, chatroomData)
      })

      it('should unsubscribe and remove chatroom when connected', () => {
        const unsubscribeSpy = vi.spyOn(sharedPusher, 'unsubscribeFromChatroomChannels')
        sharedPusher.connectionState = 'connected'

        sharedPusher.removeChatroom(chatroomId)

        expect(unsubscribeSpy).toHaveBeenCalledWith(chatroomId)
        expect(sharedPusher.chatrooms.has(chatroomId)).toBe(false)
      })

      it('should remove chatroom without unsubscribing when not connected', () => {
        const unsubscribeSpy = vi.spyOn(sharedPusher, 'unsubscribeFromChatroomChannels')
        sharedPusher.connectionState = 'disconnected'

        sharedPusher.removeChatroom(chatroomId)

        expect(unsubscribeSpy).not.toHaveBeenCalled()
        expect(sharedPusher.chatrooms.has(chatroomId)).toBe(false)
      })

      it('should close connection when no chatrooms remain', () => {
        const closeSpy = vi.spyOn(sharedPusher, 'close')

        sharedPusher.removeChatroom(chatroomId)

        expect(closeSpy).toHaveBeenCalled()
      })

      it('should not close connection when other chatrooms exist', () => {
        const closeSpy = vi.spyOn(sharedPusher, 'close')
        sharedPusher.addChatroom('another_room', 'another_streamer', chatroomData)

        sharedPusher.removeChatroom(chatroomId)

        expect(closeSpy).not.toHaveBeenCalled()
      })

      it('should handle removal of non-existent chatroom', () => {
        const unsubscribeSpy = vi.spyOn(sharedPusher, 'unsubscribeFromChatroomChannels')

        sharedPusher.removeChatroom('non_existent')

        expect(unsubscribeSpy).not.toHaveBeenCalled()
      })
    })
  })

  describe('Connection Management', () => {
    describe('connect()', () => {
      it('should not connect when shouldReconnect is false', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        sharedPusher.shouldReconnect = false

        sharedPusher.connect()

        expect(global.WebSocket).not.toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalledWith('[SharedKickPusher] Not connecting. Disabled reconnect.')
        
        consoleSpy.mockRestore()
      })

      it('should not connect when already connecting', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        sharedPusher.connectionState = 'connecting'

        sharedPusher.connect()

        expect(global.WebSocket).not.toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalledWith('[SharedKickPusher] Already connecting/connected')
        
        consoleSpy.mockRestore()
      })

      it('should not connect when already connected', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        sharedPusher.connectionState = 'connected'

        sharedPusher.connect()

        expect(global.WebSocket).not.toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalledWith('[SharedKickPusher] Already connecting/connected')
        
        consoleSpy.mockRestore()
      })

      it('should create WebSocket connection with correct URL', () => {
        sharedPusher.addChatroom(chatroomId, streamerId, chatroomData)
        sharedPusher.connect()

        expect(global.WebSocket).toHaveBeenCalledWith(
          'wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false'
        )
        expect(sharedPusher.chat).toBe(mockWebSocket)
        expect(sharedPusher.connectionState).toBe('connecting')
      })

      it('should dispatch connection pending event', () => {
        const eventSpy = vi.spyOn(sharedPusher, 'dispatchEvent')
        sharedPusher.addChatroom(chatroomId, streamerId, chatroomData)

        sharedPusher.connect()

        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'connection',
            detail: {
              type: 'system',
              content: 'connection-pending',
              chatrooms: [chatroomId],
            }
          })
        )
      })

      it('should set up event listeners', () => {
        sharedPusher.connect()

        expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('open', expect.any(Function))
        expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('error', expect.any(Function))
        expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('close', expect.any(Function))
        expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('message', expect.any(Function))
      })
    })

    describe('WebSocket open event', () => {
      let openHandler

      beforeEach(() => {
        sharedPusher.addChatroom(chatroomId, streamerId, chatroomData)
        sharedPusher.connect()
        openHandler = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'open')[1]
      })

      it('should log connection and reset reconnect attempts', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        sharedPusher.reconnectAttempts = 3

        openHandler()

        expect(consoleSpy).toHaveBeenCalledWith('[SharedKickPusher] Connected to Kick WebSocket')
        expect(sharedPusher.reconnectAttempts).toBe(0)
        
        consoleSpy.mockRestore()
      })

      it('should not immediately change connection state', () => {
        openHandler()
        expect(sharedPusher.connectionState).toBe('connecting')
      })
    })

    describe('WebSocket error event', () => {
      let errorHandler

      beforeEach(() => {
        sharedPusher.connect()
        errorHandler = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'error')[1]
      })

      it('should log error and set connection state to disconnected', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const eventSpy = vi.spyOn(sharedPusher, 'dispatchEvent')
        const mockError = { message: 'Connection error' }

        errorHandler(mockError)

        expect(consoleSpy).toHaveBeenCalledWith('[SharedKickPusher] Error occurred: Connection error')
        expect(sharedPusher.connectionState).toBe('disconnected')
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            detail: mockError
          })
        )
        
        consoleSpy.mockRestore()
      })
    })

    describe('WebSocket close event', () => {
      let closeHandler

      beforeEach(() => {
        sharedPusher.connect()
        closeHandler = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'close')[1]
      })

      it('should reset connection state and clear subscriptions', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const eventSpy = vi.spyOn(sharedPusher, 'dispatchEvent')
        
        sharedPusher.connectionState = 'connected'
        sharedPusher.socketId = 'test_socket'
        sharedPusher.userEventsSubscribed = true
        sharedPusher.subscribedChannels.add('test_channel')

        closeHandler()

        expect(sharedPusher.connectionState).toBe('disconnected')
        expect(sharedPusher.socketId).toBeNull()
        expect(sharedPusher.userEventsSubscribed).toBe(false)
        expect(sharedPusher.subscribedChannels.size).toBe(0)
        expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'close' }))
        
        consoleSpy.mockRestore()
      })

      it('should attempt reconnect with exponential backoff', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const connectSpy = vi.spyOn(sharedPusher, 'connect').mockImplementation(() => {})
        sharedPusher.reconnectAttempts = 2

        closeHandler()

        expect(consoleSpy).toHaveBeenCalledWith('[SharedKickPusher] Connection closed')
        expect(consoleSpy).toHaveBeenCalledWith(
          '[SharedKickPusher] Attempting to reconnect (attempt 3/10)...'
        )

        vi.advanceTimersByTime(15000) // 5000 * 3

        expect(connectSpy).toHaveBeenCalled()
        expect(sharedPusher.reconnectAttempts).toBe(3)
        
        consoleSpy.mockRestore()
      })

      it('should not reconnect when shouldReconnect is false', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const connectSpy = vi.spyOn(sharedPusher, 'connect').mockImplementation(() => {})
        sharedPusher.shouldReconnect = false

        closeHandler()

        vi.advanceTimersByTime(5000)

        expect(consoleSpy).toHaveBeenCalledWith(
          '[SharedKickPusher] Not reconnecting - connection was closed intentionally or max attempts reached'
        )
        expect(connectSpy).not.toHaveBeenCalled() // Should not reconnect
        
        consoleSpy.mockRestore()
      })

      it('should not reconnect when max attempts reached', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const connectSpy = vi.spyOn(sharedPusher, 'connect').mockImplementation(() => {})
        sharedPusher.reconnectAttempts = 10

        closeHandler()

        vi.advanceTimersByTime(55000)

        expect(consoleSpy).toHaveBeenCalledWith(
          '[SharedKickPusher] Not reconnecting - connection was closed intentionally or max attempts reached'
        )
        expect(connectSpy).not.toHaveBeenCalled() // Should not reconnect
        
        consoleSpy.mockRestore()
      })
    })
  })

  describe('Message Handling', () => {
    let messageHandler

    beforeEach(() => {
      sharedPusher.addChatroom(chatroomId, streamerId, chatroomData)
      sharedPusher.connect()
      messageHandler = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'message')[1]
    })

    describe('Connection established', () => {
      it('should handle connection established event', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const subscribeAllSpy = vi.spyOn(sharedPusher, 'subscribeToAllChannels')
        const eventSpy = vi.spyOn(sharedPusher, 'dispatchEvent')

        const mockEvent = {
          data: JSON.stringify({
            event: 'pusher:connection_established',
            data: JSON.stringify({ socket_id: 'socket_123' })
          })
        }

        await messageHandler(mockEvent)

        expect(sharedPusher.connectionState).toBe('connected')
        expect(sharedPusher.socketId).toBe('socket_123')
        expect(consoleSpy).toHaveBeenCalledWith(
          '[SharedKickPusher] Connection established: socket ID - socket_123'
        )
        expect(subscribeAllSpy).toHaveBeenCalled()
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'connection',
            detail: {
              type: 'system',
              content: 'connection-success',
              chatrooms: [chatroomId]
            }
          })
        )
        
        consoleSpy.mockRestore()
      })
    })

    describe('Subscription success', () => {
      it('should handle subscription success event', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const eventSpy = vi.spyOn(sharedPusher, 'dispatchEvent')

        const mockEvent = {
          data: JSON.stringify({
            event: 'pusher_internal:subscription_succeeded',
            channel: `chatrooms.${chatroomId}.v2`
          })
        }

        await messageHandler(mockEvent)

        expect(consoleSpy).toHaveBeenCalledWith(
          `[SharedKickPusher] Subscription successful for chatroom: ${chatroomId}`
        )
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'subscription_success',
            detail: {
              chatroomId,
              channel: `chatrooms.${chatroomId}.v2`
            }
          })
        )
        
        consoleSpy.mockRestore()
      })

      it('should not dispatch event for channels without extractable chatroom ID', async () => {
        const eventSpy = vi.spyOn(sharedPusher, 'dispatchEvent')

        const mockEvent = {
          data: JSON.stringify({
            event: 'pusher_internal:subscription_succeeded',
            channel: 'private-userfeed.123456'
          })
        }

        await messageHandler(mockEvent)

        expect(eventSpy).not.toHaveBeenCalled()
      })
    })

    describe('Chat message events', () => {
      const chatEvents = [
        'App\\Events\\ChatMessageEvent',
        'App\\Events\\MessageDeletedEvent',
        'App\\Events\\UserBannedEvent',
        'App\\Events\\UserUnbannedEvent'
      ]

      chatEvents.forEach(eventType => {
        it(`should handle ${eventType}`, async () => {
          const eventSpy = vi.spyOn(sharedPusher, 'dispatchEvent')

          const mockEvent = {
            data: JSON.stringify({
              event: eventType,
              channel: `chatrooms.${chatroomId}.v2`,
              data: JSON.stringify({ test: 'data' })
            })
          }

          await messageHandler(mockEvent)

          expect(eventSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'message',
              detail: {
                chatroomId,
                event: eventType,
                data: JSON.stringify({ test: 'data' }),
                channel: `chatrooms.${chatroomId}.v2`
              }
            })
          )
        })
      })
    })

    describe('Channel events', () => {
      const channelEvents = [
        'App\\Events\\LivestreamUpdated',
        'App\\Events\\StreamerIsLive',
        'App\\Events\\StopStreamBroadcast',
        'App\\Events\\PinnedMessageCreatedEvent',
        'App\\Events\\PinnedMessageDeletedEvent',
        'App\\Events\\ChatroomUpdatedEvent',
        'App\\Events\\PollUpdateEvent',
        'App\\Events\\PollDeleteEvent'
      ]

      channelEvents.forEach(eventType => {
        it(`should handle ${eventType}`, async () => {
          const eventSpy = vi.spyOn(sharedPusher, 'dispatchEvent')

          const mockEvent = {
            data: JSON.stringify({
              event: eventType,
              channel: `chatrooms.${chatroomId}.v2`,
              data: JSON.stringify({ test: 'data' })
            })
          }

          await messageHandler(mockEvent)

          expect(eventSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'channel',
              detail: {
                chatroomId,
                event: eventType,
                data: JSON.stringify({ test: 'data' }),
                channel: `chatrooms.${chatroomId}.v2`
              }
            })
          )
        })
      })
    })

    describe('Error handling', () => {
      it('should handle malformed JSON gracefully', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const eventSpy = vi.spyOn(sharedPusher, 'dispatchEvent')

        const mockEvent = {
          data: 'invalid json'
        }

        await messageHandler(mockEvent)

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('[SharedKickPusher] Error in message processing:')
        )
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            detail: expect.any(Error)
          })
        )
        
        consoleSpy.mockRestore()
      })

      it('should handle events without data field', async () => {
        const mockEvent = {
          data: JSON.stringify({
            event: 'some_event'
            // No data field
          })
        }

        // Should not throw an error
        await expect(messageHandler(mockEvent)).resolves.not.toThrow()
      })

      it('should ignore unrecognized events', async () => {
        const eventSpy = vi.spyOn(sharedPusher, 'dispatchEvent')

        const mockEvent = {
          data: JSON.stringify({
            event: 'UnknownEvent',
            channel: `chatrooms.${chatroomId}.v2`,
            data: JSON.stringify({ test: 'data' })
          })
        }

        await messageHandler(mockEvent)

        // Should not dispatch any custom events
        expect(eventSpy).not.toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'message'
          })
        )
        expect(eventSpy).not.toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'channel'
          })
        )
      })
    })
  })

  describe('Channel Subscription', () => {
    beforeEach(() => {
      sharedPusher.addChatroom(chatroomId, streamerId, chatroomData)
      sharedPusher.chat = mockWebSocket
      mockWebSocket.readyState = WebSocket.OPEN
    })

    describe('subscribeToAllChannels()', () => {
      it('should not subscribe when WebSocket is not open', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        mockWebSocket.readyState = WebSocket.CONNECTING

        await sharedPusher.subscribeToAllChannels()

        expect(consoleSpy).toHaveBeenCalledWith('[SharedKickPusher] Cannot subscribe - WebSocket not open')
        expect(mockWebSocket.send).not.toHaveBeenCalled()
        
        consoleSpy.mockRestore()
      })

      it('should subscribe to user events and chatroom channels', async () => {
        const subscribeUserSpy = vi.spyOn(sharedPusher, 'subscribeToUserEvents')
        const subscribeChatroomSpy = vi.spyOn(sharedPusher, 'subscribeToChatroomChannels')

        await sharedPusher.subscribeToAllChannels()

        expect(subscribeUserSpy).toHaveBeenCalled()
        expect(subscribeChatroomSpy).toHaveBeenCalledWith(chatroomId)
      })

      it('should handle multiple chatrooms', async () => {
        const chatroom2Id = '54321'
        sharedPusher.addChatroom(chatroom2Id, '09876', chatroomData)
        
        const subscribeChatroomSpy = vi.spyOn(sharedPusher, 'subscribeToChatroomChannels')

        await sharedPusher.subscribeToAllChannels()

        expect(subscribeChatroomSpy).toHaveBeenCalledWith(chatroomId)
        expect(subscribeChatroomSpy).toHaveBeenCalledWith(chatroom2Id)
        expect(subscribeChatroomSpy).toHaveBeenCalledTimes(2)
      })
    })

    describe('subscribeToUserEvents()', () => {
      beforeEach(() => {
        sharedPusher.socketId = 'socket_123'
      })

      it('should skip if already subscribed', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        sharedPusher.userEventsSubscribed = true

        await sharedPusher.subscribeToUserEvents()

        expect(mockWebSocket.send).not.toHaveBeenCalled()
        expect(consoleSpy).not.toHaveBeenCalled()
        
        consoleSpy.mockRestore()
      })

      it('should skip if no user ID in localStorage', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        global.localStorage.getItem.mockReturnValue(null)

        await sharedPusher.subscribeToUserEvents()

        expect(consoleSpy).toHaveBeenCalledWith(
          '[SharedKickPusher] No user ID found, skipping private event subscriptions'
        )
        expect(mockWebSocket.send).not.toHaveBeenCalled()
        
        consoleSpy.mockRestore()
      })

      it('should subscribe to user events with auth tokens', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        window.app.kick.getKickAuthForEvents.mockResolvedValue({ auth: 'auth_token_123' })

        await sharedPusher.subscribeToUserEvents()

        expect(window.app.kick.getKickAuthForEvents).toHaveBeenCalledWith(
          'private-userfeed.123456',
          'socket_123'
        )
        expect(window.app.kick.getKickAuthForEvents).toHaveBeenCalledWith(
          'private-channelpoints-123456',
          'socket_123'
        )

        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({
            event: 'pusher:subscribe',
            data: { auth: 'auth_token_123', channel: 'private-userfeed.123456' }
          })
        )
        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({
            event: 'pusher:subscribe',
            data: { auth: 'auth_token_123', channel: 'private-channelpoints-123456' }
          })
        )

        expect(sharedPusher.subscribedChannels.has('private-userfeed.123456')).toBe(true)
        expect(sharedPusher.subscribedChannels.has('private-channelpoints-123456')).toBe(true)
        expect(sharedPusher.userEventsSubscribed).toBe(true)
        
        consoleSpy.mockRestore()
      })

      it('should handle auth errors gracefully', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        window.app.kick.getKickAuthForEvents.mockRejectedValue(new Error('Auth failed'))

        await sharedPusher.subscribeToUserEvents()

        expect(consoleSpy).toHaveBeenCalledWith(
          '[SharedKickPusher] Error subscribing to event:',
          expect.any(Error)
        )
        expect(sharedPusher.userEventsSubscribed).toBe(true) // Still set to true even if some fail
        
        consoleSpy.mockRestore()
      })

      it('should skip subscription when no auth token returned', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        window.app.kick.getKickAuthForEvents.mockResolvedValue({}) // No auth field

        await sharedPusher.subscribeToUserEvents()

        // Should not send subscription without auth token
        expect(mockWebSocket.send).not.toHaveBeenCalled()
        expect(sharedPusher.userEventsSubscribed).toBe(true)
        
        consoleSpy.mockRestore()
      })
    })

    describe('subscribeToChatroomChannels()', () => {
      it('should handle non-existent chatroom', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        await sharedPusher.subscribeToChatroomChannels('non_existent')

        expect(consoleSpy).toHaveBeenCalledWith('[SharedKickPusher] Chatroom non_existent not found')
        expect(mockWebSocket.send).not.toHaveBeenCalled()
        
        consoleSpy.mockRestore()
      })

      it('should subscribe to basic chatroom channels', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        await sharedPusher.subscribeToChatroomChannels(chatroomId)

        const expectedChannels = [
          `channel_${streamerId}`,
          `channel.${streamerId}`,
          `chatrooms.${chatroomId}`,
          `chatrooms.${chatroomId}.v2`,
          `chatroom_${chatroomId}`,
        ]

        expectedChannels.forEach(channel => {
          expect(mockWebSocket.send).toHaveBeenCalledWith(
            JSON.stringify({
              event: 'pusher:subscribe',
              data: { auth: '', channel }
            })
          )
          expect(sharedPusher.subscribedChannels.has(channel)).toBe(true)
        })

        expect(consoleSpy).toHaveBeenCalledWith(
          `[SharedKickPusher] Subscribed to channels for chatroom: ${chatroomId}`
        )
        
        consoleSpy.mockRestore()
      })

      it('should not re-subscribe to already subscribed channels', async () => {
        const channel = `channel_${streamerId}`
        sharedPusher.subscribedChannels.add(channel)
        const initialSendCallCount = mockWebSocket.send.mock.calls.length

        await sharedPusher.subscribeToChatroomChannels(chatroomId)

        // Should have called send for all channels except the one already subscribed
        const expectedCallCount = initialSendCallCount + 4 // 5 channels - 1 already subscribed
        expect(mockWebSocket.send).toHaveBeenCalledTimes(expectedCallCount)
      })

      it('should subscribe to livestream events when streamer is live', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        sharedPusher.socketId = 'socket_123'
        window.app.kick.getKickAuthForEvents.mockResolvedValue({ auth: 'livestream_auth' })

        await sharedPusher.subscribeToChatroomChannels(chatroomId)

        expect(window.app.kick.getKickAuthForEvents).toHaveBeenCalledWith(
          'private-livestream.livestream123',
          'socket_123'
        )
        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({
            event: 'pusher:subscribe',
            data: { auth: 'livestream_auth', channel: 'private-livestream.livestream123' }
          })
        )
        expect(sharedPusher.subscribedChannels.has('private-livestream.livestream123')).toBe(true)
        
        consoleSpy.mockRestore()
      })

      it('should skip livestream subscription when not live', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const offlineChatroomData = {
          streamerData: { livestream: null }
        }
        sharedPusher.chatrooms.set(chatroomId, {
          chatroomId,
          streamerId,
          chatroomData: offlineChatroomData,
          channels: [`channel_${streamerId}`]
        })

        await sharedPusher.subscribeToChatroomChannels(chatroomId)

        expect(consoleSpy).toHaveBeenCalledWith(
          `[SharedKickPusher] Chatroom ${chatroomId} is not live, skipping livestream subscription`
        )
        expect(window.app.kick.getKickAuthForEvents).not.toHaveBeenCalledWith(
          expect.stringContaining('private-livestream'),
          expect.any(String)
        )
        
        consoleSpy.mockRestore()
      })

      it('should handle livestream auth errors', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        sharedPusher.socketId = 'socket_123'
        window.app.kick.getKickAuthForEvents.mockRejectedValue(new Error('Livestream auth failed'))

        await sharedPusher.subscribeToChatroomChannels(chatroomId)

        expect(consoleSpy).toHaveBeenCalledWith(
          '[SharedKickPusher] Error subscribing to livestream event:',
          expect.any(Error)
        )
        
        consoleSpy.mockRestore()
      })

      it('should not re-subscribe to already subscribed livestream channels', async () => {
        sharedPusher.socketId = 'socket_123'
        sharedPusher.subscribedChannels.add('private-livestream.livestream123')
        window.app.kick.getKickAuthForEvents.mockResolvedValue({ auth: 'livestream_auth' })

        await sharedPusher.subscribeToChatroomChannels(chatroomId)

        // Should not send subscription for already subscribed livestream channel
        expect(mockWebSocket.send).not.toHaveBeenCalledWith(
          JSON.stringify({
            event: 'pusher:subscribe',
            data: { auth: 'livestream_auth', channel: 'private-livestream.livestream123' }
          })
        )
      })
    })

    describe('unsubscribeFromChatroomChannels()', () => {
      beforeEach(() => {
        // Pre-subscribe to some channels
        const chatroom = sharedPusher.chatrooms.get(chatroomId)
        chatroom.channels.forEach(channel => {
          sharedPusher.subscribedChannels.add(channel)
        })
      })

      it('should handle non-existent chatroom', () => {
        sharedPusher.unsubscribeFromChatroomChannels('non_existent')
        expect(mockWebSocket.send).not.toHaveBeenCalled()
      })

      it('should unsubscribe from all chatroom channels', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        sharedPusher.unsubscribeFromChatroomChannels(chatroomId)

        const expectedChannels = [
          `channel_${streamerId}`,
          `channel.${streamerId}`,
          `chatrooms.${chatroomId}`,
          `chatrooms.${chatroomId}.v2`,
          `chatroom_${chatroomId}`,
        ]

        expectedChannels.forEach(channel => {
          expect(mockWebSocket.send).toHaveBeenCalledWith(
            JSON.stringify({
              event: 'pusher:unsubscribe',
              data: { channel }
            })
          )
          expect(sharedPusher.subscribedChannels.has(channel)).toBe(false)
        })

        expect(consoleSpy).toHaveBeenCalledWith(
          `[SharedKickPusher] Unsubscribed from channels for chatroom: ${chatroomId}`
        )
        
        consoleSpy.mockRestore()
      })

      it('should only unsubscribe from subscribed channels', () => {
        // Remove one channel from subscribed set
        const firstChannel = `channel_${streamerId}`
        sharedPusher.subscribedChannels.delete(firstChannel)

        sharedPusher.unsubscribeFromChatroomChannels(chatroomId)

        // Should not send unsubscribe for the non-subscribed channel
        expect(mockWebSocket.send).not.toHaveBeenCalledWith(
          JSON.stringify({
            event: 'pusher:unsubscribe',
            data: { channel: firstChannel }
          })
        )

        // But should send for the others
        expect(mockWebSocket.send).toHaveBeenCalledTimes(4) // 5 total - 1 not subscribed
      })
    })
  })

  describe('Utility Methods', () => {
    describe('extractChatroomIdFromChannel()', () => {
      it('should extract chatroom ID from v2 channel', () => {
        const result = sharedPusher.extractChatroomIdFromChannel('chatrooms.12345.v2')
        expect(result).toBe('12345')
      })

      it('should extract chatroom ID from regular channel', () => {
        const result = sharedPusher.extractChatroomIdFromChannel('chatrooms.67890')
        expect(result).toBe('67890')
      })

      it('should return null for non-matching channels', () => {
        expect(sharedPusher.extractChatroomIdFromChannel('channel_12345')).toBeNull()
        expect(sharedPusher.extractChatroomIdFromChannel('private-userfeed.123')).toBeNull()
        expect(sharedPusher.extractChatroomIdFromChannel('invalid')).toBeNull()
      })

      it('should handle edge cases', () => {
        expect(sharedPusher.extractChatroomIdFromChannel('')).toBeNull()
        expect(sharedPusher.extractChatroomIdFromChannel('chatrooms.')).toBeNull()
        expect(sharedPusher.extractChatroomIdFromChannel('chatrooms.abc')).toBeNull()
      })
    })

    describe('getConnectionState()', () => {
      it('should return current connection state', () => {
        sharedPusher.connectionState = 'connected'
        expect(sharedPusher.getConnectionState()).toBe('connected')

        sharedPusher.connectionState = 'connecting'
        expect(sharedPusher.getConnectionState()).toBe('connecting')

        sharedPusher.connectionState = 'disconnected'
        expect(sharedPusher.getConnectionState()).toBe('disconnected')
      })
    })

    describe('getSubscribedChannelCount()', () => {
      it('should return number of subscribed channels', () => {
        expect(sharedPusher.getSubscribedChannelCount()).toBe(0)

        sharedPusher.subscribedChannels.add('channel1')
        sharedPusher.subscribedChannels.add('channel2')
        expect(sharedPusher.getSubscribedChannelCount()).toBe(2)
      })
    })

    describe('getChatroomCount()', () => {
      it('should return number of chatrooms', () => {
        expect(sharedPusher.getChatroomCount()).toBe(0)

        sharedPusher.addChatroom('room1', 'streamer1', chatroomData)
        sharedPusher.addChatroom('room2', 'streamer2', chatroomData)
        expect(sharedPusher.getChatroomCount()).toBe(2)
      })
    })
  })

  describe('Connection Closure', () => {
    describe('close()', () => {
      beforeEach(() => {
        sharedPusher.addChatroom(chatroomId, streamerId, chatroomData)
        sharedPusher.connect()
        mockWebSocket.readyState = WebSocket.OPEN
        sharedPusher.subscribedChannels.add('test_channel1')
        sharedPusher.subscribedChannels.add('test_channel2')
      })

      it('should unsubscribe from all channels before closing', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        sharedPusher.close()

        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({
            event: 'pusher:unsubscribe',
            data: { channel: 'test_channel1' }
          })
        )
        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({
            event: 'pusher:unsubscribe',
            data: { channel: 'test_channel2' }
          })
        )

        expect(mockWebSocket.close).toHaveBeenCalled()
        expect(sharedPusher.chat).toBeNull()
        expect(sharedPusher.shouldReconnect).toBe(false)
        expect(sharedPusher.connectionState).toBe('disconnected')
        expect(sharedPusher.socketId).toBeNull()
        expect(sharedPusher.userEventsSubscribed).toBe(false)
        expect(sharedPusher.subscribedChannels.size).toBe(0)
        
        consoleSpy.mockRestore()
      })

      it('should handle closure when no active connection', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        sharedPusher.chat = null

        sharedPusher.close()

        expect(consoleSpy).toHaveBeenCalledWith('[SharedKickPusher] Closing shared connection')
        expect(mockWebSocket.close).not.toHaveBeenCalled()
        
        consoleSpy.mockRestore()
      })

      it('should handle errors during closure gracefully', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const mockError = new Error('Close error')
        mockWebSocket.send.mockImplementation(() => {
          throw mockError
        })

        sharedPusher.close()

        expect(consoleSpy).toHaveBeenCalledWith(
          '[SharedKickPusher] Error during closing of connection:',
          mockError
        )
        expect(sharedPusher.shouldReconnect).toBe(false)
        expect(sharedPusher.connectionState).toBe('disconnected')
        
        consoleSpy.mockRestore()
      })

      it('should handle WebSocket in different states', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        
        // Test with CONNECTING state
        mockWebSocket.readyState = WebSocket.CONNECTING
        sharedPusher.close()
        expect(mockWebSocket.close).toHaveBeenCalled()

        // Test with CLOSED state  
        mockWebSocket.readyState = WebSocket.CLOSED
        sharedPusher.chat = mockWebSocket // Reset since close() sets it to null
        sharedPusher.close()
        expect(mockWebSocket.close).toHaveBeenCalledTimes(2)
        
        consoleSpy.mockRestore()
      })
    })
  })

  describe('Reconnection Logic', () => {
    beforeEach(() => {
      sharedPusher.connect()
    })

    it('should implement exponential backoff correctly', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const connectSpy = vi.spyOn(sharedPusher, 'connect')
      
      // Add a chatroom so connection is attempted
      sharedPusher.addChatroom(chatroomId, streamerId, chatroomData)
      sharedPusher.connect()
      
      const closeHandler = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'close')[1]

      // Test first reconnection attempt
      sharedPusher.reconnectAttempts = 0
      closeHandler()

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SharedKickPusher] Attempting to reconnect (attempt 1/10)...'
      )

      vi.advanceTimersByTime(5000) // 5000 * 1
      expect(connectSpy).toHaveBeenCalledTimes(2) // Initial + reconnect

      // Test second reconnection attempt
      sharedPusher.reconnectAttempts = 1
      closeHandler()

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SharedKickPusher] Attempting to reconnect (attempt 2/10)...'
      )

      vi.advanceTimersByTime(10000) // 5000 * 2
      expect(connectSpy).toHaveBeenCalledTimes(4) // Previous + another reconnect
      
      consoleSpy.mockRestore()
    })

    it('should reset reconnect attempts on successful connection', () => {
      sharedPusher.reconnectAttempts = 5
      const openHandler = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'open')[1]

      openHandler()

      expect(sharedPusher.reconnectAttempts).toBe(0)
    })

    it('should respect max reconnect attempts', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const connectSpy = vi.spyOn(sharedPusher, 'connect').mockImplementation(() => {})
      
      // Add a chatroom and connect
      sharedPusher.addChatroom(chatroomId, streamerId, chatroomData)
      sharedPusher.connect()
      
      const closeHandler = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'close')[1]

      sharedPusher.reconnectAttempts = 10 // At max

      closeHandler()

      vi.advanceTimersByTime(60000) // Wait longer than any possible delay

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SharedKickPusher] Not reconnecting - connection was closed intentionally or max attempts reached'
      )
      expect(connectSpy).not.toHaveBeenCalled() // Should not attempt reconnect
      
      consoleSpy.mockRestore()
    })
  })

  describe('Memory Management', () => {
    it('should clean up subscriptions on close', () => {
      // Set up connection state
      sharedPusher.chat = mockWebSocket
      mockWebSocket.readyState = WebSocket.OPEN
      sharedPusher.subscribedChannels.add('channel1')
      sharedPusher.subscribedChannels.add('channel2')
      sharedPusher.userEventsSubscribed = true
      sharedPusher.socketId = 'test_socket'
      sharedPusher.connectionState = 'connected'

      sharedPusher.close()

      expect(sharedPusher.subscribedChannels.size).toBe(0)
      expect(sharedPusher.userEventsSubscribed).toBe(false)
      expect(sharedPusher.socketId).toBeNull()
      expect(sharedPusher.connectionState).toBe('disconnected')
      expect(sharedPusher.chat).toBeNull()
    })

    it('should handle multiple open/close cycles', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      for (let i = 0; i < 3; i++) {
        sharedPusher.addChatroom(`room${i}`, `streamer${i}`, chatroomData)
        sharedPusher.connect()
        sharedPusher.close()
      }
      
      expect(sharedPusher.shouldReconnect).toBe(false)
      expect(sharedPusher.chat).toBeNull()
      expect(sharedPusher.subscribedChannels.size).toBe(0)
      
      consoleSpy.mockRestore()
    })

    it('should handle large numbers of chatrooms', () => {
      // Add many chatrooms
      for (let i = 0; i < 100; i++) {
        sharedPusher.addChatroom(`room${i}`, `streamer${i}`, chatroomData)
      }

      expect(sharedPusher.getChatroomCount()).toBe(100)

      // Remove them all
      for (let i = 0; i < 100; i++) {
        sharedPusher.removeChatroom(`room${i}`)
      }

      expect(sharedPusher.getChatroomCount()).toBe(0)
    })
  })

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle WebSocket creation errors', () => {
      global.WebSocket.mockImplementation(() => {
        throw new Error('WebSocket creation failed')
      })

      expect(() => sharedPusher.connect()).toThrow('WebSocket creation failed')
      expect(sharedPusher.connectionState).toBe('connecting') // State set before WebSocket creation
    })

    it('should handle null/undefined chatroom data', () => {
      expect(() => sharedPusher.addChatroom('room1', 'streamer1', null)).not.toThrow()
      expect(() => sharedPusher.addChatroom('room2', 'streamer2', undefined)).not.toThrow()
      
      const chatroom1 = sharedPusher.chatrooms.get('room1')
      const chatroom2 = sharedPusher.chatrooms.get('room2')
      
      expect(chatroom1.chatroomData).toBeNull()
      expect(chatroom2.chatroomData).toBeUndefined()
    })

    it('should handle rapid connection/disconnection cycles', () => {
      for (let i = 0; i < 10; i++) {
        sharedPusher.connectionState = 'disconnected'
        sharedPusher.shouldReconnect = true
        sharedPusher.connect()
        sharedPusher.close()
      }
      
      expect(sharedPusher.shouldReconnect).toBe(false)
    })

    it('should handle WebSocket send errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      sharedPusher.chat = mockWebSocket
      mockWebSocket.readyState = WebSocket.OPEN
      mockWebSocket.send.mockImplementation(() => {
        throw new Error('Send failed')
      })

      // Should not throw, but may log errors
      expect(() => sharedPusher.subscribeToChatroomChannels(chatroomId)).not.toThrow()
      
      consoleSpy.mockRestore()
    })

    it('should handle missing window.app gracefully', () => {
      const originalWindow = global.window
      global.window = {}

      sharedPusher.chat = mockWebSocket
      mockWebSocket.readyState = WebSocket.OPEN
      sharedPusher.socketId = 'test_socket'

      // Should not throw errors
      expect(async () => await sharedPusher.subscribeToUserEvents()).not.toThrow()
      expect(async () => await sharedPusher.subscribeToChatroomChannels(chatroomId)).not.toThrow()

      global.window = originalWindow
    })

    it('should handle malformed socket ID in connection established', async () => {
      sharedPusher.connect()
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'message')[1]

      const mockEvent = {
        data: JSON.stringify({
          event: 'pusher:connection_established',
          data: 'not valid json'
        })
      }

      // Should handle gracefully without crashing
      await expect(messageHandler(mockEvent)).resolves.not.toThrow()
    })

    it('should handle very long channel names', () => {
      const longChannelName = 'a'.repeat(1000)
      sharedPusher.subscribedChannels.add(longChannelName)
      
      expect(sharedPusher.getSubscribedChannelCount()).toBe(1)
      
      sharedPusher.chat = mockWebSocket
      mockWebSocket.readyState = WebSocket.OPEN
      
      // Should handle without issues
      expect(() => sharedPusher.close()).not.toThrow()
    })

    it('should handle concurrent addChatroom calls', () => {
      // Simulate concurrent calls
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve().then(() => 
            sharedPusher.addChatroom(`room${i}`, `streamer${i}`, chatroomData)
          )
        )
      }

      return Promise.all(promises).then(() => {
        expect(sharedPusher.getChatroomCount()).toBe(10)
      })
    })

    it('should handle events with missing channel field', async () => {
      sharedPusher.connect()
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'message')[1]

      const mockEvent = {
        data: JSON.stringify({
          event: 'App\\Events\\ChatMessageEvent',
          data: JSON.stringify({ content: 'test' })
          // Missing channel field
        })
      }

      // Should handle gracefully
      await expect(messageHandler(mockEvent)).resolves.not.toThrow()
    })

    it('should handle subscription success with malformed channel', async () => {
      sharedPusher.connect()
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'message')[1]

      const mockEvent = {
        data: JSON.stringify({
          event: 'pusher_internal:subscription_succeeded',
          channel: 'malformed_channel_name'
        })
      }

      const eventSpy = vi.spyOn(sharedPusher, 'dispatchEvent')

      await messageHandler(mockEvent)

      // Should not dispatch subscription_success event for malformed channel
      expect(eventSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'subscription_success'
        })
      )
    })
  })

  describe('Performance Considerations', () => {
    it('should handle rapid message processing', async () => {
      sharedPusher.connect()
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'message')[1]

      // Process many messages rapidly
      const promises = []
      for (let i = 0; i < 100; i++) {
        const mockEvent = {
          data: JSON.stringify({
            event: 'App\\Events\\ChatMessageEvent',
            channel: `chatrooms.${chatroomId}.v2`,
            data: JSON.stringify({ content: `Message ${i}` })
          })
        }
        promises.push(messageHandler(mockEvent))
      }

      await Promise.all(promises)
      
      // All messages should be processed without error
      expect(promises).toHaveLength(100)
    })

    it('should efficiently manage subscription sets', () => {
      // Add many channels
      for (let i = 0; i < 1000; i++) {
        sharedPusher.subscribedChannels.add(`channel_${i}`)
      }

      expect(sharedPusher.getSubscribedChannelCount()).toBe(1000)

      // Clear should be efficient
      sharedPusher.subscribedChannels.clear()
      expect(sharedPusher.getSubscribedChannelCount()).toBe(0)
    })

    it('should handle many chatrooms efficiently', () => {
      const startTime = Date.now()

      // Add many chatrooms
      for (let i = 0; i < 1000; i++) {
        sharedPusher.addChatroom(`room_${i}`, `streamer_${i}`, chatroomData)
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(sharedPusher.getChatroomCount()).toBe(1000)
      
      // Should complete reasonably quickly (allowing for CI/test overhead)
      expect(duration).toBeLessThan(5000)
    })

    it('should limit memory usage during long operation', () => {
      const initialHeapUsed = process.memoryUsage ? process.memoryUsage().heapUsed : 0
      
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        sharedPusher.addChatroom(`room_${i}`, `streamer_${i}`, chatroomData)
        sharedPusher.subscribedChannels.add(`channel_${i}`)
        if (i % 2 === 0) {
          sharedPusher.removeChatroom(`room_${i}`)
        }
      }

      // Clean up
      sharedPusher.close()

      const finalHeapUsed = process.memoryUsage ? process.memoryUsage().heapUsed : 0
      
      // Memory usage should not grow excessively
      if (process.memoryUsage) {
        const memoryGrowth = finalHeapUsed - initialHeapUsed
        expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024) // Less than 50MB growth
      }
    })
  })

  describe('Configuration Validation', () => {
    it('should have reasonable default values', () => {
      expect(sharedPusher.reconnectDelay).toBeGreaterThan(0)
      expect(sharedPusher.maxReconnectAttempts).toBeGreaterThan(0)
      expect(sharedPusher.maxReconnectAttempts).toBeLessThan(100) // Reasonable upper bound
    })

    it('should handle modified configuration values', () => {
      sharedPusher.reconnectDelay = 1000
      sharedPusher.maxReconnectAttempts = 5

      expect(sharedPusher.reconnectDelay).toBe(1000)
      expect(sharedPusher.maxReconnectAttempts).toBe(5)
    })

    it('should work with extreme but valid configuration', () => {
      sharedPusher.reconnectDelay = 1 // Very short
      sharedPusher.maxReconnectAttempts = 1 // Very few

      // Connect first to set up handlers
      sharedPusher.connect()
      
      const closeHandler = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'close')[1]
      
      if (closeHandler) {
        // Should still work with extreme values
        expect(() => closeHandler()).not.toThrow()
      }
    })
  })
})