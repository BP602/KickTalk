# KickTalk v1.1.8 Release Notes

## 🚀 New Features

### 💾 **Draft Message Persistence** (Fixes [#23](https://github.com/KickTalkOrg/KickTalk/issues/23))
- Messages are automatically saved when switching chatrooms and restored when you return
- Auto-saves as you type using Lexical update listeners  
- Automatically clears drafts when messages are sent successfully
- Per-chatroom draft storage using Map in ChatProvider state

### 👥 **Username Mentions Autocomplete** (Fixes [#40](https://github.com/KickTalkOrg/KickTalk/issues/40))
- @ mentions now correctly show up to 10 active chatters in dropdown
- Fixed chatter lookup performance in input component
- Optimized Zustand store selector for better performance
- Improved chatter data access from `state.chatters[chatroomId]`

### 📚 **Configurable Chat History Length** (Fixes [#50](https://github.com/KickTalkOrg/KickTalk/issues/50))
- Added user setting to customize how many messages to retain per chatroom
- Available in General settings tab
- Default value with user override capability
- Better memory management for long chat sessions

## 🐛 Bug Fixes & Improvements

### 🖼️ **Emote Rendering Improvements** (Fixes [#38](https://github.com/KickTalkOrg/KickTalk/issues/38))
- **Reply messages** now display emotes as images instead of plain text
- **Reply input preview** shows emotes as images while typing in the reply input box
- Supports both Kick and 7TV emotes in reply contexts
- Enhanced MessageParser integration for consistent emote rendering

### 🔄 **Live 7TV Emotes Update** (Fixes [#41](https://github.com/KickTalkOrg/KickTalk/issues/41))
- Fixed live 7TV emote updates during streams
- Corrected user ID extraction from channel emote sets
- Improved cache invalidation and refresh triggers
- Enhanced WebSocket connection stability and reconnection handling

### 🛡️ **7TV Avatar Null Guard** (Fixes [#46](https://github.com/KickTalkOrg/KickTalk/issues/46))
- Fixed crashes when channel avatars are missing
- Added safety checks in EmoteDialogs component  
- Prevents `includes` method calls on undefined channel avatars
- Resolves crashes in IcePoseidon chat and other channels with missing avatar data

### 🖥️ **Cross-Platform Icon Compatibility**
- Improved icon handling across different operating systems
- Enhanced Linux/macOS compatibility
- Better resource management for platform-specific assets

- Fixed chatter lookup performance in input component
- Resolved emote rendering issues in reply contexts  
- Improved error handling for missing 7TV data
- Enhanced stability across platforms
- Better development tooling and debugging capabilities

## 🔧 Technical Improvements

### 📦 **Import Path Optimization**
- Migrated to clean `@utils` and `@assets` aliases 
- Better bundle size and maintainability
- Reduced relative path complexity across components
- Enhanced development experience with cleaner imports

### 🔧 **ESLint Configuration Modernization**
- Updated to new flat config format
- Enhanced linting rules for better code quality
- Improved error catching and code consistency
- Better development tooling integration

## 📊 Issues Resolved

- [#23](https://github.com/KickTalkOrg/KickTalk/issues/23) - Draft messages not persisted when switching chatrooms
- [#38](https://github.com/KickTalkOrg/KickTalk/issues/38) - Emotes render as text in reply message previews  
- [#40](https://github.com/KickTalkOrg/KickTalk/issues/40) - No username suggestions in @ mentions
- [#41](https://github.com/KickTalkOrg/KickTalk/issues/41) - Live 7TV emotes update not working
- [#46](https://github.com/KickTalkOrg/KickTalk/issues/46) - 7TV icon crashes in certain chats
- [#50](https://github.com/KickTalkOrg/KickTalk/issues/50) - Need ability to store more chat messages in memory

## 🔄 Migration Notes

- **7TV Emotes**: Users with corrupted emote cache from previous versions may need to clear localStorage or re-add chatrooms to see full benefits of live emote updates
- **Chat History**: New configurable setting will use default values, existing users can adjust in General settings
- **Draft Messages**: Draft persistence is automatic and requires no user action

---
**Full Changelog**: [v1.1.7...v1.1.8](https://github.com/BP602/KickTalk/compare/v1.1.7...v1.1.8)