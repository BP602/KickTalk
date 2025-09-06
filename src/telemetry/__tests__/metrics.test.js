import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MetricsHelper } from '../metrics.js'

// Mock process object for Node.js APIs
const mockProcess = {
  memoryUsage: vi.fn(() => ({
    rss: 100 * 1024 * 1024,      // 100MB
    heapUsed: 80 * 1024 * 1024,  // 80MB
    heapTotal: 120 * 1024 * 1024, // 120MB
    external: 10 * 1024 * 1024   // 10MB
  })),
  cpuUsage: vi.fn(() => ({
    user: 1000000,    // 1 second in microseconds
    system: 500000    // 0.5 seconds in microseconds
  })),
  _getActiveHandles: vi.fn(() => Array.from({ length: 5 }, () => ({}))),
  _getActiveRequests: vi.fn(() => Array.from({ length: 3 }, () => ({}))),
  hrtime: {
    bigint: vi.fn(() => BigInt(Date.now() * 1000000))
  },
  uptime: vi.fn(() => 3600) // 1 hour
}

// Mock performance observer
const mockPerformanceObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  getEntries: vi.fn(() => [])
}))

// Create comprehensive mocks for OpenTelemetry
const mockCounterInstance = {
  add: vi.fn()
}

const mockHistogramInstance = {
  record: vi.fn()
}

const mockObservableGaugeInstance = {
  addCallback: vi.fn()
}

const mockUpDownCounterInstance = {
  add: vi.fn()
}

const mockMeter = {
  createCounter: vi.fn(() => mockCounterInstance),
  createHistogram: vi.fn(() => mockHistogramInstance),
  createObservableGauge: vi.fn(() => mockObservableGaugeInstance),
  createUpDownCounter: vi.fn(() => mockUpDownCounterInstance)
}

const mockMetrics = {
  getMeter: vi.fn(() => mockMeter)
}

// Mock dependencies
const mockSLOMonitor = {
  checkResourceUsage: vi.fn(),
  recordLatency: vi.fn(),
  recordOperationResult: vi.fn()
}

const mockErrorMonitor = {
  recordError: vi.fn(() => ({
    error_id: 'test_error_123',
    category: 'NETWORK',
    severity: 'high'
  })),
  recordRecovery: vi.fn(),
  getCircuitBreaker: vi.fn(() => ({
    execute: vi.fn()
  })),
  getErrorStatistics: vi.fn(() => ({})),
  resetStatistics: vi.fn()
}

const mockRetryUtils = {
  retry: vi.fn(),
  retryNetworkRequest: vi.fn(),
  retryWebSocketConnection: vi.fn(),
  retrySevenTVOperation: vi.fn()
}

const mockUserAnalytics = {
  startSession: vi.fn(),
  endSession: vi.fn(),
  recordUserAction: vi.fn(),
  recordFeatureUsage: vi.fn(),
  recordChatEngagement: vi.fn(),
  recordConnectionQuality: vi.fn(),
  getUserAnalyticsData: vi.fn(),
  cleanupOldSessions: vi.fn(),
  forceCleanup: vi.fn(),
  getMemoryStats: vi.fn()
}

const mockPerformanceBudgetMonitor = {
  monitorUIInteraction: vi.fn(),
  monitorComponentRender: vi.fn(),
  monitorWebSocketLatency: vi.fn(),
  monitorMemoryUsage: vi.fn(),
  monitorCPUUsage: vi.fn(),
  monitorBundleSize: vi.fn(),
  getPerformanceData: vi.fn()
}

const mockUSER_ACTION_TYPES = {
  CHAT_SEND: 'chat_send',
  CHAT_SCROLL: 'chat_scroll',
  EMOTE_USE: 'emote_use'
}

// Mock modules
vi.mock('@opentelemetry/api', () => ({
  metrics: mockMetrics
}))

vi.mock('../slo-monitoring', () => ({
  SLOMonitor: mockSLOMonitor
}))

vi.mock('../error-monitoring', () => ({
  ErrorMonitor: mockErrorMonitor
}))

vi.mock('../retry-utils', () => ({
  RetryUtils: mockRetryUtils
}))

vi.mock('../user-analytics', () => ({
  UserAnalytics: mockUserAnalytics,
  USER_ACTION_TYPES: mockUSER_ACTION_TYPES
}))

