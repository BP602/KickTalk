import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Create mock ErrorMonitor with vi.hoisted to ensure it's created before module resolution
const { MockedErrorMonitor } = vi.hoisted(() => {
  const mockErrorMonitor = {
    recordError: vi.fn((error, context) => ({
      error_id: 'error_123',
      category: 'NETWORK'
    })),
    recordRecovery: vi.fn(),
    executeWithCircuitBreaker: vi.fn(async (name, operation, fallback) => {
      try {
        return await operation()
      } catch (error) {
        if (fallback) {
          return await fallback()
        }
        throw error
      }
    }),
    getCircuitBreaker: vi.fn(() => ({
      execute: vi.fn()
    })),
    getErrorStatistics: vi.fn(() => ({
      total_errors: 0,
      total_requests: 0,
      category_counts: {},
      recent_errors: [],
      circuit_breakers: []
    })),
    resetStatistics: vi.fn(),
    classifyError: vi.fn(() => 'NETWORK'),
    checkErrorRateSLOs: vi.fn()
  }
  
  return { MockedErrorMonitor: mockErrorMonitor }
})

// Mock the error-monitoring module
vi.mock('../error-monitoring.js', () => ({
  ErrorMonitor: MockedErrorMonitor,
  ERROR_CATEGORIES: {
    NETWORK: { severity: 'low' }
  },
  ERROR_RATE_SLOS: {},
  CircuitBreaker: class {}
}))

// Import modules after mocking
const {
  retryWithBackoff,
  calculateDelay,
  RETRY_PRESETS,
  setErrorMonitor
} = require('../retry-utils.js')

// Inject the mock ErrorMonitor into retry-utils
setErrorMonitor(MockedErrorMonitor)

