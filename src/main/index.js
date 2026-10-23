/* Telemetry bootstrap (NodeSDK OTLP -> Grafana Cloud)
   Simplified: map electron-vite MAIN_VITE_* envs to OTEL_* before starting SDK.
*/
import dotenv from "dotenv";
dotenv.config();

// Map MAIN_VITE_* (electron-vite main-scoped) into standard OTEL_* before SDK starts
try {
  // Note: when using electron-vite, MAIN_VITE_* are build-time embedded via import.meta.env
  const env = process.env;
  const mapFromImportMeta = (src, dest, runtimeBase) => {
    if (env[dest] === undefined && runtimeBase === undefined && import.meta.env[src] !== undefined) {
      env[dest] = import.meta.env[src];
    }
  };
  // A runtime unified override also supersedes compiled per-signal defaults.
  const runtimeEndpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const runtimeHeaders = env.OTEL_EXPORTER_OTLP_HEADERS;
  for (const signal of ['TRACES', 'METRICS']) {
    mapFromImportMeta(`MAIN_VITE_OTEL_EXPORTER_OTLP_${signal}_ENDPOINT`, `OTEL_EXPORTER_OTLP_${signal}_ENDPOINT`, runtimeEndpoint);
    mapFromImportMeta(`MAIN_VITE_OTEL_EXPORTER_OTLP_${signal}_HEADERS`, `OTEL_EXPORTER_OTLP_${signal}_HEADERS`, runtimeHeaders);
  }
  mapFromImportMeta("MAIN_VITE_OTEL_EXPORTER_OTLP_ENDPOINT", "OTEL_EXPORTER_OTLP_ENDPOINT");
  mapFromImportMeta("MAIN_VITE_OTEL_EXPORTER_OTLP_HEADERS", "OTEL_EXPORTER_OTLP_HEADERS");
  // SDK HTTP exporters merge unified and signal headers, even when a signal
  // override is explicitly empty. Materialize the effective headers per signal
  // so loopback exports cannot inherit compiled Cloud credentials.
  if (env.OTEL_EXPORTER_OTLP_HEADERS !== undefined) {
    for (const signal of ['TRACES', 'METRICS', 'LOGS']) {
      const key = `OTEL_EXPORTER_OTLP_${signal}_HEADERS`;
      if (env[key] === undefined) env[key] = env.OTEL_EXPORTER_OTLP_HEADERS;
    }
    env.OTEL_EXPORTER_OTLP_HEADERS = '';
  }
  mapFromImportMeta("MAIN_VITE_OTEL_DIAG_LOG_LEVEL", "OTEL_DIAG_LOG_LEVEL");
  mapFromImportMeta("MAIN_VITE_OTEL_DEPLOYMENT_ENV", "OTEL_DEPLOYMENT_ENV");
  // Optional: allow MAIN_VITE_OTEL_SERVICE_NAME to override service.name
  mapFromImportMeta("MAIN_VITE_OTEL_SERVICE_NAME", "OTEL_SERVICE_NAME");

  // If you want to push deployment env into resource attributes, set OTEL_RESOURCE_ATTRIBUTES accordingly.
  if (!env.OTEL_RESOURCE_ATTRIBUTES) {
    const attrs = [];
    if (env.OTEL_SERVICE_NAME) attrs.push(`service.name=${env.OTEL_SERVICE_NAME}`);
    if (env.OTEL_DEPLOYMENT_ENV) attrs.push(`deployment.environment=${env.OTEL_DEPLOYMENT_ENV}`);
    if (attrs.length) env.OTEL_RESOURCE_ATTRIBUTES = attrs.join(",");
  }
} catch {}

const { app, shell, BrowserWindow, ipcMain, screen, session, Tray, Menu, dialog, Notification } = require("electron");
import { KickRealtimeController } from "./services/kickRealtime.cjs";
import { createKickRealtimeTelemetry } from "./services/kickRealtimeTelemetry.cjs";
import { createRealtimeSessionProvider } from "./services/kickRealtimeSession.cjs";
import { createLiveNotifier } from "./services/liveNotification.cjs";
import { buildStreamlinkArgs } from "./services/streamlinkArgs.cjs";
import { CHAT_ERROR_CODES } from "../../utils/constants";
import { telemetryHealth, createConsentExporter } from "./services/telemetryHealth.cjs";
const { pathToFileURL } = require("node:url");
const appVersion = app.getVersion();
// Resource detection happens during SDK startup, not after it.
const resourceAttributes = (process.env.OTEL_RESOURCE_ATTRIBUTES || '')
  .split(',').map((value) => value.trim()).filter(Boolean)
  .filter((value) => !value.startsWith('service.version='));
resourceAttributes.push(`service.version=${appVersion}`);
if (!resourceAttributes.some((value) => value.startsWith('service.name='))) {
  resourceAttributes.push(`service.name=${process.env.OTEL_SERVICE_NAME || 'kicktalk'}`);
}
process.env.OTEL_RESOURCE_ATTRIBUTES = resourceAttributes.join(',');

// Use the same normalized runtime configuration for the SDK and renderer relay.
const getOtelRelayConfig = () => {
  const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const endpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
    (base ? `${base.replace(/\/$/, '')}/v1/traces` : '');
  if (!endpoint) throw new Error('missing_endpoint');
  const url = new URL(endpoint);
  const loopback = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) {
    throw new Error('insecure_or_unsupported_endpoint');
  }
  const headersRaw = process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS ??
    process.env.OTEL_EXPORTER_OTLP_HEADERS;
  const headers = {};
  for (const entry of (headersRaw || '').split(',')) {
    const index = entry.indexOf('=');
    if (index <= 0) continue;
    const key = entry.slice(0, index).trim();
    const value = decodeURIComponent(entry.slice(index + 1).trim());
    if (key && value) headers[key] = value;
  }
  const hasAuth = Object.keys(headers).some((key) => key.toLowerCase() === 'authorization');
  if (headersRaw === undefined || (!loopback && !hasAuth)) {
    throw new Error('missing_auth_headers');
  }
  return { url, headers };
};
const configurationReason = (error) => error?.message === 'missing_endpoint'
  ? 'configuration_missing' : 'configuration_invalid';


// Validate the effective destination before starting any exporter.
try {
  getOtelRelayConfig();
  require('../telemetry/tracing.js')({ telemetryHealth, createConsentExporter });
} catch (error) {
  const reason = configurationReason(error);
  telemetryHealth.configure('main', { configured: false, reason });
  telemetryHealth.configure('renderer', { configured: false, reason });
  console.warn('[Telemetry] Invalid OTLP configuration, skipping initialization:', error.message);
}

// Create a quick manual span to verify traces flow at startup
try {
  const { trace } = require('@opentelemetry/api');
  const tracer = trace.getTracer('kicktalk-main');
  const span = tracer.startSpan('main_startup_boot');
  span.setAttribute('process.type', 'electron-main');
  span.setAttribute('node.env', process.env.NODE_ENV || 'unknown');
  span.addEvent('main_startup_boot:begin');

  // End the span on next tick to ensure it gets exported even on fast startup
  process.nextTick(() => {
    try {
      span.addEvent('main_startup_boot:end');
      span.end();
    } catch {}
  });
} catch (e) {
  console.warn('[Telemetry]: Failed to create startup span:', e?.message || e);
}

import { join, basename } from "path";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import { update } from "./utils/update";
import Store from "electron-store";
import store from "../../utils/config";
import fs from "fs";
import { randomUUID, randomBytes } from "crypto";
import { spawn } from "child_process";

// Reusable crypto-grade request ID generator
const genRequestId = () => {
  try {
    if (typeof randomUUID === 'function') return randomUUID();
  } catch {}
  try {
    return randomBytes(16).toString('hex');
  } catch {}
  // Fallback (should rarely be used)
  return Math.random().toString(36).substring(2, 10);
};

// Initialize telemetry early if enabled
let initTelemetry = null;
let shutdownTelemetry = null;
let isTelemetryEnabled = () => false; // Default fallback

// Function to check telemetry settings from main process
const checkTelemetrySettings = () => {
  // Check user settings
  try {
    // Use the same store approach as elsewhere in the codebase
    const settings = store.get('telemetry', { enabled: false });
    return settings.enabled === true;
  } catch (error) {
    console.warn('[Telemetry]: Could not access settings store:', error.message);
    return false;
  }
};

try {
  // Legacy telemetry disabled: NodeSDK bootstrap runs at file start
  // Override the telemetry enabled check with our main process version
  isTelemetryEnabled = checkTelemetrySettings;

  // Initialization still occurs only at startup; runtime consent gates exporters.
  telemetryHealth.setEnabledGetter(checkTelemetrySettings);
} catch (error) {
  console.warn('[Telemetry]: Telemetry module skipped:', error.message);
}

// Telemetry IPC relay: renderer sends OTLP JSON to main; HTTPS or loopback-only HTTP.
// Bypasses renderer CORS and keeps network in a more trusted boundary; main validates/sanitizes payloads and blocks direct renderer outbound requests.
const isDev = process.env.NODE_ENV === "development";
const iconPath = process.platform === "win32"
  ? join(__dirname, "../../resources/icons/win/KickTalk_v1.ico")
  : join(__dirname, "../../resources/icons/KickTalk_v1.png");


// Telemetry debug configuration for main process
const getTelemetryDebug = () => {
  try {
    // Check consolidated VITE_ vars first (available to all processes), then fall back to old vars
    return import.meta.env.VITE_TELEMETRY_DEBUG === 'true' ||
           import.meta.env.MAIN_VITE_TELEMETRY_DEBUG === 'true';
  } catch {
    return false;
  }
};

