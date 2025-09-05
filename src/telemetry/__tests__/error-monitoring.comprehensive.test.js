import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  ErrorMonitor, 
  ERROR_CATEGORIES, 
  ERROR_RATE_SLOS, 
  CircuitBreaker,
  metrics 
} from '../error-monitoring.js';

// Mock OpenTelemetry APIs
const mockMeter = {
  createCounter: vi.fn(() => ({
    add: vi.fn()
  })),
  createObservableGauge: vi.fn(() => ({
    addCallback: vi.fn()
  })),
  createHistogram: vi.fn(() => ({
    record: vi.fn()
  }))
};

const mockMetrics = {
  getMeter: vi.fn(() => mockMeter)
};

// Mock SLO Monitor
const mockSLOMonitor = {
  recordOperationResult: vi.fn()
};

const mockSLOMonitorClass = vi.fn(() => mockSLOMonitor);

// Mock package.json
const mockPackage = {
  version: '1.0.0-test'
};

// Setup mocks before imports
vi.mock('@opentelemetry/api', () => ({
  metrics: mockMetrics
}));

vi.mock('./slo-monitoring', () => ({
  SLOMonitor: mockSLOMonitorClass
}));

vi.mock('../../package.json', () => mockPackage);

describe('Error Monitoring System Comprehensive Tests', () => {
  let originalConsole;
  let mockConsole;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock console methods
    originalConsole = { ...console };
    mockConsole = {
      error: vi.fn(),
      warn: vi.fn(),
      log: vi.fn()
    };
    console.error = mockConsole.error;
    console.warn = mockConsole.warn;
    console.log = mockConsole.log;
    
    // Reset error statistics
    ErrorMonitor.resetStatistics();
    
    // Reset instruments initialization
    const errorMonitoringModule = await import('../error-monitoring.js');
    // Access the internal instrumentsInitialized flag and reset it
    // This is a workaround since the module maintains state
    errorMonitoringModule.instrumentsInitialized = false;
  });

  afterEach(() => {
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.log = originalConsole.log;
  });

  describe('Error Classification', () => {
    describe('classifyError()', () => {
      it('should classify network errors correctly', () => {
        const testCases = [
          { error: new Error('network timeout'), expected: 'NETWORK' },
          { error: { code: 'ECONNREFUSED', message: 'Connection refused' }, expected: 'NETWORK' },
          { error: { code: 'ENOTFOUND', message: 'Host not found' }, expected: 'NETWORK' },
          { error: { code: 'ETIMEDOUT', message: 'Request timeout' }, expected: 'NETWORK' },
          { error: new Error('fetch failed'), expected: 'NETWORK' }
        ];

        testCases.forEach(({ error, expected }) => {
          const category = ErrorMonitor.classifyError(error, {});
          expect(category).toBe(expected);
        });
      });

      it('should classify WebSocket errors correctly', () => {
        const testCases = [
          { error: new Error('websocket connection failed'), expected: 'WEBSOCKET' },
          { error: new Error('ws error'), expected: 'WEBSOCKET' },
          { error: new Error('connection error'), context: { component: 'websocket' }, expected: 'WEBSOCKET' }
        ];

        testCases.forEach(({ error, context = {}, expected }) => {
          const category = ErrorMonitor.classifyError(error, context);
          expect(category).toBe(expected);
        });
      });

      it('should classify authentication errors correctly', () => {
        const testCases = [
          { error: { code: 401, message: 'Unauthorized' }, expected: 'AUTH' },
          { error: { code: 403, message: 'Forbidden' }, expected: 'AUTH' },
          { error: new Error('authentication failed'), expected: 'AUTH' }
        ];

        testCases.forEach(({ error, expected }) => {
          const category = ErrorMonitor.classifyError(error, {});
          expect(category).toBe(expected);
        });
      });

      it('should classify API errors correctly', () => {
        const testCases = [
          { error: { code: 404 }, expected: 'API' },
          { error: { code: 500 }, expected: 'API' },
          { error: new Error('API request failed'), context: { operation: 'api_call' }, expected: 'API' }
        ];

        testCases.forEach(({ error, context = {}, expected }) => {
          const category = ErrorMonitor.classifyError(error, context);
          expect(category).toBe(expected);
        });
      });

      it('should classify 7TV errors correctly', () => {
        const testCases = [
          { error: new Error('7tv api error'), expected: 'SEVENTV' },
          { error: new Error('emote update failed'), context: { component: '7tv' }, expected: 'SEVENTV' }
        ];

        testCases.forEach(({ error, context = {}, expected }) => {
          const category = ErrorMonitor.classifyError(error, context);
          expect(category).toBe(expected);
        });
      });

      it('should classify parsing errors correctly', () => {
        const testCases = [
          { error: new Error('JSON parse error'), expected: 'PARSING' },
          { error: new SyntaxError('Unexpected token'), expected: 'PARSING' },
          { error: new Error('parse failed'), expected: 'PARSING' }
        ];

        testCases.forEach(({ error, expected }) => {
          const category = ErrorMonitor.classifyError(error, {});
          expect(category).toBe(expected);
        });
      });

      it('should classify render errors correctly', () => {
        const testCases = [
          { error: new Error('Component render failed'), context: { component: 'renderer' }, expected: 'RENDER' },
          { error: { name: 'RenderError', message: 'Render failed' }, expected: 'RENDER' }
        ];

        testCases.forEach(({ error, context = {}, expected }) => {
          const category = ErrorMonitor.classifyError(error, context);
          expect(category).toBe(expected);
        });
      });

      it('should classify storage errors correctly', () => {
        const testCases = [
          { error: new Error('localStorage quota exceeded'), expected: 'STORAGE' },
          { error: new Error('storage write failed'), expected: 'STORAGE' }
        ];

        testCases.forEach(({ error, expected }) => {
          const category = ErrorMonitor.classifyError(error, {});
          expect(category).toBe(expected);
        });
      });

      it('should default to NETWORK for unknown errors', () => {
        const unknownError = new Error('unknown error type');
        const category = ErrorMonitor.classifyError(unknownError, {});
        expect(category).toBe('NETWORK');
      });

      it('should handle null/undefined errors gracefully', () => {
        const category1 = ErrorMonitor.classifyError(null, {});
        const category2 = ErrorMonitor.classifyError(undefined, {});
        expect(category1).toBe('NETWORK');
        expect(category2).toBe('NETWORK');
      });
    });
  });

  describe('Error Recording', () => {
    describe('recordError()', () => {
      it('should record error with full context', () => {
        const error = new Error('Test error');
        const context = {
          operation: 'test_operation',
          component: 'test_component',
          user_id: 'user123',
          session_id: 'session456'
        };

        const result = ErrorMonitor.recordError(error, context);

        expect(result).toEqual({
          error_id: expect.stringMatching(/^NETWORK_\d+$/),
          category: 'NETWORK',
          severity: 'high',
          recovery_actions: ['retry', 'fallback']
        });

        expect(mockConsole.error).toHaveBeenCalledWith(
          '[Error Monitor] NETWORK error in test_operation:',
          'Test error',
          context
        );
      });

      it('should increment error statistics', () => {
        const error1 = new Error('Network error');
        const error2 = new Error('API error');
        error2.code = 500;

        ErrorMonitor.recordError(error1, {});
        ErrorMonitor.recordError(error2, {});

        const stats = ErrorMonitor.getErrorStatistics();
        expect(stats.total_errors).toBe(2);
        expect(stats.category_counts.NETWORK).toBe(1);
        expect(stats.category_counts.API).toBe(1);
      });

      it('should add errors to recent errors list', () => {
        const error = new Error('Recent error');
        const context = { session_id: 'test_session' };

        ErrorMonitor.recordError(error, context);

        const stats = ErrorMonitor.getErrorStatistics();
        expect(stats.recent_errors).toHaveLength(1);
        expect(stats.recent_errors[0]).toMatchObject({
          category: 'NETWORK',
          severity: 'high',
          message: 'Recent error',
          context,
          session_id: 'test_session',
          recovery_attempted: false
        });
      });

      it('should limit recent errors to 100 entries', () => {
        // Record 150 errors
        for (let i = 0; i < 150; i++) {
          ErrorMonitor.recordError(new Error(`Error ${i}`), {});
        }

        const stats = ErrorMonitor.getErrorStatistics();
        expect(stats.recent_errors).toHaveLength(100);
        
        // Should keep the most recent 100
        const lastError = stats.recent_errors[stats.recent_errors.length - 1];
        expect(lastError.message).toBe('Error 149');
      });

      it('should call metrics instruments with correct attributes', () => {
        const mockCounter = { add: vi.fn() };
        mockMeter.createCounter.mockReturnValue(mockCounter);

        const error = new Error('Metrics test error');
        const context = {
          operation: 'metrics_test',
          component: 'test_metrics',
          user_id: 'metrics_user'
        };

        ErrorMonitor.recordError(error, context);

        expect(mockCounter.add).toHaveBeenCalledWith(1, {
          error_category: 'NETWORK',
          severity: 'high',
          error_type: 'Error',
          error_code: 'unknown',
          operation: 'metrics_test',
          component: 'test_metrics',
          user_id: 'metrics_user'
        });
      });

      it('should check error rate SLOs', () => {
        const error = new Error('SLO test error');
        
        ErrorMonitor.recordError(error, {});

        expect(mockSLOMonitor.recordOperationResult).toHaveBeenCalled();
      });
    });

    describe('recordRecovery()', () => {
      it('should record successful recovery', () => {
        const mockRecoveryCounter = { add: vi.fn() };
        const mockResolutionHistogram = { record: vi.fn() };
        
        mockMeter.createCounter.mockReturnValue(mockRecoveryCounter);
        mockMeter.createHistogram.mockReturnValue(mockResolutionHistogram);

        ErrorMonitor.recordRecovery('ERROR_123_1640995200000', 'retry', true, 1500);

        expect(mockRecoveryCounter.add).toHaveBeenCalledWith(1, {
          error_id: 'ERROR_123_1640995200000',
          recovery_action: 'retry',
          success: 'true',
          duration_ms: 1500
        });

        expect(mockResolutionHistogram.record).toHaveBeenCalledWith(1.5, {
          recovery_action: 'retry',
          resolution_type: 'automatic'
        });

        expect(mockConsole.log).toHaveBeenCalledWith(
          '[Error Recovery] retry for ERROR_123_1640995200000: SUCCESS (1500ms)'
        );
      });

      it('should record failed recovery', () => {
        const mockRecoveryCounter = { add: vi.fn() };
        mockMeter.createCounter.mockReturnValue(mockRecoveryCounter);

        ErrorMonitor.recordRecovery('ERROR_456_1640995300000', 'fallback', false, 500);

        expect(mockRecoveryCounter.add).toHaveBeenCalledWith(1, {
          error_id: 'ERROR_456_1640995300000',
          recovery_action: 'fallback',
          success: 'false',
          duration_ms: 500
        });

        expect(mockConsole.log).toHaveBeenCalledWith(
          '[Error Recovery] fallback for ERROR_456_1640995300000: FAILED (500ms)'
        );
      });

      it('should update recent error records', () => {
        // First record an error
        const error = new Error('Recovery test error');
        const errorResult = ErrorMonitor.recordError(error, {});
        
        // Then record recovery
        ErrorMonitor.recordRecovery(errorResult.error_id, 'retry', true, 1000);

        const stats = ErrorMonitor.getErrorStatistics();
        const recentError = stats.recent_errors.find(e => 
          e.timestamp.toString() === errorResult.error_id.split('_')[1]
        );

        expect(recentError.recovery_attempted).toBe(true);
        expect(recentError.recovery_action).toBe('retry');
        expect(recentError.recovery_success).toBe(true);
      });
    });
  });

  describe('Circuit Breaker', () => {
    describe('CircuitBreaker class', () => {
      it('should initialize with default options', () => {
        const breaker = new CircuitBreaker('test_service');
        
        expect(breaker.name).toBe('test_service');
        expect(breaker.state).toBe('CLOSED');
        expect(breaker.failureThreshold).toBe(5);
        expect(breaker.recoveryTimeout).toBe(30000);
        expect(breaker.monitoringWindow).toBe(60000);
        expect(breaker.failureCount).toBe(0);
        expect(breaker.successCount).toBe(0);
        expect(breaker.totalRequests).toBe(0);
      });

      it('should initialize with custom options', () => {
        const options = {
          failureThreshold: 3,
          recoveryTimeout: 15000,
          monitoringWindow: 30000
        };
        
        const breaker = new CircuitBreaker('custom_service', options);
        
        expect(breaker.failureThreshold).toBe(3);
        expect(breaker.recoveryTimeout).toBe(15000);
        expect(breaker.monitoringWindow).toBe(30000);
      });

      it('should execute successful operations', async () => {
        const breaker = new CircuitBreaker('success_test');
        const operation = vi.fn().mockResolvedValue('success');
        
        const result = await breaker.execute(operation);
        
        expect(result).toBe('success');
        expect(operation).toHaveBeenCalled();
        expect(breaker.state).toBe('CLOSED');
        expect(breaker.failureCount).toBe(0);
        expect(breaker.successCount).toBe(1);
        expect(breaker.totalRequests).toBe(1);
      });

      it('should handle operation failures', async () => {
        const breaker = new CircuitBreaker('failure_test', { failureThreshold: 2 });
        const operation = vi.fn().mockRejectedValue(new Error('Operation failed'));
        
        // First failure
        await expect(breaker.execute(operation)).rejects.toThrow('Operation failed');
        expect(breaker.state).toBe('CLOSED');
        expect(breaker.failureCount).toBe(1);
        
        // Second failure should open the circuit
        await expect(breaker.execute(operation)).rejects.toThrow('Operation failed');
        expect(breaker.state).toBe('OPEN');
        expect(breaker.failureCount).toBe(2);
      });

      it('should use fallback when circuit is open', async () => {
        const breaker = new CircuitBreaker('fallback_test', { failureThreshold: 1 });
        const operation = vi.fn().mockRejectedValue(new Error('Operation failed'));
        const fallback = vi.fn().mockResolvedValue('fallback_result');
        
        // Fail once to open circuit
        await expect(breaker.execute(operation, fallback)).rejects.toThrow('Operation failed');
        expect(breaker.state).toBe('OPEN');
        
        // Next call should use fallback
        const result = await breaker.execute(operation, fallback);
        expect(result).toBe('fallback_result');
        expect(fallback).toHaveBeenCalled();
      });

      it('should transition to half-open after recovery timeout', async () => {
        const breaker = new CircuitBreaker('recovery_test', { 
          failureThreshold: 1, 
          recoveryTimeout: 100 
        });
        const operation = vi.fn()
          .mockRejectedValueOnce(new Error('Initial failure'))
          .mockResolvedValueOnce('recovered');
        
        // Fail to open circuit
        await expect(breaker.execute(operation)).rejects.toThrow('Initial failure');
        expect(breaker.state).toBe('OPEN');
        
        // Wait for recovery timeout
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Next call should transition to half-open and succeed
        const result = await breaker.execute(operation);
        expect(result).toBe('recovered');
        expect(breaker.state).toBe('CLOSED');
      });

      it('should return to open if half-open operation fails', async () => {
        const breaker = new CircuitBreaker('half_open_test', { 
          failureThreshold: 1, 
          recoveryTimeout: 100 
        });
        const operation = vi.fn()
          .mockRejectedValueOnce(new Error('Initial failure'))
          .mockRejectedValueOnce(new Error('Recovery failed'));
        
        // Fail to open circuit
        await expect(breaker.execute(operation)).rejects.toThrow('Initial failure');
        expect(breaker.state).toBe('OPEN');
        
        // Wait for recovery timeout
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Next call should fail and return to open
        await expect(breaker.execute(operation)).rejects.toThrow('Recovery failed');
        expect(breaker.state).toBe('OPEN');
      });

      it('should calculate error rate correctly', () => {
        const breaker = new CircuitBreaker('error_rate_test');
        
        // Add some history
        breaker.updateHistory(true);  // success
        breaker.updateHistory(false); // failure
        breaker.updateHistory(false); // failure
        breaker.updateHistory(true);  // success
        
        const errorRate = breaker.getErrorRate();
        expect(errorRate).toBe(0.5); // 2 failures out of 4 total
      });

      it('should clean old history entries', () => {
        const breaker = new CircuitBreaker('history_test', { monitoringWindow: 100 });
        
        // Mock Date.now to control time
        const originalNow = Date.now;
        let currentTime = 1000;
        Date.now = vi.fn(() => currentTime);
        
        try {
          breaker.updateHistory(true);
          
          // Advance time beyond monitoring window
          currentTime = 1200;
          breaker.updateHistory(false);
          
          expect(breaker.requestHistory).toHaveLength(1);
          expect(breaker.requestHistory[0].success).toBe(false);
        } finally {
          Date.now = originalNow;
        }
      });

      it('should provide status information', () => {
        const breaker = new CircuitBreaker('status_test');
        breaker.onSuccess();
        breaker.onFailure(new Error('test'));
        
        const status = breaker.getStatus();
        
        expect(status).toEqual({
          state: 'CLOSED',
          failureCount: 1,
          errorRate: expect.any(Number),
          totalRequests: 2
        });
      });
    });

    describe('Circuit breaker integration with ErrorMonitor', () => {
      it('should get or create circuit breakers', () => {
        const breaker1 = ErrorMonitor.getCircuitBreaker('test_service');
        const breaker2 = ErrorMonitor.getCircuitBreaker('test_service');
        
        expect(breaker1).toBe(breaker2); // Should return same instance
        expect(breaker1.name).toBe('test_service');
      });

      it('should execute operations with circuit breaker protection', async () => {
        const operation = vi.fn().mockResolvedValue('success');
        
        const result = await ErrorMonitor.executeWithCircuitBreaker(
          'protected_operation', 
          operation
        );
        
        expect(result).toBe('success');
        expect(operation).toHaveBeenCalled();
      });

      it('should record errors when circuit breaker operations fail', async () => {
        const operation = vi.fn().mockRejectedValue(new Error('Circuit breaker test error'));
        
        await expect(
          ErrorMonitor.executeWithCircuitBreaker('failing_operation', operation)
        ).rejects.toThrow('Circuit breaker test error');
        
        const stats = ErrorMonitor.getErrorStatistics();
        expect(stats.total_errors).toBe(1);
        expect(stats.category_counts.NETWORK).toBe(1);
      });

      it('should attempt fallback when circuit breaker is open', async () => {
        const options = { failureThreshold: 1 };
        const operation = vi.fn().mockRejectedValue(new Error('Service unavailable'));
        const fallback = vi.fn().mockResolvedValue('fallback_result');
        
        // First call fails and opens circuit
        await expect(
          ErrorMonitor.executeWithCircuitBreaker('fallback_test', operation, fallback, options)
        ).rejects.toThrow('Service unavailable');
        
        // Second call should use fallback
        const result = await ErrorMonitor.executeWithCircuitBreaker(
          'fallback_test', 
          operation, 
          fallback, 
          options
        );
        
        expect(result).toBe('fallback_result');
        expect(fallback).toHaveBeenCalled();
      });

      it('should record recovery attempts', async () => {
        const options = { failureThreshold: 1 };
        const operation = vi.fn().mockRejectedValue(new Error('Service error'));
        const fallback = vi.fn().mockResolvedValue('recovered');
        
        // Reset statistics to have clean state
        ErrorMonitor.resetStatistics();
        
        // Fail once to open circuit
        await expect(
          ErrorMonitor.executeWithCircuitBreaker('recovery_test', operation, fallback, options)
        ).rejects.toThrow('Service error');
        
        // Second call with fallback
        const result = await ErrorMonitor.executeWithCircuitBreaker(
          'recovery_test', 
          operation, 
          fallback, 
          options
        );
        
        expect(result).toBe('recovered');
        
        const stats = ErrorMonitor.getErrorStatistics();
        const recentError = stats.recent_errors[0];
        expect(recentError.recovery_attempted).toBe(true);
        expect(recentError.recovery_success).toBe(true);
      });
    });
  });

  describe('SLO Monitoring', () => {
    describe('checkErrorRateSLOs()', () => {
      it('should check error rate against SLO targets', () => {
        // Record some errors to create a failure rate
        ErrorMonitor.recordError(new Error('Network error 1'), {});
        ErrorMonitor.recordError(new Error('Network error 2'), {});
        
        // Simulate some total requests
        const stats = ErrorMonitor.getErrorStatistics();
        stats.total_requests = 100; // Manually set for testing
        
        ErrorMonitor.checkErrorRateSLOs('NETWORK');
        
        expect(mockSLOMonitor.recordOperationResult).toHaveBeenCalledWith(
          'error_rate_network',
          expect.any(Boolean),
          null,
          expect.objectContaining({
            current_rate: expect.any(String),
            target_rate: expect.any(String),
            severity: expect.any(String)
          })
        );
      });

      it('should handle unknown error categories', () => {
        ErrorMonitor.checkErrorRateSLOs('UNKNOWN_CATEGORY');
        
        expect(mockSLOMonitor.recordOperationResult).toHaveBeenCalledWith(
          'error_rate_unknown_category',
          expect.any(Boolean),
          null,
          expect.objectContaining({
            severity: expect.any(String)
          })
        );
      });

      it('should warn when SLO targets are exceeded', () => {
        // Create a high error rate scenario
        for (let i = 0; i < 10; i++) {
          ErrorMonitor.recordError(new Error(`Network error ${i}`), {});
        }
        
        // Set low total requests to create high error rate
        const stats = ErrorMonitor.getErrorStatistics();
        stats.total_requests = 20;
        
        ErrorMonitor.checkErrorRateSLOs('NETWORK');
        
        expect(mockConsole.warn).toHaveBeenCalledWith(
          expect.stringContaining('SLO Violation'),
          expect.stringContaining('NETWORK error rate'),
          expect.stringContaining('exceeds target')
        );
      });

      it('should not warn when within SLO targets', () => {
        // Create a low error rate scenario
        ErrorMonitor.recordError(new Error('Single network error'), {});
        
        const stats = ErrorMonitor.getErrorStatistics();
        stats.total_requests = 1000; // High total requests for low error rate
        
        ErrorMonitor.checkErrorRateSLOs('NETWORK');
        
        expect(mockConsole.warn).not.toHaveBeenCalledWith(
          expect.stringContaining('SLO Violation')
        );
      });
    });
  });

  describe('Error Statistics and State Management', () => {
    describe('getErrorStatistics()', () => {
      it('should return comprehensive error statistics', () => {
        const error1 = new Error('Network error');
        const error2 = new Error('API error');
        error2.code = 500;
        
        ErrorMonitor.recordError(error1, { session_id: 'session1' });
        ErrorMonitor.recordError(error2, { session_id: 'session2' });
        
        const breaker = ErrorMonitor.getCircuitBreaker('test_breaker');
        
        const stats = ErrorMonitor.getErrorStatistics();
        
        expect(stats).toEqual({
          total_errors: 2,
          total_requests: 0,
          category_counts: {
            NETWORK: 1,
            API: 1
          },
          recent_errors: expect.arrayContaining([
            expect.objectContaining({
              category: 'NETWORK',
              message: 'Network error',
              session_id: 'session1'
            }),
            expect.objectContaining({
              category: 'API',
              message: 'API error',
              session_id: 'session2'
            })
          ]),
          circuit_breakers: expect.arrayContaining([
            expect.objectContaining({
              name: 'test_breaker',
              state: 'CLOSED'
            })
          ])
        });
      });
    });

    describe('resetStatistics()', () => {
      it('should reset all error statistics and circuit breakers', () => {
        // Add some data
        ErrorMonitor.recordError(new Error('Test error'), {});
        ErrorMonitor.getCircuitBreaker('test_breaker');
        
        // Verify data exists
        let stats = ErrorMonitor.getErrorStatistics();
        expect(stats.total_errors).toBe(1);
        expect(stats.circuit_breakers).toHaveLength(1);
        
        // Reset
        ErrorMonitor.resetStatistics();
        
        // Verify reset
        stats = ErrorMonitor.getErrorStatistics();
        expect(stats.total_errors).toBe(0);
        expect(stats.total_requests).toBe(0);
        expect(stats.category_counts).toEqual({});
        expect(stats.recent_errors).toEqual([]);
        expect(stats.circuit_breakers).toEqual([]);
      });
    });
  });

  describe('Metrics Integration', () => {
    describe('Lazy instrument initialization', () => {
      it('should create instruments on first use', () => {
        ErrorMonitor.recordError(new Error('Metrics test'), {});
        
        expect(mockMetrics.getMeter).toHaveBeenCalledWith('kicktalk-errors', '1.0.0-test');
        expect(mockMeter.createCounter).toHaveBeenCalledWith('kicktalk_errors_total', expect.any(Object));
        expect(mockMeter.createObservableGauge).toHaveBeenCalledWith('kicktalk_error_rate', expect.any(Object));
        expect(mockMeter.createCounter).toHaveBeenCalledWith('kicktalk_error_recovery_total', expect.any(Object));
        expect(mockMeter.createHistogram).toHaveBeenCalledWith('kicktalk_error_resolution_duration_seconds', expect.any(Object));
        expect(mockMeter.createObservableGauge).toHaveBeenCalledWith('kicktalk_circuit_breaker_status', expect.any(Object));
      });

      it('should not reinitialize instruments on subsequent calls', () => {
        // First call
        ErrorMonitor.recordError(new Error('Test 1'), {});
        const callCount1 = mockMeter.createCounter.mock.calls.length;
        
        // Second call
        ErrorMonitor.recordError(new Error('Test 2'), {});
        const callCount2 = mockMeter.createCounter.mock.calls.length;
        
        expect(callCount2).toBe(callCount1); // No new instrument creation
      });
    });

    describe('Observable gauge callbacks', () => {
      it('should register error rate callback', () => {
        ErrorMonitor.recordError(new Error('Gauge test'), {});
        
        const observableGaugeCalls = mockMeter.createObservableGauge.mock.calls;
        const errorRateGauge = observableGaugeCalls.find(call => 
          call[0] === 'kicktalk_error_rate'
        );
        
        expect(errorRateGauge).toBeDefined();
        expect(errorRateGauge[1]).toEqual({
          description: 'Error rate percentage by category',
          unit: '%'
        });
      });

      it('should register circuit breaker status callback', () => {
        ErrorMonitor.recordError(new Error('CB test'), {});
        
        const observableGaugeCalls = mockMeter.createObservableGauge.mock.calls;
        const circuitBreakerGauge = observableGaugeCalls.find(call => 
          call[0] === 'kicktalk_circuit_breaker_status'
        );
        
        expect(circuitBreakerGauge).toBeDefined();
        expect(circuitBreakerGauge[1]).toEqual({
          description: 'Circuit breaker status (0=closed, 1=open, 0.5=half-open)',
          unit: '1'
        });
      });
    });

    describe('Metrics exports', () => {
      it('should expose metrics through getter functions', () => {
        // Access metrics to trigger initialization
        const errorCount = metrics.errorCount;
        const errorRate = metrics.errorRate;
        const errorRecovery = metrics.errorRecovery;
        const errorResolution = metrics.errorResolution;
        const circuitBreakerStatus = metrics.circuitBreakerStatus;
        
        expect(errorCount).toBeDefined();
        expect(errorRate).toBeDefined();
        expect(errorRecovery).toBeDefined();
        expect(errorResolution).toBeDefined();
        expect(circuitBreakerStatus).toBeDefined();
      });
    });
  });

  describe('Constants and Configuration', () => {
    describe('ERROR_CATEGORIES', () => {
      it('should define all expected error categories', () => {
        const expectedCategories = [
          'NETWORK', 'WEBSOCKET', 'API', 'PARSING', 'AUTH', 
          'SEVENTV', 'RENDER', 'STORAGE'
        ];
        
        expectedCategories.forEach(category => {
          expect(ERROR_CATEGORIES[category]).toBeDefined();
          expect(ERROR_CATEGORIES[category]).toHaveProperty('code');
          expect(ERROR_CATEGORIES[category]).toHaveProperty('description');
          expect(ERROR_CATEGORIES[category]).toHaveProperty('severity');
          expect(ERROR_CATEGORIES[category]).toHaveProperty('recovery_actions');
        });
      });

      it('should have appropriate severity levels', () => {
        expect(ERROR_CATEGORIES.AUTH.severity).toBe('critical');
        expect(ERROR_CATEGORIES.NETWORK.severity).toBe('high');
        expect(ERROR_CATEGORIES.WEBSOCKET.severity).toBe('high');
        expect(ERROR_CATEGORIES.API.severity).toBe('medium');
        expect(ERROR_CATEGORIES.SEVENTV.severity).toBe('medium');
        expect(ERROR_CATEGORIES.STORAGE.severity).toBe('medium');
        expect(ERROR_CATEGORIES.PARSING.severity).toBe('low');
        expect(ERROR_CATEGORIES.RENDER.severity).toBe('low');
      });
    });

    describe('ERROR_RATE_SLOS', () => {
      it('should define SLO targets for error rates', () => {
        const expectedSLOs = [
          'OVERALL_ERROR_RATE', 'NETWORK_ERROR_RATE', 'WEBSOCKET_ERROR_RATE'
        ];
        
        expectedSLOs.forEach(slo => {
          expect(ERROR_RATE_SLOS[slo]).toBeDefined();
          expect(ERROR_RATE_SLOS[slo]).toHaveProperty('target');
          expect(ERROR_RATE_SLOS[slo]).toHaveProperty('critical_threshold');
          expect(ERROR_RATE_SLOS[slo]).toHaveProperty('time_window');
          expect(ERROR_RATE_SLOS[slo]).toHaveProperty('description');
        });
      });

      it('should have reasonable SLO targets', () => {
        expect(ERROR_RATE_SLOS.OVERALL_ERROR_RATE.target).toBe(0.01); // 1%
        expect(ERROR_RATE_SLOS.NETWORK_ERROR_RATE.target).toBe(0.02); // 2%
        expect(ERROR_RATE_SLOS.WEBSOCKET_ERROR_RATE.target).toBe(0.005); // 0.5%
        
        // Critical thresholds should be higher than targets
        Object.values(ERROR_RATE_SLOS).forEach(slo => {
          expect(slo.critical_threshold).toBeGreaterThan(slo.target);
        });
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle errors with complex properties', () => {
      const complexError = new Error('Complex error');
      complexError.code = 'CUSTOM_ERROR';
      complexError.statusCode = 418;
      complexError.details = { nested: { data: 'test' } };
      complexError.stack = 'Error: Complex error\n    at test.js:1:1';
      
      const result = ErrorMonitor.recordError(complexError, {
        operation: 'complex_test',
        metadata: { version: '1.0.0', environment: 'test' }
      });
      
      expect(result.error_id).toMatch(/^NETWORK_\d+$/);
      expect(result.category).toBe('NETWORK');
    });

    it('should handle null/undefined context gracefully', () => {
      const error = new Error('Null context test');
      
      const result1 = ErrorMonitor.recordError(error, null);
      const result2 = ErrorMonitor.recordError(error, undefined);
      const result3 = ErrorMonitor.recordError(error);
      
      expect(result1.category).toBe('NETWORK');
      expect(result2.category).toBe('NETWORK');
      expect(result3.category).toBe('NETWORK');
    });

    it('should handle very long error messages', () => {
      const longMessage = 'A'.repeat(10000);
      const error = new Error(longMessage);
      
      const result = ErrorMonitor.recordError(error, {});
      
      expect(result.error_id).toBeDefined();
      expect(result.category).toBe('NETWORK');
      
      const stats = ErrorMonitor.getErrorStatistics();
      expect(stats.recent_errors[0].message).toBe(longMessage);
    });

    it('should handle concurrent error recording', () => {
      const errors = Array.from({ length: 10 }, (_, i) => 
        new Error(`Concurrent error ${i}`)
      );
      
      // Record errors concurrently
      const promises = errors.map(error => 
        Promise.resolve(ErrorMonitor.recordError(error, {}))
      );
      
      return Promise.all(promises).then(results => {
        expect(results).toHaveLength(10);
        results.forEach(result => {
          expect(result.error_id).toMatch(/^NETWORK_\d+$/);
        });
        
        const stats = ErrorMonitor.getErrorStatistics();
        expect(stats.total_errors).toBe(10);
        expect(stats.recent_errors).toHaveLength(10);
      });
    });

    it('should handle circuit breaker with undefined fallback', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('No fallback test'));
      
      await expect(
        ErrorMonitor.executeWithCircuitBreaker('no_fallback_test', operation)
      ).rejects.toThrow('No fallback test');
    });

    it('should handle fallback function that also fails', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Primary failed'));
      const fallback = vi.fn().mockRejectedValue(new Error('Fallback failed'));
      
      const options = { failureThreshold: 1 };
      
      // First call fails and opens circuit
      await expect(
        ErrorMonitor.executeWithCircuitBreaker('double_failure', operation, fallback, options)
      ).rejects.toThrow('Primary failed');
      
      // Second call should try fallback and return original error when fallback fails
      await expect(
        ErrorMonitor.executeWithCircuitBreaker('double_failure', operation, fallback, options)
      ).rejects.toThrow('Primary failed'); // Original error, not fallback error
    });
  });
});