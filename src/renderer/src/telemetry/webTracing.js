// Renderer OpenTelemetry bootstrap (ESM). Loads config via preload bridge to avoid bundling secrets.
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
// In sdk-trace-web v2, addSpanProcessor is not available; use SimpleSpanProcessor from sdk-trace-base
import { SimpleSpanProcessor, AlwaysOnSampler } from '@opentelemetry/sdk-trace-base';
import { context, trace } from '@opentelemetry/api';

// Check if telemetry is enabled before doing anything
let telemetryEnabled = false;
const readSettingsEnabled = () => {
  try {
    const settings = JSON.parse(localStorage.getItem('settings') || '{}');
    return settings?.telemetry?.enabled === true;
  } catch {
    return false;
  }
};
try {
  // Get telemetry settings from localStorage (synced from main process)
  telemetryEnabled = readSettingsEnabled();
  
  if (!telemetryEnabled) {
    console.log('[Renderer OTEL]: Telemetry disabled by user settings, skipping all initialization');
  }
} catch (error) {
  console.warn('[Renderer OTEL]: Could not check user settings:', error.message);
}

console.log('[DEBUG] webTracing.js module loading - telemetry enabled:', telemetryEnabled);
console.log('[DEBUG] window available:', typeof window !== 'undefined');
console.log('[DEBUG] window.WebSocket available:', typeof window?.WebSocket === 'function');

// Only install WebSocket instrumentation if telemetry is enabled
if (telemetryEnabled) {
  try {
    if (!window.__KT_WEBSOCKET_INSTRUMENTED__ && typeof window.WebSocket === 'function') {
      window.__KT_WEBSOCKET_INSTRUMENTED__ = true;
      console.log('[Renderer OTEL]: Installing WebSocket instrumentation immediately at module load');
    
    const NativeWS = window.WebSocket;
    
    const WSWrapper = function(url, protocols) {
      const urlStr = typeof url === 'string' ? url : String(url);
      let urlHost = '';
      try { urlHost = new URL(urlStr).host; } catch {}
      console.log('[WebSocket Instrumentation]: WebSocket created:', urlStr);
      
      const socket = new NativeWS(url, protocols);
      
      // Track early activity; upgrade to OTEL spans when tracer is ready
      try {
        if (!window.__KT_EARLY_WEBSOCKET_ACTIVITY__) window.__KT_EARLY_WEBSOCKET_ACTIVITY__ = [];
        const activityEntry = {
          url: urlStr,
          connectTime: Date.now(),
          events: [],
          __spanned: false,
        };
        window.__KT_EARLY_WEBSOCKET_ACTIVITY__.push(activityEntry);

        let connectSpan = null;
        let sessionSpan = null;
        const getTracer = () => (window.__KT_TRACER__ || trace.getTracer('kicktalk-renderer-websocket'));
        const ensureConnectSpan = () => {
          if (connectSpan || activityEntry.__spanned) return;
          try {
            const t = getTracer();
            if (t?.startSpan) {
              connectSpan = t.startSpan('websocket.connect', {
                attributes: {
                  'ws.url': urlStr,
                  'ws.host': urlHost,
                  'service.name': 'kicktalk-renderer',
                },
                startTime: activityEntry.connectTime,
              });
            }
          } catch {}
        };
        
        socket.addEventListener('open', () => {
          const openTime = Date.now();
          activityEntry.events.push({ type: 'open', time: openTime });
          console.log('[WebSocket Instrumentation]: WebSocket opened:', urlStr);
          try {
            ensureConnectSpan();
            if (connectSpan?.end) {
              try {
                connectSpan.addEvent?.('open');
                connectSpan.setAttribute?.('ws.readyState', socket.readyState);
              } catch {}
              connectSpan.end(openTime);
            }
            const t = getTracer();
            if (t?.startSpan) {
              sessionSpan = t.startSpan('websocket.session', {
                attributes: {
                  'ws.url': urlStr,
                  'ws.host': urlHost,
                  'service.name': 'kicktalk-renderer',
                },
                startTime: openTime,
              });
              activityEntry.__spanned = true;
            }
          } catch {}
        });
        
        socket.addEventListener('close', (event) => {
          const closeTime = Date.now();
          activityEntry.events.push({ 
            type: 'close', 
            time: closeTime, 
            code: event.code,
            wasClean: event.wasClean 
          });
          console.log('[WebSocket Instrumentation]: WebSocket closed:', urlStr, 'code:', event.code);
          try {
            if (sessionSpan?.end) {
              try {
                sessionSpan.addEvent?.('close');
                sessionSpan.setAttribute?.('ws.code', event?.code ?? 0);
                sessionSpan.setAttribute?.('ws.wasClean', !!event?.wasClean);
                if (typeof event?.reason === 'string' && event.reason) sessionSpan.setAttribute?.('ws.reason', event.reason.slice(0, 256));
              } catch {}
              sessionSpan.end(closeTime);
            } else {
              // No session (e.g., close before open). End connect instead.
              ensureConnectSpan();
              if (connectSpan?.end) {
                try {
                  connectSpan.addEvent?.('close');
                  connectSpan.setAttribute?.('ws.code', event?.code ?? 0);
                  connectSpan.setAttribute?.('ws.wasClean', !!event?.wasClean);
                  if (typeof event?.reason === 'string' && event.reason) connectSpan.setAttribute?.('ws.reason', event.reason.slice(0, 256));
                } catch {}
                connectSpan.end(closeTime);
              }
            }
          } catch {}
        });
        
        socket.addEventListener('error', (err) => {
          const time = Date.now();
          activityEntry.events.push({ type: 'error', time });
          console.log('[WebSocket Instrumentation]: WebSocket error:', urlStr);
          try {
            const targetSpan = sessionSpan || connectSpan;
            if (targetSpan) {
              targetSpan.addEvent?.('error');
              targetSpan.recordException?.(err);
              targetSpan.setStatus?.({ code: 2, message: (err?.message || String(err)) });
            }
          } catch {}
        });
        
      } catch (e) {
        console.error('[WebSocket Instrumentation]: Failed to track WebSocket:', e);
      }
      
      return socket;
    };
    
    // Preserve prototype chain and static constants
    WSWrapper.prototype = NativeWS.prototype;
    try {
      WSWrapper.CONNECTING = NativeWS.CONNECTING;
      WSWrapper.OPEN = NativeWS.OPEN;
      WSWrapper.CLOSING = NativeWS.CLOSING;
      WSWrapper.CLOSED = NativeWS.CLOSED;
    } catch {}
    
    // Replace global WebSocket immediately
    window.__KT_ORIGINAL_WEBSOCKET__ = NativeWS;
    window.WebSocket = WSWrapper;
    console.log('[Renderer OTEL]: WebSocket instrumentation installed successfully');
  } else {
    console.log('[WebSocket Instrumentation]: Already instrumented or WebSocket not available');
  }
} catch (err) {
  console.error('[WebSocket Instrumentation]: Failed to install:', err.message);
}
}

