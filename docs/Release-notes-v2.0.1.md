# KickTalk v2.0.1 Release Notes

## 🐛 Bug Fixes

### Critical Production Fix
- **Fixed empty Kick emotes panel in production builds** - Resolves issue where the Kick emotes panel would appear empty when opened in production builds, while 7TV emotes continued to work normally
- Added automatic emote loading when missing for active chatrooms to ensure proper functionality across all build environments

## 📝 Technical Details

This patch release addresses a timing issue in production builds where Kick emote data wasn't being loaded when the emote panel was first opened. The fix maintains all existing functionality including subscriber emotes from multiple channels.

---

**Full Changelog**: https://github.com/BP602/KickTalk/compare/v2.0.0...v2.0.1