import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userAnalytics, { 
  RendererUserAnalytics, 
  USER_ACTION_TYPES, 
  FEATURE_CATEGORIES,
  trackChatMessage,
  trackEmoteUse,
  trackChannelSwitch,
  trackFeatureUse,
  monitorUIAction,
  monitorRender,
  trackConnectionQuality
} from '../userAnalyticsHelper.js';

// Mock crypto.randomUUID
const mockRandomUUID = vi.fn(() => 'mock-uuid-1234');
vi.mock('crypto', () => ({
  randomUUID: mockRandomUUID
}));

// Mock window.electronAPI
const mockElectronAPI = {
  telemetry: {
    startUserSession: vi.fn().mockResolvedValue({ sessionId: 'session_mock-uuid-1234', success: true }),
    endUserSession: vi.fn().mockResolvedValue({ success: true }),
    recordUserAction: vi.fn().mockResolvedValue({ success: true }),
    recordFeatureUsage: vi.fn().mockResolvedValue({ success: true }),
    recordChatEngagement: vi.fn().mockResolvedValue({ success: true }),
    recordConnectionQuality: vi.fn().mockResolvedValue({ success: true }),
    monitorUIInteraction: vi.fn().mockResolvedValue('good'),
    monitorComponentRender: vi.fn().mockResolvedValue('good'),
    monitorWebSocketLatency: vi.fn().mockResolvedValue('good'),
    monitorMemoryUsage: vi.fn().mockResolvedValue({ success: true }),
    getUserAnalyticsData: vi.fn().mockResolvedValue({ actions: [], sessions: [] }),
    getPerformanceData: vi.fn().mockResolvedValue({ metrics: {} })
  }
};

// Mock performance API
const mockPerformance = {
  now: vi.fn(() => 1640995200000),
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    totalJSHeapSize: 100 * 1024 * 1024, // 100MB
    jsHeapSizeLimit: 200 * 1024 * 1024 // 200MB
  }
};

// Mock PerformanceObserver
class MockPerformanceObserver {
  constructor(callback) {
    this.callback = callback;
    MockPerformanceObserver.instances.push(this);
  }
  
  static instances = [];
  
  observe(options) {
    this.options = options;
  }
  
  disconnect() {
    // Mock disconnect
  }
  
  static triggerEntries(entries) {
    this.instances.forEach(observer => {
      if (observer.callback) {
        observer.callback({
          getEntries: () => entries
        });
      }
    });
  }
}

