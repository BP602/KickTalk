// KickTalk metrics implementation
const { metrics } = require('@opentelemetry/api');
const { SLOMonitor } = require('./slo-monitoring');
const { ErrorMonitor } = require('./error-monitoring');
const { RetryUtils } = require('./retry-utils');
const { UserAnalytics, USER_ACTION_TYPES } = require('./user-analytics');
const { performanceBudgetMonitor } = require('./performance-budget');

// Ensure a meter exists (provider is configured in instrumentation.js)
const pkg = require('../../package.json');
const meter = metrics.getMeter('kicktalk', pkg.version);

const websocketReconnections = meter.createCounter('kicktalk_websocket_reconnections_total', {
  description: 'Total number of renderer 7TV reconnection notifications',
  unit: '1'
});

const connectionErrors = meter.createCounter('kicktalk_connection_errors_total', {
  description: 'Total number of renderer 7TV connection error notifications',
  unit: '1'
});

// Message Metrics
const messageSendOutcomes = meter.createCounter('kicktalk_message_send_outcomes_total', {
  description: 'Send lifecycle transitions: attempted, API accepted, rejected, confirmed or unconfirmed',
  unit: '1'
});

const messagesReceived = meter.createCounter('kicktalk_messages_received_total', {
  description: 'Total number of messages received from chat',
  unit: '1'
});

const messageSendTransitionDuration = meter.createHistogram('kicktalk_message_send_transition_duration_seconds', {
  description: 'Elapsed time from action start to each send lifecycle transition; API acceptance is not delivery',
  unit: 's'
});

// API Metrics
const apiRequestDuration = meter.createHistogram('kicktalk_api_request_duration_seconds', {
  description: 'Time taken for API requests',
  unit: 's'
});

const apiRequests = meter.createCounter('kicktalk_api_requests_total', {
  description: 'Total number of API requests',
  unit: '1'
});

// Resource Metrics (using observableGauges for real-time values)
const memoryUsage = meter.createObservableGauge('kicktalk_memory_usage_bytes', {
  description: 'Application memory usage in bytes',
  unit: 'By'
});

const cpuUsage = meter.createObservableGauge('kicktalk_cpu_usage_percent', {
  description: 'CPU usage (user+system) seconds over interval; percent-like gauge for relative tracking',
  unit: '%'
});

const openHandles = meter.createObservableGauge('kicktalk_open_handles_total', {
  description: 'Number of open file/socket handles',
  unit: '1'
});

const rendererMemoryUsage = meter.createObservableGauge('kicktalk_renderer_memory_usage_bytes', {
  description: 'Renderer process memory usage in bytes',
  unit: 'By'
});

const domNodeCount = meter.createObservableGauge('kicktalk_dom_node_count', {
  description: 'Number of DOM nodes in the renderer process',
  unit: '1'
});

// Storage for current values
let currentRendererMemory = {
  jsHeapUsedSize: 0,
  jsHeapTotalSize: 0
};
let currentDomNodeCount = 0;

const openWindows = meter.createUpDownCounter('kicktalk_open_windows', {
  description: 'Number of open windows',
  unit: '1'
});

const upStatus = meter.createObservableGauge('kicktalk_up', {
  description: 'Application status (1=up, 0=down)',
  unit: '1'
});

const gcDuration = meter.createHistogram('kicktalk_gc_duration_seconds', {
  description: 'Garbage collection duration',
  unit: 's'
});

// 7TV Metrics
const seventvConnections = meter.createObservableGauge('kicktalk_seventv_connections_total', {
  description: 'Number of active 7TV connections',
  unit: '1'
});

const seventvWebSocketsCreated = meter.createCounter('kicktalk_seventv_websockets_created_total', {
  description: 'Total number of 7TV WebSocket connections created',
  unit: '1'
});

const seventvEmoteUpdates = meter.createCounter('kicktalk_seventv_emote_updates_total', {
  description: 'Total number of 7TV emote updates processed',
  unit: '1'
});

