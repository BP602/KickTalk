# KickTalk v2.0.0 Release Notes

## 🚀 Major New Features

- **🎉 Support Events System**: Complete overhaul of event handling with comprehensive subscription, donation, and gift tracking - bringing the full Kick experience directly into your chat
- **📺 Streamlink Integration**: Professional external player integration with quality selection, path configuration, and availability checking for enhanced viewing
- **🎭 Enhanced SevenTV Support**: Unified emote logic with shared hooks for better performance and consistency across all chatrooms
- **⚙️ Granular Chat Controls**: Per-event visibility toggles allowing users to customize exactly which events they want to see

## 🐛 Bug Fixes & Improvements

- Fixed UI issue with arrow direction in ReplyMessage component
- Prevented duplicate subscription events with unified deduplication
- Improved Kick gift formatting and tracking
- Enhanced chat mode detection for better event handling
- Fixed Streamlink terminal window visibility on Windows
- Improved Streamlink command verification and PATH detection

## 🔧 Technical Improvements

- Added WebSocket dependency and event collection scripts for better data analysis
- Replaced custom SVG assets with Phosphor React icon library for consistency
- Implemented quality fallback system for Streamlink launches
- Enhanced error handling and user feedback systems
- Improved reactive UI updates for settings changes

## 📊 Issues Resolved

