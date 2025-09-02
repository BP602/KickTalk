import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startMetricsServer, stopMetricsServer, isRunning } from '../prometheus-server.js'

// Mock Node.js http module
const mockServer = {
  listen: vi.fn((port, host, callback) => {
    // Simulate successful server start
    setTimeout(() => callback(), 0)
  }),
  close: vi.fn((callback) => {
    // Simulate server close
    if (callback) setTimeout(() => callback(), 0)
  }),
  on: vi.fn()
}

const mockHttp = {
  createServer: vi.fn(() => mockServer)
}

// Mock process object
const mockProcess = {
  uptime: vi.fn(() => 3600), // 1 hour
  memoryUsage: vi.fn(() => ({
    rss: 100 * 1024 * 1024,       // 100MB
    heapUsed: 80 * 1024 * 1024,   // 80MB
    heapTotal: 120 * 1024 * 1024, // 120MB
    external: 10 * 1024 * 1024    // 10MB
  }))
}

// Mock PrometheusRegistry
const mockPrometheusRegistry = vi.fn().mockImplementation(() => ({
  startServer: vi.fn().mockResolvedValue(true)
}))

// Mock OpenTelemetry exporter
const mockOTelPrometheusExporter = {
  PrometheusRegistry: mockPrometheusRegistry
}

// Mock OpenTelemetry API
const mockMetrics = {
  getMeter: vi.fn()
}

// Mock modules
vi.mock('http', () => ({
  default: mockHttp
}))

vi.mock('@opentelemetry/exporter-prometheus', () => mockOTelPrometheusExporter, { virtual: true })

vi.mock('@opentelemetry/api', () => ({
  metrics: mockMetrics
}))

// Mock global process
global.process = mockProcess