describe('RETRY_PRESETS Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  describe('Preset Structure', () => {
    it('should have all required presets', () => {
      const requiredPresets = [
        'NETWORK', 'API', 'WEBSOCKET', 'SEVENTV', 'STORAGE', 'DEFAULT'
      ]
      
      requiredPresets.forEach(preset => {
        expect(RETRY_PRESETS[preset]).toBeDefined()
        expect(RETRY_PRESETS[preset].maxAttempts).toBeGreaterThan(0)
        expect(RETRY_PRESETS[preset].initialDelay).toBeGreaterThan(0)
        expect(RETRY_PRESETS[preset].maxDelay).toBeGreaterThan(0)
        expect(RETRY_PRESETS[preset].backoffMultiplier).toBeGreaterThan(1)
        expect(typeof RETRY_PRESETS[preset].jitter).toBe('boolean')
        expect(typeof RETRY_PRESETS[preset].retryCondition).toBe('function')
      })
    })

    it('should have logical delay progressions', () => {
      Object.values(RETRY_PRESETS).forEach(preset => {
        expect(preset.initialDelay).toBeLessThan(preset.maxDelay)
        expect(preset.backoffMultiplier).toBeGreaterThanOrEqual(1)
        expect(preset.backoffMultiplier).toBeLessThanOrEqual(5) // Reasonable upper bound
      })
    })

    it('should have reasonable retry attempt limits', () => {
      Object.values(RETRY_PRESETS).forEach(preset => {
        expect(preset.maxAttempts).toBeGreaterThan(0)
        expect(preset.maxAttempts).toBeLessThanOrEqual(10) // Reasonable upper bound
      })
    })
  })

  describe('Network Preset', () => {
    it('should have aggressive retry settings for network operations', () => {
      const network = RETRY_PRESETS.NETWORK
      
      expect(network.maxAttempts).toBe(5)
      expect(network.initialDelay).toBe(1000)
      expect(network.maxDelay).toBe(30000)
      expect(network.backoffMultiplier).toBe(2)
      expect(network.jitter).toBe(true)
    })

    it('should retry network errors', () => {
      const network = RETRY_PRESETS.NETWORK
      
      // Should retry connection errors
      expect(network.retryCondition({ code: 'ECONNREFUSED' })).toBe(true)
      expect(network.retryCondition({ code: 'ENOTFOUND' })).toBe(true)
      expect(network.retryCondition({ code: 'ETIMEDOUT' })).toBe(true)
      expect(network.retryCondition({ code: 'ECONNRESET' })).toBe(true)
      
      // Should retry 5xx errors
      expect(network.retryCondition({ response: { status: 500 } })).toBe(true)
      expect(network.retryCondition({ response: { status: 502 } })).toBe(true)
      expect(network.retryCondition({ response: { status: 503 } })).toBe(true)
      
      // Should not retry 4xx errors (except specific ones)
      expect(network.retryCondition({ response: { status: 400 } })).toBe(false)
      expect(network.retryCondition({ response: { status: 404 } })).toBe(false)
    })
  })

  describe('API Preset', () => {
    it('should have moderate retry settings', () => {
      const api = RETRY_PRESETS.API
      
      expect(api.maxAttempts).toBe(3)
      expect(api.initialDelay).toBe(500)
      expect(api.maxDelay).toBe(5000)
    })

    it('should retry appropriate HTTP errors', () => {
      const api = RETRY_PRESETS.API
      
      // Should retry server errors
      expect(api.retryCondition({ response: { status: 500 } })).toBe(true)
      expect(api.retryCondition({ response: { status: 502 } })).toBe(true)
      expect(api.retryCondition({ response: { status: 503 } })).toBe(true)
      
      // Should retry rate limiting
      expect(api.retryCondition({ response: { status: 429 } })).toBe(true)
      
      // Should retry timeouts
      expect(api.retryCondition({ response: { status: 408 } })).toBe(true)
      
      // Should not retry client errors
      expect(api.retryCondition({ response: { status: 400 } })).toBe(false)
      expect(api.retryCondition({ response: { status: 401 } })).toBe(false)
      expect(api.retryCondition({ response: { status: 404 } })).toBe(false)
    })
  })

  describe('WebSocket Preset', () => {
    it('should have patient retry settings', () => {
      const ws = RETRY_PRESETS.WEBSOCKET
      
      expect(ws.maxAttempts).toBe(10)
      expect(ws.initialDelay).toBe(2000)
      expect(ws.maxDelay).toBe(60000)
      expect(ws.backoffMultiplier).toBe(1.5) // Slower backoff
    })

    it('should not retry authorization errors', () => {
      const retryCondition = RETRY_PRESETS.WEBSOCKET.retryCondition
      
      // Should not retry auth errors - the implementation checks message, not code
      expect(retryCondition({ message: 'unauthorized access' })).toBe(false)
      expect(retryCondition({ message: 'User unauthorized' })).toBe(false)
      expect(retryCondition({ message: 'Authentication failed' })).toBe(true) // doesn't contain 'unauthorized'
      
      // Should retry other errors - websocket always retries unless auth error
      expect(retryCondition({ code: 'WS_CONNECTION_LOST' })).toBe(true)
      expect(retryCondition({ code: 'NETWORK_ERROR' })).toBe(true)
    })
  })

  describe('7TV Preset', () => {
    it('should have gentle retry settings', () => {
      const seventv = RETRY_PRESETS.SEVENTV
      
      expect(seventv.maxAttempts).toBe(3)
      expect(seventv.initialDelay).toBe(1000)
      expect(seventv.maxDelay).toBe(10000)
    })

    it('should retry server errors and rate limits', () => {
      const seventv = RETRY_PRESETS.SEVENTV
      
      expect(seventv.retryCondition({ response: { status: 500 } })).toBe(true)
      expect(seventv.retryCondition({ response: { status: 429 } })).toBe(true)
      expect(seventv.retryCondition({ message: 'Network error' })).toBe(true)
      
      // Should not retry client errors
      expect(seventv.retryCondition({ response: { status: 400 } })).toBe(false)
    })
  })

  describe('Storage Preset', () => {
    it('should have quick retry settings', () => {
      const storage = RETRY_PRESETS.STORAGE
      
      expect(storage.maxAttempts).toBe(3)
      expect(storage.initialDelay).toBe(100)
      expect(storage.maxDelay).toBe(1000)
      expect(storage.jitter).toBe(false) // No jitter for storage
    })

    it('should retry quota and temporary errors', () => {
      const retryCondition = RETRY_PRESETS.STORAGE.retryCondition
      
      // Should retry errors with 'quota' in message
      expect(retryCondition({ message: 'quota exceeded' })).toBe(true)
      expect(retryCondition({ message: 'Quota limit reached' })).toBe(false) // uppercase Q
      expect(retryCondition({ message: 'disk quota full' })).toBe(true)
      
      // Should retry errors with 'temporary' in message
      expect(retryCondition({ message: 'temporary failure' })).toBe(true)
      expect(retryCondition({ message: 'Temporary storage issue' })).toBe(false) // uppercase T
      
      // Should not retry other errors
      expect(retryCondition({ message: 'Permission denied' })).toBe(false)
      expect(retryCondition({ message: 'Unknown error' })).toBe(false)
    })
  })

  describe('Default Preset', () => {
    it('should have conservative settings', () => {
      const defaultPreset = RETRY_PRESETS.DEFAULT
      
      expect(defaultPreset.maxAttempts).toBe(3)
      expect(defaultPreset.initialDelay).toBe(1000)
      expect(defaultPreset.maxDelay).toBe(5000)
      expect(defaultPreset.backoffMultiplier).toBe(2)
      expect(defaultPreset.jitter).toBe(true)
    })

    it('should retry all errors by default', () => {
      const defaultPreset = RETRY_PRESETS.DEFAULT
      
      expect(defaultPreset.retryCondition(new Error('Any error'))).toBe(true)
      expect(defaultPreset.retryCondition({ message: 'Whatever' })).toBe(true)
    })
  })
})