describe('RendererUserAnalytics Comprehensive Tests', () => {
  let analytics;
  let mockWindow;
  let originalWindow;
  let originalPerformance;
  let originalPerformanceObserver;
  let originalConsole;
  let originalDateNow;
  let originalSetInterval;
  let mockIntervals;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIntervals = [];
    
    // Mock Date.now
    originalDateNow = Date.now;
    Date.now = vi.fn(() => 1640995200000);
    
    // Mock console methods
    originalConsole = { ...console };
    console.log = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
    
    // Mock setInterval
    originalSetInterval = global.setInterval;
    global.setInterval = vi.fn((callback, delay) => {
      const id = mockIntervals.length;
      mockIntervals.push({ callback, delay, id });
      return id;
    });
    
    // Mock window object
    originalWindow = global.window;
    mockWindow = {
      electronAPI: mockElectronAPI,
      innerWidth: 1920,
      innerHeight: 1080,
      addEventListener: vi.fn(),
      navigator: {
        userAgent: 'Mozilla/5.0 (Test) KickTalk/1.0.0'
      }
    };
    global.window = mockWindow;
    
    // Mock performance
    originalPerformance = global.performance;
    global.performance = mockPerformance;
    
    // Mock PerformanceObserver
    originalPerformanceObserver = global.PerformanceObserver;
    global.PerformanceObserver = MockPerformanceObserver;
    MockPerformanceObserver.instances = [];
    
    // Create fresh instance
    analytics = new RendererUserAnalytics();
  });

  afterEach(() => {
    global.window = originalWindow;
    global.performance = originalPerformance;
    global.PerformanceObserver = originalPerformanceObserver;
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    Date.now = originalDateNow;
    global.setInterval = originalSetInterval;
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default values', () => {
      expect(analytics.sessionId).toBe(null);
      expect(analytics.userId).toBe(null);
      expect(analytics.isInitialized).toBe(false);
      expect(analytics.engagementStartTime).toBe(null);
      expect(analytics.lastActionTime).toBe(1640995200000);
    });

    it('should setup window event listeners during construction', () => {
      expect(mockWindow.addEventListener).toHaveBeenCalledWith('focus', expect.any(Function));
      expect(mockWindow.addEventListener).toHaveBeenCalledWith('blur', expect.any(Function));
      expect(mockWindow.addEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      expect(mockWindow.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('should start resource monitoring interval', () => {
      expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 30000);
    });

    it('should setup performance observer', () => {
      expect(MockPerformanceObserver.instances).toHaveLength(1);
      expect(MockPerformanceObserver.instances[0].options).toEqual({
        entryTypes: ['measure', 'navigation']
      });
    });
  });

  describe('Session Management', () => {
    describe('init()', () => {
      it('should initialize session successfully', async () => {
        const result = await analytics.init('user123');
        
        expect(analytics.sessionId).toBe('session_mock-uuid-1234');
        expect(analytics.userId).toBe('user123');
        expect(analytics.isInitialized).toBe(true);
        expect(analytics.lastActionTime).toBe(1640995200000);
        
        expect(mockElectronAPI.telemetry.startUserSession).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-1234',
          userId: 'user123'
        });
        
        expect(mockElectronAPI.telemetry.recordUserAction).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-1234',
          actionType: USER_ACTION_TYPES.WINDOW_FOCUS,
          context: {
            app_startup: true,
            user_agent: 'Mozilla/5.0 (Test) KickTalk/1.0.0',
            viewport_width: 1920,
            viewport_height: 1080,
            interaction_start_time: 1640995200000,
            time_since_last_action: 0
          }
        });
        
        expect(result).toEqual({ sessionId: 'session_mock-uuid-1234', success: true });
      });

      it('should initialize session with anonymous user', async () => {
        const result = await analytics.init();
        
        expect(analytics.userId).toBe(null);
        expect(mockElectronAPI.telemetry.startUserSession).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-1234',
          userId: null
        });
      });

      it('should handle initialization failure', async () => {
        const error = new Error('Session initialization failed');
        mockElectronAPI.telemetry.startUserSession.mockRejectedValue(error);
        
        await expect(analytics.init('user123')).rejects.toThrow('Session initialization failed');
        expect(console.error).toHaveBeenCalledWith('[User Analytics] Failed to initialize session:', error);
      });

      it('should use fallback session ID generation when randomUUID fails', async () => {
        mockRandomUUID.mockImplementation(() => {
          throw new Error('randomUUID not available');
        });
        
        // Create new instance to test fallback
        const analyticsWithFallback = new RendererUserAnalytics();
        await analyticsWithFallback.init('user123');
        
        expect(analyticsWithFallback.sessionId).toMatch(/^session_\d+_[a-z0-9]{6}$/);
        expect(console.warn).toHaveBeenCalledWith('[User Analytics] Using fallback session ID generation:', expect.any(Error));
      });
    });

    describe('endSession()', () => {
      it('should end session successfully', async () => {
        await analytics.init('user123');
        await analytics.endSession();
        
        expect(mockElectronAPI.telemetry.endUserSession).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-1234'
        });
        
        expect(analytics.sessionId).toBe(null);
        expect(analytics.userId).toBe(null);
        expect(analytics.isInitialized).toBe(false);
      });

      it('should handle ending session when not initialized', async () => {
        await analytics.endSession();
        
        expect(mockElectronAPI.telemetry.endUserSession).not.toHaveBeenCalled();
      });

      it('should handle session end failure', async () => {
        await analytics.init('user123');
        const error = new Error('End session failed');
        mockElectronAPI.telemetry.endUserSession.mockRejectedValue(error);
        
        await analytics.endSession();
        
        expect(console.error).toHaveBeenCalledWith('[User Analytics] Failed to end session:', error);
        expect(analytics.isInitialized).toBe(false); // Should still reset state
      });
    });
  });

  describe('Action Recording', () => {
    beforeEach(async () => {
      await analytics.init('user123');
      vi.clearAllMocks(); // Clear init-related calls
    });

    describe('recordAction()', () => {
      it('should record action successfully', async () => {
        const result = await analytics.recordAction(USER_ACTION_TYPES.CHAT_SEND, {
          message_length: 25,
          channel: 'test-channel'
        });
        
        expect(result).toBe(true);
        expect(mockElectronAPI.telemetry.recordUserAction).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-1234',
          actionType: USER_ACTION_TYPES.CHAT_SEND,
          context: {
            message_length: 25,
            channel: 'test-channel',
            interaction_start_time: 1640995200000,
            time_since_last_action: 0
          }
        });
        
        expect(analytics.lastActionTime).toBe(1640995200000);
        expect(analytics.engagementStartTime).toBe(1640995200000);
      });

      it('should start engagement tracking for emote use', async () => {
        await analytics.recordAction(USER_ACTION_TYPES.EMOTE_USE, { emote: 'Kappa' });
        
        expect(analytics.engagementStartTime).toBe(1640995200000);
      });

      it('should not record action when session not initialized', async () => {
        analytics.isInitialized = false;
        
        const result = await analytics.recordAction(USER_ACTION_TYPES.CHAT_SEND);
        
        expect(result).toBe(undefined);
        expect(mockElectronAPI.telemetry.recordUserAction).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith('[User Analytics] Cannot record action - session not initialized');
      });

      it('should handle action recording failure', async () => {
        const error = new Error('Action recording failed');
        mockElectronAPI.telemetry.recordUserAction.mockRejectedValue(error);
        
        const result = await analytics.recordAction(USER_ACTION_TYPES.CHAT_SEND);
        
        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalledWith('[User Analytics] Failed to record action:', error);
      });

      it('should calculate time since last action correctly', async () => {
        // Record first action
        await analytics.recordAction(USER_ACTION_TYPES.WINDOW_FOCUS);
        
        // Advance time and record second action
        Date.now = vi.fn(() => 1640995205000); // +5 seconds
        await analytics.recordAction(USER_ACTION_TYPES.CHAT_SEND);
        
        expect(mockElectronAPI.telemetry.recordUserAction).toHaveBeenLastCalledWith({
          sessionId: 'session_mock-uuid-1234',
          actionType: USER_ACTION_TYPES.CHAT_SEND,
          context: {
            interaction_start_time: 1640995205000,
            time_since_last_action: 5000
          }
        });
      });
    });

    describe('recordFeatureUsage()', () => {
      it('should record feature usage successfully', async () => {
        await analytics.recordFeatureUsage('emote_search', 'search', {
          query: 'kappa',
          results_count: 5
        });
        
        expect(mockElectronAPI.telemetry.recordFeatureUsage).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-1234',
          featureName: 'emote_search',
          action: 'search',
          context: {
            query: 'kappa',
            results_count: 5
          }
        });
      });

      it('should not record when session not initialized', async () => {
        analytics.isInitialized = false;
        
        await analytics.recordFeatureUsage('test_feature', 'use');
        
        expect(mockElectronAPI.telemetry.recordFeatureUsage).not.toHaveBeenCalled();
      });

      it('should handle feature usage recording failure', async () => {
        const error = new Error('Feature usage failed');
        mockElectronAPI.telemetry.recordFeatureUsage.mockRejectedValue(error);
        
        await analytics.recordFeatureUsage('test_feature', 'use');
        
        expect(console.error).toHaveBeenCalledWith('[User Analytics] Failed to record feature usage:', error);
      });
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      await analytics.init('user123');
      vi.clearAllMocks();
    });

    describe('monitorUIInteraction()', () => {
      it('should monitor UI interaction with execution time', async () => {
        const severity = await analytics.monitorUIInteraction('button_click', 150, {
          component: 'send_button'
        });
        
        expect(severity).toBe('good');
        expect(mockElectronAPI.telemetry.monitorUIInteraction).toHaveBeenCalledWith({
          interactionType: 'button_click',
          executionTime: 150,
          context: {
            component: 'send_button',
            session_id: 'session_mock-uuid-1234'
          }
        });
        
        expect(mockElectronAPI.telemetry.recordUserAction).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-1234',
          actionType: 'ui_button_click',
          context: {
            execution_time: 150,
            performance_severity: 'good',
            component: 'send_button'
          }
        });
      });

      it('should monitor UI interaction with callback', async () => {
        const callback = vi.fn().mockResolvedValue('callback_result');
        mockPerformance.now = vi.fn()
          .mockReturnValueOnce(1000) // Start time
          .mockReturnValueOnce(1150); // End time
        
        const severity = await analytics.monitorUIInteraction('scroll', callback, {
          direction: 'down'
        });
        
        expect(callback).toHaveBeenCalled();
        expect(mockElectronAPI.telemetry.monitorUIInteraction).toHaveBeenCalledWith({
          interactionType: 'scroll',
          executionTime: 150,
          context: {
            direction: 'down',
            session_id: 'session_mock-uuid-1234'
          }
        });
      });

      it('should return default severity when session not initialized', async () => {
        analytics.isInitialized = false;
        
        const severity = await analytics.monitorUIInteraction('click', 100);
        
        expect(severity).toBe('good');
        expect(mockElectronAPI.telemetry.monitorUIInteraction).not.toHaveBeenCalled();
      });

      it('should handle monitoring failure gracefully', async () => {
        const error = new Error('Monitoring failed');
        mockElectronAPI.telemetry.monitorUIInteraction.mockRejectedValue(error);
        
        const severity = await analytics.monitorUIInteraction('click', 100);
        
        expect(severity).toBe('good');
        expect(console.error).toHaveBeenCalledWith('[User Analytics] Failed to monitor UI interaction:', error);
      });
    });

    describe('monitorComponentRender()', () => {
      it('should monitor component render performance', async () => {
        const severity = await analytics.monitorComponentRender('ChatMessage', 25, {
          message_count: 100
        });
        
        expect(severity).toBe('good');
        expect(mockElectronAPI.telemetry.monitorComponentRender).toHaveBeenCalledWith({
          componentName: 'ChatMessage',
          renderTime: 25,
          context: {
            message_count: 100,
            session_id: 'session_mock-uuid-1234'
          }
        });
      });

      it('should return default severity when session not initialized', async () => {
        analytics.isInitialized = false;
        
        const severity = await analytics.monitorComponentRender('TestComponent', 50);
        
        expect(severity).toBe('good');
        expect(mockElectronAPI.telemetry.monitorComponentRender).not.toHaveBeenCalled();
      });
    });

    describe('monitorWebSocketLatency()', () => {
      it('should monitor WebSocket latency and record connection quality', async () => {
        const severity = await analytics.monitorWebSocketLatency(75, {
          chatroom: 'test-room'
        });
        
        expect(severity).toBe('good');
        expect(mockElectronAPI.telemetry.monitorWebSocketLatency).toHaveBeenCalledWith({
          latency: 75,
          context: {
            chatroom: 'test-room',
            session_id: 'session_mock-uuid-1234'
          }
        });
        
        // Should also record connection quality
        expect(mockElectronAPI.telemetry.recordConnectionQuality).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-1234',
          quality: 8, // 75ms latency should map to quality 8
          eventType: 'websocket_latency'
        });
      });

      it('should map latency to correct quality scores', () => {
        expect(analytics.latencyToQualityScore(25)).toBe(10);
        expect(analytics.latencyToQualityScore(75)).toBe(8);
        expect(analytics.latencyToQualityScore(150)).toBe(6);
        expect(analytics.latencyToQualityScore(300)).toBe(4);
        expect(analytics.latencyToQualityScore(750)).toBe(2);
        expect(analytics.latencyToQualityScore(2000)).toBe(1);
      });
    });
  });

  describe('Resource Monitoring', () => {
    beforeEach(async () => {
      await analytics.init('user123');
      vi.clearAllMocks();
    });

    it('should monitor memory usage periodically', async () => {
      // Find the memory monitoring interval
      const memoryInterval = mockIntervals.find(interval => interval.delay === 30000);
      expect(memoryInterval).toBeDefined();
      
      // Execute the interval callback
      await memoryInterval.callback();
      
      expect(mockElectronAPI.telemetry.monitorMemoryUsage).toHaveBeenCalledWith({
        memoryMB: 50, // 50MB from mock
        context: {
          session_id: 'session_mock-uuid-1234',
          heap_total: 100, // 100MB
          heap_limit: 200 // 200MB
        }
      });
    });

    it('should handle missing performance.memory gracefully', async () => {
      global.performance = { now: mockPerformance.now }; // Remove memory property
      
      const memoryInterval = mockIntervals.find(interval => interval.delay === 30000);
      await memoryInterval.callback();
      
      expect(mockElectronAPI.telemetry.monitorMemoryUsage).not.toHaveBeenCalled();
    });

    it('should handle memory monitoring errors', async () => {
      mockElectronAPI.telemetry.monitorMemoryUsage.mockRejectedValue(new Error('Memory monitoring failed'));
      
      const memoryInterval = mockIntervals.find(interval => interval.delay === 30000);
      await memoryInterval.callback();
      
      expect(console.warn).toHaveBeenCalledWith('[User Analytics] Memory monitoring error:', 'Memory monitoring failed');
    });
  });

  describe('Performance Observer', () => {
    beforeEach(async () => {
      await analytics.init('user123');
      vi.clearAllMocks();
    });

    it('should monitor performance entries', async () => {
      const mockEntries = [
        { entryType: 'measure', name: 'component-render', duration: 15.5, startTime: 1000 },
        { entryType: 'navigation', name: 'page-load', duration: 250, startTime: 0 }
      ];
      
      // Trigger performance observer callback
      MockPerformanceObserver.triggerEntries(mockEntries);
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockElectronAPI.telemetry.monitorComponentRender).toHaveBeenCalledWith({
        componentName: 'component-render',
        renderTime: 15.5,
        context: {
          entry_type: 'measure',
          start_time: 1000,
          session_id: 'session_mock-uuid-1234'
        }
      });
      
      expect(mockElectronAPI.telemetry.monitorComponentRender).toHaveBeenCalledWith({
        componentName: 'page-load',
        renderTime: 250,
        context: {
          entry_type: 'navigation',
          start_time: 0,
          session_id: 'session_mock-uuid-1234'
        }
      });
    });

    it('should handle missing entry names', async () => {
      const mockEntries = [
        { entryType: 'measure', duration: 10, startTime: 500 }
      ];
      
      MockPerformanceObserver.triggerEntries(mockEntries);
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockElectronAPI.telemetry.monitorComponentRender).toHaveBeenCalledWith({
        componentName: 'unknown_render',
        renderTime: 10,
        context: {
          entry_type: 'measure',
          start_time: 500,
          session_id: 'session_mock-uuid-1234'
        }
      });
    });

    it('should handle PerformanceObserver setup failure gracefully', () => {
      // Mock PerformanceObserver constructor to throw
      global.PerformanceObserver = vi.fn(() => {
        throw new Error('PerformanceObserver not supported');
      });
      
      // Create new analytics instance
      const newAnalytics = new RendererUserAnalytics();
      
      expect(console.warn).toHaveBeenCalledWith('[User Analytics] Performance observer setup failed:', 'PerformanceObserver not supported');
    });
  });

  describe('Window Event Handling', () => {
    beforeEach(async () => {
      await analytics.init('user123');
      vi.clearAllMocks();
    });

    it('should handle window focus events', async () => {
      const focusHandler = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'focus'
      )[1];
      
      await focusHandler();
      
      expect(mockElectronAPI.telemetry.recordUserAction).toHaveBeenCalledWith({
        sessionId: 'session_mock-uuid-1234',
        actionType: USER_ACTION_TYPES.WINDOW_FOCUS,
        context: {
          engagement_resumed: true,
          interaction_start_time: 1640995200000,
          time_since_last_action: expect.any(Number)
        }
      });
    });

    it('should handle window blur events and stop engagement tracking', async () => {
      // Start engagement tracking
      analytics.startEngagementTracking();
      
      const blurHandler = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'blur'
      )[1];
      
      await blurHandler();
      
      expect(mockElectronAPI.telemetry.recordUserAction).toHaveBeenCalledWith({
        sessionId: 'session_mock-uuid-1234',
        actionType: USER_ACTION_TYPES.WINDOW_BLUR,
        context: {
          engagement_paused: true,
          interaction_start_time: 1640995200000,
          time_since_last_action: expect.any(Number)
        }
      });
      
      expect(mockElectronAPI.telemetry.recordChatEngagement).toHaveBeenCalled();
    });

    it('should handle beforeunload events', async () => {
      const beforeUnloadHandler = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'beforeunload'
      )[1];
      
      await beforeUnloadHandler();
      
      expect(mockElectronAPI.telemetry.endUserSession).toHaveBeenCalledWith({
        sessionId: 'session_mock-uuid-1234'
      });
    });

    it('should handle window resize events with debouncing', async () => {
      const resizeHandler = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'resize'
      )[1];
      
      // Mock setTimeout for debouncing
      const originalSetTimeout = global.setTimeout;
      const timeouts = [];
      global.setTimeout = vi.fn((callback, delay) => {
        const id = timeouts.length;
        timeouts.push({ callback, delay, id });
        return id;
      });
      
      // Mock clearTimeout
      global.clearTimeout = vi.fn();
      
      try {
        resizeHandler();
        expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 500);
        
        // Execute the timeout callback
        const timeoutCallback = timeouts[0].callback;
        await timeoutCallback();
        
        expect(mockElectronAPI.telemetry.recordUserAction).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-1234',
          actionType: 'window_resize',
          context: {
            viewport_width: 1920,
            viewport_height: 1080,
            interaction_start_time: 1640995200000,
            time_since_last_action: expect.any(Number)
          }
        });
      } finally {
        global.setTimeout = originalSetTimeout;
      }
    });
  });

  describe('Engagement Tracking', () => {
    beforeEach(async () => {
      await analytics.init('user123');
      vi.clearAllMocks();
    });

    describe('startEngagementTracking()', () => {
      it('should start engagement tracking', () => {
        analytics.startEngagementTracking();
        
        expect(analytics.engagementStartTime).toBe(1640995200000);
      });

      it('should not reset engagement time if already tracking', () => {
        analytics.engagementStartTime = 1640995100000; // Earlier time
        
        analytics.startEngagementTracking();
        
        expect(analytics.engagementStartTime).toBe(1640995100000); // Should not change
      });
    });

    describe('stopEngagementTracking()', () => {
      it('should stop engagement tracking and record duration', async () => {
        analytics.engagementStartTime = 1640995150000; // 50 seconds ago
        
        await analytics.stopEngagementTracking();
        
        expect(mockElectronAPI.telemetry.recordChatEngagement).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-1234',
          engagementSeconds: 50
        });
        
        expect(analytics.engagementStartTime).toBe(null);
      });

      it('should not record engagement if not tracking', async () => {
        analytics.engagementStartTime = null;
        
        await analytics.stopEngagementTracking();
        
        expect(mockElectronAPI.telemetry.recordChatEngagement).not.toHaveBeenCalled();
      });
    });
  });

  describe('Data Retrieval', () => {
    beforeEach(async () => {
      await analytics.init('user123');
      vi.clearAllMocks();
    });

    describe('getAnalyticsData()', () => {
      it('should retrieve analytics data', async () => {
        const mockData = { actions: ['action1'], sessions: ['session1'] };
        mockElectronAPI.telemetry.getUserAnalyticsData.mockResolvedValue(mockData);
        
        const data = await analytics.getAnalyticsData();
        
        expect(data).toEqual(mockData);
        expect(mockElectronAPI.telemetry.getUserAnalyticsData).toHaveBeenCalled();
      });

      it('should return empty object when session not initialized', async () => {
        analytics.isInitialized = false;
        
        const data = await analytics.getAnalyticsData();
        
        expect(data).toEqual({});
        expect(mockElectronAPI.telemetry.getUserAnalyticsData).not.toHaveBeenCalled();
      });

      it('should handle retrieval failure', async () => {
        const error = new Error('Data retrieval failed');
        mockElectronAPI.telemetry.getUserAnalyticsData.mockRejectedValue(error);
        
        const data = await analytics.getAnalyticsData();
        
        expect(data).toEqual({});
        expect(console.error).toHaveBeenCalledWith('[User Analytics] Failed to get analytics data:', error);
      });
    });

    describe('getPerformanceData()', () => {
      it('should retrieve performance data', async () => {
        const mockData = { metrics: { latency: 50 } };
        mockElectronAPI.telemetry.getPerformanceData.mockResolvedValue(mockData);
        
        const data = await analytics.getPerformanceData();
        
        expect(data).toEqual(mockData);
        expect(mockElectronAPI.telemetry.getPerformanceData).toHaveBeenCalled();
      });
    });
  });

  describe('Convenience Functions', () => {
    beforeEach(async () => {
      await analytics.init('user123');
      vi.clearAllMocks();
    });

    describe('trackChatMessage()', () => {
      it('should track chat message', async () => {
        const result = await trackChatMessage({ channel: 'test' });
        
        expect(result).toBe(true);
        expect(mockElectronAPI.telemetry.recordUserAction).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-1234',
          actionType: USER_ACTION_TYPES.CHAT_SEND,
          context: {
            channel: 'test',
            interaction_start_time: 1640995200000,
            time_since_last_action: expect.any(Number)
          }
        });
      });
    });

    describe('trackEmoteUse()', () => {
      it('should track emote use', async () => {
        const result = await trackEmoteUse('Kappa', { provider: '7tv' });
        
        expect(result).toBe(true);
        expect(mockElectronAPI.telemetry.recordUserAction).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-1234',
          actionType: USER_ACTION_TYPES.EMOTE_USE,
          context: {
            emote_name: 'Kappa',
            provider: '7tv',
            interaction_start_time: 1640995200000,
            time_since_last_action: expect.any(Number)
          }
        });
      });
    });

    describe('trackChannelSwitch()', () => {
      it('should track channel switch', async () => {
        const result = await trackChannelSwitch('channel1', 'channel2', { reason: 'user_action' });
        
        expect(result).toBe(true);
        expect(mockElectronAPI.telemetry.recordUserAction).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-1234',
          actionType: USER_ACTION_TYPES.CHANNEL_SWITCH,
          context: {
            from_channel: 'channel1',
            to_channel: 'channel2',
            reason: 'user_action',
            interaction_start_time: 1640995200000,
            time_since_last_action: expect.any(Number)
          }
        });
      });
    });

    describe('trackFeatureUse()', () => {
      it('should track feature use', async () => {
        await trackFeatureUse('emote_picker', 'open', { trigger: 'button' });
        
        expect(mockElectronAPI.telemetry.recordFeatureUsage).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-1234',
          featureName: 'emote_picker',
          action: 'open',
          context: { trigger: 'button' }
        });
      });
    });

    describe('monitorUIAction()', () => {
      it('should monitor UI action with callback', async () => {
        const callback = vi.fn().mockResolvedValue('result');
        
        const severity = await monitorUIAction('scroll', callback, { direction: 'up' });
        
        expect(severity).toBe('good');
        expect(callback).toHaveBeenCalled();
      });
    });

    describe('monitorRender()', () => {
      it('should monitor component render', async () => {
        const severity = await monitorRender('TestComponent', 25, { props_count: 5 });
        
        expect(severity).toBe('good');
        expect(mockElectronAPI.telemetry.monitorComponentRender).toHaveBeenCalledWith({
          componentName: 'TestComponent',
          renderTime: 25,
          context: {
            props_count: 5,
            session_id: 'session_mock-uuid-1234'
          }
        });
      });
    });

    describe('trackConnectionQuality()', () => {
      it('should track connection quality', async () => {
        await trackConnectionQuality(8, 'manual_test');
        
        expect(mockElectronAPI.telemetry.recordConnectionQuality).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-1234',
          quality: 8,
          eventType: 'manual_test'
        });
      });

      it('should use default event type', async () => {
        await trackConnectionQuality(6);
        
        expect(mockElectronAPI.telemetry.recordConnectionQuality).toHaveBeenCalledWith({
          sessionId: 'session_mock-uuid-1234',
          quality: 6,
          eventType: 'measurement'
        });
      });
    });
  });

  describe('Constants Export', () => {
    it('should export USER_ACTION_TYPES', () => {
      expect(USER_ACTION_TYPES).toEqual({
        CHAT_SEND: 'chat_send',
        CHAT_SCROLL: 'chat_scroll',
        EMOTE_USE: 'emote_use',
        EMOTE_SEARCH: 'emote_search',
        CHANNEL_SWITCH: 'channel_switch',
        SETTINGS_CHANGE: 'settings_change',
        WINDOW_FOCUS: 'window_focus',
        WINDOW_BLUR: 'window_blur',
        THEME_CHANGE: 'theme_change',
        FILTER_TOGGLE: 'filter_toggle',
        MODERATION_ACTION: 'moderation_action'
      });
    });

    it('should export FEATURE_CATEGORIES', () => {
      expect(FEATURE_CATEGORIES).toEqual({
        CHAT: 'chat',
        EMOTES: 'emotes',
        MODERATION: 'moderation',
        CUSTOMIZATION: 'customization',
        NAVIGATION: 'navigation'
      });
    });
  });
});