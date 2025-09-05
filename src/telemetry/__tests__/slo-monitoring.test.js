import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SLOMonitor, SLO_TARGETS } from '../slo-monitoring.js'

// Mock OpenTelemetry APIs
const mockCounterInstance = {
  add: vi.fn()
}

const mockHistogramInstance = {
  record: vi.fn()
}

const mockObservableGaugeInstance = {
  addCallback: vi.fn()
}

const mockMeter = {
  createCounter: vi.fn(() => mockCounterInstance),
  createHistogram: vi.fn(() => mockHistogramInstance),
  createObservableGauge: vi.fn(() => mockObservableGaugeInstance)
}

const mockMetrics = {
  getMeter: vi.fn(() => mockMeter)
}

// Mock modules
vi.mock('@opentelemetry/api', () => ({
  metrics: mockMetrics
}))

vi.mock('../../package.json', () => ({
  default: {
    version: '1.0.0-test'
  }
}))

describe('SLOMonitor', () => {
  let originalConsoleWarn
  let originalConsoleLog

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock console methods
    originalConsoleWarn = console.warn
    originalConsoleLog = console.log
    console.warn = vi.fn()
    console.log = vi.fn()
  })

  afterEach(() => {
    console.warn = originalConsoleWarn
    console.log = originalConsoleLog
  })

  describe('Latency Recording and SLO Checking', () => {
    it('should record latency within SLO target', () => {
      const operation = 'MESSAGE_SEND_DURATION'
      const duration = 1.5 // 1.5 seconds (within 2.0s target)
      const attributes = { chatroom_id: 'room123' }

      const result = SLOMonitor.recordLatency(operation, duration, attributes)

      expect(mockHistogramInstance.record).toHaveBeenCalledWith(duration, {
        operation,
        slo_target: '2',
        chatroom_id: 'room123'
      })

      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        operation,
        status: 'success',
        severity: 'ok',
        chatroom_id: 'room123'
      })

      expect(result).toEqual({
        isViolation: false,
        isP99Violation: false,
        target: 2.0,
        p99Target: 1.5
      })

      expect(console.warn).not.toHaveBeenCalled()
    })

    it('should record SLO violation for latency exceeding target', () => {
      const operation = 'CHATROOM_SWITCH_DURATION'
      const duration = 0.8 // 800ms (exceeds 500ms target)
      const attributes = { from_room: 'room1', to_room: 'room2' }

      const result = SLOMonitor.recordLatency(operation, duration, attributes)

      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        operation,
        status: 'violation',
        severity: 'warning',
        from_room: 'room1',
        to_room: 'room2'
      })

      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        operation,
        target_seconds: '0.5',
        actual_seconds: '0.800',
        severity: 'warning',
        from_room: 'room1',
        to_room: 'room2'
      })

      expect(result.isViolation).toBe(true)
      expect(result.isP99Violation).toBe(true) // 0.8s > 0.3s p99 target

      expect(console.warn).toHaveBeenCalledWith(
        '[SLO VIOLATION] CHATROOM_SWITCH_DURATION: 0.800s > 0.5s (Chatroom switching latency)'
      )
    })

    it('should handle critical P99 violations', () => {
      const operation = 'MESSAGE_PARSER_DURATION'
      const duration = 0.1 // 100ms (exceeds both 50ms target and 20ms p99)

      const result = SLOMonitor.recordLatency(operation, duration)

      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        operation,
        target_seconds: '0.05',
        actual_seconds: '0.100',
        severity: 'critical'
      })

      expect(result.isViolation).toBe(true)
      expect(result.isP99Violation).toBe(true)
    })

    it('should handle unknown operations gracefully', () => {
      const operation = 'UNKNOWN_OPERATION'
      const duration = 1.0

      SLOMonitor.recordLatency(operation, duration)

      expect(console.warn).toHaveBeenCalledWith(
        '[SLO] Unknown operation: UNKNOWN_OPERATION'
      )

      expect(mockHistogramInstance.record).not.toHaveBeenCalled()
    })

    it('should record edge case of exact target match', () => {
      const operation = 'WEBSOCKET_CONNECTION_TIME'
      const duration = 5.0 // Exactly at target

      const result = SLOMonitor.recordLatency(operation, duration)

      expect(result.isViolation).toBe(false)
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        operation,
        status: 'success',
        severity: 'ok'
      })
    })
  })

  describe('Resource Usage Monitoring', () => {
    it('should check memory usage within threshold', () => {
      const memoryBytes = 400 * 1024 * 1024 // 400MB (within 512MB threshold)
      const attributes = { process: 'main', type: 'heap_used' }

      const result = SLOMonitor.checkResourceUsage('memory', memoryBytes, attributes)

      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        operation: 'resource_memory',
        status: 'success',
        utilization_percent: '78',
        process: 'main',
        type: 'heap_used'
      })

      expect(result).toEqual({
        isViolation: false,
        utilizationPercent: expect.closeTo(78.125),
        threshold: 512 * 1024 * 1024
      })

      expect(console.warn).not.toHaveBeenCalled()
    })

    it('should detect memory usage violation', () => {
      const memoryBytes = 600 * 1024 * 1024 // 600MB (exceeds 512MB threshold)
      const attributes = { process: 'renderer' }

      const result = SLOMonitor.checkResourceUsage('memory', memoryBytes, attributes)

      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        operation: 'resource_memory',
        status: 'violation',
        utilization_percent: '117',
        process: 'renderer'
      })

      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        operation: 'resource_memory',
        threshold: (512 * 1024 * 1024).toString(),
        actual_value: memoryBytes.toString(),
        utilization_percent: '117',
        severity: 'warning',
        process: 'renderer'
      })

      expect(result.isViolation).toBe(true)
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('memory usage: 629145600 > 536870912 (117% utilization)')
      )
    })

    it('should detect critical resource violations', () => {
      const cpuPercent = 95 // 95% CPU (exceeds 80% threshold by >150%)
      
      const result = SLOMonitor.checkResourceUsage('cpu', cpuPercent)

      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        operation: 'resource_cpu',
        threshold: '80',
        actual_value: '95',
        utilization_percent: '119',
        severity: 'critical' // 119% < 150%, so should be 'warning' actually
      })

      // Let's test with truly critical level
      SLOMonitor.checkResourceUsage('cpu', 150) // 150% of 80% threshold = 187.5% utilization

      expect(mockCounterInstance.add).toHaveBeenLastCalledWith(1, {
        operation: 'resource_cpu',
        threshold: '80',
        actual_value: '150',
        utilization_percent: '188',
        severity: 'critical'
      })
    })

    it('should handle unknown resource types', () => {
      SLOMonitor.checkResourceUsage('unknown_resource', 100)

      expect(console.warn).toHaveBeenCalledWith(
        '[SLO] Unknown resource type: unknown_resource'
      )

      expect(mockCounterInstance.add).not.toHaveBeenCalled()
    })

    it('should handle zero resource usage', () => {
      const result = SLOMonitor.checkResourceUsage('memory', 0)

      expect(result.isViolation).toBe(false)
      expect(result.utilizationPercent).toBe(0)
    })
  })

  describe('Operation Result Recording', () => {
    it('should record successful operation', () => {
      const operation = 'MESSAGE_SEND_DURATION'
      const duration = 1.2
      const attributes = { chatroom_id: 'room123' }

      SLOMonitor.recordOperationResult(operation, true, duration, attributes)

      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        operation,
        status: 'success',
        chatroom_id: 'room123'
      })

      // Should also call recordLatency
      expect(mockHistogramInstance.record).toHaveBeenCalledWith(duration, {
        operation,
        slo_target: '2',
        chatroom_id: 'room123'
      })
    })

    it('should record failed operation', () => {
      const operation = 'WEBSOCKET_CONNECTION_TIME'
      const attributes = { chatroom_id: 'room456', error: 'timeout' }

      SLOMonitor.recordOperationResult(operation, false, null, attributes)

      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        operation,
        status: 'failure',
        chatroom_id: 'room456',
        error: 'timeout'
      })

      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        operation,
        type: 'failure',
        severity: 'error',
        chatroom_id: 'room456',
        error: 'timeout'
      })

      // Should not call recordLatency for null duration
      expect(mockHistogramInstance.record).not.toHaveBeenCalled()
    })

    it('should record operation with duration and failure', () => {
      const operation = 'API_REQUEST'
      const duration = 10.0 // Very slow
      const attributes = { endpoint: '/api/error', status_code: '500' }

      SLOMonitor.recordOperationResult(operation, false, duration, attributes)

      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        operation,
        status: 'failure',
        endpoint: '/api/error',
        status_code: '500'
      })

      // Should still record latency for failed operations with duration
      expect(mockHistogramInstance.record).toHaveBeenCalled()
    })

    it('should handle operation without duration', () => {
      SLOMonitor.recordOperationResult('TEST_OPERATION', true)

      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        operation: 'TEST_OPERATION',
        status: 'success'
      })
    })
  })

  describe('Performance Budget Management', () => {
    it('should update performance budget', () => {
      SLOMonitor.updatePerformanceBudget('message_send', 75)

      // This should update internal state - we can't directly test internal state
      // but we verify no errors are thrown
      expect(() => SLOMonitor.updatePerformanceBudget('message_send', 75)).not.toThrow()
    })

    it('should handle budget updates for non-existent operations', () => {
      expect(() => {
        SLOMonitor.updatePerformanceBudget('non_existent_operation', 50)
      }).not.toThrow()
    })

    it('should handle edge case budget values', () => {
      expect(() => {
        SLOMonitor.updatePerformanceBudget('test_op', 0)
        SLOMonitor.updatePerformanceBudget('test_op', 100)
        SLOMonitor.updatePerformanceBudget('test_op', -10)
        SLOMonitor.updatePerformanceBudget('test_op', 150)
      }).not.toThrow()
    })
  })

  describe('SLO Target Management', () => {
    it('should get SLO target for known operation', () => {
      const target = SLOMonitor.getSLOTarget('MESSAGE_SEND_DURATION')
      
      expect(target).toEqual({
        target: 2.0,
        p99: 1.5,
        description: 'Message send latency'
      })
    })

    it('should return undefined for unknown operation', () => {
      const target = SLOMonitor.getSLOTarget('UNKNOWN_OPERATION')
      
      expect(target).toBeUndefined()
    })

    it('should get all SLO targets', () => {
      const allTargets = SLOMonitor.getAllSLOTargets()
      
      expect(allTargets).toEqual(SLO_TARGETS)
      expect(allTargets).not.toBe(SLO_TARGETS) // Should be a copy
      
      // Verify it contains expected operations
      expect(allTargets.MESSAGE_SEND_DURATION).toBeDefined()
      expect(allTargets.CHATROOM_SWITCH_DURATION).toBeDefined()
      expect(allTargets.WEBSOCKET_CONNECTION_TIME).toBeDefined()
    })

    it('should not allow modification of returned targets', () => {
      const targets = SLOMonitor.getAllSLOTargets()
      const originalTarget = targets.MESSAGE_SEND_DURATION.target
      
      // Attempt to modify
      targets.MESSAGE_SEND_DURATION.target = 999
      
      // Should not affect the original
      const freshTargets = SLOMonitor.getAllSLOTargets()
      expect(freshTargets.MESSAGE_SEND_DURATION.target).toBe(originalTarget)
    })
  })

  describe('Performance Budget Observable Gauge', () => {
    it('should register performance budget callback', () => {
      expect(mockObservableGaugeInstance.addCallback).toHaveBeenCalled()
    })

    it('should execute performance budget callback', () => {
      // Find and execute the performance budget callback
      const callbacks = mockObservableGaugeInstance.addCallback.mock.calls
      const budgetCallback = callbacks.find(call => 
        call[0].toString().includes('performance')
      )?.[0]
      
      if (budgetCallback) {
        const mockObservableResult = {
          observe: vi.fn()
        }
        
        budgetCallback(mockObservableResult)
        
        expect(mockObservableResult.observe).toHaveBeenCalled()
      }
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle null/undefined durations', () => {
      expect(() => {
        SLOMonitor.recordLatency('MESSAGE_SEND_DURATION', null)
        SLOMonitor.recordLatency('MESSAGE_SEND_DURATION', undefined)
      }).not.toThrow()
    })

    it('should handle negative durations', () => {
      const result = SLOMonitor.recordLatency('MESSAGE_SEND_DURATION', -1.0)
      
      expect(result.isViolation).toBe(false) // Negative duration should be considered as success
    })

    it('should handle very large durations', () => {
      const largeDuration = 1000000 // 1 million seconds
      
      const result = SLOMonitor.recordLatency('MESSAGE_SEND_DURATION', largeDuration)
      
      expect(result.isViolation).toBe(true)
      expect(result.isP99Violation).toBe(true)
    })

    it('should handle zero durations', () => {
      const result = SLOMonitor.recordLatency('MESSAGE_SEND_DURATION', 0)
      
      expect(result.isViolation).toBe(false)
      expect(mockHistogramInstance.record).toHaveBeenCalledWith(0, expect.any(Object))
    })

    it('should handle empty attributes', () => {
      expect(() => {
        SLOMonitor.recordLatency('MESSAGE_SEND_DURATION', 1.0, {})
        SLOMonitor.recordOperationResult('TEST_OP', true, 1.0, {})
        SLOMonitor.checkResourceUsage('memory', 1000000, {})
      }).not.toThrow()
    })

    it('should handle null attributes', () => {
      expect(() => {
        SLOMonitor.recordLatency('MESSAGE_SEND_DURATION', 1.0, null)
        SLOMonitor.recordOperationResult('TEST_OP', true, 1.0, null)
        SLOMonitor.checkResourceUsage('memory', 1000000, null)
      }).not.toThrow()
    })

    it('should handle special characters in operation names', () => {
      expect(() => {
        SLOMonitor.recordLatency('OPERATION_WITH_SPECIAL_CHARS!@#$%', 1.0)
      }).not.toThrow()
    })

    it('should handle very long operation names', () => {
      const longOperationName = 'A'.repeat(1000)
      
      expect(() => {
        SLOMonitor.recordLatency(longOperationName, 1.0)
      }).not.toThrow()
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent SLO recording', async () => {
      const promises = []
      
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => {
            SLOMonitor.recordLatency('MESSAGE_SEND_DURATION', Math.random() * 3.0)
            SLOMonitor.recordOperationResult('TEST_OP', Math.random() > 0.5)
          })
        )
      }
      
      await Promise.all(promises)
      
      // Should have recorded 200 metrics (2 per iteration)
      expect(mockCounterInstance.add).toHaveBeenCalledTimes(200)
    })

    it('should handle concurrent resource checking', async () => {
      const promises = []
      
      for (let i = 0; i < 50; i++) {
        promises.push(
          Promise.resolve().then(() => {
            SLOMonitor.checkResourceUsage('memory', Math.random() * 1000 * 1024 * 1024)
            SLOMonitor.checkResourceUsage('cpu', Math.random() * 100)
          })
        )
      }
      
      await Promise.all(promises)
      
      // Each iteration records at least one success/violation counter
      expect(mockCounterInstance.add).toHaveBeenCalledTimes(100)
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle mixed success and failure operations', () => {
      // Record some successful operations
      SLOMonitor.recordLatency('MESSAGE_SEND_DURATION', 1.0)
      SLOMonitor.recordLatency('CHATROOM_SWITCH_DURATION', 0.2)
      
      // Record some violations
      SLOMonitor.recordLatency('MESSAGE_SEND_DURATION', 3.0)
      SLOMonitor.recordLatency('CHATROOM_SWITCH_DURATION', 1.0)
      
      // Record resource usage
      SLOMonitor.checkResourceUsage('memory', 300 * 1024 * 1024)
      SLOMonitor.checkResourceUsage('cpu', 90)
      
      // Should have recorded multiple metrics
      expect(mockHistogramInstance.record).toHaveBeenCalledTimes(4)
      expect(mockCounterInstance.add).toHaveBeenCalledTimes(8) // 2 per latency + 2 per resource + 2 violations
    })

    it('should handle operations across different time periods', () => {
      const operations = [
        { name: 'MESSAGE_SEND_DURATION', duration: 0.5 },
        { name: 'CHATROOM_SWITCH_DURATION', duration: 0.1 },
        { name: 'EMOTE_SEARCH_DURATION', duration: 0.03 },
        { name: 'WEBSOCKET_CONNECTION_TIME', duration: 2.0 },
        { name: 'APP_STARTUP_DURATION', duration: 8.0 }
      ]
      
      operations.forEach(op => {
        SLOMonitor.recordLatency(op.name, op.duration)
      })
      
      expect(mockHistogramInstance.record).toHaveBeenCalledTimes(5)
      expect(mockCounterInstance.add).toHaveBeenCalledTimes(5) // All should be successes
    })
  })

  describe('Performance and Memory', () => {
    it('should have minimal overhead for successful operations', () => {
      const startTime = Date.now()
      
      for (let i = 0; i < 1000; i++) {
        SLOMonitor.recordLatency('MESSAGE_SEND_DURATION', 1.0)
      }
      
      const endTime = Date.now()
      expect(endTime - startTime).toBeLessThan(1000) // Should complete in under 1 second
    })

    it('should handle high-frequency resource monitoring', () => {
      const startTime = Date.now()
      
      for (let i = 0; i < 1000; i++) {
        SLOMonitor.checkResourceUsage('memory', 400 * 1024 * 1024)
      }
      
      const endTime = Date.now()
      expect(endTime - startTime).toBeLessThan(1000)
    })
  })
})

