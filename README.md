# Kick Talk

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/BP602/KickTalk)

An Application for Kick to enhance your experience as a chatter.

Designed & Developed by Dark
Developed by ftk789

## UI scale

With the main app window focused, use `Ctrl+-` to reduce text and spacing, `Ctrl++` to enlarge them, and `Ctrl+0` to reset to 100%. Use `Cmd` instead of `Ctrl` on macOS.

The selected zoom is saved and restored after startup and page reloads.

## Restart baseline

`~/Code/KickTalk` on local `main` is the canonical daily checkout. The original approved application revision is `2681e28`; the signed `restart-checkpoint-2026-10-11` tag identifies the promoted checkpoint, including the operating guide and checkout map. Accepted topic upgrades are merged locally after their recorded checks. This does not publish a release or push `main`.

`~/Code/KickTalk-restart` is a retained integration worktree on `restart/baseline`, not a second daily checkout. The other checkouts remain historical recovery sources. Folder roles are in `docs/Restart-board.excalidraw`; selected work and verification evidence live in the project linked from [AGENTS.md](AGENTS.md#project-planning-and-maintenance).

The scoped Linux validation covered startup, saved zoom across restart, saved channels, channel switching, fresh Kick messages, badges/emotes, the 7TV picker, and simulated socket reconnect with live rendering afterward. The user reported "works well" after the normal-send/reply prompt. OS suspend/resume, outage message replay and Windows/macOS packaging were not tested. The earlier isolated failed send, a broken channel thumbnail, repeated connection notices and telemetry diagnostics remain unresolved. Electron is now on the supported line documented below; audit advisories and packaging/update validation remain release blockers.

### Daily work

Start each selected task from local `main` on a small, short-lived branch:

```bash
cd ~/Code/KickTalk
git switch -c fix/short-topic main
npm ci
npm run dev
```

Use `feat/short-topic` for features. Keep one primary card active, exercise its acceptance criteria, and record evidence on the GitHub Project. Integrate approved work through a normal merge or PR; do not force-push or rewrite preserved history. On this workstation, use the `BP602` identity as documented in [AGENTS.md](AGENTS.md#access).

On GNOME Wayland, pass the tested Electron platform flag through electron-vite:

```bash
npm run dev -- -- --ozone-platform=wayland
# Run an existing production build:
npm run start -- --skipBuild -- --ozone-platform=wayland
```

### Recover preserved work

The original `feat/chat-scroll-performance` branch remains at `c712c1a`. Its five pending tracked-file changes and untracked checkout map were saved without applying or dropping any previous stash:

- Snapshot: `84b80065b1baf478046ad54d48be3964962ee888`.
- Stable local ref: `refs/recovery/restart-pre-promotion-20261011`.
- All 12 previous stashes remain; use object IDs because stash positions change.
- Full original-checkout archives: `~/Backups/KickTalk/20261011T123416Z`.
- Cutover Git/pending-work archive and accepted app-profile archive: `~/Backups/KickTalk/promotion-20261011T185745Z`.

Archives are private, same-disk backups and may contain credentials; do not publish them. Ignored local files and tool state remain in the canonical folder. No historical branch, stash, archive or temporary integration checkout was deleted.

Recover the old pending edits only in a separate worktree when deliberately reviewing them:

```bash
cd ~/Code/KickTalk
git worktree add -b recovery/pending-20261011 ../KickTalk-recovery c712c1a
git -C ../KickTalk-recovery stash apply 84b80065b1baf478046ad54d48be3964962ee888
```

That snapshot includes changes already integrated into the checkpoint; do not apply it wholesale onto daily `main`. To inspect the checkpoint without disturbing daily work, use `git worktree add --detach ../KickTalk-checkpoint restart-checkpoint-2026-10-11`. Require explicit approval before deleting recovery refs, stashes, branches, worktrees or archives.

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm ci
```

Use `npm ci` for contributor setup and CI. It installs `package-lock.json` without rewriting it and runs the project install/rebuild scripts; do not use `--ignore-scripts`, `--legacy-peer-deps`, or `--force` for the normal install. Commit manifest and lockfile changes together when deliberately updating dependencies. The project `postinstall` runs Electron's official `install-electron` command before rebuilding app dependencies. This supplies the executable and `path.txt` required by electron-vite 4 without a manual first invocation. Installation needs network access unless the binary is cached.

Electron 44 tooling requires Node.js >=22.12.0. The Linux checks use Node 24.21.0 and npm 11.19.0. The old `.npmrc` contained only pnpm hoisting settings; these were removed because npm does not support them.

The original Electron 37 baseline was verified from a fresh local clone with `npm ci`: lockfile unchanged, all 831 installed package versions matching the lock, and no invalid/extraneous dependencies or peer-conflict warnings. Its production build and Electron main window/Settings smoke passed with an isolated profile. Lint completed with 0 errors and 326 existing warnings. Audit counts and unsuppressed install warnings are recorded on the dependency reproducibility project card; Windows/macOS packaging and live chat were not exercised by that install check.

Use the locked tree for subsequent upgrades. Clean installation and the scoped normal-use validation do not resolve security advisories or establish release readiness.

### Electron runtime upgrade

Electron is pinned to `44.7.0`, the latest stable checked on 2026-10-11. The [official schedule](https://releases.electronjs.org/schedule) gives Electron 44 an end-of-life date of 2027-03-02; support was rechecked on the local integration day. [44.7.0 release metadata](https://releases.electronjs.org/release/v44.7.0) lists Chromium `152.0.7977.130`, Node `24.21.0` and V8 `15.2.124.28`. The older restart checkpoint retains Electron 37 for comparison and recovery.

Only Electron and its required installer/type dependency graph change. React, Vite, electron-vite, builder and updater remain on their locked versions. No application-code migration was needed for the [documented breaking changes from 38 through 44](https://www.electronjs.org/docs/latest/breaking-changes):

| Major | Compatibility review |
| --- | --- |
| 38 | Native Wayland selection replaces `ELECTRON_OZONE_PLATFORM_HINT`; no source usage. `ORIGINAL_XDG_CURRENT_DESKTOP`, `plugin-crashed`, routing-ID APIs and protocol `session:null` behavior are unused. The app sets workspace visibility but never queries `isVisibleOnAllWorkspaces()`. macOS 11 support ends. |
| 39 | No `--host-rules`, desktop audio capture or offscreen shared-texture rendering. Local app windows deny `window.open` and open external links in the browser; remote login pages can now create resizable popups. No app popup customization needs migration. |
| 40 | Renderer copies use `navigator.clipboard`, not Electron clipboard. No macOS dSYM download workflow. |
| 41 | No PDF WebContents detection, cookie-change cause handlers or Linux `showHiddenFiles`. Authentication still reads cookies with `cookies.get()`. |
| 42 | Electron's package no longer downloads its binary in `postinstall`. The app explicitly runs official `install-electron` before its existing rebuild step: without this, electron-vite 4 reads a missing `path.txt` and fails with `Electron uninstall` after clean `npm ci`. Cookie clearing supplies only `storages`, not removed `quotas`. No offscreen scaling or named-image `hslShift` usage. macOS notifications require signing; macOS behavior remains untested. |
| 43 | Rounded corners are already explicit. Custom titlebar CSS is not Window Controls Overlay. No bitmap conversion, extension CSS injection or removed `showHiddenFiles`. The audio-file chooser has no `defaultPath`, so its initial directory now follows Downloads/home. |
| 44 | No Node-enabled subframe workers, DevTools extensions, client-certificate handler, Electron `net.request`, ANGLE library replacement, Unity API, Electron clipboard or login-item attributes. Renderer Node integration remains disabled. macOS now requires 13+. Windows x86 and Linux ARMv7 binaries are unavailable; configured Windows builds are x64, and macOS builds x64/arm64. |

`src/main/index.js` retains `contextIsolation:true`, `nodeIntegration:false` and the existing unsandboxed preload (`sandbox:false`). Preload dependencies were not refactored. Session cookie reads/clearing need no migration; the app has no protocol handlers, webRequest hooks or permission handlers affected by this review. Internal tab drag/drop uses DOM adapters, not native file paths.

Linux verification uses a fresh guest profile, not the maintainer's login: clean `npm ci`, first binary invocation, production build, main window, Settings IPC, public channel HTTP lookup, a fresh Kick WebSocket message matched to the rendered chat, tab creation/reordering, drag-to-split and physical pane resizing. Saved zoom `0.8` survived reload and process restart; observed device-pixel ratio was `0.800000011920929`. Main and Settings renderers exposed no `require` or `process`; main-process inspection confirmed isolation on and Node integration off. Lint: 0 errors, 326 existing warnings.

The maintainer reported "works" after the native desktop and zoom-shortcut/reset acceptance prompt on 2026-10-11. This is user-reported acceptance, not an automated keyboard result: GNOME denied keyboard focus to the automated Wayland window, and synthetic shortcuts did not change zoom. No new JavaScript exception, deprecation or permission error was observed; seven emote requests were aborted during reload. A guest reload clears saved rooms through the existing missing-token path. Fresh guest messages had red highlight backgrounds on both Electron 37.4.0 and 44.7.0 (`rgb(128, 0, 0)`), so that appearance predates this upgrade. No automated live message was sent, retried or moderated. Windows/macOS packaging, authentication and updates are outside this smoke. Full evidence and acceptance are on the Electron upgrade card in the project linked from [AGENTS.md](AGENTS.md#project-planning-and-maintenance); this is not release clearance.

The Electron 44 GPU process logged a Wayland/Vulkan incompatibility diagnostic while the desktop UI continued to render. No graphics workaround or warning suppression was added. The diagnostic was not present in the short Electron 37 comparison; maintainer acceptance does not establish that the diagnostic is fixed.

### Development

```bash
$ npm run dev or npm run dev-hr (hot reload)
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```
