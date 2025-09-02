Mock Kick WebSocket Feed (Pusher‑like)

Overview

- Purpose: Develop and test live/offline tab behavior and chat updates without hitting real Kick/Pusher.
- Scope: Minimal subset of the Pusher protocol that our client actually uses.
- Where: Lightweight Node server under `scripts/mock-pusher.js` using the `ws` package.

Quick Start

- Install (node_modules must be present):
  - If you haven’t installed deps yet, run `npm install` (no network needed if lock is cached).
- Start the mock server (default ws://localhost:8081):
  - `npm run mock:pusher`
- Point the renderer at the mock server
  - Preferred (build‑time): set `RENDERER_VITE_KT_PUSHER_URL=ws://localhost:8081`
    - Example: `RENDERER_VITE_KT_PUSHER_URL=ws://localhost:8081 npm run dev`
  - Optional (runtime): in DevTools console, set `window.__KT_PUSHER_URL = 'ws://localhost:8081'` then trigger a reconnect (e.g., restart a chatroom).

What It Emits

- On connection: `pusher:connection_established` with `{ socket_id, activity_timeout }`.
- On subscribe: `pusher_internal:subscription_succeeded` to acknowledge channel.
- Periodically for subscribed channels:
  - `channel.<userId>`: toggles live on → `App\\Events\\StreamerIsLive`, then off → `App\\Events\\StopStreamBroadcast` (loop).
  - `chatrooms.<id>.v2`: sends a simple `App\\Events\\MessageSentEvent` payload to exercise chat handlers.

Client Override Details

- Renderer env (electron‑vite): `RENDERER_VITE_KT_PUSHER_URL`
  - Only the renderer build reads this. The default production URL remains unchanged.
- Runtime escape hatch: `window.__KT_PUSHER_URL`
  - Useful for manual testing without rebuilding. Set and then force a reconnect.

Limitations

- This is not a full Pusher implementation—just the envelopes we consume today.
- Private channels (e.g., `private-userfeed.<id>`) are ignored by the mock. Focus is on public `channel.<userId>` and `chatrooms.<id>.v2`.
- If you add more Pusher features in the app, extend the mock accordingly.

Testing Notes

- Stable smoke test for Navbar is available:
  - `npm run test:smoke`
  - File: `src/renderer/src/components/Navbar.smoke.test.jsx`
- CI Suggestion:
  - Run smoke tests first, then progressively enable larger suites as they’re stabilized (fake timers, fewer class‑based assertions).

File Map

- `scripts/mock-pusher.js`: the mock server implementation.
- `utils/services/kick/kickPusher.js`: reads the renderer env override and a runtime URL for manual testing.

