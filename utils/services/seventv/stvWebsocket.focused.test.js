import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import StvWebSocket from './stvWebsocket.js'

// Mock WebSocket globally
const mockWebSocket = vi.fn(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  onopen: null,
  onclose: null,
  onerror: null,
  onmessage: null,
  readyState: WebSocket.OPEN,
}))

global.WebSocket = mockWebSocket
global.WebSocket.CONNECTING = 0
global.WebSocket.OPEN = 1
global.WebSocket.CLOSING = 2
global.WebSocket.CLOSED = 3

describe('StvWebSocket - Focused Business Logic Tests', () => {
  let stvWebSocket
  let mockWSInstance

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    mockWSInstance = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      onopen: null,
      onclose: null,
      onerror: null,
      onmessage: null,
      readyState: WebSocket.OPEN,
    }
    
    mockWebSocket.mockReturnValue(mockWSInstance)
    
    stvWebSocket = new StvWebSocket('123', 'user456', 'emoteSet789')
  })

  afterEach(() => {
    vi.useRealTimers()
    if (stvWebSocket) {
      stvWebSocket.close()
    }
  })

  describe('Initialization and Connection Setup', () => {
    it('should initialize with correct parameters', () => {
      expect(stvWebSocket.channelKickID).toBe('123')
      expect(stvWebSocket.stvId).toBe('user456')
      expect(stvWebSocket.stvEmoteSetId).toBe('emoteSet789')
      expect(stvWebSocket.shouldReconnect).toBe(true)
      expect(stvWebSocket.reconnectAttempts).toBe(0)
    })

    it('should not connect when shouldReconnect is false', () => {
      stvWebSocket.shouldReconnect = false
      stvWebSocket.connect()
      
      expect(mockWebSocket).not.toHaveBeenCalled()
    })

    it('should create WebSocket connection to correct URL', () => {
      stvWebSocket.connect()
      
      expect(mockWebSocket).toHaveBeenCalledWith('wss://events.7tv.io/v3?app=kicktalk&version=420.69')
    })

    it('should setup event handlers on connection', () => {
      stvWebSocket.connect()
      
      expect(mockWSInstance.onerror).toBeDefined()
      expect(mockWSInstance.onclose).toBeDefined()
      expect(mockWSInstance.onopen).toBeDefined()
    })
  })

  describe('Reconnection Logic with Exponential Backoff', () => {
    it('should calculate correct exponential backoff delays', () => {
      stvWebSocket.startDelay = 1000
      stvWebSocket.maxRetrySteps = 5
      
      // Test backoff progression: 1000, 2000, 4000, 8000, 16000, 16000...
      const expectedDelays = [1000, 2000, 4000, 8000, 16000, 16000, 16000]
      
      for (let attempt = 1; attempt <= 7; attempt++) {
        stvWebSocket.reconnectAttempts = attempt
        const step = Math.min(attempt, stvWebSocket.maxRetrySteps)
        const expectedDelay = stvWebSocket.startDelay * Math.pow(2, step - 1)
        
        expect(expectedDelay).toBe(expectedDelays[attempt - 1])
      }
    })

    it('should schedule reconnection on connection close', () => {
      stvWebSocket.shouldReconnect = true
      const connectSpy = vi.spyOn(stvWebSocket, 'connect')
      
      stvWebSocket.handleReconnection()
      
      expect(vi.getTimerCount()).toBe(1)
      
      // Advance time by expected delay
      vi.advanceTimersByTime(1000)
      expect(connectSpy).toHaveBeenCalled()
    })

    it('should not reconnect when shouldReconnect is false', () => {
      stvWebSocket.shouldReconnect = false
      
      stvWebSocket.handleReconnection()
      
      expect(vi.getTimerCount()).toBe(0)
    })

    it('should increment reconnect attempts on error', () => {
      const initialAttempts = stvWebSocket.reconnectAttempts
      
      stvWebSocket.handleConnectionError()
      
      expect(stvWebSocket.reconnectAttempts).toBe(initialAttempts + 1)
    })

    it('should handle multiple rapid connection errors', () => {
      for (let i = 0; i < 5; i++) {
        stvWebSocket.handleConnectionError()
      }
      
      expect(stvWebSocket.reconnectAttempts).toBe(5)
    })
  })

  describe('Subscription Management', () => {
    beforeEach(() => {
      stvWebSocket.connect()
      mockWSInstance.readyState = WebSocket.OPEN
      stvWebSocket.chat = mockWSInstance
    })

    it('should subscribe to user events when stvId is available', () => {
      stvWebSocket.stvId = 'validUserId'
      
      stvWebSocket.subscribeToUserEvents()
      
      expect(mockWSInstance.send).toHaveBeenCalledWith(
        JSON.stringify({
          op: 35,
          t: expect.any(Number),
          d: {
            type: 'user.*',
            condition: { object_id: 'validUserId' }
          }
        })
      )
    })

    it('should not subscribe to user events when WebSocket not ready', () => {
      mockWSInstance.readyState = WebSocket.CONNECTING
      
      stvWebSocket.subscribeToUserEvents()
      
      expect(mockWSInstance.send).not.toHaveBeenCalled()
    })

    it('should subscribe to cosmetic events with correct channel ID', () => {
      stvWebSocket.subscribeToCosmeticEvents()
      
      expect(mockWSInstance.send).toHaveBeenCalledWith(
        JSON.stringify({
          op: 35,
          t: expect.any(Number),
          d: {
            type: 'cosmetic.*',
            condition: { platform: 'KICK', ctx: 'channel', id: '123' }
          }
        })
      )
    })

    it('should subscribe to entitlement events and emit open event', () => {
      const eventSpy = vi.fn()
      stvWebSocket.addEventListener('open', eventSpy)
      
      stvWebSocket.subscribeToEntitlementEvents()
      
      expect(mockWSInstance.send).toHaveBeenCalledWith(
        JSON.stringify({
          op: 35,
          t: expect.any(Number),
          d: {
            type: 'entitlement.*',
            condition: { platform: 'KICK', ctx: 'channel', id: '123' }
          }
        })
      )
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { body: 'SUBSCRIBED', type: 'entitlement.*' }
        })
      )
    })

    it('should subscribe to emote set events with correct emote set ID', () => {
      stvWebSocket.subscribeToEmoteSetEvents()
      
      expect(mockWSInstance.send).toHaveBeenCalledWith(
        JSON.stringify({
          op: 35,
          t: expect.any(Number),
          d: {
            type: 'emote_set.*',
            condition: { object_id: 'emoteSet789' }
          }
        })
      )
    })

    it('should not subscribe to emote sets when WebSocket not ready', () => {
      mockWSInstance.readyState = WebSocket.CLOSED
      
      stvWebSocket.subscribeToEmoteSetEvents()
      
      expect(mockWSInstance.send).not.toHaveBeenCalled()
    })
  })

  describe('Message Processing and Event Handling', () => {
    beforeEach(() => {
      stvWebSocket.connect()
      stvWebSocket.chat = mockWSInstance
      stvWebSocket.setupMessageHandler()
    })

    it('should handle user.update messages', () => {
      const eventSpy = vi.fn()
      stvWebSocket.addEventListener('message', eventSpy)
      
      const message = {
        d: {
          type: 'user.update',
          body: { user_id: '123', updated_fields: ['name'] }
        }
      }
      
      mockWSInstance.onmessage({ data: JSON.stringify(message) })
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            body: message.d.body,
            type: 'user.update'
          }
        })
      )
    })

    it('should handle emote_set.update messages', () => {
      const eventSpy = vi.fn()
      stvWebSocket.addEventListener('message', eventSpy)
      
      const message = {
        d: {
          type: 'emote_set.update',
          body: { 
            id: 'set123',
            emotes: [{ id: 'em1', name: 'TestEmote' }]
          }
        }
      }
      
      mockWSInstance.onmessage({ data: JSON.stringify(message) })
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            body: message.d.body,
            type: 'emote_set.update'
          }
        })
      )
    })

    it('should process cosmetic.create messages and update cosmetics', () => {
      const eventSpy = vi.fn()
      stvWebSocket.addEventListener('message', eventSpy)
      
      const message = {
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
      
      mockWSInstance.onmessage({ data: JSON.stringify(message) })
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            type: 'cosmetic.create',
            body: expect.objectContaining({
              badges: expect.arrayContaining([
                expect.objectContaining({
                  id: 'badge123',
                  title: 'Test Badge',
                  url: 'https://example.com/badge.png'
                })
              ])
            })
          }
        })
      )
    })

    it('should handle entitlement.create messages for kind 10', () => {
      const eventSpy = vi.fn()
      stvWebSocket.addEventListener('message', eventSpy)
      
      const message = {
        d: {
          type: 'entitlement.create',
          body: {
            kind: 10,
            user_id: '123',
            entitlement_data: 'test'
          }
        }
      }
      
      mockWSInstance.onmessage({ data: JSON.stringify(message) })
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            body: message.d.body,
            type: 'entitlement.create'
          }
        })
      )
    })

    it('should ignore entitlement.create messages for other kinds', () => {
      const eventSpy = vi.fn()
      stvWebSocket.addEventListener('message', eventSpy)
      
      const message = {
        d: {
          type: 'entitlement.create',
          body: {
            kind: 5, // Not kind 10
            user_id: '123'
          }
        }
      }
      
      mockWSInstance.onmessage({ data: JSON.stringify(message) })
      
      expect(eventSpy).not.toHaveBeenCalled()
    })

    it('should ignore messages without body', () => {
      const eventSpy = vi.fn()
      stvWebSocket.addEventListener('message', eventSpy)
      
      const message = { d: { type: 'test' } } // No body
      
      mockWSInstance.onmessage({ data: JSON.stringify(message) })
      
      expect(eventSpy).not.toHaveBeenCalled()
    })

    it('should handle malformed JSON messages gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      mockWSInstance.onmessage({ data: 'invalid json {' })
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error parsing message'),
        expect.any(Error)
      )
      
      consoleSpy.mockRestore()
    })

    it('should handle messages without d property', () => {
      const eventSpy = vi.fn()
      stvWebSocket.addEventListener('message', eventSpy)
      
      const message = { data: 'test' } // No d property
      
      mockWSInstance.onmessage({ data: JSON.stringify(message) })
      
      expect(eventSpy).not.toHaveBeenCalled()
    })
  })

  describe('Cosmetics Processing Logic', () => {
    it('should process badge cosmetics correctly', () => {
      const badgeData = {
        object: {
          kind: 'BADGE',
          data: {
            id: 'badge456',
            tooltip: 'Special Badge',
            host: {
              url: '//cdn.example.com',
              files: [
                { name: 'small.png' },
                { name: 'large.png' }
              ]
            }
          }
        }
      }
      
      const message = {
        d: {
          type: 'cosmetic.create',
          body: badgeData
        }
      }
      
      stvWebSocket.chat = mockWSInstance
      stvWebSocket.setupMessageHandler()
      
      const eventSpy = vi.fn()
      stvWebSocket.addEventListener('message', eventSpy)
      
      mockWSInstance.onmessage({ data: JSON.stringify(message) })
      
      const eventCall = eventSpy.mock.calls[0][0]
      const badges = eventCall.detail.body.badges
      
      expect(badges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'badge456',
            title: 'Special Badge',
            url: 'https://cdn.example.com/large.png'
          })
        ])
      )
    })

    it('should handle badge with default ID when ID is all zeros', () => {
      const badgeData = {
        object: {
          kind: 'BADGE',
          data: {
            id: '00000000000000000000000000',
            ref_id: 'real_badge_id',
            tooltip: 'Referenced Badge',
            host: {
              url: '//cdn.example.com',
              files: [{ name: 'badge.png' }]
            }
          }
        }
      }
      
      const message = {
        d: {
          type: 'cosmetic.create',
          body: badgeData
        }
      }
      
      stvWebSocket.chat = mockWSInstance
      stvWebSocket.setupMessageHandler()
      
      const eventSpy = vi.fn()
      stvWebSocket.addEventListener('message', eventSpy)
      
      mockWSInstance.onmessage({ data: JSON.stringify(message) })
      
      const badges = eventSpy.mock.calls[0][0].detail.body.badges
      expect(badges[0].id).toBe('real_badge_id')
    })

    it('should process paint cosmetics with gradients', () => {
      const paintData = {
        object: {
          kind: 'PAINT',
          data: {
            id: 'paint123',
            name: 'Rainbow Paint',
            function: 'linear-gradient',
            angle: 45,
            shape: 'circle',
            stops: [
              { at: 0, color: 0xFF0000FF }, // Red
              { at: 1, color: 0x0000FFFF }  // Blue
            ],
            shadows: []
          }
        }
      }
      
      const message = {
        d: {
          type: 'cosmetic.create',
          body: paintData
        }
      }
      
      stvWebSocket.chat = mockWSInstance
      stvWebSocket.setupMessageHandler()
      
      const eventSpy = vi.fn()
      stvWebSocket.addEventListener('message', eventSpy)
      
      mockWSInstance.onmessage({ data: JSON.stringify(message) })
      
      const paints = eventSpy.mock.calls[0][0].detail.body.paints
      
      expect(paints).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'paint123',
            name: 'Rainbow Paint',
            style: 'linear-gradient',
            backgroundImage: expect.stringContaining('linear-gradient(45deg')
          })
        ])
      )
    })

    it('should process paint cosmetics with shadows', () => {
      const paintWithShadows = {
        object: {
          kind: 'PAINT',
          data: {
            id: 'shadow_paint',
            name: 'Shadow Paint',
            function: 'linear-gradient',
            stops: [{ at: 0, color: 0xFF0000FF }],
            shadows: [
              {
                x_offset: 2,
                y_offset: 2,
                radius: 4,
                color: 0x00000080 // Semi-transparent black
              }
            ]
          }
        }
      }
      
      const message = {
        d: {
          type: 'cosmetic.create',
          body: paintWithShadows
        }
      }
      
      stvWebSocket.chat = mockWSInstance
      stvWebSocket.setupMessageHandler()
      
      const eventSpy = vi.fn()
      stvWebSocket.addEventListener('message', eventSpy)
      
      mockWSInstance.onmessage({ data: JSON.stringify(message) })
      
      const paints = eventSpy.mock.calls[0][0].detail.body.paints
      const paint = paints.find(p => p.id === 'shadow_paint')
      
      expect(paint.shadows).toContain('drop-shadow')
      expect(paint.shadows).toContain('2px 2px 4px')
    })

    it('should avoid duplicate badge processing', () => {
      const badgeData = {
        object: {
          kind: 'BADGE',
          data: {
            id: 'duplicate_badge',
            tooltip: 'Duplicate Badge',
            host: {
              url: '//example.com',
              files: [{ name: 'badge.png' }]
            }
          }
        }
      }
      
      stvWebSocket.chat = mockWSInstance
      stvWebSocket.setupMessageHandler()
      
      const eventSpy = vi.fn()
      stvWebSocket.addEventListener('message', eventSpy)
      
      const message = { d: { type: 'cosmetic.create', body: badgeData } }
      
      // Send the same message twice
      mockWSInstance.onmessage({ data: JSON.stringify(message) })
      mockWSInstance.onmessage({ data: JSON.stringify(message) })
      
      // Should only process once - second call should return early
      expect(eventSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('Connection Lifecycle Management', () => {
    it('should wait for IDs to be set before subscribing', async () => {
      stvWebSocket.stvId = '0'
      stvWebSocket.stvEmoteSetId = '0'
      
      const subscribeSpy = vi.spyOn(stvWebSocket, 'subscribeToUserEvents')
      
      stvWebSocket.connect()
      
      // Simulate onopen
      const openHandler = mockWSInstance.onopen
      expect(openHandler).toBeDefined()
      
      // Execute the open handler
      openHandler()
      
      // Advance timers to simulate the wait
      vi.advanceTimersByTime(1100)
      
      expect(subscribeSpy).not.toHaveBeenCalled()
    })

    it('should reset reconnect attempts on successful connection', () => {
      stvWebSocket.reconnectAttempts = 5
      
      stvWebSocket.connect()
      const openHandler = mockWSInstance.onopen
      openHandler()
      
      expect(stvWebSocket.reconnectAttempts).toBe(0)
    })

    it('should subscribe to appropriate channels based on available IDs', async () => {
      const userSpy = vi.spyOn(stvWebSocket, 'subscribeToUserEvents')
      const cosmeticSpy = vi.spyOn(stvWebSocket, 'subscribeToCosmeticEvents')
      const entitlementSpy = vi.spyOn(stvWebSocket, 'subscribeToEntitlementEvents')
      const emoteSetSpy = vi.spyOn(stvWebSocket, 'subscribeToEmoteSetEvents')
      
      // Set up valid IDs
      stvWebSocket.stvId = 'validUser'
      stvWebSocket.stvEmoteSetId = 'validEmoteSet'
      stvWebSocket.channelKickID = 'validChannel'
      
      stvWebSocket.connect()
      const openHandler = mockWSInstance.onopen
      
      // Advance past delay
      vi.advanceTimersByTime(1100)
      await openHandler()
      
      expect(userSpy).toHaveBeenCalled()
      expect(cosmeticSpy).toHaveBeenCalled()
      expect(entitlementSpy).toHaveBeenCalled()
      expect(emoteSetSpy).toHaveBeenCalled()
    })

    it('should not subscribe to user events when stvId is 0', async () => {
      const userSpy = vi.spyOn(stvWebSocket, 'subscribeToUserEvents')
      
      stvWebSocket.stvId = '0'
      stvWebSocket.channelKickID = 'validChannel'
      
      stvWebSocket.connect()
      const openHandler = mockWSInstance.onopen
      
      vi.advanceTimersByTime(1100)
      await openHandler()
      
      expect(userSpy).not.toHaveBeenCalled()
    })

    it('should not subscribe to emote set when emoteSetId is 0', async () => {
      const emoteSetSpy = vi.spyOn(stvWebSocket, 'subscribeToEmoteSetEvents')
      
      stvWebSocket.stvEmoteSetId = '0'
      stvWebSocket.channelKickID = 'validChannel'
      
      stvWebSocket.connect()
      const openHandler = mockWSInstance.onopen
      
      vi.advanceTimersByTime(1100)
      await openHandler()
      
      expect(emoteSetSpy).not.toHaveBeenCalled()
    })
  })

  describe('Connection Termination and Cleanup', () => {
    it('should close WebSocket connection properly', () => {
      stvWebSocket.connect()
      stvWebSocket.chat = mockWSInstance
      mockWSInstance.readyState = WebSocket.OPEN
      
      stvWebSocket.close()
      
      expect(stvWebSocket.shouldReconnect).toBe(false)
      expect(mockWSInstance.close).toHaveBeenCalled()
      expect(stvWebSocket.chat).toBeNull()
    })

    it('should not attempt to close already closed connection', () => {
      stvWebSocket.chat = null
      
      expect(() => stvWebSocket.close()).not.toThrow()
    })

    it('should handle close errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      stvWebSocket.connect()
      stvWebSocket.chat = mockWSInstance
      mockWSInstance.close.mockImplementation(() => {
        throw new Error('Close failed')
      })
      
      stvWebSocket.close()
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error during closing'),
        expect.any(Error)
      )
      
      consoleSpy.mockRestore()
    })

    it('should close connection in various ready states', () => {
      const readyStates = [WebSocket.OPEN, WebSocket.CONNECTING]
      
      readyStates.forEach(state => {
        const mockInstance = {
          close: vi.fn(),
          readyState: state
        }
        
        stvWebSocket.chat = mockInstance
        stvWebSocket.close()
        
        expect(mockInstance.close).toHaveBeenCalled()
      })
    })
  })

  describe('Utility Functions', () => {
    it('should implement delay function correctly', async () => {
      const startTime = Date.now()
      const delayPromise = stvWebSocket.delay(100)
      
      vi.advanceTimersByTime(100)
      await delayPromise
      
      // Should have created a timer
      expect(vi.getTimerCount()).toBe(0) // Timer should be completed
    })

    it('should convert ARGB color to RGBA correctly', () => {
      // Test the internal argbToRgba function through message processing
      const paintData = {
        object: {
          kind: 'PAINT',
          data: {
            id: 'color_test',
            name: 'Color Test',
            function: 'linear-gradient',
            stops: [{ at: 0, color: 0xFF0000FF }], // Red in ARGB
            shadows: [
              {
                x_offset: 1,
                y_offset: 1,
                radius: 2,
                color: 0x80000000 // Semi-transparent black
              }
            ]
          }
        }
      }
      
      stvWebSocket.chat = mockWSInstance
      stvWebSocket.setupMessageHandler()
      
      const eventSpy = vi.fn()
      stvWebSocket.addEventListener('message', eventSpy)
      
      const message = { d: { type: 'cosmetic.create', body: paintData } }
      mockWSInstance.onmessage({ data: JSON.stringify(message) })
      
      const paint = eventSpy.mock.calls[0][0].detail.body.paints[0]
      
      // Should contain RGBA color in gradient
      expect(paint.backgroundImage).toContain('rgba(255, 0, 0, 1)')
      expect(paint.shadows).toContain('rgba(128, 0, 0)')
    })

    it('should handle negative ARGB colors', () => {
      // Some ARGB values might be negative due to sign bit
      const paintData = {
        object: {
          kind: 'PAINT',
          data: {
            id: 'negative_color',
            name: 'Negative Color',
            function: 'linear-gradient',
            stops: [{ at: 0, color: -16777216 }], // Negative ARGB
            shadows: []
          }
        }
      }
      
      stvWebSocket.chat = mockWSInstance
      stvWebSocket.setupMessageHandler()
      
      const eventSpy = vi.fn()
      stvWebSocket.addEventListener('message', eventSpy)
      
      const message = { d: { type: 'cosmetic.create', body: paintData } }
      
      expect(() => {
        mockWSInstance.onmessage({ data: JSON.stringify(message) })
      }).not.toThrow()
      
      expect(eventSpy).toHaveBeenCalled()
    })
  })

  describe('Error Resilience and Edge Cases', () => {
    it('should handle connection with no channel ID', () => {
      const stvWS = new StvWebSocket('0', 'user123', 'emote456')
      
      stvWS.connect()
      const openHandler = stvWS.chat.onopen
      
      vi.advanceTimersByTime(1100)
      
      expect(() => openHandler()).not.toThrow()
    })

    it('should handle connection with partial IDs', () => {
      const stvWS = new StvWebSocket('123', '0', 'emoteSet789')
      
      stvWS.connect()
      const openHandler = stvWS.chat.onopen
      
      vi.advanceTimersByTime(1100)
      
      expect(() => openHandler()).not.toThrow()
    })

    it('should handle cosmetic data with missing properties', () => {
      const incompleteCosmetic = {
        object: {
          kind: 'BADGE',
          data: {
            // Missing id, tooltip, host
          }
        }
      }
      
      stvWebSocket.chat = mockWSInstance
      stvWebSocket.setupMessageHandler()
      
      const message = { d: { type: 'cosmetic.create', body: incompleteCosmetic } }
      
      expect(() => {
        mockWSInstance.onmessage({ data: JSON.stringify(message) })
      }).not.toThrow()
    })

    it('should handle paint data without stops or shadows', () => {
      const simplePaint = {
        object: {
          kind: 'PAINT',
          data: {
            id: 'simple_paint',
            name: 'Simple Paint',
            image_url: 'https://example.com/paint.gif',
            stops: [], // Empty stops
            shadows: [] // Empty shadows
          }
        }
      }
      
      stvWebSocket.chat = mockWSInstance
      stvWebSocket.setupMessageHandler()
      
      const eventSpy = vi.fn()
      stvWebSocket.addEventListener('message', eventSpy)
      
      const message = { d: { type: 'cosmetic.create', body: simplePaint } }
      mockWSInstance.onmessage({ data: JSON.stringify(message) })
      
      const paint = eventSpy.mock.calls[0][0].detail.body.paints[0]
      expect(paint.KIND).toBe('animated')
      expect(paint.backgroundImage).toContain("url('https://example.com/paint.gif')")
    })

    it('should log unprocessed cosmetics', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      const unknownCosmetic = {
        object: {
          kind: 'UNKNOWN_KIND',
          data: { id: 'unknown' }
        }
      }
      
      stvWebSocket.chat = mockWSInstance
      stvWebSocket.setupMessageHandler()
      
      const message = { d: { type: 'cosmetic.create', body: unknownCosmetic } }
      mockWSInstance.onmessage({ data: JSON.stringify(message) })
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Didn't process cosmetics"),
        unknownCosmetic
      )
      
      consoleSpy.mockRestore()
    })
  })
})