import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  UserAnalytics, 
  USER_ACTION_TYPES, 
  FEATURE_CATEGORIES,
  UserSession
} from '../user-analytics.js'

// Mock OpenTelemetry APIs
const mockHistogramInstance = {
  record: vi.fn()
}

const mockCounterInstance = {
  add: vi.fn()
}

const mockObservableGaugeInstance = {
  addCallback: vi.fn()
}

const mockMeter = {
  createHistogram: vi.fn(() => mockHistogramInstance),
  createCounter: vi.fn(() => mockCounterInstance),
  createObservableGauge: vi.fn(() => mockObservableGaugeInstance)
}

const mockSpan = {
  setAttributes: vi.fn(),
  recordException: vi.fn(),
  end: vi.fn()
}

const mockTracer = {
  startActiveSpan: vi.fn((name, callback) => callback(mockSpan))
}

const mockMetrics = {
  getMeter: vi.fn(() => mockMeter)
}

const mockTrace = {
  getTracer: vi.fn(() => mockTracer)
}

const mockContext = {
  active: vi.fn()
}

// Mock ErrorMonitor
const mockErrorMonitor = {
  recordError: vi.fn(() => ({
    error_id: 'error_123',
    category: 'NETWORK',
    severity: 'high'
  }))
}

// Mock modules
vi.mock('@opentelemetry/api', () => ({
  metrics: mockMetrics,
  trace: mockTrace,
  context: mockContext
}))

vi.mock('../error-monitoring', () => ({
  ErrorMonitor: mockErrorMonitor
}))

vi.mock('../../package.json', () => ({
  default: {
    version: '1.0.0-test'
  }
}))

