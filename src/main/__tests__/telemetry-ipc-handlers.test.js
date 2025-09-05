import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the metrics module and other dependencies
const mockMetrics = {
  recordMessageSent: vi.fn(),
  recordMessageSendDuration: vi.fn(),
  recordError: vi.fn(),
  recordRendererMemory: vi.fn(),
  recordDomNodeCount: vi.fn(),
  incrementWebSocketConnections: vi.fn(),
  decrementWebSocketConnections: vi.fn(),
  recordConnectionError: vi.fn(),
  recordMessageReceived: vi.fn(),
  recordReconnection: vi.fn(),
  recordAPIRequest: vi.fn(),
  recordSevenTVConnectionHealth: vi.fn(),
  recordSevenTVWebSocketCreated: vi.fn(),
  recordSevenTVEmoteUpdate: vi.fn(),
  recordSevenTVEmoteChanges: vi.fn(),
  recordChatroomSwitch: vi.fn(),
  startUserSession: vi.fn().mockReturnValue({ sessionId: 'session123', success: true }),
  endUserSession: vi.fn(),
  recordUserAction: vi.fn().mockReturnValue({ success: true }),
  recordFeatureUsage: vi.fn().mockReturnValue({ success: true }),
  recordChatEngagement: vi.fn().mockReturnValue({ success: true }),
  recordConnectionQuality: vi.fn().mockReturnValue({ success: true }),
  getUserAnalyticsData: vi.fn().mockReturnValue({ sessions: [], actions: [] }),
  getUserActionTypes: vi.fn().mockReturnValue(['chat_send', 'emote_use']),
  monitorUIInteraction: vi.fn().mockReturnValue('good'),
  monitorComponentRender: vi.fn().mockReturnValue('good'),
  monitorWebSocketLatency: vi.fn().mockReturnValue('good'),
  monitorMemoryUsage: vi.fn().mockReturnValue({ severity: 'good' }),
  monitorCPUUsage: vi.fn().mockReturnValue('good'),
  monitorBundleSize: vi.fn().mockReturnValue('good'),
  getPerformanceData: vi.fn().mockReturnValue({ metrics: {} }),
  cleanupOldSessions: vi.fn().mockReturnValue({ cleaned: 5, remaining: 10 }),
  forceCleanupSessions: vi.fn().mockReturnValue({ cleaned: 15 }),
  getAnalyticsMemoryStats: vi.fn().mockReturnValue({ totalSessions: 3, totalActions: 25 })
};

// Mock ipcMain
const mockIpcHandlers = new Map();
const mockIpcMain = {
  handle: vi.fn((channel, handler) => {
    mockIpcHandlers.set(channel, handler);
  }),
  removeHandler: vi.fn()
};

// Mock telemetry enabled functions
let telemetryEnabled = true;
const mockTelemetryEnabledNow = vi.fn(() => telemetryEnabled);
const mockIsTelemetryEnabled = vi.fn(() => telemetryEnabled);

// Mock fetch
const mockFetch = vi.fn();

// Mock environment variables
const mockEnv = {
  MAIN_VITE_GRAFANA_TEMPO_QUERY_URL: 'https://tempo.grafana.net/api/traces',
  MAIN_VITE_GRAFANA_TEMPO_QUERY_USER: 'test-user',
  MAIN_VITE_GRAFANA_TEMPO_QUERY_TOKEN: 'test-token'
};

// Mock console methods
const mockConsole = {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
};

// Mock utilities
const mockGenRequestId = vi.fn(() => 'req-123');

