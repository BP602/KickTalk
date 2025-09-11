# KickTalk v1.1.6 Release Notes

## 🚀 New Features

### 🔄 **Live 7TV Emote Updates** (Fixes [#41](https://github.com/KickTalkOrg/KickTalk/issues/41))
- **Real-time Updates**: New emotes added to channels now appear instantly without requiring an application restart
- **Smart Cache Management**: Targeted cache invalidation ensures the UI always reflects the latest emote changes
- **Enhanced User Experience**: Streamers can add/remove emotes and viewers see them immediately

### 🛠️ **Automatic Data Migration**
- **Smart Detection**: Automatic detection and repair of corrupted chatroom data
- **Data Cleanup**: Intelligent cleanup of invalid or corrupted storage entries
- **Stability Improvements**: Enhanced application stability through better data validation

## 🐛 Bug Fixes & Improvements

### 🔧 **Enhanced 7TV WebSocket Stability**
- **Connection Validation**: Improved connection handling with validation for channel IDs and emote set IDs
- **Smart Reconnection Logic**: Prevents infinite reconnection loops when encountering invalid 7TV data
- **Better Connection Management**: More reliable derivation of 7TV IDs from channel emote sets
- **Cleaner Logging**: Reduced logging noise for cleaner console output

## 🔧 Technical Improvements

### 🏗️ **CI/CD & Development**
- **GitHub Actions**: Optimized workflows with smart artifact retention and fixed build publishing
- **Dependency Updates**: Updated @lexical/text for better compatibility
- **Development Tools**: Added comprehensive debugging helpers and test scenarios

## 📊 Issues Resolved

- [#41](https://github.com/KickTalkOrg/KickTalk/issues/41) - Live 7TV emotes update not working

## ⚠️ Breaking Changes

- **Storage Migration**: Local chatrooms storage is automatically migrated to version 2. Some corrupted chatrooms may be removed during the migration process for improved stability.

## 🔄 Migration Notes

- **Storage**: Existing users will automatically have their chatroom storage migrated to version 2
- **Data Cleanup**: Some corrupted chatrooms may be automatically removed during migration
- **7TV Emotes**: Users may see improved emote loading performance after upgrade

---
**Full Changelog**: [v1.1.5...v1.1.6](https://github.com/BP602/KickTalk/compare/v1.1.5...v1.1.6)

