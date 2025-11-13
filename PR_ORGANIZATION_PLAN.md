# KickTalk Fork - PR Organization Plan

## Overview
- **Total commits ahead:** 105
- **Date range:** 2025-08-28 to 2025-10-03
- **Upstream:** https://github.com/KickTalkOrg/KickTalk

## Recommended PR Groups

### PR #1: Telemetry Infrastructure Foundation
**Priority:** High (foundational for other features)
**Estimated commits:** ~20

Core telemetry setup and configuration:
- `a98871f` feat(telemetry): implement comprehensive error monitoring and user analytics (Phase 3 & 4)
- `6923392` Add telemetry configuration and testing infrastructure
- `222f8dd` fix(telemetry): replace auto-instrumentations with manual HTTP instrumentation and fix env config
- `fa86074` fix(telemetry): expose preload readiness bridge and sync settings; delay renderer telemetry init until preload ready
- `091f7e3` delay telemetry until preload ready
- `3d34103` feat(telemetry): add masked health IPC and preload bridge
- `b5cdfd7` fix(telemetry): avoid invalid 'typeof import' usage; safely prefer import.meta.env with try/catch fallback to process.env
- `89be798` chore(telemetry): dramatically reduce message.parser_consolidated volume
- `23e2abf` fix(telemetry): properly embed OTEL environment variables in packaged builds
- `9b8511c` feat: add telemetry for live status polling
- `4b10f97` feat(telemetry): add consolidated VITE flags and OTEL debug logs
- `0a15261` fix(telemetry): prevent test code from polluting production telemetry
- `fd65c2a` feat(telemetry): trace 7TV events broadcast without chatroomId
- `b4e73d9` fix(telemetry): correct chatrooms scope in 7TV event handler

**Impact:** Adds OpenTelemetry monitoring, error tracking, and analytics foundation

---

### PR #2: 7TV Performance Optimizations
**Priority:** High (performance improvement)
**Estimated commits:** ~10

Major SevenTV performance improvements:
- `93f2790` perf(cosmetics): optimize 7TV cosmetics lookups with O(1) hashmaps
- `b9f249a` perf(7tv): migrate to shared WebSocket connections and fix entitlement handling
- `8b21c0f` fix(7tv): use correct user ID for cosmetic subscriptions
- `94e7852` fix(cosmetics): guard against missing usernames in removeUserStyle
- `6611478` fix: restore 7tv paint gradients
- `91d091d` fix(cosmetics): prevent dedupe collisions for aggregated payloads
- `421055f` fix: stop cosmetic dedupe feedback loop

**Impact:** Significant performance improvements for 7TV cosmetics (badges, paints) with O(1) lookups and shared WebSocket connections

---

### PR #3: Emotes System Enhancements
**Priority:** Medium-High
**Estimated commits:** ~8

Emote loading, visibility, and performance:
- `f04b485` feat(emotes): add progressive loading with placeholders
- `6d13711` fix(emotes): auto-load missing Kick emotes in production builds
- `6ea09c4` refactor: extract useAllStvEmotes hook for shared SevenTV emote logic
- `5152db6` Fix: populate 7tv emotes for all chatrooms, show kick subscriber emotes in all chatrooms
- `601c700` fix: hide follower kick emotes in other chats
- `2c863ca` fix: stabilize personal emote dedupe key
- `5dc45a9` fix(chat): prevent duplicate subscription events with unified deduplication

**Impact:** Better emote loading UX with placeholders, fixes for emote visibility across chatrooms, deduplication improvements

---

### PR #4: Streamlink Integration
**Priority:** Medium (complete feature)
**Estimated commits:** ~6

