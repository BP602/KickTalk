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

### Compatible runtime security upgrades

The `fix/runtime-security-upgrades` batch updates Axios `1.12.2` → `1.20.0`, ws `8.18.3` → `8.22.0`, Lodash `4.17.21` → `4.18.1`, and react-router-dom/resolved react-router `7.5.2` → `7.18.4`. Targets were checked against live npm metadata and upstream releases on 2026-10-12; existing major lines and manifest range conventions are retained. No application API migration was required.

- [Axios 1.20.0](https://github.com/axios/axios/releases/tag/v1.20.0) includes proxy/redirect and prototype-pollution hardening. Required transitives include form-data `4.0.6`, follow-redirects `1.16.1`, proxy-from-env `2.1.0`, and a nested https-proxy-agent `5.0.1`.
- [ws 8.22.0](https://github.com/websockets/ws/releases/tag/8.22.0) includes the earlier memory-disclosure and fragment/chunk exhaustion fixes. Its actual consumer is the Node event collector; renderer chat uses native browser WebSocket.
- [Lodash 4.18.1](https://github.com/lodash/lodash/releases/tag/4.18.1) retains the 4.18.0 unset/omit and template security fixes. The app uses debounce/isEqual; those consumers required no migration.
- [React Router 7.18.4](https://github.com/remix-run/react-router/blob/react-router%407.18.4/CHANGELOG.md) includes navigation/SSR security fixes and remains compatible with React `18.3.1`. There are no application router imports or router-backed views; actual navigation uses chat state and separate Electron dialog windows. No direct react-router dependency was added.

Verification: clean `npm ci` left the lockfile unchanged; all 817 installed package entries matched it, and `npm ls --all` reported no invalid/extraneous dependencies. Production build passed; lint reported 0 errors and 326 existing warnings. Temporary fixtures exercised all exported Kick/7TV Axios consumers over real loopback HTTP (including local-only send/reply/moderation and error/rate-limit branches), the actual event collector over real loopback ws, and actual React debounce/emote-cache hooks. Fixtures did not access real credentials or send requests to live services.

The production Electron Linux smoke used an isolated guest profile: public channel lookup, Kick/7TV emote loading and picker rendering, fresh inbound Kick message IDs matched to rendered messages, and transitions through all Settings sections. Main/Settings renderer console errors and JavaScript exceptions were absent. The previously recorded Wayland/Vulkan diagnostic and guest-session authorization warnings remain; no graphics workaround or warning suppression was added. Nothing was sent, retried or moderated in live chat. Authentication, Windows/macOS packaging and updates were not tested. The maintainer accepted the recorded read-only smoke with "proceed" on 2026-10-12; this is approval of the evidence, not a new manual platform/authentication check.

`npm audit` package findings fell from 74 to 66: 2 low, 27 moderate, 35 high and 2 critical remain. Axios, ws, Lodash, react-router/dom, form-data and follow-redirects no longer appear in the report; the removed external turbo-stream dependency also disappears. Remaining OpenTelemetry/runtime-transitive, build-tooling and packaging advisories are outside this batch, not resolved or proof of an application exploit. Full evidence is on the [runtime-security upgrade card](https://github.com/users/BP602/projects/1?pane=issue&itemId=268391142); this is not release readiness.

### Build toolchain upgrade

The `build/toolchain-upgrade` batch uses [electron-vite 5.0.0](https://registry.npmjs.org/electron-vite/5.0.0), [Vite 6.4.4](https://registry.npmjs.org/vite/6.4.4) and [plugin-react 4.7.0](https://registry.npmjs.org/@vitejs/plugin-react/4.7.0), checked on 2026-10-12. Vite stays on major 6 and the React plugin on major 4; their published peer ranges are compatible. Electron, React, packaging/updater and OpenTelemetry versions are unchanged. Existing caret declarations and the lockfile-respecting installation workflow remain.

Following the [electron-vite 5 migration guide](https://electron-vite.org/guide/migration), main/preload externalization now uses `build.externalizeDeps.exclude`, not the deprecated plugin. Both targets retain the same five exclusions. Renderer aliases, assets, seven HTML entries, sourcemaps and the telemetry-copy plugin are unchanged. The package scripts are unchanged; Electron arguments must follow the extra `--` separator shown in the Wayland commands above.

Verification: clean `npm ci` left the lockfile unchanged, all 819 installed package entries matched it, and `npm ls --all` found no invalid/extraneous dependencies. Production main/preload/renderer builds passed; lint reported 0 errors and 326 existing warnings. The documented `dev` command demonstrated renderer HMR without a document reload. `dev-hr` rebuilt and restarted the main process on a reversible source change; both probes were restored before the production build.

An isolated Linux production-profile smoke exercised typing, picker insertion of a synthetic inline emote, HTML5 tab-drop handlers and persisted reordered fixture tabs, the real app-info IPC response, and Settings opening. Existing local SVG assets and fonts loaded; native Electron capture supplied visual evidence. Kick HTTP was intercepted at the real preload Axios adapter and sockets at the renderer transport boundary; no live sends or moderation occurred. External CDN images were intentionally blocked, leaving the fixture emote image unloaded; the inserted node retained the correct ID/name. One donor-fetch error came from the deliberate external-network block, not a toolchain regression. Renderer JavaScript exceptions were absent. Browser screenshot/native-pointer drag interception timed out; native capture and event-driven drop checks succeeded, so native drag feel is not claimed.

Temporary production fixture builds through the actual config verified main/preload/renderer prefixes, shared `VITE_*` values, exclusion of bare keys and cross-context values, and no synthetic private main/preload value in renderer artifacts. No existing worker imports or registrations were found, so worker migration is not applicable. Fixtures were removed. Audit package findings fell from 66 to 63: Vite, Babel core and browserslist entries cleared; 1 low, 27 moderate, 33 high and 2 critical remain, including other build transitives. Existing Wayland/Vulkan and build/install diagnostics remain unsuppressed. Authentication, Windows/macOS packaging and updates were not tested. Full evidence is recorded on the build-toolchain card in the private project; this is not release readiness.

### Development

```bash
$ npm run dev or npm run dev-hr (hot reload)
```

### Telemetry diagnostics

Enable telemetry in app Settings. Grafana Cloud remains the default destination from private `.env` settings; the main process holds exporter and Tempo query credentials. Renderer spans travel through the preload IPC bridge. Standard runtime `OTEL_*` endpoint/header overrides take precedence over compiled `MAIN_VITE_*` defaults.

Build current sources before checking the usual production profile:

```bash
npm run build
npm run start -- --skipBuild -- --ozone-platform=wayland --remote-debugging-port=9222 --inspect=9230
# In another terminal, while the app is open:
node scripts/otel-smoke.mjs --main
```

The smoke command creates a parent and a 250 ms child through each process's actual SDK, then reads both traces from Tempo. It checks duration, parent linkage, client span kind, error status, timed/exception events, instrumentation scope and app version. Its controlled error spans are intentional. Cloud readback needs the private `MAIN_VITE_GRAFANA_TEMPO_QUERY_URL`, `_USER` and `_TOKEN` values described in `.env.example`. Without `--main`, only the renderer is checked. Close the app after diagnosis; debug ports permit code execution and should not be left open during normal use.

For local diagnosis, the optional LGTM container receives traces and metrics without forwarding them to Cloud. Production still exports directly to Cloud; a collector is not required there.

```bash
# Tested grafana/otel-lgtm v0.36.0 image, pinned by digest:
podman run -d --name kicktalk-lgtm \
  -p 127.0.0.1:3000:3000 -p 127.0.0.1:4317:4317 -p 127.0.0.1:4318:4318 \
  -v kicktalk-lgtm-data:/data \
  docker.io/grafana/otel-lgtm@sha256:57c04cbd8e7022f32bb84c4ac005d79baf8b08e2c5be44facf11f5f1f9944ba2
# If the container already exists, use: podman start kicktalk-lgtm
```

After `podman logs kicktalk-lgtm` reports readiness, launch the same production profile with process-local overrides. Do not replace the Cloud credentials in `.env`:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318 \
OTEL_EXPORTER_OTLP_HEADERS= OTEL_METRICS_EXPORTER=otlp \
OTEL_METRIC_EXPORT_INTERVAL=10000 OTEL_METRIC_EXPORT_TIMEOUT=5000 \
npm run start -- --skipBuild -- --ozone-platform=wayland --remote-debugging-port=9222 --inspect=9230
# In another terminal:
node scripts/otel-smoke.mjs --local --main
podman exec kicktalk-lgtm curl -fsS 'http://127.0.0.1:9090/api/v1/query?query=kicktalk_up_ratio'
```

Open <http://127.0.0.1:3000>, select Explore → Tempo and paste a printed trace ID, or use TraceQL `{ resource.service.namespace = "kicktalk" }`. The Prometheus datasource receives OTLP metrics; unit `1` gauges such as `kicktalk_up` become `kicktalk_up_ratio`. Keep all ports loopback-only: this development stack permits anonymous access. `podman stop kicktalk-lgtm` stops it without deleting the data volume.

Verification on 2026-10-13: Cloud main/renderer roundtrips preserved 251.3/250.3 ms child durations and events; local main/renderer roundtrips preserved 250.6/250.2 ms. Both carried version `2.0.2`, correct error/kind/parent/scope metadata, and one parent/child pair. Local Grafana rendered the trace waterfall and Prometheus returned `kicktalk_up_ratio=1`. Build passed; lint had 0 errors and 323 warnings.

This fixes the earlier pre-end renderer export that collapsed durations to 1 ms and dropped events. It does not repair Kick's dead Pusher transport, change WebSocket metric semantics, add log export, or upgrade OpenTelemetry packages. Cloud metrics remain disabled by the current private config; local OTLP metrics were exercised. Authentication, sending and cross-platform packaging were not tested.

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```
