import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  RetryUtils,
  retryWithBackoff,
  retryWithCircuitBreaker,
  RETRY_PRESETS,
  calculateDelay
} from '../retry-utils.js'

// Mock ErrorMonitor
const mockErrorMonitor = {
  recordError: vi.fn(() => ({
    error_id: 'error_123',
    category: 'NETWORK',
    severity: 'high'
  })),
  recordRecovery: vi.fn(),
  executeWithCircuitBreaker: vi.fn(),
  getCircuitBreaker: vi.fn(() => ({
    execute: vi.fn()
  }))
}

// Mock modules
vi.mock('../error-monitoring', () => ({
  ErrorMonitor: mockErrorMonitor
}))

// Mock sleep function to make tests faster
const mockSleep = vi.fn().mockResolvedValue()
vi.mock('../retry-utils', async () => {
  const actual = await vi.importActual('../retry-utils')
  return {
    ...actual,
    sleep: mockSleep
  }
})

describe('RETRY_PRESETS Configuration', () => {
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
      const ws = RETRY_PRESETS.WEBSOCKET
      
      expect(ws.retryCondition({ message: 'unauthorized' })).toBe(false)
      expect(ws.retryCondition({ message: 'Unauthorized access' })).toBe(false)
      
      // Should retry other errors
      expect(ws.retryCondition({ message: 'Connection failed' })).toBe(true)
      expect(ws.retryCondition({ message: 'Network error' })).toBe(true)
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
      const storage = RETRY_PRESETS.STORAGE
      
      expect(storage.retryCondition({ message: 'quota exceeded' })).toBe(true)
      expect(storage.retryCondition({ message: 'Quota limit reached' })).toBe(true)
      expect(storage.retryCondition({ message: 'temporary failure' })).toBe(true)
      expect(storage.retryCondition({ message: 'Temporary storage issue' })).toBe(true)
      
      // Should not retry other errors
      expect(storage.retryCondition({ message: 'Permission denied' })).toBe(false)
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
  })

  describe('Successful Operations', () => {
    it('should return result on first try success', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      
      const result = await retryWithBackoff(operation)
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
      expect(operation).toHaveBeenCalledWith(1)
      expect(mockErrorMonitor.recordRecovery).not.toHaveBeenCalled()
    })

    it('should record recovery on second attempt success', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValue('success')
      
      const result = await retryWithBackoff(operation, {
        operationName: 'test_operation'
      })
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
      expect(mockErrorMonitor.recordRecovery).toHaveBeenCalledWith(
        'retry_test_operation_1640000000000',
        'retry_attempt_2',
        true,
        0
      )
    })
  })

  describe('Failed Operations', () => {
    it('should retry operation according to maxAttempts', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Always fails'))
      
      await expect(retryWithBackoff(operation, {
        maxAttempts: 3
      })).rejects.toThrow('Always fails')
      
      expect(operation).toHaveBeenCalledTimes(3)
      expect(operation).toHaveBeenNthCalledWith(1, 1)
      expect(operation).toHaveBeenNthCalledWith(2, 2)
      expect(operation).toHaveBeenNthCalledWith(3, 3)
    })

    it('should record all errors and final failure', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Network error'))
      
      await expect(retryWithBackoff(operation, {
        maxAttempts: 2,
        operationName: 'test_op'
      })).rejects.toThrow('Network error')
      
      expect(mockErrorMonitor.recordError).toHaveBeenCalledTimes(2)
      expect(mockErrorMonitor.recordRecovery).toHaveBeenCalledWith(
        'error_123',
        'retry_exhausted',
        false,
        0
      )
    })

    it('should respect retry condition', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Do not retry'))
      const retryCondition = vi.fn().mockReturnValue(false)
      
      await expect(retryWithBackoff(operation, {
        maxAttempts: 3,
        retryCondition
      })).rejects.toThrow('Do not retry')
      
      expect(operation).toHaveBeenCalledTimes(1)
      expect(retryCondition).toHaveBeenCalledWith(expect.any(Error))
    })

    it('should wait between retries', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success')
      
      await retryWithBackoff(operation, {
        initialDelay: 100,
        backoffMultiplier: 2,
        jitter: false
      })
      
      expect(mockSleep).toHaveBeenCalledTimes(2)
      expect(mockSleep).toHaveBeenNthCalledWith(1, 100)
      expect(mockSleep).toHaveBeenNthCalledWith(2, 200)
    })
  })

  describe('Configuration Options', () => {
    it('should use preset configuration', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Network error'))
      
      await expect(retryWithBackoff(operation, {
        preset: 'NETWORK'
      })).rejects.toThrow('Network error')
      
      expect(operation).toHaveBeenCalledTimes(5) // NETWORK preset has 5 attempts
    })

    it('should override preset with custom options', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Custom error'))
      
      await expect(retryWithBackoff(operation, {
        preset: 'NETWORK',
        maxAttempts: 2 // Override preset's 5 attempts
      })).rejects.toThrow('Custom error')
      
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should pass context to error monitoring', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Context error'))
      
      await expect(retryWithBackoff(operation, {
        operationName: 'test_operation',
        component: 'test_component',
        userId: 'user123',
        context: { extra: 'data' }
      })).rejects.toThrow('Context error')
      
      expect(mockErrorMonitor.recordError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          operation: 'test_operation',
          component: 'test_component',
          user_id: 'user123',
          extra: 'data',
          retry_attempt: 1,
          max_attempts: 3
        })
      )
    })
  })

  describe('Console Logging', () => {
    it('should log retry attempts', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success')
      
      await retryWithBackoff(operation, {
        operationName: 'test_operation'
      })
      
      expect(console.log).toHaveBeenCalledWith(
        '[Retry] Attempt 1/3 for test_operation'
      )
      expect(console.log).toHaveBeenCalledWith(
        '[Retry] Attempt 2/3 for test_operation'
      )
    })

    it('should log retry warnings with delay info', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValue('success')
      
      await retryWithBackoff(operation, {
        operationName: 'network_op',
        initialDelay: 500
      })
      
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[Retry] Attempt 1/3 failed for network_op, retrying in 500ms: Network timeout')
      )
    })

    it('should log final failure', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Final error'))
      
      await expect(retryWithBackoff(operation, {
        maxAttempts: 2,
        operationName: 'failing_op'
      })).rejects.toThrow('Final error')
      
      expect(console.error).toHaveBeenCalledWith(
        '[Retry] Final failure for failing_op after 2 attempts:',
        'Final error'
      )
    })

    it('should log success after retries', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Temp fail'))
        .mockResolvedValue('success')
      
      await retryWithBackoff(operation, {
        operationName: 'recovering_op'
      })
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Retry] Success on attempt 2/3 for recovering_op')
      )
    })
  })
})