// Console Error Instrumentation - Capture console.error/warn and send to telemetry
if (telemetryEnabled && typeof window !== 'undefined') {
  try {
    if (!window.__KT_CONSOLE_INSTRUMENTED__) {
      window.__KT_CONSOLE_INSTRUMENTED__ = true;
      console.log('[Renderer OTEL]: Installing console error instrumentation');

      // Store original console methods
      const originalConsoleError = console.error;
      const originalConsoleWarn = console.warn;

      // Wrap console.error
      console.error = function(...args) {
        // Call original console.error first
        originalConsoleError.apply(console, args);

        // Send to telemetry
        try {
          // Create error message from arguments
          const errorMessage = args.map(arg =>
            typeof arg === 'string' ? arg :
            arg instanceof Error ? arg.message :
            JSON.stringify(arg)
          ).join(' ');

          // Send to telemetry if available
          if (typeof window.app?.telemetry?.recordError === 'function') {
            const error = new Error(errorMessage);
            error.stack = (new Error()).stack; // Get current stack

            window.app.telemetry.recordError(error, {
              source: 'console.error',
              operation: 'console_error_capture',
              arguments: args.length,
              timestamp: Date.now()
            });
          }
        } catch (telemetryError) {
          // Don't break console.error if telemetry fails
          originalConsoleError('[Console Instrumentation]: Telemetry error:', telemetryError.message);
        }
      };

      // Wrap console.warn for high-severity warnings
      console.warn = function(...args) {
        // Call original console.warn first
        originalConsoleWarn.apply(console, args);

        // Send critical warnings to telemetry (7TV, SLO violations, etc.)
        try {
          const warnMessage = args.join(' ');
          const isCriticalWarning = warnMessage.includes('[7TV') ||
                                  warnMessage.includes('[SLO') ||
                                  warnMessage.includes('VIOLATION') ||
                                  warnMessage.includes('CRITICAL');

          if (isCriticalWarning && typeof window.app?.telemetry?.recordError === 'function') {
            const warning = new Error(`Warning: ${warnMessage}`);
            warning.stack = (new Error()).stack;

            window.app.telemetry.recordError(warning, {
              source: 'console.warn',
              operation: 'console_warn_capture',
              severity: 'warning',
              arguments: args.length,
              timestamp: Date.now()
            });
          }
        } catch (telemetryError) {
          // Don't break console.warn if telemetry fails
        }
      };

      // Store original methods for restoration
      window.__KT_ORIGINAL_CONSOLE_ERROR__ = originalConsoleError;
      window.__KT_ORIGINAL_CONSOLE_WARN__ = originalConsoleWarn;

      console.log('[Renderer OTEL]: Console error instrumentation installed successfully');
    } else {
      console.log('[Console Instrumentation]: Already instrumented');
    }
  } catch (err) {
    console.error('[Console Instrumentation]: Failed to install:', err.message);
  }
}

