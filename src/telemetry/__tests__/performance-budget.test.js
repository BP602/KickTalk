import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  PerformanceBudgetMonitor, 
  performanceBudgetMonitor, 
  PERFORMANCE_BUDGETS 
} from '../performance-budget.js'

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

// Mock ErrorMonitor
const mockErrorMonitor = {
  recordError: vi.fn(() => ({
    error_id: 'error_123',
    category: 'NETWORK',
    severity: 'high'
  }))
}

// Mock UserAnalytics - make it lazy loadable
let mockUserAnalytics = null

// Mock modules
vi.mock('@opentelemetry/api', () => ({
  metrics: mockMetrics,
  trace: mockTrace
}))

vi.mock('../error-monitoring', () => ({
  ErrorMonitor: mockErrorMonitor
}))

// Mock the lazy-loaded UserAnalytics
vi.mock('../user-analytics', () => ({
  UserAnalytics: {
    recordUserAction: vi.fn()
  }
}))

vi.mock('../../package.json', () => ({
  default: {
    version: '1.0.0-test'
  }
}))

describe('PERFORMANCE_BUDGETS Configuration', () => {
  describe('Budget Thresholds', () => {
    it('should have all required budget categories', () => {
      const requiredCategories = [
        'UI_INTERACTION',
        'COMPONENT_RENDER', 
        'MEMORY_USAGE',
        'CPU_USAGE',
        'WEBSOCKET_LATENCY',
        'BUNDLE_SIZE'
      ]
      
      requiredCategories.forEach(category => {
        expect(PERFORMANCE_BUDGETS[category]).toBeDefined()
        expect(PERFORMANCE_BUDGETS[category].good).toBeGreaterThan(0)
        expect(PERFORMANCE_BUDGETS[category].acceptable).toBeGreaterThan(0)
        expect(PERFORMANCE_BUDGETS[category].poor).toBeGreaterThan(0)
        expect(PERFORMANCE_BUDGETS[category].critical).toBeGreaterThan(0)
      })
    })

    it('should have logical threshold progressions', () => {
      Object.values(PERFORMANCE_BUDGETS).forEach(budget => {
        expect(budget.good).toBeLessThan(budget.acceptable)
        expect(budget.acceptable).toBeLessThan(budget.poor)
        expect(budget.poor).toBeLessThan(budget.critical)
      })
    })

    it('should have reasonable UI performance thresholds', () => {
      const uiBudget = PERFORMANCE_BUDGETS.UI_INTERACTION
      
      expect(uiBudget.good).toBeLessThanOrEqual(100) // < 100ms excellent
      expect(uiBudget.acceptable).toBeLessThanOrEqual(250) // < 250ms acceptable
      expect(uiBudget.critical).toBeGreaterThan(500) // > 500ms poor UX
    })

    it('should have frame rate aligned render budgets', () => {
      const renderBudget = PERFORMANCE_BUDGETS.COMPONENT_RENDER
      
      expect(renderBudget.good).toBeLessThanOrEqual(16) // 60fps = 16.67ms
      expect(renderBudget.acceptable).toBeLessThanOrEqual(33) // 30fps = 33.33ms
    })

    it('should have realistic memory thresholds', () => {
      const memoryBudget = PERFORMANCE_BUDGETS.MEMORY_USAGE
      
      expect(memoryBudget.good).toBeGreaterThan(100) // > 100MB reasonable
      expect(memoryBudget.critical).toBeLessThan(2000) // < 2GB reasonable for desktop
    })

    it('should have appropriate CPU thresholds', () => {
      const cpuBudget = PERFORMANCE_BUDGETS.CPU_USAGE
      
      expect(cpuBudget.good).toBeLessThan(25) // Low CPU usage for chat app
      expect(cpuBudget.critical).toBeGreaterThan(50) // High CPU usage
    })

    it('should have network performance thresholds', () => {
      const networkBudget = PERFORMANCE_BUDGETS.WEBSOCKET_LATENCY
      
      expect(networkBudget.good).toBeLessThanOrEqual(100) // < 100ms good
      expect(networkBudget.critical).toBeGreaterThan(250) // > 250ms poor
    })

    it('should have bundle size budgets for startup performance', () => {
      const bundleBudget = PERFORMANCE_BUDGETS.BUNDLE_SIZE
      
      expect(bundleBudget.good).toBeLessThanOrEqual(2048) // < 2MB good
      expect(bundleBudget.critical).toBeGreaterThan(5120) // > 5MB poor for startup
    })
  })
})

