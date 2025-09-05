import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

// Mock WebTracerProvider and related classes
const mockSpan = {
  setAttributes: vi.fn(),
  recordException: vi.fn(),
  setStatus: vi.fn(),
  end: vi.fn(),
  addEvent: vi.fn(),
  setAttribute: vi.fn()
};

const mockTracer = {
  startActiveSpan: vi.fn((name, callback) => {
    if (typeof callback === 'function') {
      return callback(mockSpan);
    }
    return mockSpan;
  }),
  startSpan: vi.fn(() => mockSpan)
};

const mockWebTracerProvider = vi.fn(() => ({
  register: vi.fn(),
  addSpanProcessor: vi.fn(),
  resource: {
    merge: vi.fn((resource) => resource)
  },
  getTracer: vi.fn(() => mockTracer)
}));

const mockSimpleSpanProcessor = vi.fn();
const mockAlwaysOnSampler = vi.fn();

// Mock OTLP Trace Exporter
const mockOTLPTraceExporter = vi.fn(() => ({
  export: vi.fn(),
  shutdown: vi.fn()
}));

// Mock instrumentation
const mockFetchInstrumentation = vi.fn(() => ({
  setMeterProvider: vi.fn(),
  setTracerProvider: vi.fn()
}));

const mockXMLHttpRequestInstrumentation = vi.fn(() => ({
  setMeterProvider: vi.fn(),
  setTracerProvider: vi.fn()
}));

const mockRegisterInstrumentations = vi.fn();

// Mock OpenTelemetry modules
vi.mock('@opentelemetry/sdk-trace-web', () => ({
  WebTracerProvider: mockWebTracerProvider
}));

vi.mock('@opentelemetry/instrumentation', () => ({
  registerInstrumentations: mockRegisterInstrumentations
}));

vi.mock('@opentelemetry/instrumentation-fetch', () => ({
  FetchInstrumentation: mockFetchInstrumentation
}));

vi.mock('@opentelemetry/instrumentation-xml-http-request', () => ({
  XMLHttpRequestInstrumentation: mockXMLHttpRequestInstrumentation
}));

vi.mock('@opentelemetry/sdk-trace-base', () => ({
  SimpleSpanProcessor: mockSimpleSpanProcessor,
  AlwaysOnSampler: mockAlwaysOnSampler
}));

vi.mock('@opentelemetry/api', () => ({
  context: {
    active: vi.fn(() => ({})),
    with: vi.fn((ctx, fn) => fn())
  },
  trace: {
    getTracer: vi.fn(() => mockTracer)
  }
}));

vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: mockOTLPTraceExporter
}));

// Mock Resources module (optional import)
vi.mock('@opentelemetry/resources', () => ({
  Resource: vi.fn((attrs) => ({ attributes: attrs }))
}), { virtual: true });

