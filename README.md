# Kick Talk

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/BP602/KickTalk)

An Application for Kick to enhance your experience as a chatter.

Designed & Developed by Dark
Developed by ftk789

## UI scale

With the main app window focused, use `Ctrl+-` to reduce text and spacing, `Ctrl++` to enlarge them, and `Ctrl+0` to reset to 100%. Use `Cmd` instead of `Ctrl` on macOS.

The selected zoom is saved and restored after startup and page reloads.

## Restart baseline

`~/Code/KickTalk` on local `main` is the canonical daily checkout. The approved application revision is `2681e28`; the signed `restart-checkpoint-2026-10-11` tag identifies the promoted checkpoint, including the operating guide and checkout map. Promotion is local; it does not publish a release or push `main`.

`~/Code/KickTalk-restart` is a retained integration worktree on `restart/baseline`, not a second daily checkout. The other checkouts remain historical recovery sources. Folder roles are in `docs/Restart-board.excalidraw`; selected work and verification evidence live in the project linked from [AGENTS.md](AGENTS.md#project-planning-and-maintenance).

The scoped Linux validation covered startup, saved zoom across restart, saved channels, channel switching, fresh Kick messages, badges/emotes, the 7TV picker, and simulated socket reconnect with live rendering afterward. The user reported "works well" after the normal-send/reply prompt. OS suspend/resume, outage message replay and Windows/macOS packaging were not tested. The earlier isolated failed send, a broken channel thumbnail, repeated connection notices and telemetry diagnostics remain unresolved. Unsupported Electron and audit advisories must be addressed before a release.

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

Use `npm ci` for contributor setup and CI. It installs `package-lock.json` without rewriting it and runs the Electron install/rebuild scripts; do not use `--ignore-scripts`, `--legacy-peer-deps`, or `--force` for the normal install. Commit manifest and lockfile changes together when deliberately updating dependencies.

The current toolchain requires Node.js >=22.12.0 (or >=20.19.0 on the Node 20 line). The Linux reproducibility check uses Node 24.21.0 and npm 11.19.0. The old `.npmrc` contained only pnpm hoisting settings; these were removed because npm does not support them.

Verified on Linux from a fresh local clone with `npm ci`: lockfile unchanged, all 831 installed package versions matching the lock, and no invalid/extraneous dependencies or peer-conflict warnings. The production build and Electron main window/Settings smoke passed with an isolated profile. Lint completed with 0 errors and 326 existing warnings. Audit counts and unsuppressed install warnings are recorded on the dependency reproducibility project card; Windows/macOS packaging and live chat were not exercised.

Use the locked tree for subsequent upgrades. Clean installation and the scoped normal-use validation do not resolve security advisories or establish release readiness.

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