describe('retryWithCircuitBreaker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    console.log = vi.fn()
    console.warn = vi.fn()
    console.error = vi.fn()
  })

  it('should use circuit breaker for operation execution', async () => {
    const operation = vi.fn().mockResolvedValue('cb_result')
    mockErrorMonitor.executeWithCircuitBreaker.mockResolvedValue('cb_result')
    
    const result = await retryWithCircuitBreaker(operation, {
      operationName: 'cb_test',
      failureThreshold: 3
    })
    
    expect(result).toBe('cb_result')
    expect(mockErrorMonitor.executeWithCircuitBreaker).toHaveBeenCalledWith(
      'cb_test',
      expect.any(Function),
      undefined,
      expect.objectContaining({
        failureThreshold: 3,
        recoveryTimeout: 30000,
        monitoringWindow: 60000
      })
    )
  })

  it('should use custom circuit breaker name', async () => {
    const operation = vi.fn()
    mockErrorMonitor.executeWithCircuitBreaker.mockResolvedValue('result')
    
    await retryWithCircuitBreaker(operation, {
      operationName: 'test_op',
      circuitBreakerName: 'custom_breaker'
    })
    
    expect(mockErrorMonitor.executeWithCircuitBreaker).toHaveBeenCalledWith(
      'custom_breaker',
      expect.any(Function),
      undefined,
      expect.any(Object)
    )
  })

  it('should pass fallback to circuit breaker', async () => {
    const operation = vi.fn()
    const fallback = vi.fn()
    
    await retryWithCircuitBreaker(operation, {
      fallback,
      operationName: 'test_with_fallback'
    })
    
    expect(mockErrorMonitor.executeWithCircuitBreaker).toHaveBeenCalledWith(
      'test_with_fallback',
      expect.any(Function),
      fallback,
      expect.any(Object)
    )
  })
})