const seventvEmoteUpdateDuration = meter.createHistogram('kicktalk_seventv_emote_update_duration_seconds', {
  description: 'Time taken to process 7TV emote updates',
  unit: 's'
});

const seventvEmoteChanges = meter.createCounter('kicktalk_seventv_emote_changes_total', {
  description: 'Total number of individual emote changes (added/removed/updated)',
  unit: '1'
});

// Chatroom Navigation Metrics
const chatroomSwitches = meter.createCounter('kicktalk_chatroom_switches_total', {
  description: 'Total number of chatroom switches',
  unit: '1'
});

const chatroomSwitchDuration = meter.createHistogram('kicktalk_chatroom_switch_duration_seconds', {
  description: 'Time taken to switch between chatrooms',
  unit: 's'
});

// 7TV connection tracking
let currentSevenTVConnections = 0;

seventvConnections.addCallback((observableResult) => {
  observableResult.observe(currentSevenTVConnections);
});

// Callback for resource metrics
memoryUsage.addCallback((observableResult) => {
  const memUsage = process.memoryUsage();
  observableResult.observe(memUsage.heapUsed, {
    type: 'heap_used'
  });
  observableResult.observe(memUsage.heapTotal, {
    type: 'heap_total'
  });
  observableResult.observe(memUsage.rss, {
    type: 'rss'
  });
  observableResult.observe(memUsage.external, {
    type: 'external'
  });
  
  // SLO monitoring for memory usage
  SLOMonitor.checkResourceUsage('memory', memUsage.heapUsed, {
    process: 'main',
    type: 'heap_used'
  });
});

cpuUsage.addCallback((observableResult) => {
  const cpuUsageValue = process.cpuUsage();
  const totalUsage = (cpuUsageValue.user + cpuUsageValue.system) / 1000000; // Convert to seconds
  observableResult.observe(totalUsage, {
    type: 'total'
  });
});

// Handle count approximation using process._getActiveHandles (Node.js specific)
openHandles.addCallback((observableResult) => {
  try {
    // This is a Node.js internal API, use with caution
    const handles = process._getActiveHandles ? process._getActiveHandles().length : 0;
    const requests = process._getActiveRequests ? process._getActiveRequests().length : 0;
    
    observableResult.observe(handles + requests, {
      type: 'total'
    });
  } catch (_error) {
    // Fallback if internal APIs are not available
    observableResult.observe(0);
  }
});

// Application uptime status
upStatus.addCallback((observableResult) => {
  // Application is up if this callback is running
  observableResult.observe(1);
});

// Renderer memory usage callback
rendererMemoryUsage.addCallback((observableResult) => {
  observableResult.observe(currentRendererMemory.jsHeapUsedSize, { type: 'js_heap_used' });
  observableResult.observe(currentRendererMemory.jsHeapTotalSize, { type: 'js_heap_total' });
});

// DOM node count callback
domNodeCount.addCallback((observableResult) => {
  observableResult.observe(currentDomNodeCount);
});


// GC monitoring setup
try {
  const performanceObserver = require('perf_hooks').PerformanceObserver;
  
  // Monitor GC events using Performance Observer
  const gcObserver = new performanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry) => {
      if (entry.entryType === 'gc') {
        gcDuration.record(entry.duration / 1000, {
          kind: entry.detail?.kind || 'unknown'
        });
      }
    });
  });
  
  gcObserver.observe({ entryTypes: ['gc'] });
} catch (error) {
  // GC monitoring not available, continue without it
  console.warn('GC monitoring unavailable:', error.message);
}