Full Streamlink support for external player integration:
- `984bf67` feat: add Streamlink integration with comprehensive settings UI (#26)
- `7916e57` feat: add Streamlink integration with comprehensive settings UI
- `cdcb272` feat(streamlink): availability gating, path display, and reactive UI
- `e3a55d0` fix(streamlink): implement quality fallback and improve launch reliability
- `f08e44d` feat: enhance streamlink integration with availability checks and install guidance
- `e40d1c0` fix(streamlink): properly verify command existence in PATH
- `496e789` fix(streamlink): hide terminal window on Windows launch

**Impact:** Adds ability to watch streams via Streamlink with quality selection and settings UI

---

### PR #5: Resizable Split Panes
**Priority:** Medium (UI enhancement)
**Estimated commits:** ~9

Major UI improvement with resizable panels:
- `4780990` feat: implement resizable split pane functionality
- `817b3b7` fix: harden split panes and keep navbar controls inline
- `bd53d4c` feat: migrate from @hello-pangea/dnd to @atlaskit/pragmatic-drag-and-drop
- `f6113ce` fix: harden navbar drag flow and event collector reconnects
- `7076878` fix: polish navbar split UX and harden event collector logging
- `285ae84` feat: add contextual close option for split panes
- `a3d9281` feat(navbar): enhance scrolling, add focus styles, and wrap chatrooms
- `3db0624` fix: pin drag packages to resolve npm overrides

**Impact:** Enables split-screen viewing with resizable panels, improved drag-and-drop library

---

### PR #6: Support Events & Kick WebSocket Improvements
**Priority:** Medium-High
**Estimated commits:** ~12

Enhanced support event handling (subs, donations, gifts):
- `1193760` feat: handle support event messages
- `55ba9d0` feat: enhance support events with subscription/donation handling and telemetry
- `280a740` Enhance support event messages with typed icons and styling
- `a3fe477` feat: display stream status events in chat as support messages
- `4a1fba4` feat: add ws dependency and event collection scripts
- `d1d4e0e` Replace custom SVG icons with Phosphor Icons in SupportEventMessage
- `1be41ed` feat(kick-ws): map celebration→subscription, catch-all unknowns, dedupe support
- `7e8c3f5` feat: enhance chat mode detection and add comprehensive support event handling
- `b144750` feat: track new Kick gifts
- `6e6d7ec` feat: improve kick gift formatting
- `1f24e31` feat: rely solely on per-event chat visibility toggles
- `2544c6a` fix(kick-ws): handle StreamerIsLive/StopStreamBroadcast from channel.* and private-livestream.*

**Impact:** Rich display of support events (subscriptions, donations, gifts) in chat with proper event mapping

---

### PR #7: Live Status & Navbar Improvements
**Priority:** Medium
**Estimated commits:** ~3

Live indicator fixes and navbar polish:
- `969ce05` fix(navbar): keep live badge in sync via WS-only + reconnect reconcile
- `694c9eb` fix: refresh live status for chatroom tabs

**Impact:** Reliable live status indicators using WebSocket events

---

### PR #8: Mention Detection Improvements
**Priority:** Medium
**Estimated commits:** ~3

Better @mention handling and notifications:
- `7096972` feat: improve @mention detection accuracy and performance
- `cfde2da` fix: centralize mention regex and handle punctuation in notifications

**Impact:** More accurate mention detection with proper boundary handling, improved performance

---

### PR #9: Build & CI Infrastructure
**Priority:** Low-Medium (infrastructure)
**Estimated commits:** ~15

Electron/Vite upgrades, pnpm config, CI improvements:
- `fe15380` chore: update electron tooling
- `266ab1f` chore: remove pnpm from workflows
- `1642a02` ci: Run workflow on pull requests
- `bb55bb6` chore(pnpm): selective hoisting for Electron; chore(builder): exclude non-app dirs
- `c12c81c` ci(windows): prebuild native deps with pnpm and enable electron-builder debug
- `2b1d8d3` chore: trim bundle and harden preload
- `c4b08f9` build(ci): clean dist before packaging and disable hard links in release builds
- `47a11c9` ci: add dist cleanup and disable hard links in electron-builder
- `d7ca7d7` ci: replace npm exec with npx --no-install for electron-builder commands
- `dfa1772` npx to npm exec
- `b09ad8b` Remove puppeteer-real-browser dependency
- `465b496` ci(release): Populate release body from markdown file

**Impact:** Better build configuration, smaller bundle sizes, improved CI/CD

---

### PR #10: Icon Library Migration
**Priority:** Low (cosmetic improvement)
**Estimated commits:** ~2

Replace custom SVG with Phosphor Icons:
- `7350c69` feat: replace SVG assets with Phosphor React icon library
- `d1d4e0e` Replace custom SVG icons with Phosphor Icons in SupportEventMessage (duplicate with PR #6)

**Impact:** Consistent icon design system, reduced custom SVG maintenance

---

### PR #11: Documentation & Release Infrastructure
**Priority:** Low (documentation)
**Estimated commits:** ~7

Repository documentation improvements:
- `02a2d95` Add documentation directory
- `49d9ff6` docs: add AGENTS.md contributor guide
- `8b84e69` Docs: Refactor and streamline repository guidelines
- `9239f11` docs: standardize release notes with template structure
- `63c7839` Update README.md, add deepwiki badge
- `da844d2` chore: sync CLAUDE.md with AGENTS.md

**Impact:** Better contributor documentation and release process

---

### PR #12: Telemetry UX & Analytics Prompt
**Priority:** Low-Medium (user-facing telemetry feature)
**Estimated commits:** ~2

User consent and analytics prompt:
- `f27527a` fix: throttle analytics prompt to monthly
- `f94b9ff` fix: stabilize telemetry prompt across chat contexts

**Impact:** Respectful telemetry opt-in UX with monthly prompts

---

### PR #13: Minor Fixes & Polish
**Priority:** Low (small fixes)
**Estimated commits:** ~5

Various small bug fixes:
- `94ce458` fix(ui): replace left arrow with right arrow in ReplyMessage component
- `29521fd` chore: add .code to .gitignore

**Impact:** Small UI and configuration fixes

---

### Commits to Skip (Merge commits, version bumps, docs)
These should NOT be in PRs or should be squashed:
- `3a00dae` Merge pull request #51
- `e76d55e` Merge pull request #47
- `91fca72` Merge pull request #45
- `ac2bbae` Merge pull request #46
- `4830af1` Merge pull request #41
- `2b4120e` Merge pull request #40
- `e1dd4c8` Merge pull request #34
- `14f78a6` Merge pull request #35
- `f1dc315` Merge branch 'main' into feature/streamlink-integration
- `99a13c1` Merge pull request #23
- `3faaf06` Merge pull request #21
- `d5f1e02` Merge pull request #20
- `89c90bd` Merge pull request #19
- `8bf6a8e` Merge pull request #17
- `425a9c0` Merge pull request #16
- `1b54c24` Merge pull request #15
- `4d95261` 2.0.2 (version bump)
- `110b05a` 2.0.1 (version bump)
- `ab6f1c7` release: bump version to 2.0.0 and add comprehensive release notes
- `637a894` Bump to 1.1.9
- `3756a97` docs: update v2.0.2 release notes for critical hotfix
- `71fee80` docs: add v2.0.2 release notes for telemetry fix
- `a44a23f` docs: add v2.0.1 release notes for Kick emotes fix

---

## Implementation Strategy

### Phase 1: Create Feature Branches
For each PR group above, create a clean branch from upstream/main:
```bash
git checkout -b pr/telemetry-foundation upstream/main
git cherry-pick <commit-hash> <commit-hash> ...
```

### Phase 2: Clean Up Commits
- Squash related fixup commits together
- Remove merge commits
- Ensure each commit follows Conventional Commits
- Rewrite commit messages if needed for clarity

### Phase 3: Create PRs
Create PRs in priority order:
1. Start with foundational changes (telemetry, build infrastructure)
2. Follow with features (7TV perf, emotes, streamlink, resizable panes)
3. End with polish and documentation

### Phase 4: Address Review Feedback
- Expect upstream maintainers to request changes
- Keep PR scope focused (resist scope creep)
- Be prepared to split large PRs if requested

---

## Notes

- **Total estimated PRs:** 13 (some can be combined)
- **Recommended priority order:** PR #1 → #2 → #3 → #6 → #4 → #5 → #7 → #8 → #9 → #10 → #11 → #12 → #13
- **Timeline:** Plan for several weeks of review cycles
- **Testing:** Each PR should be individually testable
- **Dependencies:** Some PRs depend on others (e.g., telemetry features depend on PR #1)

## Next Steps

1. Review this plan with maintainers (optional: create tracking issue in upstream)
2. Start with PR #1 (Telemetry Foundation) as it's foundational
3. Create clean feature branches using cherry-pick
4. Submit PRs incrementally, don't overwhelm maintainers