// If telemetry is disabled, ensure any previous wrapper is restored
if (!telemetryEnabled && typeof window !== 'undefined') {
  try {
    if (window.__KT_ORIGINAL_WEBSOCKET__ && window.WebSocket !== window.__KT_ORIGINAL_WEBSOCKET__) {
      window.WebSocket = window.__KT_ORIGINAL_WEBSOCKET__;
      console.log('[WebSocket Instrumentation]: Telemetry disabled - restored native WebSocket');
    }
    if (window.__KT_ORIGINAL_CONSOLE_ERROR__ && console.error !== window.__KT_ORIGINAL_CONSOLE_ERROR__) {
      console.error = window.__KT_ORIGINAL_CONSOLE_ERROR__;
      console.warn = window.__KT_ORIGINAL_CONSOLE_WARN__;
      console.log('[Console Instrumentation]: Telemetry disabled - restored native console methods');
    }
  } catch {}
}

// Telemetry Level Configuration and Sampling Utilities
const getTelemetryLevel = () => {
  try {
    // Check consolidated VITE_ vars first (available to all processes), then fall back to old vars
    const level = import.meta.env.VITE_TELEMETRY_LEVEL ||
                  import.meta.env.RENDERER_VITE_TELEMETRY_LEVEL ||
                  'NORMAL';
    return level.toUpperCase();
  } catch {
    return 'NORMAL';
  }
};

const getTelemetryDebug = () => {
  try {
    // Check consolidated VITE_ vars first (available to all processes), then fall back to old vars
    return import.meta.env.VITE_TELEMETRY_DEBUG === 'true' ||
           import.meta.env.RENDERER_VITE_TELEMETRY_DEBUG === 'true';
  } catch {
    return false;
  }
};

const shouldLogDebug = () => {
  return getTelemetryDebug() || getTelemetryLevel() === 'VERBOSE';
};

const TELEMETRY_LEVELS = {
  MINIMAL: {
    priority: 1,
    description: 'Only errors, user actions, critical failures'
  },
  NORMAL: {
    priority: 2, 
    description: 'Above + slow operations (>100ms), startup events, connection changes'
  },
  VERBOSE: {
    priority: 3,
    description: 'All operations including message parsing, keystroke updates, frequent events'
  }
};

const shouldEmitTelemetry = (spanName, attributes = {}, requiredLevel = 'NORMAL') => {
  const currentLevel = getTelemetryLevel();
  const currentPriority = TELEMETRY_LEVELS[currentLevel]?.priority || 2;
  const requiredPriority = TELEMETRY_LEVELS[requiredLevel]?.priority || 2;
  
  // Always emit if current level meets or exceeds required level
  if (currentPriority >= requiredPriority) {
    return true;
  }
  
  // Special cases that bypass level restrictions:
  // 1. Error spans (always emit)
  if (spanName.includes('error') || attributes?.['error.type']) {
    return true;
  }
  
  // 2. User actions (always emit)
  if (spanName.includes('user.') || spanName.includes('chatroom.switch') || attributes?.['user.action']) {
    return true;
  }
  
  // 3. Critical operations (always emit)
  if (spanName.includes('critical') || attributes?.['span.critical']) {
    return true;
  }
  
  return false;
};