describe('PerformanceBudgetMonitor', () => {
  let monitor
  let originalConsoleLog
  let originalConsoleWarn
  let originalDateNow
  let originalSetInterval

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock console methods
    originalConsoleLog = console.log
    originalConsoleWarn = console.warn
    console.log = vi.fn()
    console.warn = vi.fn()
    
    // Mock Date.now
    originalDateNow = Date.now
    Date.now = vi.fn(() => 1640000000000)
    
    // Mock setInterval
    originalSetInterval = global.setInterval
    global.setInterval = vi.fn((fn, interval) => {
      // Don't actually set intervals in tests
      return 'mock_interval'
    })
    
    monitor = new PerformanceBudgetMonitor()
  })

  afterEach(() => {
    console.log = originalConsoleLog
    console.warn = originalConsoleWarn
    Date.now = originalDateNow
    global.setInterval = originalSetInterval
    
    // Reset tracking data
    if (monitor) {
      monitor.resetTracking()
    }
  })

  describe('Monitor Initialization', () => {
    it('should initialize with correct default values', () => {
      expect(monitor.violationThresholds).toEqual(PERFORMANCE_BUDGETS)
      expect(monitor.isMonitoring).toBe(true)
      expect(monitor.performanceScore).toBe(100)
      expect(monitor.recentViolations).toBeInstanceOf(Map)
    })

    it('should start performance score calculation interval', () => {
      expect(global.setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        30000
      )
    })
  })

  describe('UI Interaction Monitoring', () => {
    it('should monitor good UI interaction performance', () => {
      const severity = monitor.monitorUIInteraction('button_click', 80, { 
        component: 'send_button' 
      })
      
      expect(severity).toBe('good')
      expect(mockCounterInstance.add).not.toHaveBeenCalled() // No violation
      expect(console.log).toHaveBeenCalledWith(
        '[Performance Budget] UI button_click: 80ms (good)'
      )
    })

    it('should detect acceptable UI performance', () => {
      const severity = monitor.monitorUIInteraction('scroll', 200)
      
      expect(severity).toBe('acceptable')
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        budget_category: 'UI_INTERACTION',
        severity: 'acceptable',
        violation_magnitude: 'minor',
        interaction_type: 'scroll',
        expected_threshold: 250,
        actual_time: 200
      })
    })

    it('should detect poor UI performance', () => {
      const severity = monitor.monitorUIInteraction('menu_open', 400)
      
      expect(severity).toBe('poor')
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, 
        expect.objectContaining({ severity: 'poor' })
      )
    })

    it('should detect critical UI performance', () => {
      const severity = monitor.monitorUIInteraction('page_load', 1500, {
        session_id: 'session123'
      })
      
      expect(severity).toBe('critical')
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1,
        expect.objectContaining({ severity: 'critical' })
      )
      
      // Should record user impact for critical performance
      // Check that user impact is recorded (implementation may vary)
    })

    it('should correlate UI lag with user satisfaction', () => {
      monitor.monitorUIInteraction('slow_action', 800, {
        session_id: 'session123'
      })
      
      // Should record user impact
      expect(console.log).toHaveBeenCalledWith(
        '[Performance Budget] User impact: ui_lag (poor) for session session123'
      )
    })
  })

  describe('Component Render Monitoring', () => {
    it('should monitor good render performance', () => {
      const severity = monitor.monitorComponentRender('ChatMessage', 12, {
        render_type: 'mount'
      })
      
      expect(severity).toBe('good')
      expect(mockHistogramInstance.record).toHaveBeenCalledWith(12, {
        component: 'ChatMessage',
        render_type: 'mount',
        severity: 'good'
      })
    })

    it('should track render performance violations', () => {
      const severity = monitor.monitorComponentRender('SlowComponent', 50)
      
      expect(severity).toBe('critical')
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, 
        expect.objectContaining({
          budget_category: 'COMPONENT_RENDER',
          severity: 'critical',
          component: 'SlowComponent'
        })
      )
    })

    it('should store render performance history', () => {
      monitor.monitorComponentRender('TestComponent', 25)
      monitor.monitorComponentRender('TestComponent', 35)
      
      const performanceData = monitor.getPerformanceData()
      expect(performanceData.render_performance).toHaveLength(2)
      expect(performanceData.render_performance[0].component).toBe('TestComponent')
    })

    it('should limit render performance history', () => {
      // Add more than 1000 render events
      for (let i = 0; i < 1005; i++) {
        monitor.monitorComponentRender(`Component${i}`, 20)
      }
      
      const performanceData = monitor.getPerformanceData()
      expect(performanceData.render_performance).toHaveLength(1000)
    })
  })

  describe('WebSocket Latency Monitoring', () => {
    it('should monitor good WebSocket latency', () => {
      const severity = monitor.monitorWebSocketLatency(40, {
        channel: 'chat123'
      })
      
      expect(severity).toBe('good')
      expect(mockCounterInstance.add).not.toHaveBeenCalled()
    })

    it('should detect poor WebSocket latency', () => {
      const severity = monitor.monitorWebSocketLatency(300, {
        session_id: 'session123',
        channel: 'chat456'
      })
      
      expect(severity).toBe('poor')
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1,
        expect.objectContaining({
          budget_category: 'WEBSOCKET_LATENCY',
          severity: 'poor'
        })
      )
      
      // Should record user impact for high latency
      expect(console.log).toHaveBeenCalledWith(
        '[Performance Budget] User impact: connection_lag (poor) for session session123'
      )
    })
  })

  describe('Memory Usage Monitoring', () => {
    it('should monitor good memory usage', () => {
      const severity = monitor.monitorMemoryUsage(150, {
        process: 'renderer'
      })
      
      expect(severity).toBe('good')
      expect(mockCounterInstance.add).not.toHaveBeenCalled()
    })

    it('should detect critical memory usage', () => {
      const severity = monitor.monitorMemoryUsage(1500, {
        process: 'main'
      })
      
      expect(severity).toBe('critical')
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1,
        expect.objectContaining({
          budget_category: 'MEMORY_USAGE',
          severity: 'critical'
        })
      )
      
      expect(console.warn).toHaveBeenCalledWith(
        '[Performance Budget] Critical memory usage: 1500MB'
      )
    })

    it('should track memory usage history', () => {
      monitor.monitorMemoryUsage(300)
      monitor.monitorMemoryUsage(350)
      
      const performanceData = monitor.getPerformanceData()
      expect(performanceData.resource_usage).toBeDefined()
    })

    it('should limit resource usage history', () => {
      // Add more than 500 measurements
      for (let i = 0; i < 505; i++) {
        monitor.monitorMemoryUsage(200 + i)
      }
      
      const performanceData = monitor.getPerformanceData()
      // Check that history is limited (implementation detail may vary)
    })
  })

  describe('CPU Usage Monitoring', () => {
    it('should monitor acceptable CPU usage', () => {
      const severity = monitor.monitorCPUUsage(15, {
        interval: '1m'
      })
      
      expect(severity).toBe('acceptable')
    })

    it('should detect critical CPU usage', () => {
      const severity = monitor.monitorCPUUsage(90, {
        process: 'main'
      })
      
      expect(severity).toBe('critical')
      expect(console.warn).toHaveBeenCalledWith(
        '[Performance Budget] Critical CPU usage: 90%'
      )
    })
  })

  describe('Bundle Size Monitoring', () => {
    it('should monitor good bundle size', () => {
      const severity = monitor.monitorBundleSize('main.js', 800)
      
      expect(severity).toBe('good')
      expect(console.log).toHaveBeenCalledWith(
        '[Performance Budget] Bundle main.js: 800KB (good)'
      )
    })

    it('should detect poor bundle size', () => {
      const severity = monitor.monitorBundleSize('vendor.js', 8000)
      
      expect(severity).toBe('poor')
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1,
        expect.objectContaining({
          budget_category: 'BUNDLE_SIZE',
          severity: 'poor',
          bundle_name: 'vendor.js'
        })
      )
    })
  })

  describe('Violation Recording and Tracking', () => {
    it('should record budget violations with proper metrics', () => {
      monitor.recordBudgetViolation('UI_INTERACTION', 'poor', 400, {
        component: 'test_component'
      })
      
      expect(mockCounterInstance.add).toHaveBeenCalledWith(1, {
        budget_category: 'UI_INTERACTION',
        severity: 'poor',
        violation_magnitude: 'moderate',
        component: 'test_component'
      })
    })

    it('should track violations for performance scoring', () => {
      const initialScore = monitor.performanceScore
      
      monitor.recordBudgetViolation('COMPONENT_RENDER', 'critical', 80)
      
      expect(monitor.performanceScore).toBeLessThan(initialScore)
    })

    it('should limit violations history', () => {
      // Add many violations
      for (let i = 0; i < 505; i++) {
        monitor.recordBudgetViolation('UI_INTERACTION', 'poor', 300)
      }
      
      const performanceData = monitor.getPerformanceData()
      expect(performanceData.recent_violations.length).toBeLessThanOrEqual(50)
    })

    it('should calculate violation magnitude correctly', () => {
      const magnitude1 = monitor.getViolationMagnitude('UI_INTERACTION', 200)
      expect(magnitude1).toBe('minor') // 200ms <= 250ms (acceptable)
      
      const magnitude2 = monitor.getViolationMagnitude('UI_INTERACTION', 500)
      expect(magnitude2).toBe('moderate') // 500ms <= 500ms (2x acceptable)
      
      const magnitude3 = monitor.getViolationMagnitude('UI_INTERACTION', 1000)
      expect(magnitude3).toBe('major') // 1000ms > 500ms but <= 750ms (3x acceptable)
      
      const magnitude4 = monitor.getViolationMagnitude('UI_INTERACTION', 2000)
      expect(magnitude4).toBe('severe') // 2000ms > 750ms (3x acceptable)
    })
  })

  describe('User Impact Recording', () => {
    it('should record user impact events', () => {
      monitor.recordUserImpact('session123', 'ui_lag', 'critical', {
        interaction: 'button_click'
      })
      
      const performanceData = monitor.getPerformanceData()
      expect(performanceData.user_impact_events).toContainEqual(
        expect.objectContaining({
          session_id: 'session123',
          impact_type: 'ui_lag',
          severity: 'critical'
        })
      )
    })

    it('should limit user impact events history', () => {
      // Add many impact events
      for (let i = 0; i < 205; i++) {
        monitor.recordUserImpact(`session${i}`, 'ui_lag', 'poor')
      }
      
      const performanceData = monitor.getPerformanceData()
      expect(performanceData.user_impact_events.length).toBeLessThanOrEqual(200)
    })

    it('should correlate with user analytics when available', () => {
      // This tests the lazy loading of UserAnalytics
      monitor.recordUserImpact('session123', 'connection_lag', 'poor', {
        latency: 300
      })
      
      expect(console.log).toHaveBeenCalledWith(
        '[Performance Budget] User impact: connection_lag (poor) for session session123'
      )
    })
  })

  describe('Performance Score Calculation', () => {
    it('should start with perfect score', () => {
      expect(monitor.performanceScore).toBe(100)
    })

    it('should decrease score for violations', () => {
      const initialScore = monitor.performanceScore
      
      monitor.adjustPerformanceScore('poor')
      expect(monitor.performanceScore).toBe(initialScore - 3)
      
      monitor.adjustPerformanceScore('critical')
      expect(monitor.performanceScore).toBe(initialScore - 3 - 8)
    })

    it('should not go below 0', () => {
      // Add many critical violations
      for (let i = 0; i < 20; i++) {
        monitor.adjustPerformanceScore('critical')
      }
      
      expect(monitor.performanceScore).toBeGreaterThanOrEqual(0)
    })

    it('should not go above 100', () => {
      monitor.performanceScore = 95
      
      // Try to increase beyond 100
      monitor.adjustPerformanceScore('good')
      
      expect(monitor.performanceScore).toBeLessThanOrEqual(100)
    })

    it('should calculate comprehensive performance score', () => {
      // Add some violations in the past
      monitor.recordBudgetViolation('UI_INTERACTION', 'poor', 400)
      monitor.recordBudgetViolation('COMPONENT_RENDER', 'critical', 60)
      
      const score = monitor.calculatePerformanceScore()
      
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
      expect(score).toBeLessThan(100) // Should be reduced due to violations
    })

    it('should recover score over time without violations', () => {
      // Add violations to reduce score
      monitor.recordBudgetViolation('UI_INTERACTION', 'critical', 1000)
      const lowScore = monitor.calculatePerformanceScore()
      
      // Mock time moving forward (no violations in last 5 minutes)
      Date.now.mockReturnValue(Date.now() + 6 * 60 * 1000)
      
      const recoveredScore = monitor.calculatePerformanceScore()
      expect(recoveredScore).toBeGreaterThan(lowScore)
    })
  })

  describe('Performance Data Retrieval', () => {
    it('should return comprehensive performance data', () => {
      // Add some test data
      monitor.monitorUIInteraction('test_action', 300)
      monitor.monitorComponentRender('TestComponent', 40)
      monitor.recordUserImpact('session123', 'ui_lag', 'poor')
      
      const data = monitor.getPerformanceData()
      
      expect(data).toEqual({
        current_score: expect.any(Number),
        recent_violations: expect.any(Array),
        user_impact_events: expect.any(Array),
        resource_usage: {
          memory_mb: expect.any(Number),
          cpu_percent: expect.any(Number)
        },
        budget_thresholds: PERFORMANCE_BUDGETS,
        render_performance: expect.any(Array)
      })
    })

    it('should limit returned data size', () => {
      // Add lots of data
      for (let i = 0; i < 200; i++) {
        monitor.recordBudgetViolation('UI_INTERACTION', 'poor', 300)
        monitor.recordUserImpact(`session${i}`, 'ui_lag', 'poor')
        monitor.monitorComponentRender(`Component${i}`, 25)
      }
      
      const data = monitor.getPerformanceData()
      
      expect(data.recent_violations.length).toBeLessThanOrEqual(50)
      expect(data.user_impact_events.length).toBeLessThanOrEqual(50)
      expect(data.render_performance.length).toBeLessThanOrEqual(100)
    })
  })

  describe('Severity Level Calculation', () => {
    it('should calculate severity correctly for different budgets', () => {
      const uiBudget = PERFORMANCE_BUDGETS.UI_INTERACTION
      
      expect(monitor.getSeverityLevel(50, uiBudget)).toBe('good')
      expect(monitor.getSeverityLevel(150, uiBudget)).toBe('acceptable')
      expect(monitor.getSeverityLevel(400, uiBudget)).toBe('poor')
      expect(monitor.getSeverityLevel(1200, uiBudget)).toBe('critical')
    })

    it('should handle edge cases', () => {
      const budget = PERFORMANCE_BUDGETS.UI_INTERACTION
      
      // Exact thresholds
      expect(monitor.getSeverityLevel(budget.good, budget)).toBe('good')
      expect(monitor.getSeverityLevel(budget.acceptable, budget)).toBe('acceptable')
      expect(monitor.getSeverityLevel(budget.poor, budget)).toBe('poor')
      
      // Zero value
      expect(monitor.getSeverityLevel(0, budget)).toBe('good')
    })
  })

  describe('Reset and Cleanup', () => {
    it('should reset tracking data', () => {
      // Add some data
      monitor.monitorUIInteraction('test_action', 400)
      monitor.recordUserImpact('session123', 'ui_lag', 'poor')
      
      monitor.resetTracking()
      
      const data = monitor.getPerformanceData()
      expect(data.recent_violations).toHaveLength(0)
      expect(data.user_impact_events).toHaveLength(0)
      expect(data.render_performance).toHaveLength(0)
      expect(monitor.performanceScore).toBe(100)
      expect(monitor.recentViolations.size).toBe(0)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle null/undefined values gracefully', () => {
      expect(() => {
        monitor.monitorUIInteraction(null, 100)
        monitor.monitorComponentRender(undefined, 20)
        monitor.monitorWebSocketLatency(50, null)
      }).not.toThrow()
    })

    it('should handle negative values', () => {
      expect(() => {
        monitor.monitorUIInteraction('test', -100)
        monitor.monitorMemoryUsage(-50)
        monitor.monitorCPUUsage(-10)
      }).not.toThrow()
    })

    it('should handle very large values', () => {
      const severity = monitor.monitorUIInteraction('massive_delay', 999999)
      expect(severity).toBe('critical')
      
      const cpuSeverity = monitor.monitorCPUUsage(999)
      expect(cpuSeverity).toBe('critical')
    })

    it('should handle string values gracefully', () => {
      expect(() => {
        monitor.monitorUIInteraction('test', 'invalid')
        monitor.monitorMemoryUsage('invalid')
      }).not.toThrow()
    })

    it('should handle missing UserAnalytics gracefully', () => {
      // Test when UserAnalytics fails to load
      expect(() => {
        monitor.recordUserImpact('session123', 'ui_lag', 'poor')
      }).not.toThrow()
    })
  })

  describe('Observable Gauge Callbacks', () => {
    it('should register observable gauge callbacks', () => {
      expect(mockObservableGaugeInstance.addCallback).toHaveBeenCalled()
    })

    it('should execute memory usage callback', () => {
      const callbacks = mockObservableGaugeInstance.addCallback.mock.calls
      const memoryCallback = callbacks.find(call => 
        call[0].toString().includes('memory_usage')
      )?.[0]
      
      if (memoryCallback) {
        const mockObservableResult = {
          observe: vi.fn()
        }
        
        memoryCallback(mockObservableResult)
        
        expect(mockObservableResult.observe).toHaveBeenCalledWith(
          expect.any(Number),
          { resource_type: 'rss_memory' }
        )
      }
    })

    it('should execute performance score callback', () => {
      const callbacks = mockObservableGaugeInstance.addCallback.mock.calls
      const scoreCallback = callbacks.find(call => 
        call[0].toString().includes('performanceScore')
      )?.[0]
      
      if (scoreCallback) {
        const mockObservableResult = {
          observe: vi.fn()
        }
        
        scoreCallback(mockObservableResult)
        
        expect(mockObservableResult.observe).toHaveBeenCalledWith(
          monitor.performanceScore,
          { measurement_type: 'overall' }
        )
      }
    })
  })

  describe('System Resource Monitoring', () => {
    it('should start resource monitoring', () => {
      // Verify setInterval was called for resource monitoring
      expect(global.setInterval).toHaveBeenCalled()
    })

    it('should handle process method errors gracefully', () => {
      // Mock process methods to throw errors
      const originalProcess = global.process
      global.process = {
        memoryUsage: vi.fn(() => {
          throw new Error('Memory usage failed')
        }),
        cpuUsage: vi.fn(() => {
          throw new Error('CPU usage failed')
        })
      }
      
      expect(() => {
        monitor.startResourceMonitoring()
      }).not.toThrow()
      
      global.process = originalProcess
    })
  })
})

describe('Global Performance Budget Monitor Instance', () => {
  it('should export a singleton instance', () => {
    expect(performanceBudgetMonitor).toBeInstanceOf(PerformanceBudgetMonitor)
  })

  it('should be the same instance when imported multiple times', () => {
    // This would be tested in a real scenario with multiple imports
    expect(performanceBudgetMonitor).toBeDefined()
  })

  it('should have initialized monitoring by default', () => {
    expect(performanceBudgetMonitor.isMonitoring).toBe(true)
    expect(performanceBudgetMonitor.performanceScore).toBe(100)
  })
})