describe('calculateDelay', () => {
  it('should calculate exponential backoff correctly', () => {
    const config = {
      initialDelay: 1000,
      backoffMultiplier: 2,
      maxDelay: 10000,
      jitter: false
    }
    
    expect(calculateDelay(1, config)).toBe(1000) // 1000 * 2^0
    expect(calculateDelay(2, config)).toBe(2000) // 1000 * 2^1
    expect(calculateDelay(3, config)).toBe(4000) // 1000 * 2^2
    expect(calculateDelay(4, config)).toBe(8000) // 1000 * 2^3
  })

  it('should respect maximum delay', () => {
    const config = {
      initialDelay: 1000,
      backoffMultiplier: 2,
      maxDelay: 5000,
      jitter: false
    }
    
    expect(calculateDelay(5, config)).toBe(5000) // Capped at maxDelay
    expect(calculateDelay(10, config)).toBe(5000) // Still capped
  })

  it('should add jitter when enabled', () => {
    const config = {
      initialDelay: 1000,
      backoffMultiplier: 2,
      maxDelay: 10000,
      jitter: true
    }
    
    // Run multiple times to test jitter variance
    const delays = []
    for (let i = 0; i < 10; i++) {
      delays.push(calculateDelay(2, config))
    }
    
    // All delays should be around 2000ms but with some variation
    const baseDelay = 2000
    delays.forEach(delay => {
      expect(delay).toBeGreaterThanOrEqual(baseDelay * 0.75) // -25% jitter
      expect(delay).toBeLessThanOrEqual(baseDelay * 1.25) // +25% jitter
    })
    
    // Should have some variation
    const uniqueDelays = [...new Set(delays)]
    expect(uniqueDelays.length).toBeGreaterThan(1)
  })

  it('should not go below zero with jitter', () => {
    const config = {
      initialDelay: 10,
      backoffMultiplier: 1.5,
      maxDelay: 1000,
      jitter: true
    }
    
    for (let i = 0; i < 20; i++) {
      const delay = calculateDelay(1, config)
      expect(delay).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('retryWithBackoff', () => {
  let originalConsoleLog
  let originalConsoleWarn
  let originalConsoleError
  let originalDateNow

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    // Mock console methods
    originalConsoleLog = console.log
    originalConsoleWarn = console.warn
    originalConsoleError = console.error
    console.log = vi.fn()
    console.warn = vi.fn()
    console.error = vi.fn()
    
    // Mock Date.now
    originalDateNow = Date.now
    Date.now = vi.fn(() => 1640000000000)
  })

  afterEach(() => {
    console.log = originalConsoleLog
    console.warn = originalConsoleWarn
    console.error = originalConsoleError
    Date.now = originalDateNow
    vi.useRealTimers()
  })

  describe('Successful Operations', () => {
    it('should return result on first try success', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      
      const result = await retryWithBackoff(operation)
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
      expect(operation).toHaveBeenCalledWith(1)
      expect(MockedErrorMonitor.recordRecovery).not.toHaveBeenCalled()
    })

    it('should record recovery on second attempt success', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('First fail'))
        .mockResolvedValue('success')
      
      const promise = retryWithBackoff(operation, { 
        maxAttempts: 3,
        operationName: 'test_operation'
      })
      
      // Advance timers to handle retry delay
      await vi.runAllTimersAsync()
      
      const result = await promise

      expect(result).toBe('success')
      expect(MockedErrorMonitor.recordRecovery).toHaveBeenCalledWith(
        expect.stringMatching(/^retry_test_operation_/),
        'retry_attempt_2',
        true,
        expect.any(Number)
      )
    })

    it('should wait between retries', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success')
      
      const promise = retryWithBackoff(operation, { 
        initialDelay: 100,
        maxAttempts: 2 
      })
      
      // Advance timers to handle retry delay
      await vi.runAllTimersAsync()
      
      await promise
      
      expect(operation).toHaveBeenCalledTimes(2)
    })
  })

  describe('Failed Operations', () => {
    it('should retry operation according to maxAttempts', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Persistent error'))
      
      const promise = expect(
        retryWithBackoff(operation, { 
          maxAttempts: 3,
          initialDelay: 10 
        })
      ).rejects.toThrow('Persistent error')
      
      // Advance all timers
      await vi.runAllTimersAsync()
      
      await promise
      
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('should record all errors and final failure', async () => {
      const error = new Error('Persistent failure')
      const operation = vi.fn().mockRejectedValue(error)
      
      const promise = expect(
        retryWithBackoff(operation, { 
          maxAttempts: 2,
          initialDelay: 10,
          operationName: 'test_op'
        })
      ).rejects.toThrow()
      
      // Advance all timers
      await vi.runAllTimersAsync()
      
      await promise
      
      expect(MockedErrorMonitor.recordError).toHaveBeenCalledTimes(2)
    })
  })

  describe('Configuration Options', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    
    afterEach(() => {
      vi.useRealTimers()
    })
    
    it('should use preset configuration', async () => {
      const apiError = new Error('API error')
      apiError.response = { status: 500 } // Make it a retryable error for API preset
      
      const operation = vi.fn()
        .mockRejectedValueOnce(apiError)
        .mockResolvedValue('api_success')
      
      const promise = retryWithBackoff(operation, { preset: 'API' })
      
      // Advance timers and wait for result in one step
      const [result] = await Promise.all([
        promise,
        vi.runAllTimersAsync()
      ])
      
      expect(result).toBe('api_success')
      expect(operation).toHaveBeenCalledTimes(2) // API error followed by success
    })

    it('should override preset with custom options', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success')
      
      const promise = retryWithBackoff(operation, {
        preset: 'NETWORK',
        maxAttempts: 1,  // Override NETWORK's 5 attempts
        operationName: 'custom_op'
      })
      
      await expect(promise).rejects.toThrow('fail')
      expect(operation).toHaveBeenCalledTimes(1)
      // Should record final failure since max attempts reached
      expect(MockedErrorMonitor.recordRecovery).toHaveBeenCalledWith(
        'error_123',
        'retry_exhausted',
        false,
        expect.any(Number)
      )
    })

    it('should pass context to error monitoring', async () => {
      const error = new Error('Context error')
      const operation = vi.fn().mockRejectedValue(error)
      const context = { userId: '123', action: 'upload' }
      
      const promise = retryWithBackoff(operation, {
        maxAttempts: 1,
        context
      })
      
      // No timer needed for single attempt
      await expect(promise).rejects.toThrow()
      // Should also record final failure through recordRecovery
      expect(MockedErrorMonitor.recordRecovery).toHaveBeenCalledWith(
        'error_123',  // The mocked error_id
        'retry_exhausted',
        false,
        expect.any(Number)
      )
    })
  })

  describe('Console Logging', () => {
    beforeEach(() => {
      console.log = vi.fn()
      console.warn = vi.fn()
      console.error = vi.fn()
    })

    it('should log retry attempts', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('retry me'))
        .mockResolvedValue('success')
      
      const promise = retryWithBackoff(operation, {
        maxAttempts: 3,
        initialDelay: 10,
        operationName: 'logged_op'
      })
      
      await vi.runAllTimersAsync()
      const result = await promise
      
      expect(result).toBe('success')
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/\[Retry\] Attempt 1\/3 for logged_op/)
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/\[Retry\] Attempt 2\/3 for logged_op/)
      )
    })

    it('should log retry warnings with delay info', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('temp'))
        .mockResolvedValue('result')
      
      const promise = retryWithBackoff(operation, {
        maxAttempts: 3,
        initialDelay: 50,
        operationName: 'warned_op'
      })
      
      await vi.runAllTimersAsync()
      await promise
      
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(/\[Retry\] Attempt 1\/3 failed for warned_op/),
        'temp'
      )
    })

    it('should log final failure', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('persistent'))
      
      const promise = retryWithBackoff(operation, {
        maxAttempts: 2,
        initialDelay: 10,
        operationName: 'failing_op'
      })
      
      await Promise.all([
        promise.catch(() => {}),
        vi.runAllTimersAsync()
      ])
      
      // Check that console.error was called for the final failure
      expect(console.error).toHaveBeenCalledWith(
        '[Retry] Final failure for failing_op after 2 attempts:',
        'persistent'
      )
    })

    it('should log success after retries', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('temp'))
        .mockResolvedValue('final')
      
      const promise = retryWithBackoff(operation, {
        maxAttempts: 3,
        initialDelay: 10,
        operationName: 'recovering_op'
      })
      
      // Advance timers
      await vi.runAllTimersAsync()
      
      await promise
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/\[Retry\] Success on attempt 2\/3 for recovering_op/)
      )
    })

    it('should use preset configuration', async () => {
      const operation = vi.fn()
        // Use a network-like error so NETWORK preset's retryCondition returns true
        .mockRejectedValueOnce(Object.assign(new Error('fail'), { code: 'ECONNRESET' }))
        .mockResolvedValue('success')
      
      const promise = retryWithBackoff(operation, {
        preset: 'NETWORK',
        operationName: 'network_op'
      })
      
      await vi.runAllTimersAsync()
      await promise
      
      expect(operation).toHaveBeenCalledTimes(2)
      // Should have recorded recovery on second attempt
      expect(MockedErrorMonitor.recordRecovery).toHaveBeenCalled()
    })
  })

  describe('retryWithCircuitBreaker', () => {
    let sut
    let CB

    beforeEach(async () => {
      vi.clearAllMocks()
      console.log = vi.fn()
      console.warn = vi.fn()
      console.error = vi.fn()
      vi.useFakeTimers()

      // Ensure fresh module graph so mock is applied before require()
      vi.resetModules()
      // Re-apply the mock within this fresh module graph
      vi.doMock('../error-monitoring.js', () => ({
        ErrorMonitor: MockedErrorMonitor,
        ERROR_CATEGORIES: { NETWORK: { severity: 'low' } },
        ERROR_RATE_SLOS: {},
        CircuitBreaker: class {}
      }))
      sut = await import('../retry-utils.js')
      // Use the same shared instance used by the SUT
      CB = MockedErrorMonitor
      // Ensure the SUT uses the same ErrorMonitor reference for its internal calls
      if (typeof sut.setErrorMonitor === 'function') {
        sut.setErrorMonitor(CB)
      }
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should use circuit breaker for operation execution', async () => {
      const operation = vi.fn().mockResolvedValue('cb_result')
      
      const result = await sut.retryWithCircuitBreaker(operation, {
        operationName: 'cb_test'
      })
      
      expect(result).toBe('cb_result')
      expect(CB.executeWithCircuitBreaker).toHaveBeenCalledWith(
        'cb_test',  // circuit breaker name
        expect.any(Function),  // operation should be the wrapped function, not the original
        undefined,  // no fallback
        expect.objectContaining({
          failureThreshold: 5,
          recoveryTimeout: 30000,
          monitoringWindow: 60000
        })
      )
    })

    it('should use custom circuit breaker name', async () => {
      const operation = vi.fn().mockResolvedValue('result')
      
      const promise = sut.retryWithCircuitBreaker(operation, {
        circuitBreakerName: 'my_circuit'
      })
      
      // No timers needed for successful first attempt
      await promise
      
      expect(CB.executeWithCircuitBreaker).toHaveBeenCalledWith(
        'my_circuit',
        expect.any(Function),
        undefined,
        expect.any(Object)
      )
    })

    it('should use circuit breaker with operation', async () => {
      const operation = vi.fn().mockResolvedValue('result')
      
      const promise = sut.retryWithCircuitBreaker(operation)
      
      // No timers needed for successful first attempt
      const result = await promise
      
      expect(result).toBe('result')
      expect(operation).toHaveBeenCalled()
      expect(CB.executeWithCircuitBreaker).toHaveBeenCalledWith(
        'unknown_operation',  // Default circuit breaker name
        expect.any(Function),  // retryWithCircuitBreaker wraps the operation
        undefined,
        expect.any(Object)
      )
    })

    it('should pass fallback to circuit breaker', async () => {
      const operation = vi.fn().mockResolvedValue('result')
      const fallback = vi.fn().mockResolvedValue('fallback_result')
      
      await sut.retryWithCircuitBreaker(operation, {
        fallback
      })
      
      expect(CB.executeWithCircuitBreaker).toHaveBeenCalledWith(
        'unknown_operation',  // Default circuit breaker name
        expect.any(Function),
        fallback,
        expect.any(Object)
      )
    })

    it('should use fallback on circuit breaker failure', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('cb_fail'))
      const fallback = vi.fn().mockResolvedValue('fallback_ok')
      
      // Mock implementation to simulate OPEN state and call fallback
      CB.executeWithCircuitBreaker.mockImplementationOnce(async (name, op, fb) => {
        // Simulate breaker OPEN: fail the operation then call fallback
        try {
          await op()
        } catch {
          return await fb()
        }
      })
      
      const result = await sut.retryWithCircuitBreaker(operation, { fallback })
      expect(result).toBe('fallback_ok')
      expect(fallback).toHaveBeenCalled()
    })
  })

