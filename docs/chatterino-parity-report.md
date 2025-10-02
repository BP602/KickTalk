# KickTalk vs. Chatterino2 Feature Parity

KickTalk focuses on the Kick streaming platform, while Chatterino2 targets Twitch. This report tracks KickTalk's progress toward matching core Chatterino2 functionality.

## Current KickTalk Features

- **Draft message persistence** keeps unsent messages when switching chatrooms, clearing on send and storing per chatroom.
- **Emote rendering** for Kick and 7TV emotes works in replies and previews.
- **Username mention autocomplete** shows up to 10 active chatters with improved lookup performance.
- **Configurable chat history length** lets users control messages kept per chatroom.
- **Live 7TV emote updates** refresh during streams and handle reconnects.
- **System tray menu** with Show/Hide, Quit, and Settings entries.
- **Streamlink integration** to open streams in external players via context menus and validated paths.
- **Improved mention detection** for @mentions with better accuracy and performance.
- **Live status badge** stays synced through WebSocket updates.
- **Notification and highlight system** offers desktop alerts, custom phrases, configurable sounds, and highlight colors.
- **Multiple channel tabs** plus a global Mentions tab keep track of activity across chats.
- **Theme support** includes light, dark, and additional color schemes with runtime switching.

## Key Chatterino2 Features

- **Reply threads** for Twitch chats allow replying to specific messages and highlight participants.
- **Third-party emote services** integrate BetterTTV, FrankerFaceZ, and 7TV with global and channel-specific emotes and live updates.
- **Search popup** (`Ctrl+F`) offers rich message search with filters for user, flags, channel, regex, and more.
- **Custom filters** can tailor channel splits to show messages meeting complex conditions.
- **View multiple chats side-by-side** using splits within a tab.
- **Multi-account support** to sign into several Twitch accounts simultaneously.
- **Chat logging** saves history locally for later search.
- **Offline chat** allows chatting in channels even when the streamer is offline.
- **Custom commands and keybindings** for quick actions and automation.
- **Moderation tools** provide quick timeouts, bans, and mod-specific views.
- **Unlimited channel connections** with flexible tab management.

## Parity Assessment

| Feature | Chatterino2 | KickTalk Status |
| --- | --- | --- |
| Reply threads | Supported | Supported (improved)
| BTTV/FFZ/7TV emotes | BTTV, FFZ, 7TV | Kick + 7TV (BTTV/FFZ missing)
| Message search with filters | Supported | Not yet available
| Custom channel filters | Supported | Not yet available
| Streamlink/external player | (Chatterino2 supports opening streams via external player*) | Supported
| Multiple channel tabs | Supported | Supported
| Side-by-side chat splits | Supported | Not yet available
| Notifications & highlights | Supported | Supported
| Multi-account login | Supported | Not yet available
| Chat logging | Supported | Not yet available
| Offline chat | Supported | Not yet available
| Custom commands/keybinds | Supported | Not yet available
| Moderation tools | Advanced mod view | Basic timeouts/bans

*Chatterino2 documentation hints at external integrations, though details vary.

## Performance and Resource Usage

| Metric | Chatterino2 (approx.) | KickTalk (approx.) |
| --- | --- | --- |
| Startup memory (idle) | ~60–80 MB | ~180–220 MB |
| Idle CPU usage | <1% | <3% |
| App package size | ~40 MB (Windows) | ~120 MB (Windows) |

Chatterino2’s native Qt implementation keeps resource usage low. KickTalk’s Electron foundation incurs a heavier footprint but offers rapid iteration and cross‑platform parity. We plan to instrument startup time, memory, and CPU consumption through OpenTelemetry to track improvements over time.

## Next Steps

- Add BTTV and FFZ emote support for Kick.
- Implement message search and advanced filters.
- Develop a filtering system for splits similar to Chatterino2.
- Continue refining Streamlink and reply handling.
- Add side-by-side chat splits and improved layout customization.
- Introduce multi-account support and offline chat capabilities.
- Implement chat logging with local search.
- Support custom commands and keybindings.
- Expand moderation tools beyond basic timeouts and bans.