const getTelemetryLevel = () => {
  try {
    // Check consolidated VITE_ vars first (available to all processes), then fall back to old vars
    const level = import.meta.env.VITE_TELEMETRY_LEVEL ||
                  import.meta.env.MAIN_VITE_TELEMETRY_LEVEL ||
                  'NORMAL';
    return level.toUpperCase();
  } catch {
    return 'NORMAL';
  }
};

const shouldLogDebug = () => {
  return getTelemetryDebug() || getTelemetryLevel() === 'VERBOSE';
};

// Load metrics with fallback
let metrics = null;
try {
  // Legacy metrics moved: prefer the new helper from src/telemetry/metrics.js
  const metricsModule = require("../telemetry/metrics.js");
  // Expose helper API expected by the main process
  metrics = {
    incrementOpenWindows: metricsModule.MetricsHelper?.incrementOpenWindows || (() => {}),
    decrementOpenWindows: metricsModule.MetricsHelper?.decrementOpenWindows || (() => {}),
    recordSendOutcome: metricsModule.MetricsHelper?.recordSendOutcome || (() => {}),
    // API metrics
    recordAPIRequest: metricsModule.MetricsHelper?.recordAPIRequest || (() => {}),
    recordMessageReceived: metricsModule.MetricsHelper?.recordMessageReceived || (() => {}),
    recordRendererMemory: metricsModule.MetricsHelper?.recordRendererMemory || (() => {}),
    recordDomNodeCount: metricsModule.MetricsHelper?.recordDomNodeCount || (() => {}),
    recordConnectionError: metricsModule.MetricsHelper?.recordConnectionError || (() => {}),
    recordReconnection: metricsModule.MetricsHelper?.recordReconnection || (() => {}),
    recordChatroomSwitch: metricsModule.MetricsHelper?.recordChatroomSwitch || (() => {}),
    startUserSession: metricsModule.MetricsHelper?.startUserSession || (() => {}),
    endUserSession: metricsModule.MetricsHelper?.endUserSession || (() => {}),
    recordUserAction: metricsModule.MetricsHelper?.recordUserAction || (() => {}),
    recordFeatureUsage: metricsModule.MetricsHelper?.recordFeatureUsage || (() => {}),
    recordChatEngagement: metricsModule.MetricsHelper?.recordChatEngagement || (() => {}),
    recordConnectionQuality: metricsModule.MetricsHelper?.recordConnectionQuality || (() => {}),
    getUserAnalyticsData: metricsModule.MetricsHelper?.getUserAnalyticsData || (() => ({})),
    // 7TV metrics
    recordSevenTVConnectionHealth: metricsModule.MetricsHelper?.recordSevenTVConnectionHealth || (() => {}),
    recordSevenTVWebSocketCreated: metricsModule.MetricsHelper?.recordSevenTVWebSocketCreated || (() => {}),
    recordSevenTVEmoteUpdate: metricsModule.MetricsHelper?.recordSevenTVEmoteUpdate || (() => {}),
    recordSevenTVEmoteChanges: metricsModule.MetricsHelper?.recordSevenTVEmoteChanges || (() => {}),
    // Performance monitoring methods
    recordStartupDuration: metricsModule.MetricsHelper?.recordStartupDuration || (() => {}),
    recordMessageParsingDuration: metricsModule.MetricsHelper?.recordMessageParsingDuration || (() => {}),
    recordEmoteSearchDuration: metricsModule.MetricsHelper?.recordEmoteSearchDuration || (() => {}),
    recordWebSocketConnectionDuration: metricsModule.MetricsHelper?.recordWebSocketConnectionDuration || (() => {}),
    getSLOTarget: metricsModule.MetricsHelper?.getSLOTarget || (() => {}),
    getAllSLOTargets: metricsModule.MetricsHelper?.getAllSLOTargets || (() => {}),
    updatePerformanceBudget: metricsModule.MetricsHelper?.updatePerformanceBudget || (() => {}),
    // Error monitoring methods
    recordError: metricsModule.MetricsHelper?.recordError || (() => {}),
    recordErrorRecovery: metricsModule.MetricsHelper?.recordErrorRecovery || (() => {}),
    executeWithRetry: metricsModule.MetricsHelper?.executeWithRetry || (async (op) => await op()),
    executeNetworkRequestWithRetry: metricsModule.MetricsHelper?.executeNetworkRequestWithRetry || (async (op) => await op()),
    executeWebSocketWithRetry: metricsModule.MetricsHelper?.executeWebSocketWithRetry || (async (op) => await op()),
    executeSevenTVWithRetry: metricsModule.MetricsHelper?.executeSevenTVWithRetry || (async (op) => await op()),
    getCircuitBreaker: metricsModule.MetricsHelper?.getCircuitBreaker || (() => ({})),
    getErrorStatistics: metricsModule.MetricsHelper?.getErrorStatistics || (() => ({})),
  };
} catch (error) {
  console.warn('[Telemetry]: Failed to load metrics helper:', error.message);
  // Fallback no-op metrics (Phase 4 methods)
  metrics = {
    incrementOpenWindows: () => {},
    decrementOpenWindows: () => {},
    recordSendOutcome: () => {},
    // API metrics no-op
    recordAPIRequest: () => {},
    recordMessageReceived: () => {},
    recordRendererMemory: () => {},
    recordDomNodeCount: () => {},
    recordConnectionError: () => {},
    recordReconnection: () => {},
    recordChatroomSwitch: () => {},
    // 7TV metrics no-ops
    recordSevenTVConnectionHealth: () => {},
    recordSevenTVWebSocketCreated: () => {},
    recordSevenTVEmoteUpdate: () => {},
    recordSevenTVEmoteChanges: () => {},
    // Performance monitoring no-ops
    recordStartupDuration: () => {},
    recordMessageParsingDuration: () => {},
    recordEmoteSearchDuration: () => {},
    recordWebSocketConnectionDuration: () => {},
    getSLOTarget: () => ({}),
    getAllSLOTargets: () => ({}),
    updatePerformanceBudget: () => {},
    // Error monitoring no-ops
    recordError: () => ({}),
    recordErrorRecovery: () => {},
    executeWithRetry: async (op) => await op(),
    executeNetworkRequestWithRetry: async (op) => await op(),
    executeWebSocketWithRetry: async (op) => await op(),
    executeSevenTVWithRetry: async (op) => await op(),
    getCircuitBreaker: () => ({}),
    getErrorStatistics: () => ({}),
    // User analytics no-ops
    startUserSession: () => ({}),
    endUserSession: () => {},
    recordUserAction: () => {},
    recordFeatureUsage: () => {},
    recordChatEngagement: () => {},
    recordConnectionQuality: () => {},
    getUserAnalyticsData: () => ({}),
    getUserActionTypes: () => ({}),
    // Performance budget no-ops
    monitorUIInteraction: () => 'good',
    monitorComponentRender: () => 'good',
    monitorWebSocketLatency: () => 'good',
    monitorMemoryUsage: () => 'good',
    monitorCPUUsage: () => 'good',
    monitorBundleSize: () => 'good',
    getPerformanceData: () => ({}),
    // Memory management no-ops
    cleanupOldSessions: () => ({ cleaned: 0, remaining: {} }),
    forceCleanupSessions: () => ({}),
    getAnalyticsMemoryStats: () => ({ total_estimated_bytes: 0 })
  };
}

// Force-sampled parent span around a real outbound HTTP call to ensure children http.client spans are recorded
try {
  const { trace, context } = require('@opentelemetry/api');
  const tracer = trace.getTracer('kicktalk-main');
  const https = require('https');

  const parent = tracer.startSpan('kicktalk.validation_http_probe', {
    attributes: {
      'probe.target': 'kick_health',
      'probe.kind': 'startup_validation'
    }
  });

  // Run a simple HTTPS GET under the parent span's context
  context.with(trace.setSpan(context.active(), parent), () => {
    const req = https.request(
      // lightweight, fast endpoint; replace with a Kick/7tv endpoint if desired
      { method: 'GET', hostname: 'api.github.com', path: '/octocat', headers: { 'User-Agent': 'kicktalk' } },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          try { parent.setAttribute('probe.status_code', res.statusCode || 0); } catch {}
          try { parent.end(); } catch {}
        });
      }
    );
    req.on('error', (e) => {
      try { parent.recordException?.(e); parent.setStatus?.({ code: 2, message: e.message }); } catch {}
      try { parent.end(); } catch {}
    });
    req.end();
  });
} catch (e) {
  console.warn('[Telemetry]: HTTP probe span failed:', e?.message || e);
}

const authStore = new Store({
  fileExtension: "env",
  schema: {
    SESSION_TOKEN: {
      type: "string",
    },
    KICK_SESSION: {
      type: "string",
    },
  },
});

const kickRealtime = new KickRealtimeController({
  getSession: createRealtimeSessionProvider(authStore),
  emit: (event) => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send("kick:realtime:event", event);
    }
  },
  telemetry: createKickRealtimeTelemetry({ isEnabled: isTelemetryEnabled }),
});

const requireMainRendererSender = (event) => {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents ||
      event.senderFrame !== mainWindow.webContents.mainFrame) {
    throw new Error("IPC is restricted to the main renderer");
  }
  const rendererUrl = new URL(event.senderFrame.url);
  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    const expected = new URL(process.env.ELECTRON_RENDERER_URL);
    if (rendererUrl.origin !== expected.origin || rendererUrl.pathname !== expected.pathname) {
      throw new Error("Invalid realtime renderer");
    }
  } else if (rendererUrl.protocol !== "file:" || rendererUrl.pathname !== pathToFileURL(join(__dirname, "../renderer/index.html")).pathname) {
    throw new Error("Invalid realtime renderer");
  }
};

