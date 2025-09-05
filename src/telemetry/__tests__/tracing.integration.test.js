import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

// Mock dependencies before importing the module
const mockNodeSDK = vi.fn();
const mockSDKInstance = {
  start: vi.fn(),
  shutdown: vi.fn()
};

const mockDiag = {
  setLogger: vi.fn()
};

const mockDiagConsoleLogger = vi.fn();
const mockDiagLogLevel = {
  INFO: 1,
  DEBUG: 2,
  WARN: 3,
  ERROR: 4
};

const mockOTLPTraceExporter = vi.fn();
const mockOTLPMetricExporter = vi.fn();
const mockAlwaysOnSampler = vi.fn();
const mockHttpInstrumentation = vi.fn();

const mockView = vi.fn();
const mockExplicitBucketHistogramAggregation = vi.fn();

const mockElectronStore = vi.fn(() => ({
  get: vi.fn().mockReturnValue({ enabled: true })
}));

const mockElectronApp = {
  getName: vi.fn().mockReturnValue('KickTalk-Test')
};

// Setup all mocks
vi.mock('dotenv', () => ({
  config: vi.fn()
}));

vi.mock('electron-store', () => ({
  default: mockElectronStore,
  __esModule: true
}));

vi.mock('electron', () => ({
  app: mockElectronApp
}));

vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: mockNodeSDK
}));

vi.mock('@opentelemetry/api', () => ({
  diag: mockDiag,
  DiagConsoleLogger: mockDiagConsoleLogger,
  DiagLogLevel: mockDiagLogLevel
}));

vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: mockOTLPTraceExporter
}));

vi.mock('@opentelemetry/exporter-metrics-otlp-http', () => ({
  OTLPMetricExporter: mockOTLPMetricExporter
}));

vi.mock('@opentelemetry/sdk-trace-base', () => ({
  AlwaysOnSampler: mockAlwaysOnSampler
}));

vi.mock('@opentelemetry/instrumentation-http', () => ({
  HttpInstrumentation: mockHttpInstrumentation
}));

vi.mock('@opentelemetry/sdk-metrics', () => ({
  View: mockView,
  ExplicitBucketHistogramAggregation: mockExplicitBucketHistogramAggregation
}));

// Mock package.json
vi.mock('../../package.json', () => ({
  default: {
    version: '1.0.0-test'
  }
}));

