# KickTalk v1.1.9 Release Notes

## 🚀 New Features

### 🔗 **Streamlink Integration** (PR #26)
- **External Player Support**: Complete integration with Streamlink for external media players
- **Availability Detection**: Settings automatically detect if Streamlink is installed and block enable if not available
- **Path Display & Refresh**: Shows detected Streamlink path with manual refresh capability
- **Quality Selection**: Quality selector with safe fallback to "best" (disabled when Streamlink is off)
- **Command Customization**: Optional player command override (auto-detect by default) with custom arguments
- **Context Menus**: Added "Open Stream in Streamlink" option on chatroom tabs and streamer cards
- **Security**: Main process validates usernames and launches Streamlink via spawn (no shell execution)

### 🗞️ **System Tray Menu**
- **Quick Access**: Show/Hide application, Quit, and Settings options
- **Background Operation**: Keep KickTalk running in system tray

## 🐛 Bug Fixes & Improvements

### 💬 **Reply System Enhancements**
- **Improved Reliability**: Enhanced reply message reliability and state handling
- **Better Performance**: Optimized reply processing and rendering

### 📝 **Mention Detection Improvements**
- **Enhanced Accuracy**: Improved @mention detection with centralized regex
- **Proper Boundaries**: Better punctuation handling and boundary detection
- **Reduced False Positives**: Fewer incorrect mention detections
- **Rendering Fixes**: Improved visual rendering of mentions

### 🔴 **Live Status Synchronization**
- **Real-time Updates**: Navbar "live" badge stays in sync via WebSocket updates
- **Reconnect Reconciliation**: Improved handling of connection drops and reconnections
- **Better Diagnostics**: Enhanced Kick WebSocket channel mapping and diagnostics

## 🔧 Technical Improvements

### ⚙️ **CI & Build Enhancements**
- **EEXIST Fix**: Disable hard links in electron-builder to prevent EEXIST issues (`USE_HARD_LINKS=false`)
- **Clean Packaging**: Automatic `rm -rf dist` before packaging for clean builds
- **Consistent Builder Invocation**: Standardized commands across package managers
  - pnpm: `pnpm exec electron-builder`
  - npm: `npx --no-install electron-builder`
- **Tag-triggered Releases**: Automated builds on `v*` tags for macOS arm64/Intel, Ubuntu 24.04, Windows
- **Artifact Management**: Clear naming with package manager suffix (e.g., `*-pnpm.dmg`, `*-npm.AppImage`)
- **Faster Feedback**: Concurrency controls to cancel in-progress runs per ref

### 📊 **Telemetry & Observability**
- **Web Tracing**: Renderer web tracing with fetch/XHR/context propagation
- **NodeSDK Bootstrap**: Standardized telemetry initialization
- **Intelligent Sampling**: Reduced trace noise through smart sampling
- **User Journey Tracking**: Critical user journey tracing (Phase 1)
- **Error Monitoring**: Enhanced error monitoring and user analytics (Phase 3/4)
- **Business Metrics**: Restored API, WebSocket lifecycle, and renderer health metrics
- **Tempo Integration**: Verification tooling and simplified IPC relay
- **Version Tagging**: Automatic `service.version` from app version
- **Environment Mapping**: MAIN_VITE_* → OTEL_* mapping in main process
- **Performance Tracking**: SLO monitoring and performance metrics

### 🧰 **Developer Experience**
- **Documentation**: Added comprehensive `docs/` directory
- **Development Tools**: VSCode LGTM tasks and Docker-based local telemetry stack
- **Infrastructure**: Cleaned submodules and internal DNS mapping
- **Configuration**: Updated `.gitignore` for `.claude/` directory
- **Bundle Optimization**: Trimmed bundle size and hardened preload security
- **Dependency Cleanup**: Removed unused dependencies

## 📊 Issues Resolved

- [#25](https://github.com/BP602/KickTalk/issues/25) - Streamlink integration for external media players
- [#14](https://github.com/BP602/KickTalk/issues/14) - @mention detection accuracy and performance improvements  
- [#52](https://github.com/KickTalkOrg/KickTalk/issues/52) - Keep chatroom tabs in sync with live status

## 🔄 Migration Notes

- **Streamlink**: New Streamlink integration is optional and disabled by default
- **System Tray**: System tray functionality is automatically available on supported platforms
- **Telemetry**: Enhanced telemetry maintains existing user preferences

---
**Full Changelog**: [v1.1.8...v1.1.9](https://github.com/BP602/KickTalk/compare/v1.1.8...v1.1.9)