ipcMain.handle("kick:realtime:set-rooms", (event, rooms) => {
  requireMainRendererSender(event);
  return kickRealtime.setRooms(rooms);
});
ipcMain.handle("kick:realtime:retry", (event, roomId) => {
  requireMainRendererSender(event);
  return kickRealtime.retry(roomId);
});
app.on("before-quit", () => kickRealtime.close());

ipcMain.setMaxListeners(100);

const userLogsStore = new Map(); // User logs by chatroom
const replyLogsStore = new Map(); // Reply threads by chatroom

const logLimits = {
  user: 80,
  reply: 50,
  replyThreads: 25,
};

let tray = null;

const createTrayContextMenu = () => {
  const isWindowVisible =
    mainWindow && !mainWindow.isDestroyed?.() && mainWindow.isVisible() && !mainWindow.isMinimized();
  
  return Menu.buildFromTemplate([
    {
      label: isWindowVisible ? 'Hide KickTalk' : 'Show KickTalk',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed?.()) {
          if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            if (mainWindow.isMinimized()) {
              mainWindow.restore();
            }
            mainWindow.focus();
          }
        }
        // Update context menu after visibility change
        if (tray) tray.setContextMenu(createTrayContextMenu());
      }
    },
    {
      label: 'Settings',
      click: async () => {
        try {
          // The main renderer opens it so the dialog receives the room roster; fall back if it is gone.
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("settingsDialog:open-request");
          else await openSettingsDialog({ userData: null });
        } catch (error) {
          console.error('[Tray]: Error opening settings:', error);
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Quit',
      click: async () => {
        // Proper shutdown with telemetry cleanup
        try {
          if (isTelemetryEnabled()) {
            if (allWindows.size > 0) {
              const openWindowTitles = getSafeOpenWindowTitles();
              console.error(`[ProcessExit] Closing with ${allWindows.size} windows still open: ${openWindowTitles.join(", ")}`);
              metrics.recordError(new Error("Lingering windows on exit"), { openWindows: openWindowTitles });
            }
            if (shutdownTelemetry) {
              try {
                await shutdownTelemetry();
              } catch (error) {
                console.warn('[Telemetry]: Failed to shutdown telemetry:', error.message);
              }
            }
          }
        } catch (e) {
          console.warn('[Quit]: Graceful shutdown encountered an error:', e?.message || e);
        } finally {
          app.quit();
        }
      }
    }
  ]);
};

const storeToken = async (token_name, token) => {
  if (!token || !token_name) return;

  try {
    authStore.set(token_name, token);
  } catch (error) {
    console.error("[Auth Token]: Error storing token:", error);
  }
};

const retrieveToken = async (token_name) => {
  try {
    const token = await authStore.get(token_name);
    return token || null;
  } catch (error) {
    console.error("[Auth Token]: Error retrieving token:", error);
    return null;
  }
};

const clearAuthTokens = async () => {
  try {
    kickRealtime.close();
    authStore.clear();
    await session.defaultSession.clearStorageData({
      storages: ["cookies"],
    });
  } catch (error) {
    console.error("[Auth Token]: Error clearing tokens & cookies:", error);
  }
};

let dialogInfo = null;
let replyThreadInfo = null;

let mainWindow = null;
let userDialog = null;
let authDialog = null;
let chattersDialog = null;
let settingsDialog = null;

// Track all windows for telemetry
const allWindows = new Set();

// Safely collect titles of non-destroyed windows for logging
const getSafeOpenWindowTitles = () => {
  try {
    return Array.from(allWindows)
      .filter((win) => win && !win.isDestroyed?.())
      .map((win) => {
        try {
          return typeof win.getTitle === 'function' ? win.getTitle() : 'untitled';
        } catch {
          return 'destroyed';
        }
      });
  } catch {
    return [];
  }
};

// Centralized Settings Dialog creator to avoid duplication
const openSettingsDialog = async (data) => {
  const settings = store.get();

  if (settingsDialog) {
    settingsDialog.focus();
    if (data) {
      settingsDialog.webContents.send("settingsDialog:data", { ...data, settings });
    }
    return;
  }

  const mainWindowPos = mainWindow.getPosition();
  const mainWindowSize = mainWindow.getSize();

  const newX = mainWindowPos[0] + Math.round((mainWindowSize[0] - 1200) / 2);
  const newY = mainWindowPos[1] + Math.round((mainWindowSize[1] - 700) / 2);

  settingsDialog = new BrowserWindow({
    width: 1200,
    minWidth: 800,
    height: 700,
    minHeight: 600,
    x: newX,
    y: newY,
    show: false,
    resizable: true,
    frame: false,
    transparent: true,
    backgroundColor: "#020a05",
    roundedCorners: true,
    parent: mainWindow,
    icon: iconPath,
    webPreferences: {
      devtools: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  metrics.incrementOpenWindows();
  allWindows.add(settingsDialog);

  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    settingsDialog.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/settings.html`);
  } else {
    settingsDialog.loadFile(join(__dirname, "../renderer/settings.html"));
  }

  settingsDialog.once("ready-to-show", () => {
    settingsDialog.show();
    if (data) {
      settingsDialog.webContents.send("settingsDialog:data", { ...data, settings });
    }
    if (isDev) {
      settingsDialog.webContents.openDevTools();
    }

    settingsDialog.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: "deny" };
    });
  });

  settingsDialog.on("closed", () => {
    allWindows.delete(settingsDialog);
    settingsDialog = null;
    metrics.decrementOpenWindows();
  });
};

let searchDialog = null;
let replyThreadDialog = null;
let availableNotificationSounds = [];

// Notification Sounds Handler
const getNotificationSounds = () => {
  // Determine the correct sounds directory based on packaging
  const basePath = app.isPackaged
    ? join(process.resourcesPath, "app.asar.unpacked/resources/sounds")
    : join(__dirname, "../../resources/sounds");

  availableNotificationSounds = fs
    .readdirSync(basePath)
    .filter((file) => file.endsWith(".mp3") || file.endsWith(".wav"))
    .map((file) => ({
      name: file.replace(/\.(mp3|wav)$/, ""),
      value: join(basePath, file),
    }));

  console.log("Notification Sounds:", availableNotificationSounds);
  return availableNotificationSounds;
};

const openNotificationFolder = async () => {
  const result = await dialog.showOpenDialog(settingsDialog || mainWindow, {
    title: "Select Notification Sound",
    filters: [
      { name: "Audio Files", extensions: ["mp3", "wav"] },
      { name: "All Files", extensions: ["*"] },
    ],
    properties: ["openFile"],
  });

  if (result.canceled || !result.filePaths.length) {
    return null;
  }

  const selectedFile = result.filePaths[0];
  const fileName = basename(selectedFile);

  const basePath = app.isPackaged
    ? join(process.resourcesPath, "app.asar.unpacked/resources/sounds")
    : join(__dirname, "../../resources/sounds");

  const destPath = join(basePath, fileName);

  try {
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }

    // Copy file to sounds directory
    fs.copyFileSync(selectedFile, destPath);
    getNotificationSounds();

    console.log("[Notification Sounds]: File uploaded successfully:", fileName);

    return {
      name: fileName.split(".")[0],
      value: destPath,
      fileName: fileName,
    };
  } catch (error) {
    console.error("[Notification Sounds]: Error uploading file:", error);
    return null;
  }
};

getNotificationSounds(); // Load initially

const handleNotificationSound = (soundFile) => {
  if (!soundFile) return null;

  const audioBuffer = fs.readFileSync(soundFile);
  const audioBase64 = audioBuffer.toString("base64");
  const mimeType = soundFile.endsWith(".mp3") ? "audio/mpeg" : "audio/wav";
  return `data:${mimeType};base64,${audioBase64}`;
};

const getSoundUrl = (soundObject) => {
  if (!soundObject?.value) return null;

  if (isDev) {
    try {
      return handleNotificationSound(soundObject.value);
    } catch (error) {
      console.error("[Notification Sounds]: Error reading sound file:", error);
      return null;
    }
  } else {
    return `file://${soundObject.value}`;
  }
};

ipcMain.handle("notificationSounds:openFolder", async () => {
  return await openNotificationFolder();
});

ipcMain.handle("notificationSounds:getAvailable", () => {
  getNotificationSounds();
  return availableNotificationSounds;
});

ipcMain.handle("notificationSounds:getSoundUrl", (e, { soundFile }) => {
  if (!soundFile) {
    const defaultSound = availableNotificationSounds.find((s) => s.name === "default");
    return getSoundUrl(defaultSound);
  }

  const found = availableNotificationSounds.find((s) => s.name === soundFile || s.value.endsWith(soundFile));

  // If not found, fallback to default
  if (!found) {
    const defaultSound = availableNotificationSounds.find((s) => s.name === "default");
    return getSoundUrl(defaultSound);
  }

  // Return the found sound
  return getSoundUrl(found);
});

// [Store Handlers]
ipcMain.handle("store:get", async (e, { key }) => {
  if (!key) return store.store;
  return store.get(key);
});

/**
 * A2: Provide OTLP config to renderer via preload bridge (no secrets bundled)
 * Uses MAIN_VITE_* mapped to OTEL_* at startup to build traces endpoint + headers.
 */
ipcMain.handle("otel:get-config", async (event) => {
  requireMainRendererSender(event);
  try {
    console.log('[OTEL Config] Renderer requesting telemetry config');
    
    getOtelRelayConfig();
    const deploymentEnv = process.env.OTEL_DEPLOYMENT_ENV ||
      process.env.NODE_ENV || "development";
    // Never expose destination credentials to the renderer.
    return {
      ok: true,
      useIpcRelay: true,
      deploymentEnv,
      appVersion
    };
  } catch (e) {
    const reason = configurationReason(e);
    telemetryHealth.configure('renderer', { configured: false, reason });
    return { ok: false, reason };
  }
});

/**
 * IPC relay for renderer OTLP export (simplified)
 * CORS prevents renderer from directly accessing Grafana Cloud, so we relay via main process
 */
ipcMain.handle("otel:trace-export-json", async (event, exportJson) => {
  requireMainRendererSender(event);
  if (!checkTelemetrySettings()) return { ok: false, reason: 'disabled' };
  if (!Array.isArray(exportJson?.resourceSpans) || !exportJson.resourceSpans.length) {
    return { ok: false, reason: 'export_error' };
  }
  try { getOtelRelayConfig(); }
  catch (error) {
    const reason = configurationReason(error);
    telemetryHealth.configure('renderer', { configured: false, reason });
    return { ok: false, reason };
  }
  const requestId = genRequestId();
  const startedAt = Date.now();
  try {
    if (shouldLogDebug()) {
      console.log(`[OTEL IPC Relay][${requestId}] Received trace export from renderer`);
      console.log(`[OTEL IPC Relay][${requestId}] Payload size: ${JSON.stringify(exportJson || {}).length} chars`);
    }
    
    const { url, headers } = getOtelRelayConfig();
    const transport = require(url.protocol === 'http:' ? 'http' : 'https');
    const body = Buffer.from(JSON.stringify(exportJson), "utf8");

    const options = {
      method: "POST",
      hostname: url.hostname.replace(/^\[|\]$/g, ''),
      port: url.port || (url.protocol === 'http:' ? 80 : 443),
      path: url.pathname + (url.search || ""),
      headers: {
        "Content-Type": "application/json",
        "Content-Length": body.length,
        ...headers
      },
      timeout: 15000,
    };

    if (shouldLogDebug()) {
      console.log(`[OTEL IPC Relay][${requestId}] → POST ${url.hostname}${options.path}`);
    }

    const result = await new Promise((resolve, reject) => {
      const req = transport.request(options, (res) => {
        res.resume();
        res.on("end", () => {
          resolve({ statusCode: res.statusCode || 0 });
        });
      });
      
      req.on("error", (err) => {
        console.error(`[OTEL IPC Relay][${requestId}] Error:`, err.message);
        reject(err);
      });

      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('timeout'));
      });
      
      req.write(body);
      req.end();
    });

    const success = result.statusCode >= 200 && result.statusCode < 300;
    if (shouldLogDebug()) {
      console.log(`[OTEL IPC Relay][${requestId}] Result: ${success ? 'success' : 'failed'}`);
    }

    const reason = success ? 'none' : 'receiver_rejected';
    telemetryHealth.recordResult('renderer', reason);
    return { ok: success, status: result.statusCode, reason };
  } catch {
    telemetryHealth.recordResult('renderer', 'receiver_unavailable');
    return { ok: false, reason: 'receiver_unavailable' };
  }
});

