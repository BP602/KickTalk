# Repository Guidelines

## Electron‑Vite Patterns

- App stack: electron‑vite + React. Prefer electron‑vite conventions over raw Electron.
- Preload loading: from main, point to the built preload (e.g., `join(__dirname, '../preload/index.js')`); in ESM, use `fileURLToPath(new URL('../preload/index.js', import.meta.url))`.
- Security: keep `contextIsolation: true`; avoid direct Node APIs in renderer.
- Assets: resolve via Vite URLs (e.g., `new URL('./icon.png', import.meta.url)`).
- Docs: when unsure, use Context7 to consult electron‑vite/Electron/Vite docs and confirm patterns.

## Project Structure

- Source root: `src/`
- Main (Electron, Node context): `src/main/`
- Preload bridges: `src/preload/`
- Renderer (React): `src/renderer/src/**` (components, hooks, assets, styles)
- Telemetry: `src/telemetry/**`, `src/renderer/src/telemetry/**`
- Build output: bundled `out/`; installers in `dist/`
- Config: `electron.vite.config.mjs` (main, preload, renderer builds)
- Docs/examples: `docs/`; load/perf artifacts: `tests/`

## Preload Bridges

- API surface: expose minimal, purpose‑built functions via `contextBridge.exposeInMainWorld`.
- Isolation: keep `contextIsolation: true` and avoid exposing raw Node.
- Contract: document each exposed method and validate inputs on the main side.

## IPC Model

- Request/response: main registers `ipcMain.handle('channel', fn)`; renderer calls `ipcRenderer.invoke('channel', payload)`.
- Events: use `ipcRenderer.send`/`ipcMain.on` for fire‑and‑forget; prefer namespaced channels like `app:settings:get`.
- Safety: validate/sanitize payloads in main; avoid wildcards and dynamic eval.
- Example: renderer `await window.electron.ping()` ↔ main `ipcMain.handle('ping', () => 'pong')`.

## Env & Secrets

- Access: use `import.meta.env` with electron‑vite’s scoped prefixes.
- Default prefixes (active):
  - Context‑scoped: `MAIN_VITE_*` (main), `PRELOAD_VITE_*` (preload), `RENDERER_VITE_*` (renderer)
  - Shared non‑secrets: `VITE_*`
  - Unprefixed keys are ignored by Vite.
- KickTalk naming:
  - Use `MAIN_VITE_KT_*`, `PRELOAD_VITE_KT_*`, `RENDERER_VITE_KT_*` for app‑specific vars per context.
  - Avoid bare `KT_*` in renderer; it is not exposed via `import.meta.env` with the default config.
  - If you need bare `KT_*` available in a target, you can override that target’s `envPrefix` in `electron.vite.config.mjs` (not enabled now). By default, `loadEnv()` only loads `MAIN_VITE_*`, `PRELOAD_VITE_*`, `RENDERER_VITE_*` unless overridden.
 - Secrets: keep in `process.env`/`MAIN_VITE_*` (main only); never expose secrets to renderer.
 - Setup: create `.env` from `.env.example`. Packaging excludes docs/tests—avoid bloat.

## Telemetry

- Instrumentation: OpenTelemetry under `src/telemetry/**` and `src/renderer/src/telemetry/**`.
 - Export: Grafana Cloud via OTLP HTTP only (no local collector by default). Renderer must not export directly.
 - Flow: renderer spans → custom IPC exporter → main process → OTLP HTTP to Grafana Cloud.
 - Mapping: main maps `MAIN_VITE_KT_*`/`MAIN_VITE_*` to `OTEL_*` envs at runtime before initializing the NodeSDK.
 - Config: set OTLP endpoint/keys in `.env` using main‑scoped prefixes (see “Env & Secrets”). Never expose secrets to renderer.

## Quick Start

- Prereqs: Node 18+ (LTS), `.env` configured for Grafana Cloud (use `MAIN_VITE_KT_*` for secrets).
- Install: `npm install`
- Dev: `npm run dev` (or `npm run dev-hr`)

## Troubleshooting

- No traces in Grafana Cloud:
  - Check `.env` values for OTLP endpoint/token under `MAIN_VITE_KT_*`.
  - Ensure renderer → IPC exporter is active; renderer must not export directly.
  - Confirm main maps `MAIN_VITE_*` → `OTEL_*` before NodeSDK init.
  - Run `await window.verifyGrafanaTraces()` and inspect main process logs.
- Env exposure:
  - Use `MAIN_VITE_*`, `PRELOAD_VITE_*`, `RENDERER_VITE_*`, or `VITE_*`. Unprefixed keys are not exposed.
  - For KT namespacing, prefer `*_VITE_KT_*`. Only customize `envPrefix` if you explicitly need bare `KT_*` in a target.

## Testing

- Unit tests: Vitest for renderer and main.
  - Renderer tests: `src/renderer/src/**/*.{test,spec}.{js,jsx}`; setup `vitest.setup.renderer.js`
  - Main tests: `src/main/**/*.{test,spec}.{js}`, `utils/**/*.{test,spec}.{js}`; setup `vitest.setup.main.js`
  - Commands: `npm test`, `npm run test:run`, `npm run test:ui`, `npm run test:renderer`, `npm run test:main`, `npm run test:coverage`
- E2E tests: Playwright for full Electron app.
  - Files: `e2e/**/*.electron.spec.js`; config `playwright.config.js`; fixtures under `e2e/fixtures/`, helpers under `e2e/helpers/`
  - Commands: `npm run test:e2e`, `npm run test:e2e:ui`, `npm run test:e2e:headed`, `npm run test:e2e:debug`, `npm run test:e2e:report`
 - Guidance: keep tests fast/deterministic; mock Electron bridges in unit tests; capture screenshots on failures in E2E.

## Command Matrix

- Dev/Run
  - `npm run dev` — start dev (HMR)
  - `npm run dev-hr` — dev with hot reload (`--watch`)
  - `npm start` — preview packaged output

- Lint/Format
  - `npm run lint` — ESLint
  - `npm run lint:fix` — ESLint with fixes
  - `npm run format` — Prettier write

- Unit tests (Vitest)
  - `npm test` — watch mode
  - `npm run test:run` — run once
  - `npm run test:ui` — Vitest UI
  - `npm run test:renderer` — renderer tests
  - `npm run test:main` — main tests
  - `npm run test:coverage` — coverage report
  - `npm run test:smoke` — smoke test (Navbar)

- E2E (Playwright)
  - `npm run test:e2e` — run all
  - `npm run test:e2e:ui` — Playwright UI
  - `npm run test:e2e:headed` — headed mode
  - `npm run test:e2e:debug` — debug mode
  - `npm run test:e2e:report` — open last report

- Build/Dist (electron-vite + electron-builder)
  - `npm run build` — bundle app
  - `npm run build:unpack` — bundle + unpack dir
  - `npm run build:win|:mac|:linux` — build for OS
  - `npm run build:win:portable|:nsis` — Windows targets
  - `npm run build:mac:dmg` — Mac DMG
  - `npm run build:linux:appimage|:deb` — Linux targets
  - `npm run build:all` — all platforms
  - `npm run dist` — build + create artifacts (no publish)
  - `npm run dist:win|:mac|:linux` — per-OS artifacts (no publish)

- Utilities
  - `npm run mock:pusher` — local Pusher mock

## Commits & PRs

- Conventional Commits (`feat:`, `fix:`, `chore:`, `build:` …).
- PRs: include description, linked issues, before/after screenshots for UI changes, and risk/telemetry notes.
- CI hygiene: run lint/build locally; do not commit `dist/`.
