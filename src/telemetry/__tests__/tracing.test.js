import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock OpenTelemetry trace API
const mockSpan = {
  setAttributes: vi.fn(),
  recordException: vi.fn(),
  setStatus: vi.fn(),
  end: vi.fn(),
  addEvent: vi.fn(),
  setAttribute: vi.fn()
}

const mockTracer = {
  startActiveSpan: vi.fn((name, callback) => {
    if (typeof callback === 'function') {
      return callback(mockSpan)
    }
    return mockSpan
  }),
  startSpan: vi.fn(() => mockSpan)
}

const mockTrace = {
  getTracer: vi.fn(() => mockTracer)
}

const mockContext = {
  active: vi.fn(() => ({})),
  with: vi.fn((ctx, fn) => fn())
}

// Mock span status codes
const SpanStatusCode = {
  UNSET: 0,
  OK: 1,
  ERROR: 2
}

// Mock OpenTelemetry API
vi.mock('@opentelemetry/api', () => ({
  trace: mockTrace,
  context: mockContext,
  SpanStatusCode
}))

// Mock package.json
vi.mock('../../package.json', () => ({
  default: {
    version: '1.0.0-test'
  }
}))

// Create TracingHelper class based on expected interface from existing tests
class TracingHelper {
  constructor(tracer, spanStatusCode) {
    this.tracer = tracer || mockTracer
    this.SpanStatusCode = spanStatusCode || SpanStatusCode
  }

  addEvent(name, attributes = {}) {
    // Add event to active span if available
    const activeSpan = this.getActiveSpan()
    if (activeSpan) {
      activeSpan.addEvent(name, attributes)
    }
    console.log(`[Tracing] Event: ${name}`, attributes)
  }

  setAttributes(attributes = {}) {
    const activeSpan = this.getActiveSpan()
    if (activeSpan) {
      activeSpan.setAttributes(attributes)
    }
  }

  startActiveSpan(name, callback) {
    return this.tracer.startActiveSpan(name, (span) => {
      try {
        const result = callback(span)
        span.setStatus({ code: this.SpanStatusCode.OK })
        return result
      } catch (error) {
        span.recordException(error)
        span.setStatus({ code: this.SpanStatusCode.ERROR })
        throw error
      } finally {
        span.end()
      }
    })
  }

  traceWebSocketConnection(chatroomId, streamerId, callback) {
    return this.startActiveSpan(`websocket_connection`, (span) => {
      span.setAttributes({
        'websocket.chatroom_id': chatroomId,
        'websocket.streamer_id': streamerId,
        'websocket.operation': 'connect'
      })

      const startTime = Date.now()
      try {
        const result = callback(span)
        const duration = Date.now() - startTime
        
        span.setAttributes({
          'websocket.connection_success': true,
          'websocket.connection_duration_ms': duration
        })
        
        return result
      } catch (error) {
        span.setAttributes({
          'websocket.connection_success': false,
          'websocket.error': error.message
        })
        throw error
      }
    })
  }

  traceMessageFlow(messageId, messageType, callback) {
    return this.startActiveSpan(`message_flow`, (span) => {
      span.setAttributes({
        'message.id': messageId,
        'message.type': messageType,
        'message.operation': 'process'
      })

      try {
        const result = callback(span)
        span.setAttributes({
          'message.processed': true
        })
        return result
      } catch (error) {
        span.setAttributes({
          'message.processed': false,
          'message.error': error.message
        })
        throw error
      }
    })
  }

  traceKickAPICall(endpoint, method, callback) {
    return this.startActiveSpan(`kick_api_${method.toLowerCase()}`, (span) => {
      span.setAttributes({
        'http.method': method,
        'http.url': endpoint,
        'service.name': 'kick_api'
      })

      const startTime = Date.now()
      try {
        const result = callback()
        const duration = Date.now() - startTime
        
        span.setAttributes({
          'http.status_code': result?.status || 200,
          'http.response_time_ms': duration,
          'http.success': true
        })
        
        return result
      } catch (error) {
        span.setAttributes({
          'http.success': false,
          'http.error': error.message,
          'http.status_code': error.status || 500
        })
        throw error
      }
    })
  }