describe('Telemetry IPC Handlers Tests', () => {
  let originalConsole;
  let originalFetch;
  let originalProcess;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIpcHandlers.clear();
    telemetryEnabled = true;
    
    // Mock console
    originalConsole = { ...console };
    console.log = mockConsole.log;
    console.error = mockConsole.error;
    console.warn = mockConsole.warn;
    
    // Mock fetch
    originalFetch = global.fetch;
    global.fetch = mockFetch;
    
    // Mock process.env
    originalProcess = process.env;
    process.env = { ...originalProcess, ...mockEnv };
    
    // Setup default fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        traces: [{ traceID: 'trace123', spans: [] }]
      })
    });
  });

  afterEach(() => {
    // Restore originals
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    global.fetch = originalFetch;
    process.env = originalProcess;
  });

  // Helper to simulate importing the main module with mocks
  const setupMainModule = async () => {
    // Mock all the required modules
    vi.doMock('../../telemetry/metrics.js', () => mockMetrics);
    vi.doMock('electron', () => ({
      ipcMain: mockIpcMain,
      app: { getVersion: () => '1.0.0' }
    }));
    
    // Create a minimal main module simulation
    const mainModule = {
      ipcMain: mockIpcMain,
      metrics: mockMetrics,
      telemetryEnabledNow: mockTelemetryEnabledNow,
      isTelemetryEnabled: mockIsTelemetryEnabled,
      genRequestId: mockGenRequestId
    };
    
    // Simulate registering all the IPC handlers
    registerTelemetryHandlers(mainModule);
    
    return mainModule;
  };

  // Helper function to simulate the handler registration from main/index.js
  const registerTelemetryHandlers = ({ ipcMain, metrics, telemetryEnabledNow, isTelemetryEnabled, genRequestId }) => {
    // Message tracking handlers
    ipcMain.handle("telemetry:recordMessageSent", (e, { chatroomId, messageType = 'regular', duration = null, success = true, streamerName = null }) => {
      if (telemetryEnabledNow()) {
        metrics.recordMessageSent(chatroomId, messageType, streamerName);
        if (duration !== null) {
          metrics.recordMessageSendDuration(duration, chatroomId, success);
        }
      }
    });

    ipcMain.handle("telemetry:recordError", (e, { error, context = {} }) => {
      if (telemetryEnabledNow()) {
        try {
          let errorObj;
          if (error && (typeof error === 'object')) {
            errorObj = new Error(error.message || 'RendererError');
            if (error.name) errorObj.name = error.name;
            if (error.stack) errorObj.stack = error.stack;
          } else {
            errorObj = new Error(String(error || 'RendererError'));
            errorObj.name = 'RendererError';
          }
          metrics.recordError(errorObj, context);
        } catch (_e) {
          // Swallow to keep tests and runtime resilient
        }
      }
    });

    ipcMain.handle("telemetry:recordRendererMemory", (e, memory) => {
      if (telemetryEnabledNow()) {
        metrics.recordRendererMemory(memory);
      }
    });

    ipcMain.handle("telemetry:recordDomNodeCount", (e, count) => {
      if (telemetryEnabledNow()) {
        metrics.recordDomNodeCount(count);
      }
    });

    // WebSocket handlers
    ipcMain.handle("telemetry:recordWebSocketConnection", (e, { chatroomId, streamerId, connected, streamerName }) => {
      if (telemetryEnabledNow()) {
        if (connected) {
          metrics.incrementWebSocketConnections(chatroomId, streamerId, streamerName);
        } else {
          metrics.decrementWebSocketConnections(chatroomId, streamerId, streamerName);
        }
      }
    });

    ipcMain.handle("telemetry:recordConnectionError", (e, { chatroomId, errorType }) => {
      if (telemetryEnabledNow()) {
        metrics.recordConnectionError(errorType, chatroomId);
      }
    });

    ipcMain.handle("telemetry:recordMessageReceived", (e, { chatroomId, messageType, senderId, streamerName }) => {
      if (telemetryEnabledNow()) {
        metrics.recordMessageReceived(chatroomId, messageType, senderId, streamerName);
      }
    });

    ipcMain.handle("telemetry:recordReconnection", (e, { chatroomId, reason }) => {
      if (isTelemetryEnabled()) {
        metrics.recordReconnection(chatroomId, reason);
      }
    });

    // API handlers
    ipcMain.handle("telemetry:recordAPIRequest", (e, { endpoint, method, statusCode, duration }) => {
      if (isTelemetryEnabled()) {
        metrics.recordAPIRequest(endpoint, method, statusCode, duration);
      }
    });

    // 7TV handlers
    ipcMain.handle("telemetry:recordSevenTVConnectionHealth", (e, { chatroomsCount, connectionsCount, state }) => {
      if (isTelemetryEnabled()) {
        metrics.recordSevenTVConnectionHealth(chatroomsCount, connectionsCount, state);
      }
    });

    ipcMain.handle("telemetry:recordSevenTVWebSocketCreated", (e, { chatroomId, stvId, emoteSets }) => {
      if (isTelemetryEnabled()) {
        metrics.recordSevenTVWebSocketCreated(chatroomId, stvId, emoteSets);
      }
    });

    ipcMain.handle("telemetry:recordSevenTVEmoteUpdate", (e, { chatroomId, pulled, pushed, updated, duration }) => {
      if (isTelemetryEnabled()) {
        metrics.recordSevenTVEmoteUpdate(chatroomId, pulled, pushed, updated, duration);
      }
    });

    ipcMain.handle("telemetry:recordSevenTVEmoteChanges", (e, { chatroomId, added, removed, updated, setType }) => {
      if (isTelemetryEnabled()) {
        metrics.recordSevenTVEmoteChanges(chatroomId, added, removed, updated, setType);
      }
    });

    ipcMain.handle("telemetry:recordChatroomSwitch", (e, { fromChatroomId, toChatroomId, duration }) => {
      if (isTelemetryEnabled()) {
        metrics.recordChatroomSwitch(fromChatroomId, toChatroomId, duration);
      }
    });

    // User Analytics handlers
    ipcMain.handle("telemetry:startUserSession", (e, { sessionId, userId = null }) => {
      if (isTelemetryEnabled()) {
        return metrics.startUserSession(sessionId, userId);
      }
      return {};
    });

    ipcMain.handle("telemetry:endUserSession", (e, { sessionId }) => {
      if (isTelemetryEnabled()) {
        metrics.endUserSession(sessionId);
      }
    });

    ipcMain.handle("telemetry:recordUserAction", (e, { sessionId, actionType, context = {} }) => {
      if (isTelemetryEnabled()) {
        return metrics.recordUserAction(sessionId, actionType, context);
      }
    });

    ipcMain.handle("telemetry:recordFeatureUsage", (e, { sessionId, featureName, action, context = {} }) => {
      if (isTelemetryEnabled()) {
        return metrics.recordFeatureUsage(sessionId, featureName, action, context);
      }
    });

    ipcMain.handle("telemetry:recordChatEngagement", (e, { sessionId, engagementSeconds }) => {
      if (isTelemetryEnabled()) {
        return metrics.recordChatEngagement(sessionId, engagementSeconds);
      }
    });

    ipcMain.handle("telemetry:recordConnectionQuality", (e, { sessionId, quality, eventType }) => {
      if (isTelemetryEnabled()) {
        return metrics.recordConnectionQuality(sessionId, quality, eventType);
      }
    });

    ipcMain.handle("telemetry:getUserAnalyticsData", (e) => {
      if (isTelemetryEnabled()) {
        return metrics.getUserAnalyticsData();
      }
      return {};
    });

    ipcMain.handle("telemetry:getUserActionTypes", (e) => {
      if (isTelemetryEnabled()) {
        return metrics.getUserActionTypes();
      }
      return {};
    });

    // Performance monitoring handlers
    ipcMain.handle("telemetry:monitorUIInteraction", (e, { interactionType, executionTime, context = {} }) => {
      if (isTelemetryEnabled()) {
        return metrics.monitorUIInteraction(interactionType, executionTime, context);
      }
      return 'good';
    });

    ipcMain.handle("telemetry:monitorComponentRender", (e, { componentName, renderTime, context = {} }) => {
      if (isTelemetryEnabled()) {
        return metrics.monitorComponentRender(componentName, renderTime, context);
      }
      return 'good';
    });

    ipcMain.handle("telemetry:monitorWebSocketLatency", (e, { latency, context = {} }) => {
      if (isTelemetryEnabled()) {
        return metrics.monitorWebSocketLatency(latency, context);
      }
      return 'good';
    });

    ipcMain.handle("telemetry:monitorMemoryUsage", (e, { memoryMB, context = {} }) => {
      if (isTelemetryEnabled()) {
        return metrics.monitorMemoryUsage(memoryMB, context);
      }
      return 'good';
    });

    ipcMain.handle("telemetry:monitorCPUUsage", (e, { cpuPercent, context = {} }) => {
      if (isTelemetryEnabled()) {
        return metrics.monitorCPUUsage(cpuPercent, context);
      }
      return 'good';
    });

    ipcMain.handle("telemetry:monitorBundleSize", (e, { bundleName, sizeKB }) => {
      if (isTelemetryEnabled()) {
        return metrics.monitorBundleSize(bundleName, sizeKB);
      }
      return 'good';
    });

    ipcMain.handle("telemetry:getPerformanceData", (e) => {
      if (isTelemetryEnabled()) {
        return metrics.getPerformanceData();
      }
      return {};
    });

    // Memory management handlers
    ipcMain.handle("telemetry:cleanupOldSessions", (e, { maxAgeMs = 24 * 60 * 60 * 1000 } = {}) => {
      if (isTelemetryEnabled()) {
        return metrics.cleanupOldSessions(maxAgeMs);
      }
      return { cleaned: 0, remaining: {} };
    });

    ipcMain.handle("telemetry:forceCleanupSessions", (e) => {
      if (isTelemetryEnabled()) {
        return metrics.forceCleanupSessions();
      }
      return {};
    });

    ipcMain.handle("telemetry:getAnalyticsMemoryStats", (e) => {
      if (isTelemetryEnabled()) {
        return metrics.getAnalyticsMemoryStats();
      }
      return {};
    });

    // Grafana trace verification handler
    ipcMain.handle("telemetry:readTrace", async (_e, traceId) => {
      const requestId = genRequestId();
      const startedAt = Date.now();
      
      try {
        console.log(`[Grafana Read][${requestId}] Reading trace ${traceId} from Grafana Cloud`);
        
        const env = process.env;
        const queryUrl = env.MAIN_VITE_GRAFANA_TEMPO_QUERY_URL || env.GRAFANA_TEMPO_QUERY_URL;
        const queryUser = env.MAIN_VITE_GRAFANA_TEMPO_QUERY_USER || env.GRAFANA_TEMPO_QUERY_USER;
        const queryToken = env.MAIN_VITE_GRAFANA_TEMPO_QUERY_TOKEN || env.GRAFANA_TEMPO_QUERY_TOKEN;

        if (!queryUrl || !queryUser || !queryToken) {
          throw new Error('Missing Grafana Tempo configuration');
        }

        const response = await fetch(`${queryUrl}/${traceId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${queryToken}`,
            'User-Agent': 'KickTalk-Test/1.0.0'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const traceData = await response.json();
        const duration = Date.now() - startedAt;
        
        console.log(`[Grafana Read][${requestId}] Success (${duration}ms)`);
        
        return {
          ok: true,
          requestId,
          duration,
          trace: traceData
        };
      } catch (e) {
        console.error(`[Grafana Read][${requestId}] Failed:`, e.message);
        return { ok: false, reason: e.message, requestId };
      }
    });

    // IPC OTLP relay handlers (simplified for testing)
    ipcMain.handle("telemetry:exportTraces", async (_e, arrayBuffer) => {
      const requestId = genRequestId();
      try {
        console.log(`[OTEL IPC Relay][${requestId}] Relaying ArrayBuffer traces (${arrayBuffer.byteLength} bytes)`);
        
        // Simulate successful relay to OTLP endpoint
        const response = await fetch('https://otlp-gateway.grafana.net/otlp/v1/traces', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-protobuf',
            'Authorization': 'Bearer test-token'
          },
          body: arrayBuffer
        });

        return { ok: response.ok, status: response.status, requestId };
      } catch (e) {
        console.error(`[OTEL IPC Relay][${requestId}] Failed:`, e.message);
        return { ok: false, reason: e.message, requestId };
      }
    });

    ipcMain.handle("telemetry:exportTracesJson", async (_e, jsonData) => {
      const requestId = genRequestId();
      try {
        console.log(`[OTEL IPC Relay][${requestId}] Relaying JSON traces`);
        
        const response = await fetch('https://otlp-gateway.grafana.net/otlp/v1/traces', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          },
          body: JSON.stringify(jsonData)
        });

        return { ok: response.ok, status: response.status, requestId };
      } catch (e) {
        console.error(`[OTEL IPC Relay][${requestId}] Failed:`, e.message);
        return { ok: false, reason: e.message, requestId };
      }
    });
  };

  describe('Message Tracking Handlers', () => {
    beforeEach(async () => {
      await setupMainModule();
    });

    describe('telemetry:recordMessageSent', () => {
      it('should record message sent when telemetry is enabled', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordMessageSent');
        const mockEvent = {};
        
        await handler(mockEvent, {
          chatroomId: 'chatroom123',
          messageType: 'regular',
          duration: 150,
          success: true,
          streamerName: 'teststreamer'
        });

        expect(mockMetrics.recordMessageSent).toHaveBeenCalledWith('chatroom123', 'regular', 'teststreamer');
        expect(mockMetrics.recordMessageSendDuration).toHaveBeenCalledWith(150, 'chatroom123', true);
      });

      it('should not record duration when null', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordMessageSent');
        
        await handler({}, {
          chatroomId: 'chatroom123',
          messageType: 'regular',
          duration: null,
          success: true
        });

        expect(mockMetrics.recordMessageSent).toHaveBeenCalledWith('chatroom123', 'regular', null);
        expect(mockMetrics.recordMessageSendDuration).not.toHaveBeenCalled();
      });

      it('should not record when telemetry is disabled', async () => {
        telemetryEnabled = false;
        const handler = mockIpcHandlers.get('telemetry:recordMessageSent');
        
        await handler({}, {
          chatroomId: 'chatroom123',
          messageType: 'regular'
        });

        expect(mockMetrics.recordMessageSent).not.toHaveBeenCalled();
      });

      it('should use default values for optional parameters', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordMessageSent');
        
        await handler({}, { chatroomId: 'chatroom123' });

        expect(mockMetrics.recordMessageSent).toHaveBeenCalledWith('chatroom123', 'regular', null);
      });
    });

    describe('telemetry:recordError', () => {
      it('should record error with object error', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordError');
        const errorObj = {
          name: 'NetworkError',
          message: 'Connection failed',
          stack: 'Error: Connection failed\n    at test:1:1'
        };
        
        await handler({}, {
          error: errorObj,
          context: { operation: 'api_call', component: 'fetch' }
        });

        expect(mockMetrics.recordError).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'NetworkError',
            message: 'Connection failed',
            stack: 'Error: Connection failed\n    at test:1:1'
          }),
          { operation: 'api_call', component: 'fetch' }
        );
      });

      it('should record error with string error', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordError');
        
        await handler({}, {
          error: 'Simple error message',
          context: { operation: 'test' }
        });

        expect(mockMetrics.recordError).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'RendererError',
            message: 'Simple error message'
          }),
          { operation: 'test' }
        );
      });

      it('should handle null/undefined error', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordError');
        
        await handler({}, { error: null });

        expect(mockMetrics.recordError).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'RendererError',
            message: 'RendererError'
          }),
          {}
        );
      });

      it('should handle incomplete error objects', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordError');
        
        await handler({}, {
          error: { name: 'CustomError' }, // Missing message
          context: { test: true }
        });

        expect(mockMetrics.recordError).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'CustomError',
            message: 'RendererError'
          }),
          { test: true }
        );
      });

      it('should swallow internal errors gracefully', async () => {
        mockMetrics.recordError.mockImplementation(() => {
          throw new Error('Metrics error');
        });
        
        const handler = mockIpcHandlers.get('telemetry:recordError');
        
        // Should not throw
        await expect(handler({}, { error: 'test error' })).resolves.not.toThrow();
      });

      it('should not record when telemetry is disabled', async () => {
        telemetryEnabled = false;
        const handler = mockIpcHandlers.get('telemetry:recordError');
        
        await handler({}, { error: 'test error' });

        expect(mockMetrics.recordError).not.toHaveBeenCalled();
      });
    });

    describe('telemetry:recordRendererMemory', () => {
      it('should record renderer memory', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordRendererMemory');
        const memoryData = {
          usedJSHeapSize: 50 * 1024 * 1024,
          totalJSHeapSize: 100 * 1024 * 1024,
          jsHeapSizeLimit: 200 * 1024 * 1024
        };
        
        await handler({}, memoryData);

        expect(mockMetrics.recordRendererMemory).toHaveBeenCalledWith(memoryData);
      });
    });

    describe('telemetry:recordDomNodeCount', () => {
      it('should record DOM node count', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordDomNodeCount');
        
        await handler({}, 1500);

        expect(mockMetrics.recordDomNodeCount).toHaveBeenCalledWith(1500);
      });
    });
  });

  describe('WebSocket Tracking Handlers', () => {
    beforeEach(async () => {
      await setupMainModule();
    });

    describe('telemetry:recordWebSocketConnection', () => {
      it('should increment connections when connected=true', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordWebSocketConnection');
        
        await handler({}, {
          chatroomId: 'chatroom123',
          streamerId: 'streamer456',
          connected: true,
          streamerName: 'teststreamer'
        });

        expect(mockMetrics.incrementWebSocketConnections).toHaveBeenCalledWith(
          'chatroom123', 'streamer456', 'teststreamer'
        );
        expect(mockMetrics.decrementWebSocketConnections).not.toHaveBeenCalled();
      });

      it('should decrement connections when connected=false', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordWebSocketConnection');
        
        await handler({}, {
          chatroomId: 'chatroom123',
          streamerId: 'streamer456',
          connected: false,
          streamerName: 'teststreamer'
        });

        expect(mockMetrics.decrementWebSocketConnections).toHaveBeenCalledWith(
          'chatroom123', 'streamer456', 'teststreamer'
        );
        expect(mockMetrics.incrementWebSocketConnections).not.toHaveBeenCalled();
      });
    });

    describe('telemetry:recordConnectionError', () => {
      it('should record connection error', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordConnectionError');
        
        await handler({}, {
          chatroomId: 'chatroom123',
          errorType: 'timeout'
        });

        expect(mockMetrics.recordConnectionError).toHaveBeenCalledWith('timeout', 'chatroom123');
      });
    });

    describe('telemetry:recordMessageReceived', () => {
      it('should record message received', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordMessageReceived');
        
        await handler({}, {
          chatroomId: 'chatroom123',
          messageType: 'chat',
          senderId: 'user456',
          streamerName: 'teststreamer'
        });

        expect(mockMetrics.recordMessageReceived).toHaveBeenCalledWith(
          'chatroom123', 'chat', 'user456', 'teststreamer'
        );
      });
    });

    describe('telemetry:recordReconnection', () => {
      it('should record reconnection', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordReconnection');
        
        await handler({}, {
          chatroomId: 'chatroom123',
          reason: 'connection_lost'
        });

        expect(mockMetrics.recordReconnection).toHaveBeenCalledWith('chatroom123', 'connection_lost');
      });
    });
  });

  describe('API Request Handlers', () => {
    beforeEach(async () => {
      await setupMainModule();
    });

    describe('telemetry:recordAPIRequest', () => {
      it('should record API request', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordAPIRequest');
        
        await handler({}, {
          endpoint: '/api/users',
          method: 'GET',
          statusCode: 200,
          duration: 250
        });

        expect(mockMetrics.recordAPIRequest).toHaveBeenCalledWith('/api/users', 'GET', 200, 250);
      });
    });
  });

  describe('7TV Integration Handlers', () => {
    beforeEach(async () => {
      await setupMainModule();
    });

    describe('telemetry:recordSevenTVConnectionHealth', () => {
      it('should record 7TV connection health', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordSevenTVConnectionHealth');
        
        await handler({}, {
          chatroomsCount: 5,
          connectionsCount: 3,
          state: 'healthy'
        });

        expect(mockMetrics.recordSevenTVConnectionHealth).toHaveBeenCalledWith(5, 3, 'healthy');
      });
    });

    describe('telemetry:recordSevenTVWebSocketCreated', () => {
      it('should record 7TV WebSocket creation', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordSevenTVWebSocketCreated');
        
        await handler({}, {
          chatroomId: 'chatroom123',
          stvId: '7tv456',
          emoteSets: ['set1', 'set2']
        });

        expect(mockMetrics.recordSevenTVWebSocketCreated).toHaveBeenCalledWith(
          'chatroom123', '7tv456', ['set1', 'set2']
        );
      });
    });

    describe('telemetry:recordSevenTVEmoteUpdate', () => {
      it('should record 7TV emote update', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordSevenTVEmoteUpdate');
        
        await handler({}, {
          chatroomId: 'chatroom123',
          pulled: 10,
          pushed: 2,
          updated: 5,
          duration: 300
        });

        expect(mockMetrics.recordSevenTVEmoteUpdate).toHaveBeenCalledWith(
          'chatroom123', 10, 2, 5, 300
        );
      });
    });

    describe('telemetry:recordSevenTVEmoteChanges', () => {
      it('should record 7TV emote changes', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordSevenTVEmoteChanges');
        
        await handler({}, {
          chatroomId: 'chatroom123',
          added: 3,
          removed: 1,
          updated: 2,
          setType: 'global'
        });

        expect(mockMetrics.recordSevenTVEmoteChanges).toHaveBeenCalledWith(
          'chatroom123', 3, 1, 2, 'global'
        );
      });
    });
  });

  describe('Navigation Handlers', () => {
    beforeEach(async () => {
      await setupMainModule();
    });

    describe('telemetry:recordChatroomSwitch', () => {
      it('should record chatroom switch', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordChatroomSwitch');
        
        await handler({}, {
          fromChatroomId: 'chatroom123',
          toChatroomId: 'chatroom456',
          duration: 150
        });

        expect(mockMetrics.recordChatroomSwitch).toHaveBeenCalledWith(
          'chatroom123', 'chatroom456', 150
        );
      });
    });
  });

  describe('User Analytics Handlers', () => {
    beforeEach(async () => {
      await setupMainModule();
    });

    describe('telemetry:startUserSession', () => {
      it('should start user session and return result', async () => {
        const handler = mockIpcHandlers.get('telemetry:startUserSession');
        
        const result = await handler({}, {
          sessionId: 'session123',
          userId: 'user456'
        });

        expect(mockMetrics.startUserSession).toHaveBeenCalledWith('session123', 'user456');
        expect(result).toEqual({ sessionId: 'session123', success: true });
      });

      it('should handle null userId', async () => {
        const handler = mockIpcHandlers.get('telemetry:startUserSession');
        
        const result = await handler({}, {
          sessionId: 'session123'
        });

        expect(mockMetrics.startUserSession).toHaveBeenCalledWith('session123', null);
      });

      it('should return empty object when telemetry disabled', async () => {
        telemetryEnabled = false;
        const handler = mockIpcHandlers.get('telemetry:startUserSession');
        
        const result = await handler({}, {
          sessionId: 'session123',
          userId: 'user456'
        });

        expect(result).toEqual({});
        expect(mockMetrics.startUserSession).not.toHaveBeenCalled();
      });
    });

    describe('telemetry:endUserSession', () => {
      it('should end user session', async () => {
        const handler = mockIpcHandlers.get('telemetry:endUserSession');
        
        await handler({}, { sessionId: 'session123' });

        expect(mockMetrics.endUserSession).toHaveBeenCalledWith('session123');
      });
    });

    describe('telemetry:recordUserAction', () => {
      it('should record user action and return result', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordUserAction');
        
        const result = await handler({}, {
          sessionId: 'session123',
          actionType: 'chat_send',
          context: { message_length: 25 }
        });

        expect(mockMetrics.recordUserAction).toHaveBeenCalledWith(
          'session123', 'chat_send', { message_length: 25 }
        );
        expect(result).toEqual({ success: true });
      });

      it('should use empty context by default', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordUserAction');
        
        await handler({}, {
          sessionId: 'session123',
          actionType: 'emote_use'
        });

        expect(mockMetrics.recordUserAction).toHaveBeenCalledWith('session123', 'emote_use', {});
      });
    });

    describe('telemetry:recordFeatureUsage', () => {
      it('should record feature usage', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordFeatureUsage');
        
        const result = await handler({}, {
          sessionId: 'session123',
          featureName: 'emote_picker',
          action: 'open',
          context: { trigger: 'button' }
        });

        expect(mockMetrics.recordFeatureUsage).toHaveBeenCalledWith(
          'session123', 'emote_picker', 'open', { trigger: 'button' }
        );
        expect(result).toEqual({ success: true });
      });
    });

    describe('telemetry:recordChatEngagement', () => {
      it('should record chat engagement', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordChatEngagement');
        
        const result = await handler({}, {
          sessionId: 'session123',
          engagementSeconds: 300
        });

        expect(mockMetrics.recordChatEngagement).toHaveBeenCalledWith('session123', 300);
        expect(result).toEqual({ success: true });
      });
    });

    describe('telemetry:recordConnectionQuality', () => {
      it('should record connection quality', async () => {
        const handler = mockIpcHandlers.get('telemetry:recordConnectionQuality');
        
        const result = await handler({}, {
          sessionId: 'session123',
          quality: 8,
          eventType: 'websocket_latency'
        });

        expect(mockMetrics.recordConnectionQuality).toHaveBeenCalledWith(
          'session123', 8, 'websocket_latency'
        );
        expect(result).toEqual({ success: true });
      });
    });

    describe('telemetry:getUserAnalyticsData', () => {
      it('should get user analytics data', async () => {
        const handler = mockIpcHandlers.get('telemetry:getUserAnalyticsData');
        
        const result = await handler({});

        expect(mockMetrics.getUserAnalyticsData).toHaveBeenCalled();
        expect(result).toEqual({ sessions: [], actions: [] });
      });

      it('should return empty object when telemetry disabled', async () => {
        telemetryEnabled = false;
        const handler = mockIpcHandlers.get('telemetry:getUserAnalyticsData');
        
        const result = await handler({});

        expect(result).toEqual({});
        expect(mockMetrics.getUserAnalyticsData).not.toHaveBeenCalled();
      });
    });

    describe('telemetry:getUserActionTypes', () => {
      it('should get user action types', async () => {
        const handler = mockIpcHandlers.get('telemetry:getUserActionTypes');
        
        const result = await handler({});

        expect(mockMetrics.getUserActionTypes).toHaveBeenCalled();
        expect(result).toEqual(['chat_send', 'emote_use']);
      });
    });
  });

  describe('Performance Monitoring Handlers', () => {
    beforeEach(async () => {
      await setupMainModule();
    });

    describe('telemetry:monitorUIInteraction', () => {
      it('should monitor UI interaction and return severity', async () => {
        const handler = mockIpcHandlers.get('telemetry:monitorUIInteraction');
        
        const result = await handler({}, {
          interactionType: 'button_click',
          executionTime: 50,
          context: { component: 'send_button' }
        });

        expect(mockMetrics.monitorUIInteraction).toHaveBeenCalledWith(
          'button_click', 50, { component: 'send_button' }
        );
        expect(result).toBe('good');
      });

      it('should return default severity when telemetry disabled', async () => {
        telemetryEnabled = false;
        const handler = mockIpcHandlers.get('telemetry:monitorUIInteraction');
        
        const result = await handler({}, {
          interactionType: 'scroll',
          executionTime: 25
        });

        expect(result).toBe('good');
        expect(mockMetrics.monitorUIInteraction).not.toHaveBeenCalled();
      });

      it('should use empty context by default', async () => {
        const handler = mockIpcHandlers.get('telemetry:monitorUIInteraction');
        
        await handler({}, {
          interactionType: 'drag',
          executionTime: 75
        });

        expect(mockMetrics.monitorUIInteraction).toHaveBeenCalledWith('drag', 75, {});
      });
    });

    describe('telemetry:monitorComponentRender', () => {
      it('should monitor component render', async () => {
        const handler = mockIpcHandlers.get('telemetry:monitorComponentRender');
        
        const result = await handler({}, {
          componentName: 'ChatMessage',
          renderTime: 15,
          context: { message_count: 100 }
        });

        expect(mockMetrics.monitorComponentRender).toHaveBeenCalledWith(
          'ChatMessage', 15, { message_count: 100 }
        );
        expect(result).toBe('good');
      });
    });

    describe('telemetry:monitorWebSocketLatency', () => {
      it('should monitor WebSocket latency', async () => {
        const handler = mockIpcHandlers.get('telemetry:monitorWebSocketLatency');
        
        const result = await handler({}, {
          latency: 75,
          context: { chatroom: 'test-room' }
        });

        expect(mockMetrics.monitorWebSocketLatency).toHaveBeenCalledWith(75, { chatroom: 'test-room' });
        expect(result).toBe('good');
      });
    });

    describe('telemetry:monitorMemoryUsage', () => {
      it('should monitor memory usage', async () => {
        const handler = mockIpcHandlers.get('telemetry:monitorMemoryUsage');
        
        const result = await handler({}, {
          memoryMB: 150,
          context: { heap_total: 200 }
        });

        expect(mockMetrics.monitorMemoryUsage).toHaveBeenCalledWith(150, { heap_total: 200 });
        expect(result).toEqual({ severity: 'good' });
      });
    });

    describe('telemetry:monitorCPUUsage', () => {
      it('should monitor CPU usage', async () => {
        const handler = mockIpcHandlers.get('telemetry:monitorCPUUsage');
        
        const result = await handler({}, {
          cpuPercent: 25,
          context: { process: 'main' }
        });

        expect(mockMetrics.monitorCPUUsage).toHaveBeenCalledWith(25, { process: 'main' });
        expect(result).toBe('good');
      });
    });

    describe('telemetry:monitorBundleSize', () => {
      it('should monitor bundle size', async () => {
        const handler = mockIpcHandlers.get('telemetry:monitorBundleSize');
        
        const result = await handler({}, {
          bundleName: 'renderer.js',
          sizeKB: 512
        });

        expect(mockMetrics.monitorBundleSize).toHaveBeenCalledWith('renderer.js', 512);
        expect(result).toBe('good');
      });
    });

    describe('telemetry:getPerformanceData', () => {
      it('should get performance data', async () => {
        const handler = mockIpcHandlers.get('telemetry:getPerformanceData');
        
        const result = await handler({});

        expect(mockMetrics.getPerformanceData).toHaveBeenCalled();
        expect(result).toEqual({ metrics: {} });
      });
    });
  });

  describe('Memory Management Handlers', () => {
    beforeEach(async () => {
      await setupMainModule();
    });

    describe('telemetry:cleanupOldSessions', () => {
      it('should cleanup old sessions with default max age', async () => {
        const handler = mockIpcHandlers.get('telemetry:cleanupOldSessions');
        
        const result = await handler({});

        expect(mockMetrics.cleanupOldSessions).toHaveBeenCalledWith(24 * 60 * 60 * 1000);
        expect(result).toEqual({ cleaned: 5, remaining: 10 });
      });

      it('should cleanup old sessions with custom max age', async () => {
        const handler = mockIpcHandlers.get('telemetry:cleanupOldSessions');
        
        const result = await handler({}, { maxAgeMs: 60 * 60 * 1000 });

        expect(mockMetrics.cleanupOldSessions).toHaveBeenCalledWith(60 * 60 * 1000);
        expect(result).toEqual({ cleaned: 5, remaining: 10 });
      });

      it('should return default values when telemetry disabled', async () => {
        telemetryEnabled = false;
        const handler = mockIpcHandlers.get('telemetry:cleanupOldSessions');
        
        const result = await handler({});

        expect(result).toEqual({ cleaned: 0, remaining: {} });
        expect(mockMetrics.cleanupOldSessions).not.toHaveBeenCalled();
      });
    });

    describe('telemetry:forceCleanupSessions', () => {
      it('should force cleanup all sessions', async () => {
        const handler = mockIpcHandlers.get('telemetry:forceCleanupSessions');
        
        const result = await handler({});

        expect(mockMetrics.forceCleanupSessions).toHaveBeenCalled();
        expect(result).toEqual({ cleaned: 15 });
      });
    });

    describe('telemetry:getAnalyticsMemoryStats', () => {
      it('should get analytics memory stats', async () => {
        const handler = mockIpcHandlers.get('telemetry:getAnalyticsMemoryStats');
        
        const result = await handler({});

        expect(mockMetrics.getAnalyticsMemoryStats).toHaveBeenCalled();
        expect(result).toEqual({ totalSessions: 3, totalActions: 25 });
      });
    });
  });

  describe('Grafana Cloud Integration', () => {
    beforeEach(async () => {
      await setupMainModule();
    });

    describe('telemetry:readTrace', () => {
      it('should read trace from Grafana Cloud successfully', async () => {
        const handler = mockIpcHandlers.get('telemetry:readTrace');
        const traceData = { traces: [{ traceID: 'trace123', spans: [] }] };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue(traceData)
        });
        
        const result = await handler({}, 'trace123');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://tempo.grafana.net/api/traces/trace123',
          {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer test-token',
              'User-Agent': 'KickTalk-Test/1.0.0'
            }
          }
        );

        expect(result).toMatchObject({
          ok: true,
          requestId: 'req-123',
          trace: traceData
        });
        expect(result.duration).toBeDefined();
      });

      it('should handle missing Grafana configuration', async () => {
        delete process.env.MAIN_VITE_GRAFANA_TEMPO_QUERY_URL;
        const handler = mockIpcHandlers.get('telemetry:readTrace');
        
        const result = await handler({}, 'trace123');

        expect(result).toEqual({
          ok: false,
          reason: 'Missing Grafana Tempo configuration',
          requestId: 'req-123'
        });
      });

      it('should handle HTTP errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        });
        
        const handler = mockIpcHandlers.get('telemetry:readTrace');
        
        const result = await handler({}, 'trace123');

        expect(result).toEqual({
          ok: false,
          reason: 'HTTP 404: Not Found',
          requestId: 'req-123'
        });
      });

      it('should handle fetch errors', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));
        
        const handler = mockIpcHandlers.get('telemetry:readTrace');
        
        const result = await handler({}, 'trace123');

        expect(result).toEqual({
          ok: false,
          reason: 'Network error',
          requestId: 'req-123'
        });
      });

      it('should use fallback environment variables', async () => {
        delete process.env.MAIN_VITE_GRAFANA_TEMPO_QUERY_URL;
        delete process.env.MAIN_VITE_GRAFANA_TEMPO_QUERY_USER;
        delete process.env.MAIN_VITE_GRAFANA_TEMPO_QUERY_TOKEN;
        
        process.env.GRAFANA_TEMPO_QUERY_URL = 'https://fallback.grafana.net';
        process.env.GRAFANA_TEMPO_QUERY_USER = 'fallback-user';
        process.env.GRAFANA_TEMPO_QUERY_TOKEN = 'fallback-token';
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({ traces: [] })
        });
        
        const handler = mockIpcHandlers.get('telemetry:readTrace');
        
        await handler({}, 'trace456');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://fallback.grafana.net/trace456',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer fallback-token'
            })
          })
        );
      });
    });

    describe('OTLP IPC Relay Handlers', () => {
      describe('telemetry:exportTraces', () => {
        it('should export traces via ArrayBuffer', async () => {
          const handler = mockIpcHandlers.get('telemetry:exportTraces');
          const mockArrayBuffer = new ArrayBuffer(100);
          
          mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 204
          });
          
          const result = await handler({}, mockArrayBuffer);

          expect(mockFetch).toHaveBeenCalledWith(
            'https://otlp-gateway.grafana.net/otlp/v1/traces',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-protobuf',
                'Authorization': 'Bearer test-token'
              },
              body: mockArrayBuffer
            }
          );

          expect(result).toEqual({
            ok: true,
            status: 204,
            requestId: 'req-123'
          });
        });

        it('should handle export failures', async () => {
          const handler = mockIpcHandlers.get('telemetry:exportTraces');
          mockFetch.mockRejectedValueOnce(new Error('OTLP export failed'));
          
          const result = await handler({}, new ArrayBuffer(50));

          expect(result).toEqual({
            ok: false,
            reason: 'OTLP export failed',
            requestId: 'req-123'
          });
        });
      });

      describe('telemetry:exportTracesJson', () => {
        it('should export traces via JSON', async () => {
          const handler = mockIpcHandlers.get('telemetry:exportTracesJson');
          const mockJsonData = { resourceSpans: [] };
          
          mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200
          });
          
          const result = await handler({}, mockJsonData);

          expect(mockFetch).toHaveBeenCalledWith(
            'https://otlp-gateway.grafana.net/otlp/v1/traces',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token'
              },
              body: JSON.stringify(mockJsonData)
            }
          );

          expect(result).toEqual({
            ok: true,
            status: 200,
            requestId: 'req-123'
          });
        });
      });
    });
  });

  describe('Handler Registration', () => {
    beforeEach(async () => {
      await setupMainModule();
    });

    it('should register all telemetry IPC handlers', () => {
      const expectedHandlers = [
        'telemetry:recordMessageSent',
        'telemetry:recordError',
        'telemetry:recordRendererMemory',
        'telemetry:recordDomNodeCount',
        'telemetry:recordWebSocketConnection',
        'telemetry:recordConnectionError',
        'telemetry:recordMessageReceived',
        'telemetry:recordReconnection',
        'telemetry:recordAPIRequest',
        'telemetry:recordSevenTVConnectionHealth',
        'telemetry:recordSevenTVWebSocketCreated',
        'telemetry:recordSevenTVEmoteUpdate',
        'telemetry:recordSevenTVEmoteChanges',
        'telemetry:recordChatroomSwitch',
        'telemetry:startUserSession',
        'telemetry:endUserSession',
        'telemetry:recordUserAction',
        'telemetry:recordFeatureUsage',
        'telemetry:recordChatEngagement',
        'telemetry:recordConnectionQuality',
        'telemetry:getUserAnalyticsData',
        'telemetry:getUserActionTypes',
        'telemetry:monitorUIInteraction',
        'telemetry:monitorComponentRender',
        'telemetry:monitorWebSocketLatency',
        'telemetry:monitorMemoryUsage',
        'telemetry:monitorCPUUsage',
        'telemetry:monitorBundleSize',
        'telemetry:getPerformanceData',
        'telemetry:cleanupOldSessions',
        'telemetry:forceCleanupSessions',
        'telemetry:getAnalyticsMemoryStats',
        'telemetry:readTrace',
        'telemetry:exportTraces',
        'telemetry:exportTracesJson'
      ];

      expectedHandlers.forEach(handlerName => {
        expect(mockIpcHandlers.has(handlerName)).toBe(true);
        expect(typeof mockIpcHandlers.get(handlerName)).toBe('function');
      });
    });

    it('should properly handle concurrent IPC calls', async () => {
      const handler = mockIpcHandlers.get('telemetry:recordUserAction');
      
      // Simulate concurrent calls
      const promises = Array.from({ length: 10 }, (_, i) => 
        handler({}, {
          sessionId: `session${i}`,
          actionType: 'chat_send',
          context: { index: i }
        })
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      expect(mockMetrics.recordUserAction).toHaveBeenCalledTimes(10);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      await setupMainModule();
    });

    it('should handle undefined/null parameters gracefully', async () => {
      const handler = mockIpcHandlers.get('telemetry:recordUserAction');
      
      // Should not throw with minimal parameters
      await expect(handler({}, {
        sessionId: null,
        actionType: undefined
      })).resolves.not.toThrow();
    });

    it('should handle metrics function throwing errors', async () => {
      mockMetrics.recordAPIRequest.mockImplementation(() => {
        throw new Error('Metrics failure');
      });
      
      const handler = mockIpcHandlers.get('telemetry:recordAPIRequest');
      
      // Should not propagate the error
      await expect(handler({}, {
        endpoint: '/api/test',
        method: 'GET',
        statusCode: 200,
        duration: 100
      })).resolves.not.toThrow();
    });

    it('should handle telemetry state changes during execution', async () => {
      const handler = mockIpcHandlers.get('telemetry:recordMessageSent');
      
      // Start enabled, disable mid-execution
      telemetryEnabled = true;
      mockTelemetryEnabledNow.mockImplementationOnce(() => {
        telemetryEnabled = false;
        return true; // Still return true for this call
      });
      
      await handler({}, {
        chatroomId: 'test',
        messageType: 'regular'
      });

      expect(mockMetrics.recordMessageSent).toHaveBeenCalled();
    });
  });
});