describe('Prometheus Server', () => {
  let originalConsoleLog
  let originalConsoleError
  let originalConsoleWarn

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock console methods
    originalConsoleLog = console.log
    originalConsoleError = console.error
    originalConsoleWarn = console.warn
    console.log = vi.fn()
    console.error = vi.fn()
    console.warn = vi.fn()
  })

  afterEach(() => {
    console.log = originalConsoleLog
    console.error = originalConsoleError
    console.warn = originalConsoleWarn
    
    // Always try to stop the server after each test
    stopMetricsServer()
  })

  describe('Server Startup', () => {
    it('should start metrics server with PrometheusRegistry', async () => {
      const result = startMetricsServer(9464)
      
      expect(result).toBe(true)
      expect(mockPrometheusRegistry).toHaveBeenCalledWith({
        port: 9464,
        endpoint: '/metrics'
      })
      
      // Wait for async server start
      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(console.log).toHaveBeenCalledWith(
        '[Metrics]: Prometheus server started on http://localhost:9464/metrics'
      )
    })

    it('should start with default port when no port specified', () => {
      startMetricsServer()
      
      expect(mockPrometheusRegistry).toHaveBeenCalledWith({
        port: 9464,
        endpoint: '/metrics'
      })
    })

    it('should not start server if already running', () => {
      startMetricsServer(9464)
      
      // Try to start again
      startMetricsServer(9465)
      
      expect(console.log).toHaveBeenCalledWith('[Metrics]: Server already running')
      expect(mockPrometheusRegistry).toHaveBeenCalledTimes(1)
    })

    it('should use fallback server when PrometheusRegistry fails', async () => {
      // Make PrometheusRegistry throw an error
      const mockFailingRegistry = vi.fn().mockImplementation(() => {
        throw new Error('PrometheusRegistry failed')
      })
      
      // Mock the failing scenario
      vi.mocked(mockOTelPrometheusExporter).PrometheusRegistry = mockFailingRegistry
      
      const result = startMetricsServer(9464)
      
      expect(result).toBe(true)
      expect(mockHttp.createServer).toHaveBeenCalled()
      expect(mockServer.listen).toHaveBeenCalledWith(9464, '0.0.0.0', expect.any(Function))
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(console.log).toHaveBeenCalledWith(
        '[Metrics]: Fallback metrics server started on http://0.0.0.0:9464/metrics'
      )
    })

    it('should handle PrometheusRegistry startServer failure', async () => {
      // Make startServer fail
      const mockFailingStartServer = vi.fn().mockRejectedValue(new Error('Start server failed'))
      mockPrometheusRegistry.mockImplementation(() => ({
        startServer: mockFailingStartServer
      }))
      
      const result = startMetricsServer(9464)
      
      expect(result).toBe(true) // Initial call returns true
      
      // Wait for the async failure and fallback
      await new Promise(resolve => setTimeout(resolve, 20))
      
      expect(console.error).toHaveBeenCalledWith(
        '[Metrics]: Failed to start Prometheus server:',
        'Start server failed'
      )
    })

    it('should handle complete failure gracefully', () => {
      // Make both PrometheusRegistry and fallback fail
      vi.mocked(mockOTelPrometheusExporter).PrometheusRegistry = undefined
      mockHttp.createServer.mockImplementation(() => {
        throw new Error('HTTP server creation failed')
      })
      
      const result = startMetricsServer(9464)
      
      expect(result).toBe(false)
      expect(console.error).toHaveBeenCalledWith(
        '[Metrics]: Failed to create fallback metrics server:',
        'HTTP server creation failed'
      )
    })
  })

  describe('Fallback Server Functionality', () => {
    beforeEach(() => {
      // Force use of fallback server
      vi.mocked(mockOTelPrometheusExporter).PrometheusRegistry = undefined
    })

    it('should create HTTP server with metrics endpoint', async () => {
      let requestHandler
      mockHttp.createServer.mockImplementation((handler) => {
        requestHandler = handler
        return mockServer
      })
      
      startMetricsServer(9464)
      
      expect(mockHttp.createServer).toHaveBeenCalled()
      expect(requestHandler).toBeInstanceOf(Function)
    })

    it('should handle /metrics GET request', async () => {
      let requestHandler
      mockHttp.createServer.mockImplementation((handler) => {
        requestHandler = handler
        return mockServer
      })
      
      startMetricsServer(9464)
      
      const mockReq = {
        url: '/metrics',
        method: 'GET'
      }
      
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      }
      
      requestHandler(mockReq, mockRes)
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8'
      })
      
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('kicktalk_up 1'))
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('kicktalk_uptime_seconds'))
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('kicktalk_memory_heap_used_bytes'))
    })

    it('should return basic metrics in Prometheus format', async () => {
      let requestHandler
      mockHttp.createServer.mockImplementation((handler) => {
        requestHandler = handler
        return mockServer
      })
      
      startMetricsServer(9464)
      
      const mockReq = {
        url: '/metrics',
        method: 'GET'
      }
      
      let responseBody = ''
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn((body) => {
          responseBody = body
        })
      }
      
      requestHandler(mockReq, mockRes)
      
      // Verify Prometheus format
      expect(responseBody).toMatch(/# HELP kicktalk_up Application is running/)
      expect(responseBody).toMatch(/# TYPE kicktalk_up gauge/)
      expect(responseBody).toMatch(/kicktalk_up 1/)
      
      expect(responseBody).toMatch(/# HELP kicktalk_uptime_seconds Application uptime in seconds/)
      expect(responseBody).toMatch(/# TYPE kicktalk_uptime_seconds counter/)
      expect(responseBody).toMatch(/kicktalk_uptime_seconds 3600/)
      
      expect(responseBody).toMatch(/kicktalk_memory_heap_used_bytes 83886080/) // 80MB
      expect(responseBody).toMatch(/kicktalk_memory_heap_total_bytes 125829120/) // 120MB
    })

    it('should handle non-metrics requests with 404', async () => {
      let requestHandler
      mockHttp.createServer.mockImplementation((handler) => {
        requestHandler = handler
        return mockServer
      })
      
      startMetricsServer(9464)
      
      const mockReq = {
        url: '/health',
        method: 'GET'
      }
      
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      }
      
      requestHandler(mockReq, mockRes)
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(404, {
        'Content-Type': 'text/plain'
      })
      expect(mockRes.end).toHaveBeenCalledWith('404 Not Found - Try /metrics\n')
    })

    it('should handle POST requests to /metrics with 404', async () => {
      let requestHandler
      mockHttp.createServer.mockImplementation((handler) => {
        requestHandler = handler
        return mockServer
      })
      
      startMetricsServer(9464)
      
      const mockReq = {
        url: '/metrics',
        method: 'POST'
      }
      
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      }
      
      requestHandler(mockReq, mockRes)
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(404, expect.any(Object))
    })

    it('should handle server errors', async () => {
      let errorHandler
      mockServer.on.mockImplementation((event, handler) => {
        if (event === 'error') {
          errorHandler = handler
        }
      })
      
      startMetricsServer(9464)
      
      expect(mockServer.on).toHaveBeenCalledWith('error', expect.any(Function))
      
      // Simulate server error
      const error = new Error('Server error')
      if (errorHandler) {
        errorHandler(error)
        
        expect(console.error).toHaveBeenCalledWith(
          '[Metrics]: Metrics server error:',
          'Server error'
        )
      }
    })
  })

  describe('Server Status', () => {
    it('should report not running initially', () => {
      expect(isRunning()).toBe(false)
    })

    it('should report running after successful start', async () => {
      startMetricsServer(9464)
      
      // Wait for async server start
      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(isRunning()).toBe(true)
    })

    it('should report not running after error', async () => {
      // Force fallback server
      vi.mocked(mockOTelPrometheusExporter).PrometheusRegistry = undefined
      
      let errorHandler
      mockServer.on.mockImplementation((event, handler) => {
        if (event === 'error') {
          errorHandler = handler
        }
      })
      
      startMetricsServer(9464)
      
      // Simulate server error
      if (errorHandler) {
        errorHandler(new Error('Server failed'))
        expect(isRunning()).toBe(false)
      }
    })
  })

  describe('Server Shutdown', () => {
    it('should not stop server when not running', () => {
      stopMetricsServer()
      
      expect(mockServer.close).not.toHaveBeenCalled()
    })

    it('should stop running server', async () => {
      // Start server first
      vi.mocked(mockOTelPrometheusExporter).PrometheusRegistry = undefined // Use fallback
      startMetricsServer(9464)
      
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(isRunning()).toBe(true)
      
      // Stop server
      stopMetricsServer()
      
      expect(mockServer.close).toHaveBeenCalled()
      
      // Wait for close callback
      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(console.log).toHaveBeenCalledWith('[Metrics]: Metrics server stopped')
      expect(isRunning()).toBe(false)
    })

    it('should handle PrometheusRegistry shutdown', () => {
      // Start with PrometheusRegistry
      startMetricsServer(9464)
      
      // Stop should work even without a fallback server instance
      stopMetricsServer()
      
      expect(console.log).toHaveBeenCalledWith('[Metrics]: Metrics server stopped')
    })

    it('should handle shutdown errors gracefully', () => {
      vi.mocked(mockOTelPrometheusExporter).PrometheusRegistry = undefined // Use fallback
      mockServer.close.mockImplementation((callback) => {
        throw new Error('Close failed')
      })
      
      startMetricsServer(9464)
      
      expect(() => stopMetricsServer()).not.toThrow()
      
      expect(console.error).toHaveBeenCalledWith(
        '[Metrics]: Error stopping metrics server:',
        'Close failed'
      )
    })
  })

  describe('Multiple Server Instances', () => {
    it('should prevent multiple server instances', () => {
      startMetricsServer(9464)
      startMetricsServer(9465)
      
      expect(console.log).toHaveBeenCalledWith('[Metrics]: Server already running')
      expect(mockPrometheusRegistry).toHaveBeenCalledTimes(1)
    })

    it('should allow restart after stop', async () => {
      vi.mocked(mockOTelPrometheusExporter).PrometheusRegistry = undefined // Use fallback
      
      // Start first server
      startMetricsServer(9464)
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // Stop server
      stopMetricsServer()
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // Start again
      startMetricsServer(9465)
      
      expect(mockServer.listen).toHaveBeenCalledTimes(2)
      expect(mockServer.listen).toHaveBeenLastCalledWith(9465, '0.0.0.0', expect.any(Function))
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing process methods gracefully', () => {
      const originalUptime = mockProcess.uptime
      const originalMemoryUsage = mockProcess.memoryUsage
      
      mockProcess.uptime = undefined
      mockProcess.memoryUsage = undefined
      
      vi.mocked(mockOTelPrometheusExporter).PrometheusRegistry = undefined // Use fallback
      
      let requestHandler
      mockHttp.createServer.mockImplementation((handler) => {
        requestHandler = handler
        return mockServer
      })
      
      expect(() => startMetricsServer(9464)).not.toThrow()
      
      // Restore for cleanup
      mockProcess.uptime = originalUptime
      mockProcess.memoryUsage = originalMemoryUsage
    })

    it('should handle invalid port numbers gracefully', () => {
      expect(() => {
        startMetricsServer('invalid_port')
      }).not.toThrow()
    })

    it('should handle negative port numbers', () => {
      expect(() => {
        startMetricsServer(-1)
      }).not.toThrow()
    })

    it('should handle very high port numbers', () => {
      expect(() => {
        startMetricsServer(99999)
      }).not.toThrow()
    })

    it('should handle null/undefined port', () => {
      expect(() => {
        startMetricsServer(null)
        startMetricsServer(undefined)
      }).not.toThrow()
    })
  })

  describe('Module Loading Edge Cases', () => {
    it('should handle missing OpenTelemetry modules gracefully', () => {
      vi.mocked(mockOTelPrometheusExporter).PrometheusRegistry = null
      
      const result = startMetricsServer(9464)
      
      // Should fall back to basic HTTP server
      expect(result).toBe(true)
      expect(mockHttp.createServer).toHaveBeenCalled()
    })

    it('should handle PrometheusRegistry constructor errors', () => {
      vi.mocked(mockOTelPrometheusExporter).PrometheusRegistry = vi.fn().mockImplementation(() => {
        throw new Error('Constructor failed')
      })
      
      const result = startMetricsServer(9464)
      
      expect(result).toBe(true) // Should still succeed with fallback
      expect(console.error).toHaveBeenCalledWith(
        '[Metrics]: Error setting up Prometheus server:',
        'Constructor failed'
      )
    })
  })

  describe('Metrics Content Validation', () => {
    it('should produce valid Prometheus metric format', async () => {
      vi.mocked(mockOTelPrometheusExporter).PrometheusRegistry = undefined // Use fallback
      
      let requestHandler
      mockHttp.createServer.mockImplementation((handler) => {
        requestHandler = handler
        return mockServer
      })
      
      startMetricsServer(9464)
      
      const mockReq = { url: '/metrics', method: 'GET' }
      let responseBody = ''
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn((body) => { responseBody = body })
      }
      
      requestHandler(mockReq, mockRes)
      
      // Validate Prometheus format requirements
      const lines = responseBody.split('\n').filter(line => line.trim())
      
      let hasHelpComments = false
      let hasTypeComments = false
      let hasMetricValues = false
      
      for (const line of lines) {
        if (line.startsWith('# HELP')) hasHelpComments = true
        if (line.startsWith('# TYPE')) hasTypeComments = true
        if (line.match(/^kicktalk_\w+ \d+/)) hasMetricValues = true
      }
      
      expect(hasHelpComments).toBe(true)
      expect(hasTypeComments).toBe(true)
      expect(hasMetricValues).toBe(true)
    })

    it('should handle memory values correctly', async () => {
      mockProcess.memoryUsage.mockReturnValue({
        rss: 200 * 1024 * 1024,       // 200MB
        heapUsed: 150 * 1024 * 1024,  // 150MB
        heapTotal: 250 * 1024 * 1024, // 250MB
        external: 20 * 1024 * 1024    // 20MB
      })
      
      vi.mocked(mockOTelPrometheusExporter).PrometheusRegistry = undefined // Use fallback
      
      let requestHandler
      mockHttp.createServer.mockImplementation((handler) => {
        requestHandler = handler
        return mockServer
      })
      
      startMetricsServer(9464)
      
      const mockReq = { url: '/metrics', method: 'GET' }
      let responseBody = ''
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn((body) => { responseBody = body })
      }
      
      requestHandler(mockReq, mockRes)
      
      expect(responseBody).toContain('kicktalk_memory_heap_used_bytes 157286400') // 150MB
      expect(responseBody).toContain('kicktalk_memory_heap_total_bytes 262144000') // 250MB
    })
  })

  describe('Concurrent Server Operations', () => {
    it('should handle rapid start/stop cycles', async () => {
      vi.mocked(mockOTelPrometheusExporter).PrometheusRegistry = undefined // Use fallback
      
      for (let i = 0; i < 5; i++) {
        startMetricsServer(9464 + i)
        await new Promise(resolve => setTimeout(resolve, 5))
        stopMetricsServer()
        await new Promise(resolve => setTimeout(resolve, 5))
      }
      
      // Should not throw errors or cause issues
      expect(console.error).not.toHaveBeenCalled()
    })

    it('should handle concurrent requests to fallback server', async () => {
      vi.mocked(mockOTelPrometheusExporter).PrometheusRegistry = undefined // Use fallback
      
      let requestHandler
      mockHttp.createServer.mockImplementation((handler) => {
        requestHandler = handler
        return mockServer
      })
      
      startMetricsServer(9464)
      
      // Simulate concurrent requests
      const requests = Array.from({ length: 10 }, () => ({
        url: '/metrics',
        method: 'GET'
      }))
      
      const responses = []
      
      requests.forEach(req => {
        const res = {
          writeHead: vi.fn(),
          end: vi.fn((body) => responses.push(body))
        }
        requestHandler(req, res)
      })
      
      expect(responses).toHaveLength(10)
      responses.forEach(response => {
        expect(response).toContain('kicktalk_up 1')
      })
    })
  })
})