describe('UserAnalytics', () => {
  let originalConsoleLog
  let originalDateNow
  let originalSetInterval
  let originalClearInterval

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock console methods
    originalConsoleLog = console.log
    console.log = vi.fn()
    
    // Mock Date.now for consistent timestamps
    originalDateNow = Date.now
    Date.now = vi.fn(() => 1640000000000)
    
    // Mock interval functions
    originalSetInterval = global.setInterval
    originalClearInterval = global.clearInterval
    global.setInterval = vi.fn((fn, delay) => {
      // Don't actually set intervals in tests
      return 'mock_interval'
    })
    global.clearInterval = vi.fn()
    
    // Clear any existing user analytics state by calling forceCleanup
    UserAnalytics.forceCleanup()
  })

  afterEach(() => {
    console.log = originalConsoleLog
    Date.now = originalDateNow
    global.setInterval = originalSetInterval
    global.clearInterval = originalClearInterval
  })

  describe('Session Management', () => {
    it('should start a new session', () => {
      const session = UserAnalytics.startSession('session123', 'user456')
      
      expect(session).toBeInstanceOf(UserSession)
      expect(session.sessionId).toBe('session123')
      expect(session.userId).toBe('user456')
      expect(session.isActive).toBe(true)
      
      expect(console.log).toHaveBeenCalledWith(
        '[User Analytics] Started session session123 for user user456'
      )
    })

    it('should start session with anonymous user', () => {
      const session = UserAnalytics.startSession('session123')
      
      expect(session.userId).toBe('anonymous')
      
      expect(console.log).toHaveBeenCalledWith(
        '[User Analytics] Started session session123 for user anonymous'
      )
    })

    it('should end a session successfully', () => {
      const session = UserAnalytics.startSession('session123', 'user456')
      session.actions = [
        { type: 'chat_send', timestamp: Date.now() },
        { type: 'emote_use', timestamp: Date.now() }
      ]
      
      UserAnalytics.endSession('session123')
      
      expect(mockHistogramInstance.record).toHaveBeenCalled() // For session duration
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Session satisfaction:')
      )
    })

    it('should handle ending non-existent session', () => {
      UserAnalytics.endSession('non_existent_session')
      
      expect(console.warn).toHaveBeenCalledWith(
        '[User Analytics] Attempted to end non-existent session: non_existent_session'
      )
    })

    it('should track session analytics data', () => {
      const session = UserAnalytics.startSession('session123', 'user456')
      
      // Add some activity
      UserAnalytics.recordUserAction('session123', USER_ACTION_TYPES.CHAT_SEND)
      UserAnalytics.recordFeatureUsage('session123', 'chat', 'send_message')
      
      UserAnalytics.endSession('session123')
      
      const analyticsData = UserAnalytics.getAnalyticsData()
      
      expect(analyticsData.total_sessions).toBe(1)
      expect(analyticsData.active_sessions).toBe(0)
    })
  })

  describe('User Action Recording', () => {
    beforeEach(() => {
      UserAnalytics.startSession('session123', 'user456')
    })

    it('should record user action successfully', () => {
      const result = UserAnalytics.recordUserAction(
        'session123', 
        USER_ACTION_TYPES.CHAT_SEND,
        { message: 'hello' }
      )
      
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
        'user_action_chat_send', 
        expect.any(Function)
      )
      
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        action_type: USER_ACTION_TYPES.CHAT_SEND,
        user_id: 'user456',
        session_id: 'session123',
        feature_category: 'chat'
      })
      
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'user.id': 'user456',
        'user.session_id': 'session123',
        'user.action': USER_ACTION_TYPES.CHAT_SEND,
        'user.satisfaction_score': expect.any(Number)
      })
    })

    it('should record UI interaction time', () => {
      const interactionStartTime = Date.now() - 150 // 150ms ago
      
      UserAnalytics.recordUserAction(
        'session123',
        USER_ACTION_TYPES.EMOTE_USE,
        { interaction_start_time: interactionStartTime }
      )
      
      expect(mockHistogramInstance.record).toHaveBeenCalledWith(150, {
        action_type: USER_ACTION_TYPES.EMOTE_USE,
        user_id: 'user456'
      })
    })

    it('should handle action for non-existent session', () => {
      UserAnalytics.recordUserAction('non_existent', USER_ACTION_TYPES.CHAT_SEND)
      
      expect(console.warn).toHaveBeenCalledWith(
        '[User Analytics] Attempted to record action for non-existent session: non_existent'
      )
    })

    it('should handle errors during action recording', () => {
      const error = new Error('Recording failed')
      mockTracer.startActiveSpan.mockImplementationOnce((name, callback) => {
        const span = {
          ...mockSpan,
          recordException: vi.fn(),
          end: vi.fn()
        }
        
        // Simulate error in callback
        try {
          throw error
        } catch (e) {
          span.recordException(e)
          throw e
        }
      })
      
      expect(() => {
        UserAnalytics.recordUserAction('session123', USER_ACTION_TYPES.CHAT_SEND)
      }).toThrow('Recording failed')
    })
  })

  describe('Feature Usage Tracking', () => {
    beforeEach(() => {
      UserAnalytics.startSession('session123', 'user456')
    })

    it('should record feature usage', () => {
      UserAnalytics.recordFeatureUsage('session123', 'emotes', 'use_emote')
      
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        feature: 'emotes',
        action: 'use_emote',
        user_id: 'user456',
        session_id: 'session123',
        adoption_stage: 'new'
      })
      
      expect(console.log).toHaveBeenCalledWith(
        '[User Analytics] Feature usage: emotes.use_emote by user456'
      )
    })

    it('should handle feature usage for non-existent session', () => {
      UserAnalytics.recordFeatureUsage('non_existent', 'chat', 'send_message')
      
      // Should not throw error, just silently return
      expect(mockCounterInstance.add).not.toHaveBeenCalled()
    })

    it('should track feature adoption progression', () => {
      // First feature usage
      UserAnalytics.recordFeatureUsage('session123', 'chat', 'send_message')
      
      // Should show as "first_use"
      UserAnalytics.recordFeatureUsage('session123', 'emotes', 'use_emote')
      
      expect(mockCounterInstance.add).toHaveBeenLastCalledWith(1, 
        expect.objectContaining({
          adoption_stage: 'first_use'
        })
      )
    })
  })

  describe('Chat Engagement Tracking', () => {
    beforeEach(() => {
      UserAnalytics.startSession('session123', 'user456')
    })

    it('should record chat engagement', () => {
      UserAnalytics.recordChatEngagement('session123', 300) // 5 minutes
      
      expect(mockHistogramInstance.record).toHaveBeenCalledWith(300, {
        user_id: 'user456',
        session_id: 'session123',
        engagement_level: 'high'
      })
    })

    it('should classify engagement levels correctly', () => {
      // Low engagement
      UserAnalytics.recordChatEngagement('session123', 30)
      expect(mockHistogramInstance.record).toHaveBeenCalledWith(30, 
        expect.objectContaining({ engagement_level: 'low' })
      )
      
      // Medium engagement  
      UserAnalytics.recordChatEngagement('session123', 120)
      expect(mockHistogramInstance.record).toHaveBeenCalledWith(120,
        expect.objectContaining({ engagement_level: 'medium' })
      )
      
      // High engagement
      UserAnalytics.recordChatEngagement('session123', 400)
      expect(mockHistogramInstance.record).toHaveBeenCalledWith(400,
        expect.objectContaining({ engagement_level: 'high' })
      )
    })
  })

  describe('Connection Quality Tracking', () => {
    beforeEach(() => {
      UserAnalytics.startSession('session123', 'user456')
    })

    it('should record connection quality events', () => {
      UserAnalytics.recordConnectionQuality('session123', 8.5, 'websocket_connect')
      
      expect(console.log).toHaveBeenCalledWith(
        '[User Analytics] Connection quality: 8.5/10 (websocket_connect) for session session123'
      )
    })

    it('should handle missing session for connection quality', () => {
      UserAnalytics.recordConnectionQuality('non_existent', 7.0, 'api_call')
      
      // Should not throw error
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Connection quality:')
      )
    })
  })

  describe('Analytics Data Retrieval', () => {
    it('should return comprehensive analytics data', () => {
      // Set up test data
      UserAnalytics.startSession('session1', 'user1')
      UserAnalytics.startSession('session2', 'user2')
      
      UserAnalytics.recordFeatureUsage('session1', 'chat', 'send')
      UserAnalytics.recordFeatureUsage('session1', 'emotes', 'use')
      UserAnalytics.recordFeatureUsage('session2', 'moderation', 'timeout')
      
      UserAnalytics.endSession('session1')
      
      const analyticsData = UserAnalytics.getAnalyticsData()
      
      expect(analyticsData).toEqual({
        active_sessions: 1, // session2 still active
        total_sessions: 1,  // session1 ended and recorded
        feature_adoption: {
          total_users: 2,
          features_by_user: expect.arrayContaining([
            expect.objectContaining({
              user_id: 'user1',
              features: expect.arrayContaining(['chat', 'emotes'])
            })
          ])
        },
        performance_correlation: {
          ui_interactions: 0,
          connection_events: 0,
          error_impact_sessions: 0
        },
        average_satisfaction: expect.any(Number)
      })
    })

    it('should calculate average satisfaction score', () => {
      const session1 = UserAnalytics.startSession('session1', 'user1')
      const session2 = UserAnalytics.startSession('session2', 'user2')
      
      // Simulate some satisfaction scores
      session1.satisfactionScore = 8.5
      session2.satisfactionScore = 7.0
      
      UserAnalytics.endSession('session1')
      UserAnalytics.endSession('session2')
      
      const avgSatisfaction = UserAnalytics.getAverageSatisfactionScore()
      expect(avgSatisfaction).toBeCloseTo(7.75) // (8.5 + 7.0) / 2
    })

    it('should handle empty data gracefully', () => {
      UserAnalytics.forceCleanup()
      
      const analyticsData = UserAnalytics.getAnalyticsData()
      expect(analyticsData.active_sessions).toBe(0)
      expect(analyticsData.total_sessions).toBe(0)
      
      const avgSatisfaction = UserAnalytics.getAverageSatisfactionScore()
      expect(avgSatisfaction).toBe(5.0) // Default when no data
    })
  })

  describe('Cleanup Operations', () => {
    it('should cleanup old sessions', () => {
      const oldTime = Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
      Date.now.mockReturnValueOnce(oldTime)
      
      const oldSession = UserAnalytics.startSession('old_session', 'user1')
      oldSession.lastActivityTime = oldTime
      
      Date.now.mockReturnValue(1640000000000) // Current time
      
      const currentSession = UserAnalytics.startSession('current_session', 'user2')
      
      const cleanupResult = UserAnalytics.cleanupOldSessions()
      
      expect(cleanupResult.cleaned).toBeGreaterThan(0)
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[User Analytics] Cleanup completed'),
        expect.any(Object)
      )
    })

    it('should force cleanup all data', () => {
      UserAnalytics.startSession('session1', 'user1')
      UserAnalytics.startSession('session2', 'user2')
      
      const beforeCounts = UserAnalytics.forceCleanup()
      
      expect(beforeCounts.activeSessions).toBe(2)
      
      const analyticsData = UserAnalytics.getAnalyticsData()
      expect(analyticsData.active_sessions).toBe(0)
      
      expect(console.log).toHaveBeenCalledWith(
        '[User Analytics] Force cleanup completed:',
        expect.objectContaining({
          before: expect.any(Object),
          after: expect.any(Object)
        })
      )
    })

    it('should cleanup with custom max age', () => {
      const customMaxAge = 12 * 60 * 60 * 1000 // 12 hours
      
      UserAnalytics.cleanupOldSessions(customMaxAge)
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[User Analytics] Cleanup completed'),
        expect.any(Object)
      )
    })
  })

  describe('Memory Statistics', () => {
    it('should return memory usage statistics', () => {
      UserAnalytics.startSession('session1', 'user1')
      UserAnalytics.recordFeatureUsage('session1', 'chat', 'send')
      UserAnalytics.recordUserAction('session1', USER_ACTION_TYPES.EMOTE_USE)
      
      const memStats = UserAnalytics.getMemoryStats()
      
      expect(memStats).toEqual({
        active_sessions: {
          count: expect.any(Number),
          estimated_bytes: expect.any(Number)
        },
        historical_data: {
          count: expect.any(Number),
          estimated_bytes: expect.any(Number)
        },
        feature_adoption: {
          count: expect.any(Number),
          estimated_bytes: expect.any(Number)
        },
        performance_correlation: {
          ui_interactions_count: expect.any(Number),
          connection_events_count: expect.any(Number),
          error_impact_sessions_count: expect.any(Number),
          estimated_bytes: expect.any(Number)
        },
        total_estimated_bytes: expect.any(Number)
      })
    })

    it('should handle JSON serialization errors gracefully', () => {
      // Create circular reference to cause JSON.stringify to fail
      const session = UserAnalytics.startSession('session1', 'user1')
      session.circularRef = session // Creates circular reference
      
      const memStats = UserAnalytics.getMemoryStats()
      
      // Should not throw error and should return 0 for problematic data
      expect(memStats.active_sessions.estimated_bytes).toBe(0)
    })
  })

  describe('Observable Gauge Callbacks', () => {
    it('should register observable gauge callbacks', () => {
      expect(mockObservableGaugeInstance.addCallback).toHaveBeenCalled()
    })

    it('should execute satisfaction score callback', () => {
      UserAnalytics.startSession('session1', 'user1')
      UserAnalytics.startSession('session2', 'user2')
      
      // Find and execute the satisfaction score callback
      const callbacks = mockObservableGaugeInstance.addCallback.mock.calls
      const satisfactionCallback = callbacks[0]?.[0]
      
      if (satisfactionCallback) {
        const mockObservableResult = {
          observe: vi.fn()
        }
        
        satisfactionCallback(mockObservableResult)
        
        expect(mockObservableResult.observe).toHaveBeenCalled()
      }
    })

    it('should execute connection quality callback', () => {
      const session = UserAnalytics.startSession('session1', 'user1')
      session.connectionQualityEvents = [
        { type: 'connect', quality: 8.5, timestamp: Date.now() }
      ]
      
      // Find and execute the connection quality callback
      const callbacks = mockObservableGaugeInstance.addCallback.mock.calls
      const connectionCallback = callbacks[1]?.[0]
      
      if (connectionCallback) {
        const mockObservableResult = {
          observe: vi.fn()
        }
        
        connectionCallback(mockObservableResult)
        
        expect(mockObservableResult.observe).toHaveBeenCalledWith(
          expect.any(Number),
          expect.objectContaining({
            session_id: 'session1',
            user_id: 'user1',
            connection_status: expect.any(String)
          })
        )
      }
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle null/undefined session IDs', () => {
      expect(() => {
        UserAnalytics.recordUserAction(null, USER_ACTION_TYPES.CHAT_SEND)
      }).not.toThrow()
      
      expect(() => {
        UserAnalytics.recordUserAction(undefined, USER_ACTION_TYPES.EMOTE_USE)
      }).not.toThrow()
    })

    it('should handle invalid action types', () => {
      UserAnalytics.startSession('session1', 'user1')
      
      expect(() => {
        UserAnalytics.recordUserAction('session1', 'INVALID_ACTION')
      }).not.toThrow()
    })

    it('should handle concurrent session operations', () => {
      const promises = []
      
      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve().then(() => {
            const sessionId = `session${i}`
            UserAnalytics.startSession(sessionId, `user${i}`)
            UserAnalytics.recordUserAction(sessionId, USER_ACTION_TYPES.CHAT_SEND)
            UserAnalytics.endSession(sessionId)
          })
        )
      }
      
      return Promise.all(promises).then(() => {
        const analyticsData = UserAnalytics.getAnalyticsData()
        expect(analyticsData.total_sessions).toBe(10)
      })
    })

    it('should handle very long session durations', () => {
      const session = UserAnalytics.startSession('long_session', 'user1')
      
      // Simulate very long session (24+ hours)
      const originalStartTime = session.startTime
      session.startTime = originalStartTime - (25 * 60 * 60 * 1000)
      
      expect(() => {
        UserAnalytics.endSession('long_session')
      }).not.toThrow()
    })

    it('should handle sessions with many actions', () => {
      const session = UserAnalytics.startSession('busy_session', 'user1')
      
      // Add many actions
      for (let i = 0; i < 1000; i++) {
        UserAnalytics.recordUserAction(
          'busy_session', 
          USER_ACTION_TYPES.CHAT_SEND,
          { messageIndex: i }
        )
      }
      
      expect(() => {
        UserAnalytics.endSession('busy_session')
      }).not.toThrow()
      
      expect(session.actions.length).toBe(1000)
    })
  })

  describe('Integration with Error Monitoring', () => {
    it('should integrate with error monitoring during action recording', () => {
      const session = UserAnalytics.startSession('session1', 'user1')
      const error = new Error('Test error')
      
      // Simulate error during action recording
      session.recordError(error, { context: 'test' })
      
      expect(session.errorCount).toBe(1)
      expect(session.performanceIssues).toHaveLength(1)
      expect(session.satisfactionScore).toBeLessThan(5.0) // Should decrease
    })
  })
})

