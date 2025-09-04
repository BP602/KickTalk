## App Features & Fixes ✨
- System tray menu: Show/Hide, Quit, Settings.
- Reply improvements: reliability and state handling.
- Streamlink integration (PR #26): External Players settings with availability check (blocks enable if not installed), detected path display with Refresh, quality selector with safe fallback to best (disabled when off), optional player command (auto‑detect by default) and custom args.
- Context menus: “Open Stream in Streamlink” on chatroom tabs and streamer cards (visible when Streamlink is enabled).
- Safety: main validates usernames and launches Streamlink via spawn (no shell); preload exposes minimal, purpose‑built APIs.
- Mentions: improved @mention detection accuracy and performance (centralized regex with proper boundaries and punctuation handling), fewer false positives, and rendering fixes.
- Live status: navbar “live” badge stays in sync via WebSocket updates with reconnect reconciliation; improved Kick WebSocket channel mapping and diagnostics.

## CI & Build ⚙️
- Disable hard links in electron-builder to prevent EEXIST issues (`USE_HARD_LINKS=false`) in `/.github/workflows/ci.yml` and `/.github/workflows/build.yml`.
- Clean packaging: `rm -rf dist` before packaging.
- Consistent builder invocation:
  - pnpm: `pnpm exec electron-builder`
  - npm: `npx --no-install electron-builder`
- Tag-triggered releases: `/.github/workflows/build.yml` builds on `v*` tags (macOS arm64/Intel, Ubuntu 24.04, Windows), validates tag vs `package.json`, uploads artifacts, and creates a GitHub Release.
- Clear artifacts: renamed with package manager suffix (e.g., `*-pnpm.dmg`, `*-npm.AppImage`).
- Faster feedback: concurrency cancels in-progress runs per ref.

## Telemetry & Observability 📊
- Renderer web tracing (fetch/XHR/context propagation) and NodeSDK bootstrap standardization.
- Intelligent sampling to reduce trace noise.
- Critical user journey tracing (Phase 1), error monitoring + user analytics (Phase 3/4).
- Business metrics (API, WebSocket lifecycle, renderer health) restored.
- Tempo verification tooling; simplified IPC relay.
- `service.version` auto-tagged from app version; MAIN_VITE_* → OTEL_* mapping in `main`.
- SLO monitoring and performance tracking.
- Updated `.env.example` and docs for telemetry.

## Developer Experience 🧰
- Added `docs/` directory.
- VSCode LGTM tasks; Docker-based local telemetry stack; cleaned submodules; internal DNS mapping.
- `.gitignore` updated for `.claude/`.
- Trimmed bundle and hardened preload; removed unused dependencies.

## Full Changelog
- https://github.com/BP602/KickTalk/compare/v1.1.8...v1.1.9
