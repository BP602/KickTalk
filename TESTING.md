# Testing Guide (Concise)

## Overview

- Unit: Vitest for renderer (React/jsdom) and main (Node).
- E2E: Playwright (Electron, sequential, reports).
- Coverage: V8 provider; reports to ./coverage/.

## Test Locations

- Renderer unit: src/renderer/src/**/*.{test,spec}.{js,jsx,ts,tsx}
- Main/preload unit: src/main/**/__tests__/*.js, src/preload/**/__tests__/*.js
- Telemetry unit: src/telemetry/__tests__/*.js
- Utils unit: utils/**/*.test.js
- E2E: e2e/*.electron.spec.js

## Commands

- All (watch off): npm run test:run
- Renderer only: npm run test:renderer
- Main only: npm run test:main
- Coverage: npm run test:coverage
- Vitest UI: VITEST_UI=true npm run test
- E2E: npm run test:e2e (:ui, :headed, :debug, :report)
 - Smoke (fast): npm run test:smoke (Navbar)
 - Reports (Vitest): test-results.json and test-report.html in project root

## Vitest Config (Essentials)

- Multi-project: vitest.config.js composes vite.config.renderer.js and vite.config.main.js.
- Renderer: environment: 'jsdom', threads capped to 2; setup vitest.setup.renderer.js.
- Main: environment: 'node', single-thread pool; setup vitest.setup.main.js.
- Excludes: node_modules, dist, out, .git, and **/*.focused.test.*.
- Coverage reporters: text, json-summary, html.
- CI fail-fast: Vitest bail=1; Playwright maxFailures=1.
- UI/watch disabled by default. Enable via VITEST_UI=true, VITEST_WATCH=true.

## Mocks and Setup

- Renderer globals: IntersectionObserver, ResizeObserver, matchMedia, WebSocket (with OPEN/CLOSED constants).
- Clipboard: minimal navigator.clipboard polyfill for copy/paste tests.
- Electron bridge: window.electronAPI available in tests (also on globalThis).
- Window.app APIs: Comprehensive mocks for getAppInfo, settingsDialog, notificationSounds, userDialog, logs, ipc, logout.
- Lexical: @lexical/react is aliased to tests/mocks/lexical-react.js to avoid deep import resolution issues; subpath plugins mocked in setup.
- Main Electron: mocked via Vite alias and setup (app, BrowserWindow, ipcMain, Menu, Tray, fs, path, OTEL SDK/exporters).
- WebSocket mock (main): Deterministic mock that opens immediately in test environment, extends EventTarget.
- CustomEvent polyfill (main): Added for Node.js environments lacking native CustomEvent.
- Config store (tests): in-memory utils/config.js to avoid real electron-store; supports dotted paths.
- Timers: real timers by default; individual tests should use scoped fake timers with async advancement when needed.

## E2E (Playwright)

- Config: playwright.config.js (1 worker, retries on CI, JSON + HTML reports, traces/screenshots on failures).
- Specs: e2e/app-launch.electron.spec.js, e2e/chat-functionality.electron.spec.js.
 - Runs the built app; starts/stops Electron automatically in tests.
 - Common flows covered: app launch, window props, basic chat UI, graceful close.

## Coverage

- Provider: V8; output in coverage/.
- Exclude: node_modules/, out/, dist/, **/*.config.*, test files, test utils, **/*.focused.test.*.

## Env & Secrets

- Use electron‑vite prefixes for env exposure:
  - MAIN_VITE_* (main), PRELOAD_VITE_* (preload), RENDERER_VITE_* (renderer), shared VITE_*.
- Secrets stay in MAIN_VITE_* (main only); never expose to renderer.
- Telemetry (OTEL) in main maps MAIN_VITE_* → OTEL_* before SDK init.
- Test behavior: OTEL exporters are mocked; `otel:get-config` reads env and returns relay config (no secrets).

## Renderer Testing Tips

- Prefer querying by role/text; avoid implementation details.
- Use `await findBy*`/`waitFor` for async state; avoid asserting mid-update.
- Cleanups and timers are handled in setup; do not manually reset unless a test changes timers.
- If code references Electron bridge, use `window.electronAPI` as provided by setup.
- For Settings/Dialog tests: ensure window.app mocks are properly saved/restored in beforeEach/afterEach.
- Use optional chaining (?.) in components when accessing window.app APIs for graceful degradation.

## Main Testing Tips

- Tests capture registered handlers via the electron mock; get handlers by channel and invoke directly.
- Telemetry gating reads `telemetry.enabled` from the config store (in-memory in tests).
- If a test depends on env, pass `envVars` to the helper (e.g., OTEL/MAIN_VITE_OTEL_*).
- For file system behavior, fs is mocked; adjust mocks per test where needed.
- For timer-based tests: use scoped fake timers (vi.useFakeTimers/vi.useRealTimers) and async timer advancement (vi.runAllTimersAsync, vi.advanceTimersByTimeAsync).
- ConnectionManager tests: ensure socket mocks emit connection-success events immediately for deterministic behavior.

### Common IPC Channels (examples)

- store:get | store:set | store:delete
- otel:get-config | otel:trace-export-json | telemetry:readTrace
- telemetry:recordMessageSent | telemetry:recordError | telemetry:recordRendererMemory
- chatLogs:get | chatLogs:add | logs:updateDeleted | replyLogs:get | replyLogs:add
- userDialog:open | authDialog:open | settingsDialog:open | alwaysOnTop | get-app-info

## Troubleshooting

- High memory: run without coverage/UI; keep renderer threads low (2). Use npm run test:renderer when iterating UI.
- Electron mocks: if a test needs real behavior, mock only the piece you need in the test file.
- No E2E traces: check .env MAIN_VITE_* values and main logs.
 - React act warnings: wrap updates in `act` or wait with RTL helpers; don’t assert before effects settle.
 - Vitest UI server port errors in restricted sandboxes: run without UI (`npm run test:run`).

## Notes

- Rough counts: ~100 unit tests + 2 E2E specs.
- We intentionally exclude *.focused.test.* from default runs.

## Current Status

- Docs: This guide is up to date with the latest test stabilization fixes.
- Vitest: UI/watch disabled by default; renderer threads=2; CI fail‑fast enabled; focused tests excluded.
- Main tests: Fixed startup span, otel:get-config (deploymentEnv=test under harness), safer telemetry error handler, constants parse issues, retry-utils hoisted mock; updated 7TV tests to assert against CustomEvent detail.
- WebSocket mock: Added deterministic WebSocket mock to vitest.setup.main.js that extends EventTarget and opens immediately in test environment.
- CustomEvent polyfill: Added to vitest.setup.main.js for Node.js environments.
- Shared sockets: Kick/7TV shared connections now dispatch a connection-success event immediately on open for deterministic ConnectionManager tests.
- ConnectionManager tests: Fixed with scoped fake timers and async timer advancement (vi.runAllTimersAsync, vi.advanceTimersByTimeAsync) to handle timeouts properly.
- Config store tests: electron-store constructor is mockable; code falls back to in‑memory when construction is unavailable.
- Renderer tests: Settings component tests fully stabilized with proper window.app mocks, optional chaining in component, and single registration of onData listeners.
- Memory footprint: Improved by limiting renderer threads and avoiding coverage/UI during local runs.