describe('UserSession', () => {
  let session
  let originalDateNow

  beforeEach(() => {
    originalDateNow = Date.now
    Date.now = vi.fn(() => 1640000000000)
    
    session = new UserSession('test_session', 'test_user')
  })

  afterEach(() => {
    Date.now = originalDateNow
  })

  describe('Session Creation', () => {
    it('should create session with correct properties', () => {
      expect(session.sessionId).toBe('test_session')
      expect(session.userId).toBe('test_user')
      expect(session.startTime).toBe(1640000000000)
      expect(session.isActive).toBe(true)
      expect(session.actions).toEqual([])
      expect(session.featureUsage).toBeInstanceOf(Map)
      expect(session.satisfactionScore).toBe(5.0)
    })

    it('should use anonymous user when no userId provided', () => {
      const anonymousSession = new UserSession('anonymous_session')
      
      expect(anonymousSession.userId).toBe('anonymous')
    })
  })

  describe('Action Recording', () => {
    it('should record actions correctly', () => {
      const actionType = 'test_action'
      const context = { response_time: 150 }
      
      session.recordAction(actionType, context)
      
      expect(session.actions).toHaveLength(1)
      expect(session.actions[0]).toEqual({
        type: actionType,
        timestamp: 1640000000000,
        context,
        response_time: 150
      })
      expect(session.lastActivityTime).toBe(1640000000000)
    })

    it('should update feature usage when recording actions', () => {
      session.recordAction('chat_send')
      
      expect(session.featureUsage.get('chat')).toBe(1)
    })

    it('should calculate engagement time for chat actions', () => {
      // Record first chat action
      session.recordAction('chat_send')
      
      // Record second action 30 seconds later
      Date.now.mockReturnValue(1640000030000)
      session.recordAction('emote_use')
      
      expect(session.engagementTime).toBe(30000) // 30 seconds in ms
    })

    it('should not count engagement for long gaps between actions', () => {
      session.recordAction('chat_send')
      
      // Record action 2 minutes later (too long for engagement)
      Date.now.mockReturnValue(1640000000000 + 120000)
      session.recordAction('chat_send')
      
      expect(session.engagementTime).toBe(0)
    })

    it('should update satisfaction score based on response time', () => {
      const originalScore = session.satisfactionScore
      
      // Fast response should improve score
      session.recordAction('fast_action', { response_time: 50 })
      expect(session.satisfactionScore).toBeGreaterThan(originalScore)
      
      // Slow response should decrease score
      session.recordAction('slow_action', { response_time: 2000 })
      expect(session.satisfactionScore).toBeLessThan(originalScore)
    })
  })

  describe('Feature Classification', () => {
    it('should classify chat actions correctly', () => {
      const feature = session.getFeatureFromAction('send_message')
      expect(feature).toBe('chat')
    })

    it('should classify navigation actions correctly', () => {
      const feature = session.getFeatureFromAction('switch_channel')
      expect(feature).toBe('navigation')
    })

    it('should return null for unknown actions', () => {
      const feature = session.getFeatureFromAction('unknown_action')
      expect(feature).toBeNull()
    })
  })

  describe('Error Recording', () => {
    it('should record errors and update satisfaction', () => {
      const originalScore = session.satisfactionScore
      const error = new Error('Test error')
      
      session.recordError(error, { context: 'test' })
      
      expect(session.errorCount).toBe(1)
      expect(session.performanceIssues).toHaveLength(1)
      expect(session.satisfactionScore).toBeLessThan(originalScore)
      
      const issue = session.performanceIssues[0]
      expect(issue.type).toBe('error')
      expect(issue.error).toBe('Test error')
    })
  })

  describe('Connection Event Recording', () => {
    it('should record connection events', () => {
      session.recordConnectionEvent('websocket_connect', 8.5)
      
      expect(session.connectionQualityEvents).toHaveLength(1)
      
      const event = session.connectionQualityEvents[0]
      expect(event.type).toBe('websocket_connect')
      expect(event.quality).toBe(8.5)
      expect(event.timestamp).toBe(1640000000000)
    })

    it('should update satisfaction based on connection quality', () => {
      const originalScore = session.satisfactionScore
      
      // Good connection quality should improve score
      session.recordConnectionEvent('connect', 9.0)
      expect(session.satisfactionScore).toBeGreaterThan(originalScore)
      
      // Poor connection quality should decrease score
      session.recordConnectionEvent('disconnect', 2.0)
      expect(session.satisfactionScore).toBeLessThan(originalScore)
    })
  })

  describe('Session Duration and Metrics', () => {
    it('should calculate session duration correctly', () => {
      Date.now.mockReturnValue(1640000060000) // 1 minute later
      session.lastActivityTime = Date.now()
      
      const duration = session.getSessionDuration()
      expect(duration).toBe(60) // 60 seconds
    })

    it('should calculate engagement rate', () => {
      session.engagementTime = 30000 // 30 seconds in ms
      Date.now.mockReturnValue(1640000060000) // 1 minute later
      session.lastActivityTime = Date.now()
      
      const engagementRate = session.getEngagementRate()
      expect(engagementRate).toBeCloseTo(0.5) // 30s / 60s = 50%
    })

    it('should handle zero duration gracefully', () => {
      const engagementRate = session.getEngagementRate()
      expect(engagementRate).toBe(0)
    })
  })

  describe('Average Response Time Calculation', () => {
    it('should calculate average response time', () => {
      session.recordAction('action1', { response_time: 100 })
      session.recordAction('action2', { response_time: 200 })
      session.recordAction('action3', { response_time: 300 })
      
      const avgResponseTime = session.getAverageResponseTime()
      expect(avgResponseTime).toBe(200) // (100 + 200 + 300) / 3
    })

    it('should return 0 when no response times recorded', () => {
      session.recordAction('action1')
      
      const avgResponseTime = session.getAverageResponseTime()
      expect(avgResponseTime).toBe(0)
    })
  })

  describe('Average Connection Quality', () => {
    it('should calculate average connection quality', () => {
      session.recordConnectionEvent('connect1', 8.0)
      session.recordConnectionEvent('connect2', 9.0)
      session.recordConnectionEvent('connect3', 7.0)
      
      const avgQuality = session.getAverageConnectionQuality()
      expect(avgQuality).toBe(8.0) // (8 + 9 + 7) / 3
    })

    it('should return default quality when no events recorded', () => {
      const avgQuality = session.getAverageConnectionQuality()
      expect(avgQuality).toBe(5.0) // Default
    })
  })

  describe('Final Satisfaction Score Calculation', () => {
    it('should calculate comprehensive satisfaction score', () => {
      // Set up session with various metrics
      session.recordAction('action1', { response_time: 50 }) // Good response time
      session.recordConnectionEvent('connect', 8.0) // Good connection
      session.featureUsage.set('chat', 5)
      session.featureUsage.set('emotes', 3)
      
      const finalScore = session.calculateFinalSatisfactionScore()
      
      expect(finalScore).toBeGreaterThan(5.0)
      expect(finalScore).toBeLessThanOrEqual(10.0)
    })

    it('should penalize high error rates', () => {
      session.recordAction('action1')
      session.recordError(new Error('Error 1'))
      session.recordError(new Error('Error 2'))
      
      const finalScore = session.calculateFinalSatisfactionScore()
      
      expect(finalScore).toBeLessThan(5.0)
    })

    it('should reward good performance metrics', () => {
      session.recordAction('action1', { response_time: 25 }) // Very fast
      session.recordConnectionEvent('connect', 9.5) // Excellent connection
      session.engagementTime = 120000 // 2 minutes engaged
      Date.now.mockReturnValue(1640000120000) // 2 minutes session
      session.lastActivityTime = Date.now()
      
      const finalScore = session.calculateFinalSatisfactionScore()
      
      expect(finalScore).toBeGreaterThan(7.0)
    })
  })

  describe('Session End', () => {
    it('should end session correctly', () => {
      session.recordAction('final_action')
      
      session.endSession()
      
      expect(session.isActive).toBe(false)
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Session test_session ended')
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle negative response times', () => {
      session.recordAction('action', { response_time: -100 })
      
      // Should not crash or produce invalid scores
      expect(session.satisfactionScore).toBeGreaterThan(0)
      expect(session.satisfactionScore).toBeLessThanOrEqual(10)
    })

    it('should handle extremely high response times', () => {
      session.recordAction('action', { response_time: 100000 })
      
      const finalScore = session.calculateFinalSatisfactionScore()
      expect(finalScore).toBeGreaterThan(0)
    })

    it('should handle null/undefined contexts', () => {
      expect(() => {
        session.recordAction('action', null)
        session.recordAction('action', undefined)
        session.recordAction('action')
      }).not.toThrow()
    })

    it('should limit satisfaction score bounds', () => {
      // Try to push score very high
      for (let i = 0; i < 100; i++) {
        session.recordAction(`action${i}`, { response_time: 1 })
      }
      
      expect(session.satisfactionScore).toBeLessThanOrEqual(10.0)
      
      // Try to push score very low  
      for (let i = 0; i < 100; i++) {
        session.recordError(new Error(`Error ${i}`))
      }
      
      expect(session.satisfactionScore).toBeGreaterThanOrEqual(1.0)
    })
  })
})

