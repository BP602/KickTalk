import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ErrorMonitor, ERROR_CATEGORIES, ERROR_RATE_SLOS, CircuitBreaker } from '../error-monitoring.js'

// Mock OpenTelemetry APIs
const mockCounter = { add: vi.fn() }
const mockGauge = { addCallback: vi.fn() }
const mockHistogram = { record: vi.fn() }

const mockMeter = {
  createCounter: vi.fn(() => mockCounter),
  createObservableGauge: vi.fn(() => mockGauge),
  createHistogram: vi.fn(() => mockHistogram)
}

const mockMetrics = {
  getMeter: vi.fn(() => mockMeter)
}

// Mock SLO monitoring
const mockSLOMonitor = {
  recordOperationResult: vi.fn()
}

vi.mock('@opentelemetry/api', () => ({
  metrics: mockMetrics
}))

vi.mock('../slo-monitoring', () => ({
  SLOMonitor: mockSLOMonitor
}))

// Mock package.json
vi.mock('../../package.json', () => ({
  default: {
    version: '1.0.0-test'
  }
}))

describe('ErrorMonitor', () => {
  let originalConsoleError
  let originalConsoleWarn
  let originalConsoleLog

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock console methods to reduce noise in tests
    originalConsoleError = console.error
    originalConsoleWarn = console.warn  
    originalConsoleLog = console.log
    console.error = vi.fn()
    console.warn = vi.fn()
    console.log = vi.fn()
    
    // Reset error statistics
    ErrorMonitor.resetStatistics()
  })

  afterEach(() => {
    console.error = originalConsoleError
    console.warn = originalConsoleWarn
    console.log = originalConsoleLog
  })

  describe('Error Classification', () => {
    it('should classify network errors correctly', () => {
      const networkError = new Error('Connection failed')
      networkError.code = 'ECONNREFUSED'
      
      const classification = ErrorMonitor.classifyError(networkError, {})
      expect(classification).toBe('NETWORK')
    })

    it('should classify websocket errors correctly', () => {
      const wsError = new Error('WebSocket connection lost')
      
      const classification = ErrorMonitor.classifyError(wsError, {
        component: 'websocket'
      })
      expect(classification).toBe('WEBSOCKET')
    })

    it('should classify API errors correctly', () => {
      const apiError = new Error('API request failed')
      apiError.code = 500
      
      const classification = ErrorMonitor.classifyError(apiError, {
        operation: 'api_call'
      })
      expect(classification).toBe('API')
    })

    it('should classify authentication errors correctly', () => {
      const authError = new Error('Unauthorized')
      authError.code = 401
      
      const classification = ErrorMonitor.classifyError(authError, {})
      expect(classification).toBe('AUTH')
    })

    it('should classify 7TV errors correctly', () => {
      const stvError = new Error('7TV service unavailable')
      
      const classification = ErrorMonitor.classifyError(stvError, {
        component: '7tv'
      })
      expect(classification).toBe('SEVENTV')
    })

    it('should classify parsing errors correctly', () => {
      const parseError = new SyntaxError('JSON parse error')
      
      const classification = ErrorMonitor.classifyError(parseError, {})
      expect(classification).toBe('PARSING')
    })

    it('should classify render errors correctly', () => {
      const renderError = new Error('Component render failed')
      renderError.name = 'RenderError'
      
      const classification = ErrorMonitor.classifyError(renderError, {})
      expect(classification).toBe('RENDER')
    })

    it('should classify storage errors correctly', () => {
      const storageError = new Error('Storage quota exceeded')
      
      const classification = ErrorMonitor.classifyError(storageError, {})
      expect(classification).toBe('STORAGE')
    })

    it('should fall back to NETWORK for unknown errors', () => {
      const unknownError = new Error('Unknown error')
      
      const classification = ErrorMonitor.classifyError(unknownError, {})
      expect(classification).toBe('NETWORK')
    })
  })

  describe('Error Recording', () => {
    it('should record error with proper metrics', () => {
      const error = new Error('Test error')
      const context = {
        operation: 'test_operation',
        component: 'test_component',
        user_id: 'user123'
      }

      const result = ErrorMonitor.recordError(error, context)

      expect(result).toEqual({
        error_id: expect.stringMatching(/^NETWORK_\d+$/),
        category: 'NETWORK',
        severity: 'high',
        recovery_actions: ['retry', 'fallback']
      })

      // Verify counter was called
      expect(mockMeter.createCounter().add).toHaveBeenCalledWith(1, {
        error_category: 'NETWORK',
        severity: 'high',
        error_type: 'Error',
        error_code: 'unknown',
        operation: 'test_operation',
        component: 'test_component',
        user_id: 'user123'
      })
    })

    it('should track error statistics', () => {
      ErrorMonitor.recordError(new Error('Test error 1'), {})
      ErrorMonitor.recordError(new Error('Test error 2'), {})

      const stats = ErrorMonitor.getErrorStatistics()
      
      expect(stats.total_errors).toBe(2)
      expect(stats.category_counts.NETWORK).toBe(2)
      expect(stats.recent_errors).toHaveLength(2)
    })

    it('should limit recent errors to 100', () => {
      // Add 105 errors
      for (let i = 0; i < 105; i++) {
        ErrorMonitor.recordError(new Error(`Test error ${i}`), {})
      }

      const stats = ErrorMonitor.getErrorStatistics()
      expect(stats.recent_errors).toHaveLength(100)
      expect(stats.total_errors).toBe(105)
    })

    it('should check SLO violations', () => {
      const error = new Error('Test error')
      
      ErrorMonitor.recordError(error, {})
      
      expect(mockSLOMonitor.recordOperationResult).toHaveBeenCalled()
    })
  })

  describe('Error Recovery', () => {
    it('should record successful recovery', () => {
      const errorId = 'test_error_123'
      const recoveryAction = 'retry'
      const duration = 1500

      ErrorMonitor.recordRecovery(errorId, recoveryAction, true, duration)

      expect(mockMeter.createCounter().add).toHaveBeenCalledWith(1, {
        error_id: errorId,
        recovery_action: recoveryAction,
        success: 'true',
        duration_ms: duration
      })

      expect(mockMeter.createHistogram().record).toHaveBeenCalledWith(1.5, {
        recovery_action: recoveryAction,
        resolution_type: 'automatic'
      })
    })

    it('should record failed recovery', () => {
      const errorId = 'test_error_123'
      const recoveryAction = 'retry'

      ErrorMonitor.recordRecovery(errorId, recoveryAction, false, 1000)

      expect(mockMeter.createCounter().add).toHaveBeenCalledWith(1, {
        error_id: errorId,
        recovery_action: recoveryAction,
        success: 'false',
        duration_ms: 1000
      })

      // Should not record resolution histogram for failed recovery
      expect(mockMeter.createHistogram().record).not.toHaveBeenCalled()
    })

    it('should update recent errors with recovery info', () => {
      // Record an error first
      const error = new Error('Test error')
      const errorResult = ErrorMonitor.recordError(error, {})
      
      // Record recovery
      ErrorMonitor.recordRecovery(errorResult.error_id, 'retry', true, 1000)
      
      const stats = ErrorMonitor.getErrorStatistics()
      const recentError = stats.recent_errors[0]
      
      expect(recentError.recovery_attempted).toBe(true)
      expect(recentError.recovery_action).toBe('retry')
      expect(recentError.recovery_success).toBe(true)
    })
  })

  describe('Circuit Breaker Integration', () => {
    it('should get or create circuit breaker', () => {
      const breaker1 = ErrorMonitor.getCircuitBreaker('test_breaker')
      const breaker2 = ErrorMonitor.getCircuitBreaker('test_breaker')

      expect(breaker1).toBe(breaker2) // Should return same instance
      expect(breaker1).toBeInstanceOf(CircuitBreaker)
    })

    it('should execute operation with circuit breaker protection', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success')
      
      const result = await ErrorMonitor.executeWithCircuitBreaker(
        'test_operation',
        mockOperation
      )

      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalled()
    })

    it('should handle circuit breaker failures with fallback', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Operation failed'))
      const mockFallback = vi.fn().mockResolvedValue('fallback_result')
      
      const breaker = ErrorMonitor.getCircuitBreaker('test_breaker')
      // Simulate circuit breaker in OPEN state
      breaker.state = 'OPEN'
      breaker.lastFailureTime = Date.now()

      const result = await ErrorMonitor.executeWithCircuitBreaker(
        'test_operation',
        mockOperation,
        mockFallback
      )

      expect(result).toBe('fallback_result')
      expect(mockFallback).toHaveBeenCalled()
    })

    it('should record errors when circuit breaker operations fail', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Operation failed'))
      
      await expect(
        ErrorMonitor.executeWithCircuitBreaker('test_operation', mockOperation)
      ).rejects.toThrow('Operation failed')

      const stats = ErrorMonitor.getErrorStatistics()
      expect(stats.total_errors).toBe(1)
    })
  })

  describe('SLO Violation Checking', () => {
    it('should check error rate SLOs', () => {
      // Record some errors to trigger SLO checking
      for (let i = 0; i < 5; i++) {
        ErrorMonitor.recordError(new Error(`Test error ${i}`), {})
      }

      expect(mockSLOMonitor.recordOperationResult).toHaveBeenCalled()
    })

    it('should handle unknown error categories in SLO checking', () => {
      ErrorMonitor.checkErrorRateSLOs('UNKNOWN_CATEGORY')
      
      // Should not throw and should fall back to overall error rate
      expect(mockSLOMonitor.recordOperationResult).toHaveBeenCalledWith(
        'error_rate_unknown_category',
        false,
        null,
        expect.objectContaining({
          current_rate: expect.any(String),
          target_rate: expect.any(String),
          severity: expect.any(String)
        })
      )
    })
  })

  describe('Error Statistics', () => {
    it('should return complete error statistics', () => {
      const error1 = new Error('Network error')
      error1.code = 'ECONNREFUSED'
      const error2 = new Error('Parse error')

      ErrorMonitor.recordError(error1, { operation: 'network_call' })
      ErrorMonitor.recordError(error2, { operation: 'parse_data' })

      const stats = ErrorMonitor.getErrorStatistics()

      expect(stats).toEqual({
        total_errors: 2,
        total_requests: 0,
        category_counts: {
          NETWORK: 1,
          PARSING: 1
        },
        recent_errors: expect.arrayContaining([
          expect.objectContaining({
            category: 'NETWORK',
            severity: 'high'
          }),
          expect.objectContaining({
            category: 'PARSING',
            severity: 'low'
          })
        ]),
        circuit_breakers: []
      })
    })

    it('should include circuit breaker status in statistics', () => {
      const breaker = ErrorMonitor.getCircuitBreaker('test_breaker')
      
      const stats = ErrorMonitor.getErrorStatistics()
      
      expect(stats.circuit_breakers).toContainEqual({
        name: 'test_breaker',
        state: 'CLOSED',
        failureCount: 0,
        errorRate: 0,
        totalRequests: 0
      })
    })

    it('should reset statistics correctly', () => {
      // Add some errors and circuit breakers
      ErrorMonitor.recordError(new Error('Test'), {})
      ErrorMonitor.getCircuitBreaker('test_breaker')

      let stats = ErrorMonitor.getErrorStatistics()
      expect(stats.total_errors).toBe(1)
      expect(stats.circuit_breakers).toHaveLength(1)

      ErrorMonitor.resetStatistics()

      stats = ErrorMonitor.getErrorStatistics()
      expect(stats.total_errors).toBe(0)
      expect(stats.category_counts).toEqual({})
      expect(stats.recent_errors).toEqual([])
    })
  })

  describe('Error Categories Configuration', () => {
    it('should have all required error categories', () => {
      const requiredCategories = [
        'NETWORK', 'WEBSOCKET', 'API', 'PARSING', 
        'AUTH', 'SEVENTV', 'RENDER', 'STORAGE'
      ]

      requiredCategories.forEach(category => {
        expect(ERROR_CATEGORIES[category]).toBeDefined()
        expect(ERROR_CATEGORIES[category]).toHaveProperty('code', category)
        expect(ERROR_CATEGORIES[category]).toHaveProperty('description')
        expect(ERROR_CATEGORIES[category]).toHaveProperty('severity')
        expect(ERROR_CATEGORIES[category]).toHaveProperty('recovery_actions')
      })
    })

    it('should have valid severity levels', () => {
      const validSeverities = ['low', 'medium', 'high', 'critical']

      Object.values(ERROR_CATEGORIES).forEach(category => {
        expect(validSeverities).toContain(category.severity)
      })
    })

    it('should have recovery actions for all categories', () => {
      Object.values(ERROR_CATEGORIES).forEach(category => {
        expect(Array.isArray(category.recovery_actions)).toBe(true)
        expect(category.recovery_actions.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Error Rate SLO Configuration', () => {
    it('should have all required SLO targets', () => {
      const requiredSLOs = [
        'OVERALL_ERROR_RATE', 
        'NETWORK_ERROR_RATE', 
        'WEBSOCKET_ERROR_RATE'
      ]

      requiredSLOs.forEach(slo => {
        expect(ERROR_RATE_SLOS[slo]).toBeDefined()
        expect(ERROR_RATE_SLOS[slo]).toHaveProperty('target')
        expect(ERROR_RATE_SLOS[slo]).toHaveProperty('critical_threshold')
        expect(ERROR_RATE_SLOS[slo]).toHaveProperty('time_window')
        expect(ERROR_RATE_SLOS[slo]).toHaveProperty('description')
      })
    })

    it('should have valid SLO target ranges', () => {
      Object.values(ERROR_RATE_SLOS).forEach(slo => {
        expect(slo.target).toBeGreaterThan(0)
        expect(slo.target).toBeLessThan(1)
        expect(slo.critical_threshold).toBeGreaterThanOrEqual(slo.target)
        expect(slo.time_window).toBeGreaterThan(0)
      })
    })
  })

  describe('Edge Cases and Error Conditions', () => {
    it('should handle null/undefined errors gracefully', () => {
      const result1 = ErrorMonitor.recordError(null, {})
      const result2 = ErrorMonitor.recordError(undefined, {})

      expect(result1.category).toBe('NETWORK')
      expect(result2.category).toBe('NETWORK')
    })

    it('should handle empty context gracefully', () => {
      const error = new Error('Test error')
      
      const result = ErrorMonitor.recordError(error)
      
      expect(result.category).toBe('NETWORK')
      expect(result.severity).toBe('high')
    })

    it('should handle errors without message', () => {
      const error = new Error()
      delete error.message
      
      const result = ErrorMonitor.recordError(error, {})
      
      expect(result.category).toBe('NETWORK')
    })

    it('should handle very long error messages', () => {
      const longMessage = 'A'.repeat(10000)
      const error = new Error(longMessage)
      
      const result = ErrorMonitor.recordError(error, {})
      
      expect(result.category).toBe('NETWORK')
      
      const stats = ErrorMonitor.getErrorStatistics()
      expect(stats.recent_errors[0].message).toBe(longMessage)
    })

    it('should handle concurrent error recording', async () => {
      const errors = []
      const promises = []

      for (let i = 0; i < 100; i++) {
        const error = new Error(`Concurrent error ${i}`)
        promises.push(
          Promise.resolve().then(() => ErrorMonitor.recordError(error, {}))
        )
      }

      const results = await Promise.all(promises)
      
      expect(results).toHaveLength(100)
      
      const stats = ErrorMonitor.getErrorStatistics()
      expect(stats.total_errors).toBe(100)
    })
  })
})

describe('CircuitBreaker', () => {
  let breaker
  let originalConsoleLog
  let originalConsoleWarn

  beforeEach(() => {
    breaker = new CircuitBreaker('test_breaker', {
      failureThreshold: 3,
      recoveryTimeout: 1000,
      monitoringWindow: 5000
    })
    
    // Mock console methods
    originalConsoleLog = console.log
    originalConsoleWarn = console.warn
    console.log = vi.fn()
    console.warn = vi.fn()
  })

  afterEach(() => {
    console.log = originalConsoleLog
    console.warn = originalConsoleWarn
  })

  describe('Circuit Breaker States', () => {
    it('should start in CLOSED state', () => {
      expect(breaker.state).toBe('CLOSED')
      expect(breaker.failureCount).toBe(0)
    })

    it('should transition to OPEN after threshold failures', async () => {
      const failingOperation = vi.fn().mockRejectedValue(new Error('Failed'))

      // Exceed failure threshold
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingOperation)).rejects.toThrow()
      }

      expect(breaker.state).toBe('OPEN')
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('OPENED due to 3 failures')
      )
    })

    it('should reject immediately when OPEN', async () => {
      breaker.state = 'OPEN'
      breaker.lastFailureTime = Date.now()
      
      const operation = vi.fn()

      await expect(breaker.execute(operation)).rejects.toThrow(
        'Circuit breaker test_breaker is OPEN'
      )

      expect(operation).not.toHaveBeenCalled()
    })

    it('should transition to HALF_OPEN after recovery timeout', async () => {
      breaker.state = 'OPEN'
      breaker.lastFailureTime = Date.now() - 2000 // 2 seconds ago
      
      const successfulOperation = vi.fn().mockResolvedValue('success')
      
      const result = await breaker.execute(successfulOperation)
      
      expect(result).toBe('success')
      expect(breaker.state).toBe('CLOSED')
    })

    it('should handle HALF_OPEN state transitions', async () => {
      breaker.state = 'HALF_OPEN'
      breaker.successCount = 2

      const successfulOperation = vi.fn().mockResolvedValue('success')
      
      await breaker.execute(successfulOperation)
      
      expect(breaker.state).toBe('CLOSED')
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Recovered, transitioning to CLOSED')
      )
    })

    it('should return to OPEN if HALF_OPEN fails', async () => {
      breaker.state = 'HALF_OPEN'
      
      const failingOperation = vi.fn().mockRejectedValue(new Error('Failed'))
      
      await expect(breaker.execute(failingOperation)).rejects.toThrow()
      
      expect(breaker.state).toBe('OPEN')
    })
  })

  describe('Circuit Breaker Execution', () => {
    it('should execute operation successfully', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      
      const result = await breaker.execute(operation)
      
      expect(result).toBe('success')
      expect(breaker.failureCount).toBe(0)
      expect(breaker.successCount).toBe(1)
    })

    it('should handle operation failures', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Operation failed'))
      
      await expect(breaker.execute(operation)).rejects.toThrow('Operation failed')
      
      expect(breaker.failureCount).toBe(1)
      expect(breaker.totalRequests).toBe(1)
    })

    it('should use fallback when available', async () => {
      const failingOperation = vi.fn().mockRejectedValue(new Error('Failed'))
      const fallback = vi.fn().mockResolvedValue('fallback_result')
      
      breaker.state = 'OPEN'
      breaker.lastFailureTime = Date.now()

      const result = await breaker.execute(failingOperation, fallback)
      
      expect(result).toBe('fallback_result')
      expect(fallback).toHaveBeenCalled()
    })

    it('should handle failing fallback', async () => {
      const failingOperation = vi.fn().mockRejectedValue(new Error('Operation failed'))
      const failingFallback = vi.fn().mockRejectedValue(new Error('Fallback failed'))
      
      breaker.state = 'OPEN'
      breaker.lastFailureTime = Date.now()

      await expect(
        breaker.execute(failingOperation, failingFallback)
      ).rejects.toThrow('Operation failed') // Original error should be thrown
    })
  })

  describe('Circuit Breaker History and Metrics', () => {
    it('should track request history', async () => {
      const successOperation = vi.fn().mockResolvedValue('success')
      const failOperation = vi.fn().mockRejectedValue(new Error('failed'))

      await breaker.execute(successOperation)
      await expect(breaker.execute(failOperation)).rejects.toThrow()

      expect(breaker.requestHistory).toHaveLength(2)
      expect(breaker.requestHistory[0].success).toBe(true)
      expect(breaker.requestHistory[1].success).toBe(false)
    })

    it('should calculate error rate correctly', async () => {
      const successOperation = vi.fn().mockResolvedValue('success')
      const failOperation = vi.fn().mockRejectedValue(new Error('failed'))

      // 3 successes, 2 failures = 40% error rate
      await breaker.execute(successOperation)
      await breaker.execute(successOperation)
      await breaker.execute(successOperation)
      await expect(breaker.execute(failOperation)).rejects.toThrow()
      await expect(breaker.execute(failOperation)).rejects.toThrow()

      expect(breaker.getErrorRate()).toBeCloseTo(0.4)
    })

    it('should clean old entries from history', async () => {
      // Mock Date.now to control time
      const originalDateNow = Date.now
      let currentTime = 1000

      vi.spyOn(Date, 'now').mockImplementation(() => currentTime)

      const operation = vi.fn().mockResolvedValue('success')

      // Add entry at time 1000
      await breaker.execute(operation)
      expect(breaker.requestHistory).toHaveLength(1)

      // Move time forward beyond monitoring window
      currentTime = 7000 // 6 seconds later (window is 5000ms)
      await breaker.execute(operation)

      // Old entry should be cleaned
      expect(breaker.requestHistory).toHaveLength(1)
      expect(breaker.requestHistory[0].timestamp).toBe(7000)

      Date.now = originalDateNow
    })

    it('should return correct status', () => {
      breaker.failureCount = 2
      breaker.totalRequests = 5

      const status = breaker.getStatus()

      expect(status).toEqual({
        state: 'CLOSED',
        failureCount: 2,
        errorRate: 0,
        totalRequests: 5
      })
    })
  })

  describe('Circuit Breaker Configuration', () => {
    it('should use custom configuration', () => {
      const customBreaker = new CircuitBreaker('custom', {
        failureThreshold: 10,
        recoveryTimeout: 5000,
        monitoringWindow: 10000
      })

      expect(customBreaker.failureThreshold).toBe(10)
      expect(customBreaker.recoveryTimeout).toBe(5000)
      expect(customBreaker.monitoringWindow).toBe(10000)
    })

    it('should use default configuration when not provided', () => {
      const defaultBreaker = new CircuitBreaker('default')

      expect(defaultBreaker.failureThreshold).toBe(5)
      expect(defaultBreaker.recoveryTimeout).toBe(30000)
      expect(defaultBreaker.monitoringWindow).toBe(60000)
    })
  })

  describe('Circuit Breaker Edge Cases', () => {
    it('should handle zero error rate', () => {
      expect(breaker.getErrorRate()).toBe(0)
    })

    it('should handle concurrent operations', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      
      const promises = Array.from({ length: 10 }, () => breaker.execute(operation))
      
      const results = await Promise.all(promises)
      
      expect(results).toHaveLength(10)
      expect(results.every(r => r === 'success')).toBe(true)
      expect(breaker.totalRequests).toBe(10)
    })

    it('should handle very short monitoring window', () => {
      const shortWindowBreaker = new CircuitBreaker('short', {
        monitoringWindow: 1 // 1ms
      })

      // This should not crash
      expect(shortWindowBreaker.getErrorRate()).toBe(0)
    })
  })
})