// Message parser sampling configuration
// Reduce high-volume message parser traces to 1%
const MESSAGE_PARSER_SAMPLE_RATE = 0.01; // 1% sampling
let messageParserSampleCounter = 0;

const shouldSampleMessageParser = () => {
  messageParserSampleCounter++;
  return (messageParserSampleCounter % Math.floor(1 / MESSAGE_PARSER_SAMPLE_RATE)) === 0;
};

// Lexical editor throttling
let lastLexicalUpdate = 0;
const LEXICAL_THROTTLE_MS = 1000; // 1 second
const LEXICAL_MIN_DURATION_MS = 16; // Only track if >16ms

const shouldEmitLexicalUpdate = (durationMs) => {
  const now = Date.now();
  const timeSinceLastUpdate = now - lastLexicalUpdate;
  
  // Throttle to max 1 per second and only if operation took >16ms
  if (timeSinceLastUpdate >= LEXICAL_THROTTLE_MS && durationMs > LEXICAL_MIN_DURATION_MS) {
    lastLexicalUpdate = now;
    return true;
  }
  return false;
};

// Startup phase detection
let startupPhaseEndTime = Date.now() + 30000; // 30 second startup window
let isStartupPhase = true;

const checkStartupPhase = () => {
  if (isStartupPhase && Date.now() > startupPhaseEndTime) {
    isStartupPhase = false;
    console.log('[Renderer OTEL] Startup phase ended, telemetry sampling may increase');
  }
  return isStartupPhase;
};

// Export utilities for use in components
window.__KT_TELEMETRY_UTILS__ = {
  getTelemetryLevel,
  getTelemetryDebug,
  shouldLogDebug,
  shouldEmitTelemetry,
  shouldSampleMessageParser,
  shouldEmitLexicalUpdate,
  checkStartupPhase,
  TELEMETRY_LEVELS
};

console.log(`[Renderer OTEL] Telemetry sampling initialized:`, {
  level: getTelemetryLevel(),
  messageParserSampleRate: MESSAGE_PARSER_SAMPLE_RATE,
  lexicalThrottleMs: LEXICAL_THROTTLE_MS,
  startupWindowMs: 30000
});