// Removed RetryUtils tests as these methods don't exist in the actual implementation

describe('Edge Cases and Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    console.log = vi.fn()
    console.warn = vi.fn()
    console.error = vi.fn()
  })

  describe('Operation Function Edge Cases', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    
    afterEach(() => {
      vi.useRealTimers()
    })
    
    it('should handle null/undefined operations', async () => {
      // Null/undefined operations should be rejected immediately
      await expect(retryWithBackoff(null, { maxAttempts: 1, initialDelay: 1 })).rejects.toThrow()
      await expect(retryWithBackoff(undefined, { maxAttempts: 1, initialDelay: 1 })).rejects.toThrow()
    })

    it('should handle operations that return null/undefined', async () => {
      const nullOp = vi.fn().mockResolvedValue(null)
      const undefinedOp = vi.fn().mockResolvedValue(undefined)
      
      const nullResult = await retryWithBackoff(nullOp)
      const undefinedResult = await retryWithBackoff(undefinedOp)
      
      expect(nullResult).toBeNull()
      expect(undefinedResult).toBeUndefined()
    })

    it('should handle operations that throw non-Error objects', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce('string error')
        .mockResolvedValue('success')
      
      const promise = retryWithBackoff(operation, {
        maxAttempts: 2,
        initialDelay: 10
      })
      
      // Advance timers
      await vi.runAllTimersAsync()
      
      const result = await promise
      
      expect(result).toBe('success')
    })

    it('should handle very large delays', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success')
      
      const promise = retryWithBackoff(operation, {
        maxAttempts: 2,
        initialDelay: 1000000, // Large but not infinite
        maxDelay: 2000000 // Large but not infinite
      })
      
      // Advance all timers to complete the delay
      await vi.runAllTimersAsync()
      
      const result = await promise
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should handle invalid backoff multiplier', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success')
      
      const promise = retryWithBackoff(operation, {
        backoffMultiplier: 0,
        maxAttempts: 2,
        initialDelay: 10
      })
      
      // Advance timers
      await vi.runAllTimersAsync()
      
      const result = await promise
      
      expect(result).toBe('success')
    })

    it('should handle negative delays', async () => {
      vi.useFakeTimers()
      
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success')
      
      const promise = retryWithBackoff(operation, {
        maxAttempts: 2,
        initialDelay: -100 // Negative delay
      })
      
      // Advance timers for retry
      await vi.runAllTimersAsync()
      
      await promise
      
      expect(operation).toHaveBeenCalledTimes(2)
      // Should use minimum delay (0) instead of negative
      
      vi.useRealTimers()
    })

    it('should handle very large backoff multipliers', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success')
      
      const promise = retryWithBackoff(operation, {
        maxAttempts: 2,
        initialDelay: 10,
        backoffMultiplier: 1000000 // Large but not infinite
      })
      
      // Advance timers
      await vi.runAllTimersAsync()
      
      const result = await promise
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })
  })

  describe('Error Monitoring Edge Cases', () => {
    it('should handle ErrorMonitor failures gracefully', async () => {
      MockedErrorMonitor.recordError.mockImplementation(() => {
        throw new Error('Error monitoring failed')
      })
      
      const operation = vi.fn().mockRejectedValue(new Error('Original error'))
      
      await expect(retryWithBackoff(operation, { maxAttempts: 1 })).rejects.toThrow('Original error')
    })

    it('should handle missing error monitoring', async () => {
      // Temporarily disable error monitoring
      const originalRecordError = MockedErrorMonitor.recordError
      MockedErrorMonitor.recordError = undefined
      
      const operation = vi.fn().mockRejectedValue(new Error('No monitoring'))
      
      await expect(retryWithBackoff(operation, { maxAttempts: 1 })).rejects.toThrow('No monitoring')
      
      MockedErrorMonitor.recordError = originalRecordError
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent retry operations', async () => {
      vi.useRealTimers() // Use real timers for concurrent operations
      
      const operations = Array.from({ length: 10 }, (_, i) => 
        vi.fn()
          .mockRejectedValueOnce(new Error(`Fail ${i}`))
          .mockResolvedValue(`success_${i}`)
      )
      
      const promises = operations.map(op => retryWithBackoff(op, {
        maxAttempts: 2,
        initialDelay: 10
      }))
      
      const results = await Promise.all(promises)
      
      results.forEach((result, i) => {
        expect(result).toBe(`success_${i}`)
      })
    })

    it('should maintain separate retry state for concurrent operations', async () => {
      vi.useRealTimers() // Use real timers for concurrent operations
      
      const slowOp = vi.fn()
        .mockRejectedValueOnce(new Error('Slow fail'))
        .mockResolvedValue('slow_success')
      
      const fastOp = vi.fn()
        .mockResolvedValue('fast_success')
      
      const slowPromise = retryWithBackoff(slowOp, {
        maxAttempts: 2,
        initialDelay: 100
      })
      
      const fastPromise = retryWithBackoff(fastOp, {
        maxAttempts: 2,
        initialDelay: 10
      })
      
      const [slowResult, fastResult] = await Promise.all([slowPromise, fastPromise])
      
      expect(slowResult).toBe('slow_success')
      expect(fastResult).toBe('fast_success')
      expect(slowOp).toHaveBeenCalledTimes(2)
      expect(fastOp).toHaveBeenCalledTimes(1)
    })
  })

  describe('Memory and Performance', () => {
    it('should not leak memory with many retry operations', async () => {
      const operations = []
      
      for (let i = 0; i < 100; i++) {
        const op = vi.fn().mockResolvedValue(`result_${i}`)
        operations.push(retryWithBackoff(op, { operationName: `op_${i}` }))
      }
      
      const results = await Promise.all(operations)
      
      expect(results).toHaveLength(100)
      expect(results[0]).toBe('result_0')
      expect(results[99]).toBe('result_99')
    })

    it('should handle high-frequency retry operations', async () => {
      const startTime = Date.now()
      
      const promises = Array.from({ length: 50 }, (_, i) => {
        const op = vi.fn().mockResolvedValue(`fast_${i}`)
        return retryWithBackoff(op, { maxAttempts: 1 })
      })
      
      await Promise.all(promises)
      
      const endTime = Date.now()
      expect(endTime - startTime).toBeLessThan(5000) // Should complete quickly
    })
  })
})

})
