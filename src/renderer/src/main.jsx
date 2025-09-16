import "./assets/styles/main.scss";

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Load telemetry only after the preload script has finished initializing
const loadTelemetry = () => import("./telemetry/webTracing");

// Attach when the preload bridge is available and ready; avoid eager fallback
const attachWhenPreloadReady = () => {
  const api = window.preload;
  if (api?.isReady?.()) {
    loadTelemetry();
    return true;
  }
  if (api?.onReady) {
    api.onReady(() => {
      loadTelemetry();
    });
    return true;
  }
  return false;
};

if (!attachWhenPreloadReady()) {
  // Poll briefly until the bridge is injected
  const start = Date.now();
  const timer = setInterval(() => {
    if (attachWhenPreloadReady()) {
      clearInterval(timer);
    } else if (Date.now() - start > 5000) {
      // As a last resort after 5s, still defer import to avoid racing settings
      clearInterval(timer);
      loadTelemetry();
    }
  }, 25);
}

// Global error handlers for automatic telemetry reporting
window.addEventListener('error', (event) => {
  window.app?.telemetry?.recordError?.(event.error || new Error(event.message), {
    component: 'global_error_handler',
    operation: 'unhandled_exception',
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error_source: 'window_error'
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
  window.app?.telemetry?.recordError?.(error, {
    component: 'global_error_handler',
    operation: 'unhandled_promise_rejection',
    error_source: 'promise_rejection'
  });
});

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