// Guard: run only once AND only if telemetry is enabled
if (!window.__KT_RENDERER_OTEL_INITIALIZED__ && telemetryEnabled) {
  window.__KT_RENDERER_OTEL_INITIALIZED__ = true;

  (async () => {
    try {
      // Double-check telemetry is still enabled
      const settings = JSON.parse(localStorage.getItem('settings') || '{}');
      if (settings?.telemetry?.enabled !== true) {
        console.log('[Renderer OTEL]: Telemetry disabled, skipping initialization');
        return;
      }
      
      console.log('[Renderer OTEL]: init starting...');
      // Fetch only nonsecret routing metadata from main via the preload bridge.
      const cfg = await window?.telemetry?.getOtelConfig?.();
      if (!cfg || !cfg.ok) {
        console.warn('[Renderer OTEL]: Missing or invalid OTLP config from preload bridge:', cfg?.reason);
        return;
      }
 
      const { deploymentEnv, appVersion } = cfg;

      // SDK processors export finalized ReadableSpans; only main owns the OTLP transport/auth.
      class IPCSpanExporter {
        async export(spans, resultCallback) {
          let result;
          try {
            const response = await window.telemetry.exportTracesJson(this._toOtlpJson(spans));
            const ok = response?.ok && (!response.status || (response.status >= 200 && response.status < 300));
            result = ok
              ? { code: 0 }
              : { code: 1, error: new Error(`OTLP IPC export failed (${response?.status || 'no response'})`) };
            if (shouldLogDebug()) {
              console.debug('[Renderer OTEL] IPC export completed', {
                spanCount: spans.length,
                ok: !!ok,
                status: response?.status
              });
            }
          } catch (error) {
            result = { code: 1, error };
          }
          if (result.code !== 0) this._exportError ||= result.error;
          resultCallback(result);
        }

        async forceFlush() {
          // SimpleSpanProcessor waits for its pending IPC callbacks before invoking this hook.
          const error = this._exportError;
          this._exportError = undefined;
          if (error) throw error;
        }

        async shutdown() {
          await this.forceFlush();
        }

        _toOtlpJson(spans) {
          // SDK HrTime values are epoch seconds plus nanoseconds, including event timestamps.
          const toEpochNanos = ([seconds, nanos]) =>
            (BigInt(seconds) * 1000000000n + BigInt(nanos)).toString();
          const toAnyValue = (value) => {
            if (Array.isArray(value)) {
              return { arrayValue: { values: value.slice(0, 64).map(toAnyValue) } };
            }
            switch (typeof value) {
              case 'boolean': return { boolValue: value };
              case 'number':
                if (!Number.isFinite(value)) return { doubleValue: 0 };
                return Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value };
              default: return { stringValue: String(value ?? '').slice(0, 4096) };
            }
          };
          const toAttributes = (attributes = {}) => {
            const result = [];
            const keys = new Set();
            for (const name of Object.keys(attributes)) {
              const key = name.slice(0, 128);
              if (!key || keys.has(key)) continue;
              keys.add(key);
              result.push({ key, value: toAnyValue(attributes[name]) });
              if (result.length >= 128) break;
            }
            return result;
          };
          const traceState = (spanContext) => spanContext.traceState?.serialize() || '';
          const toSpan = (span) => {
            const spanContext = span.spanContext();
            // OpenTelemetry API SpanKind is zero-based; OTLP reserves zero for UNSPECIFIED.
            const kind = Number.isInteger(span.kind) && span.kind >= 0 && span.kind <= 4
              ? span.kind + 1 : 0;
            const result = {
              traceId: spanContext.traceId,
              spanId: spanContext.spanId,
              traceState: traceState(spanContext),
              flags: spanContext.traceFlags,
              name: span.name.slice(0, 255),
              kind,
              startTimeUnixNano: toEpochNanos(span.startTime),
              endTimeUnixNano: toEpochNanos(span.endTime),
              attributes: toAttributes(span.attributes),
              droppedAttributesCount: span.droppedAttributesCount,
              events: span.events.map(event => ({
                timeUnixNano: toEpochNanos(event.time),
                name: event.name,
                attributes: toAttributes(event.attributes),
                droppedAttributesCount: event.droppedAttributesCount
              })),
              droppedEventsCount: span.droppedEventsCount,
              links: span.links.map(link => ({
                traceId: link.context.traceId,
                spanId: link.context.spanId,
                traceState: traceState(link.context),
                flags: link.context.traceFlags,
                attributes: toAttributes(link.attributes),
                droppedAttributesCount: link.droppedAttributesCount
              })),
              droppedLinksCount: span.droppedLinksCount,
              status: { code: span.status.code, message: span.status.message || '' }
            };
            if (span.parentSpanContext) result.parentSpanId = span.parentSpanContext.spanId;
            return result;
          };

          // Preserve resource/scope boundaries rather than attributing every span to the first tracer.
          const resources = new Map();
          for (const span of spans) {
            let group = resources.get(span.resource);
            if (!group) {
              group = {
                resource: { attributes: toAttributes(span.resource.attributes) },
                scopeSpans: [],
                scopes: new Map()
              };
              resources.set(span.resource, group);
            }
            const scope = span.instrumentationScope;
            const scopeKey = JSON.stringify([scope.name, scope.version, scope.schemaUrl]);
            let scopeGroup = group.scopes.get(scopeKey);
            if (!scopeGroup) {
              scopeGroup = {
                scope: { name: scope.name, ...(scope.version ? { version: scope.version } : {}) },
                ...(scope.schemaUrl ? { schemaUrl: scope.schemaUrl } : {}),
                spans: []
              };
              group.scopes.set(scopeKey, scopeGroup);
              group.scopeSpans.push(scopeGroup);
            }
            scopeGroup.spans.push(toSpan(span));
          }
          return {
            resourceSpans: Array.from(resources.values(), ({ resource, scopeSpans }) => ({
              resource,
              scopeSpans
            }))
          };
        }
      }

      let instanceId = crypto.randomUUID();
      try {
        instanceId = localStorage.getItem('kt_service_instance_id') || instanceId;
        localStorage.setItem('kt_service_instance_id', instanceId);
      } catch {
        // Storage may be unavailable; use this renderer's generated instance ID.
      }
      const exporter = new IPCSpanExporter();
      const provider = new WebTracerProvider({
        sampler: new AlwaysOnSampler(),
        resource: defaultResource().merge(resourceFromAttributes({
          'service.name': 'kicktalk-renderer',
          'service.namespace': 'kicktalk',
          'service.version': appVersion,
          'service.instance.id': instanceId,
          'deployment.environment': deploymentEnv || 'development'
        })),
        spanProcessors: [new SimpleSpanProcessor(exporter)]
      });
      // Use the default context manager to avoid ZoneContextManager CSP issues in Electron.
      provider.register({});
      window.__KT_TRACE_API__ = { trace, context };
      window.__KT_OTEL_PROVIDER__ = provider;
      // Log early WebSocket activity for debugging
      try {
        const ea = window.__KT_EARLY_WEBSOCKET_ACTIVITY__;
        const list = Array.isArray(ea) ? ea : [];
        console.log('[Renderer OTEL]: Early WebSocket activity captured:', list.length, 'connections');
        list.forEach((activity, i) => {
          try {
            const url = activity?.url ?? '(unknown)';
            const ct = typeof activity?.connectTime === 'number' ? activity.connectTime : NaN;
            const duration = Number.isFinite(ct) ? Math.max(0, Date.now() - ct) : NaN;
            const evArr = Array.isArray(activity?.events) ? activity.events : [];
            const events = evArr.map?.(e => e?.type ?? 'unknown')?.join?.(', ') ?? '';
            console.log(`[Renderer OTEL]: WebSocket ${i + 1}: ${url} (${Number.isFinite(duration) ? duration : 'n/a'}ms ago, events: ${events})`);
          } catch (inner) {
            console.warn('[Renderer OTEL]: Failed to log early WebSocket item', i, inner?.message || inner);
          }
        });
      } catch (e) {
        console.warn('[Renderer OTEL]: Failed to read early WebSocket activity', e?.message || e);
      }

      // DEV-ONLY: Emit a test span to verify exporter pipeline in development
      if (process.env.NODE_ENV === 'development') {
        try {
          const testTracer = trace.getTracer('kicktalk-renderer');
          const s = testTracer.startSpan('renderer_export_smoke');
          s.end();
          if (typeof provider.forceFlush === 'function') {
            provider.forceFlush().catch(() => {});
          }
        } catch {}
      }

      // Expose provider globally for diagnostics/flush and add periodic flush
      try {
        window.__KT_OTEL_PROVIDER__ = provider;
        window.__KT_TRACER__ = trace.getTracer('kicktalk-renderer');
        if (typeof provider.forceFlush === 'function') {
          // Configurable periodic forceFlush interval (defaults to 60s, min threshold applied)
          const defaultFlushMs = 60000; // safer production default
          const minFlushMs = 30000; // enforce minimum threshold
          let flushIntervalMs = defaultFlushMs;
          try {
            const val = Number(import.meta.env.RENDERER_VITE_OTEL_FLUSH_INTERVAL_MS);
            const candidate = Number.isFinite(val) && val > 0 ? Math.round(val) : defaultFlushMs;
            flushIntervalMs = Math.max(candidate, minFlushMs);
          } catch {}
          console.debug('[Renderer OTEL] flush', flushIntervalMs, 'ms');
          setInterval(async () => {
            try {
              const t0 = performance.now?.() || Date.now();
              await provider.forceFlush();
              const t1 = performance.now?.() || Date.now();
              console.debug('[Renderer OTEL] periodic forceFlush ok', Math.round(t1 - t0), 'ms');
            } catch (e) {
              console.debug('[Renderer OTEL] periodic forceFlush error', e?.message || e);
            }
          }, flushIntervalMs);
          // One-time delayed flush to catch early spans
          setTimeout(async () => {
            try {
              await provider.forceFlush();
              console.debug('[Renderer OTEL] initial delayed forceFlush ok');
            } catch (e) {
              console.debug('[Renderer OTEL] initial delayed forceFlush error', e?.message || e);
            }
          }, 1000);
        } else {
          console.debug('[Renderer OTEL] provider registered; forceFlush not available');
        }
      } catch (e) {
        console.debug('[Renderer OTEL] failed to expose provider', e?.message || e);
      }

      // Backfill early WebSocket activity into OTEL spans once tracer is ready
      try {
        const t = window.__KT_TRACER__ || trace.getTracer('kicktalk-renderer-websocket');
        const early = window.__KT_EARLY_WEBSOCKET_ACTIVITY__ || [];
        for (const a of early) {
          if (a.__spanned) continue;
          let urlHost = ''; try { urlHost = new URL(a.url).host; } catch {}
          const openEvt = a.events.find(e => e.type === 'open');
          const closeEvt = a.events.find(e => e.type === 'close');
          const errEvt = a.events.find(e => e.type === 'error');

          const connect = t.startSpan('websocket.connect', {
            attributes: { 'ws.url': a.url, 'ws.host': urlHost, 'service.name': 'kicktalk-renderer' },
            startTime: a.connectTime,
          });

          if (openEvt) {
            connect.addEvent?.('open');
            connect.end(openEvt.time);
            const session = t.startSpan('websocket.session', {
              attributes: { 'ws.url': a.url, 'ws.host': urlHost, 'service.name': 'kicktalk-renderer' },
              startTime: openEvt.time,
            });
            if (errEvt) session.addEvent?.('error');
            if (closeEvt) {
              session.setAttribute?.('ws.code', closeEvt.code ?? 0);
              session.setAttribute?.('ws.wasClean', !!closeEvt.wasClean);
              if (typeof closeEvt.reason === 'string' && closeEvt.reason) session.setAttribute?.('ws.reason', closeEvt.reason.slice(0, 256));
              session.end(closeEvt.time);
            } else {
              session.end();
            }
          } else {
            if (errEvt) connect.addEvent?.('error');
            if (closeEvt) {
              connect.setAttribute?.('ws.code', closeEvt.code ?? 0);
              connect.setAttribute?.('ws.wasClean', !!closeEvt.wasClean);
              if (typeof closeEvt.reason === 'string' && closeEvt.reason) connect.setAttribute?.('ws.reason', closeEvt.reason.slice(0, 256));
              connect.end(closeEvt.time);
            } else {
              connect.end();
            }
          }
          a.__spanned = true;
        }
        if (typeof window.__KT_OTEL_PROVIDER__?.forceFlush === 'function') {
          window.__KT_OTEL_PROVIDER__.forceFlush().catch(() => {});
        }
      } catch {}

      // Establish a sampled parent span to ensure children (fetch/XHR) are recorded
      const tracer = trace.getTracer('kicktalk-renderer');
      const parent = tracer.startSpan('renderer_parent_sampling_enforcer', {
        attributes: {
          'service.name': 'kicktalk-renderer',
          'deployment.environment': deploymentEnv || 'development',
          'service.namespace': 'kicktalk'
        }
      });
      const activeCtx = trace.setSpan(context.active(), parent);

      registerInstrumentations({
        instrumentations: [
          new FetchInstrumentation({
            propagateTraceHeaderCorsUrls: /.*/,
          }),
          new XMLHttpRequestInstrumentation({}),
        ],
      });

      

      // Temporary sampling wrapper: ensure ALL renderer fetch/XHR run under a recording parent
      try {
        const tracerShim = trace.getTracer('kicktalk-renderer-wrap');

        // Patch window.fetch
        if (typeof window.fetch === 'function') {
          const origFetch = window.fetch.bind(window);
          window.fetch = async (...args) => {
            const parentSpan = tracerShim.startSpan('renderer_fetch_parent', {
              attributes: {
                'service.name': 'kicktalk-renderer',
                'otel.wrapper': 'fetch',
              }
            });
            try {
              return await context.with(trace.setSpan(context.active(), parentSpan), async () => {
                return await origFetch(...args);
              });
            } catch (e) {
              try { parentSpan.recordException?.(e); } catch {}
              throw e;
            } finally {
              try { parentSpan.end(); } catch {}
            }
          };
        }

        // Patch XMLHttpRequest send
        if (typeof window.XMLHttpRequest === 'function') {
          const XHRProto = window.XMLHttpRequest.prototype;
          const origSend = XHRProto.send;
          XHRProto.send = function patchedSend(...args) {
            const parentSpan = tracerShim.startSpan('renderer_xhr_parent', {
              attributes: {
                'service.name': 'kicktalk-renderer',
                'otel.wrapper': 'xhr',
              }
            });
            try {
              return context.with(trace.setSpan(context.active(), parentSpan), () => {
                return origSend.apply(this, args);
              });
            } catch (e) {
              try { parentSpan.recordException?.(e); } catch {}
              throw e;
            } finally {
              try { parentSpan.end(); } catch {}
            }
          };
        }
      } catch (e) {
        console.warn('[Renderer OTEL]: Failed to apply sampling wrappers:', e?.message || e);
      }

      try { parent.end(); } catch {}

      // Smoke test span so you can confirm visibility
      try {
        const boot = tracer.startSpan('renderer_boot', {
          attributes: {
            'service.name': 'kicktalk-renderer',
            'deployment.environment': deploymentEnv || 'development',
          }
        });
        boot.end();
        // emit one more span after a tick to ensure exporter pipeline runs
        queueMicrotask(() => {
          try {
            const t = tracer.startSpan('renderer_boot_post_tick');
            t.end();
          } catch {}
        });
      } catch (e) {
        console.warn('[Renderer OTEL]: Failed to emit renderer_boot span:', e?.message || e);
      }

      // Manual diagnostics use the same SDK pipeline as application spans, with no second export.
      const emitDiagnosticSpan = async (name) => {
        const testId = crypto.randomUUID();
        let spanContext;
        try {
          const span = trace.getTracer('kicktalk-diagnostics', appVersion).startSpan(name, {
            attributes: { 'test.id': testId, 'otel.helper': name }
          });
          spanContext = span.spanContext();
          span.addEvent('diagnostic_started');
          await new Promise(resolve => setTimeout(resolve, 250));
          span.addEvent('diagnostic_completed');
          span.end();
          await provider.forceFlush();
          return { success: true, testId, traceId: spanContext.traceId, spanId: spanContext.spanId };
        } catch (error) {
          return { success: false, testId, traceId: spanContext?.traceId, error: error.message };
        }
      };
      Object.defineProperty(window, 'emitRendererTestSpan', {
        configurable: true,
        value: () => emitDiagnosticSpan('renderer_manual_test')
      });
      Object.defineProperty(window, 'verifyGrafanaTraces', {
        configurable: true,
        value: () => emitDiagnosticSpan('grafana_verification_test')
      });
      Object.defineProperty(window, 'verifyGrafanaTracesFullCycle', {
        configurable: true,
        value: async (options = {}) => {
          const sendResult = await window.verifyGrafanaTraces();
          if (!sendResult.success) return { ...sendResult, step: 'send' };
          try {
            if (typeof window.telemetry?.readTrace !== 'function') {
              throw new Error('Trace readback is unavailable in the preload bridge');
            }
            await new Promise(resolve => setTimeout(resolve, options.waitMs ?? 5000));
            const readResult = await window.telemetry.readTrace(sendResult.traceId);
            if (!readResult.success) {
              return { success: false, step: 'read', sendResult, readResult };
            }
            const data = readResult.data;
            const spans = (data?.batches || data?.resourceSpans || []).flatMap(resource =>
              (resource.scopeSpans || resource.instrumentationLibrarySpans || []).flatMap(scope => scope.spans || []));
            // Tempo readback uses protobuf JSON (base64 IDs); OTLP JSON uses hex IDs.
            const spanIdBase64 = btoa(String.fromCharCode(
              ...sendResult.spanId.match(/../g).map(byte => parseInt(byte, 16))));
            const found = spans.some(span => span.spanId === sendResult.spanId || span.spanId === spanIdBase64);
            return {
              success: found,
              step: found ? 'complete' : 'read',
              traceId: sendResult.traceId,
              sendResult,
              readResult,
              ...(found ? {} : { error: 'Readback did not contain the emitted diagnostic span' })
            };
          } catch (error) {
            return { success: false, step: 'read', sendResult, error: error.message };
          }
        }
      });

      console.log('[Renderer OTEL]: Web tracer initialized for kicktalk-renderer (IPC relay)');
    } catch (e) {
      console.error('[Renderer OTEL]: Setup failed:', e?.message || e);
    }
  })();
} else if (!telemetryEnabled) {
  console.log('[Renderer OTEL]: Telemetry disabled by user settings, skipping OTEL initialization');
}