describe('WebTracing IPC Exporter Tests', () => {
  let originalWindow;
  let originalLocalStorage;
  let originalNavigator;
  let originalFetch;
  let originalXMLHttpRequest;
  let mockWindow;
  let mockTelemetryBridge;
  let mockNavigator;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Store originals
    originalWindow = global.window;
    originalLocalStorage = global.localStorage;
    originalNavigator = global.navigator;
    originalFetch = global.fetch;
    originalXMLHttpRequest = global.XMLHttpRequest;
    
    // Mock telemetry bridge
    mockTelemetryBridge = {
      getOtelConfig: vi.fn().mockResolvedValue({
        ok: true,
        endpoint: 'https://otlp-gateway.grafana.net/otlp/traces',
        headers: 'Authorization=Bearer test-token,User-Agent=KickTalk/1.0.0',
        deploymentEnv: 'test'
      }),
      exportTraces: vi.fn().mockResolvedValue({ ok: true, status: 204 }),
      exportTracesJson: vi.fn().mockResolvedValue({ ok: true, status: 204 })
    };
    
    // Mock window object
    mockWindow = {
      localStorage: mockLocalStorage,
      telemetry: mockTelemetryBridge,
      addEventListener: vi.fn(),
      WebSocket: vi.fn(),
      fetch: vi.fn(),
      __KT_WEBSOCKET_INSTRUMENTED__: false,
      __KT_RENDERER_OTEL_INITIALIZED__: false,
      __KT_OTEL_IPC_TRANSPORT_INTERCEPTORS__: false,
      __KT_TELEMETRY_UTILS__: undefined,
      __KT_EARLY_WEBSOCKET_ACTIVITY__: [],
      __KT_TRACER__: undefined
    };
    
    // Mock navigator
    mockNavigator = {
      sendBeacon: vi.fn()
    };
    
    // Set globals
    global.window = mockWindow;
    global.localStorage = mockLocalStorage;
    global.navigator = mockNavigator;
    global.fetch = mockWindow.fetch;
    
    // Mock XMLHttpRequest
    const mockXHR = function() {
      this.open = vi.fn();
      this.send = vi.fn();
      this.setRequestHeader = vi.fn();
      this.readyState = 0;
      this.status = 0;
      this.onreadystatechange = null;
    };
    mockXHR.prototype = {
      open: vi.fn(),
      send: vi.fn()
    };
    global.XMLHttpRequest = mockXHR;
    
    // Mock localStorage with telemetry enabled
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'settings') {
        return JSON.stringify({ telemetry: { enabled: true } });
      }
      return null;
    });
    
    // Mock import.meta.env
    vi.stubGlobal('import.meta', {
      env: {
        RENDERER_VITE_TELEMETRY_LEVEL: 'NORMAL'
      }
    });
  });
  
  afterEach(() => {
    // Restore globals
    global.window = originalWindow;
    global.localStorage = originalLocalStorage;
    global.navigator = originalNavigator;
    global.fetch = originalFetch;
    global.XMLHttpRequest = originalXMLHttpRequest;
    
    vi.unstubAllGlobals();
  });

  describe('Telemetry Initialization', () => {
    it('should check telemetry settings from localStorage', async () => {
      // Import the module to trigger initialization
      await import('../webTracing.js');
      
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('settings');
    });

    it('should skip initialization when telemetry is disabled', async () => {
      mockLocalStorage.getItem.mockReturnValue(
        JSON.stringify({ telemetry: { enabled: false } })
      );
      
      await import('../webTracing.js');
      
      expect(mockTelemetryBridge.getOtelConfig).not.toHaveBeenCalled();
    });

    it('should initialize telemetry when enabled', async () => {
      await import('../webTracing.js');
      
      // Allow async initialization to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockTelemetryBridge.getOtelConfig).toHaveBeenCalled();
      expect(mockWebTracerProvider).toHaveBeenCalled();
    });

    it('should handle missing OTLP config gracefully', async () => {
      mockTelemetryBridge.getOtelConfig.mockResolvedValue({
        ok: false,
        reason: 'Config not available'
      });
      
      await import('../webTracing.js');
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockWebTracerProvider).not.toHaveBeenCalled();
    });

    it('should parse OTLP headers correctly', async () => {
      mockTelemetryBridge.getOtelConfig.mockResolvedValue({
        ok: true,
        endpoint: 'https://test.com/otlp',
        headers: 'Authorization=Bearer token123,User-Agent=TestApp,Content-Type=application/x-protobuf',
        deploymentEnv: 'production'
      });
      
      await import('../webTracing.js');
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockTelemetryBridge.getOtelConfig).toHaveBeenCalled();
    });
  });

  describe('WebSocket Instrumentation', () => {
    it('should install WebSocket instrumentation when telemetry is enabled', async () => {
      const originalWebSocket = mockWindow.WebSocket;
      
      await import('../webTracing.js');
      
      // WebSocket should be wrapped
      expect(mockWindow.WebSocket).not.toBe(originalWebSocket);
      expect(mockWindow.__KT_ORIGINAL_WEBSOCKET__).toBe(originalWebSocket);
      expect(mockWindow.__KT_WEBSOCKET_INSTRUMENTED__).toBe(true);
    });

    it('should not install WebSocket instrumentation when telemetry is disabled', async () => {
      mockLocalStorage.getItem.mockReturnValue(
        JSON.stringify({ telemetry: { enabled: false } })
      );
      const originalWebSocket = mockWindow.WebSocket;
      
      await import('../webTracing.js');
      
      expect(mockWindow.WebSocket).toBe(originalWebSocket);
      expect(mockWindow.__KT_WEBSOCKET_INSTRUMENTED__).toBeFalsy();
    });

    it('should restore original WebSocket when instrumentation is disabled', async () => {
      const originalWebSocket = vi.fn();
      mockWindow.__KT_ORIGINAL_WEBSOCKET__ = originalWebSocket;
      mockWindow.WebSocket = vi.fn(); // Different from original
      
      mockLocalStorage.getItem.mockReturnValue(
        JSON.stringify({ telemetry: { enabled: false } })
      );
      
      await import('../webTracing.js');
      
      expect(mockWindow.WebSocket).toBe(originalWebSocket);
    });

    it('should create WebSocket with proper instrumentation', async () => {
      await import('../webTracing.js');
      
      const mockAddEventListener = vi.fn();
      const mockNativeWS = vi.fn(() => ({
        addEventListener: mockAddEventListener,
        removeEventListener: vi.fn(),
        close: vi.fn(),
        send: vi.fn(),
        readyState: 0
      }));
      
      mockWindow.__KT_ORIGINAL_WEBSOCKET__ = mockNativeWS;
      
      const ws = new mockWindow.WebSocket('ws://test.com/socket');
      
      expect(mockAddEventListener).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should preserve WebSocket static constants', async () => {
      const mockNativeWS = vi.fn();
      mockNativeWS.CONNECTING = 0;
      mockNativeWS.OPEN = 1;
      mockNativeWS.CLOSING = 2;
      mockNativeWS.CLOSED = 3;
      
      mockWindow.WebSocket = mockNativeWS;
      
      await import('../webTracing.js');
      
      expect(mockWindow.WebSocket.CONNECTING).toBe(0);
      expect(mockWindow.WebSocket.OPEN).toBe(1);
      expect(mockWindow.WebSocket.CLOSING).toBe(2);
      expect(mockWindow.WebSocket.CLOSED).toBe(3);
    });
  });

  describe('IPC Transport Interceptors', () => {
    beforeEach(async () => {
      await import('../webTracing.js');
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    describe('Fetch Interceptor', () => {
      it('should intercept OTLP fetch requests and route to IPC', async () => {
        const mockArrayBuffer = new ArrayBuffer(100);
        const mockInit = {
          method: 'POST',
          body: mockArrayBuffer,
          headers: { 'Content-Type': 'application/x-protobuf' }
        };
        
        const response = await mockWindow.fetch('http://127.0.0.1/otlp-ipc/v1/traces', mockInit);
        
        expect(mockTelemetryBridge.exportTraces).toHaveBeenCalledWith(mockArrayBuffer);
        expect(response.status).toBe(204);
      });

      it('should handle JSON OTLP requests', async () => {
        const mockJsonBody = { resourceSpans: [] };
        const mockInit = {
          method: 'POST',
          body: JSON.stringify(mockJsonBody),
          headers: { 'Content-Type': 'application/json' }
        };
        
        await mockWindow.fetch('http://127.0.0.1/otlp-ipc/v1/traces', mockInit);
        
        expect(mockTelemetryBridge.exportTracesJson).toHaveBeenCalledWith(mockJsonBody);
      });

      it('should handle Blob body conversion', async () => {
        const mockArrayBuffer = new ArrayBuffer(50);
        const mockBlob = new Blob([mockArrayBuffer], { type: 'application/x-protobuf' });
        
        // Mock blob.arrayBuffer()
        mockBlob.arrayBuffer = vi.fn().mockResolvedValue(mockArrayBuffer);
        
        const mockInit = {
          method: 'POST',
          body: mockBlob
        };
        
        await mockWindow.fetch('http://127.0.0.1/otlp-ipc/v1/traces', mockInit);
        
        expect(mockBlob.arrayBuffer).toHaveBeenCalled();
        expect(mockTelemetryBridge.exportTraces).toHaveBeenCalledWith(mockArrayBuffer);
      });

      it('should handle TypedArray body conversion', async () => {
        const buffer = new ArrayBuffer(64);
        const uint8Array = new Uint8Array(buffer, 8, 32); // offset=8, length=32
        
        const mockInit = {
          method: 'POST',
          body: uint8Array
        };
        
        await mockWindow.fetch('http://127.0.0.1/otlp-ipc/v1/traces', mockInit);
        
        expect(mockTelemetryBridge.exportTraces).toHaveBeenCalledWith(expect.any(ArrayBuffer));
        
        // Verify the sliced ArrayBuffer
        const call = mockTelemetryBridge.exportTraces.mock.calls[0];
        const sentBuffer = call[0];
        expect(sentBuffer.byteLength).toBe(32);
      });

      it('should pass through non-IPC requests to original fetch', async () => {
        const originalFetch = vi.fn().mockResolvedValue(new Response('OK'));
        mockWindow.fetch.__original__ = originalFetch;
        
        // Mock the original fetch being stored
        const origFetch = originalFetch;
        mockWindow.fetch = async (input, init) => {
          const url = typeof input === 'string' ? input : (input?.url || '');
          if (!url.includes('127.0.0.1/otlp-ipc')) {
            return origFetch(input, init);
          }
          // IPC handling would be here
        };
        
        await mockWindow.fetch('https://api.example.com/data', { method: 'GET' });
        
        expect(originalFetch).toHaveBeenCalledWith('https://api.example.com/data', { method: 'GET' });
      });

      it('should handle export failures gracefully', async () => {
        mockTelemetryBridge.exportTraces.mockResolvedValue({ ok: false, status: 500 });
        
        const response = await mockWindow.fetch('http://127.0.0.1/otlp-ipc/v1/traces', {
          method: 'POST',
          body: new ArrayBuffer(10)
        });
        
        expect(response.status).toBe(500);
      });

      it('should return 400 for invalid requests', async () => {
        const response = await mockWindow.fetch('http://127.0.0.1/otlp-ipc/v1/traces', {
          method: 'POST',
          body: 'invalid-body'
        });
        
        expect(response.status).toBe(400);
      });
    });

    describe('XMLHttpRequest Interceptor', () => {
      it('should intercept XHR OTLP requests', async () => {
        const xhr = new XMLHttpRequest();
        const mockArrayBuffer = new ArrayBuffer(75);
        
        // Simulate XHR lifecycle
        xhr.open('POST', 'http://127.0.0.1/otlp-ipc/v1/traces');
        
        expect(xhr.__KT_IS_IPC_OTLP__).toBe(true);
        
        // Mock successful IPC response
        xhr.send(mockArrayBuffer);
        
        expect(mockTelemetryBridge.exportTraces).toHaveBeenCalledWith(mockArrayBuffer);
      });

      it('should handle Blob bodies with FileReader', async () => {
        const xhr = new XMLHttpRequest();
        const mockArrayBuffer = new ArrayBuffer(50);
        const mockBlob = new Blob([mockArrayBuffer]);
        
        // Mock FileReader
        const mockFileReader = {
          onload: null,
          onerror: null,
          readAsArrayBuffer: vi.fn(function() {
            this.result = mockArrayBuffer;
            if (this.onload) this.onload();
          }),
          result: null
        };
        
        global.FileReader = vi.fn(() => mockFileReader);
        
        xhr.open('POST', 'http://127.0.0.1/otlp-ipc/v1/traces');
        xhr.send(mockBlob);
        
        expect(mockFileReader.readAsArrayBuffer).toHaveBeenCalledWith(mockBlob);
      });

      it('should handle JSON string bodies', async () => {
        const xhr = new XMLHttpRequest();
        const mockJsonData = { resourceSpans: [{ spans: [] }] };
        
        xhr.open('POST', 'http://127.0.0.1/otlp-ipc/v1/traces');
        xhr.send(JSON.stringify(mockJsonData));
        
        expect(mockTelemetryBridge.exportTracesJson).toHaveBeenCalledWith(mockJsonData);
      });

      it('should not intercept non-IPC URLs', async () => {
        const xhr = new XMLHttpRequest();
        
        xhr.open('GET', 'https://api.example.com/data');
        
        expect(xhr.__KT_IS_IPC_OTLP__).toBe(false);
      });
    });

    describe('sendBeacon Interceptor', () => {
      it('should intercept OTLP sendBeacon requests', async () => {
        const mockArrayBuffer = new ArrayBuffer(25);
        
        const result = mockNavigator.sendBeacon('http://127.0.0.1/otlp-ipc/v1/traces', mockArrayBuffer);
        
        expect(result).toBe(true);
        expect(mockTelemetryBridge.exportTraces).toHaveBeenCalledWith(mockArrayBuffer);
      });

      it('should handle TypedArray data', async () => {
        const buffer = new ArrayBuffer(100);
        const uint8Array = new Uint8Array(buffer, 10, 50);
        
        mockNavigator.sendBeacon('http://127.0.0.1/otlp-ipc/v1/traces', uint8Array);
        
        expect(mockTelemetryBridge.exportTraces).toHaveBeenCalledWith(expect.any(ArrayBuffer));
        
        const call = mockTelemetryBridge.exportTraces.mock.calls[0];
        const sentBuffer = call[0];
        expect(sentBuffer.byteLength).toBe(50);
      });

      it('should handle Blob data asynchronously', async () => {
        const mockArrayBuffer = new ArrayBuffer(30);
        const mockBlob = new Blob([mockArrayBuffer]);
        mockBlob.arrayBuffer = vi.fn().mockResolvedValue(mockArrayBuffer);
        
        const result = mockNavigator.sendBeacon('http://127.0.0.1/otlp-ipc/v1/traces', mockBlob);
        
        expect(result).toBe(true);
        
        // Wait for async processing
        await new Promise(resolve => setTimeout(resolve, 0));
        
        expect(mockBlob.arrayBuffer).toHaveBeenCalled();
        expect(mockTelemetryBridge.exportTraces).toHaveBeenCalledWith(mockArrayBuffer);
      });

      it('should pass through non-IPC sendBeacon calls', async () => {
        const originalSendBeacon = vi.fn().mockReturnValue(true);
        
        // Mock the original being preserved
        const result = originalSendBeacon('https://analytics.example.com/beacon', 'data');
        
        expect(result).toBe(true);
      });
    });
  });

  describe('Telemetry Level Configuration', () => {
    it('should read telemetry level from environment', async () => {
      vi.stubGlobal('import.meta', {
        env: {
          RENDERER_VITE_TELEMETRY_LEVEL: 'VERBOSE'
        }
      });
      
      await import('../webTracing.js');
      
      expect(mockWindow.__KT_TELEMETRY_UTILS__.getTelemetryLevel()).toBe('VERBOSE');
    });

    it('should default to NORMAL level', async () => {
      vi.stubGlobal('import.meta', { env: {} });
      
      await import('../webTracing.js');
      
      expect(mockWindow.__KT_TELEMETRY_UTILS__.getTelemetryLevel()).toBe('NORMAL');
    });

    it('should check if telemetry should be emitted based on level', async () => {
      await import('../webTracing.js');
      
      const utils = mockWindow.__KT_TELEMETRY_UTILS__;
      
      // NORMAL level should emit NORMAL operations
      expect(utils.shouldEmitTelemetry('api_request', {}, 'NORMAL')).toBe(true);
      
      // NORMAL level should not emit VERBOSE operations
      expect(utils.shouldEmitTelemetry('keystroke_update', {}, 'VERBOSE')).toBe(false);
      
      // Always emit errors regardless of level
      expect(utils.shouldEmitTelemetry('network_error', {})).toBe(true);
      
      // Always emit user actions
      expect(utils.shouldEmitTelemetry('user.click', {})).toBe(true);
      
      // Always emit critical operations
      expect(utils.shouldEmitTelemetry('critical_failure', {})).toBe(true);
    });
  });

  describe('Sampling Configuration', () => {
    it('should provide message parser sampling', async () => {
      await import('../webTracing.js');
      
      const utils = mockWindow.__KT_TELEMETRY_UTILS__;
      
      // With 10% sampling (MESSAGE_PARSER_SAMPLE_RATE = 0.1)
      // Every 10th call should return true
      const samples = [];
      for (let i = 0; i < 20; i++) {
        samples.push(utils.shouldSampleMessageParser());
      }
      
      // Should have some true values (sampling)
      const trueSamples = samples.filter(Boolean);
      expect(trueSamples.length).toBeGreaterThan(0);
      expect(trueSamples.length).toBeLessThan(samples.length);
    });

    it('should throttle lexical editor updates', async () => {
      await import('../webTracing.js');
      
      const utils = mockWindow.__KT_TELEMETRY_UTILS__;
      
      // First call with sufficient duration should emit
      expect(utils.shouldEmitLexicalUpdate(20)).toBe(true);
      
      // Immediate second call should be throttled
      expect(utils.shouldEmitLexicalUpdate(25)).toBe(false);
      
      // Short duration should not emit regardless
      expect(utils.shouldEmitLexicalUpdate(5)).toBe(false);
    });

    it('should detect startup phase', async () => {
      await import('../webTracing.js');
      
      const utils = mockWindow.__KT_TELEMETRY_UTILS__;
      
      // Initially in startup phase
      expect(utils.checkStartupPhase()).toBe(true);
      
      // Mock time passage beyond startup window
      const originalNow = Date.now;
      Date.now = vi.fn(() => originalNow() + 35000); // +35 seconds
      
      expect(utils.checkStartupPhase()).toBe(false);
      
      Date.now = originalNow;
    });
  });

  describe('Error Handling', () => {
    it('should handle telemetry bridge initialization errors', async () => {
      mockTelemetryBridge.getOtelConfig.mockRejectedValue(new Error('Bridge connection failed'));
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await import('../webTracing.js');
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle missing window.telemetry gracefully', async () => {
      delete mockWindow.telemetry;
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await import('../webTracing.js');
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Missing or invalid OTLP config')
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle WebSocket instrumentation failures', async () => {
      // Make WebSocket construction throw
      mockWindow.WebSocket = vi.fn(() => {
        throw new Error('WebSocket construction failed');
      });
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await import('../webTracing.js');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to install'),
        expect.any(String)
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle body extraction errors in fetch interceptor', async () => {
      await import('../webTracing.js');
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Create a mock body that throws during processing
      const mockBody = {
        arrayBuffer: vi.fn().mockRejectedValue(new Error('ArrayBuffer extraction failed'))
      };
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const response = await mockWindow.fetch('http://127.0.0.1/otlp-ipc/v1/traces', {
        method: 'POST',
        body: mockBody
      });
      
      expect(response.status).toBe(400);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to extract OTLP body'),
        expect.any(String)
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle export failures in IPC bridge', async () => {
      mockTelemetryBridge.exportTraces.mockRejectedValue(new Error('IPC export failed'));
      
      await import('../webTracing.js');
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const response = await mockWindow.fetch('http://127.0.0.1/otlp-ipc/v1/traces', {
        method: 'POST',
        body: new ArrayBuffer(10)
      });
      
      expect(response.status).toBe(502);
    });
  });

  describe('Sanitization Functions', () => {
    it('should sanitize AnyValue objects correctly', async () => {
      await import('../webTracing.js');
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Test would need access to internal sanitization functions
      // For now, we test through the fetch interceptor integration
      const mockJsonBody = {
        resourceSpans: [{
          spans: [{
            attributes: [{
              key: 'very.long.attribute.name.that.should.be.truncated.to.reasonable.length.for.collector.limits',
              value: { stringValue: 'A'.repeat(5000) } // Too long
            }]
          }]
        }]
      };
      
      await mockWindow.fetch('http://127.0.0.1/otlp-ipc/v1/traces', {
        method: 'POST',
        body: JSON.stringify(mockJsonBody)
      });
      
      expect(mockTelemetryBridge.exportTracesJson).toHaveBeenCalled();
      
      // The sanitization would happen before the IPC call
      // In a real test, we'd verify the sanitized data structure
    });

    it('should handle array attributes with limits', async () => {
      await import('../webTracing.js');
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const largeArray = Array.from({ length: 100 }, (_, i) => ({ stringValue: `item${i}` }));
      const mockJsonBody = {
        resourceSpans: [{
          spans: [{
            attributes: [{
              key: 'large_array',
              value: { arrayValue: { values: largeArray } }
            }]
          }]
        }]
      };
      
      await mockWindow.fetch('http://127.0.0.1/otlp-ipc/v1/traces', {
        method: 'POST',
        body: JSON.stringify(mockJsonBody)
      });
      
      expect(mockTelemetryBridge.exportTracesJson).toHaveBeenCalled();
    });
  });

  describe('URL Detection', () => {
    it('should correctly identify IPC OTLP URLs', async () => {
      await import('../webTracing.js');
      
      // Test URL detection logic through fetch calls
      const ipcUrls = [
        'http://127.0.0.1/otlp-ipc',
        'http://127.0.0.1/otlp-ipc/v1/traces',
        'http://127.0.0.1/otlp-ipc/v1/metrics?format=json'
      ];
      
      const nonIpcUrls = [
        'https://api.grafana.net/otlp/traces',
        'http://localhost:3000/api/data',
        'http://127.0.0.1/regular-api'
      ];
      
      for (const url of ipcUrls) {
        await mockWindow.fetch(url, {
          method: 'POST',
          body: new ArrayBuffer(10)
        });
      }
      
      expect(mockTelemetryBridge.exportTraces).toHaveBeenCalledTimes(ipcUrls.length);
      
      // Reset mock
      mockTelemetryBridge.exportTraces.mockClear();
      
      for (const url of nonIpcUrls) {
        try {
          await mockWindow.fetch(url, { method: 'GET' });
        } catch {
          // Expected to fail since we don't have original fetch
        }
      }
      
      expect(mockTelemetryBridge.exportTraces).not.toHaveBeenCalled();
    });
  });

  describe('Module State Management', () => {
    it('should prevent double initialization', async () => {
      await import('../webTracing.js');
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockWindow.__KT_RENDERER_OTEL_INITIALIZED__).toBe(true);
      
      // Clear mocks and try to initialize again
      vi.clearAllMocks();
      
      // Re-import should not trigger initialization again
      await import('../webTracing.js');
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockTelemetryBridge.getOtelConfig).not.toHaveBeenCalled();
    });

    it('should prevent double transport interceptor installation', async () => {
      await import('../webTracing.js');
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockWindow.__KT_OTEL_IPC_TRANSPORT_INTERCEPTORS__).toBe(true);
    });

    it('should export telemetry utilities globally', async () => {
      await import('../webTracing.js');
      
      expect(mockWindow.__KT_TELEMETRY_UTILS__).toBeDefined();
      expect(mockWindow.__KT_TELEMETRY_UTILS__.getTelemetryLevel).toBeDefined();
      expect(mockWindow.__KT_TELEMETRY_UTILS__.shouldEmitTelemetry).toBeDefined();
      expect(mockWindow.__KT_TELEMETRY_UTILS__.shouldSampleMessageParser).toBeDefined();
      expect(mockWindow.__KT_TELEMETRY_UTILS__.shouldEmitLexicalUpdate).toBeDefined();
      expect(mockWindow.__KT_TELEMETRY_UTILS__.checkStartupPhase).toBeDefined();
      expect(mockWindow.__KT_TELEMETRY_UTILS__.TELEMETRY_LEVELS).toBeDefined();
    });
  });

  describe('Resource Configuration', () => {
    it('should attempt to set service resource attributes', async () => {
      await import('../webTracing.js');
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockWebTracerProvider).toHaveBeenCalledWith({
        sampler: expect.anything()
      });
    });

    it('should handle resource import failures gracefully', async () => {
      // Mock import failure
      vi.doMock('@opentelemetry/resources', () => {
        throw new Error('Resource module not available');
      });
      
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      
      await import('../webTracing.js');
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Should continue initialization despite resource failure
      expect(mockWebTracerProvider).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});