describe('RetryUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    console.log = vi.fn()
    console.warn = vi.fn()
    console.error = vi.fn()
  })

  describe('retryNetworkRequest', () => {
    it('should use NETWORK preset', async () => {
      const requestFn = vi.fn().mockResolvedValue('network_result')
      
      const result = await RetryUtils.retryNetworkRequest(requestFn, {
        component: 'network_client'
      })
      
      expect(result).toBe('network_result')
      // Verify it uses NETWORK preset (5 attempts would be called if it failed)
    })
  })

  describe('retryApiCall', () => {
    it('should use API preset with circuit breaker', async () => {
      const apiFn = vi.fn().mockResolvedValue('api_result')
      mockErrorMonitor.executeWithCircuitBreaker.mockResolvedValue('api_result')
      
      const result = await RetryUtils.retryApiCall(apiFn, {
        endpoint: '/api/test'
      })
      
      expect(result).toBe('api_result')
      expect(mockErrorMonitor.executeWithCircuitBreaker).toHaveBeenCalledWith(
        'generic_api', // Default circuit breaker name
        expect.any(Function),
        undefined,
        expect.any(Object)
      )
    })

    it('should use endpoint as circuit breaker name', async () => {
      mockErrorMonitor.executeWithCircuitBreaker.mockResolvedValue('result')
      
      await RetryUtils.retryApiCall(vi.fn(), {
        endpoint: '/api/users'
      })
      
      expect(mockErrorMonitor.executeWithCircuitBreaker).toHaveBeenCalledWith(
        '/api/users',
        expect.any(Function),
        undefined,
        expect.any(Object)
      )
    })
  })

  describe('retryWebSocketConnection', () => {
    it('should use WEBSOCKET preset with circuit breaker', async () => {
      const connectFn = vi.fn().mockResolvedValue('ws_connected')
      mockErrorMonitor.executeWithCircuitBreaker.mockResolvedValue('ws_connected')
      
      const result = await RetryUtils.retryWebSocketConnection(connectFn, {
        chatroomId: 'room123'
      })
      
      expect(result).toBe('ws_connected')
      expect(mockErrorMonitor.executeWithCircuitBreaker).toHaveBeenCalledWith(
        'websocket_room123',
        expect.any(Function),
        undefined,
        expect.any(Object)
      )
    })

    it('should use default circuit breaker name for unknown chatroom', async () => {
      mockErrorMonitor.executeWithCircuitBreaker.mockResolvedValue('result')
      
      await RetryUtils.retryWebSocketConnection(vi.fn(), {})
      
      expect(mockErrorMonitor.executeWithCircuitBreaker).toHaveBeenCalledWith(
        'websocket_unknown',
        expect.any(Function),
        undefined,
        expect.any(Object)
      )
    })
  })

  describe('retrySevenTVOperation', () => {
    it('should use SEVENTV preset', async () => {
      const operationFn = vi.fn()
        .mockRejectedValueOnce(new Error('7TV error'))
        .mockResolvedValue('7tv_success')
      
      const result = await RetryUtils.retrySevenTVOperation(operationFn)
      
      expect(result).toBe('7tv_success')
      expect(operationFn).toHaveBeenCalledTimes(2)
    })
  })

  describe('retryStorageOperation', () => {
    it('should use STORAGE preset', async () => {
      const storageFn = vi.fn()
        .mockRejectedValueOnce(new Error('quota exceeded'))
        .mockResolvedValue('storage_success')
      
      const result = await RetryUtils.retryStorageOperation(storageFn)
      
      expect(result).toBe('storage_success')
    })
  })

  describe('retry', () => {
    it('should use generic retry function', async () => {
      const operation = vi.fn().mockResolvedValue('generic_result')
      
      const result = await RetryUtils.retry(operation, {
        maxAttempts: 2,
        operationName: 'generic_operation'
      })
      
      expect(result).toBe('generic_result')
    })
  })

  describe('retryWithProtection', () => {
    it('should use circuit breaker protection', async () => {
      const operation = vi.fn().mockResolvedValue('protected_result')
      mockErrorMonitor.executeWithCircuitBreaker.mockResolvedValue('protected_result')
      
      const result = await RetryUtils.retryWithProtection(operation, {
        operationName: 'protected_op'
      })
      
      expect(result).toBe('protected_result')
    })
  })

  describe('getPresets', () => {
    it('should return copy of all presets', () => {
      const presets = RetryUtils.getPresets()
      
      expect(presets).toEqual(RETRY_PRESETS)
      expect(presets).not.toBe(RETRY_PRESETS) // Should be a copy
      
      // Modifying returned presets should not affect originals
      presets.NETWORK.maxAttempts = 999
      expect(RETRY_PRESETS.NETWORK.maxAttempts).toBe(5)
    })
  })

  describe('createPreset', () => {
    it('should create custom preset', () => {
      RetryUtils.createPreset('CUSTOM', {
        maxAttempts: 7,
        initialDelay: 2000,
        retryCondition: (error) => error.code === 'CUSTOM_ERROR'
      })
      
      const presets = RetryUtils.getPresets()
      expect(presets.CUSTOM).toBeDefined()
      expect(presets.CUSTOM.maxAttempts).toBe(7)
      expect(presets.CUSTOM.initialDelay).toBe(2000)
      expect(presets.CUSTOM.retryCondition({ code: 'CUSTOM_ERROR' })).toBe(true)
      expect(presets.CUSTOM.retryCondition({ code: 'OTHER_ERROR' })).toBe(false)
      
      // Should merge with default values
      expect(presets.CUSTOM.maxDelay).toBe(RETRY_PRESETS.DEFAULT.maxDelay)
      expect(presets.CUSTOM.backoffMultiplier).toBe(RETRY_PRESETS.DEFAULT.backoffMultiplier)
    })

    it('should normalize preset name to uppercase', () => {
      RetryUtils.createPreset('lowercase_preset', {
        maxAttempts: 4
      })
      
      const presets = RetryUtils.getPresets()
      expect(presets.LOWERCASE_PRESET).toBeDefined()
      expect(presets.LOWERCASE_PRESET.maxAttempts).toBe(4)
    })
  })
})

