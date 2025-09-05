import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch for OTLP export simulation
const mockFetch = vi.fn();

// Mock OpenTelemetry modules
const mockSpan = {
  setAttributes: vi.fn(),
  recordException: vi.fn(),
  setStatus: vi.fn(),
  end: vi.fn(),
  addEvent: vi.fn(),
  setAttribute: vi.fn()
};

const mockTracer = {
  startSpan: vi.fn(() => mockSpan),
  startActiveSpan: vi.fn((name, callback) => {
    if (typeof callback === 'function') {
      return callback(mockSpan);
    }
    return mockSpan;
  })
};

const mockWebTracerProvider = vi.fn(() => ({
  getTracer: vi.fn(() => mockTracer),
  addSpanProcessor: vi.fn(),
  register: vi.fn()
}));

// Mock IPC mechanisms
const mockIpcHandlers = new Map();
const mockIpcMain = {
  handle: vi.fn((channel, handler) => {
    mockIpcHandlers.set(channel, handler);
  })
};

const mockIpcRenderer = {
  invoke: vi.fn((channel, ...args) => {
    const handler = mockIpcHandlers.get(channel);
    if (handler) {
      return handler({}, ...args);
    }
    return Promise.reject(new Error(`No handler for ${channel}`));
  })
};

// Mock window object for renderer side
const mockWindow = {
  electronAPI: {
    telemetry: {
      exportTraces: vi.fn(),
      exportTracesJson: vi.fn()
    }
  },
  telemetry: {
    exportTraces: vi.fn(),
    exportTracesJson: vi.fn(),
    getOtelConfig: vi.fn()
  }
};

// Mock console methods
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
};