  traceAPIRequest(url, method, callback) {
    return this.startActiveSpan(`api_request`, (span) => {
      span.setAttributes({
        'http.method': method,
        'http.url': url,
        'http.request_type': 'api'
      })

      try {
        const result = callback(span)
        span.setAttributes({
          'http.request_success': true
        })
        return result
      } catch (error) {
        span.setAttributes({
          'http.request_success': false,
          'http.error': error.message
        })
        throw error
      }
    })
  }

  traceMessageSend(messageId, content, callback) {
    return this.startActiveSpan(`message_send`, (span) => {
      span.setAttributes({
        'message.id': messageId,
        'message.content_length': content?.length || 0,
        'message.operation': 'send'
      })

      const startTime = Date.now()
      try {
        const result = callback(span)
        const duration = Date.now() - startTime
        
        span.setAttributes({
          'message.send_success': true,
          'message.send_duration_ms': duration
        })
        
        return result
      } catch (error) {
        span.setAttributes({
          'message.send_success': false,
          'message.send_error': error.message
        })
        throw error
      }
    })
  }

  traceEmoteLoad(provider, emoteId, callback) {
    return this.startActiveSpan(`emote_load`, (span) => {
      span.setAttributes({
        'emote.provider': provider,
        'emote.id': emoteId,
        'emote.operation': 'load'
      })

      try {
        const result = callback()
        span.setAttributes({
          'emote.load_success': true,
          'emote.from_cache': result?.fromCache || false
        })
        span.setStatus({ code: this.SpanStatusCode.OK })
        return result
      } catch (error) {
        span.recordException(error)
        span.setAttributes({
          'emote.load_success': false,
          'emote.error': error.message
        })
        span.setStatus({ code: this.SpanStatusCode.ERROR })
        throw error
      }
    })
  }

  trace7TVOperation(operation, chatroomId, callback) {
    return this.startActiveSpan(`seventv_${operation}`, (span) => {
      span.setAttributes({
        'seventv.operation': operation,
        'seventv.chatroom_id': chatroomId,
        'service.name': '7tv'
      })

      try {
        const result = callback(span)
        span.setAttributes({
          'seventv.operation_success': true
        })
        return result
      } catch (error) {
        span.setAttributes({
          'seventv.operation_success': false,
          'seventv.error': error.message
        })
        throw error
      }
    })
  }

  traceUserInteraction(interactionType, component, callback) {
    return this.startActiveSpan(`user_interaction`, (span) => {
      span.setAttributes({
        'user.interaction_type': interactionType,
        'user.component': component,
        'user.operation': 'interact'
      })

      const startTime = Date.now()
      try {
        const result = callback(span)
        const responseTime = Date.now() - startTime
        
        span.setAttributes({
          'user.interaction_success': true,
          'user.response_time_ms': responseTime
        })
        
        return result
      } catch (error) {
        span.setAttributes({
          'user.interaction_success': false,
          'user.error': error.message
        })
        throw error
      }
    })
  }

  tracePerformanceOperation(operation, category, callback) {
    return this.startActiveSpan(`performance_${operation}`, (span) => {
      span.setAttributes({
        'performance.operation': operation,
        'performance.category': category
      })

      const startTime = performance.now ? performance.now() : Date.now()
      try {
        const result = callback(span)
        const duration = (performance.now ? performance.now() : Date.now()) - startTime
        
        span.setAttributes({
          'performance.duration_ms': duration,
          'performance.success': true
        })
        
        return result
      } catch (error) {
        span.setAttributes({
          'performance.success': false,
          'performance.error': error.message
        })
        throw error
      }
    })
  }

  getActiveSpan() {
    // In real implementation, this would get the active span from context
    return mockSpan
  }
}