describe('Main Telemetry Tracing Integration Tests', () => {
  let originalConsole;
  let originalProcess;
  let mockConsole;
  let mockProcess;
  let mockModule;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock console methods
    originalConsole = { ...console };
    mockConsole = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    console.log = mockConsole.log;
    console.warn = mockConsole.warn;
    console.error = mockConsole.error;
    
    // Mock process
    originalProcess = { ...process };
    mockProcess = {
      env: {
        OTEL_DIAG_LOG_LEVEL: undefined,
        KICKTALK_TELEMETRY_FORCE_ENABLED: undefined,
        KICKTALK_TELEMETRY_FORCE_OTEL_MISSING: undefined,
        NODE_ENV: 'test'
      },
      on: vi.fn(),
      resourcesPath: undefined
    };
    Object.assign(process, mockProcess);
    
    // Reset NodeSDK mock
    mockNodeSDK.mockImplementation(() => {
      const instance = { ...mockSDKInstance };
      instance.start.mockResolvedValue(undefined);
      return instance;
    });
    
    // Reset other mocks
    mockElectronStore.mockImplementation(() => ({
      get: vi.fn().mockReturnValue({ enabled: true })
    }));
    
    mockHttpInstrumentation.mockImplementation(() => ({
      setMeterProvider: vi.fn(),
      setTracerProvider: vi.fn()
    }));
  });

  afterEach(() => {
    // Restore originals
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    
    Object.assign(process, originalProcess);
    
    // Clear module cache to allow re-import
    vi.resetModules();
  });

  describe('Telemetry Setting Checks', () => {
    it('should check user telemetry settings from electron-store', async () => {
      const mockStoreGet = vi.fn().mockReturnValue({ enabled: true });
      mockElectronStore.mockImplementation(() => ({
        get: mockStoreGet
      }));
      
      const module = await import('../tracing.js');
      
      expect(mockElectronStore).toHaveBeenCalledWith({ projectName: 'KickTalk-Test' });
      expect(mockStoreGet).toHaveBeenCalledWith('telemetry', { enabled: false });
    });

    it('should use app name for electron-store project name', async () => {
      mockElectronApp.getName.mockReturnValue('CustomAppName');
      
      await import('../tracing.js');
      
      expect(mockElectronStore).toHaveBeenCalledWith({ projectName: 'CustomAppName' });
    });

    it('should fallback to KickTalk if app name is not available', async () => {
      mockElectronApp.getName.mockReturnValue('');
      
      await import('../tracing.js');
      
      expect(mockElectronStore).toHaveBeenCalledWith({ projectName: 'KickTalk' });
    });

    it('should disable telemetry when user settings disabled', async () => {
      const mockStoreGet = vi.fn().mockReturnValue({ enabled: false });
      mockElectronStore.mockImplementation(() => ({
        get: mockStoreGet
      }));
      
      const module = await import('../tracing.js');
      
      expect(module.default).toBe(null);
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[Telemetry] Telemetry disabled by user settings, skipping initialization'
      );
    });

    it('should force enable telemetry with environment variable', async () => {
      const mockStoreGet = vi.fn().mockReturnValue({ enabled: false });
      mockElectronStore.mockImplementation(() => ({
        get: mockStoreGet
      }));
      process.env.KICKTALK_TELEMETRY_FORCE_ENABLED = '1';
      
      await import('../tracing.js');
      
      // Should proceed with initialization despite disabled setting
      expect(mockNodeSDK).toHaveBeenCalled();
    });

    it('should handle electron-store creation errors gracefully', async () => {
      mockElectronStore.mockImplementation(() => {
        throw new Error('Store creation failed');
      });
      
      const module = await import('../tracing.js');
      
      expect(module.default).toBe(null);
      expect(mockConsole.warn).toHaveBeenCalledWith(
        '[Telemetry] Could not check user settings:',
        'Store creation failed'
      );
    });
  });

  describe('OpenTelemetry Module Loading', () => {
    it('should load all required OpenTelemetry modules successfully', async () => {
      await import('../tracing.js');
      
      expect(mockNodeSDK).toHaveBeenCalled();
      expect(mockOTLPTraceExporter).toHaveBeenCalled();
      expect(mockOTLPMetricExporter).toHaveBeenCalled();
      expect(mockAlwaysOnSampler).toHaveBeenCalled();
      expect(mockHttpInstrumentation).toHaveBeenCalled();
    });

    it('should handle missing OpenTelemetry modules gracefully', async () => {
      vi.doMock('@opentelemetry/sdk-node', () => {
        throw new Error('Module not found');
      });
      
      const module = await import('../tracing.js');
      
      expect(module.default).toBe(null);
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[Telemetry] OpenTelemetry modules are not available, disabling telemetry:',
        'Module not found'
      );
    });

    it('should handle force missing OTEL modules flag', async () => {
      process.env.KICKTALK_TELEMETRY_FORCE_OTEL_MISSING = '1';
      
      const module = await import('../tracing.js');
      
      expect(module.default).toBe(null);
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[Telemetry] OpenTelemetry modules are not available, disabling telemetry:',
        'forced-missing'
      );
    });

    it('should handle optional sdk-metrics module gracefully', async () => {
      // Mock sdk-metrics to throw but others to work
      vi.doMock('@opentelemetry/sdk-metrics', () => {
        throw new Error('Metrics module not available');
      });
      
      await import('../tracing.js');
      
      // Should still proceed with NodeSDK creation
      expect(mockNodeSDK).toHaveBeenCalled();
    });
  });

  describe('Safe Module Resolution (AppImage Support)', () => {
    it('should use normal require first', async () => {
      await import('../tracing.js');
      
      // Should succeed with normal module resolution
      expect(mockNodeSDK).toHaveBeenCalled();
    });

    it('should fallback to app.asar.unpacked path when normal require fails', async () => {
      // Mock first require to fail, then succeed on fallback
      let requireCallCount = 0;
      vi.doMock('@opentelemetry/sdk-node', () => {
        requireCallCount++;
        if (requireCallCount === 1) {
          throw new Error('Module not found in normal location');
        }
        return { NodeSDK: mockNodeSDK };
      });
      
      // Set up AppImage-like environment
      process.resourcesPath = '/tmp/appimage/resources';
      
      await import('../tracing.js');
      
      // Should eventually succeed
      expect(mockNodeSDK).toHaveBeenCalled();
    });

    it('should handle fallback path construction correctly', async () => {
      const mockPath = '/opt/app/resources';
      process.resourcesPath = mockPath;
      
      // Mock path.join to track calls
      const mockPathJoin = vi.spyOn(path, 'join');
      
      // Make first require fail to trigger fallback
      let requireAttempt = 0;
      const originalRequire = require;
      global.require = vi.fn((moduleName) => {
        requireAttempt++;
        if (requireAttempt === 1 && moduleName === '@opentelemetry/sdk-node') {
          throw new Error('Not found');
        }
        return originalRequire(moduleName);
      });
      
      try {
        await import('../tracing.js');
        
        // Should have attempted to construct the unpacked path
        expect(mockPathJoin).toHaveBeenCalledWith(
          mockPath,
          'app.asar.unpacked',
          'node_modules',
          '@opentelemetry/sdk-node'
        );
      } finally {
        global.require = originalRequire;
        mockPathJoin.mockRestore();
      }
    });
  });

  describe('Diagnostic Logging Configuration', () => {
    it('should configure diagnostic logging when OTEL_DIAG_LOG_LEVEL is set', async () => {
      process.env.OTEL_DIAG_LOG_LEVEL = 'DEBUG';
      
      await import('../tracing.js');
      
      expect(mockDiag.setLogger).toHaveBeenCalledWith(
        expect.anything(), // DiagConsoleLogger instance
        mockDiagLogLevel.DEBUG
      );
    });

    it('should default to INFO level for invalid log levels', async () => {
      process.env.OTEL_DIAG_LOG_LEVEL = 'INVALID_LEVEL';
      
      await import('../tracing.js');
      
      expect(mockDiag.setLogger).toHaveBeenCalledWith(
        expect.anything(),
        mockDiagLogLevel.INFO
      );
    });

    it('should not configure logging when OTEL_DIAG_LOG_LEVEL is not set', async () => {
      delete process.env.OTEL_DIAG_LOG_LEVEL;
      
      await import('../tracing.js');
      
      expect(mockDiag.setLogger).not.toHaveBeenCalled();
    });
  });

  describe('Metric Views Configuration', () => {
    it('should configure histogram views when sdk-metrics is available', async () => {
      await import('../tracing.js');
      
      expect(mockView).toHaveBeenCalledTimes(5); // Should create 5 views
      expect(mockExplicitBucketHistogramAggregation).toHaveBeenCalledTimes(5);
      
      // Verify specific histogram configurations
      expect(mockView).toHaveBeenCalledWith({
        instrumentName: 'kicktalk_slo_latency_seconds',
        aggregation: expect.anything()
      });
      
      expect(mockView).toHaveBeenCalledWith({
        instrumentName: 'kicktalk_message_send_duration_seconds',
        aggregation: expect.anything()
      });
      
      expect(mockView).toHaveBeenCalledWith({
        instrumentName: 'kicktalk_api_request_duration_seconds',
        aggregation: expect.anything()
      });
      
      expect(mockView).toHaveBeenCalledWith({
        instrumentName: 'kicktalk_chatroom_switch_duration_seconds',
        aggregation: expect.anything()
      });
      
      expect(mockView).toHaveBeenCalledWith({
        instrumentName: 'kicktalk_seventv_emote_update_duration_seconds',
        aggregation: expect.anything()
      });
    });

    it('should configure histogram buckets correctly', async () => {
      await import('../tracing.js');
      
      // Verify SLO latency buckets
      expect(mockExplicitBucketHistogramAggregation).toHaveBeenCalledWith([
        0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0
      ]);
      
      // Verify message send duration buckets
      expect(mockExplicitBucketHistogramAggregation).toHaveBeenCalledWith([
        0.01, 0.05, 0.1, 0.5, 1, 2, 5
      ]);
    });

    it('should handle missing sdk-metrics gracefully', async () => {
      // Mock View and ExplicitBucketHistogramAggregation to not exist
      mockView.mockImplementation(() => {
        throw new Error('View not available');
      });
      
      await import('../tracing.js');
      
      // Should still create NodeSDK without views
      expect(mockNodeSDK).toHaveBeenCalledWith(
        expect.objectContaining({
          traceExporter: expect.anything(),
          metricExporter: expect.anything(),
          instrumentations: expect.anything(),
          traceSampler: expect.anything()
          // views should not be present
        })
      );
    });
  });

  describe('HTTP Instrumentation Configuration', () => {
    it('should configure HTTP instrumentation with OTLP request filtering', async () => {
      await import('../tracing.js');
      
      expect(mockHttpInstrumentation).toHaveBeenCalledWith({
        ignoreOutgoingRequestHook: expect.any(Function)
      });
    });

    it('should ignore OTLP gateway requests', async () => {
      await import('../tracing.js');
      
      const hookFunction = mockHttpInstrumentation.mock.calls[0][0].ignoreOutgoingRequestHook;
      
      // Test OTLP gateway requests should be ignored
      expect(hookFunction({ headers: { host: 'otlp-gateway.example.com' } })).toBe(true);
      expect(hookFunction({ hostname: 'grafana.net' })).toBe(true);
      
      // Test normal requests should not be ignored
      expect(hookFunction({ headers: { host: 'api.example.com' } })).toBe(false);
      expect(hookFunction({ hostname: 'kick.com' })).toBe(false);
    });

    it('should handle malformed request objects gracefully in ignore hook', async () => {
      await import('../tracing.js');
      
      const hookFunction = mockHttpInstrumentation.mock.calls[0][0].ignoreOutgoingRequestHook;
      
      // Test edge cases
      expect(hookFunction(null)).toBe(false);
      expect(hookFunction(undefined)).toBe(false);
      expect(hookFunction({})).toBe(false);
      expect(hookFunction({ headers: null })).toBe(false);
    });
  });

  describe('NodeSDK Initialization', () => {
    it('should create NodeSDK with correct configuration', async () => {
      await import('../tracing.js');
      
      expect(mockNodeSDK).toHaveBeenCalledWith({
        traceExporter: expect.any(Object),
        metricExporter: expect.any(Object),
        views: expect.any(Array),
        instrumentations: expect.any(Array),
        traceSampler: expect.any(Object)
      });
    });

    it('should start the NodeSDK', async () => {
      const mockStart = vi.fn().mockResolvedValue(undefined);
      const mockSdk = { start: mockStart, shutdown: vi.fn() };
      mockNodeSDK.mockReturnValue(mockSdk);
      
      const module = await import('../tracing.js');
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockStart).toHaveBeenCalled();
      expect(module.default).toBe(mockSdk);
    });

    it('should handle synchronous SDK start', async () => {
      const mockSdk = { start: vi.fn(), shutdown: vi.fn() };
      mockSdk.start.mockReturnValue(undefined); // Synchronous return
      mockNodeSDK.mockReturnValue(mockSdk);
      
      const module = await import('../tracing.js');
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockSdk.start).toHaveBeenCalled();
      expect(module.default).toBe(mockSdk);
    });

    it('should handle SDK start failure gracefully', async () => {
      const mockStart = vi.fn().mockRejectedValue(new Error('SDK start failed'));
      const mockSdk = { start: mockStart, shutdown: vi.fn() };
      mockNodeSDK.mockReturnValue(mockSdk);
      
      const module = await import('../tracing.js');
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[OTEL]: NodeSDK bootstrap failed:',
        expect.stringContaining('SDK start failed')
      );
      expect(module.default).toBe(null);
    });

    it('should handle NodeSDK creation failure', async () => {
      mockNodeSDK.mockImplementation(() => {
        throw new Error('NodeSDK creation failed');
      });
      
      const module = await import('../tracing.js');
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[OTEL]: NodeSDK bootstrap failed:',
        expect.stringContaining('NodeSDK creation failed')
      );
      expect(module.default).toBe(null);
    });
  });

  describe('Process Signal Handlers', () => {
    it('should register shutdown handlers for process signals', async () => {
      const mockSdk = { start: vi.fn(), shutdown: vi.fn().mockResolvedValue() };
      mockNodeSDK.mockReturnValue(mockSdk);
      
      await import('../tracing.js');
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('exit', expect.any(Function));
    });

    it('should shutdown SDK on SIGTERM', async () => {
      const mockShutdown = vi.fn().mockResolvedValue();
      const mockSdk = { start: vi.fn(), shutdown: mockShutdown };
      mockNodeSDK.mockReturnValue(mockSdk);
      
      await import('../tracing.js');
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Find and call the SIGTERM handler
      const sigtermHandler = process.on.mock.calls.find(call => call[0] === 'SIGTERM')[1];
      await sigtermHandler();
      
      expect(mockShutdown).toHaveBeenCalled();
    });

    it('should shutdown SDK on SIGINT', async () => {
      const mockShutdown = vi.fn().mockResolvedValue();
      const mockSdk = { start: vi.fn(), shutdown: mockShutdown };
      mockNodeSDK.mockReturnValue(mockSdk);
      
      await import('../tracing.js');
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Find and call the SIGINT handler
      const sigintHandler = process.on.mock.calls.find(call => call[0] === 'SIGINT')[1];
      await sigintHandler();
      
      expect(mockShutdown).toHaveBeenCalled();
    });

    it('should shutdown SDK on exit', async () => {
      const mockShutdown = vi.fn().mockResolvedValue();
      const mockSdk = { start: vi.fn(), shutdown: mockShutdown };
      mockNodeSDK.mockReturnValue(mockSdk);
      
      await import('../tracing.js');
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Find and call the exit handler
      const exitHandler = process.on.mock.calls.find(call => call[0] === 'exit')[1];
      await exitHandler();
      
      expect(mockShutdown).toHaveBeenCalled();
    });

    it('should handle shutdown errors gracefully', async () => {
      const mockShutdown = vi.fn().mockRejectedValue(new Error('Shutdown failed'));
      const mockSdk = { start: vi.fn(), shutdown: mockShutdown };
      mockNodeSDK.mockReturnValue(mockSdk);
      
      await import('../tracing.js');
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const sigtermHandler = process.on.mock.calls.find(call => call[0] === 'SIGTERM')[1];
      
      // Should not throw
      await expect(sigtermHandler()).resolves.not.toThrow();
      
      expect(mockShutdown).toHaveBeenCalled();
    });
  });

  describe('Module Export Behavior', () => {
    it('should export null when telemetry is disabled', async () => {
      const mockStoreGet = vi.fn().mockReturnValue({ enabled: false });
      mockElectronStore.mockImplementation(() => ({ get: mockStoreGet }));
      
      const module = await import('../tracing.js');
      
      expect(module.default).toBe(null);
    });

    it('should export null when OpenTelemetry modules are missing', async () => {
      vi.doMock('@opentelemetry/sdk-node', () => {
        throw new Error('Module not found');
      });
      
      const module = await import('../tracing.js');
      
      expect(module.default).toBe(null);
    });

    it('should export SDK instance when successfully initialized', async () => {
      const mockSdk = { start: vi.fn(), shutdown: vi.fn() };
      mockNodeSDK.mockReturnValue(mockSdk);
      
      const module = await import('../tracing.js');
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(module.default).toBe(mockSdk);
    });
  });

  describe('Environment Integration', () => {
    it('should load dotenv configuration', async () => {
      const mockConfig = vi.fn();
      vi.doMock('dotenv', () => ({
        config: mockConfig
      }));
      
      await import('../tracing.js');
      
      expect(mockConfig).toHaveBeenCalled();
    });

    it('should handle dotenv loading errors gracefully', async () => {
      vi.doMock('dotenv', () => ({
        config: () => {
          throw new Error('dotenv failed');
        }
      }));
      
      // Should not throw
      await expect(import('../tracing.js')).resolves.toBeDefined();
    });

    it('should handle missing electron module gracefully', async () => {
      vi.doMock('electron', () => {
        throw new Error('Electron not available');
      });
      
      // Should fallback to default project name
      await import('../tracing.js');
      
      expect(mockElectronStore).toHaveBeenCalledWith({ projectName: 'KickTalk' });
    });
  });

  describe('Console Logging', () => {
    it('should log telemetry status messages', async () => {
      const mockStoreGet = vi.fn().mockReturnValue({ enabled: false });
      mockElectronStore.mockImplementation(() => ({ get: mockStoreGet }));
      
      await import('../tracing.js');
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[Telemetry] Telemetry disabled by user settings, skipping initialization'
      );
    });

    it('should log instrumentation status', async () => {
      await import('../tracing.js');
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[Telemetry] Using manual HTTP instrumentation'
      );
    });

    it('should log error messages for failures', async () => {
      mockNodeSDK.mockImplementation(() => {
        throw new Error('Test failure');
      });
      
      await import('../tracing.js');
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[OTEL]: NodeSDK bootstrap failed:',
        expect.stringContaining('Test failure')
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle undefined process.resourcesPath', async () => {
      process.resourcesPath = undefined;
      
      // Should not throw when trying to construct fallback path
      await expect(import('../tracing.js')).resolves.toBeDefined();
    });

    it('should handle non-string process.resourcesPath', async () => {
      process.resourcesPath = 12345;
      
      await expect(import('../tracing.js')).resolves.toBeDefined();
    });

    it('should handle missing app.getName method', async () => {
      delete mockElectronApp.getName;
      
      await import('../tracing.js');
      
      expect(mockElectronStore).toHaveBeenCalledWith({ projectName: 'KickTalk' });
    });

    it('should handle app.getName throwing an error', async () => {
      mockElectronApp.getName.mockImplementation(() => {
        throw new Error('getName failed');
      });
      
      await import('../tracing.js');
      
      expect(mockElectronStore).toHaveBeenCalledWith({ projectName: 'KickTalk' });
    });

    it('should handle store.get throwing an error', async () => {
      const mockStoreGet = vi.fn().mockImplementation(() => {
        throw new Error('Store get failed');
      });
      mockElectronStore.mockImplementation(() => ({ get: mockStoreGet }));
      
      const module = await import('../tracing.js');
      
      expect(module.default).toBe(null);
      expect(mockConsole.warn).toHaveBeenCalledWith(
        '[Telemetry] Could not check user settings:',
        'Store get failed'
      );
    });

    it('should handle concurrent initialization attempts', async () => {
      const mockSdk = { start: vi.fn(), shutdown: vi.fn() };
      mockNodeSDK.mockReturnValue(mockSdk);
      
      // Import multiple times rapidly
      const promises = [
        import('../tracing.js'),
        import('../tracing.js'),
        import('../tracing.js')
      ];
      
      const modules = await Promise.all(promises);
      
      // All should return the same result
      expect(modules[0]).toBe(modules[1]);
      expect(modules[1]).toBe(modules[2]);
    });

    it('should handle malformed telemetry settings', async () => {
      const mockStoreGet = vi.fn().mockReturnValue('invalid-settings');
      mockElectronStore.mockImplementation(() => ({ get: mockStoreGet }));
      
      const module = await import('../tracing.js');
      
      // Should treat invalid settings as disabled
      expect(module.default).toBe(null);
    });

    it('should handle numeric telemetry enabled setting', async () => {
      const mockStoreGet = vi.fn().mockReturnValue({ enabled: 1 });
      mockElectronStore.mockImplementation(() => ({ get: mockStoreGet }));
      
      const module = await import('../tracing.js');
      
      // Should only accept true boolean
      expect(module.default).toBe(null);
    });
  });
});