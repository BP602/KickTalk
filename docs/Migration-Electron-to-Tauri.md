# KickTalk: Electron → Tauri Migration Plan

**Date:** 2026-02-25
**Status:** Draft
**Scope:** Full migration of KickTalk v2.x from Electron/electron-vite to Tauri v2

---

## Table of Contents

1. [Rationale](#1-rationale)
2. [Technology Comparison](#2-technology-comparison)
3. [Architecture Changes](#3-architecture-changes)
4. [API & Dependency Mapping](#4-api--dependency-mapping)
5. [IPC Channel Migration](#5-ipc-channel-migration)
6. [Window Management](#6-window-management)
7. [System Tray](#7-system-tray)
8. [Auto-Update](#8-auto-update)
9. [File System & Sounds](#9-file-system--sounds)
10. [Persistent Store / Settings](#10-persistent-store--settings)
11. [Shell / Streamlink Launcher](#11-shell--streamlink-launcher)
12. [Dialogs & Notifications](#12-dialogs--notifications)
13. [Telemetry & OpenTelemetry](#13-telemetry--opentelemetry)
14. [Authentication & Secrets](#14-authentication--secrets)
15. [Build System](#15-build-system)
16. [CI/CD Changes](#16-cicd-changes)
17. [Migration Phases](#17-migration-phases)
18. [Risks & Mitigations](#18-risks--mitigations)
19. [Effort Estimates](#19-effort-estimates)

---

## 1. Rationale

| Concern | Electron | Tauri v2 |
|---------|----------|----------|
| Installer size | ~120–180 MB | ~5–15 MB |
| RAM at idle | ~150–250 MB | ~30–80 MB |
| Backend language | Node.js (JS) | Rust |
| Security model | Chromium + Node in renderer | WebView + strict capability system |
| Auto-update | electron-updater (JS) | tauri-plugin-updater (Rust) |
| Cross-platform | Electron builds bundled Chromium | Uses OS WebView (WKWebView / WebView2 / WebKitGTK) |
| Multi-window | BrowserWindow API | Tauri window labels + WebviewWindow |
| Native menus / tray | Electron Menu/Tray APIs | tauri-plugin-tray |

KickTalk is a real-time chat client. Its primary bottleneck is rendering speed and memory pressure from managing many simultaneous WebSocket messages. Tauri's smaller footprint and Rust backend improve both, while the React renderer layer remains unchanged.

---

## 2. Technology Comparison

### What Changes

| Layer | Before | After |
|-------|--------|-------|
| App framework | `electron` + `electron-vite` | `tauri` v2 + `vite` |
| Native backend | `src/main/index.js` (Node.js) | `src-tauri/src/` (Rust) |
| Preload bridge | `src/preload/index.js` (contextBridge) | Tauri `invoke` / `listen` (no preload needed) |
| IPC | `ipcMain.handle` / `ipcRenderer.invoke` | `#[tauri::command]` / `invoke()` |
| Packaging | `electron-builder` | `tauri build` (Tauri CLI) |
| Window creation | `new BrowserWindow(...)` | `WebviewWindowBuilder` (Rust) |
| Tray | `new Tray(...)` | `tauri-plugin-tray` |
| File system | Node.js `fs` module | `tauri-plugin-fs` |
| Shell/spawn | Node.js `child_process.spawn` | `tauri-plugin-shell` |
| Persistent store | `electron-store` | `tauri-plugin-store` |
| Auto-update | `electron-updater` | `tauri-plugin-updater` |
| Dialog | `electron.dialog` | `tauri-plugin-dialog` |
| OS open URL | `shell.openExternal` | `tauri-plugin-opener` |
| Logging | `electron-log` | `tauri-plugin-log` |
| Environment vars | `import.meta.env.MAIN_VITE_*` | Tauri `[build] before-dev-command` + `dotenv-cli`, same `VITE_*` scoping |

### What Stays Unchanged

- All 78 React components in `src/renderer/src/`
- Kick API client (`utils/services/kick/`)
- 7TV API + WebSocket client (`utils/services/seventv/`)
- Connection manager (`utils/services/connectionManager.js`)
- Zustand providers (ChatProvider, CosmeticsProvider, SettingsProvider)
- SCSS stylesheets
- Lexical editor setup
- Vite build pipeline (renderer only)
- OpenTelemetry instrumentation in `src/renderer/src/telemetry/`

---

## 3. Architecture Changes

### Current (Electron)

```
┌──────────────────────────────────────────────┐
│  Main Process (Node.js)                      │
│  src/main/index.js                           │
│  - Window management                         │
│  - IPC handlers (70+)                        │
│  - System tray                               │
│  - Auto-update                               │
│  - File I/O (sounds, store)                  │
│  - Streamlink spawn                          │
│  - OTLP relay (HTTPS)                        │
│  - OpenTelemetry NodeSDK                     │
├──────────────────────────────────────────────┤
│  Preload (contextBridge)                     │
│  src/preload/index.js                        │
│  - Exposes window.app, window.telemetry etc. │
├──────────────────────────────────────────────┤
│  Renderer (Chromium + React)                 │
│  src/renderer/src/                           │
│  - React components                          │
│  - WebSocket connections (Kick, 7TV)         │
│  - Calls window.app.* APIs                   │
└──────────────────────────────────────────────┘
```

### Target (Tauri v2)

```
┌──────────────────────────────────────────────┐
│  Rust Core (src-tauri/src/)                  │
│  - Window management (WebviewWindowBuilder)  │
│  - Tauri commands (replaces IPC handlers)    │
│  - System tray (plugin-tray)                 │
│  - Auto-update (plugin-updater)              │
│  - File I/O (plugin-fs)                      │
│  - Streamlink spawn (plugin-shell)           │
│  - OTLP relay (reqwest HTTP client)          │
│  - Settings store (plugin-store)             │
├──────────────────────────────────────────────┤
│  Renderer (OS WebView + React)               │
│  src/renderer/src/                           │
│  - React components (unchanged)             │
│  - WebSocket connections (unchanged)         │
│  - Calls invoke('command_name', args)        │
│    instead of window.app.*()                 │
│  - Calls listen('event', cb)                 │
│    instead of ipcRenderer.on()               │
└──────────────────────────────────────────────┘
```

### Key Difference: No Preload

In Electron, the preload script is needed to safely bridge Node APIs to the renderer. In Tauri, the renderer calls Rust commands directly via `@tauri-apps/api/core`'s `invoke()` function. The entire `src/preload/` directory is replaced by:
1. Rust command handlers in `src-tauri/src/commands/`
2. A thin JS wrapper module in the renderer (`src/renderer/src/lib/tauriAPI.js`) that mirrors the current `window.app.*` surface — allowing components to be migrated incrementally.

---

## 4. API & Dependency Mapping

### npm Dependencies to Remove

```
electron
electron-vite
electron-updater
electron-store
electron-log
electron-util
@electron-toolkit/utils
@electron-toolkit/preload
electron-builder
```

### npm Dependencies to Add

```
@tauri-apps/api          # Core Tauri JS bindings (invoke, listen, emit)
@tauri-apps/plugin-store # JS bindings for plugin-store
@tauri-apps/plugin-dialog
@tauri-apps/plugin-fs
@tauri-apps/plugin-shell
@tauri-apps/plugin-updater
@tauri-apps/plugin-log
@tauri-apps/plugin-opener
@tauri-apps/plugin-notification
```

### Rust Cargo Dependencies (`src-tauri/Cargo.toml`)

```toml
[dependencies]
tauri              = { version = "2", features = ["tray-icon", "image-ico", "image-png"] }
tauri-plugin-store = "2"
tauri-plugin-fs    = "2"
tauri-plugin-shell = "2"
tauri-plugin-dialog = "2"
tauri-plugin-updater = "2"
tauri-plugin-log   = "2"
tauri-plugin-opener = "2"
tauri-plugin-notification = "2"
tauri-plugin-tray  = "2"
serde              = { version = "1", features = ["derive"] }
serde_json         = "1"
reqwest            = { version = "0.12", features = ["json", "rustls-tls"] }
tokio              = { version = "1", features = ["full"] }
base64             = "0.22"
```

---

## 5. IPC Channel Migration

All 70+ Electron IPC channels map to Tauri commands (`#[tauri::command]`) and events (`emit` / `listen`). The table below groups them by domain.

### Naming Convention

| Electron pattern | Tauri equivalent |
|-----------------|-----------------|
| `ipcMain.handle('store:get', ...)` | `#[tauri::command] fn store_get(...)` |
| `ipcRenderer.invoke('store:get', key)` | `invoke('store_get', { key })` |
| `ipcRenderer.on('store:updated', cb)` | `listen('store_updated', cb)` |
| `webContents.send('store:updated', data)` | `app.emit_to('main', 'store_updated', data)` |

### 5.1 Store / Settings

| Electron Channel | Tauri Command / Event | Notes |
|-----------------|----------------------|-------|
| `store:get` | `store_get` | Returns JSON value by key |
| `store:set` | `store_set` | Persists and broadcasts |
| `store:delete` | `store_delete` | |
| broadcast `store:updated` | emit `store_updated` | Emitted to all windows after set/delete |

Implementation: use `tauri-plugin-store`. The Rust command calls `store.get(key)`, serializes to JSON, returns to renderer. On `store_set`, after persisting, call `app_handle.emit("store_updated", payload)`.

### 5.2 Dialogs (Child Windows)

Each child window (auth, user, chatters, settings, search, replyThread) becomes a named Tauri `WebviewWindow`. Commands open/close them; events send data between windows.

| Electron Channel | Tauri Command / Event |
|-----------------|----------------------|
| `userDialog:open` | `open_user_dialog` → `WebviewWindowBuilder::new("user", ...)` |
| `userDialog:close` | `close_window` with label `"user"` |
| `userDialog:pin` | `set_user_dialog_pin` → `window.set_always_on_top()` |
| `userDialog:move` | `move_user_dialog` → `window.set_position()` |
| emit `userDialog:data` | emit `user_dialog_data` to window `"user"` |
| `authDialog:open/close/auth` | `open_auth_dialog`, `close_window("auth")`, `submit_auth` |
| `chattersDialog:open/close` | `open_chatters_dialog`, `close_window("chatters")` |
| emit `chattersDialog:data` | emit `chatters_dialog_data` |
| `settingsDialog:open/close` | `open_settings_dialog`, `close_window("settings")` |
| emit `settingsDialog:data` | emit `settings_dialog_data` |
| `searchDialog:open/close` | `open_search_dialog`, `close_window("search")` |
| emit `searchDialog:data` | emit `search_dialog_data` |
| `replyThreadDialog:open/close` | `open_reply_thread_dialog`, `close_window("reply_thread")` |
| emit `replyThreadDialog:data` | emit `reply_thread_dialog_data` |
| `reply:open` | `open_reply` |
| emit `reply:data` | emit `reply_data` |

### 5.3 Chat Logs (In-Memory)

These currently live in the Node.js main process as `Map` objects. In Tauri they live in a Rust `Mutex<HashMap>` managed as Tauri state.

| Electron Channel | Tauri Command |
|-----------------|--------------|
| `chatLogs:get` | `chat_logs_get` |
| `chatLogs:add` | `chat_logs_add` |
| `logs:updateDeleted` | `chat_logs_update_deleted` |
| broadcast `chatLogs:updated` | emit `chat_logs_updated` |
| `replyLogs:get` | `reply_logs_get` |
| `replyLogs:add` | `reply_logs_add` |
| `replyLogs:updateDeleted` | `reply_logs_update_deleted` |
| `replyLogs:clear` | `reply_logs_clear` |
| broadcast `replyLogs:updated` | emit `reply_logs_updated` |

State definition:
```rust
struct ChatLogState(Mutex<HashMap<String, VecDeque<ChatMessage>>>);
```

### 5.4 Notification Sounds

| Electron Channel | Tauri Command |
|-----------------|--------------|
| `notificationSounds:getAvailable` | `get_available_sounds` → `tauri-plugin-fs` readDir |
| `notificationSounds:getSoundUrl` | `get_sound_url` → returns `asset://` URL via `convertFileSrc` |
| `notificationSounds:openFolder` | `open_sound_picker` → `tauri-plugin-dialog` open |

Note: In Tauri, audio assets are served via `asset://localhost/` using `convertFileSrc()` from `@tauri-apps/api/core`. The `tauri.conf.json` capability must include `asset` protocol scope for the sounds directory.

### 5.5 Window Control

| Electron IPC | Tauri approach |
|-------------|---------------|
| `minimize` (send) | `getCurrentWindow().minimize()` (JS, no command needed) |
| `maximize` (send) | `getCurrentWindow().toggleMaximize()` |
| `close` (send) | `getCurrentWindow().close()` |
| `alwaysOnTop` | `always_on_top` command → `window.set_always_on_top(val)` |
| `bring-to-front` | `getCurrentWindow().setFocus()` (JS) |

Window control (minimize/maximize/close) can be called directly from the renderer via `@tauri-apps/api/window` without a round-trip command. This simplifies TitleBar.jsx.

### 5.6 Authentication

| Electron Channel | Tauri Approach |
|-----------------|---------------|
| `logout` | `logout` command → clear plugin-store auth keys + call `session.clearStorageData` equivalent via Tauri webview clear cookies |

Note: Tauri does not expose a direct "clear all cookies" API. The equivalent is implemented via a JavaScript `document.cookie` clear loop in the renderer after the `logout` command completes, or by using a custom Tauri capability. Investigate per-platform WebView cookie clearing in Tauri v2.

### 5.7 Streamlink

| Electron Channel | Tauri Command |
|-----------------|--------------|
| `streamlink:launch` | `streamlink_launch` → `tauri-plugin-shell` sidecar or `Command::new` |
| `streamlink:checkAvailable` | `streamlink_check` → shell `which`/`where` |

The `tauri-plugin-shell` `Command::new("streamlink")` replaces `child_process.spawn`. Shell commands must be explicitly allowed in `capabilities/default.json` scope.

### 5.8 Utilities

| Electron Channel | Tauri Approach |
|-----------------|---------------|
| `utils:showNotification` | `tauri-plugin-notification` or `tauri-plugin-dialog` `message()` |
| `get-app-info` | `get_app_info` → `tauri::AppHandle` version + `std::env::consts::OS` |
| `app.utils.openExternal` | `tauri-plugin-opener` `open_url()` |

### 5.9 Auto-Update

| Electron Channel | Tauri Approach |
|-----------------|---------------|
| `autoUpdater:check` | `check_for_updates` → `tauri-plugin-updater` |
| `autoUpdater:download` | `download_update` |
| `autoUpdater:install` | `install_update` |
| `autoUpdater:setEnabled` | `set_auto_update_enabled` → store flag |
| emit `autoUpdater:status` | emit `updater_status` |
| emit `autoUpdater:dismiss` | emit `updater_dismiss` |

### 5.10 OTLP / Telemetry Relay

| Electron Channel | Tauri Approach |
|-----------------|---------------|
| `otel:get-config` | `get_otel_config` → reads env vars at startup, returns config struct |
| `otel:trace-export-json` | `export_traces` → `reqwest` POST to Grafana Cloud OTLP endpoint |
| `telemetry:readTrace` | `read_trace` → `reqwest` GET to Grafana Tempo with Basic Auth |
| `telemetry:record*` (50+ channels) | `record_telemetry` with a typed `TelemetryEvent` enum or direct `metrics_*` commands |

The OTLP relay currently exists to bypass CORS in the Electron renderer. In Tauri, the renderer WebView has the same restriction, so the Rust HTTP relay is still required. `reqwest` is the natural replacement for Node.js `https`.

### 5.11 Platform-Specific AlwaysOnTop

The Electron main process has platform branches:
```javascript
if (process.platform === "darwin") { window.setVisibleOnAllWorkspaces(true) }
```

In Tauri Rust:
```rust
#[cfg(target_os = "macos")]
window.set_visible_on_all_workspaces(true)?;
window.set_always_on_top(true)?;
```

---

## 6. Window Management

### Window Definitions

| Window | Label | Size | Features |
|--------|-------|------|----------|
| Main chat | `"main"` | 1400×900 (min 800×600) | frameless, transparent bg, resizable |
| Auth | `"auth"` | 1100×700 | frameless, transparent, modal |
| User profile | `"user"` | 600×800 | pinnable, movable |
| Chatters | `"chatters"` | 700×600 | frameless, transparent |
| Settings | `"settings"` | 1200×700 | frameless, transparent |
| Search | `"search"` | 1200×700 | frameless, transparent |
| Reply thread | `"reply_thread"` | 900×700 | frameless, transparent |

### Frameless + Transparent Windows in Tauri

```rust
WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
  .title("KickTalk")
  .inner_size(1400.0, 900.0)
  .min_inner_size(800.0, 600.0)
  .decorations(false)          // frameless
  .transparent(true)
  .resizable(true)
  .build()?;
```

### Custom Title Bar

`TitleBar.jsx` currently uses `ipcRenderer.send('minimize')` etc. Replace with direct Tauri window API calls:

```javascript
import { getCurrentWindow } from '@tauri-apps/api/window';
const win = getCurrentWindow();
// minimize button
await win.minimize();
// maximize button
await win.toggleMaximize();
// close button
await win.close();
```

This removes the IPC round-trip entirely.

### Inter-Window Communication

Where `webContents.send('event', data)` is used to push data from main to a child window, use Tauri's event system:

```rust
// Rust: emit to a specific window
app.get_webview_window("user")
   .unwrap()
   .emit("user_dialog_data", &payload)?;
```

```javascript
// JS in that window
import { listen } from '@tauri-apps/api/event';
await listen('user_dialog_data', (event) => { /* ... */ });
```

---

## 7. System Tray

### Current

```javascript
tray = new Tray(iconPath);
tray.setContextMenu(Menu.buildFromTemplate([...]))
```

### Tauri Equivalent (`tauri-plugin-tray`)

```rust
use tauri_plugin_tray::{TrayIconBuilder, menu::Menu};

let tray = TrayIconBuilder::new()
  .icon(app.default_window_icon().unwrap().clone())
  .tooltip("KickTalk")
  .menu(&menu)
  .on_menu_event(|app, event| { /* handle Show/Hide, Settings, Quit */ })
  .on_tray_icon_event(|tray, event| { /* click to toggle visibility */ })
  .build(app)?;
```

Menu items and their handlers map directly:
- **Show/Hide**: `app.get_webview_window("main").unwrap().show()` / `.hide()`
- **Settings**: emit event to main window to open settings dialog
- **Quit**: `app.exit(0)` after cleanup

---

## 8. Auto-Update

### Current

`electron-updater` reads `electron-builder.yml` publish config (GitHub releases) and checks `latest.yml`.

### Tauri Equivalent

`tauri-plugin-updater` reads `tauri.conf.json` updater config:

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/KickTalkOrg/KickTalk/releases/latest/download/latest.json"
      ],
      "dialog": false,
      "pubkey": "<signing-public-key>"
    }
  }
}
```

Tauri's updater requires **code signing** (ed25519 key pair). This is a mandatory requirement — generate with `tauri signer generate`.

**Update flow in Rust:**

```rust
#[tauri::command]
async fn check_for_updates(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
  let updater = app.updater()?;
  let update = updater.check().await.map_err(|e| e.to_string())?;
  Ok(update.map(|u| UpdateInfo { version: u.version, body: u.body }))
}
```

**GitHub CI:** The release workflow must:
1. Sign artifacts with `tauri signer sign`
2. Generate `latest.json` with version, URL, and signature
3. Upload `latest.json` alongside platform installers

---

## 9. File System & Sounds

### Current

Node.js `fs` reads from `resources/sounds/` (dev) or `process.resourcesPath/app.asar.unpacked/resources/sounds/` (prod).

### Tauri Equivalent

```rust
use tauri::Manager;
use tauri_plugin_fs::FsExt;

#[tauri::command]
fn get_available_sounds(app: AppHandle) -> Result<Vec<String>, String> {
  let sounds_dir = app.path().resource_dir()
    .map_err(|e| e.to_string())?
    .join("sounds");
  let entries = std::fs::read_dir(sounds_dir)...;
  // filter .mp3 / .wav, return filenames
}
```

Sound playback in the renderer uses `convertFileSrc` to build an `asset://` URL:

```javascript
import { convertFileSrc } from '@tauri-apps/api/core';
const url = convertFileSrc('/path/to/sound.mp3');
new Audio(url).play();
```

**Capability required in `capabilities/default.json`:**
```json
{
  "permissions": [
    "fs:allow-read-files",
    "fs:allow-read-dir",
    { "identifier": "asset:allow-fetch", "allow": [{ "path": "$RESOURCE/sounds/**" }] }
  ]
}
```

User-selected custom sounds (currently copied via `fs.copyFileSync`) use the `tauri-plugin-dialog` open dialog + `tauri-plugin-fs` copy:

```rust
#[tauri::command]
async fn add_custom_sound(app: AppHandle, source_path: String) -> Result<String, String> {
  let dest = app.path().resource_dir()?.join("sounds").join(filename);
  std::fs::copy(&source_path, &dest)?;
  Ok(filename)
}
```

---

## 10. Persistent Store / Settings

### Current

`electron-store` writes JSON to `~/.config/KickTalk/config.json` and a separate `SessionTokens.env` for auth.

### Tauri Equivalent

`tauri-plugin-store` provides the same key/value JSON persistence:

```rust
use tauri_plugin_store::StoreExt;

#[tauri::command]
fn store_get(app: AppHandle, key: String) -> Result<serde_json::Value, String> {
  let store = app.store("config.json")?;
  Ok(store.get(&key).unwrap_or(serde_json::Value::Null))
}

#[tauri::command]
fn store_set(app: AppHandle, key: String, value: serde_json::Value) -> Result<(), String> {
  let store = app.store("config.json")?;
  store.set(key.clone(), value.clone());
  store.save()?;
  app.emit("store_updated", json!({ "key": key, "value": value }))?;
  Ok(())
}
```

Auth tokens use a separate `auth.json` store, with the same plugin, restricted by Tauri capabilities to prevent renderer access if desired.

**Data location** (Tauri defaults):
- Windows: `%APPDATA%\com.bp602.kicktalk.app\`
- macOS: `~/Library/Application Support/com.bp602.kicktalk.app/`
- Linux: `~/.config/com.bp602.kicktalk.app/`

Existing users' settings from `electron-store` will need a one-time migration script that reads the old path and writes to the new store on first launch.

---

## 11. Shell / Streamlink Launcher

### Current

```javascript
const proc = spawn('streamlink', [url, quality, '--player', player, ...customArgs]);
```

### Tauri Equivalent

`tauri-plugin-shell` with explicit command allowlist:

```rust
// src-tauri/src/commands/streamlink.rs
#[tauri::command]
async fn streamlink_launch(username: String, quality: String, player: String) -> Result<(), String> {
  let url = format!("https://kick.com/{}", username);
  Command::new("streamlink")
    .args([&url, &quality, "--player", &player])
    .spawn()
    .map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
async fn streamlink_check() -> bool {
  Command::new("streamlink").arg("--version").output().is_ok()
}
```

**Capability (`capabilities/default.json`):**
```json
{
  "permissions": [
    { "identifier": "shell:allow-execute", "allow": [{ "name": "streamlink", "cmd": "streamlink", "args": true }] }
  ]
}
```

---

## 12. Dialogs & Notifications

### File Picker

```rust
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
async fn open_sound_picker(app: AppHandle) -> Result<Option<String>, String> {
  let path = app.dialog()
    .file()
    .add_filter("Audio", &["mp3", "wav"])
    .blocking_pick_file();
  Ok(path.map(|p| p.to_string_lossy().into()))
}
```

### Message Boxes / Notifications

Replace `dialog.showMessageBox()` with `tauri-plugin-dialog`:
```rust
app.dialog().message("Update available!").title("KickTalk").blocking_show();
```

Or use `tauri-plugin-notification` for OS-level toast notifications:
```rust
use tauri_plugin_notification::NotificationExt;
app.notification().builder().title("KickTalk").body(message).show()?;
```

---

## 13. Telemetry & OpenTelemetry

### Node SDK → Renderer + Rust HTTP Relay

The current OpenTelemetry setup (`src/telemetry/tracing.js`) uses the Node.js SDK which cannot run in Tauri's Rust backend directly. The migration has two parts:

#### 13.1 Renderer Tracing

Move trace generation to the renderer using the **browser/Web SDK**:

```
npm install @opentelemetry/sdk-trace-web @opentelemetry/exporter-trace-otlp-http
```

Traces are collected in the renderer and exported via the IPC relay (same as today — the `otel:trace-export-json` pattern remains, just using `invoke('export_traces', payload)` instead).

#### 13.2 Rust OTLP Relay

Replace the Node.js `https` module relay with a `reqwest` handler in Rust:

```rust
#[tauri::command]
async fn export_traces(payload: serde_json::Value, state: State<'_, OtelConfig>) -> Result<serde_json::Value, String> {
  let client = reqwest::Client::new();
  let res = client
    .post(&state.endpoint)
    .header("Authorization", &state.auth_header)
    .header("Content-Type", "application/json")
    .json(&payload)
    .send()
    .await
    .map_err(|e| e.to_string())?;
  Ok(res.json().await.unwrap_or_default())
}
```

#### 13.3 Metrics

The 50+ `telemetry:record*` IPC channels can be consolidated into a single typed command:

```rust
#[derive(serde::Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum TelemetryEvent {
  MessageSent { channel: String, length: u32 },
  WebSocketConnection { endpoint: String, duration_ms: u64 },
  // ... etc
}

#[tauri::command]
fn record_telemetry(event: TelemetryEvent, state: State<'_, MetricsState>) {
  state.record(event);
}
```

Alternatively, keep the 1:1 channel mapping for a safer incremental migration.

#### 13.4 What Stays the Same

- All renderer-side telemetry code (`src/renderer/src/telemetry/`) remains unchanged
- Environment variable names can stay the same (`MAIN_VITE_OTEL_*`) — in Tauri, env vars available at build time are injected via `vite.config.ts` in the renderer build
- Grafana Cloud endpoints and auth headers remain the same

---

## 14. Authentication & Secrets

### Current

- `electron-store` stores `SESSION_TOKEN` and `KICK_SESSION` in `SessionTokens.env` file
- `session.defaultSession.clearStorageData()` clears cookies on logout
- Preload reads tokens and validates on startup

### Tauri Equivalent

- Use `tauri-plugin-store` with a separate `auth.json` store
- On logout, clear the store and clear cookies via a JS snippet injected to the webview, or use platform-specific WebView cookie APIs
- Token validation logic in the preload (`isValidToken()`) moves to a Rust command:

```rust
#[tauri::command]
async fn is_valid_token(state: State<'_, AuthState>) -> bool {
  state.session_token.lock().is_some()
}
```

- Preload startup logic (silenced users fetch, settings sync to localStorage) moves to an app setup command called from `App.jsx` on mount using a `useEffect`.

---

## 15. Build System

### Current

```
electron-vite build
  └─ main/     → out/main/index.js  (Node.js bundle)
  └─ preload/  → out/preload/index.js
  └─ renderer/ → out/renderer/      (Vite React bundle)

electron-builder
  └─ NSIS (.exe), DMG, AppImage
```

### Target

```
vite build  (renderer only, configured in vite.config.ts)
  └─ dist/   → src-tauri/dist/

cargo tauri build
  └─ target/release/bundle/
       ├─ nsis/         (.exe)
       ├─ dmg/          (.dmg)
       └─ appimage/     (.AppImage)
```

### New Config Files

| File | Purpose |
|------|---------|
| `src-tauri/tauri.conf.json` | App identity, window defaults, updater, bundle config |
| `src-tauri/Cargo.toml` | Rust dependencies |
| `src-tauri/capabilities/default.json` | Plugin permission scopes |
| `src-tauri/icons/` | App icons (generated via `tauri icon`) |
| `vite.config.ts` | Renderer Vite config (extracted from electron.vite.config.mjs) |

### vite.config.ts (Renderer)

The current `electron.vite.config.mjs` renderer section maps cleanly to a standalone `vite.config.ts`. The 7 HTML entry points remain. Path aliases (`@renderer`, `@components`, `@assets`, `@utils`) are kept unchanged.

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../src-tauri/dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/renderer/index.html'),
        auth: resolve(__dirname, 'src/renderer/auth.html'),
        user: resolve(__dirname, 'src/renderer/user.html'),
        chatters: resolve(__dirname, 'src/renderer/chatters.html'),
        settings: resolve(__dirname, 'src/renderer/settings.html'),
        search: resolve(__dirname, 'src/renderer/search.html'),
        replyThread: resolve(__dirname, 'src/renderer/replyThread.html'),
      }
    }
  },
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@components': resolve(__dirname, 'src/renderer/src/components'),
      '@assets': resolve(__dirname, 'src/renderer/src/assets'),
      '@utils': resolve(__dirname, 'utils'),
    }
  },
  envPrefix: ['VITE_', 'RENDERER_VITE_']
});
```

### package.json Scripts

```json
{
  "scripts": {
    "dev":       "tauri dev",
    "build":     "tauri build",
    "build:win": "tauri build --target x86_64-pc-windows-msvc",
    "build:mac": "tauri build --target universal-apple-darwin",
    "build:linux": "tauri build --target x86_64-unknown-linux-gnu",
    "lint":      "eslint src/renderer"
  }
}
```

---

## 16. CI/CD Changes

### build.yml Changes

| Step | Before | After |
|------|--------|-------|
| Setup | `actions/setup-node@v4` | Add `dtolnay/rust-toolchain@stable` + `Swatinem/rust-cache@v2` |
| Build | `npm run build && electron-builder` | `npm run build` (tauri build runs via CLI) |
| Sign (macOS) | disabled | Required: `tauri signer` + `APPLE_CERTIFICATE` secrets |
| Sign (Windows) | disabled | Optional: `WINDOWS_CERTIFICATE` secrets |
| Update manifest | `latest.yml` (electron-updater) | `latest.json` (tauri-plugin-updater) |
| Artifacts | `.exe`, `.dmg`, `.AppImage`, `.blockmap` | `.exe`, `.dmg`, `.AppImage`, `.sig` files |

### Matrix Changes

The build matrix stays the same 4 runners but requires Rust toolchain on each:

```yaml
- name: Install Rust
  uses: dtolnay/rust-toolchain@stable
  with:
    targets: ${{ matrix.target }}

- name: Rust cache
  uses: Swatinem/rust-cache@v2
  with:
    workspaces: './src-tauri -> target'
```

### Updater Signing Key Setup

```yaml
env:
  TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
```

Generate keys once with `tauri signer generate -w ~/.tauri/myapp.key` and store in GitHub Secrets.

---

## 17. Migration Phases

### Phase 0 — Preparation (1–2 weeks)

- [ ] Install Tauri CLI and Rust toolchain locally
- [ ] Run `tauri init` in project root to scaffold `src-tauri/`
- [ ] Extract renderer Vite config from `electron.vite.config.mjs` to `vite.config.ts`
- [ ] Confirm renderer builds standalone: `vite build`
- [ ] Audit all `window.app.*` calls in renderer components and document them (generates migration checklist)
- [ ] Generate Tauri icon set: `tauri icon resources/icons/KickTalk_v1_512.png`
- [ ] Set up `tauri.conf.json` with window definitions, bundle ID, updater config
- [ ] Generate ed25519 signing key pair; store private key in `TAURI_SIGNING_PRIVATE_KEY` GitHub Secret

### Phase 1 — Core Infrastructure (2–3 weeks)

- [ ] Implement `src-tauri/src/main.rs` bootstrap (app setup, plugin registration)
- [ ] Port `store_get`, `store_set`, `store_delete` commands with `tauri-plugin-store`
- [ ] Port window management: all 7 window definitions in Rust
- [ ] Port TitleBar.jsx to use `@tauri-apps/api/window` directly (no IPC)
- [ ] Implement the JS compatibility shim `src/renderer/src/lib/tauriAPI.js` that mirrors `window.app.*`
- [ ] Wire up basic app launch, settings loading, and renderer startup flow

### Phase 2 — IPC Command Migration (3–4 weeks)

Work domain by domain, checking off IPC channels:

- [ ] Chat logs (in-memory state in Rust `Mutex<HashMap>`)
- [ ] Dialog windows (open/close/data events for all 6 child windows)
- [ ] Notification sounds (fs read, asset URL, file picker)
- [ ] Streamlink (shell plugin, check + launch)
- [ ] Authentication (store, logout, token validation)
- [ ] Auto-update (plugin-updater, check/download/install flow)
- [ ] Utilities (openExternal, showNotification, get-app-info)
- [ ] System tray (plugin-tray, context menu, click handler)

### Phase 3 — Telemetry Migration (1–2 weeks)

- [ ] Replace Node.js OpenTelemetry SDK with browser WebSDK in renderer
- [ ] Port OTLP relay from Node.js `https` to Rust `reqwest`
- [ ] Port Grafana Tempo query from Node.js `https` to Rust `reqwest`
- [ ] Consolidate or map 50+ telemetry IPC channels to Tauri commands
- [ ] Validate traces appear in Grafana Cloud after migration
- [ ] Port metrics recording (MetricsHelper) — can remain mostly as-is in renderer, relay to Rust for export

### Phase 4 — Build & CI (1 week)

- [ ] Remove electron-builder, electron-vite, electron-specific packages
- [ ] Update `package.json` scripts to use `tauri dev` / `tauri build`
- [ ] Update `.github/workflows/build.yml` with Rust toolchain, Tauri build steps, signing
- [ ] Update release artifact names and upload paths
- [ ] Validate Windows, macOS (x64 + arm64), and Linux builds
- [ ] Test auto-update flow end-to-end (install old version → update to new)

### Phase 5 — Settings Migration (1 week)

- [ ] Write one-time migration script that reads existing `electron-store` paths and imports into `tauri-plugin-store` on first launch
- [ ] Validate no settings are lost on upgrade
- [ ] Remove `electron-store` from dependencies

### Phase 6 — QA & Polish (1–2 weeks)

- [ ] Test all 7 windows on Windows, macOS, Linux
- [ ] Test custom title bar drag, resize, minimize/maximize/close
- [ ] Test system tray on all platforms
- [ ] Test notification sounds (built-in and custom)
- [ ] Test streamlink integration
- [ ] Test auto-update (full cycle)
- [ ] Test WebSocket connections (Kick Pusher, 7TV)
- [ ] Test all mod actions
- [ ] Verify telemetry data in Grafana Cloud
- [ ] Performance baseline: compare RAM/CPU before and after

---

## 18. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| OS WebView inconsistencies (WKWebView/WebView2/WebKitGTK render differently) | High | Test all CSS/animations on all 3 platforms early; use CSS resets |
| Transparent frameless windows behave differently per OS WebView | High | Test `transparent: true` on each platform immediately in Phase 0 |
| Cookie clearing on logout may not fully work in Tauri | Medium | Investigate `tauri::WebviewWindowBuilder::clear_browsing_data()` (v2); fall back to JS clear |
| `electron-store` → `tauri-plugin-store` data migration could lose settings | High | Write migration script in Phase 5; ship with fallback to defaults on failure; keep electron-store as dev-only fallback during transition |
| Tauri updater requires code signing; no signing currently set up | High | Generate keys in Phase 0; add secrets to GitHub before Phase 4 CI work |
| Rust compile times slow CI builds significantly | Medium | Use `Swatinem/rust-cache@v2`; only build release on tags, debug on PRs |
| `tauri-plugin-shell` allowlist is strict; streamlink args may be complex | Medium | Test all streamlink arg patterns in capability scope; use `args: true` permissively or enumerate patterns |
| 50+ telemetry IPC channels: risk of regressions during mapping | Medium | Write a telemetry smoke test that exercises each channel; keep 1:1 mapping first, consolidate later |
| WebView2 on Windows must be installed by end-user (not bundled) | Low | NSIS installer can check for WebView2 and prompt; Tauri handles this by default in their NSIS template |
| Audio playback via `asset://` URL may behave differently than `file://` or base64 | Low | Test notification sound playback early; `convertFileSrc` is well-documented |
| Lexical editor may use browser APIs that behave differently on WebKitGTK | Low | Test editor on Linux early; known Lexical issues on WebKitGTK are documented |

---

## 19. Effort Estimates

| Phase | Effort | Complexity Driver |
|-------|--------|------------------|
| Phase 0 — Preparation | 5–10 days | Scaffolding, config extraction, icon generation |
| Phase 1 — Core Infrastructure | 10–15 days | Window management, store, JS shim layer |
| Phase 2 — IPC Command Migration | 15–20 days | 70+ channels across 6 domains, Rust implementation |
| Phase 3 — Telemetry Migration | 5–10 days | OTLP relay, 50+ telemetry channels, browser SDK |
| Phase 4 — Build & CI | 3–5 days | Workflow changes, signing setup, platform builds |
| Phase 5 — Settings Migration | 3–5 days | Data migration script, path mapping per OS |
| Phase 6 — QA & Polish | 5–10 days | Cross-platform testing, edge cases |
| **Total** | **46–75 days** | ~9–15 weeks solo; ~5–8 weeks with 2 people |

---

## Appendix A: Tauri Capability Template

`src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "KickTalk default capabilities",
  "windows": ["main", "auth", "user", "chatters", "settings", "search", "reply_thread"],
  "permissions": [
    "core:default",
    "core:window:allow-minimize",
    "core:window:allow-maximize",
    "core:window:allow-close",
    "core:window:allow-set-focus",
    "core:window:allow-set-always-on-top",
    "core:window:allow-set-position",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-toggle-maximize",
    "fs:allow-read-files",
    "fs:allow-read-dir",
    "fs:allow-write-files",
    "fs:allow-create",
    "fs:allow-copy-file",
    "fs:allow-exists",
    "fs:allow-mkdir",
    "fs:default",
    { "identifier": "asset:allow-fetch", "allow": [{ "path": "$RESOURCE/sounds/**" }] },
    "dialog:allow-open",
    "dialog:allow-message",
    "shell:allow-execute",
    "opener:allow-open-url",
    "notification:default",
    "store:allow-get",
    "store:allow-set",
    "store:allow-delete",
    "store:allow-save",
    "updater:allow-check",
    "updater:allow-download",
    "updater:allow-install",
    "log:default"
  ]
}
```

---

## Appendix B: Directory Structure After Migration

```
KickTalk/
├── src/
│   └── renderer/         # React app (largely unchanged)
│       ├── src/
│       │   ├── lib/
│       │   │   └── tauriAPI.js     # NEW: compatibility shim for window.app.*
│       │   ├── components/         # unchanged
│       │   ├── providers/          # unchanged
│       │   └── telemetry/          # updated for browser OTEL SDK
│       └── *.html                  # unchanged
├── src-tauri/             # NEW: Tauri/Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   └── commands/
│   │       ├── store.rs
│   │       ├── windows.rs
│   │       ├── sounds.rs
│   │       ├── streamlink.rs
│   │       ├── auth.rs
│   │       ├── updater.rs
│   │       ├── telemetry.rs
│   │       └── chat_logs.rs
│   ├── capabilities/
│   │   └── default.json
│   ├── icons/
│   ├── tauri.conf.json
│   └── Cargo.toml
├── utils/                 # unchanged (Kick API, 7TV, connectionManager)
├── resources/             # unchanged
├── vite.config.ts         # NEW: extracted renderer Vite config
├── package.json           # updated scripts, deps
└── .github/workflows/
    └── build.yml          # updated for Tauri + Rust
```

*`src/main/`, `src/preload/`, and `src/telemetry/` (Node.js) are deleted.*