const validTraceId = value => typeof value === 'string' && /^[0-9a-f]{32}$/.test(value) && !/^0+$/.test(value);
const validSpanId = value => typeof value === 'string' && /^[0-9a-f]{16}$/.test(value) && !/^0+$/.test(value);

// Settings may inspect health and explicitly run a diagnostic, but cannot emit
// metrics or relay arbitrary exports. Both windows must be their real top frame.
const requireTelemetryHealthSender = (event) => {
  if (mainWindow && event.sender === mainWindow.webContents) {
    requireMainRendererSender(event);
    return;
  }
  if (!settingsDialog || settingsDialog.isDestroyed() ||
      event.sender !== settingsDialog.webContents || event.senderFrame !== settingsDialog.webContents.mainFrame) {
    throw new Error('Invalid telemetry health sender');
  }
  const actual = new URL(event.senderFrame.url);
  const expected = isDev && process.env.ELECTRON_RENDERER_URL
    ? new URL(`${process.env.ELECTRON_RENDERER_URL.replace(/\/$/, '')}/settings.html`)
    : pathToFileURL(join(__dirname, '../renderer/settings.html'));
  if (actual.protocol !== expected.protocol || actual.origin !== expected.origin || actual.pathname !== expected.pathname) {
    throw new Error('Invalid telemetry health sender');
  }
};

telemetryHealth.subscribe(snapshot => {
  for (const window of [mainWindow, settingsDialog]) {
    if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send('telemetry:health-changed', snapshot);
    }
  }
});
ipcMain.handle('telemetry:get-health', event => {
  requireTelemetryHealthSender(event);
  return telemetryHealth.snapshot();
});
ipcMain.handle('telemetry:renderer-state', (event, state) => {
  requireMainRendererSender(event);
  const reason = ['configuration_missing', 'configuration_invalid', 'restart_required'].includes(state?.reason)
    ? state.reason : 'configuration_invalid';
  telemetryHealth.configure('renderer', {
    enabled: state?.enabled === true,
    configured: state?.ready === true,
    reason
  });
});
ipcMain.handle('telemetry:renderer-export-failed', event => {
  requireMainRendererSender(event);
  telemetryHealth.recordResult('renderer', 'export_error');
});

// Readback is manual, bounded, and distinct from OTLP receiver acceptance.
const readTempoTrace = async (traceId) => {
  if (!checkTelemetrySettings() || !validTraceId(traceId)) return { success: false };
  try {
    const env = process.env;
    const queryUrl = env.MAIN_VITE_GRAFANA_TEMPO_QUERY_URL || env.GRAFANA_TEMPO_QUERY_URL;
    const queryUser = env.MAIN_VITE_GRAFANA_TEMPO_QUERY_USER || env.GRAFANA_TEMPO_QUERY_USER;
    const queryToken = env.MAIN_VITE_GRAFANA_TEMPO_QUERY_TOKEN || env.GRAFANA_TEMPO_QUERY_TOKEN;
    if (!queryUrl) return { success: false };
    const url = new URL(queryUrl);
    const loopback = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) return { success: false };
    if (!loopback && (!queryUser || !queryToken)) return { success: false };
    url.pathname = `${url.pathname.replace(/\/$/, '')}/api/traces/${traceId}`;
    const headers = { Accept: 'application/json' };
    if (queryUser && queryToken) headers.Authorization = `Basic ${Buffer.from(`${queryUser}:${queryToken}`).toString('base64')}`;
    return await new Promise(resolve => {
      const transport = require(url.protocol === 'http:' ? 'http' : 'https');
      const req = transport.request({
        method: 'GET',
        hostname: url.hostname.replace(/^\[|\]$/g, ''),
        port: url.port || (url.protocol === 'http:' ? 80 : 443),
        path: url.pathname + url.search,
        headers
      }, res => {
        const chunks = [];
        let bytes = 0;
        res.on('data', chunk => {
          bytes += chunk.length;
          if (bytes > 2 * 1024 * 1024) { req.destroy(); resolve({ success: false }); return; }
          chunks.push(chunk);
        });
        res.on('error', () => resolve({ success: false }));
        res.on('end', () => {
          try {
            const success = res.statusCode >= 200 && res.statusCode < 300;
            resolve(success ? { success: true, data: JSON.parse(Buffer.concat(chunks).toString('utf8')) } : { success: false });
          } catch { resolve({ success: false }); }
        });
      });
      req.on('error', () => resolve({ success: false }));
      req.setTimeout(5000, () => { req.destroy(); resolve({ success: false }); });
      req.end();
    });
  } catch { return { success: false }; }
};
ipcMain.handle('telemetry:readTrace', (event, traceId) => {
  requireMainRendererSender(event);
  return readTempoTrace(traceId);
});

let diagnosticRun = null;
const runTelemetryDiagnostic = async () => {
  const notRun = { traceId: null, receiver: 'not_run', readback: 'not_run' };
  if (!checkTelemetrySettings() || !mainWindow || mainWindow.isDestroyed() ||
      telemetryHealth.snapshot().renderer.state === 'not_configured') return notRun;
  try {
    const result = await mainWindow.webContents.executeJavaScript('window.emitRendererTestSpan?.() ?? null');
    const traceId = validTraceId(result?.traceId) ? result.traceId : null;
    const receiver = ['accepted', 'rejected', 'unavailable', 'not_run'].includes(result?.receiver)
      ? result.receiver : 'not_run';
    if (!traceId || receiver !== 'accepted') return { traceId, receiver, readback: 'not_run' };
    if (process.env.MAIN_VITE_GRAFANA_TEMPO_QUERY_URL || process.env.GRAFANA_TEMPO_QUERY_URL) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    const readResult = await readTempoTrace(traceId);
    const resources = readResult.data?.batches || readResult.data?.resourceSpans;
    const spans = (Array.isArray(resources) ? resources : []).flatMap(resource => {
      const scopes = resource?.scopeSpans || resource?.instrumentationLibrarySpans;
      return (Array.isArray(scopes) ? scopes : []).flatMap(scope => Array.isArray(scope?.spans) ? scope.spans : []);
    });
    const spanId = validSpanId(result.spanId) ? result.spanId : null;
    const spanIdBase64 = spanId ? Buffer.from(spanId, 'hex').toString('base64') : null;
    const traceIdBase64 = Buffer.from(traceId, 'hex').toString('base64');
    const found = readResult.success && spanId && spans.some(span =>
      (span?.spanId === spanId || span?.spanId === spanIdBase64) &&
      (span?.traceId === traceId || span?.traceId === traceIdBase64));
    return { traceId, receiver, readback: found ? 'available' : 'unavailable' };
  } catch { return { traceId: null, receiver: 'unavailable', readback: 'not_run' }; }
};
ipcMain.handle('telemetry:run-diagnostic', event => {
  requireTelemetryHealthSender(event);
  if (!diagnosticRun) diagnosticRun = runTelemetryDiagnostic().finally(() => { diagnosticRun = null; });
  return diagnosticRun;
});

