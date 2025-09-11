# KickTalk v1.1.5 Release Notes

## 🚀 New Features

### ⚡ **Performance Optimization**
- **Connection Pooling**: Implemented shared WebSocket connections reducing connections from 42 to 2 (95.2% reduction)
- **~75% faster startup time** with multiple chatrooms through ConnectionManager with staggered batch initialization
- **Emote caching system** to prevent duplicate API calls
- **Optimized ChatroomTab** with useShallow and useMemo to prevent infinite loops

### 💬 **Enhanced Chat Experience**
- **Optimistic Messaging**: Messages appear instantly with visual feedback while waiting for server confirmation
  - Pre-cached user info for instant message display
  - Smart user color preservation from existing messages
  - Click-to-retry functionality for failed messages
  - 30-second timeout handling for orphaned messages
- **Reply Support**: Added optimistic messaging support for reply messages
- **Improved Message Reliability**: Enhanced error recovery with proper state management

### 🎨 **UI/UX Improvements**
- **Compact Chatroom List**: New compact mode with icon-only tabs (40px width)
- **Better Visual Feedback**: 
  - Replaced opacity dimming with subtle border and background indicators
  - Added pulsing animation for pending messages
  - Theme-compatible styling using CSS variables
- **Increased Chatroom Limit**: From 5 to 25 chatrooms (later optimized to 20)
- **Duplicate Chatroom Warning**: Clear error messages with auto-dismiss after 3 seconds

### 📊 **Comprehensive Telemetry & Monitoring**
- **OpenTelemetry Integration**: Full observability with distributed tracing
- **Grafana Dashboard**: 
  - 6 new monitoring panels: GC Performance, DOM Node Count, Error Rates, Memory Efficiency, Handle Efficiency, Message Success Rate
  - CPU, memory, API latency, connection health, and message throughput tracking
- **User-Configurable Telemetry**: Optional setting in General tab
- **Prometheus Integration**: Direct metrics export with scrape endpoint
- **Testing Infrastructure**: WebSocket connection testing scripts for resilience validation

### ⚙️ **Settings & Configuration**
- **Auto-Update Controls**: Configurable auto-update with immediate notification dismissal
- **Enhanced General Settings**: Multiple new user preferences and controls
- **Better Error Handling**: Robust fallbacks preventing application crashes

## 🐛 Bug Fixes & Improvements

- **Cross-Platform Icon Compatibility**: Fixed Linux/macOS crashes due to unsupported .ico format
- **Missing Dependencies**: Added @lexical/text and lodash dependencies
- **Connection Cleanup**: Fixed removeChatroom with proper shared connection handling
- **Message Filtering**: Fixed type coercion issue with number vs string IDs
- **TitleBar Authentication**: Fixed auth state synchronization
- **Merge Conflict Resolution**: Clean integration of multiple feature branches

## 🔧 Technical Improvements

### 🏗️ **Build & CI/CD Enhancements**
- **Cross-Platform GitHub Actions**: Comprehensive workflows for Windows, macOS, and Linux
- **Matrix Strategy**: Testing with both npm and pnpm across multiple Node.js versions
- **Enhanced Build Artifacts**: 
  - Windows: NSIS installer (.exe)
  - macOS: DMG files for Intel and Apple Silicon
  - Linux: AppImage, Deb, and Snap packages
- **Automated Releases**: GitHub release workflow with artifact uploads
- **Version Validation**: Ensures git tag matches package.json version

### 🔒 **Dependencies & Security**
- **Updated Dependencies**: All packages updated to latest stable versions
- **OpenTelemetry Stack**: Comprehensive monitoring dependencies added
- **Build Tools**: Updated electron-builder configuration and GitHub Actions

### 🛠️ **Development Experience**
- **Testing Scripts**: Added WebSocket connection testing with network simulation
- **Improved Debugging**: Enhanced logging, error tracking, and development tools
- **Better Documentation**: Updated workflows and configuration documentation
- **Podman Support**: Development OTEL stack now supports Podman alongside Docker

## 🔄 Migration Notes

- **Telemetry**: New optional telemetry is disabled by default - users can enable in General settings
- **UI Changes**: Compact chatroom list is optional and can be toggled in settings
- **Performance**: Connection pooling is automatic and transparent to users
- **Settings**: New auto-update controls provide better user control

---
**Full Changelog**: [v1.1.4...v1.1.5](https://github.com/BP602/KickTalk/compare/v1.1.4...v1.1.5)