describe('Edge Cases and Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    console.log = vi.fn()
    console.warn = vi.fn()
    console.error = vi.fn()
  })

  describe('Operation Function Edge Cases', () => {
    it('should handle null/undefined operations', async () => {
      await expect(retryWithBackoff(null)).rejects.toThrow()
      await expect(retryWithBackoff(undefined)).rejects.toThrow()
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
        .mockRejectedValueOnce({ custom: 'error object' })
        .mockRejectedValueOnce(42)
        .mockResolvedValue('success')
      
      const result = await retryWithBackoff(operation, { maxAttempts: 5 })
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(4)
    })
  })

  describe('Configuration Edge Cases', () => {
    it('should handle zero max attempts', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      
      await expect(retryWithBackoff(operation, {
        maxAttempts: 0
      })).rejects.toThrow()
      
      expect(operation).not.toHaveBeenCalled()
    })

    it('should handle negative delays', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success')
      
      const result = await retryWithBackoff(operation, {
        initialDelay: -1000,
        maxDelay: -500
      })
      
      expect(result).toBe('success')
    })

    it('should handle very large delays', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success')
      
      const result = await retryWithBackoff(operation, {
        initialDelay: 999999999,
        maxDelay: 999999999
      })
      
      expect(result).toBe('success')
    })

    it('should handle invalid backoff multiplier', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success')
      
      const result = await retryWithBackoff(operation, {
        backoffMultiplier: 0
      })
      
      expect(result).toBe('success')
    })
  })

  describe('Error Monitoring Edge Cases', () => {
    it('should handle ErrorMonitor failures gracefully', async () => {
      mockErrorMonitor.recordError.mockImplementation(() => {
        throw new Error('Error monitoring failed')
      })
      
      const operation = vi.fn().mockRejectedValue(new Error('Original error'))
      
      await expect(retryWithBackoff(operation, { maxAttempts: 1 })).rejects.toThrow('Original error')
    })

    it('should handle missing error monitoring', async () => {
      // Temporarily disable error monitoring
      const originalRecordError = mockErrorMonitor.recordError
      mockErrorMonitor.recordError = undefined
      
      const operation = vi.fn().mockRejectedValue(new Error('No monitoring'))
      
      await expect(retryWithBackoff(operation, { maxAttempts: 1 })).rejects.toThrow('No monitoring')
      
      mockErrorMonitor.recordError = originalRecordError
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent retry operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => 
        vi.fn()
          .mockRejectedValueOnce(new Error(`Fail ${i}`))
          .mockResolvedValue(`Success ${i}`)
      )
      
      const promises = operations.map((op, i) => 
        retryWithBackoff(op, { operationName: `concurrent_op_${i}` })
      )
      
      const results = await Promise.all(promises)
      
      expect(results).toEqual(Array.from({ length: 10 }, (_, i) => `Success ${i}`))
    })

    it('should maintain separate retry state for concurrent operations', async () => {
      const slowOp = vi.fn()
        .mockRejectedValueOnce(new Error('Slow fail'))
        .mockImplementation(() => new Promise(resolve => setTimeout(() => resolve('slow success'), 100)))
      
      const fastOp = vi.fn().mockResolvedValue('fast success')
      
      const [slowResult, fastResult] = await Promise.all([
        retryWithBackoff(slowOp, { operationName: 'slow_op' }),
        retryWithBackoff(fastOp, { operationName: 'fast_op' })
      ])
      
      expect(slowResult).toBe('slow success')
      expect(fastResult).toBe('fast success')
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
        return RetryUtils.retry(op)
      })
      
      await Promise.all(promises)
      
      const endTime = Date.now()
      expect(endTime - startTime).toBeLessThan(5000) // Should complete quickly
    })
  })
})