ipcMain.handle("store:set", (e, { key, value }) => {
  const result = store.set(key, value);
  if (key === 'telemetry' || key === 'telemetry.enabled') telemetryHealth.notify();

  // Broadcast to all windows
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send("store:updated", { [key]: value });
  });

  if (key === "general") {
    if (process.platform === "darwin") {
      mainWindow.setVisibleOnAllWorkspaces(value.alwaysOnTop, { visibleOnFullScreen: true });
      mainWindow.setAlwaysOnTop(value.alwaysOnTop);
    } else if (process.platform === "win32") {
      mainWindow.setAlwaysOnTop(value.alwaysOnTop, "screen-saver", 1);
    } else if (process.platform === "linux") {
      mainWindow.setAlwaysOnTop(value.alwaysOnTop, "screen-saver", 1);
    }

    // Handle auto-update setting changes
    if (Object.prototype.hasOwnProperty.call(value, 'autoUpdate') && value.autoUpdate === false) {
      // Dismiss any active update notifications when auto-update is disabled
      mainWindow.webContents.send("autoUpdater:dismiss");
    }
  }

  return result;
});

ipcMain.handle("store:delete", (e, { key }) => {
  const result = store.delete(key);
  mainWindow.webContents.send("store:updated", { [key]: null });

  return result;
});

const addUserLog = (chatroomId, userId, message, isDeleted = false) => {
  if (!chatroomId || !userId || !message) {
    console.error("[Chat Logs]: Invalid data received:", { chatroomId, userId, message, isDeleted });
    return null;
  }

  const key = `${chatroomId}-${userId}`;

  // Get or Create User Logs for room
  let userLogs = userLogsStore.get(key) || [];

  // If updating a deleted flag, update the existing message
  if (isDeleted) {
    userLogs = userLogs.map((msg) => {
      if (msg.id === message.id) {
        return { ...msg, deleted: true };
      }
      return msg;
    });
  } else {
    userLogs = [...userLogs.filter((m) => m.id !== message.id), message]
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .slice(-logLimits.user);
  }

  // Store User Logs
  userLogsStore.set(key, userLogs);

  if (userDialog && dialogInfo?.chatroomId === chatroomId && dialogInfo?.userId === userId) {
    userDialog.webContents.send("chatLogs:updated", {
      chatroomId,
      userId,
      logs: userLogs,
    });
  }

  return { messages: userLogs };
};

const addReplyLog = (chatroomId, message, isDeleted = false) => {
  if (!message || !chatroomId || !message.metadata?.original_message?.id) {
    console.error("[Reply Logs]: Invalid data received:", { chatroomId, message, isDeleted });
    return null;
  }

  const key = message.metadata.original_message.id;

  // Get Chatroom Reply Threads
  let chatroomReplyThreads = replyLogsStore.get(chatroomId);
  if (!chatroomReplyThreads) {
    chatroomReplyThreads = new Map();
    replyLogsStore.set(chatroomId, chatroomReplyThreads);
  }

  // Get or Create Reply Logs for original message
  let replyThreadLogs = chatroomReplyThreads.get(key) || [];

  // If this is a delete operation, update existing message
  if (isDeleted) {
    replyThreadLogs = replyThreadLogs.map((msg) => {
      if (msg.id === message.id) {
        return { ...msg, deleted: true };
      }
      return msg;
    });
  } else {
    // Normal add operation
    replyThreadLogs = [...replyThreadLogs.filter((m) => m.id !== message.id), message]
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .slice(-logLimits.reply);
  }

  // Store Reply Logs
  chatroomReplyThreads.set(key, replyThreadLogs);

  if (chatroomReplyThreads.size > logLimits.replyThreads) {
    const oldestKey = chatroomReplyThreads.keys().next().value;
    chatroomReplyThreads.delete(oldestKey);
  }

  // Update user dialog if the reply is from the user being viewed
  if (userDialog && dialogInfo?.chatroomId === chatroomId && dialogInfo?.userId === message.sender.id) {
    userDialog.webContents.send("chatLogs:updated", {
      chatroomId,
      userId: message.sender.id,
      logs: replyThreadLogs,
    });
  }

  if (replyThreadDialog && replyThreadInfo?.originalMessageId === key) {
    replyThreadDialog.webContents.send("replyLogs:updated", {
      originalMessageId: key,
      messages: replyThreadLogs,
    });
  }

  return replyThreadLogs;
};

ipcMain.handle("chatLogs:get", async (e, { data }) => {
  const { chatroomId, userId } = data;
  if (!chatroomId || !userId) return [];

  const key = `${chatroomId}-${userId}`;
  return userLogsStore.get(key) || [];
});

ipcMain.handle("chatLogs:add", async (e, { data }) => {
  const { chatroomId, userId, message } = data;
  return addUserLog(chatroomId, userId, message);
});

ipcMain.handle("replyLogs:get", async (e, { data }) => {
  const { originalMessageId, chatroomId, userId } = data;
  if (!chatroomId) return [];

  const chatroomReplyThreads = replyLogsStore.get(chatroomId);
  if (!chatroomReplyThreads) return [];

  if (userId) {
    const allUserReplies = [];
    chatroomReplyThreads.forEach((replies) => {
      const userReplies = replies.filter((reply) => reply.sender.id === userId);
      allUserReplies.push(...userReplies);
    });
    return allUserReplies;
  }

  // Otherwise return replies for a specific thread
  const replyThreadLogs = chatroomReplyThreads.get(originalMessageId);
  return replyThreadLogs || [];
});

ipcMain.handle("replyLogs:add", async (e, data) => {
  const { message, chatroomId } = data;
  return addReplyLog(chatroomId, message);
});

ipcMain.handle("logs:updateDeleted", async (e, { chatroomId, messageId }) => {
  let updated = false;
  userLogsStore.forEach((userLogs, key) => {
    if (key.startsWith(`${chatroomId}-`)) {
      const messageToUpdate = userLogs.find((msg) => msg.id === messageId);
      if (messageToUpdate) {
        const userId = key.substring(`${chatroomId}-`.length);
        addUserLog(chatroomId, userId, messageToUpdate, true);
        updated = true;
      }
    }
  });
  return updated;
});

ipcMain.handle("replyLogs:updateDeleted", async (e, { chatroomId, messageId }) => {
  const chatroomReplyThreads = replyLogsStore.get(chatroomId);
  if (!chatroomReplyThreads) return false;

  let updated = false;
  chatroomReplyThreads.forEach((replyThreadLogs) => {
    const messageToUpdate = replyThreadLogs.find((msg) => msg.id === messageId);
    if (messageToUpdate) {
      addReplyLog(chatroomId, messageToUpdate, true);
      updated = true;
    }
  });
  return updated;
});