describe('Constants and Configuration', () => {
  describe('USER_ACTION_TYPES', () => {
    it('should have all required action types', () => {
      const requiredTypes = [
        'CHAT_SEND', 'CHAT_SCROLL', 'EMOTE_USE', 'EMOTE_SEARCH',
        'CHANNEL_SWITCH', 'SETTINGS_CHANGE', 'WINDOW_FOCUS',
        'WINDOW_BLUR', 'THEME_CHANGE', 'FILTER_TOGGLE', 'MODERATION_ACTION'
      ]
      
      requiredTypes.forEach(type => {
        expect(USER_ACTION_TYPES[type]).toBeDefined()
        expect(typeof USER_ACTION_TYPES[type]).toBe('string')
      })
    })
  })

  describe('FEATURE_CATEGORIES', () => {
    it('should have all required feature categories', () => {
      const requiredCategories = [
        'CHAT', 'EMOTES', 'MODERATION', 'CUSTOMIZATION', 'NAVIGATION'
      ]
      
      requiredCategories.forEach(category => {
        expect(FEATURE_CATEGORIES[category]).toBeDefined()
        expect(FEATURE_CATEGORIES[category].name).toBeDefined()
        expect(Array.isArray(FEATURE_CATEGORIES[category].actions)).toBe(true)
        expect(typeof FEATURE_CATEGORIES[category].engagement_weight).toBe('number')
      })
    })

    it('should have valid engagement weights', () => {
      Object.values(FEATURE_CATEGORIES).forEach(category => {
        expect(category.engagement_weight).toBeGreaterThan(0)
        expect(category.engagement_weight).toBeLessThanOrEqual(1)
      })
    })
  })
})