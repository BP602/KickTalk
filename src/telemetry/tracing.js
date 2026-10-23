/**
* Minimal OpenTelemetry NodeSDK bootstrap for Electron main process.
* - Driven entirely by standard OTEL_* env variables.
* - No custom env normalization, no manual verification spans.
* - Keep preload/renderer free of telemetry init.
*/
try {
  require('dotenv').config();
} catch {}

// Explicit binding keeps the copied runtime bootstrap and bundled main on the
// same authoritative health state; this file owns no second singleton.
module.exports = function initializeTracing({ telemetryHealth, createConsentExporter }) {
let telemetryStore;
const isExportEnabled = () => {
  try { return telemetryStore?.get('telemetry', { enabled: false })?.enabled === true; }
  catch { return false; }
};
telemetryHealth.setEnabledGetter(isExportEnabled);

// Check if telemetry is enabled in user settings
let telemetryEnabled = false;
try {
  const StoreMod = require('electron-store');
  const ElectronStore = StoreMod && StoreMod.default ? StoreMod.default : StoreMod;
  telemetryStore = new ElectronStore();
  const telemetrySettings = telemetryStore.get('telemetry', { enabled: false });
  telemetryEnabled = telemetrySettings.enabled === true;
  
  if (!telemetryEnabled) {
    console.log('[Telemetry] Telemetry disabled by user settings, skipping initialization');
    return null;
  }
} catch (error) {
  console.warn('[Telemetry] Could not check user settings:', error.message);
  return null;
}

// Only proceed with telemetry setup if enabled
if (telemetryEnabled) {
  // Best-effort resolver to handle AppImage and asar layouts
  // Tries normal require first, then falls back to app.asar.unpacked/node_modules
  function safeRequire(modName) {
  try {
    return require(modName);
  } catch (e1) {
    try {
      const path = require('path');
      const base = (process.resourcesPath || '').toString();
      if (base) {
        const candidate = path.join(base, 'app.asar.unpacked', 'node_modules', modName);
        return require(candidate);
      }
    } catch {}
    throw e1;
  }
}

  // Defer and guard all OpenTelemetry requires. In packaged builds (AppImage),
  // certain packaging layouts and asar can cause resolution issues. We avoid crashing the app
  // if any telemetry dependency is unavailable by bailing out gracefully.
  let NodeSDK,
    diag,
    DiagConsoleLogger,
    DiagLogLevel,
    OTLPTraceExporter,
    AlwaysOnSampler,
    View,
    ExplicitBucketHistogramAggregation,
    HttpInstrumentation;
  let __otelReady = true;
  try {
    ({ NodeSDK } = safeRequire('@opentelemetry/sdk-node'));
    ({ diag, DiagConsoleLogger, DiagLogLevel } = safeRequire('@opentelemetry/api'));
    ({ OTLPTraceExporter } = safeRequire('@opentelemetry/exporter-trace-otlp-http'));
    ({ AlwaysOnSampler } = safeRequire('@opentelemetry/sdk-trace-base'));
    ({ HttpInstrumentation } = safeRequire('@opentelemetry/instrumentation-http'));
    // Views are optional; load defensively to avoid runtime mismatches across package versions
    try {
      ({ View, ExplicitBucketHistogramAggregation } = safeRequire('@opentelemetry/sdk-metrics'));
    } catch {}
  } catch (requireErr) {
    console.error('[Telemetry] OpenTelemetry modules are not available, disabling telemetry:', requireErr?.message || requireErr);
    __otelReady = false;
  }

  return (async () => {
   try {
    if (!__otelReady) {
    telemetryHealth.configure('main', { configured: false, reason: 'configuration_invalid' });
    return null;
  }
   if (process.env.OTEL_DIAG_LOG_LEVEL) {
     const level = DiagLogLevel[process.env.OTEL_DIAG_LOG_LEVEL.toUpperCase()] ?? DiagLogLevel.INFO;
     diag.setLogger(new DiagConsoleLogger(), level);
   }

   // NodeSDK's environment-driven metric readers honor none/otlp, protocol and
   // OTEL_METRIC_EXPORT_INTERVAL. Validate OTLP metrics just like the trace relay.
   if ((process.env.OTEL_METRICS_EXPORTER || '').split(',').map((value) => value.trim()).includes('otlp')) {
     const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
     const endpoint = process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ??
       (base ? `${base.replace(/\/$/, '')}/v1/metrics` : '');
     if (!endpoint) throw new Error('missing_metrics_endpoint');
     const url = new URL(endpoint);
     const loopback = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname);
     if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) {
       throw new Error('insecure_or_unsupported_metrics_endpoint');
     }
     const headers = process.env.OTEL_EXPORTER_OTLP_METRICS_HEADERS ??
       process.env.OTEL_EXPORTER_OTLP_HEADERS;
     const hasAuth = (headers || '').split(',').some((entry) => {
       const index = entry.indexOf('=');
       return index > 0 && entry.slice(0, index).trim().toLowerCase() === 'authorization' &&
         entry.slice(index + 1).trim().length > 0;
     });
     if (headers === undefined || (!loopback && !hasAuth)) throw new Error('missing_metrics_auth_headers');
   }


   // Define metric Views for histograms (optional)
  let histogramViews = undefined;
  try {
    if (typeof View === 'function' && typeof ExplicitBucketHistogramAggregation === 'function') {
      histogramViews = [
        new View({
          instrumentName: 'kicktalk_slo_latency_seconds',
          aggregation: new ExplicitBucketHistogramAggregation([
            0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0
          ])
        }),
        new View({
          instrumentName: 'kicktalk_message_send_transition_duration_seconds',
          aggregation: new ExplicitBucketHistogramAggregation([
            0.01, 0.05, 0.1, 0.5, 1, 2, 5, 30, 60
          ])
        }),
        new View({
          instrumentName: 'kicktalk_api_request_duration_seconds',
          aggregation: new ExplicitBucketHistogramAggregation([
            0.1, 0.5, 1, 2, 5, 10, 30
          ])
        }),
        new View({
          instrumentName: 'kicktalk_chatroom_switch_duration_seconds',
          aggregation: new ExplicitBucketHistogramAggregation([
            0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1
          ])
        }),
        new View({
          instrumentName: 'kicktalk_seventv_emote_update_duration_seconds',
          aggregation: new ExplicitBucketHistogramAggregation([
            0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1
          ])
        })
      ];
    }
  } catch {
    histogramViews = undefined;
  }

  // Using manual HTTP instrumentation (auto-instrumentations removed for packaged builds)
  const collectorHosts = new Set([
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
  ].filter(Boolean).map((endpoint) => new URL(endpoint).hostname.replace(/^\[|\]$/g, '')));
  const instrumentations = [
    new HttpInstrumentation({
      ignoreOutgoingRequestHook: (request) => {
        try {
          const host = request?.headers?.host || request?.hostname || '';
          // Ignore OTLP exporter requests to prevent instrumentation loops
          if (host.includes('otlp-gateway')) return true;
          if (host.includes('grafana.net')) return true;
          const hostname = request?.hostname || request?.host || host;
          if (collectorHosts.has(hostname) || collectorHosts.has(hostname.replace(/:\d+$/, ''))) return true;
        } catch {}
        return false;
      }
    })
  ];
  console.log('[Telemetry] Using manual HTTP instrumentation');
    // NodeSDK creates environment-selected metric readers internally. Gate their
    // public exporter boundary (all supported OTLP protocols), not a private SDK
    // field or just the UI flag, so existing readers/intervals remain unchanged.
    for (const moduleName of [
      '@opentelemetry/exporter-metrics-otlp-http',
      '@opentelemetry/exporter-metrics-otlp-proto',
      '@opentelemetry/exporter-metrics-otlp-grpc'
    ]) {
      const { OTLPMetricExporter } = safeRequire(moduleName);
      if (Object.hasOwn(OTLPMetricExporter.prototype, '__kickTalkConsentGate')) continue;
      const originalExport = OTLPMetricExporter.prototype.export;
      Object.defineProperty(OTLPMetricExporter.prototype, '__kickTalkConsentGate', { value: true });
      OTLPMetricExporter.prototype.export = function (data, callback) {
        if (!telemetryHealth.isEnabled()) { callback({ code: 0 }); return; }
        return originalExport.call(this, data, callback);
      };
    }

    const classifyTraceResult = (result) => {
      if (result.code === 0) return 'none';
      if (Number.isInteger(result.error?.code) && result.error.code >= 400 ||
          result.error?.message === 'Export failed with retryable status') return 'receiver_rejected';
      if (['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EHOSTUNREACH'].includes(result.error?.code) ||
          /timeout/i.test(result.error?.message || '')) return 'receiver_unavailable';
      return 'export_error';
    };

    const sdk = new NodeSDK({
      traceExporter: createConsentExporter(new OTLPTraceExporter(), {
        isEnabled: () => telemetryHealth.isEnabled(),
        onResult: result => telemetryHealth.recordResult('main', classifyTraceResult(result))
      }),
      // The installed NodeSDK configures supported metric readers from OTEL_*.
      ...(histogramViews ? { views: histogramViews } : {}),
      instrumentations,
      traceSampler: new AlwaysOnSampler()
    });

     const startResult = sdk.start();
     if (startResult && typeof startResult.then === 'function') {
       await startResult;
     }
     telemetryHealth.configure('main', { configured: true });

     const shutdown = async () => {
       try { await sdk.shutdown(); } catch {}
     };
     process.on('SIGTERM', shutdown);
     process.on('SIGINT', shutdown);
     process.on('exit', shutdown);

     return sdk;
   } catch (e) {
     telemetryHealth.configure('main', { configured: false, reason: 'configuration_invalid' });
     console.error('[OTEL]: NodeSDK bootstrap failed:', e?.stack || e?.message || e);
     return null;
   }
  })();
}
};