// Handle window focus
ipcMain.handle("bring-to-front", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

const liveNotifier = createLiveNotifier({ Notification, getMainWindow: () => mainWindow });
ipcMain.handle("liveNotification:show", (event, payload) => {
  requireMainRendererSender(event);
  return liveNotifier.show(payload);
});


const setAlwaysOnTop = (window) => {
  const alwaysOnTopSetting = store.get("general.alwaysOnTop");

  if (alwaysOnTopSetting) {
    if (process.platform === "darwin") {
      window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      window.setFullScreenable(false);
      window.setAlwaysOnTop(true);
    } else if (process.platform === "win32") {
      window.setAlwaysOnTop(true, "screen-saver");
      window.setVisibleOnAllWorkspaces(true);
    } else if (process.platform === "linux") {
      window.setAlwaysOnTop(true, "screen-saver");
      window.setVisibleOnAllWorkspaces(true);
    }
  }
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: store.get("lastMainWindowState.width"),
    height: store.get("lastMainWindowState.height"),
    x: store.get("lastMainWindowState.x"),
    y: store.get("lastMainWindowState.y"),
    minWidth: 335,
    minHeight: 250,
    show: false,
    backgroundColor: "#06190e",
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    roundedCorners: true,
    icon: iconPath,
    webPreferences: {
      devTools: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.webContents.once("destroyed", () => kickRealtime.close());
  mainWindow.webContents.on("render-process-gone", () => kickRealtime.close());

  mainWindow.setThumbarButtons([
    {
      icon: iconPath,
      click: () => {
        mainWindow.show();
      },
    },
  ]);

  setAlwaysOnTop(mainWindow);
  metrics.incrementOpenWindows();

  mainWindow.once("ready-to-show", async () => {
    mainWindow.show();
    setAlwaysOnTop(mainWindow);
    allWindows.add(mainWindow);

    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  });

  mainWindow.on("resize", () => {
    store.set("lastMainWindowState", { ...mainWindow.getNormalBounds() });
  });

  mainWindow.on("close", () => {
    store.set("lastMainWindowState", { ...mainWindow.getNormalBounds() });
    allWindows.delete(mainWindow);
    metrics.decrementOpenWindows();
  });

  // Update tray context menu when window state changes
  mainWindow.on('show', () => {
    if (tray) tray.setContextMenu(createTrayContextMenu());
  });

  mainWindow.on('hide', () => {
    if (tray) tray.setContextMenu(createTrayContextMenu());
  });

  mainWindow.on('minimize', () => {
    if (tray) tray.setContextMenu(createTrayContextMenu());
  });

  mainWindow.on('restore', () => {
    if (tray) tray.setContextMenu(createTrayContextMenu());
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("did-finish-load", () => {
    // Apply zoom after Chromium has initialized the page.
    mainWindow.webContents.setZoomFactor(store.get("zoomFactor"));
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
};

const loginToKick = async (method) => {
  const authSession = {
    token: await retrieveToken("SESSION_TOKEN"),
    session: await retrieveToken("KICK_SESSION"),
  };

  if (authSession.token && authSession.session) return true;

  const mainWindowPos = mainWindow.getPosition();
  const mainWindowSize = mainWindow.getSize();

  const newX = mainWindowPos[0] + Math.round((mainWindowSize[0] - 1400) / 2);
  const newY = mainWindowPos[1] + Math.round((mainWindowSize[1] - 750) / 2);

  return new Promise((resolve) => {
    const loginDialog = new BrowserWindow({
      width: 460,
      height: 630,
      x: newX,
      y: newY,
      show: true,
      resizable: false,
      transparent: true,
      autoHideMenuBar: true,
      parent: authDialog,
      roundedCorners: true,
      icon: iconPath,
      webPreferences: {
        autoplayPolicy: "user-gesture-required",
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });
    metrics.incrementOpenWindows();
    allWindows.add(loginDialog);

    switch (method) {
      case "kick":
        loginDialog.loadURL("https://kick.com/");
        loginDialog.webContents.on("did-finish-load", () => {
          loginDialog.webContents.executeJavaScript(
            `const interval = setInterval(() => {
              const el = document.querySelector('div.flex.items-center.gap-4 > button:last-child');
              if (el) {
                el.click();
                clearInterval(interval);  
              }
            }, 100);`,
          );
          loginDialog.webContents.setAudioMuted(true);
        });
        break;
      case "google":
        loginDialog.loadURL(
          "https://accounts.google.com/o/oauth2/auth?client_id=582091208538-64t6f8i044gppt1etba67qu07t4fimuf.apps.googleusercontent.com&redirect_uri=https%3A%2F%2Fkick.com%2Fsocial%2Fgoogle%2Fcallback&scope=openid+profile+email&response_type=code",
        );
        break;
      case "apple":
        loginDialog.loadURL(
          "https://appleid.apple.com/auth/authorize?client_id=com.kick&redirect_uri=https%3A%2F%2Fkick.com%2Fredirect%2Fapple&scope=name%20email&response_type=code&response_mode=form_post",
        );
        break;
      default:
        console.error("[Auth Login]:Unknown login method:", method);
    }

    const checkForSessionToken = async () => {
      const cookies = await session.defaultSession.cookies.get({ domain: "kick.com" });
      const sessionCookie = cookies.find((cookie) => cookie.name === "session_token");
      const kickSession = cookies.find((cookie) => cookie.name === "kick_session");
      if (sessionCookie && kickSession) {
        // Save the session token and kick session to the .env file
        const sessionToken = decodeURIComponent(sessionCookie.value);
        const kickSessionValue = decodeURIComponent(kickSession.value);

        await storeToken("SESSION_TOKEN", sessionToken);
        await storeToken("KICK_SESSION", kickSessionValue);

        loginDialog.close();
        authDialog.close();
        kickRealtime.close();
        mainWindow.webContents.reload();

        resolve(true);
        return true;
      }

      return false;
    };

    const interval = setInterval(async () => {
      if (await checkForSessionToken()) {
        clearInterval(interval);
      }
    }, 1000);

    loginDialog.on("closed", () => {
      clearInterval(interval);
      resolve(false);
      allWindows.delete(loginDialog);
      metrics.decrementOpenWindows();
    });
  });
};

const setupLocalShortcuts = () => {
  mainWindow.webContents.on("zoom-changed", (event, zoomDirection) => {
    if (zoomDirection === "in") {
      event.preventDefault();
      if (mainWindow.webContents.getZoomFactor() < 1.5) {
        const newZoomFactor = mainWindow.webContents.getZoomFactor() + 0.1;
        mainWindow.webContents.setZoomFactor(newZoomFactor);
        store.set("zoomFactor", newZoomFactor);
      }
    } else if (zoomDirection === "out") {
      event.preventDefault();
      if (mainWindow.webContents.getZoomFactor() > 0.8) {
        const newZoomFactor = mainWindow.webContents.getZoomFactor() - 0.1;
        mainWindow.webContents.setZoomFactor(newZoomFactor);
        store.set("zoomFactor", newZoomFactor);
      }
    }
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (!mainWindow.isFocused()) return;

    if (input.control || input.meta) {
      // if mouse scroll up zoom in mouse only

      if (input.key === "=" || input.key === "+") {
        event.preventDefault();
        if (mainWindow.webContents.getZoomFactor() < 1.5) {
          const newZoomFactor = mainWindow.webContents.getZoomFactor() + 0.1;
          mainWindow.webContents.setZoomFactor(newZoomFactor);
          store.set("zoomFactor", newZoomFactor);
        }
      }

      // Zoom out with Ctrl/Cmd + Minus
      else if (input.key === "-") {
        event.preventDefault();
        if (mainWindow.webContents.getZoomFactor() > 0.8) {
          const newZoomFactor = mainWindow.webContents.getZoomFactor() - 0.1;
          mainWindow.webContents.setZoomFactor(newZoomFactor);
          store.set("zoomFactor", newZoomFactor);
        }
      }

      // Reset zoom with Ctrl/Cmd + 0
      else if (input.key === "0") {
        event.preventDefault();
        const newZoomFactor = 1;
        mainWindow.webContents.setZoomFactor(newZoomFactor);
        store.set("zoomFactor", newZoomFactor);
      }
    }
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // IPC relay handles renderer telemetry - no proxy needed
  
  tray = new Tray(iconPath);
  tray.setToolTip("KickTalk");
  
  // Set up context menu
  tray.setContextMenu(createTrayContextMenu());
  
  // Handle single-click to show/hide window
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
      }
      // Update context menu after visibility change
      tray.setContextMenu(createTrayContextMenu());
    }
  });

  // Set the icon for the app
  if (process.platform === "win32") {
    app.setAppUserModelId(process.execPath);
  }

  // Set app user model id for windows
  electronApp.setAppUserModelId("com.kicktalk.app");

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.on("ping", () => console.log("pong"));

  createWindow();

  // Initialize auto-updater
  update(mainWindow);

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Set up local shortcuts instead of global ones
  setupLocalShortcuts();
});

// Logout Handler
ipcMain.handle("logout", () => {
  dialog
    .showMessageBox(settingsDialog, {
      type: "question",
      title: "Sign Out",
      message: "Are you sure you want to sign out?",
      buttons: ["Yes", "Cancel"],
    })
    // Dialog returns a promise so let's handle it correctly
    .then(async (result) => {
      if (result.response !== 0) return;

      if (result.response === 0) {
        await clearAuthTokens();
        mainWindow.webContents.reload();
        settingsDialog.close();
      }
    });
});

// User Dialog Handler
ipcMain.handle("userDialog:open", (e, { data }) => {
  dialogInfo = {
    chatroomId: data.chatroomId,
    userId: data.sender.id,
  };

  const mainWindowPos = mainWindow.getPosition();
  const newX = mainWindowPos[0] + data.cords[0] - 150;
  const newY = mainWindowPos[1] + data.cords[1] - 100;

  if (userDialog) {
    userDialog.setPosition(newX, newY);
    userDialog.webContents.send("userDialog:data", { ...data, pinned: false });
    return;
  }

  userDialog = new BrowserWindow({
    width: 600,
    height: 600,
    x: newX,
    y: newY,
    show: false,
    resizable: false,
    frame: false,
    transparent: true,
    parent: mainWindow,
    backgroundColor: "#020a05",
    webPreferences: {
      devtools: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });
  metrics.incrementOpenWindows();
  allWindows.add(userDialog);

  // Load the same URL as main window but with dialog hash
  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    userDialog.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/user.html`);
  } else {
    userDialog.loadFile(join(__dirname, "../renderer/user.html"));
  }

  userDialog.once("ready-to-show", () => {
    userDialog.show();

    userDialog.setAlwaysOnTop(false);
    userDialog.setVisibleOnAllWorkspaces(false);
    userDialog.focus();

    userDialog.webContents.send("userDialog:data", { ...data, pinned: false });
    userDialog.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: "deny" };
    });
  });

  userDialog.on("blur", () => {
    if (userDialog && !userDialog.isAlwaysOnTop()) {
      userDialog.close();
    }
  });

  userDialog.on("closed", () => {
    setAlwaysOnTop(mainWindow);
    dialogInfo = null;
    allWindows.delete(userDialog);
    userDialog = null;
    metrics.decrementOpenWindows();
  });
});

ipcMain.handle("userDialog:pin", async (e, forcePinState) => {
  if (userDialog) {
    const newPinState = forcePinState !== undefined ? forcePinState : !userDialog.isAlwaysOnTop();

    if (isDev && newPinState) {
      // userDialog.webContents.openDevTools();
    }

    // Don't persist pin state - it should reset when dialog closes
    await userDialog.setAlwaysOnTop(newPinState);
    await userDialog.setVisibleOnAllWorkspaces(newPinState);
  }
});

// Auth Dialog Handler
ipcMain.handle("authDialog:open", (e) => {
  const mainWindowPos = mainWindow.getPosition();
  const currentDisplay = screen.getDisplayNearestPoint({
    x: mainWindowPos[0],
    y: mainWindowPos[1],
  });
  const newX = currentDisplay.bounds.x + Math.round((currentDisplay.bounds.width - 600) / 2);
  const newY = currentDisplay.bounds.y + Math.round((currentDisplay.bounds.height - 750) / 2);

  if (authDialog) {
    authDialog.focus();
    return;
  }

  authDialog = new BrowserWindow({
    width: 600,
    minHeight: 400,
    x: newX,
    y: newY,
    show: true,
    resizable: false,
    frame: false,
    transparent: true,
    roundedCorners: true,
    parent: mainWindow,
    icon: iconPath,
    webPreferences: {
      devtools: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });
  metrics.incrementOpenWindows();
  allWindows.add(authDialog);

  // Load the same URL as main window but with dialog hash
  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    authDialog.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/auth.html`);
  } else {
    authDialog.loadFile(join(__dirname, "../renderer/auth.html"));
  }

  authDialog.once("ready-to-show", () => {
    authDialog.show();
    if (isDev) {
      authDialog.webContents.openDevTools();
    }
  });

  authDialog.on("closed", () => {
    allWindows.delete(authDialog);
    authDialog = null;
    metrics.decrementOpenWindows();
  });
});

ipcMain.handle("authDialog:auth", async (e, { data }) => {
  if (data.type) {
    const result = await loginToKick(data.type);
    if (result) {
      authDialog.close();
      authDialog = null;
    }
  }
});

ipcMain.handle("authDialog:close", () => {
  if (authDialog) {
    authDialog.close();
    authDialog = null;
  }
});

ipcMain.handle("alwaysOnTop", () => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(!mainWindow.isAlwaysOnTop());
  }
});

// Window Controls
ipcMain.on("minimize", () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on("maximize", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on("close", () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

// Get App Info
ipcMain.handle("get-app-info", () => {
  return {
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
  };
});

// Telemetry handlers
ipcMain.handle("telemetry:recordSendOutcome", (event, payload) => {
  // The reply-thread dialog is our own window with its own chat store and the same preload.
  const fromReplyThread = typeof replyThreadDialog !== 'undefined' && replyThreadDialog &&
    !replyThreadDialog.isDestroyed() && event.sender === replyThreadDialog.webContents &&
    event.senderFrame === replyThreadDialog.webContents.mainFrame;
  if (!fromReplyThread) requireMainRendererSender(event);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Invalid send outcome');
  }
  for (const key of Object.keys(payload)) {
    if (key !== 'outcome' && key !== 'messageType' && key !== 'duration' && key !== 'cause') {
      throw new TypeError('Invalid send outcome field');
    }
  }
  const { outcome, messageType, duration, cause } = payload;
  switch (outcome) {
    case 'attempted':
    case 'api_accepted':
    case 'rejected':
    case 'confirmed':
    case 'unconfirmed':
      break;
    default:
      throw new TypeError('Invalid send outcome');
  }
  if ((messageType !== 'regular' && messageType !== 'reply') ||
      typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0 ||
      (cause !== undefined && (typeof cause !== 'string' ||
        (!Object.hasOwn(CHAT_ERROR_CODES, cause) && cause !== 'SEND_TIMEOUT' && cause !== 'UNKNOWN_SEND_ERROR')))) {
    throw new TypeError('Invalid send outcome payload');
  }
  if (isTelemetryEnabled()) {
    metrics.recordSendOutcome({ outcome, messageType, duration, ...(cause === undefined ? {} : { cause }) });
  }
});

ipcMain.handle("telemetry:recordError", (e, { error, context = {} }) => {
  if (isTelemetryEnabled()) {
    const errorObj = new Error(error.message || error);
    errorObj.name = error.name || 'RendererError';
    errorObj.stack = error.stack;
    metrics.recordError(errorObj, context);
  }
});

ipcMain.handle("telemetry:recordRendererMemory", (e, memory) => {
  if (isTelemetryEnabled()) {
    metrics.recordRendererMemory(memory);
  }
});

ipcMain.handle("telemetry:recordDomNodeCount", (e, count) => {
  if (isTelemetryEnabled()) {
    metrics.recordDomNodeCount(count);
  }
});


ipcMain.handle("telemetry:recordConnectionError", (e, { chatroomId, errorType }) => {
  if (isTelemetryEnabled()) {
    metrics.recordConnectionError(errorType, chatroomId);
  }
});

ipcMain.handle("telemetry:recordMessageReceived", (e, { chatroomId, messageType, senderId, streamerName }) => {
  if (isTelemetryEnabled()) {
    metrics.recordMessageReceived(chatroomId, messageType, senderId, streamerName);
  }
});

ipcMain.handle("telemetry:recordReconnection", (e, { chatroomId, reason }) => {
  if (isTelemetryEnabled()) {
    metrics.recordReconnection(chatroomId, reason);
  }
});

ipcMain.handle("telemetry:recordAPIRequest", (e, { endpoint, method, statusCode, duration }) => {
  if (isTelemetryEnabled()) {
    metrics.recordAPIRequest(endpoint, method, statusCode, duration);
  }
});

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

// Phase 4: User Analytics IPC handlers
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

// Phase 4: Performance Budget IPC handlers
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

// Memory management IPC handlers
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
  return { total_estimated_bytes: 0 };
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", async () => {
  if (process.platform !== "darwin") {
    // Shutdown telemetry before quitting
    try {
      if (isTelemetryEnabled()) {
        if (allWindows.size > 0) {
          const openWindowTitles = getSafeOpenWindowTitles();
          console.error(`[ProcessExit] Closing with ${allWindows.size} windows still open: ${openWindowTitles.join(", ")}`);
          metrics.recordError(new Error("Lingering windows on exit"), { openWindows: openWindowTitles });
        }
        if (shutdownTelemetry) {
          try {
            await shutdownTelemetry();
          } catch (error) {
            console.warn('[Telemetry]: Failed to shutdown telemetry:', error.message);
          }
        }
      }
    } catch (e) {
      console.warn('[WindowAllClosed]: Graceful shutdown encountered an error:', e?.message || e);
    } finally {
      app.quit();
    }
  }
});

// Chatters Dialog Handler
ipcMain.handle("chattersDialog:open", (e, { data }) => {
  if (chattersDialog) {
    chattersDialog.focus();
    if (data) {
      chattersDialog.webContents.send("chattersDialog:data", data);
    }
    return;
  }

  const mainWindowPos = mainWindow.getPosition();
  const newX = mainWindowPos[0] + 100;
  const newY = mainWindowPos[1] + 100;

  chattersDialog = new BrowserWindow({
    width: 350,
    minWidth: 350,
    height: 600,
    minHeight: 400,
    x: newX,
    y: newY,
    show: false,
    resizable: true,
    frame: false,
    transparent: true,
    roundedCorners: true,
    parent: mainWindow,
    icon: iconPath,
    webPreferences: {
      devtools: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });
  metrics.incrementOpenWindows();
  allWindows.add(chattersDialog);

  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    chattersDialog.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/chatters.html`);
  } else {
    chattersDialog.loadFile(join(__dirname, "../renderer/chatters.html"));
  }

  chattersDialog.once("ready-to-show", () => {
    chattersDialog.show();
    if (isDev) {
      chattersDialog.webContents.openDevTools();
    }
    if (data) {
      chattersDialog.webContents.send("chattersDialog:data", data);
    }
  });

  chattersDialog.on("closed", () => {
    allWindows.delete(chattersDialog);
    chattersDialog = null;
    metrics.decrementOpenWindows();
  });
});

ipcMain.handle("chattersDialog:close", () => {
  try {
    if (chattersDialog) {
      chattersDialog.close();
      chattersDialog = null;
    }
  } catch (error) {
    console.error("[Chatters Dialog]: Error closing dialog:", error);
    chattersDialog = null;
  }
});

// Search Dialog Handler
ipcMain.handle("searchDialog:open", (e, { data }) => {
  if (searchDialog) {
    searchDialog.focus();
    searchDialog.webContents.send("searchDialog:data", data);
    return;
  }

  const mainWindowPos = mainWindow.getPosition();
  const newX = mainWindowPos[0] + 100;
  const newY = mainWindowPos[1] + 100;

  searchDialog = new BrowserWindow({
    width: 650,
    minWidth: 650,
    height: 600,
    minHeight: 600,
    x: newX,
    y: newY,
    show: false,
    resizable: true,
    frame: false,
    transparent: true,
    roundedCorners: true,
    parent: mainWindow,
    icon: iconPath,
    webPreferences: {
      devtools: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });
  metrics.incrementOpenWindows();
  allWindows.add(searchDialog);

  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    searchDialog.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/search.html`);
  } else {
    searchDialog.loadFile(join(__dirname, "../renderer/search.html"));
  }

  searchDialog.once("ready-to-show", () => {
    searchDialog.show();
    if (isDev) {
      searchDialog.webContents.openDevTools({ mode: "detach" });
    }

    if (data) {
      searchDialog.webContents.send("searchDialog:data", data);
      searchDialog.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url);
        return { action: "deny" };
      });
    }
  });

  searchDialog.on("closed", () => {
    allWindows.delete(searchDialog);
    searchDialog = null;
    metrics.decrementOpenWindows();
  });
});

