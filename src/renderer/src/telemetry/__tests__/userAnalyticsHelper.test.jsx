import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the crypto module
vi.mock('crypto', () => {
  const mockRandomUUID = vi.fn()
  return {
    default: {
      randomUUID: mockRandomUUID
    },
    randomUUID: mockRandomUUID
  }
})

import {
  RendererUserAnalytics,
  USER_ACTION_TYPES,
  FEATURE_CATEGORIES,
  trackChatMessage,
  trackEmoteUse,
  trackChannelSwitch,
  trackFeatureUse,
  monitorUIAction,
  monitorRender,
  trackConnectionQuality,
  userAnalytics
} from '../userAnalyticsHelper.js'

import { randomUUID } from 'crypto'

// Mock console methods
const originalConsoleLog = console.log
const originalConsoleWarn = console.warn
const originalConsoleError = console.error

describe('RendererUserAnalytics', () => {
  let analytics
  let mockElectronAPI
  let mockPerformanceObserver
  let mockPerformanceMemory
  let mockPerformanceNow
  let mockSetInterval
  let mockClearTimeout
  let mockSetTimeout
  let mockAddEventListener
  let mockRemoveEventListener

  beforeEach(() => {
    // Reset console mocks
    console.log = vi.fn()
    console.warn = vi.fn()
    console.error = vi.fn()

    // Mock crypto.randomUUID
    vi.mocked(randomUUID).mockReturnValue('mock-uuid-12345')

    // Mock Date.now
    vi.spyOn(Date, 'now').mockReturnValue(1000000)

    // Mock Math.random - using a consistent value for predictable tests
    vi.spyOn(Math, 'random').mockReturnValue(0.6183503175473065) // This gives 'm9dr34' substring

    // Mock performance.now
    mockPerformanceNow = vi.fn().mockReturnValue(1000)
    Object.defineProperty(global, 'performance', {
      value: {
        now: mockPerformanceNow,
        memory: undefined // Will be set per test as needed
      },
      writable: true,
      configurable: true
    })

    // Mock PerformanceObserver
    mockPerformanceObserver = {
      observe: vi.fn(),
      disconnect: vi.fn(),
      unobserve: vi.fn()
    }
    global.PerformanceObserver = vi.fn(() => mockPerformanceObserver)

    // Mock setInterval and setTimeout
    mockSetInterval = vi.spyOn(global, 'setInterval')
    mockClearTimeout = vi.spyOn(global, 'clearTimeout')
    mockSetTimeout = vi.spyOn(global, 'setTimeout')

    // Mock window event listeners
    mockAddEventListener = vi.fn()
    mockRemoveEventListener = vi.fn()
    Object.defineProperty(global, 'window', {
      value: {
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        innerWidth: 1920,
        innerHeight: 1080
      },
      writable: true,
      configurable: true
    })

    // Mock navigator
    Object.defineProperty(global, 'navigator', {
      value: {
        userAgent: 'TestAgent/1.0'
      },
      writable: true,
      configurable: true
    })

    // Mock electronAPI
    mockElectronAPI = {
      telemetry: {
        startUserSession: vi.fn().mockResolvedValue({ sessionId: 'test-session' }),
        endUserSession: vi.fn().mockResolvedValue(),
        recordUserAction: vi.fn().mockResolvedValue(),
        recordFeatureUsage: vi.fn().mockResolvedValue(),
        recordChatEngagement: vi.fn().mockResolvedValue(),
        recordConnectionQuality: vi.fn().mockResolvedValue(),
        monitorUIInteraction: vi.fn().mockResolvedValue('good'),
        monitorComponentRender: vi.fn().mockResolvedValue('good'),
        monitorWebSocketLatency: vi.fn().mockResolvedValue('good'),
        monitorMemoryUsage: vi.fn().mockResolvedValue(),
        getUserAnalyticsData: vi.fn().mockResolvedValue({}),
        getPerformanceData: vi.fn().mockResolvedValue({})
      }
    }

    global.window.electronAPI = mockElectronAPI

    // Create fresh instance for each test
    analytics = new RendererUserAnalytics()
  })

  afterEach(() => {
    // Restore console
    console.log = originalConsoleLog
    console.warn = originalConsoleWarn
    console.error = originalConsoleError

    // Restore mocks
    vi.restoreAllMocks()
  })

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(analytics.sessionId).toBeNull()
      expect(analytics.userId).toBeNull()
      expect(analytics.isInitialized).toBe(false)
      expect(analytics.engagementStartTime).toBeNull()
      expect(analytics.lastActionTime).toBe(1000000)
    })

    it('should set up resource monitoring', () => {
      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        30000
      )
    })

    it('should set up window event listeners', () => {
      expect(mockAddEventListener).toHaveBeenCalledWith('focus', expect.any(Function))
      expect(mockAddEventListener).toHaveBeenCalledWith('blur', expect.any(Function))
      expect(mockAddEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function))
      expect(mockAddEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
    })

    it('should set up render observer when PerformanceObserver is available', () => {
      expect(global.PerformanceObserver).toHaveBeenCalled()
      expect(mockPerformanceObserver.observe).toHaveBeenCalledWith({
        entryTypes: ['measure', 'navigation']
      })
    })

    it('should handle PerformanceObserver setup failure gracefully', () => {
      global.PerformanceObserver = vi.fn(() => {
        throw new Error('PerformanceObserver not supported')
      })
      
      expect(() => new RendererUserAnalytics()).not.toThrow()
      expect(console.warn).toHaveBeenCalledWith(
        '[User Analytics] Performance observer setup failed:',
        'PerformanceObserver not supported'
      )
    })
  })

  describe('Session Management', () => {
    describe('init', () => {
      it('should initialize session successfully', async () => {
        const session = await analytics.init('testUser')

        expect(analytics.sessionId).toBe('session_mock-uuid-12345')
        expect(analytics.userId).toBe('testUser')
        expect(analytics.isInitialized).toBe(true)
        expect(analytics.lastActionTime).toBe(1000000)

        expect(mockElectronAPI.telemetry.startUserSession).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-12345',
          userId: 'testUser'
        })

        expect(mockElectronAPI.telemetry.recordUserAction).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-12345',
          actionType: USER_ACTION_TYPES.WINDOW_FOCUS,
          context: {
            app_startup: true,
            user_agent: 'TestAgent/1.0',
            viewport_width: 1920,
            viewport_height: 1080,
            interaction_start_time: 1000000,
            time_since_last_action: 0
          }
        })

        expect(console.log).toHaveBeenCalledWith(
          '[User Analytics] Session initialized: session_mock-uuid-12345 for user testUser'
        )

        expect(session).toEqual({ sessionId: 'test-session' })
      })

      it('should initialize with anonymous user when no userId provided', async () => {
        await analytics.init()

        expect(analytics.userId).toBeNull()
        expect(mockElectronAPI.telemetry.startUserSession).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-12345',
          userId: null
        })

        expect(console.log).toHaveBeenCalledWith(
          '[User Analytics] Session initialized: session_mock-uuid-12345 for user anonymous'
        )
      })

      it('should handle initialization failure', async () => {
        const error = new Error('Failed to start session')
        mockElectronAPI.telemetry.startUserSession.mockRejectedValue(error)

        await expect(analytics.init('testUser')).rejects.toThrow('Failed to start session')
        expect(console.error).toHaveBeenCalledWith(
          '[User Analytics] Failed to initialize session:',
          error
        )
      })

      it('should use fallback session ID when crypto.randomUUID throws', async () => {
        vi.mocked(randomUUID).mockImplementation(() => {
          throw new Error('randomUUID not available')
        })

        await analytics.init('testUser')

        expect(console.warn).toHaveBeenCalledWith(
          '[User Analytics] Using fallback session ID generation:',
          'randomUUID not available'
        )
        expect(analytics.sessionId).toBe('session_1000000_m9dr34')
      })

      it('should use fallback session ID when crypto.randomUUID returns undefined', async () => {
        vi.mocked(randomUUID).mockReturnValue(undefined)
        
        const newAnalytics = new RendererUserAnalytics()
        await newAnalytics.init('testUser')

        // When randomUUID returns undefined, it gets converted to string 'undefined'
        expect(newAnalytics.sessionId).toBe('session_undefined')
      })
    })

    describe('endSession', () => {
      it('should end session successfully when initialized', async () => {
        await analytics.init('testUser')
        await analytics.endSession()

        expect(mockElectronAPI.telemetry.endUserSession).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-12345'
        })

        expect(analytics.sessionId).toBeNull()
        expect(analytics.userId).toBeNull()
        expect(analytics.isInitialized).toBe(false)

        expect(console.log).toHaveBeenCalledWith(
          '[User Analytics] Session ended: session_mock-uuid-12345'
        )
      })

      it('should not call endUserSession when not initialized', async () => {
        await analytics.endSession()

        expect(mockElectronAPI.telemetry.endUserSession).not.toHaveBeenCalled()
      })

      it('should not call endUserSession when no sessionId', async () => {
        analytics.isInitialized = true
        analytics.sessionId = null

        await analytics.endSession()

        expect(mockElectronAPI.telemetry.endUserSession).not.toHaveBeenCalled()
      })

      it('should handle endSession failure gracefully', async () => {
        await analytics.init('testUser')
        
        const error = new Error('Failed to end session')
        mockElectronAPI.telemetry.endUserSession.mockRejectedValue(error)

        await analytics.endSession()

        expect(console.error).toHaveBeenCalledWith(
          '[User Analytics] Failed to end session:',
          error
        )
      })
    })
  })

  describe('Action Recording', () => {
    beforeEach(async () => {
      await analytics.init('testUser')
      vi.clearAllMocks() // Clear init-related calls
      Date.now.mockReturnValue(2000000) // Advance time
    })

    describe('recordAction', () => {
      it('should record action with context successfully', async () => {
        const result = await analytics.recordAction(USER_ACTION_TYPES.CHAT_SEND, {
          message: 'Hello world'
        })

        expect(result).toBe(true)
        expect(mockElectronAPI.telemetry.recordUserAction).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-12345',
          actionType: USER_ACTION_TYPES.CHAT_SEND,
          context: {
            message: 'Hello world',
            interaction_start_time: 2000000,
            time_since_last_action: 1000000
          }
        })

        expect(analytics.lastActionTime).toBe(2000000)
        expect(console.log).toHaveBeenCalledWith(
          '[User Analytics] Action recorded: chat_send'
        )
      })

      it('should start engagement tracking for chat actions', async () => {
        analytics.engagementStartTime = null
        
        await analytics.recordAction(USER_ACTION_TYPES.CHAT_SEND)
        
        expect(analytics.engagementStartTime).toBe(2000000)
      })

      it('should start engagement tracking for emote actions', async () => {
        analytics.engagementStartTime = null
        
        await analytics.recordAction(USER_ACTION_TYPES.EMOTE_USE)
        
        expect(analytics.engagementStartTime).toBe(2000000)
      })

      it('should not start engagement tracking for non-chat actions', async () => {
        analytics.engagementStartTime = null
        
        await analytics.recordAction(USER_ACTION_TYPES.WINDOW_FOCUS)
        
        expect(analytics.engagementStartTime).toBeNull()
      })

      it('should warn when not initialized', async () => {
        analytics.isInitialized = false
        
        const result = await analytics.recordAction(USER_ACTION_TYPES.CHAT_SEND)
        
        expect(result).toBeUndefined()
        expect(console.warn).toHaveBeenCalledWith(
          '[User Analytics] Cannot record action - session not initialized'
        )
        expect(mockElectronAPI.telemetry.recordUserAction).not.toHaveBeenCalled()
      })

      it('should handle recording failure', async () => {
        const error = new Error('Failed to record action')
        mockElectronAPI.telemetry.recordUserAction.mockRejectedValue(error)

        const result = await analytics.recordAction(USER_ACTION_TYPES.CHAT_SEND)

        expect(result).toBe(false)
        expect(console.error).toHaveBeenCalledWith(
          '[User Analytics] Failed to record action:',
          error
        )
      })
    })

    describe('recordFeatureUsage', () => {
      it('should record feature usage successfully', async () => {
        await analytics.recordFeatureUsage('chat_filters', 'toggle', { filter: 'profanity' })

        expect(mockElectronAPI.telemetry.recordFeatureUsage).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-12345',
          featureName: 'chat_filters',
          action: 'toggle',
          context: { filter: 'profanity' }
        })

        expect(console.log).toHaveBeenCalledWith(
          '[User Analytics] Feature usage: chat_filters.toggle'
        )
      })

      it('should not record when not initialized', async () => {
        analytics.isInitialized = false
        
        await analytics.recordFeatureUsage('test_feature', 'use')
        
        expect(mockElectronAPI.telemetry.recordFeatureUsage).not.toHaveBeenCalled()
      })

      it('should handle recording failure', async () => {
        const error = new Error('Failed to record feature usage')
        mockElectronAPI.telemetry.recordFeatureUsage.mockRejectedValue(error)

        await analytics.recordFeatureUsage('test_feature', 'use')

        expect(console.error).toHaveBeenCalledWith(
          '[User Analytics] Failed to record feature usage:',
          error
        )
      })
    })

    describe('recordChatEngagement', () => {
      it('should record chat engagement successfully', async () => {
        await analytics.recordChatEngagement(30)

        expect(mockElectronAPI.telemetry.recordChatEngagement).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-12345',
          engagementSeconds: 30
        })

        expect(console.log).toHaveBeenCalledWith(
          '[User Analytics] Chat engagement: 30s'
        )
      })

      it('should not record when not initialized', async () => {
        analytics.isInitialized = false
        
        await analytics.recordChatEngagement(30)
        
        expect(mockElectronAPI.telemetry.recordChatEngagement).not.toHaveBeenCalled()
      })

      it('should handle recording failure', async () => {
        const error = new Error('Failed to record engagement')
        mockElectronAPI.telemetry.recordChatEngagement.mockRejectedValue(error)

        await analytics.recordChatEngagement(30)

        expect(console.error).toHaveBeenCalledWith(
          '[User Analytics] Failed to record chat engagement:',
          error
        )
      })
    })

    describe('recordConnectionQuality', () => {
      it('should record connection quality successfully', async () => {
        await analytics.recordConnectionQuality(8, 'websocket_test')

        expect(mockElectronAPI.telemetry.recordConnectionQuality).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-12345',
          quality: 8,
          eventType: 'websocket_test'
        })

        expect(console.log).toHaveBeenCalledWith(
          '[User Analytics] Connection quality: 8/10 (websocket_test)'
        )
      })

      it('should not record when not initialized', async () => {
        analytics.isInitialized = false
        
        await analytics.recordConnectionQuality(5, 'test')
        
        expect(mockElectronAPI.telemetry.recordConnectionQuality).not.toHaveBeenCalled()
      })

      it('should handle recording failure', async () => {
        const error = new Error('Failed to record connection quality')
        mockElectronAPI.telemetry.recordConnectionQuality.mockRejectedValue(error)

        await analytics.recordConnectionQuality(7, 'test')

        expect(console.error).toHaveBeenCalledWith(
          '[User Analytics] Failed to record connection quality:',
          error
        )
      })
    })
  })

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      await analytics.init('testUser')
      vi.clearAllMocks()
    })

    describe('monitorUIInteraction', () => {
      it('should monitor UI interaction with execution time', async () => {
        const severity = await analytics.monitorUIInteraction('button_click', 50, { button_id: 'send' })

        expect(mockElectronAPI.telemetry.monitorUIInteraction).toHaveBeenCalledWith({
          interactionType: 'button_click',
          executionTime: 50,
          context: {
            button_id: 'send',
            session_id: 'session_mock-uuid-12345'
          }
        })

        expect(mockElectronAPI.telemetry.recordUserAction).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-12345',
          actionType: 'ui_button_click',
          context: {
            execution_time: 50,
            performance_severity: 'good',
            button_id: 'send',
            interaction_start_time: expect.any(Number),
            time_since_last_action: expect.any(Number)
          }
        })

        expect(severity).toBe('good')
      })

      it('should monitor UI interaction with callback function', async () => {
        mockPerformanceNow.mockReturnValueOnce(1000).mockReturnValueOnce(1150)
        
        const callback = vi.fn().mockResolvedValue('result')
        const severity = await analytics.monitorUIInteraction('form_submit', callback, { form_id: 'login' })

        expect(callback).toHaveBeenCalled()
        expect(mockElectronAPI.telemetry.monitorUIInteraction).toHaveBeenCalledWith({
          interactionType: 'form_submit',
          executionTime: 150,
          context: {
            form_id: 'login',
            session_id: 'session_mock-uuid-12345'
          }
        })

        expect(severity).toBe('good')
      })

      it('should return "good" when not initialized', async () => {
        analytics.isInitialized = false
        
        const severity = await analytics.monitorUIInteraction('test', 100)
        
        expect(severity).toBe('good')
        expect(mockElectronAPI.telemetry.monitorUIInteraction).not.toHaveBeenCalled()
      })

      it('should handle monitoring failure', async () => {
        const error = new Error('Failed to monitor interaction')
        mockElectronAPI.telemetry.monitorUIInteraction.mockRejectedValue(error)

        const severity = await analytics.monitorUIInteraction('test', 100)

        expect(severity).toBe('good')
        expect(console.error).toHaveBeenCalledWith(
          '[User Analytics] Failed to monitor UI interaction:',
          error
        )
      })
    })

    describe('monitorComponentRender', () => {
      it('should monitor component render performance', async () => {
        const severity = await analytics.monitorComponentRender('ChatMessage', 15, { message_id: '123' })

        expect(mockElectronAPI.telemetry.monitorComponentRender).toHaveBeenCalledWith({
          componentName: 'ChatMessage',
          renderTime: 15,
          context: {
            message_id: '123',
            session_id: 'session_mock-uuid-12345'
          }
        })

        expect(severity).toBe('good')
      })

      it('should return "good" when not initialized', async () => {
        analytics.isInitialized = false
        
        const severity = await analytics.monitorComponentRender('Test', 10)
        
        expect(severity).toBe('good')
        expect(mockElectronAPI.telemetry.monitorComponentRender).not.toHaveBeenCalled()
      })

      it('should handle monitoring failure', async () => {
        const error = new Error('Failed to monitor render')
        mockElectronAPI.telemetry.monitorComponentRender.mockRejectedValue(error)

        const severity = await analytics.monitorComponentRender('Test', 10)

        expect(severity).toBe('good')
        expect(console.error).toHaveBeenCalledWith(
          '[User Analytics] Failed to monitor component render:',
          error
        )
      })
    })

    describe('monitorWebSocketLatency', () => {
      it('should monitor WebSocket latency and record connection quality', async () => {
        mockElectronAPI.telemetry.monitorWebSocketLatency.mockResolvedValue('warning')
        
        const severity = await analytics.monitorWebSocketLatency(75, { endpoint: 'chat' })

        expect(mockElectronAPI.telemetry.monitorWebSocketLatency).toHaveBeenCalledWith({
          latency: 75,
          context: {
            endpoint: 'chat',
            session_id: 'session_mock-uuid-12345'
          }
        })

        expect(mockElectronAPI.telemetry.recordConnectionQuality).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-12345',
          quality: 8, // latencyToQualityScore(75)
          eventType: 'websocket_latency'
        })

        expect(severity).toBe('warning')
      })

      it('should return "good" when not initialized', async () => {
        analytics.isInitialized = false
        
        const severity = await analytics.monitorWebSocketLatency(100)
        
        expect(severity).toBe('good')
        expect(mockElectronAPI.telemetry.monitorWebSocketLatency).not.toHaveBeenCalled()
      })

      it('should handle monitoring failure', async () => {
        const error = new Error('Failed to monitor latency')
        mockElectronAPI.telemetry.monitorWebSocketLatency.mockRejectedValue(error)

        const severity = await analytics.monitorWebSocketLatency(100)

        expect(severity).toBe('good')
        expect(console.error).toHaveBeenCalledWith(
          '[User Analytics] Failed to monitor WebSocket latency:',
          error
        )
      })
    })
  })

  describe('Engagement Tracking', () => {
    beforeEach(async () => {
      await analytics.init('testUser')
      vi.clearAllMocks()
    })

    describe('startEngagementTracking', () => {
      it('should start engagement tracking when not already started', () => {
        Date.now.mockReturnValue(5000000)
        
        analytics.startEngagementTracking()
        
        expect(analytics.engagementStartTime).toBe(5000000)
      })

      it('should not reset engagement time if already started', () => {
        analytics.engagementStartTime = 3000000
        Date.now.mockReturnValue(5000000)
        
        analytics.startEngagementTracking()
        
        expect(analytics.engagementStartTime).toBe(3000000)
      })
    })

    describe('stopEngagementTracking', () => {
      it('should calculate and record engagement duration', async () => {
        analytics.engagementStartTime = 3000000
        Date.now.mockReturnValue(5000000)
        
        await analytics.stopEngagementTracking()
        
        expect(mockElectronAPI.telemetry.recordChatEngagement).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-12345',
          engagementSeconds: 2000 // Duration in seconds: (5000000 - 3000000) / 1000 = 2000
        })
        expect(analytics.engagementStartTime).toBeNull()
      })

      it('should not record engagement when not started', async () => {
        analytics.engagementStartTime = null
        
        await analytics.stopEngagementTracking()
        
        expect(mockElectronAPI.telemetry.recordChatEngagement).not.toHaveBeenCalled()
      })
    })
  })

  describe('Utility Functions', () => {
    describe('latencyToQualityScore', () => {
      it('should return correct quality scores for different latencies', () => {
        expect(analytics.latencyToQualityScore(25)).toBe(10)
        expect(analytics.latencyToQualityScore(75)).toBe(8)
        expect(analytics.latencyToQualityScore(150)).toBe(6)
        expect(analytics.latencyToQualityScore(350)).toBe(4)
        expect(analytics.latencyToQualityScore(750)).toBe(2)
        expect(analytics.latencyToQualityScore(1500)).toBe(1)
      })

      it('should handle edge cases', () => {
        expect(analytics.latencyToQualityScore(0)).toBe(10)
        expect(analytics.latencyToQualityScore(50)).toBe(8) // Boundary
        expect(analytics.latencyToQualityScore(100)).toBe(6) // Boundary
        expect(analytics.latencyToQualityScore(1000)).toBe(1) // Boundary - 1000 is NOT < 1000, so it returns 1
      })
    })
  })

  describe('Window Event Handling', () => {
    beforeEach(async () => {
      await analytics.init('testUser')
      // Don't clear mocks here because we need the constructor calls for addEventListener
    })

    it('should handle window focus event', async () => {
      // Find the focus event listener that was registered during construction
      const focusCall = mockAddEventListener.mock.calls.find(call => call[0] === 'focus')
      expect(focusCall).toBeDefined()
      
      const focusHandler = focusCall[1]
      await focusHandler()
      
      expect(mockElectronAPI.telemetry.recordUserAction).toHaveBeenCalledWith({
        sessionId: 'session_mock-uuid-12345',
        actionType: USER_ACTION_TYPES.WINDOW_FOCUS,
        context: {
          engagement_resumed: true,
          interaction_start_time: expect.any(Number),
          time_since_last_action: expect.any(Number)
        }
      })
    })

    it('should handle window blur event', async () => {
      analytics.engagementStartTime = 1000000
      Date.now.mockReturnValue(3000000)
      
      const blurCall = mockAddEventListener.mock.calls.find(call => call[0] === 'blur')
      expect(blurCall).toBeDefined()
      
      const blurHandler = blurCall[1]
      await blurHandler()
      
      expect(mockElectronAPI.telemetry.recordUserAction).toHaveBeenCalledWith({
        sessionId: 'session_mock-uuid-12345',
        actionType: USER_ACTION_TYPES.WINDOW_BLUR,
        context: {
          engagement_paused: true,
          interaction_start_time: expect.any(Number),
          time_since_last_action: expect.any(Number)
        }
      })
      
      // Should also stop engagement tracking
      expect(mockElectronAPI.telemetry.recordChatEngagement).toHaveBeenCalledWith({
        sessionId: 'session_mock-uuid-12345',
        engagementSeconds: 2000 // (3000000 - 1000000) / 1000 = 2000
      })
    })

    it('should handle beforeunload event', async () => {
      const beforeUnloadCall = mockAddEventListener.mock.calls.find(call => call[0] === 'beforeunload')
      expect(beforeUnloadCall).toBeDefined()
      
      const beforeUnloadHandler = beforeUnloadCall[1]
      await beforeUnloadHandler()
      
      expect(mockElectronAPI.telemetry.endUserSession).toHaveBeenCalledWith({
        sessionId: 'session_mock-uuid-12345'
      })
    })

    it('should handle resize event with debouncing', async () => {
      Date.now.mockReturnValue(4000000)
      
      const resizeCall = mockAddEventListener.mock.calls.find(call => call[0] === 'resize')
      expect(resizeCall).toBeDefined()
      
      const resizeHandler = resizeCall[1]
      
      // Trigger resize multiple times
      resizeHandler()
      resizeHandler()
      resizeHandler()
      
      expect(mockClearTimeout).toHaveBeenCalled()
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 500)
      
      // Execute the timeout callback
      const timeoutCallback = mockSetTimeout.mock.calls[mockSetTimeout.mock.calls.length - 1][0]
      await timeoutCallback()
      
      expect(mockElectronAPI.telemetry.recordUserAction).toHaveBeenCalledWith({
        sessionId: 'session_mock-uuid-12345',
        actionType: 'window_resize',
        context: {
          viewport_width: 1920,
          viewport_height: 1080,
          interaction_start_time: 4000000,
          time_since_last_action: expect.any(Number)
        }
      })
    })
  })

  describe('Resource Monitoring', () => {
    beforeEach(async () => {
      await analytics.init('testUser')
      // Don't clear mocks here because we need the constructor calls for setInterval
    })

    it('should monitor memory usage when performance.memory is available', async () => {
      // Mock performance.memory
      Object.defineProperty(global.performance, 'memory', {
        value: {
          usedJSHeapSize: 52428800, // 50MB
          totalJSHeapSize: 104857600, // 100MB
          jsHeapSizeLimit: 2147483648 // 2GB
        },
        writable: true,
        configurable: true
      })

      // Get the interval callback and execute it
      const intervalCall = mockSetInterval.mock.calls.find(call => call[1] === 30000)
      expect(intervalCall).toBeDefined()
      
      const intervalCallback = intervalCall[0]
      await intervalCallback()

      expect(mockElectronAPI.telemetry.monitorMemoryUsage).toHaveBeenCalledWith({
        memoryMB: 50,
        context: {
          session_id: 'session_mock-uuid-12345',
          heap_total: 100,
          heap_limit: 2048
        }
      })
    })

    it('should not monitor memory when performance.memory is unavailable', async () => {
      Object.defineProperty(global.performance, 'memory', {
        value: undefined,
        writable: true,
        configurable: true
      })

      const intervalCall = mockSetInterval.mock.calls.find(call => call[1] === 30000)
      expect(intervalCall).toBeDefined()
      
      const intervalCallback = intervalCall[0]
      await intervalCallback()

      expect(mockElectronAPI.telemetry.monitorMemoryUsage).not.toHaveBeenCalled()
    })

    it('should not monitor memory when not initialized', async () => {
      analytics.isInitialized = false
      Object.defineProperty(global.performance, 'memory', {
        value: { usedJSHeapSize: 1000000, totalJSHeapSize: 2000000, jsHeapSizeLimit: 4000000 },
        writable: true,
        configurable: true
      })

      const intervalCall = mockSetInterval.mock.calls.find(call => call[1] === 30000)
      expect(intervalCall).toBeDefined()
      
      const intervalCallback = intervalCall[0]
      await intervalCallback()

      expect(mockElectronAPI.telemetry.monitorMemoryUsage).not.toHaveBeenCalled()
    })

    it('should handle memory monitoring errors', async () => {
      Object.defineProperty(global.performance, 'memory', {
        get() { throw new Error('Memory access denied') },
        configurable: true
      })

      const intervalCall = mockSetInterval.mock.calls.find(call => call[1] === 30000)
      expect(intervalCall).toBeDefined()
      
      const intervalCallback = intervalCall[0]
      await intervalCallback()

      expect(console.warn).toHaveBeenCalledWith(
        '[User Analytics] Memory monitoring error:',
        'Memory access denied'
      )
    })
  })

  describe('Performance Observer', () => {
    beforeEach(async () => {
      await analytics.init('testUser')
      // Don't clear mocks here because we need the constructor calls for PerformanceObserver
    })

    it('should process performance entries from observer', async () => {
      const observerCall = global.PerformanceObserver.mock.calls.find(call => call.length > 0)
      expect(observerCall).toBeDefined()
      
      const observerCallback = observerCall[0]
      
      const mockEntries = [
        { entryType: 'measure', name: 'component-render', duration: 15.5, startTime: 1000 },
        { entryType: 'navigation', name: 'page-load', duration: 250, startTime: 0 }
      ]

      const mockList = {
        getEntries: vi.fn().mockReturnValue(mockEntries)
      }

      await observerCallback(mockList)

      expect(mockElectronAPI.telemetry.monitorComponentRender).toHaveBeenCalledTimes(2)
      expect(mockElectronAPI.telemetry.monitorComponentRender).toHaveBeenCalledWith({
        componentName: 'component-render',
        renderTime: 15.5,
        context: {
          entry_type: 'measure',
          start_time: 1000,
          session_id: 'session_mock-uuid-12345'
        }
      })
      expect(mockElectronAPI.telemetry.monitorComponentRender).toHaveBeenCalledWith({
        componentName: 'page-load',
        renderTime: 250,
        context: {
          entry_type: 'navigation',
          start_time: 0,
          session_id: 'session_mock-uuid-12345'
        }
      })
    })

    it('should handle entries without names', async () => {
      const observerCall = global.PerformanceObserver.mock.calls.find(call => call.length > 0)
      expect(observerCall).toBeDefined()
      
      const observerCallback = observerCall[0]
      
      const mockEntries = [
        { entryType: 'measure', duration: 10, startTime: 1000 }
      ]

      const mockList = {
        getEntries: vi.fn().mockReturnValue(mockEntries)
      }

      await observerCallback(mockList)

      expect(mockElectronAPI.telemetry.monitorComponentRender).toHaveBeenCalledWith({
        componentName: 'unknown_render',
        renderTime: 10,
        context: {
          entry_type: 'measure',
          start_time: 1000,
          session_id: 'session_mock-uuid-12345'
        }
      })
    })
  })

  describe('Debug Functions', () => {
    beforeEach(async () => {
      await analytics.init('testUser')
      vi.clearAllMocks()
    })

    describe('getAnalyticsData', () => {
      it('should return analytics data when initialized', async () => {
        const mockData = { sessions: 5, actions: 100 }
        mockElectronAPI.telemetry.getUserAnalyticsData.mockResolvedValue(mockData)

        const result = await analytics.getAnalyticsData()

        expect(result).toEqual(mockData)
        expect(mockElectronAPI.telemetry.getUserAnalyticsData).toHaveBeenCalled()
      })

      it('should return empty object when not initialized', async () => {
        analytics.isInitialized = false

        const result = await analytics.getAnalyticsData()

        expect(result).toEqual({})
        expect(mockElectronAPI.telemetry.getUserAnalyticsData).not.toHaveBeenCalled()
      })

      it('should handle errors gracefully', async () => {
        const error = new Error('Failed to get data')
        mockElectronAPI.telemetry.getUserAnalyticsData.mockRejectedValue(error)

        const result = await analytics.getAnalyticsData()

        expect(result).toEqual({})
        expect(console.error).toHaveBeenCalledWith(
          '[User Analytics] Failed to get analytics data:',
          error
        )
      })
    })

    describe('getPerformanceData', () => {
      it('should return performance data when initialized', async () => {
        const mockData = { averageRenderTime: 15.5, memoryUsage: 50 }
        mockElectronAPI.telemetry.getPerformanceData.mockResolvedValue(mockData)

        const result = await analytics.getPerformanceData()

        expect(result).toEqual(mockData)
        expect(mockElectronAPI.telemetry.getPerformanceData).toHaveBeenCalled()
      })

      it('should return empty object when not initialized', async () => {
        analytics.isInitialized = false

        const result = await analytics.getPerformanceData()

        expect(result).toEqual({})
        expect(mockElectronAPI.telemetry.getPerformanceData).not.toHaveBeenCalled()
      })

      it('should handle errors gracefully', async () => {
        const error = new Error('Failed to get data')
        mockElectronAPI.telemetry.getPerformanceData.mockRejectedValue(error)

        const result = await analytics.getPerformanceData()

        expect(result).toEqual({})
        expect(console.error).toHaveBeenCalledWith(
          '[User Analytics] Failed to get performance data:',
          error
        )
      })
    })
  })

  describe('Constants and Exports', () => {
    it('should export USER_ACTION_TYPES correctly', () => {
      expect(USER_ACTION_TYPES).toEqual({
        CHAT_SEND: 'chat_send',
        CHAT_SCROLL: 'chat_scroll',
        EMOTE_USE: 'emote_use',
        EMOTE_SEARCH: 'emote_search',
        CHANNEL_SWITCH: 'channel_switch',
        SETTINGS_CHANGE: 'settings_change',
        WINDOW_FOCUS: 'window_focus',
        WINDOW_BLUR: 'window_blur',
        THEME_CHANGE: 'theme_change',
        FILTER_TOGGLE: 'filter_toggle',
        MODERATION_ACTION: 'moderation_action'
      })
    })

    it('should export FEATURE_CATEGORIES correctly', () => {
      expect(FEATURE_CATEGORIES).toEqual({
        CHAT: 'chat',
        EMOTES: 'emotes',
        MODERATION: 'moderation',
        CUSTOMIZATION: 'customization',
        NAVIGATION: 'navigation'
      })
    })
  })

  describe('Convenience Functions', () => {
    beforeEach(() => {
      // Mock the global instance methods
      vi.spyOn(userAnalytics, 'recordAction').mockResolvedValue(true)
      vi.spyOn(userAnalytics, 'recordFeatureUsage').mockResolvedValue()
      vi.spyOn(userAnalytics, 'recordConnectionQuality').mockResolvedValue()
      vi.spyOn(userAnalytics, 'monitorUIInteraction').mockResolvedValue('good')
      vi.spyOn(userAnalytics, 'monitorComponentRender').mockResolvedValue('good')
    })

    describe('trackChatMessage', () => {
      it('should call recordAction with correct parameters', async () => {
        const context = { message_length: 25 }
        const result = await trackChatMessage(context)

        expect(userAnalytics.recordAction).toHaveBeenCalledWith(
          USER_ACTION_TYPES.CHAT_SEND,
          context
        )
        expect(result).toBe(true)
      })

      it('should work with no context', async () => {
        await trackChatMessage()
        
        expect(userAnalytics.recordAction).toHaveBeenCalledWith(
          USER_ACTION_TYPES.CHAT_SEND,
          {}
        )
      })
    })

    describe('trackEmoteUse', () => {
      it('should call recordAction with emote name and context', async () => {
        const result = await trackEmoteUse('Kappa', { source: '7tv' })

        expect(userAnalytics.recordAction).toHaveBeenCalledWith(
          USER_ACTION_TYPES.EMOTE_USE,
          {
            emote_name: 'Kappa',
            source: '7tv'
          }
        )
        expect(result).toBe(true)
      })

      it('should work with no context', async () => {
        await trackEmoteUse('PogChamp')
        
        expect(userAnalytics.recordAction).toHaveBeenCalledWith(
          USER_ACTION_TYPES.EMOTE_USE,
          {
            emote_name: 'PogChamp'
          }
        )
      })
    })

    describe('trackChannelSwitch', () => {
      it('should call recordAction with channel information', async () => {
        const result = await trackChannelSwitch('channel1', 'channel2', { reason: 'user_click' })

        expect(userAnalytics.recordAction).toHaveBeenCalledWith(
          USER_ACTION_TYPES.CHANNEL_SWITCH,
          {
            from_channel: 'channel1',
            to_channel: 'channel2',
            reason: 'user_click'
          }
        )
        expect(result).toBe(true)
      })
    })

    describe('trackFeatureUse', () => {
      it('should call recordFeatureUsage', async () => {
        const result = await trackFeatureUse('chat_filters', 'toggle', { filter: 'emotes' })

        expect(userAnalytics.recordFeatureUsage).toHaveBeenCalledWith(
          'chat_filters',
          'toggle',
          { filter: 'emotes' }
        )
        expect(result).toBeUndefined()
      })
    })

    describe('monitorUIAction', () => {
      it('should call monitorUIInteraction', async () => {
        const callback = vi.fn()
        const result = await monitorUIAction('form_submit', callback, { form: 'login' })

        expect(userAnalytics.monitorUIInteraction).toHaveBeenCalledWith(
          'form_submit',
          callback,
          { form: 'login' }
        )
        expect(result).toBe('good')
      })
    })

    describe('monitorRender', () => {
      it('should call monitorComponentRender', async () => {
        const result = await monitorRender('ChatMessage', 12.5, { message_id: '123' })

        expect(userAnalytics.monitorComponentRender).toHaveBeenCalledWith(
          'ChatMessage',
          12.5,
          { message_id: '123' }
        )
        expect(result).toBe('good')
      })
    })

    describe('trackConnectionQuality', () => {
      it('should call recordConnectionQuality with default event type', async () => {
        const result = await trackConnectionQuality(8)

        expect(userAnalytics.recordConnectionQuality).toHaveBeenCalledWith(8, 'measurement')
        expect(result).toBeUndefined()
      })

      it('should call recordConnectionQuality with custom event type', async () => {
        await trackConnectionQuality(5, 'websocket_error')

        expect(userAnalytics.recordConnectionQuality).toHaveBeenCalledWith(5, 'websocket_error')
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing window.electronAPI gracefully', async () => {
      delete global.window.electronAPI
      
      const newAnalytics = new RendererUserAnalytics()
      
      await expect(newAnalytics.init('test')).rejects.toThrow()
    })

    it('should handle PerformanceObserver being undefined', () => {
      global.PerformanceObserver = undefined
      
      expect(() => new RendererUserAnalytics()).not.toThrow()
    })

    it('should handle performance.memory throwing errors', async () => {
      await analytics.init('testUser')
      
      Object.defineProperty(global.performance, 'memory', {
        get() { throw new Error('Memory access error') },
        configurable: true
      })

      const intervalCallback = mockSetInterval.mock.calls[0][0]
      
      expect(async () => await intervalCallback()).not.toThrow()
    })

    it('should handle window event listener setup with missing window', () => {
      const originalWindow = global.window
      delete global.window
      
      // This should throw because the constructor accesses window properties
      expect(() => new RendererUserAnalytics()).toThrow('window is not defined')
      
      global.window = originalWindow
    })
  })
})