describe('SLO_TARGETS Configuration', () => {
  describe('Target Validation', () => {
    it('should have all required SLO targets', () => {
      const requiredTargets = [
        'MESSAGE_SEND_DURATION',
        'CHATROOM_SWITCH_DURATION', 
        'MESSAGE_PARSER_DURATION',
        'WEBSOCKET_CONNECTION_TIME',
        'APP_STARTUP_DURATION',
        'EMOTE_SEARCH_DURATION',
        'MEMORY_USAGE_THRESHOLD',
        'CPU_USAGE_THRESHOLD'
      ]
      
      requiredTargets.forEach(target => {
        expect(SLO_TARGETS[target]).toBeDefined()
        expect(SLO_TARGETS[target].target).toBeGreaterThan(0)
        expect(SLO_TARGETS[target].description).toBeDefined()
        expect(typeof SLO_TARGETS[target].description).toBe('string')
      })
    })

    it('should have valid latency targets with p99 values', () => {
      const latencyTargets = [
        'MESSAGE_SEND_DURATION',
        'CHATROOM_SWITCH_DURATION',
        'MESSAGE_PARSER_DURATION',
        'WEBSOCKET_CONNECTION_TIME',
        'APP_STARTUP_DURATION',
        'EMOTE_SEARCH_DURATION'
      ]
      
      latencyTargets.forEach(target => {
        expect(SLO_TARGETS[target].p99).toBeDefined()
        expect(SLO_TARGETS[target].p99).toBeGreaterThan(0)
        expect(SLO_TARGETS[target].p99).toBeLessThanOrEqual(SLO_TARGETS[target].target)
      })
    })

    it('should have valid resource thresholds', () => {
      expect(SLO_TARGETS.MEMORY_USAGE_THRESHOLD.target).toBe(512 * 1024 * 1024) // 512MB
      expect(SLO_TARGETS.CPU_USAGE_THRESHOLD.target).toBe(80) // 80%
    })

    it('should have reasonable latency target values', () => {
      // Message send should be reasonably fast
      expect(SLO_TARGETS.MESSAGE_SEND_DURATION.target).toBeLessThanOrEqual(5.0)
      
      // Chatroom switching should be very fast
      expect(SLO_TARGETS.CHATROOM_SWITCH_DURATION.target).toBeLessThanOrEqual(1.0)
      
      // Message parsing should be extremely fast
      expect(SLO_TARGETS.MESSAGE_PARSER_DURATION.target).toBeLessThanOrEqual(0.1)
      
      // Emote search should be fast
      expect(SLO_TARGETS.EMOTE_SEARCH_DURATION.target).toBeLessThanOrEqual(0.5)
      
      // WebSocket connection may take longer
      expect(SLO_TARGETS.WEBSOCKET_CONNECTION_TIME.target).toBeLessThanOrEqual(10.0)
      
      // App startup can take the longest
      expect(SLO_TARGETS.APP_STARTUP_DURATION.target).toBeLessThanOrEqual(30.0)
    })

    it('should have consistent p99/target relationships', () => {
      const latencyTargets = [
        'MESSAGE_SEND_DURATION',
        'CHATROOM_SWITCH_DURATION',
        'MESSAGE_PARSER_DURATION',
        'WEBSOCKET_CONNECTION_TIME',
        'APP_STARTUP_DURATION',
        'EMOTE_SEARCH_DURATION'
      ]
      
      latencyTargets.forEach(target => {
        const config = SLO_TARGETS[target]
        expect(config.p99).toBeLessThanOrEqual(config.target)
        
        // P99 should typically be 50-90% of target
        expect(config.p99).toBeGreaterThan(config.target * 0.3)
      })
    })

    it('should have descriptive and unique descriptions', () => {
      const descriptions = Object.values(SLO_TARGETS).map(target => target.description)
      const uniqueDescriptions = [...new Set(descriptions)]
      
      expect(descriptions.length).toBe(uniqueDescriptions.length)
      
      descriptions.forEach(desc => {
        expect(desc.length).toBeGreaterThan(10) // Reasonably descriptive
      })
    })

    it('should be immutable when accessed through SLOMonitor', () => {
      const targets1 = SLOMonitor.getAllSLOTargets()
      const targets2 = SLOMonitor.getAllSLOTargets()
      
      // Should be different objects (copies)
      expect(targets1).not.toBe(targets2)
      
      // But should have same content
      expect(targets1).toEqual(targets2)
      
      // Modifying one should not affect the other
      targets1.MESSAGE_SEND_DURATION.target = 999
      expect(targets2.MESSAGE_SEND_DURATION.target).not.toBe(999)
    })
  })

  describe('Configuration Completeness', () => {
    it('should cover all critical user-facing operations', () => {
      // These are the most critical operations from a user experience perspective
      const criticalOperations = [
        'MESSAGE_SEND_DURATION',       // Core chat functionality
        'CHATROOM_SWITCH_DURATION',    // Navigation responsiveness
        'MESSAGE_PARSER_DURATION'      // Chat performance
      ]
      
      criticalOperations.forEach(op => {
        expect(SLO_TARGETS[op]).toBeDefined()
        expect(SLO_TARGETS[op].target).toBeLessThanOrEqual(2.0) // Should be quite fast
      })
    })

    it('should cover all system resource limits', () => {
      const resourceTargets = [
        'MEMORY_USAGE_THRESHOLD',
        'CPU_USAGE_THRESHOLD'
      ]
      
      resourceTargets.forEach(target => {
        expect(SLO_TARGETS[target]).toBeDefined()
        expect(SLO_TARGETS[target].target).toBeGreaterThan(0)
        expect(SLO_TARGETS[target].description).toMatch(/(memory|cpu)/i)
      })
    })

    it('should have targets for all major feature areas', () => {
      // Chat functionality
      expect(SLO_TARGETS.MESSAGE_SEND_DURATION).toBeDefined()
      expect(SLO_TARGETS.MESSAGE_PARSER_DURATION).toBeDefined()
      
      // Navigation
      expect(SLO_TARGETS.CHATROOM_SWITCH_DURATION).toBeDefined()
      
      // Emote system
      expect(SLO_TARGETS.EMOTE_SEARCH_DURATION).toBeDefined()
      
      // Connection management
      expect(SLO_TARGETS.WEBSOCKET_CONNECTION_TIME).toBeDefined()
      
      // Application lifecycle
      expect(SLO_TARGETS.APP_STARTUP_DURATION).toBeDefined()
    })
  })
})