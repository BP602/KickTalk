# Kick Talk

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/BP602/KickTalk)

An Application for Kick to enhance your experience as a chatter.

Designed & Developed by Dark
Developed by ftk789

## UI scale

With the main app window focused, use `Ctrl+-` to reduce text and spacing, `Ctrl++` to enlarge them, and `Ctrl+0` to reset to 100%. Use `Cmd` instead of `Ctrl` on macOS.

The selected zoom is saved and restored after startup and page reloads.

## Restart baseline

`restart/baseline` is a candidate development line assembled separately from the preserved original checkouts. The checkout-role map is in `docs/Restart-board.excalidraw`; selected work and verification evidence live in the project linked from [AGENTS.md](AGENTS.md#project-planning-and-maintenance).

The dependency baseline now locks the previously working Axios 1.12.2 and Vite 6.3.6 versions rather than downgrading to the stale lock entries. Axios requires form-data >=4.0.4, so its transitive dependency is reconciled to the already installed 4.0.4; other dependency versions are retained. The unused `use-sync-external-store` optional peer is removed: the app uses Zustand's standard React entry point, not `zustand/traditional`.

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

Clean installation does not establish daily-use reliability or resolve all security advisories. Complete the normal-use validation card before promoting this candidate.

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