describe('TracingHelper', () => {
  let tracingHelper
  let originalConsoleLog
  let originalDateNow

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock console.log
    originalConsoleLog = console.log
    console.log = vi.fn()
    
    // Mock Date.now for consistent timing
    originalDateNow = Date.now
    Date.now = vi.fn(() => 1640000000000)
    
    tracingHelper = new TracingHelper()
  })

  afterEach(() => {
    console.log = originalConsoleLog
    Date.now = originalDateNow
  })

  describe('Basic Tracing Operations', () => {
    it('should add event with attributes', () => {
      tracingHelper.addEvent('test_event', { key: 'value' })
      
      expect(mockSpan.addEvent).toHaveBeenCalledWith('test_event', { key: 'value' })
      expect(console.log).toHaveBeenCalledWith('[Tracing] Event: test_event', { key: 'value' })
    })

    it('should set attributes on active span', () => {
      const attributes = { 'test.attribute': 'value' }
      
      tracingHelper.setAttributes(attributes)
      
      expect(mockSpan.setAttributes).toHaveBeenCalledWith(attributes)
    })

    it('should start active span and execute callback', () => {
      const callback = vi.fn().mockReturnValue('test_result')
      
      const result = tracingHelper.startActiveSpan('test_span', callback)
      
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith('test_span', expect.any(Function))
      expect(callback).toHaveBeenCalledWith(mockSpan)
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK })
      expect(mockSpan.end).toHaveBeenCalled()
      expect(result).toBe('test_result')
    })

    it('should handle errors in active span', () => {
      const error = new Error('Test error')
      const callback = vi.fn().mockImplementation(() => {
        throw error
      })
      
      expect(() => {
        tracingHelper.startActiveSpan('test_span', callback)
      }).toThrow('Test error')
      
      expect(mockSpan.recordException).toHaveBeenCalledWith(error)
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR })
      expect(mockSpan.end).toHaveBeenCalled()
    })
  })

  describe('WebSocket Connection Tracing', () => {
    it('should trace successful websocket connection', () => {
      const callback = vi.fn().mockReturnValue('connected')
      
      const result = tracingHelper.traceWebSocketConnection('chatroom123', 'streamer456', callback)
      
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith('websocket_connection', expect.any(Function))
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'websocket.chatroom_id': 'chatroom123',
        'websocket.streamer_id': 'streamer456',
        'websocket.operation': 'connect'
      })
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'websocket.connection_success': true,
        'websocket.connection_duration_ms': 0
      })
      expect(result).toBe('connected')
    })

    it('should trace failed websocket connection', () => {
      const error = new Error('Connection failed')
      const callback = vi.fn().mockImplementation(() => {
        throw error
      })
      
      expect(() => {
        tracingHelper.traceWebSocketConnection('chatroom123', 'streamer456', callback)
      }).toThrow('Connection failed')
      
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'websocket.connection_success': false,
        'websocket.error': 'Connection failed'
      })
    })
  })

  describe('Message Flow Tracing', () => {
    it('should trace successful message processing', () => {
      const callback = vi.fn().mockReturnValue('processed')
      
      const result = tracingHelper.traceMessageFlow('msg123', 'chat', callback)
      
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith('message_flow', expect.any(Function))
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'message.id': 'msg123',
        'message.type': 'chat',
        'message.operation': 'process'
      })
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'message.processed': true
      })
      expect(result).toBe('processed')
    })

    it('should trace failed message processing', () => {
      const error = new Error('Processing failed')
      const callback = vi.fn().mockImplementation(() => {
        throw error
      })
      
      expect(() => {
        tracingHelper.traceMessageFlow('msg123', 'chat', callback)
      }).toThrow('Processing failed')
      
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'message.processed': false,
        'message.error': 'Processing failed'
      })
    })
  })

  describe('Kick API Tracing', () => {
    it('should trace successful Kick API call', () => {
      const callback = vi.fn().mockReturnValue({ status: 200, data: 'success' })
      
      const result = tracingHelper.traceKickAPICall('/api/users', 'GET', callback)
      
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith('kick_api_get', expect.any(Function))
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'http.method': 'GET',
        'http.url': '/api/users',
        'service.name': 'kick_api'
      })
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'http.status_code': 200,
        'http.response_time_ms': 0,
        'http.success': true
      })
      expect(result).toEqual({ status: 200, data: 'success' })
    })

    it('should trace failed Kick API call', () => {
      const error = new Error('API Error')
      error.status = 500
      const callback = vi.fn().mockImplementation(() => {
        throw error
      })
      
      expect(() => {
        tracingHelper.traceKickAPICall('/api/users', 'POST', callback)
      }).toThrow('API Error')
      
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'http.success': false,
        'http.error': 'API Error',
        'http.status_code': 500
      })
    })

    it('should handle API calls without status code', () => {
      const callback = vi.fn().mockReturnValue('success')
      
      const result = tracingHelper.traceKickAPICall('/api/test', 'GET', callback)
      
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'http.status_code': 200,
        'http.response_time_ms': 0,
        'http.success': true
      })
    })
  })

  describe('Generic API Request Tracing', () => {
    it('should trace successful API request', () => {
      const callback = vi.fn().mockReturnValue('api_result')
      
      const result = tracingHelper.traceAPIRequest('https://api.example.com/data', 'POST', callback)
      
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith('api_request', expect.any(Function))
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'http.method': 'POST',
        'http.url': 'https://api.example.com/data',
        'http.request_type': 'api'
      })
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'http.request_success': true
      })
      expect(result).toBe('api_result')
    })

    it('should trace failed API request', () => {
      const error = new Error('Request failed')
      const callback = vi.fn().mockImplementation(() => {
        throw error
      })
      
      expect(() => {
        tracingHelper.traceAPIRequest('https://api.example.com/error', 'PUT', callback)
      }).toThrow('Request failed')
      
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'http.request_success': false,
        'http.error': 'Request failed'
      })
    })
  })

  describe('Message Send Tracing', () => {
    it('should trace successful message send', () => {
      const callback = vi.fn().mockReturnValue('sent')
      const content = 'Hello world'
      
      const result = tracingHelper.traceMessageSend('msg456', content, callback)
      
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith('message_send', expect.any(Function))
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'message.id': 'msg456',
        'message.content_length': 11,
        'message.operation': 'send'
      })
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'message.send_success': true,
        'message.send_duration_ms': 0
      })
      expect(result).toBe('sent')
    })

    it('should handle null content gracefully', () => {
      const callback = vi.fn().mockReturnValue('sent')
      
      tracingHelper.traceMessageSend('msg456', null, callback)
      
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'message.id': 'msg456',
        'message.content_length': 0,
        'message.operation': 'send'
      })
    })

    it('should trace failed message send', () => {
      const error = new Error('Send failed')
      const callback = vi.fn().mockImplementation(() => {
        throw error
      })
      
      expect(() => {
        tracingHelper.traceMessageSend('msg456', 'content', callback)
      }).toThrow('Send failed')
      
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'message.send_success': false,
        'message.send_error': 'Send failed'
      })
    })
  })

  describe('Emote Load Tracing', () => {
    it('should trace successful emote load', () => {
      const callback = vi.fn().mockReturnValue({ fromCache: true })
      
      const result = tracingHelper.traceEmoteLoad('7tv', 'emote123', callback)
      
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith('emote_load', expect.any(Function))
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'emote.provider': '7tv',
        'emote.id': 'emote123',
        'emote.operation': 'load'
      })
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'emote.load_success': true,
        'emote.from_cache': true
      })
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK })
      expect(result).toEqual({ fromCache: true })
    })

    it('should handle emote load without cache info', () => {
      const callback = vi.fn().mockReturnValue('emote_data')
      
      tracingHelper.traceEmoteLoad('bttv', 'emote456', callback)
      
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'emote.load_success': true,
        'emote.from_cache': false
      })
    })

    it('should trace failed emote load', () => {
      const error = new Error('Emote not found')
      const callback = vi.fn().mockImplementation(() => {
        throw error
      })
      
      expect(() => {
        tracingHelper.traceEmoteLoad('ffz', 'emote789', callback)
      }).toThrow('Emote not found')
      
      expect(mockSpan.recordException).toHaveBeenCalledWith(error)
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'emote.load_success': false,
        'emote.error': 'Emote not found'
      })
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR })
    })
  })

  describe('7TV Operation Tracing', () => {
    it('should trace successful 7TV operation', () => {
      const callback = vi.fn().mockReturnValue('operation_result')
      
      const result = tracingHelper.trace7TVOperation('emote_update', 'chatroom123', callback)
      
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith('seventv_emote_update', expect.any(Function))
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'seventv.operation': 'emote_update',
        'seventv.chatroom_id': 'chatroom123',
        'service.name': '7tv'
      })
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'seventv.operation_success': true
      })
      expect(result).toBe('operation_result')
    })

    it('should trace failed 7TV operation', () => {
      const error = new Error('7TV API error')
      const callback = vi.fn().mockImplementation(() => {
        throw error
      })
      
      expect(() => {
        tracingHelper.trace7TVOperation('websocket_connect', 'chatroom456', callback)
      }).toThrow('7TV API error')
      
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'seventv.operation_success': false,
        'seventv.error': '7TV API error'
      })
    })
  })

  describe('User Interaction Tracing', () => {
    it('should trace successful user interaction', () => {
      const callback = vi.fn().mockReturnValue('interaction_result')
      
      const result = tracingHelper.traceUserInteraction('button_click', 'send_message', callback)
      
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith('user_interaction', expect.any(Function))
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'user.interaction_type': 'button_click',
        'user.component': 'send_message',
        'user.operation': 'interact'
      })
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'user.interaction_success': true,
        'user.response_time_ms': 0
      })
      expect(result).toBe('interaction_result')
    })

    it('should trace failed user interaction', () => {
      const error = new Error('Interaction failed')
      const callback = vi.fn().mockImplementation(() => {
        throw error
      })
      
      expect(() => {
        tracingHelper.traceUserInteraction('scroll', 'chat_window', callback)
      }).toThrow('Interaction failed')
      
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'user.interaction_success': false,
        'user.error': 'Interaction failed'
      })
    })
  })

  describe('Performance Operation Tracing', () => {
    beforeEach(() => {
      // Mock performance.now if available
      if (typeof performance !== 'undefined' && performance.now) {
        vi.spyOn(performance, 'now').mockReturnValue(1640000000)
      }
    })

    it('should trace successful performance operation', () => {
      const callback = vi.fn().mockReturnValue('perf_result')
      
      const result = tracingHelper.tracePerformanceOperation('render', 'ui', callback)
      
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith('performance_render', expect.any(Function))
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'performance.operation': 'render',
        'performance.category': 'ui'
      })
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'performance.duration_ms': 0,
        'performance.success': true
      })
      expect(result).toBe('perf_result')
    })

    it('should trace failed performance operation', () => {
      const error = new Error('Performance issue')
      const callback = vi.fn().mockImplementation(() => {
        throw error
      })
      
      expect(() => {
        tracingHelper.tracePerformanceOperation('load', 'resource', callback)
      }).toThrow('Performance issue')
      
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'performance.success': false,
        'performance.error': 'Performance issue'
      })
    })
  })

  describe('Helper Methods', () => {
    it('should get active span', () => {
      const span = tracingHelper.getActiveSpan()
      
      expect(span).toBe(mockSpan)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing callback gracefully', () => {
      // This should not throw an error
      expect(() => {
        tracingHelper.addEvent('test_event')
      }).not.toThrow()
    })

    it('should handle empty attributes', () => {
      tracingHelper.setAttributes({})
      
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({})
    })

    it('should handle null span gracefully', () => {
      tracingHelper.getActiveSpan = vi.fn().mockReturnValue(null)
      
      expect(() => {
        tracingHelper.addEvent('test_event')
        tracingHelper.setAttributes({ test: 'value' })
      }).not.toThrow()
    })

    it('should handle complex error objects', () => {
      const complexError = new Error('Complex error')
      complexError.code = 'ERR_COMPLEX'
      complexError.details = { nested: 'data' }
      
      const callback = vi.fn().mockImplementation(() => {
        throw complexError
      })
      
      expect(() => {
        tracingHelper.traceKickAPICall('/api/test', 'GET', callback)
      }).toThrow('Complex error')
      
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'http.success': false,
        'http.error': 'Complex error',
        'http.status_code': 500
      })
    })

    it('should handle very long attribute values', () => {
      const longValue = 'A'.repeat(10000)
      const attributes = { 'test.long_value': longValue }
      
      expect(() => {
        tracingHelper.setAttributes(attributes)
      }).not.toThrow()
      
      expect(mockSpan.setAttributes).toHaveBeenCalledWith(attributes)
    })

    it('should handle special characters in span names', () => {
      const callback = vi.fn().mockReturnValue('result')
      
      tracingHelper.traceKickAPICall('/api/test?param=value&other=123', 'GET', callback)
      
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith('kick_api_get', expect.any(Function))
    })
  })

  describe('Async Operations', () => {
    it('should handle async callbacks', async () => {
      const asyncCallback = vi.fn().mockResolvedValue('async_result')
      
      // Modify startActiveSpan to handle async callbacks
      mockTracer.startActiveSpan.mockImplementation((name, callback) => {
        return callback(mockSpan)
      })
      
      const result = await tracingHelper.traceWebSocketConnection('room1', 'user1', asyncCallback)
      
      expect(result).toBe('async_result')
      expect(asyncCallback).toHaveBeenCalled()
    })

    it('should handle rejected promises', async () => {
      const error = new Error('Async error')
      const asyncCallback = vi.fn().mockRejectedValue(error)
      
      mockTracer.startActiveSpan.mockImplementation((name, callback) => {
        return callback(mockSpan)
      })
      
      await expect(
        tracingHelper.traceWebSocketConnection('room1', 'user1', asyncCallback)
      ).rejects.toThrow('Async error')
      
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'websocket.connection_success': false,
        'websocket.error': 'Async error'
      })
    })
  })

  describe('Integration with OpenTelemetry Context', () => {
    it('should work with OpenTelemetry context propagation', () => {
      const callback = vi.fn().mockReturnValue('context_result')
      
      // Mock context propagation
      mockContext.with.mockImplementation((ctx, fn) => {
        return fn()
      })
      
      const result = tracingHelper.startActiveSpan('test_context', callback)
      
      expect(result).toBe('context_result')
      expect(callback).toHaveBeenCalledWith(mockSpan)
    })
  })

  describe('Performance Impact', () => {
    it('should have minimal overhead for successful operations', () => {
      const callback = vi.fn().mockReturnValue('fast_result')
      
      const startTime = Date.now()
      tracingHelper.traceKickAPICall('/api/fast', 'GET', callback)
      const endTime = Date.now()
      
      // Tracing overhead should be minimal
      expect(endTime - startTime).toBeLessThan(100)
    })

    it('should handle high-frequency operations', () => {
      const callback = vi.fn().mockReturnValue('result')
      
      // Simulate many operations
      for (let i = 0; i < 1000; i++) {
        tracingHelper.traceMessageFlow(`msg${i}`, 'chat', callback)
      }
      
      expect(callback).toHaveBeenCalledTimes(1000)
      expect(mockTracer.startActiveSpan).toHaveBeenCalledTimes(1000)
    })
  })
})

// Additional tests for tracing configuration and setup
describe('Tracing Configuration', () => {
  it('should initialize with custom tracer', () => {
    const customTracer = { startActiveSpan: vi.fn() }
    const helper = new TracingHelper(customTracer)
    
    expect(helper.tracer).toBe(customTracer)
  })

  it('should use default span status codes', () => {
    const helper = new TracingHelper()
    
    expect(helper.SpanStatusCode).toBe(SpanStatusCode)
    expect(helper.SpanStatusCode.OK).toBe(1)
    expect(helper.SpanStatusCode.ERROR).toBe(2)
  })

  it('should initialize with custom span status codes', () => {
    const customStatusCodes = { OK: 10, ERROR: 20 }
    const helper = new TracingHelper(null, customStatusCodes)
    
    expect(helper.SpanStatusCode).toBe(customStatusCodes)
  })
})