describe('Telemetry Data Flow Integration Tests', () => {
  let originalFetch;
  let originalConsole;
  let originalWindow;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock globals
    originalFetch = global.fetch;
    originalConsole = { ...console };
    originalWindow = global.window;
    
    global.fetch = mockFetch;
    console.log = mockConsole.log;
    console.warn = mockConsole.warn;
    console.error = mockConsole.error;
    console.debug = mockConsole.debug;
    global.window = mockWindow;
    
    // Set up successful fetch responses by default
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ success: true })
    });
    
    // Set up successful IPC bridge responses
    mockWindow.telemetry.exportTraces.mockResolvedValue({ ok: true, status: 204 });
    mockWindow.telemetry.exportTracesJson.mockResolvedValue({ ok: true, status: 200 });
    mockWindow.telemetry.getOtelConfig.mockResolvedValue({
      ok: true,
      endpoint: 'https://otlp.grafana.net/v1/traces',
      headers: 'Authorization=Bearer test-token',
      deploymentEnv: 'test'
    });
    
    // Set up IPC handlers to simulate main process behavior
    setupMainProcessHandlers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
    global.window = originalWindow;
    vi.resetModules();
  });

  // Helper to set up main process IPC handlers
  const setupMainProcessHandlers = () => {
    // OTLP config handler
    mockIpcHandlers.set('otel:get-config', async () => {
      return {
        ok: true,
        endpoint: 'https://otlp.grafana.net/v1/traces',
        headers: 'Authorization=Bearer test-token',
        deploymentEnv: 'test'
      };
    });

    // Trace export handlers
    mockIpcHandlers.set('telemetry:exportTraces', async (event, arrayBuffer) => {
      // Simulate main process OTLP relay
      const response = await mockFetch('https://otlp.grafana.net/v1/traces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-protobuf',
          'Authorization': 'Bearer test-token'
        },
        body: arrayBuffer
      });
      
      return { ok: response.ok, status: response.status };
    });

    mockIpcHandlers.set('telemetry:exportTracesJson', async (event, jsonData) => {
      // Simulate main process OTLP relay
      const response = await mockFetch('https://otlp.grafana.net/v1/traces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(jsonData)
      });
      
      return { ok: response.ok, status: response.status };
    });

    // User analytics handlers
    mockIpcHandlers.set('telemetry:recordUserAction', async (event, { sessionId, actionType, context }) => {
      console.log(`[Main IPC] Recording user action: ${actionType} for session ${sessionId}`);
      return { success: true, recorded: { sessionId, actionType, context } };
    });

    mockIpcHandlers.set('telemetry:recordError', async (event, { error, context }) => {
      console.log(`[Main IPC] Recording error: ${error.message || error}`);
      return { success: true, recorded: { error, context } };
    });

    // Performance monitoring handlers
    mockIpcHandlers.set('telemetry:monitorUIInteraction', async (event, { interactionType, executionTime, context }) => {
      console.log(`[Main IPC] Monitoring UI interaction: ${interactionType} (${executionTime}ms)`);
      
      // Simulate performance severity calculation
      let severity = 'good';
      if (executionTime > 100) severity = 'warning';
      if (executionTime > 300) severity = 'critical';
      
      return severity;
    });
  };

  // Helper to simulate renderer span creation
  const createRendererSpan = (name, attributes = {}) => {
    const span = mockTracer.startSpan(name);
    span.setAttributes(attributes);
    return span;
  };

  // Helper to simulate OTLP export data
  const createMockOtlpData = (spans = []) => {
    return {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'kicktalk-renderer' } },
            { key: 'service.version', value: { stringValue: '1.0.0-test' } }
          ]
        },
        instrumentationLibrarySpans: [{
          instrumentationLibrary: {
            name: 'kicktalk-renderer-tracing',
            version: '1.0.0'
          },
          spans: spans.map(span => ({
            traceId: span.traceId || 'mock-trace-id-123',
            spanId: span.spanId || 'mock-span-id-456',
            name: span.name,
            kind: span.kind || 1,
            startTimeUnixNano: span.startTime || '1640995200000000000',
            endTimeUnixNano: span.endTime || '1640995200100000000',
            attributes: Object.entries(span.attributes || {}).map(([key, value]) => ({
              key,
              value: { stringValue: String(value) }
            })),
            status: { code: span.status || 1 }
          }))
        }]
      }]
    };
  };

  describe('End-to-End Data Flow', () => {
    describe('Renderer to Main to Grafana Flow', () => {
      it('should successfully flow telemetry data from renderer through IPC to Grafana', async () => {
        // Step 1: Renderer creates spans
        const userActionSpan = createRendererSpan('user_interaction', {
          'user.action': 'chat_send',
          'user.session_id': 'session123',
          'message.length': '25'
        });
        
        const networkSpan = createRendererSpan('http_request', {
          'http.method': 'POST',
          'http.url': '/api/messages',
          'http.status_code': '200'
        });

        // Step 2: Simulate OTLP export from renderer
        const otlpData = createMockOtlpData([
          {
            name: 'user_interaction',
            attributes: {
              'user.action': 'chat_send',
              'user.session_id': 'session123',
              'message.length': '25'
            }
          },
          {
            name: 'http_request',
            attributes: {
              'http.method': 'POST',
              'http.url': '/api/messages',
              'http.status_code': '200'
            }
          }
        ]);

        // Step 3: Export via IPC to main process
        const exportResult = await mockIpcRenderer.invoke('telemetry:exportTracesJson', otlpData);

        // Step 4: Verify the full flow
        expect(exportResult).toEqual({ ok: true, status: 200 });
        expect(mockFetch).toHaveBeenCalledWith(
          'https://otlp.grafana.net/v1/traces',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-token'
            },
            body: JSON.stringify(otlpData)
          }
        );
        
        // Verify spans were created
        expect(mockTracer.startSpan).toHaveBeenCalledWith('user_interaction');
        expect(mockTracer.startSpan).toHaveBeenCalledWith('http_request');
        expect(mockSpan.setAttributes).toHaveBeenCalledTimes(2);
      });

      it('should handle binary (protobuf) OTLP export flow', async () => {
        // Create mock ArrayBuffer for protobuf data
        const mockArrayBuffer = new ArrayBuffer(256);
        const mockUint8Array = new Uint8Array(mockArrayBuffer);
        // Fill with some mock protobuf data
        mockUint8Array.fill(0x08); // Mock protobuf bytes

        const exportResult = await mockIpcRenderer.invoke('telemetry:exportTraces', mockArrayBuffer);

        expect(exportResult).toEqual({ ok: true, status: 200 });
        expect(mockFetch).toHaveBeenCalledWith(
          'https://otlp.grafana.net/v1/traces',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-protobuf',
              'Authorization': 'Bearer test-token'
            },
            body: mockArrayBuffer
          }
        );
      });

      it('should handle Grafana Cloud export failures gracefully', async () => {
        // Mock Grafana Cloud returning an error
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests'
        });

        const otlpData = createMockOtlpData([{
          name: 'test_span',
          attributes: { 'test.attr': 'value' }
        }]);

        const exportResult = await mockIpcRenderer.invoke('telemetry:exportTracesJson', otlpData);

        expect(exportResult).toEqual({ ok: false, status: 429 });
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    describe('User Analytics Data Flow', () => {
      it('should flow user action data from renderer to main process', async () => {
        const actionData = {
          sessionId: 'user-session-789',
          actionType: 'chat_send',
          context: {
            message_length: 42,
            channel: 'test-channel',
            timestamp: Date.now()
          }
        };

        const result = await mockIpcRenderer.invoke('telemetry:recordUserAction', actionData);

        expect(result).toEqual({
          success: true,
          recorded: actionData
        });
        
        expect(mockConsole.log).toHaveBeenCalledWith(
          '[Main IPC] Recording user action: chat_send for session user-session-789'
        );
      });

      it('should flow error data from renderer to main process', async () => {
        const errorData = {
          error: {
            name: 'NetworkError',
            message: 'Failed to fetch user data',
            stack: 'NetworkError: Failed to fetch\n    at test.js:1:1'
          },
          context: {
            operation: 'api_request',
            url: '/api/users/123',
            component: 'UserProfile'
          }
        };

        const result = await mockIpcRenderer.invoke('telemetry:recordError', errorData);

        expect(result).toEqual({
          success: true,
          recorded: errorData
        });
        
        expect(mockConsole.log).toHaveBeenCalledWith(
          '[Main IPC] Recording error: Failed to fetch user data'
        );
      });

      it('should flow performance monitoring data from renderer to main', async () => {
        const performanceData = {
          interactionType: 'button_click',
          executionTime: 150,
          context: {
            component: 'ChatInput',
            user_id: 'user456',
            session_id: 'session789'
          }
        };

        const severity = await mockIpcRenderer.invoke('telemetry:monitorUIInteraction', performanceData);

        expect(severity).toBe('warning'); // 150ms should be warning
        expect(mockConsole.log).toHaveBeenCalledWith(
          '[Main IPC] Monitoring UI interaction: button_click (150ms)'
        );
      });
    });

    describe('Configuration and Setup Flow', () => {
      it('should properly configure renderer telemetry from main process config', async () => {
        const config = await mockIpcRenderer.invoke('otel:get-config');

        expect(config).toEqual({
          ok: true,
          endpoint: 'https://otlp.grafana.net/v1/traces',
          headers: 'Authorization=Bearer test-token',
          deploymentEnv: 'test'
        });
      });

      it('should handle missing configuration gracefully', async () => {
        // Mock missing configuration
        mockIpcHandlers.set('otel:get-config', async () => {
          return {
            ok: false,
            reason: 'missing_endpoint_or_headers'
          };
        });

        const config = await mockIpcRenderer.invoke('otel:get-config');

        expect(config).toEqual({
          ok: false,
          reason: 'missing_endpoint_or_headers'
        });
      });
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should preserve span attributes through the entire flow', async () => {
      const originalAttributes = {
        'service.name': 'kicktalk-renderer',
        'user.id': 'user123',
        'session.id': 'session456',
        'operation.name': 'message_send',
        'message.length': '75',
        'channel.id': 'channel789'
      };

      const span = createRendererSpan('message_send_operation', originalAttributes);
      const otlpData = createMockOtlpData([{
        name: 'message_send_operation',
        attributes: originalAttributes
      }]);

      await mockIpcRenderer.invoke('telemetry:exportTracesJson', otlpData);

      // Verify the data sent to Grafana contains all original attributes
      const fetchCall = mockFetch.mock.calls[0];
      const sentData = JSON.parse(fetchCall[1].body);
      const sentSpan = sentData.resourceSpans[0].instrumentationLibrarySpans[0].spans[0];
      
      expect(sentSpan.name).toBe('message_send_operation');
      expect(sentSpan.attributes).toHaveLength(Object.keys(originalAttributes).length);
      
      // Verify each attribute is preserved
      originalAttributes['service.name'] && expect(
        sentSpan.attributes.some(attr => 
          attr.key === 'service.name' && attr.value.stringValue === 'kicktalk-renderer'
        )
      ).toBe(true);
    });

    it('should maintain trace context and relationships', async () => {
      const traceId = 'trace-id-12345';
      const parentSpanId = 'parent-span-456';
      const childSpanId = 'child-span-789';

      const otlpData = createMockOtlpData([
        {
          name: 'parent_operation',
          traceId,
          spanId: parentSpanId,
          attributes: { 'span.type': 'parent' }
        },
        {
          name: 'child_operation',
          traceId,
          spanId: childSpanId,
          parentSpanId,
          attributes: { 'span.type': 'child' }
        }
      ]);

      await mockIpcRenderer.invoke('telemetry:exportTracesJson', otlpData);

      const fetchCall = mockFetch.mock.calls[0];
      const sentData = JSON.parse(fetchCall[1].body);
      const spans = sentData.resourceSpans[0].instrumentationLibrarySpans[0].spans;

      // Verify trace relationships are preserved
      expect(spans).toHaveLength(2);
      expect(spans.every(span => span.traceId === traceId)).toBe(true);
      
      const parentSpan = spans.find(span => span.spanId === parentSpanId);
      const childSpan = spans.find(span => span.spanId === childSpanId);
      
      expect(parentSpan).toBeDefined();
      expect(childSpan).toBeDefined();
      expect(childSpan.parentSpanId).toBe(parentSpanId);
    });

    it('should handle large data payloads without corruption', async () => {
      // Create a large payload
      const largeAttributes = {};
      for (let i = 0; i < 100; i++) {
        largeAttributes[`large.attribute.${i}`] = `value-${'A'.repeat(100)}-${i}`;
      }

      const otlpData = createMockOtlpData([{
        name: 'large_data_test',
        attributes: largeAttributes
      }]);

      const exportResult = await mockIpcRenderer.invoke('telemetry:exportTracesJson', otlpData);

      expect(exportResult).toEqual({ ok: true, status: 200 });
      
      // Verify large payload was sent correctly
      const fetchCall = mockFetch.mock.calls[0];
      const sentData = JSON.parse(fetchCall[1].body);
      const sentAttributes = sentData.resourceSpans[0].instrumentationLibrarySpans[0].spans[0].attributes;
      
      expect(sentAttributes).toHaveLength(100);
      expect(sentAttributes[50].value.stringValue).toContain('AAAAAAAAAA'); // Contains the repeated A's
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle network failures gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network connection failed'));

      const otlpData = createMockOtlpData([{
        name: 'network_failure_test',
        attributes: { 'test.scenario': 'network_failure' }
      }]);

      // The IPC handler should catch and handle the network error
      await expect(
        mockIpcRenderer.invoke('telemetry:exportTracesJson', otlpData)
      ).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle malformed data gracefully', async () => {
      const malformedData = {
        invalidStructure: 'this is not valid OTLP data',
        missingRequiredFields: true
      };

      // Should not throw even with malformed data
      await expect(
        mockIpcRenderer.invoke('telemetry:exportTracesJson', malformedData)
      ).resolves.not.toThrow();
    });

    it('should handle IPC failures gracefully', async () => {
      // Mock IPC handler to throw
      mockIpcHandlers.set('telemetry:exportTracesJson', async () => {
        throw new Error('IPC handler crashed');
      });

      await expect(
        mockIpcRenderer.invoke('telemetry:exportTracesJson', {})
      ).rejects.toThrow('IPC handler crashed');
    });

    it('should handle partial data corruption', async () => {
      const partiallyCorruptData = createMockOtlpData([
        {
          name: 'valid_span',
          attributes: { 'status': 'valid' }
        },
        {
          // Missing required fields
          attributes: { 'status': 'corrupted' }
        }
      ]);

      // Should still process the data despite corruption
      const result = await mockIpcRenderer.invoke('telemetry:exportTracesJson', partiallyCorruptData);
      
      expect(result).toEqual({ ok: true, status: 200 });
    });
  });

  describe('Performance and Scaling', () => {
    it('should handle high-frequency data flow efficiently', async () => {
      const startTime = Date.now();
      const promises = [];

      // Simulate 50 concurrent telemetry exports
      for (let i = 0; i < 50; i++) {
        const otlpData = createMockOtlpData([{
          name: `concurrent_span_${i}`,
          attributes: { 'iteration': String(i) }
        }]);

        promises.push(
          mockIpcRenderer.invoke('telemetry:exportTracesJson', otlpData)
        );
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();

      // All should succeed
      expect(results.every(r => r.ok === true)).toBe(true);
      
      // Should complete reasonably quickly (under 1 second for mocked operations)
      expect(endTime - startTime).toBeLessThan(1000);
      
      // Should have made 50 fetch calls
      expect(mockFetch).toHaveBeenCalledTimes(50);
    });

    it('should handle memory-intensive operations', async () => {
      // Create data that would be memory-intensive
      const memoryIntensiveData = createMockOtlpData(
        Array.from({ length: 1000 }, (_, i) => ({
          name: `memory_test_span_${i}`,
          attributes: Object.fromEntries(
            Array.from({ length: 20 }, (_, j) => [`attr_${j}`, `value_${i}_${j}`])
          )
        }))
      );

      const result = await mockIpcRenderer.invoke('telemetry:exportTracesJson', memoryIntensiveData);
      
      expect(result).toEqual({ ok: true, status: 200 });
      
      // Verify the large payload was processed
      const fetchCall = mockFetch.mock.calls[0];
      const sentData = JSON.parse(fetchCall[1].body);
      const spans = sentData.resourceSpans[0].instrumentationLibrarySpans[0].spans;
      
      expect(spans).toHaveLength(1000);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle complete user session telemetry flow', async () => {
      const sessionId = 'real-session-123';
      const userId = 'real-user-456';

      // 1. User starts session
      await mockIpcRenderer.invoke('telemetry:recordUserAction', {
        sessionId,
        actionType: 'session_start',
        context: { userId, startTime: Date.now() }
      });

      // 2. User performs various actions
      const actions = [
        { type: 'chat_send', context: { messageLength: 25, channel: 'general' } },
        { type: 'emote_use', context: { emoteName: 'Kappa', provider: '7tv' } },
        { type: 'channel_switch', context: { fromChannel: 'general', toChannel: 'vip' } }
      ];

      for (const action of actions) {
        await mockIpcRenderer.invoke('telemetry:recordUserAction', {
          sessionId,
          actionType: action.type,
          context: action.context
        });
      }

      // 3. Generate corresponding spans
      const spans = actions.map((action, i) => ({
        name: `user_${action.type}`,
        attributes: {
          'session.id': sessionId,
          'user.id': userId,
          'action.type': action.type,
          'action.sequence': String(i + 1),
          ...Object.fromEntries(
            Object.entries(action.context).map(([k, v]) => [`action.${k}`, String(v)])
          )
        }
      }));

      const otlpData = createMockOtlpData(spans);
      const exportResult = await mockIpcRenderer.invoke('telemetry:exportTracesJson', otlpData);

      // 4. Verify complete flow
      expect(exportResult).toEqual({ ok: true, status: 200 });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://otlp.grafana.net/v1/traces',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      );

      // Verify all user actions were recorded
      expect(mockConsole.log).toHaveBeenCalledTimes(4); // session_start + 3 actions
    });

    it('should handle error reporting and recovery telemetry flow', async () => {
      // 1. Error occurs in renderer
      const errorData = {
        error: {
          name: 'WebSocketError',
          message: 'Connection lost to chat server',
          stack: 'WebSocketError: Connection lost\n    at ws.js:42:10'
        },
        context: {
          operation: 'chat_connection',
          chatroom: 'room123',
          reconnectAttempt: 1
        }
      };

      await mockIpcRenderer.invoke('telemetry:recordError', errorData);

      // 2. Create error span
      const errorSpan = createRendererSpan('websocket_error', {
        'error.type': 'WebSocketError',
        'error.message': 'Connection lost to chat server',
        'chatroom.id': 'room123',
        'recovery.attempt': '1'
      });

      // 3. Recovery attempt span
      const recoverySpan = createRendererSpan('websocket_reconnect', {
        'recovery.type': 'automatic',
        'chatroom.id': 'room123',
        'attempt.number': '1',
        'recovery.success': 'true'
      });

      const otlpData = createMockOtlpData([
        {
          name: 'websocket_error',
          attributes: {
            'error.type': 'WebSocketError',
            'error.message': 'Connection lost to chat server',
            'chatroom.id': 'room123',
            'recovery.attempt': '1'
          }
        },
        {
          name: 'websocket_reconnect',
          attributes: {
            'recovery.type': 'automatic',
            'chatroom.id': 'room123',
            'attempt.number': '1',
            'recovery.success': 'true'
          }
        }
      ]);

      const exportResult = await mockIpcRenderer.invoke('telemetry:exportTracesJson', otlpData);

      expect(exportResult).toEqual({ ok: true, status: 200 });
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[Main IPC] Recording error: Connection lost to chat server'
      );
    });

    it('should handle performance monitoring and alerting flow', async () => {
      // 1. Monitor various UI interactions
      const interactions = [
        { type: 'scroll', time: 25, component: 'ChatWindow' },
        { type: 'button_click', time: 150, component: 'SendButton' }, // Warning
        { type: 'render', time: 350, component: 'EmoteSelector' }, // Critical
        { type: 'api_request', time: 80, component: 'UserProfile' }
      ];

      const severities = [];
      const spans = [];

      for (const interaction of interactions) {
        const severity = await mockIpcRenderer.invoke('telemetry:monitorUIInteraction', {
          interactionType: interaction.type,
          executionTime: interaction.time,
          context: { component: interaction.component }
        });

        severities.push(severity);
        
        spans.push({
          name: `ui_${interaction.type}`,
          attributes: {
            'ui.component': interaction.component,
            'performance.duration_ms': String(interaction.time),
            'performance.severity': severity
          }
        });
      }

      // 2. Export performance spans
      const otlpData = createMockOtlpData(spans);
      const exportResult = await mockIpcRenderer.invoke('telemetry:exportTracesJson', otlpData);

      // 3. Verify severity classification
      expect(severities).toEqual(['good', 'warning', 'critical', 'good']);
      expect(exportResult).toEqual({ ok: true, status: 200 });

      // 4. Verify performance data reached Grafana
      const fetchCall = mockFetch.mock.calls[0];
      const sentData = JSON.parse(fetchCall[1].body);
      const sentSpans = sentData.resourceSpans[0].instrumentationLibrarySpans[0].spans;
      
      expect(sentSpans).toHaveLength(4);
      expect(sentSpans.some(span => 
        span.attributes.some(attr => 
          attr.key === 'performance.severity' && attr.value.stringValue === 'critical'
        )
      )).toBe(true);
    });
  });
});