vi.mock('../performance-budget', () => ({
  performanceBudgetMonitor: mockPerformanceBudgetMonitor
}))

vi.mock('../../package.json', () => ({
  default: {
    version: '1.0.0-test'
  }
}))

vi.mock('perf_hooks', () => ({
  PerformanceObserver: mockPerformanceObserver
}))

// Do NOT replace global.process. Instead, spy/override only the needed methods per test lifecycle
let originalHrtimeBigint
let originalGetActiveHandles
let originalGetActiveRequests

describe('MetricsHelper', () => {
  let originalConsoleLog
  let originalConsoleWarn
  let originalDateNow

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock console methods
    originalConsoleLog = console.log
    originalConsoleWarn = console.warn
    console.log = vi.fn()
    console.warn = vi.fn()
    
    // Mock Date.now for consistent timestamps
    originalDateNow = Date.now
    Date.now = vi.fn(() => 1640000000000) // Fixed timestamp

    // Spy on process methods instead of replacing the entire object
    vi.spyOn(process, 'memoryUsage').mockImplementation(mockProcess.memoryUsage)
    vi.spyOn(process, 'cpuUsage').mockImplementation(mockProcess.cpuUsage)
    vi.spyOn(process, 'uptime').mockImplementation(mockProcess.uptime)

    // hrtime.bigint is a property on the hrtime function; replace and restore manually
    originalHrtimeBigint = process.hrtime.bigint
    process.hrtime.bigint = mockProcess.hrtime.bigint

    // Internal helpers (best-effort; may be undefined in some environments)
    originalGetActiveHandles = process._getActiveHandles
    originalGetActiveRequests = process._getActiveRequests
    try { process._getActiveHandles = mockProcess._getActiveHandles } catch {}
    try { process._getActiveRequests = mockProcess._getActiveRequests } catch {}
  })

  afterEach(() => {
    console.log = originalConsoleLog
    console.warn = originalConsoleWarn
    Date.now = originalDateNow

    // Restore process spies and original methods
    try { process.hrtime.bigint = originalHrtimeBigint } catch {}
    try {
      if (originalGetActiveHandles !== undefined) process._getActiveHandles = originalGetActiveHandles
      else delete process._getActiveHandles
    } catch {}
    try {
      if (originalGetActiveRequests !== undefined) process._getActiveRequests = originalGetActiveRequests
      else delete process._getActiveRequests
    } catch {}
    vi.restoreAllMocks()
  })

  describe('WebSocket Connection Metrics', () => {
    it('should increment websocket connections', () => {
      MetricsHelper.incrementWebSocketConnections('chatroom123', 'streamer456', 'TestStreamer')
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('WebSocket INCREMENT for TestStreamer (chatroom123)')
      )
    })

    it('should decrement websocket connections', () => {
      // First increment
      MetricsHelper.incrementWebSocketConnections('chatroom123', 'streamer456', 'TestStreamer')
      
      // Then decrement
      MetricsHelper.decrementWebSocketConnections('chatroom123', 'streamer456', 'TestStreamer')
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('WebSocket DECREMENT for TestStreamer (chatroom123)')
      )
    })

    it('should handle connections without streamer name', () => {
      MetricsHelper.incrementWebSocketConnections('chatroom123', 'streamer456')
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('WebSocket INCREMENT for unknown (chatroom123)')
      )
    })

    it('should record reconnections', () => {
      MetricsHelper.recordReconnection('chatroom123', 'connection_lost')
      
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        chatroom_id: 'chatroom123',
        reason: 'connection_lost'
      })
    })

    it('should record connection errors', () => {
      MetricsHelper.recordConnectionError('timeout', 'chatroom123')
      
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        error_type: 'timeout',
        chatroom_id: 'chatroom123'
      })
    })

    it('should record connection errors without chatroom ID', () => {
      MetricsHelper.recordConnectionError('network_failure')
      
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        error_type: 'network_failure'
      })
    })
  })

  describe('Message Metrics', () => {
    it('should record messages sent', () => {
      MetricsHelper.recordMessageSent('chatroom123', 'regular', 'TestStreamer')
      
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        chatroom_id: 'chatroom123',
        message_type: 'regular',
        streamer_name: 'TestStreamer'
      })
    })

    it('should record messages received', () => {
      MetricsHelper.recordMessageReceived('chatroom123', 'emote', 'user456', 'TestStreamer')
      
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        chatroom_id: 'chatroom123',
        message_type: 'emote',
        sender_id: 'user456',
        streamer_name: 'TestStreamer'
      })
    })

    it('should record message send duration with SLO monitoring', () => {
      const duration = 0.5 // 500ms
      
      MetricsHelper.recordMessageSendDuration(duration, 'chatroom123', true)
      
      expect(mockHistogramInstance.record).toHaveBeenCalledWith(duration, {
        chatroom_id: 'chatroom123',
        success: 'true'
      })
      
      expect(mockSLOMonitor.recordLatency).toHaveBeenCalledWith(
        'MESSAGE_SEND_DURATION',
        duration,
        { chatroom_id: 'chatroom123' }
      )
      
      expect(mockSLOMonitor.recordOperationResult).toHaveBeenCalledWith(
        'MESSAGE_SEND_DURATION',
        true,
        duration,
        { chatroom_id: 'chatroom123' }
      )
    })

    it('should handle failed message sends', () => {
      const duration = 2.5 // 2.5s - exceeds typical SLO
      
      MetricsHelper.recordMessageSendDuration(duration, 'chatroom123', false)
      
      expect(mockHistogramInstance.record).toHaveBeenCalledWith(duration, {
        chatroom_id: 'chatroom123',
        success: 'false'
      })
      
      expect(mockSLOMonitor.recordOperationResult).toHaveBeenCalledWith(
        'MESSAGE_SEND_DURATION',
        false,
        duration,
        { chatroom_id: 'chatroom123' }
      )
    })
  })

  describe('API Request Metrics', () => {
    it('should record API requests', () => {
      MetricsHelper.recordAPIRequest('/api/users', 'GET', 200, 0.150)
      
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        endpoint: '/api/users',
        method: 'GET',
        status_code: '200'
      })
      
      expect(mockHistogramInstance.record).toHaveBeenCalledWith(0.150, {
        endpoint: '/api/users',
        method: 'GET',
        status_code: '200'
      })
    })

    it('should handle API errors', () => {
      MetricsHelper.recordAPIRequest('/api/error', 'POST', 500, 1.5)
      
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        endpoint: '/api/error',
        method: 'POST',
        status_code: '500'
      })
    })
  })

  describe('Timer Utilities', () => {
    it('should create timer', () => {
      const startTime = MetricsHelper.startTimer()
      
      expect(typeof startTime).toBe('bigint')
    })

    it('should calculate duration correctly', () => {
      const startTime = BigInt(1000000000) // 1 second in nanoseconds
      mockProcess.hrtime.bigint.mockReturnValue(BigInt(1500000000)) // 1.5 seconds
      
      const duration = MetricsHelper.endTimer(startTime)
      
      expect(duration).toBe(0.5) // 0.5 seconds
    })
  })

  describe('Memory and Performance Metrics', () => {
    it('should record GC duration', () => {
      MetricsHelper.recordGCDuration(0.025, 'mark-sweep')
      
      expect(mockHistogramInstance.record).toHaveBeenCalledWith(0.025, {
        kind: 'mark-sweep'
      })
    })

    it('should record renderer memory', () => {
      const memory = {
        jsHeapUsedSize: 50 * 1024 * 1024,
        jsHeapTotalSize: 80 * 1024 * 1024
      }
      
      MetricsHelper.recordRendererMemory(memory)
      
      // This should update internal state for observable gauge callback
    })

    it('should record DOM node count', () => {
      MetricsHelper.recordDomNodeCount(1500)
      
      // This should update internal state for observable gauge callback
    })

    it('should increment/decrement open windows', () => {
      MetricsHelper.incrementOpenWindows()
      expect(mockUpDownCounterInstance.add).toHaveBeenCalledWith(1)
      
      MetricsHelper.decrementOpenWindows()
      expect(mockUpDownCounterInstance.add).toHaveBeenCalledWith(-1)
    })
  })

  describe('7TV Metrics', () => {
    it('should record 7TV connection health', () => {
      MetricsHelper.recordSevenTVConnectionHealth(5, 3, 'connected')
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('7TV Connection Health: 3 connections, 5 chatrooms, state: connected')
      )
    })

    it('should record 7TV websocket creation', () => {
      MetricsHelper.recordSevenTVWebSocketCreated('chatroom123', 'stv_user_456', 2)
      
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        chatroom_id: 'chatroom123',
        seventv_user_id: 'stv_user_456',
        emote_sets: 2
      })
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('7TV WebSocket created for chatroom: chatroom123')
      )
    })

    it('should record 7TV emote updates', () => {
      MetricsHelper.recordSevenTVEmoteUpdate('chatroom123', 5, 2, 1, 150)
      
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        chatroom_id: 'chatroom123',
        pulled: 5,
        pushed: 2,
        updated: 1
      })
      
      expect(mockHistogramInstance.record).toHaveBeenCalledWith(0.15, {
        chatroom_id: 'chatroom123',
        pulled: 5,
        pushed: 2,
        updated: 1
      })
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('7TV Emote update: chatroom123 - pulled:5, pushed:2, updated:1, duration:150ms')
      )
    })

    it('should record 7TV emote changes', () => {
      MetricsHelper.recordSevenTVEmoteChanges('chatroom123', 3, 1, 2, 'channel')
      
      expect(mockCounterInstance.add).toHaveBeenCalledTimes(3)
      expect(mockCounterInstance.add).toHaveBeenCalledWith(3, {
        chatroom_id: 'chatroom123',
        set_type: 'channel',
        change_type: 'added'
      })
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        chatroom_id: 'chatroom123',
        set_type: 'channel',
        change_type: 'removed'
      })
      expect(mockCounterInstance.add).toHaveBeenCalledWith(2, {
        chatroom_id: 'chatroom123',
        set_type: 'channel',
        change_type: 'updated'
      })
    })

    it('should handle zero emote changes gracefully', () => {
      MetricsHelper.recordSevenTVEmoteChanges('chatroom123', 0, 0, 0, 'global')
      
      // Should not call add for zero values
      expect(mockCounterInstance.add).not.toHaveBeenCalled()
    })
  })

  describe('Chatroom Navigation Metrics', () => {
    it('should record chatroom switches', () => {
      MetricsHelper.recordChatroomSwitch('chatroom123', 'chatroom456', 250)
      
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        from_chatroom: 'chatroom123',
        to_chatroom: 'chatroom456',
        switch_type: 'chatroom'
      })
      
      expect(mockHistogramInstance.record).toHaveBeenCalledWith(0.25, {
        from_chatroom: 'chatroom123',
        to_chatroom: 'chatroom456',
        switch_type: 'chatroom'
      })
      
      expect(mockSLOMonitor.recordLatency).toHaveBeenCalledWith(
        'CHATROOM_SWITCH_DURATION',
        0.25,
        expect.objectContaining({
          from_chatroom: 'chatroom123',
          to_chatroom: 'chatroom456'
        })
      )
    })

    it('should handle mentions switch type', () => {
      MetricsHelper.recordChatroomSwitch('chatroom123', 'mentions', 100)
      
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        from_chatroom: 'chatroom123',
        to_chatroom: 'mentions',
        switch_type: 'mentions'
      })
    })

    it('should handle null chatroom values', () => {
      MetricsHelper.recordChatroomSwitch(null, null, 50)
      
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        from_chatroom: 'none',
        to_chatroom: 'none',
        switch_type: 'chatroom'
      })
    })
  })

  describe('Performance Monitoring', () => {
    it('should record startup duration', () => {
      MetricsHelper.recordStartupDuration('initialization', 2500, { phase: 'setup' })
      
      // Attributes from the call should be merged, with later keys overriding earlier ones.
      // Since we passed { phase: 'setup' }, it overrides the initial phase argument.
      expect(mockHistogramInstance.record).toHaveBeenCalledWith(2.5, expect.objectContaining({
        operation: 'startup',
        phase: 'setup'
      }))
      
      expect(mockSLOMonitor.recordLatency).toHaveBeenCalledWith(
        'APP_STARTUP_DURATION',
        2.5,
        expect.objectContaining({ phase: 'setup' })
      )
    })

    it('should record message parsing duration', () => {
      MetricsHelper.recordMessageParsingDuration(25, 150, true)
      
      expect(mockSLOMonitor.recordLatency).toHaveBeenCalledWith(
        'MESSAGE_PARSER_DURATION',
        0.025,
        { message_length: 150, cache_hit: true }
      )
    })

    it('should record emote search duration', () => {
      MetricsHelper.recordEmoteSearchDuration(75, 'Kappa', 15)
      
      expect(mockSLOMonitor.recordLatency).toHaveBeenCalledWith(
        'EMOTE_SEARCH_DURATION',
        0.075,
        { query_length: 5, result_count: 15 }
      )
    })

    it('should record WebSocket connection duration', () => {
      MetricsHelper.recordWebSocketConnectionDuration(1500, 'chatroom123', true)
      
      expect(mockSLOMonitor.recordLatency).toHaveBeenCalledWith(
        'WEBSOCKET_CONNECTION_TIME',
        1.5,
        { chatroom_id: 'chatroom123' }
      )
      
      expect(mockSLOMonitor.recordOperationResult).toHaveBeenCalledWith(
        'WEBSOCKET_CONNECTION_TIME',
        true,
        1.5,
        { chatroom_id: 'chatroom123' }
      )
    })
  })

  describe('SLO Helper Methods', () => {
    it('should get SLO target', () => {
      const mockTarget = { target: 2.0, p99: 1.5 }
      mockSLOMonitor.getSLOTarget = vi.fn().mockReturnValue(mockTarget)
      
      const result = MetricsHelper.getSLOTarget('MESSAGE_SEND_DURATION')
      
      expect(result).toEqual(mockTarget)
      expect(mockSLOMonitor.getSLOTarget).toHaveBeenCalledWith('MESSAGE_SEND_DURATION')
    })

    it('should get all SLO targets', () => {
      const mockTargets = { MESSAGE_SEND_DURATION: { target: 2.0 } }
      mockSLOMonitor.getAllSLOTargets = vi.fn().mockReturnValue(mockTargets)
      
      const result = MetricsHelper.getAllSLOTargets()
      
      expect(result).toEqual(mockTargets)
    })

    it('should update performance budget', () => {
      MetricsHelper.updatePerformanceBudget('memory_usage', 75)
      
      expect(mockSLOMonitor.updatePerformanceBudget).toHaveBeenCalledWith('memory_usage', 75)
    })
  })

  describe('Error Monitoring Integration', () => {
    it('should record errors', () => {
      const error = new Error('Test error')
      const context = { operation: 'test' }
      
      const result = MetricsHelper.recordError(error, context)
      
      expect(mockErrorMonitor.recordError).toHaveBeenCalledWith(error, context)
      expect(result).toEqual({
        error_id: 'test_error_123',
        category: 'NETWORK',
        severity: 'high'
      })
    })

    it('should record error recovery', () => {
      MetricsHelper.recordErrorRecovery('error_123', 'retry', true, 1000)
      
      expect(mockErrorMonitor.recordRecovery).toHaveBeenCalledWith(
        'error_123', 'retry', true, 1000
      )
    })

    it('should execute operations with retry', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      mockRetryUtils.retry.mockResolvedValue('success')
      
      const result = await MetricsHelper.executeWithRetry(operation, { maxRetries: 3 })
      
      expect(mockRetryUtils.retry).toHaveBeenCalledWith(operation, {
        component: 'metrics_helper',
        maxRetries: 3
      })
      expect(result).toBe('success')
    })

    it('should get circuit breaker', () => {
      const mockBreaker = { state: 'CLOSED' }
      mockErrorMonitor.getCircuitBreaker.mockReturnValue(mockBreaker)
      
      const result = MetricsHelper.getCircuitBreaker('test_breaker', { threshold: 5 })
      
      expect(mockErrorMonitor.getCircuitBreaker).toHaveBeenCalledWith(
        'test_breaker', { threshold: 5 }
      )
      expect(result).toBe(mockBreaker)
    })

    it('should get error statistics', () => {
      const mockStats = { total_errors: 5 }
      mockErrorMonitor.getErrorStatistics.mockReturnValue(mockStats)
      
      const result = MetricsHelper.getErrorStatistics()
      
      expect(result).toBe(mockStats)
    })
  })

  describe('User Analytics Integration', () => {
    it('should start user session', () => {
      const mockSession = { sessionId: 'session123' }
      mockUserAnalytics.startSession.mockReturnValue(mockSession)
      
      const result = MetricsHelper.startUserSession('session123', 'user456')
      
      expect(mockUserAnalytics.startSession).toHaveBeenCalledWith('session123', 'user456')
      expect(result).toBe(mockSession)
    })

    it('should end user session', () => {
      MetricsHelper.endUserSession('session123')
      
      expect(mockUserAnalytics.endSession).toHaveBeenCalledWith('session123')
    })

    it('should record user action', () => {
      MetricsHelper.recordUserAction('session123', 'chat_send', { message: 'hello' })
      
      expect(mockUserAnalytics.recordUserAction).toHaveBeenCalledWith(
        'session123', 'chat_send', { message: 'hello' }
      )
    })

    it('should get user action types', () => {
      const result = MetricsHelper.getUserActionTypes()
      
      expect(result).toBe(mockUSER_ACTION_TYPES)
    })

    it('should cleanup old sessions', () => {
      const mockResult = { cleaned: 5 }
      mockUserAnalytics.cleanupOldSessions.mockReturnValue(mockResult)
      
      const result = MetricsHelper.cleanupOldSessions(86400000)
      
      expect(mockUserAnalytics.cleanupOldSessions).toHaveBeenCalledWith(86400000)
      expect(result).toBe(mockResult)
    })
  })

  describe('Performance Budget Integration', () => {
    it('should monitor UI interaction', () => {
      MetricsHelper.monitorUIInteraction('button_click', 150, { component: 'chat' })
      
      expect(mockPerformanceBudgetMonitor.monitorUIInteraction).toHaveBeenCalledWith(
        'button_click', 150, { component: 'chat' }
      )
    })

    it('should monitor component render', () => {
      MetricsHelper.monitorComponentRender('ChatMessage', 25, { props: 5 })
      
      expect(mockPerformanceBudgetMonitor.monitorComponentRender).toHaveBeenCalledWith(
        'ChatMessage', 25, { props: 5 }
      )
    })

    it('should monitor WebSocket latency', () => {
      MetricsHelper.monitorWebSocketLatency(75, { channel: 'chat123' })
      
      expect(mockPerformanceBudgetMonitor.monitorWebSocketLatency).toHaveBeenCalledWith(
        75, { channel: 'chat123' }
      )
    })

    it('should monitor memory usage', () => {
      MetricsHelper.monitorMemoryUsage(512, { process: 'renderer' })
      
      expect(mockPerformanceBudgetMonitor.monitorMemoryUsage).toHaveBeenCalledWith(
        512, { process: 'renderer' }
      )
    })

    it('should monitor CPU usage', () => {
      MetricsHelper.monitorCPUUsage(45, { interval: '1m' })
      
      expect(mockPerformanceBudgetMonitor.monitorCPUUsage).toHaveBeenCalledWith(
        45, { interval: '1m' }
      )
    })

    it('should monitor bundle size', () => {
      MetricsHelper.monitorBundleSize('main.bundle', 1024)
      
      expect(mockPerformanceBudgetMonitor.monitorBundleSize).toHaveBeenCalledWith(
        'main.bundle', 1024
      )
    })

    it('should get performance data', () => {
      const mockData = { score: 85 }
      mockPerformanceBudgetMonitor.getPerformanceData.mockReturnValue(mockData)
      
      const result = MetricsHelper.getPerformanceData()
      
      expect(result).toBe(mockData)
    })
  })

  describe('Retry Utilities Integration', () => {
    it('should execute network request with retry', async () => {
      const requestFn = vi.fn()
      mockRetryUtils.retryNetworkRequest.mockResolvedValue('success')
      
      const result = await MetricsHelper.executeNetworkRequestWithRetry(
        requestFn, { maxAttempts: 3 }
      )
      
      expect(mockRetryUtils.retryNetworkRequest).toHaveBeenCalledWith(
        requestFn, { maxAttempts: 3 }
      )
      expect(result).toBe('success')
    })

    it('should execute WebSocket with retry', async () => {
      const connectFn = vi.fn()
      mockRetryUtils.retryWebSocketConnection.mockResolvedValue('connected')
      
      const result = await MetricsHelper.executeWebSocketWithRetry(
        connectFn, { timeout: 5000 }
      )
      
      expect(mockRetryUtils.retryWebSocketConnection).toHaveBeenCalledWith(
        connectFn, { timeout: 5000 }
      )
      expect(result).toBe('connected')
    })

    it('should execute 7TV operation with retry', async () => {
      const operationFn = vi.fn()
      mockRetryUtils.retrySevenTVOperation.mockResolvedValue('7tv_success')
      
      const result = await MetricsHelper.executeSevenTVWithRetry(
        operationFn, { backoff: 'exponential' }
      )
      
      expect(mockRetryUtils.retrySevenTVOperation).toHaveBeenCalledWith(
        operationFn, { backoff: 'exponential' }
      )
      expect(result).toBe('7tv_success')
    })
  })

  describe('Observable Gauge Callbacks', () => {
    it('should register memory usage callback', () => {
      expect(mockObservableGaugeInstance.addCallback).toHaveBeenCalled()
    })

    it('should execute memory usage callback correctly', () => {
      // Find the memory usage callback
      const memoryCallbacks = mockObservableGaugeInstance.addCallback.mock.calls
      const memoryCallback = memoryCallbacks.find(call => 
        call[0].toString().includes('memUsage')
      )?.[0]
      
      if (memoryCallback) {
        const mockObservableResult = {
          observe: vi.fn()
        }
        
        memoryCallback(mockObservableResult)
        
        expect(mockObservableResult.observe).toHaveBeenCalledTimes(4) // rss, heap_used, heap_total, external
        expect(mockSLOMonitor.checkResourceUsage).toHaveBeenCalledWith(
          'memory', 
          80 * 1024 * 1024, // heapUsed
          { process: 'main', type: 'heap_used' }
        )
      }
    })

    it('should handle uptime status callback', () => {
      // Find the uptime callback
      const uptimeCallbacks = mockObservableGaugeInstance.addCallback.mock.calls
      const uptimeCallback = uptimeCallbacks.find(call => 
        call[0].toString().includes('observe(1)')
      )?.[0]
      
      if (uptimeCallback) {
        const mockObservableResult = {
          observe: vi.fn()
        }
        
        uptimeCallback(mockObservableResult)
        
        expect(mockObservableResult.observe).toHaveBeenCalledWith(1)
      }
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing streamer names gracefully', () => {
      MetricsHelper.recordMessageSent('chatroom123')
      
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        chatroom_id: 'chatroom123',
        message_type: 'regular'
      })
    })

    it('should handle zero durations', () => {
      MetricsHelper.recordMessageSendDuration(0, 'chatroom123', true)
      
      expect(mockHistogramInstance.record).toHaveBeenCalledWith(0, {
        chatroom_id: 'chatroom123',
        success: 'true'
      })
    })

    it('should handle negative durations', () => {
      MetricsHelper.recordMessageSendDuration(-0.1, 'chatroom123', false)
      
      expect(mockHistogramInstance.record).toHaveBeenCalledWith(-0.1, {
        chatroom_id: 'chatroom123',
        success: 'false'
      })
    })

    it('should handle null query in emote search', () => {
      MetricsHelper.recordEmoteSearchDuration(50, null, 0)
      
      expect(mockSLOMonitor.recordLatency).toHaveBeenCalledWith(
        'EMOTE_SEARCH_DURATION',
        0.05,
        { query_length: 0, result_count: 0 }
      )
    })

    it('should handle missing 7TV data gracefully', () => {
      MetricsHelper.recordSevenTVWebSocketCreated('chatroom123')
      
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        chatroom_id: 'chatroom123'
      })
    })

    it('should handle performance monitoring errors gracefully', () => {
      // Mock SLO monitor to throw error
      mockSLOMonitor.recordLatency.mockImplementation(() => {
        throw new Error('SLO monitoring failed')
      })
      
      // Should not throw error
      expect(() => {
        MetricsHelper.recordMessageSendDuration(1.0, 'chatroom123', true)
      }).not.toThrow()
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent metric recording', async () => {
      const promises = []
      
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => {
            MetricsHelper.recordMessageSent(`chatroom${i}`, 'regular', `streamer${i}`)
            MetricsHelper.recordConnectionError('timeout', `chatroom${i}`)
          })
        )
      }
      
      await Promise.all(promises)
      
      // Should have recorded 200 metrics (2 per iteration)
      expect(mockCounterInstance.add).toHaveBeenCalledTimes(200)
    })

    it('should handle concurrent timer operations', () => {
      const timers = Array.from({ length: 10 }, () => MetricsHelper.startTimer())
      
      expect(timers).toHaveLength(10)
      expect(timers.every(timer => typeof timer === 'bigint')).toBe(true)
      
      const durations = timers.map(timer => MetricsHelper.endTimer(timer))
      expect(durations.every(duration => typeof duration === 'number')).toBe(true)
    })
  })
})