ipcMain.handle("searchDialog:close", () => {
  try {
    if (searchDialog) {
      searchDialog.close();
      searchDialog = null;
    }
  } catch (error) {
    console.error("[Search Dialog]: Error closing dialog:", error);
    searchDialog = null;
  }
});

// Settings Dialog Handler
ipcMain.handle("settingsDialog:open", async (e, { data }) => {
  await openSettingsDialog(data);
});

ipcMain.handle("settingsDialog:close", () => {
  try {
    if (settingsDialog) {
      settingsDialog.close();
      settingsDialog = null;
    }
  } catch (error) {
    console.error("[Settings Dialog]: Error closing dialog:", error);
    settingsDialog = null;
  }
});

// Reply Input Handler
ipcMain.handle("reply:open", (e, { data }) => {
  mainWindow.webContents.send("reply:data", data);
});

// Reply Thread Dialog Handler
ipcMain.handle("replyThreadDialog:open", (e, { data }) => {
  replyThreadInfo = {
    chatroomId: data.chatroomId,
    originalMessageId: data.originalMessageId,
  };
  if (replyThreadDialog) {
    replyThreadDialog.focus();
    replyThreadDialog.webContents.send("replyThreadDialog:data", data);
    return;
  }

  const mainWindowPos = mainWindow.getPosition();
  const newX = mainWindowPos[0] + 100;
  const newY = mainWindowPos[1] + 100;

  replyThreadDialog = new BrowserWindow({
    width: 550,
    height: 500,
    x: newX,
    y: newY,
    show: false,
    resizable: false,
    frame: false,
    transparent: true,
    parent: mainWindow,
    webPreferences: {
      devtools: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });
  metrics.incrementOpenWindows();
  allWindows.add(replyThreadDialog);

  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    replyThreadDialog.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/replyThread.html`);
  } else {
    replyThreadDialog.loadFile(join(__dirname, "../renderer/replyThread.html"));
  }

  replyThreadDialog.once("ready-to-show", () => {
    replyThreadDialog.show();

    if (data) {
      replyThreadDialog.webContents.send("replyThreadDialog:data", data);
    }

    if (isDev) {
      replyThreadDialog.webContents.openDevTools();
    }
  });

  replyThreadDialog.on("closed", () => {
    allWindows.delete(replyThreadDialog);
    replyThreadDialog = null;
    metrics.decrementOpenWindows();
  });
});

ipcMain.handle("replyThreadDialog:close", () => {
  try {
    if (replyThreadDialog) {
      replyThreadDialog.close();
    }
  } catch (error) {
    console.error("[Reply Thread Dialog]: Error closing dialog:", error);
  }
});

// Streamlink Integration
const findStreamlink = () => {
  const platform = process.platform;
  let possiblePaths = [];

  if (platform === "win32") {
    // Windows common installation paths
    const programFiles = process.env["PROGRAMFILES"] || "C:\\Program Files";
    const programFilesX86 = process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
    const localAppData = process.env["LOCALAPPDATA"] || "C:\\Users\\%USERNAME%\\AppData\\Local";
    
    possiblePaths = [
      join(programFiles, "Streamlink", "bin", "streamlink.exe"),
      join(programFilesX86, "Streamlink", "bin", "streamlink.exe"),
      join(localAppData, "Programs", "Python", "Python*", "Scripts", "streamlink.exe"),
      "streamlink.exe" // Check PATH
    ];
  } else if (platform === "darwin") {
    // macOS common paths
    possiblePaths = [
      "/usr/local/bin/streamlink",
      "/opt/homebrew/bin/streamlink",
      "/usr/bin/streamlink",
      "streamlink" // Check PATH
    ];
  } else {
    // Linux and other Unix-like systems
    possiblePaths = [
      "/usr/bin/streamlink",
      "/usr/local/bin/streamlink",
      "/home/linuxbrew/.linuxbrew/bin/streamlink",
      "streamlink" // Check PATH
    ];
  }

  // Check each possible path
  for (const path of possiblePaths) {
    try {
      if (path === "streamlink" || path === "streamlink.exe") {
        // For PATH check, verify the command actually exists
        try {
          const { spawnSync } = require("child_process");
          const result = spawnSync(path, ["--version"], { 
            stdio: "pipe", 
            timeout: 5000,
            windowsHide: true 
          });
          if (result.status === 0) {
            return path;
          }
        } catch (pathError) {
          // Command not found in PATH, continue
          continue;
        }
      } else {
        // Check if file exists for absolute paths
        if (fs.existsSync(path)) {
          return path;
        }
      }
    } catch (error) {
      // Continue checking other paths
      continue;
    }
  }

  return null;
};

const launchStreamlink = async (username) => {
  if (!username) {
    throw new Error("Username is required to launch Streamlink");
  }
  // Validate Kick slug to avoid malformed URLs or IPC misuse
  const slugRegex = /^[a-zA-Z0-9_-]+$/;
  if (typeof username !== 'string' || !slugRegex.test(username)) {
    throw new Error("Invalid username provided for Streamlink");
  }

  // Get user settings
  const streamlinkSettings = store.get("streamlink", {
    enabled: false,
    quality: "best",
    player: "mpv",
    kickLowLatency: true,
    customArgs: '--player-args="--cache=no --speed=1.01"'
  });

  // Check if Streamlink is enabled
  if (!streamlinkSettings.enabled) {
    throw new Error("Streamlink is disabled. Enable it in Settings > External Players.");
  }

  const streamlinkPath = findStreamlink();
  
  if (!streamlinkPath) {
    throw new Error("Streamlink not found. Please install Streamlink to use this feature.");
  }

  const streamUrl = `https://kick.com/${username}`;
  const userQuality = streamlinkSettings.quality || "best";
  // Helper function to attempt launch with a specific quality
  const attemptLaunch = (quality, isFallback = false) => {
    const args = buildStreamlinkArgs(streamUrl, quality, streamlinkSettings);

    console.log(`[Streamlink]: Attempting launch with quality "${quality}": ${streamlinkPath} ${args.join(" ")}`);

    return new Promise((resolve, reject) => {
      const child = spawn(streamlinkPath, args, {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });

      let stderr = '';
      let hasResolved = false;

      // Capture stderr to detect quality-related errors
      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      child.on('error', (error) => {
        if (!hasResolved) {
          hasResolved = true;
          console.error(`[Streamlink]: Launch failed for quality "${quality}":`, error);
          if (error.code === 'ENOENT') {
            reject(new Error("Streamlink not found. Please install Streamlink to use this feature."));
          } else {
            reject(new Error(`Failed to launch Streamlink: ${error.message}`));
          }
        }
      });

      child.on('exit', (code) => {
        console.log(`[Streamlink]: Process exited with code ${code} for quality "${quality}". stderr:`, stderr.trim());
        
        if (!hasResolved) {
          hasResolved = true;
          
          if (code === 0) {
            // Success case - process completed normally
            console.log(`[Streamlink]: Successfully completed for ${username} with quality "${quality}"`);
            resolve({ 
              success: true, 
              username, 
              streamUrl, 
              quality,
              player: streamlinkSettings.player || "default",
              args: args.join(" ")
            });
          } else {
            // Error case - process failed
            const errorMessage = stderr.trim() || `Streamlink exited with code ${code}`;
            console.error(`[Streamlink]: Failed for quality "${quality}":`, errorMessage);
            
            // Check if error is likely quality-related
            const isQualityError = stderr.includes('Unable to find') || 
                                 stderr.includes('No playable streams found') ||
                                 stderr.includes('quality') ||
                                 code === 1;
            
            reject(new Error(isQualityError ? `Quality "${quality}" not available` : errorMessage));
          }
        }
      });

      child.on('spawn', () => {
        console.log(`[Streamlink]: Process spawned with PID ${child.pid} for quality "${quality}"`);
        child.unref(); // Allow the parent process to exit independently
        
        // For successful launches, Streamlink often keeps running to manage the stream
        // Wait a bit to see if it exits immediately with an error, otherwise assume success
        setTimeout(() => {
          if (!hasResolved && child.pid && !child.killed) {
            hasResolved = true;
            console.log(`[Streamlink]: Successfully launched for ${username} with quality "${quality}" (process still running)`);
            resolve({ 
              success: true, 
              username, 
              streamUrl, 
              quality,
              player: streamlinkSettings.player || "default",
              args: args.join(" ")
            });
          }
        }, 5000); // 5 second delay to catch immediate failures
      });

      // Overall timeout to prevent hanging - longer timeout for fallback attempts  
      const timeoutMs = isFallback ? 25000 : 20000;
      setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          reject(new Error(`Streamlink launch timeout for quality "${quality}" after ${timeoutMs/1000}s`));
        }
      }, timeoutMs);
    });
  };

  // First attempt: Try user's preferred quality
  try {
    const result = await attemptLaunch(userQuality);
    return result;
  } catch (error) {
    // Check if this was a quality-related error and user didn't already select "best"
    const isQualityError = error.message.includes('not available') || 
                          error.message.includes('Unable to find') ||
                          error.message.includes('No playable streams found');
    
    if (isQualityError && userQuality !== 'best' && userQuality !== 'worst') {
      console.log(`[Streamlink]: Quality "${userQuality}" failed, attempting fallback to "best"`);
      
      try {
        // Second attempt: Fallback to "best" quality with longer timeout
        const result = await attemptLaunch('best', true);
        console.log(`[Streamlink]: Successfully fell back to "best" quality for ${username}`);
        return { 
          ...result, 
          quality: 'best',
          fallback: true, 
          originalQuality: userQuality 
        };
      } catch (fallbackError) {
        // If even "best" fails, throw the original error with context
        throw new Error(`Failed to launch stream with quality "${userQuality}" and fallback "best" also failed: ${fallbackError.message}`);
      }
    } else {
      // Re-throw the original error if it wasn't quality-related or user selected "best"
      throw error;
    }
  }
};

// Streamlink IPC Handlers
ipcMain.handle("streamlink:launch", async (event, { username }) => {
  try {
    const result = await launchStreamlink(username);
    return { success: true, ...result };
  } catch (error) {
    console.error("[Streamlink IPC]: Error launching:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("streamlink:checkAvailable", async () => {
  try {
    const streamlinkPath = findStreamlink();
    return { available: !!streamlinkPath, path: streamlinkPath };
  } catch (error) {
    console.error("[Streamlink IPC]: Error checking availability:", error);
    return { available: false, error: error.message };
  }
});

ipcMain.handle("utils:showNotification", async (event, options) => {
  const { dialog } = require("electron");
  try {
    const result = await dialog.showMessageBox(mainWindow, {
      type: options.type || "info",
      title: options.title || "KickTalk",
      message: options.message || "",
      detail: options.detail,
      buttons: options.buttons || ["OK"],
      defaultId: 0,
      cancelId: options.buttons ? options.buttons.length - 1 : 0,
    });
    return result;
  } catch (error) {
    console.error("[Utils IPC]: Error showing notification:", error);
    return { response: 0 };
  }
});
