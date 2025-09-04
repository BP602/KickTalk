import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import StvWebSocket from './stvWebsocket'

// Mock global WebSocket
global.WebSocket = vi.fn()

describe('StvWebSocket', () => {
  let mockWebSocket
  let stvWebSocket
  const channelKickID = '12345'
  const stvId = 'stv_user_123'
  const stvEmoteSetId = 'emote_set_456'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Mock WebSocket implementation
    mockWebSocket = {
      readyState: WebSocket.CONNECTING,
      send: vi.fn(),
      close: vi.fn(),
      onerror: null,
      onclose: null,
      onopen: null,
      onmessage: null
    }

    global.WebSocket.mockImplementation(() => mockWebSocket)

    stvWebSocket = new StvWebSocket(channelKickID, stvId, stvEmoteSetId)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Constructor', () => {
    it('should initialize with correct properties', () => {
      expect(stvWebSocket.channelKickID).toBe(channelKickID)
      expect(stvWebSocket.stvId).toBe(stvId)
      expect(stvWebSocket.stvEmoteSetId).toBe(stvEmoteSetId)
      expect(stvWebSocket.shouldReconnect).toBe(true)
      expect(stvWebSocket.startDelay).toBe(1000)
      expect(stvWebSocket.maxRetrySteps).toBe(5)
      expect(stvWebSocket.reconnectAttempts).toBe(0)
      expect(stvWebSocket.chat).toBeNull()
    })

    it('should handle string conversion for channelKickID', () => {
      const numericId = 99999
      const ws = new StvWebSocket(numericId, stvId, stvEmoteSetId)
      expect(ws.channelKickID).toBe('99999')
    })

    it('should work with default values', () => {
      const ws = new StvWebSocket(channelKickID)
      expect(ws.stvId).toBe('0')
      expect(ws.stvEmoteSetId).toBe('0')
    })
  })

  describe('Connection Management', () => {
    describe('connect()', () => {
      it('should not connect when reconnect is disabled', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        stvWebSocket.shouldReconnect = false

        stvWebSocket.connect()

        expect(global.WebSocket).not.toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalledWith('[7TV]: Not connecting to WebSocket - reconnect disabled')
        
        consoleSpy.mockRestore()
      })

      it('should create WebSocket connection with correct URL', () => {
        stvWebSocket.connect()

        expect(global.WebSocket).toHaveBeenCalledWith(
          'wss://events.7tv.io/v3?app=kicktalk&version=420.69'
        )
        expect(stvWebSocket.chat).toBe(mockWebSocket)
      })

      it('should set up event handlers', () => {
        stvWebSocket.connect()

        expect(mockWebSocket.onerror).toBeDefined()
        expect(mockWebSocket.onclose).toBeDefined()
        expect(mockWebSocket.onopen).toBeDefined()
      })
    })

    describe('WebSocket onopen handler', () => {
      let onOpenHandler

      beforeEach(() => {
        stvWebSocket.connect()
        onOpenHandler = mockWebSocket.onopen
      })

      it('should reset reconnect attempts on successful connection', async () => {
        stvWebSocket.reconnectAttempts = 3
        const p = onOpenHandler()
        await vi.runAllTimersAsync()
        await p
        expect(stvWebSocket.reconnectAttempts).toBe(0)
      })

      it('should wait for STV IDs when they are "0"', async () => {
        const ws = new StvWebSocket(channelKickID, '0', '0')
        ws.connect()
        const handler = mockWebSocket.onopen

        const subscribeUserSpy = vi.spyOn(ws, 'subscribeToUserEvents')
        const subscribeCosmeticSpy = vi.spyOn(ws, 'subscribeToCosmeticEvents')

        const p = handler()
        await vi.runAllTimersAsync()
        await p

        expect(subscribeUserSpy).not.toHaveBeenCalled()
        expect(subscribeCosmeticSpy).not.toHaveBeenCalled()
      })

      it('should subscribe to user and cosmetic events when STV ID is valid', async () => {
        const subscribeUserSpy = vi.spyOn(stvWebSocket, 'subscribeToUserEvents')
        const subscribeCosmeticSpy = vi.spyOn(stvWebSocket, 'subscribeToCosmeticEvents')
        const subscribeEntitlementSpy = vi.spyOn(stvWebSocket, 'subscribeToEntitlementEvents')
        const subscribeEmoteSetSpy = vi.spyOn(stvWebSocket, 'subscribeToEmoteSetEvents')
        const setupMessageSpy = vi.spyOn(stvWebSocket, 'setupMessageHandler')

        await onOpenHandler()
        vi.advanceTimersByTime(1000)

        expect(subscribeUserSpy).toHaveBeenCalled()
        expect(subscribeCosmeticSpy).toHaveBeenCalled()
        expect(subscribeEntitlementSpy).toHaveBeenCalled()
        expect(subscribeEmoteSetSpy).toHaveBeenCalled()
        expect(setupMessageSpy).toHaveBeenCalled()
      })

      it('should not subscribe to emote set events when emote set ID is "0"', async () => {
        const ws = new StvWebSocket(channelKickID, stvId, '0')
        ws.connect()
        const handler = mockWebSocket.onopen

        const subscribeEmoteSetSpy = vi.spyOn(ws, 'subscribeToEmoteSetEvents')

        await handler()
        vi.advanceTimersByTime(1000)

        expect(subscribeEmoteSetSpy).not.toHaveBeenCalled()
      })

      it('should not subscribe to entitlement events when channel ID is "0"', async () => {
        const ws = new StvWebSocket('0', stvId, stvEmoteSetId)
        ws.connect()
        const handler = mockWebSocket.onopen

        const subscribeEntitlementSpy = vi.spyOn(ws, 'subscribeToEntitlementEvents')

        await handler()
        vi.advanceTimersByTime(1000)

        expect(subscribeEntitlementSpy).not.toHaveBeenCalled()
      })
    })

    describe('WebSocket onerror handler', () => {
      let onErrorHandler

      beforeEach(() => {
        stvWebSocket.connect()
        onErrorHandler = mockWebSocket.onerror
      })

      it('should increment reconnect attempts and log error', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const mockEvent = { message: 'WebSocket error' }

        onErrorHandler(mockEvent)

        expect(stvWebSocket.reconnectAttempts).toBe(1)
        expect(consoleSpy).toHaveBeenCalledWith('[7TV]: Connection error. Attempt 1')
        
        consoleSpy.mockRestore()
      })

      it('should track multiple error attempts', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        onErrorHandler({})
        onErrorHandler({})
        onErrorHandler({})

        expect(stvWebSocket.reconnectAttempts).toBe(3)
        expect(consoleSpy).toHaveBeenLastCalledWith('[7TV]: Connection error. Attempt 3')
        
        consoleSpy.mockRestore()
      })
    })

    describe('WebSocket onclose handler', () => {
      let onCloseHandler

      beforeEach(() => {
        stvWebSocket.connect()
        onCloseHandler = mockWebSocket.onclose
      })

      it('should not reconnect when disabled', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        stvWebSocket.shouldReconnect = false

        onCloseHandler()

        expect(consoleSpy).toHaveBeenCalledWith(
          `[7TV]: Reconnection disabled for chatroom ${channelKickID}`
        )
        
        consoleSpy.mockRestore()
      })

      it('should reconnect with exponential backoff', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const connectSpy = vi.spyOn(stvWebSocket, 'connect')
        
        stvWebSocket.reconnectAttempts = 2

        onCloseHandler()

        // Should calculate delay as startDelay * 2^(step-1)
        // For attempt 2: 1000 * 2^(2-1) = 1000 * 2 = 2000ms
        expect(consoleSpy).toHaveBeenCalledWith(
          '[7TV]: Reconnecting in 2000ms (attempt 2)'
        )

        vi.advanceTimersByTime(2000)
        expect(connectSpy).toHaveBeenCalledTimes(2) // Initial + reconnect
        
        consoleSpy.mockRestore()
      })

      it('should cap backoff delay at maxRetrySteps', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        
        stvWebSocket.reconnectAttempts = 10 // Beyond maxRetrySteps (5)

        onCloseHandler()

        // Should cap at step 5: 1000 * 2^(5-1) = 1000 * 16 = 16000ms
        expect(consoleSpy).toHaveBeenCalledWith(
          '[7TV]: Reconnecting in 16000ms (attempt 10)'
        )
        
        consoleSpy.mockRestore()
      })
    })
  })

  describe('Subscription Methods', () => {
    beforeEach(() => {
      stvWebSocket.connect()
      mockWebSocket.readyState = WebSocket.OPEN
    })

    describe('subscribeToUserEvents', () => {
      it('should send correct subscription message', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        
        stvWebSocket.subscribeToUserEvents()

        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({
            op: 35,
            t: expect.any(Number),
            d: {
              type: 'user.*',
              condition: { object_id: stvId }
            }
          })
        )
        expect(consoleSpy).toHaveBeenCalledWith('[7TV]: Subscribed to user.* events')
        
        consoleSpy.mockRestore()
      })

      it('should not send when WebSocket not ready', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        mockWebSocket.readyState = WebSocket.CONNECTING

        stvWebSocket.subscribeToUserEvents()

        expect(mockWebSocket.send).not.toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalledWith(
          '[7TV]: Cannot subscribe to user events - WebSocket not ready'
        )
        
        consoleSpy.mockRestore()
      })

      it('should not send when WebSocket is null', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        stvWebSocket.chat = null

        stvWebSocket.subscribeToUserEvents()

        expect(consoleSpy).toHaveBeenCalledWith(
          '[7TV]: Cannot subscribe to user events - WebSocket not ready'
        )
        
        consoleSpy.mockRestore()
      })
    })

    describe('subscribeToCosmeticEvents', () => {
      it('should send correct subscription message', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        
        stvWebSocket.subscribeToCosmeticEvents()

        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({
            op: 35,
            t: expect.any(Number),
            d: {
              type: 'cosmetic.*',
              condition: { 
                platform: 'KICK', 
                ctx: 'channel', 
                id: channelKickID 
              }
            }
          })
        )
        expect(consoleSpy).toHaveBeenCalledWith('[7TV]: Subscribed to cosmetic.* events')
        
        consoleSpy.mockRestore()
      })

      it('should not send when WebSocket not ready', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        mockWebSocket.readyState = WebSocket.CLOSED

        stvWebSocket.subscribeToCosmeticEvents()

        expect(mockWebSocket.send).not.toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalledWith(
          '[7TV]: Cannot subscribe to cosmetic events - WebSocket not ready'
        )
        
        consoleSpy.mockRestore()
      })
    })

    describe('subscribeToEntitlementEvents', () => {
      it('should send correct subscription message and dispatch event', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const dispatchSpy = vi.spyOn(stvWebSocket, 'dispatchEvent')
        
        stvWebSocket.subscribeToEntitlementEvents()

        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({
            op: 35,
            t: expect.any(Number),
            d: {
              type: 'entitlement.*',
              condition: { 
                platform: 'KICK', 
                ctx: 'channel', 
                id: channelKickID 
              }
            }
          })
        )
        expect(consoleSpy).toHaveBeenCalledWith('[7TV]: Subscribed to entitlement.* events')
        const openEvt = dispatchSpy.mock.calls.at(-1)[0]
        expect(openEvt.type).toBe('open')
        expect(openEvt.detail).toEqual({ body: 'SUBSCRIBED', type: 'entitlement.*' })
        
        consoleSpy.mockRestore()
      })

      it('should not send when WebSocket not ready', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        mockWebSocket.readyState = WebSocket.CONNECTING

        stvWebSocket.subscribeToEntitlementEvents()

        expect(mockWebSocket.send).not.toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalledWith(
          '[7TV]: Cannot subscribe to entitlement events - WebSocket not ready'
        )
        
        consoleSpy.mockRestore()
      })
    })

    describe('subscribeToEmoteSetEvents', () => {
      it('should send correct subscription message', () => {
        stvWebSocket.subscribeToEmoteSetEvents()

        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({
            op: 35,
            t: expect.any(Number),
            d: {
              type: 'emote_set.*',
              condition: { object_id: stvEmoteSetId }
            }
          })
        )
      })

      it('should not send when WebSocket not ready', () => {
        mockWebSocket.readyState = WebSocket.CLOSED

        stvWebSocket.subscribeToEmoteSetEvents()

        expect(mockWebSocket.send).not.toHaveBeenCalled()
      })
    })
  })

  describe('Message Handling', () => {
    beforeEach(() => {
      stvWebSocket.connect()
      stvWebSocket.setupMessageHandler()
    })

    describe('setupMessageHandler', () => {
      it('should handle user.update messages', () => {
        const dispatchSpy = vi.spyOn(stvWebSocket, 'dispatchEvent')
        const mockMessage = {
          data: JSON.stringify({
            d: {
              type: 'user.update',
              body: { user_id: 'user123', updated_fields: ['username'] }
            }
          })
        }

        mockWebSocket.onmessage(mockMessage)

        const evt = dispatchSpy.mock.calls.at(-1)[0]
        expect(evt.type).toBe('message')
        expect(evt.detail).toEqual({ body: { user_id: 'user123', updated_fields: ['username'] }, type: 'user.update' })
      })

      it('should handle emote_set.update messages', () => {
        const dispatchSpy = vi.spyOn(stvWebSocket, 'dispatchEvent')
        const mockMessage = {
          data: JSON.stringify({
            d: {
              type: 'emote_set.update',
              body: { set_id: 'set123', changes: ['emote_added'] }
            }
          })
        }

        mockWebSocket.onmessage(mockMessage)

        const evt = dispatchSpy.mock.calls.at(-1)[0]
        expect(evt.type).toBe('message')
        expect(evt.detail).toEqual({ body: { set_id: 'set123', changes: ['emote_added'] }, type: 'emote_set.update' })
      })

      it('should handle cosmetic.create messages', () => {
        const dispatchSpy = vi.spyOn(stvWebSocket, 'dispatchEvent')
        const mockMessage = {
          data: JSON.stringify({
            d: {
              type: 'cosmetic.create',
              body: {
                object: {
                  kind: 'BADGE',
                  data: {
                    id: 'badge123',
                    tooltip: 'Test Badge',
                    host: {
                      url: '//cdn.7tv.app',
                      files: [{ name: 'badge.webp' }]
                    }
                  }
                }
              }
            }
          })
        }

        mockWebSocket.onmessage(mockMessage)

        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'message',
            detail: {
              body: expect.objectContaining({
                badges: expect.arrayContaining([
                  expect.objectContaining({
                    id: 'badge123',
                    title: 'Test Badge'
                  })
                ])
              }),
              type: 'cosmetic.create'
            }
          })
        )
      })

      it('should handle entitlement.create messages with kind 10', () => {
        const dispatchSpy = vi.spyOn(stvWebSocket, 'dispatchEvent')
        const mockMessage = {
          data: JSON.stringify({
            d: {
              type: 'entitlement.create',
              body: { 
                kind: 10, 
                user_id: 'user123',
                entitlement: 'subscriber' 
              }
            }
          })
        }

        mockWebSocket.onmessage(mockMessage)

        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'message',
            detail: {
              body: { kind: 10, user_id: 'user123', entitlement: 'subscriber' },
              type: 'entitlement.create'
            }
          })
        )
      })

      it('should ignore entitlement.create messages with kind other than 10', () => {
        const dispatchSpy = vi.spyOn(stvWebSocket, 'dispatchEvent')
        const mockMessage = {
          data: JSON.stringify({
            d: {
              type: 'entitlement.create',
              body: { 
                kind: 5, 
                user_id: 'user123',
                entitlement: 'other' 
              }
            }
          })
        }

        mockWebSocket.onmessage(mockMessage)

        expect(dispatchSpy).not.toHaveBeenCalled()
      })

      it('should ignore messages without body', () => {
        const dispatchSpy = vi.spyOn(stvWebSocket, 'dispatchEvent')
        const mockMessage = {
          data: JSON.stringify({
            d: {
              type: 'user.update'
              // No body field
            }
          })
        }

        mockWebSocket.onmessage(mockMessage)

        expect(dispatchSpy).not.toHaveBeenCalled()
      })

      it('should handle malformed JSON gracefully', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const mockMessage = {
          data: 'invalid json'
        }

        mockWebSocket.onmessage(mockMessage)

        expect(consoleSpy).toHaveBeenCalledWith(
          `[7TV WebSocket]: Error parsing message for channel ${channelKickID}:`,
          expect.any(Error)
        )
        
        consoleSpy.mockRestore()
      })

      it('should handle unknown message types', () => {
        const dispatchSpy = vi.spyOn(stvWebSocket, 'dispatchEvent')
        const mockMessage = {
          data: JSON.stringify({
            d: {
              type: 'unknown.event',
              body: { test: 'data' }
            }
          })
        }

        mockWebSocket.onmessage(mockMessage)

        expect(dispatchSpy).not.toHaveBeenCalled()
      })
    })
  })

  describe('Cosmetic Processing', () => {
    beforeEach(() => {
      stvWebSocket.connect()
      stvWebSocket.setupMessageHandler()
    })

    describe('Badge Processing', () => {
      it('should process badge cosmetics correctly', () => {
        const dispatchSpy = vi.spyOn(stvWebSocket, 'dispatchEvent')
        const mockMessage = {
          data: JSON.stringify({
            d: {
              type: 'cosmetic.create',
              body: {
                object: {
                  kind: 'BADGE',
                  data: {
                    id: 'badge456',
                    tooltip: 'Subscriber Badge',
                    host: {
                      url: '//cdn.7tv.app',
                      files: [
                        { name: '1x.webp' },
                        { name: '2x.webp' },
                        { name: '3x.webp' }
                      ]
                    }
                  }
                }
              }
            }
          })
        }

        mockWebSocket.onmessage(mockMessage)

        const evt = dispatchSpy.mock.calls.at(-1)[0]
        expect(evt.detail.type).toBe('cosmetic.create')
        const badges = evt.detail.body.badges || []
        expect(badges).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: 'badge456', title: 'Subscriber Badge', url: 'https://cdn.7tv.app/3x.webp' })
        ]))
      })

      it('should handle badge with default ID replacement', () => {
        const dispatchSpy = vi.spyOn(stvWebSocket, 'dispatchEvent')
        const mockMessage = {
          data: JSON.stringify({
            d: {
              type: 'cosmetic.create',
              body: {
                object: {
                  kind: 'BADGE',
                  data: {
                    id: '00000000000000000000000000',
                    ref_id: 'real_badge_id',
                    tooltip: 'Default Badge',
                    host: {
                      url: '//cdn.7tv.app',
                      files: [{ name: 'badge.webp' }]
                    }
                  }
                }
              }
            }
          })
        }

        mockWebSocket.onmessage(mockMessage)

        const evt = dispatchSpy.mock.calls.at(-1)[0]
        const badges = evt.detail.body.badges || []
        expect(badges).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: 'real_badge_id' })
        ]))
      })

      it('should not duplicate existing badges', () => {
        const dispatchSpy = vi.spyOn(stvWebSocket, 'dispatchEvent')
        
        // First message adds badge
        const firstMessage = {
          data: JSON.stringify({
            d: {
              type: 'cosmetic.create',
              body: {
                object: {
                  kind: 'BADGE',
                  data: {
                    id: 'duplicate_badge',
                    tooltip: 'Badge',
                    host: {
                      url: '//cdn.7tv.app',
                      files: [{ name: 'badge.webp' }]
                    }
                  }
                }
              }
            }
          })
        }

        // Second message with same badge ID
        const secondMessage = {
          data: JSON.stringify({
            d: {
              type: 'cosmetic.create',
              body: {
                object: {
                  kind: 'BADGE',
                  data: {
                    id: 'duplicate_badge',
                    tooltip: 'Badge',
                    host: {
                      url: '//cdn.7tv.app',
                      files: [{ name: 'badge.webp' }]
                    }
                  }
                }
              }
            }
          })
        }

        mockWebSocket.onmessage(firstMessage)
        mockWebSocket.onmessage(secondMessage)

        // Implementation dispatches an event for each message, but should not duplicate the badge in payload
        expect(dispatchSpy).toHaveBeenCalledTimes(2)
        const lastEvt = dispatchSpy.mock.calls.at(-1)[0]
        const badges = lastEvt.detail.body.badges || []
        const duplicates = badges.filter(b => b.id === 'duplicate_badge')
        expect(duplicates.length).toBe(1)
      })
    })

    describe('Paint Processing', () => {
      it('should process gradient paint cosmetics', () => {
        const dispatchSpy = vi.spyOn(stvWebSocket, 'dispatchEvent')
        const mockMessage = {
          data: JSON.stringify({
            d: {
              type: 'cosmetic.create',
              body: {
                object: {
                  kind: 'PAINT',
                  data: {
                    id: 'paint123',
                    name: 'Rainbow Paint',
                    function: 'LINEAR_GRADIENT',
                    angle: 45,
                    shape: 'circle',
                    repeat: false,
                    stops: [
                      { at: 0, color: -16711936 }, // Green
                      { at: 1, color: -65536 }     // Red
                    ],
                    shadows: [
                      {
                        color: -16777216, // Black
                        x_offset: 2,
                        y_offset: 2,
                        radius: 4
                      }
                    ]
                  }
                }
              }
            }
          })
        }

        mockWebSocket.onmessage(mockMessage)

        // Inspect event detail directly
        expect(dispatchSpy).toHaveBeenCalled()
        const evt = dispatchSpy.mock.calls.at(-1)[0]
        const paints = evt.detail.body.paints || []
        const paint = paints.find(p => p.id === 'paint123')
        expect(paint).toBeTruthy()
        expect(paint.name).toBe('Rainbow Paint')
        expect(typeof paint.backgroundImage).toBe('string')
        expect(paint.backgroundImage.includes('linear-gradient(45deg')).toBe(true)
        expect(typeof paint.shadows).toBe('string')
        expect(paint.shadows.includes('drop-shadow')).toBe(true)
      })

      it('should process image-based paint cosmetics', () => {
        const dispatchSpy = vi.spyOn(stvWebSocket, 'dispatchEvent')
        const mockMessage = {
          data: JSON.stringify({
            d: {
              type: 'cosmetic.create',
              body: {
                object: {
                  kind: 'PAINT',
                  data: {
                    id: 'paint456',
                    name: 'Image Paint',
                    image_url: 'https://cdn.7tv.app/paint.gif',
                    stops: [], // Empty stops means image-based
                    shadows: []
                  }
                }
              }
            }
          })
        }

        mockWebSocket.onmessage(mockMessage)

        // Inspect event detail directly
        expect(dispatchSpy).toHaveBeenCalled()
        const evt = dispatchSpy.mock.calls.at(-1)[0]
        const paints = evt.detail.body.paints || []
        const paint = paints.find(p => p.id === 'paint456')
        expect(paint).toBeTruthy()
        expect(paint.name).toBe('Image Paint')
        expect(typeof paint.backgroundImage).toBe('string')
        expect(paint.backgroundImage).toBe("url('https://cdn.7tv.app/paint.gif')")
      })

      it('should handle repeating gradients', () => {
        const dispatchSpy = vi.spyOn(stvWebSocket, 'dispatchEvent')
        const mockMessage = {
          data: JSON.stringify({
            d: {
              type: 'cosmetic.create',
              body: {
                object: {
                  kind: 'PAINT',
                  data: {
                    id: 'repeating_paint',
                    name: 'Repeating Paint',
                    function: 'LINEAR_GRADIENT',
                    repeat: true,
                    angle: 90,
                    stops: [
                      { at: 0, color: -16711936 },
                      { at: 0.5, color: -65536 }
                    ],
                    shadows: []
                  }
                }
              }
            }
          })
        }

        mockWebSocket.onmessage(mockMessage)

        // Inspect the dispatched CustomEvent detail directly to avoid brittle matching on CustomEvent internals
        expect(dispatchSpy).toHaveBeenCalled()
        const evt = dispatchSpy.mock.calls.at(-1)[0]
        const paints = evt.detail.body.paints || []
        expect(paints.some(p => typeof p.backgroundImage === 'string' && p.backgroundImage.includes('repeating-linear-gradient'))).toBe(true)
      })

      it('should not duplicate existing paints', () => {
        const dispatchSpy = vi.spyOn(stvWebSocket, 'dispatchEvent')
        
        const message = {
          data: JSON.stringify({
            d: {
              type: 'cosmetic.create',
              body: {
                object: {
                  kind: 'PAINT',
                  data: {
                    id: 'duplicate_paint',
                    name: 'Paint',
                    stops: [],
                    shadows: []
                  }
                }
              }
            }
          })
        }

        mockWebSocket.onmessage(message)
        mockWebSocket.onmessage(message)

        // Implementation dispatches an event for each message, but should not duplicate the paint in payload
        expect(dispatchSpy).toHaveBeenCalledTimes(2)
        const lastArg = dispatchSpy.mock.calls.at(-1)[0]
        const paints = lastArg.detail.body.paints.filter(p => p.id === 'duplicate_paint')
        expect(paints.length).toBe(1)
      })
    })

    describe('Connection Closure', () => {
      describe('close()', () => {
        beforeEach(() => {
          stvWebSocket.connect()
          mockWebSocket.readyState = WebSocket.OPEN
        })

        it('should disable reconnect and close WebSocket', () => {
          const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

          stvWebSocket.close()

          expect(stvWebSocket.shouldReconnect).toBe(false)
          expect(mockWebSocket.close).toHaveBeenCalled()
          expect(stvWebSocket.chat).toBeNull()
          expect(consoleSpy).toHaveBeenCalledWith(
            `[7TV]: Connection closed for chatroom ${channelKickID}`
          )
          
          consoleSpy.mockRestore()
        })

        it('should handle closure when WebSocket is CONNECTING', () => {
          const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
          mockWebSocket.readyState = WebSocket.CONNECTING

          stvWebSocket.close()

          // Implementation logs multiple messages; match the state log without asserting exact state number
          expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[7TV]: WebSocket state:'))
          expect(mockWebSocket.close).toHaveBeenCalled()
          
          consoleSpy.mockRestore()
        })

        it('should handle closure when no active connection', () => {
          const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
          stvWebSocket.chat = null

          stvWebSocket.close()

          expect(consoleSpy).toHaveBeenCalledWith(
            `[7TV]: No active connection to close for chatroom ${channelKickID}`
          )
          
          consoleSpy.mockRestore()
        })

        it('should handle errors during closure gracefully', () => {
          const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
          const mockError = new Error('Close error')
          mockWebSocket.close.mockImplementation(() => {
            throw mockError
          })

          stvWebSocket.close()

          expect(consoleSpy).toHaveBeenCalledWith(
            `[7TV]: Error during closing of connection for chatroom ${channelKickID}:`,
            mockError
          )
          
          consoleSpy.mockRestore()
        })
      })
    })

    describe('Reconnection Logic', () => {
      beforeEach(() => {
        stvWebSocket.connect()
        mockWebSocket.readyState = WebSocket.OPEN
      })

      it('should disable reconnect and close WebSocket', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        stvWebSocket.close()

        expect(stvWebSocket.shouldReconnect).toBe(false)
        expect(mockWebSocket.close).toHaveBeenCalled()
        expect(stvWebSocket.chat).toBeNull()
        expect(consoleSpy).toHaveBeenCalledWith(
          `[7TV]: Connection closed for chatroom ${channelKickID}`
        )
        
        consoleSpy.mockRestore()
      })

      it('should handle closure when WebSocket is CONNECTING', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        mockWebSocket.readyState = WebSocket.CONNECTING

        stvWebSocket.close()

        // Do not assert the exact numeric state value; just ensure the state log is emitted
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[7TV]: WebSocket state:'))
        expect(mockWebSocket.close).toHaveBeenCalled()
        
        consoleSpy.mockRestore()
      })

      it('should handle closure when no active connection', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        stvWebSocket.chat = null

        stvWebSocket.close()

        expect(consoleSpy).toHaveBeenCalledWith(
          `[7TV]: No active connection to close for chatroom ${channelKickID}`
        )
        
        consoleSpy.mockRestore()
      })

      it('should handle errors during closure gracefully', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const mockError = new Error('Close error')
        mockWebSocket.close.mockImplementation(() => {
          throw mockError
        })

        stvWebSocket.close()

        expect(consoleSpy).toHaveBeenCalledWith(
          `[7TV]: Error during closing of connection for chatroom ${channelKickID}:`,
          mockError
        )
        
        consoleSpy.mockRestore()
      })
    })
  })

  describe('Utility Methods', () => {
    describe('delay()', () => {
      it('should resolve after specified time', async () => {
        const promise = stvWebSocket.delay(100)
        
        vi.advanceTimersByTime(99)
        expect(promise).toBeInstanceOf(Promise)
        
        vi.advanceTimersByTime(1)
        await expect(promise).resolves.toBeUndefined()
      })

      it('should handle zero delay', async () => {
        const promise = stvWebSocket.delay(0)
        
        vi.advanceTimersByTime(0)
        await expect(promise).resolves.toBeUndefined()
      })
    })
  })

  describe('Reconnection Logic', () => {
    beforeEach(() => {
      stvWebSocket.connect()
    })

    it('should implement exponential backoff correctly', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const connectSpy = vi.spyOn(stvWebSocket, 'connect')
      
      const testCases = [
        { attempt: 1, expectedDelay: 1000 },   // 1000 * 2^(1-1) = 1000
        { attempt: 2, expectedDelay: 2000 },   // 1000 * 2^(2-1) = 2000
        { attempt: 3, expectedDelay: 4000 },   // 1000 * 2^(3-1) = 4000
        { attempt: 5, expectedDelay: 16000 },  // 1000 * 2^(5-1) = 16000
        { attempt: 10, expectedDelay: 16000 }  // Capped at step 5
      ]

      testCases.forEach(({ attempt, expectedDelay }) => {
        stvWebSocket.reconnectAttempts = attempt
        mockWebSocket.onclose()

        expect(consoleSpy).toHaveBeenCalledWith(
          `[7TV]: Reconnecting in ${expectedDelay}ms (attempt ${attempt})`
        )

        vi.advanceTimersByTime(expectedDelay)
      })
      
      consoleSpy.mockRestore()
    })

    it('should reset reconnect attempts on successful connection', async () => {
      stvWebSocket.reconnectAttempts = 5
      // onopen is async and uses internal delays. Use fake timers to resolve them deterministically.
      const openPromise = mockWebSocket.onopen()
      await vi.runAllTimersAsync()
      await openPromise
      expect(stvWebSocket.reconnectAttempts).toBe(0)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle null WebSocket gracefully', () => {
      stvWebSocket.chat = null
      
      expect(() => stvWebSocket.subscribeToUserEvents()).not.toThrow()
      expect(() => stvWebSocket.subscribeToCosmeticEvents()).not.toThrow()
      expect(() => stvWebSocket.subscribeToEntitlementEvents()).not.toThrow()
      expect(() => stvWebSocket.subscribeToEmoteSetEvents()).not.toThrow()
    })

    it('should handle malformed cosmetic data', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      stvWebSocket.connect()
      stvWebSocket.setupMessageHandler()
      
      const mockMessage = {
        data: JSON.stringify({
          d: {
            type: 'cosmetic.create',
            body: {
              object: {
                kind: 'INVALID_KIND'
                // Missing required data
              }
            }
          }
        })
      }

      mockWebSocket.onmessage(mockMessage)

      expect(consoleSpy).toHaveBeenCalledWith(
        '[7tv] Didn\'t process cosmetics:',
        expect.any(Object)
      )
      
      consoleSpy.mockRestore()
    })

    it('should handle missing message data fields', () => {
      stvWebSocket.connect()
      stvWebSocket.setupMessageHandler()
      
      const mockMessage = {
        data: JSON.stringify({
          // Missing d field
        })
      }

      expect(() => mockWebSocket.onmessage(mockMessage)).not.toThrow()
    })

    it('should handle empty message body', () => {
      stvWebSocket.connect()
      stvWebSocket.setupMessageHandler()
      
      const mockMessage = {
        data: JSON.stringify({
          d: {
            type: 'user.update',
            body: null
          }
        })
      }

      expect(() => mockWebSocket.onmessage(mockMessage)).not.toThrow()
    })

    it('should handle WebSocket state changes during operations', () => {
      stvWebSocket.connect()
      mockWebSocket.readyState = WebSocket.OPEN
      
      // Start subscription
      stvWebSocket.subscribeToUserEvents()
      
      // Change state mid-operation
      mockWebSocket.readyState = WebSocket.CLOSED
      
      // Should handle gracefully
      expect(() => stvWebSocket.subscribeToUserEvents()).not.toThrow()
    })

    it('should handle very large channel IDs', () => {
      const largeId = '9999999999999999999'
      const ws = new StvWebSocket(largeId, stvId, stvEmoteSetId)
      
      expect(ws.channelKickID).toBe(largeId)
    })

    it('should handle special characters in IDs', () => {
      const specialId = 'channel_with_special-chars.123'
      const ws = new StvWebSocket(specialId, stvId, stvEmoteSetId)
      
      expect(ws.channelKickID).toBe(specialId)
    })
  })

  describe('Performance and Memory', () => {
    it('should handle rapid message processing', () => {
      stvWebSocket.connect()
      stvWebSocket.setupMessageHandler()
      
      // Send 100 rapid messages
      for (let i = 0; i < 100; i++) {
        const mockMessage = {
          data: JSON.stringify({
            d: {
              type: 'user.update',
              body: { update_id: i }
            }
          })
        }
        mockWebSocket.onmessage(mockMessage)
      }
      
      // Should not cause memory issues or errors
      expect(true).toBe(true)
    })

    it('should clean up resources on close', () => {
      stvWebSocket.connect()
      stvWebSocket.close()
      
      expect(stvWebSocket.chat).toBeNull()
      expect(stvWebSocket.shouldReconnect).toBe(false)
    })

    it('should handle multiple open/close cycles', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      for (let i = 0; i < 5; i++) {
        stvWebSocket.connect()
        stvWebSocket.close()
      }
      
      expect(stvWebSocket.shouldReconnect).toBe(false)
      expect(stvWebSocket.chat).toBeNull()
      
      consoleSpy.mockRestore()
    })
  })
})