### Upstream Repository (KickTalkOrg/KickTalk) - CLOSED ✅
- [#56](https://github.com/KickTalkOrg/KickTalk/issues/56) Kick added KICKs (tips) into the chat
- [#54](https://github.com/KickTalkOrg/KickTalk/issues/54) feat: Add Streamlink integration for external stream playback

### Origin Repository (BP602/KickTalk) - CLOSED ✅
- [#36](https://github.com/BP602/KickTalk/issues/36) Replace SVG assets with Phosphor React icon library
- [#25](https://github.com/BP602/KickTalk/issues/25) feat: Add Streamlink integration for external stream playback
- [#14](https://github.com/BP602/KickTalk/issues/14) @ mention notifications not working - missing username detection logic
- [#12](https://github.com/BP602/KickTalk/issues/12) Reply messages show '@' instead of username during optimistic rendering

### Issues Likely Addressed (Missing Issue References in Commits)
*Commits that should have referenced these issues:*

**Upstream Issues:**
- [#51](https://github.com/KickTalkOrg/KickTalk/issues/51) "Display subscription/gift events" → Support event commits should reference this
- [#53](https://github.com/KickTalkOrg/KickTalk/issues/53) "Emotes for subscribers" → SevenTV commits `6ea09c4`, `5152db6` should reference this
- [#52](https://github.com/KickTalkOrg/KickTalk/issues/52) "Live status bugs" → Live status commits `969ce05`, `694c9eb` should reference this

**Origin Issues:**
- [#32](https://github.com/BP602/KickTalk/issues/32) "StreamerIsLive event support" → Commit `2544c6a` should reference this
- [#31](https://github.com/BP602/KickTalk/issues/31) "StopStreamBroadcast event support" → Commit `2544c6a` should reference this

### 💡 Suggested Commit Message Improvements
For future releases, consider these commit message formats:

```
feat(support-events): handle support event messages (fixes #51)
feat(sevenTV): extract useAllStvEmotes hook for shared logic (fixes #53)
fix(live-status): keep live badge in sync via WS-only + reconnect (fixes #52)
feat(kick-ws): handle StreamerIsLive/StopStreamBroadcast events (fixes #32, #31)
```

## 🔀 Pull Requests Merged

### Major Features
- **[#35](https://github.com/BP602/KickTalk/pull/35)** Feature/streamlink integration (+217/-643 lines)
  - Native notifications with Electron dialogs
  - Streamlink availability checks and install guidance
  - Improved UX with better error handling and messaging

- **[#34](https://github.com/BP602/KickTalk/pull/34)** feat: add support event message toggle (+9552/-255 lines)
  - Style subscription, donation, and reward events with custom backgrounds
  - User-configurable visibility toggles for support events
  - Complete Kick support event handling infrastructure

- **[#26](https://github.com/BP602/KickTalk/pull/26)** feat: add Streamlink integration with comprehensive settings UI (+771/-31 lines)
  - External Players Settings section with quality selection
  - Context menu integration for StreamerInfo and ChatroomTab
  - Cross-platform Streamlink detection and custom player support

### Chat & UI Improvements
- **[#23](https://github.com/BP602/KickTalk/pull/23)** feat: improve @mention detection accuracy and performance (+158/-43 lines)
  - Strict username-specific mention regex with word boundaries
  - Username variation support (hyphens/underscores interchangeable)
  - Regex memoization for performance optimization
  - **Fixes:** [#14](https://github.com/BP602/KickTalk/issues/14)

- **[#21](https://github.com/BP602/KickTalk/pull/21)** fix: keep chatroom tabs in sync with live status (+234/-1 lines)
  - Periodic Kick channel info polling for livestream status
  - Avoids cached responses for real-time accuracy
  - **Fixes:** [KickTalkOrg/KickTalk#52](https://github.com/KickTalkOrg/KickTalk/issues/52)

### Technical Infrastructure
- **[#20](https://github.com/BP602/KickTalk/pull/20)** Delay renderer telemetry until preload initialization (+80/-1 lines)
  - Preload readiness signaling with global flag and events
  - Dynamic telemetry import after preload completion

- **[#19](https://github.com/BP602/KickTalk/pull/19)** chore: update electron tooling (+6143/-18417 lines)
  - Updated electron-related packages to latest versions
  - Removed deprecated electron-builder options

- **[#17](https://github.com/BP602/KickTalk/pull/17)** ci(windows): prebuild native deps + debug logs (+8/-1 lines)
  - Windows packaging reliability improvements with pnpm
  - Native dependency prebuilding and enhanced debugging

- **[#16](https://github.com/BP602/KickTalk/pull/16)** chore(pnpm): selective hoisting for Electron + builder excludes (+18/-1 lines)
  - Selective pnpm hoisting for Electron packages
  - Excluded non-app directories from packaging for smaller artifacts

- **[#15](https://github.com/BP602/KickTalk/pull/15)** chore: trim bundle and harden preload (+29/-99 lines)
  - Removed pnpm store from packaging to reduce bundle size
  - Hardened preload setup with fallback store guarantee

### Upstream PRs
- **[KickTalkOrg/KickTalk#55](https://github.com/KickTalkOrg/KickTalk/pull/55)** feat: add Streamlink integration (CLOSED - merged into origin)

## 📋 Complete Changelog

### 🎉 Support Events & Chat Features
- `1193760` feat: handle support event messages
- `55ba9d0` feat: enhance support events with subscription/donation handling and telemetry
- `280a740` Enhance support event messages with typed icons and styling
- `a3fe477` feat: display stream status events in chat as support messages
- `d1d4e0e` Replace custom SVG icons with Phosphor Icons in SupportEventMessage
- `1be41ed` feat(kick-ws): map celebration→subscription, catch-all unknowns, dedupe support
- `7e8c3f5` feat: enhance chat mode detection and add comprehensive support event handling
- `b144750` feat: track new Kick gifts
- `6e6d7ec` feat: improve kick gift formatting
- `1f24e31` feat: rely solely on per-event chat visibility toggles
- `5dc45a9` fix(chat): prevent duplicate subscription events with unified deduplication

### 📺 Streamlink Integration
- `7916e57` feat: add Streamlink integration with comprehensive settings UI
- `e3a55d0` fix(streamlink): implement quality fallback and improve launch reliability
- `cdcb272` feat(streamlink): availability gating, path display, and reactive UI
- `f08e44d` feat: enhance streamlink integration with availability checks and install guidance
- `e40d1c0` fix(streamlink): properly verify command existence in PATH
- `496e789` fix(streamlink): hide terminal window on Windows launch

### 🎭 SevenTV & Emotes
- `6ea09c4` refactor: extract useAllStvEmotes hook for shared SevenTV emote logic
- `5152db6` Fix: populate 7tv emotes for all chatrooms, show kick subscriber emotes in all chatrooms

### 💬 Chat Improvements
- `7096972` feat: improve @mention detection accuracy and performance
- `cfde2da` fix: centralize mention regex and handle punctuation in notifications
- `94ce458` fix(ui): replace left arrow with right arrow in ReplyMessage component

### 🔴 Live Status & WebSocket
- `2544c6a` fix(kick-ws): handle StreamerIsLive/StopStreamBroadcast from channel.* and private-livestream.*
- `969ce05` fix(navbar): keep live badge in sync via WS-only + reconnect reconcile
- `694c9eb` fix: refresh live status for chatroom tabs
- `9b8511c` feat: add telemetry for live status polling

### 🎨 UI & Icons
- `7350c69` feat: replace SVG assets with Phosphor React icon library

### 📊 Telemetry & Monitoring
- `fa86074` fix(telemetry): expose preload readiness bridge and sync settings
- `89be798` chore(telemetry): dramatically reduce message.parser_consolidated volume
- `b5cdfd7` fix(telemetry): avoid invalid 'typeof import' usage
- `3d34103` feat(telemetry): add masked health IPC and preload bridge
- `222f8dd` fix(telemetry): replace auto-instrumentations with manual HTTP instrumentation

### 🔧 Technical Infrastructure
- `4a1fba4` feat: add ws dependency and event collection scripts
- `fe15380` chore: update electron tooling
- `c12c81c` ci(windows): prebuild native deps with pnpm and enable electron-builder debug
- `bb55bb6` chore(pnpm): selective hoisting for Electron
- `2b1d8d3` chore: trim bundle and harden preload
- `b09ad8b` Remove puppeteer-real-browser dependency

### 📖 Documentation & CI
- `9239f11` docs: standardize release notes with template structure
- `63c7839` Update README.md, add deepwiki badge
- `8b84e69` Docs: Refactor and streamline repository guidelines
- `49d9ff6` docs: add AGENTS.md contributor guide
- `465b496` ci(release): Populate release body from markdown file
- `1642a02` ci: Run workflow on pull requests

---
**Full Changelog**: [v1.1.9...v2.0.0](https://github.com/KickTalkOrg/KickTalk/compare/v1.1.9...v2.0.0)