// Metrics helper functions
// Note: Exporter and endpoints are now configured via environment (see instrumentation.js):
//   - OTEL_EXPORTER_OTLP_ENDPOINT or OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
//   - OTEL_EXPORTER_OTLP_HEADERS (e.g., Authorization=Basic base64(InstanceID:APITOKEN))
//   - OTEL_SERVICE_NAME, OTEL_RESOURCE_ATTRIBUTES, etc.
const MetricsHelper = {
  recordReconnection(chatroomId, reason = 'unknown') {
    websocketReconnections.add(1, {
      transport: 'seventv',
      chatroom_id: chatroomId,
      reason
    });
  },

  recordConnectionError(errorType, chatroomId = null) {
    const attributes = { transport: 'seventv', error_type: errorType };
    if (chatroomId) attributes.chatroom_id = chatroomId;
    
    connectionErrors.add(1, attributes);
  },

  // Message metrics
  recordSendOutcome({ outcome, messageType, duration, cause }) {
    const attributes = { outcome, message_type: messageType };
    if (cause !== undefined) attributes.cause = cause;
    messageSendOutcomes.add(1, attributes);
    messageSendTransitionDuration.record(duration, attributes);
  },

  recordMessageReceived(chatroomId, messageType = 'regular', senderId = null, streamerName = null) {
    const attributes = {
      chatroom_id: chatroomId,
      message_type: messageType
    };
    if (senderId) attributes.sender_id = senderId;
    if (streamerName) attributes.streamer_name = streamerName;
    
    messagesReceived.add(1, attributes);
  },

  // API metrics
  recordAPIRequest(endpoint, method, statusCode, duration) {
    apiRequests.add(1, {
      endpoint,
      method,
      status_code: statusCode.toString()
    });

    apiRequestDuration.record(duration, {
      endpoint,
      method,
      status_code: statusCode.toString()
    });
  },

  // Utility function to time operations
  startTimer() {
    return process.hrtime.bigint();
  },

  endTimer(startTime) {
    const endTime = process.hrtime.bigint();
    return Number(endTime - startTime) / 1e9; // Convert nanoseconds to seconds
  },

  recordGCDuration(duration, kind) {
    gcDuration.record(duration, {
      kind
    });
  },

  recordRendererMemory(memory) {
    currentRendererMemory.jsHeapUsedSize = memory.jsHeapUsedSize || 0;
    currentRendererMemory.jsHeapTotalSize = memory.jsHeapTotalSize || 0;
  },

  recordDomNodeCount(count) {
    currentDomNodeCount = count || 0;
  },

  incrementOpenWindows() {
    openWindows.add(1);
  },

  decrementOpenWindows() {
    openWindows.add(-1);
  },

  // 7TV specific metrics
  recordSevenTVConnectionHealth(chatroomsCount, connectionsCount, state) {
    currentSevenTVConnections = connectionsCount || 0;
    console.log(`[Metrics] 7TV Connection Health: ${connectionsCount} connections, ${chatroomsCount} chatrooms, state: ${state}`);
  },

  recordSevenTVWebSocketCreated(chatroomId, stvId, emoteSets) {
    const attributes = {
      chatroom_id: chatroomId
    };
    if (stvId) attributes.seventv_user_id = stvId;
    if (emoteSets) attributes.emote_sets = emoteSets;
    
    seventvWebSocketsCreated.add(1, attributes);
    console.log(`[Metrics] 7TV WebSocket created for chatroom: ${chatroomId}`);
  },

  recordSevenTVEmoteUpdate(chatroomId, pulled, pushed, updated, duration) {
    const attributes = {
      chatroom_id: chatroomId,
      pulled: pulled || 0,
      pushed: pushed || 0, 
      updated: updated || 0
    };
    
    seventvEmoteUpdates.add(1, attributes);
    
    if (duration && duration > 0) {
      seventvEmoteUpdateDuration.record(duration / 1000, attributes); // Convert ms to seconds
    }
    
    console.log(`[Metrics] 7TV Emote update: ${chatroomId} - pulled:${pulled}, pushed:${pushed}, updated:${updated}, duration:${duration}ms`);
  },

  recordSevenTVEmoteChanges(chatroomId, added, removed, updated, setType) {
    const baseAttributes = {
      chatroom_id: chatroomId,
      set_type: setType || 'channel'
    };
    
    if (added > 0) {
      seventvEmoteChanges.add(added, { ...baseAttributes, change_type: 'added' });
    }
    if (removed > 0) {
      seventvEmoteChanges.add(removed, { ...baseAttributes, change_type: 'removed' });
    }
    if (updated > 0) {
      seventvEmoteChanges.add(updated, { ...baseAttributes, change_type: 'updated' });
    }
    
    console.log(`[Metrics] 7TV Emote changes: ${chatroomId} (${setType}) - added:${added}, removed:${removed}, updated:${updated}`);
  },

  // Chatroom navigation metrics
  recordChatroomSwitch(fromChatroomId, toChatroomId, duration) {
    const attributes = {
      from_chatroom: fromChatroomId || 'none',
      to_chatroom: toChatroomId || 'none',
      switch_type: toChatroomId === 'mentions' ? 'mentions' : 'chatroom'
    };
    
    chatroomSwitches.add(1, attributes);
    
    if (duration && duration > 0) {
      const durationSeconds = duration / 1000;
      chatroomSwitchDuration.record(durationSeconds, attributes);
      
      // SLO monitoring for chatroom switch performance
      SLOMonitor.recordLatency('CHATROOM_SWITCH_DURATION', durationSeconds, attributes);
      SLOMonitor.recordOperationResult('CHATROOM_SWITCH_DURATION', true, durationSeconds, attributes);
    }
    
    console.log(`[Metrics] Chatroom switch: ${fromChatroomId || 'none'} → ${toChatroomId || 'none'}, duration: ${duration}ms`);
  },

  // Performance monitoring methods
  recordStartupDuration(phase, duration, attributes = {}) {
    const durationSeconds = duration / 1000;
    
    // Record to existing histogram
    apiRequestDuration.record(durationSeconds, {
      operation: 'startup',
      phase,
      ...attributes
    });
    
    // SLO monitoring for startup performance
    SLOMonitor.recordLatency('APP_STARTUP_DURATION', durationSeconds, {
      phase,
      ...attributes
    });
    
    console.log(`[Metrics] Startup ${phase}: ${duration}ms`);
  },

  recordMessageParsingDuration(duration, messageLength, cacheHit = false, attributes = {}) {
    const durationSeconds = duration / 1000;
    
    // SLO monitoring for message parsing performance
    SLOMonitor.recordLatency('MESSAGE_PARSER_DURATION', durationSeconds, {
      message_length: messageLength,
      cache_hit: cacheHit,
      ...attributes
    });
  },

  recordEmoteSearchDuration(duration, query, resultCount, attributes = {}) {
    const durationSeconds = duration / 1000;
    
    // SLO monitoring for emote search performance  
    SLOMonitor.recordLatency('EMOTE_SEARCH_DURATION', durationSeconds, {
      query_length: query?.length || 0,
      result_count: resultCount,
      ...attributes
    });
  },

  recordWebSocketConnectionDuration(duration, chatroomId, success = true, attributes = {}) {
    const durationSeconds = duration / 1000;
    
    // SLO monitoring for WebSocket connections
    SLOMonitor.recordLatency('WEBSOCKET_CONNECTION_TIME', durationSeconds, {
      chatroom_id: chatroomId,
      ...attributes
    });
    
    SLOMonitor.recordOperationResult('WEBSOCKET_CONNECTION_TIME', success, durationSeconds, {
      chatroom_id: chatroomId,
      ...attributes
    });
  },

  // SLO helper methods
  getSLOTarget(operation) {
    return SLOMonitor.getSLOTarget(operation);
  },

  getAllSLOTargets() {
    return SLOMonitor.getAllSLOTargets();
  },

  updatePerformanceBudget(operation, usedPercent) {
    SLOMonitor.updatePerformanceBudget(operation, usedPercent);
  },

  // Error monitoring methods
  recordError(error, context = {}) {
    return ErrorMonitor.recordError(error, context);
  },

  recordErrorRecovery(errorId, recoveryAction, success, duration = 0) {
    ErrorMonitor.recordRecovery(errorId, recoveryAction, success, duration);
  },

  async executeWithRetry(operation, options = {}) {
    return await RetryUtils.retry(operation, {
      component: 'metrics_helper',
      ...options
    });
  },

  async executeNetworkRequestWithRetry(requestFn, options = {}) {
    return await RetryUtils.retryNetworkRequest(requestFn, options);
  },

  async executeWebSocketWithRetry(connectFn, options = {}) {
    return await RetryUtils.retryWebSocketConnection(connectFn, options);
  },

  async executeSevenTVWithRetry(operationFn, options = {}) {
    return await RetryUtils.retrySevenTVOperation(operationFn, options);
  },

  getCircuitBreaker(name, options = {}) {
    return ErrorMonitor.getCircuitBreaker(name, options);
  },

  getErrorStatistics() {
    return ErrorMonitor.getErrorStatistics();
  },

  resetErrorStatistics() {
    ErrorMonitor.resetStatistics();
  },

  // User analytics methods
  startUserSession(sessionId, userId = null) {
    return UserAnalytics.startSession(sessionId, userId);
  },

  endUserSession(sessionId) {
    return UserAnalytics.endSession(sessionId);
  },

  recordUserAction(sessionId, actionType, context = {}) {
    return UserAnalytics.recordUserAction(sessionId, actionType, context);
  },

  recordFeatureUsage(sessionId, featureName, action, context = {}) {
    return UserAnalytics.recordFeatureUsage(sessionId, featureName, action, context);
  },

  recordChatEngagement(sessionId, engagementSeconds) {
    return UserAnalytics.recordChatEngagement(sessionId, engagementSeconds);
  },

  recordConnectionQuality(sessionId, quality, eventType) {
    return UserAnalytics.recordConnectionQuality(sessionId, quality, eventType);
  },

  getUserAnalyticsData() {
    return UserAnalytics.getAnalyticsData();
  },

  // Performance budget methods
  monitorUIInteraction(interactionType, executionTime, context = {}) {
    return performanceBudgetMonitor.monitorUIInteraction(interactionType, executionTime, context);
  },

  monitorComponentRender(componentName, renderTime, context = {}) {
    return performanceBudgetMonitor.monitorComponentRender(componentName, renderTime, context);
  },

  monitorWebSocketLatency(latency, context = {}) {
    return performanceBudgetMonitor.monitorWebSocketLatency(latency, context);
  },

  monitorMemoryUsage(memoryMB, context = {}) {
    return performanceBudgetMonitor.monitorMemoryUsage(memoryMB, context);
  },

  monitorCPUUsage(cpuPercent, context = {}) {
    return performanceBudgetMonitor.monitorCPUUsage(cpuPercent, context);
  },

  monitorBundleSize(bundleName, sizeKB) {
    return performanceBudgetMonitor.monitorBundleSize(bundleName, sizeKB);
  },

  getPerformanceData() {
    return performanceBudgetMonitor.getPerformanceData();
  },

  // Action type constants for consistency
  getUserActionTypes() {
    return USER_ACTION_TYPES;
  },

  // Memory management methods
  cleanupOldSessions(maxAgeMs = 24 * 60 * 60 * 1000) {
    return UserAnalytics.cleanupOldSessions(maxAgeMs);
  },

  forceCleanupSessions() {
    return UserAnalytics.forceCleanup();
  },

  getAnalyticsMemoryStats() {
    return UserAnalytics.getMemoryStats();
  }
};

module.exports = {
  meter,
  metrics: {
    websocketReconnections,
    connectionErrors,
    messageSendOutcomes,
    messagesReceived,
    messageSendTransitionDuration,
    apiRequestDuration,
    apiRequests,
    memoryUsage,
    cpuUsage,
    openHandles,
    gcDuration,
    rendererMemoryUsage,
    domNodeCount,
    openWindows,
    upStatus,
    seventvConnections,
    seventvWebSocketsCreated,
    seventvEmoteUpdates,
    seventvEmoteUpdateDuration,
    seventvEmoteChanges,
    chatroomSwitches,
    chatroomSwitchDuration
  },
  MetricsHelper
};