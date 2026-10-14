# Kick realtime channel guide

KickTalk uses one main-process Centrifuge client for all Kick rooms. The renderer receives validated room-state and publication events through a purpose-built preload bridge; it never receives connection JWTs, subscription JWTs or raw socket access. 7TV uses its independent renderer connection.

## Discovery and credentials

The verified web API base is `https://web.kick.com/api`.

1. `POST /v1/realtime/connection` with `{client:{id:<UUID>,type:"web"},capabilities:{accepted_providers:[{provider:"centrifugo"}]}}`. Select the returned Centrifugo connection URL rather than hard-coding a region. The observed gateway is `wss://realtime.us-west-2.platform.kick.com/connection/websocket`.
2. `POST /v1/realtime/auth/connection` with `{client_id:<same UUID>}` returns `data.token`. The main process supplies existing account credentials when authenticated; guests receive a guest connection grant.
3. Private channels use the SDK subscription `getToken` callback: `POST /v1/realtime/auth/channel` with `{channel:<full channel name>}` returns `data.token`. HTTP 401/403/404 terminates that private subscription. Tokens and auth headers stay in main.

The private-channel route/body are present in Kick's public client chunk `https://assets.kick.com/main/_next/static/chunks/0vf3mmzsywzg3.js`, modules `648112` and `942463`, inspected on 2026-10-13. These are internal web APIs, not a published stability guarantee. Do not guess replacement routes when they change.

The SDK handles server ping/pong, connection-token renewal and private subscription-token renewal. Token fetches are guarded against stale connection generations and removed subscriptions. No token values or chat contents belong in diagnostics.

## IDs

- Channel/profile ID: `GET https://kick.com/api/v2/channels/<slug>` → `id`.
- Chatroom ID: the same response → `chatroom.id`.
- Livestream session ID: the same response → `livestream.id`, when live.
- Authenticated account ID: resolved by main from the actual saved session, not accepted from renderer/localStorage.

These IDs are different. Room descriptors contain positive safe integers; the main IPC handler validates them and limits the desired room set.

## Channel ownership

| Channel | Scope | Purpose |
| --- | --- | --- |
| `channel_<channelId>`, `channel.<channelId>` | Public | Channel lifecycle, stream/pin/poll updates; `KicksGifted` observed on underscore form |
| `chatrooms.<chatroomId>.v2` | Public | Primary chat readiness; chat, deletion, moderation and subscription events |
| `chatrooms.<chatroomId>` | Public | Chatroom updates and `StreamHostedEvent` |
| `chatroom_<chatroomId>` | Public | Gifted subscriptions and reward-redemption events |
| `private-userfeed.<accountId>` | Authenticated, private JWT | Account notifications and follower-related events |
| `private-channelpoints-<accountId>` | Authenticated, private JWT | Retained account-scoped channel-point subscriptions |
| `private-livestream.<livestreamId>` | Authenticated, private JWT | Retained ephemeral livestream-scoped subscriptions |
| `predictions-channel-<channelId>` | Authenticated client scope | Prediction updates; observed acknowledgment without a private-prefix token |

The official web client still uses the public dot/underscore channel aliases. The main controller shares ownership of common channels across rooms and removes a subscription only after its final owner is removed. It makes no Pusher or `/broadcasting/auth` requests.

## Publications and readiness

A Centrifugo publication's data has the existing Kick envelope:

```json
{"event":"App\\Events\\ChatMessageEvent","data":"<JSON-encoded Kick event payload>"}
```

The subscription supplies its channel. Main maps it to room owners and forwards the event name plus JSON data to existing message/channel handlers. Stable chat-message IDs are deduplicated across aliases. Idless state deduplication suppresses adjacent equal values only; intervening state events remain observable, including pin/unpin/repin, poll deletion/recreation and live/offline/live transitions. Non-adjacent alias duplicates may be forwarded rather than risk dropping a valid transition.

A native socket open is not room readiness. A room becomes connected only after `chatrooms.<roomId>.v2` acknowledges subscription. Healthy connected tabs show no connection badge; pending, disconnected and failed states retain visible indicators, with retry for terminal failure. All states retain an accessible connection description. Private-subscription warnings remain visible even when public chat is connected. Routine connection transitions do not append chat-history notices.

Transient failures use a bounded retry budget with backoff. The budget resets after primary subscription readiness, not socket open. Terminal failures require an explicit retry. Renderer reload hydrates the current main snapshot; login/logout and final-room removal clean up the relevant connection lifecycle.

Transient private-token renewal failures recover by replacing only the affected subscription through the SDK's public APIs. Failed recovery attempts share one bounded episode budget; a fresh subscription acknowledgment resets it. The shared socket and healthy public/private feeds stay connected. Generation and ownership guards discard retired callbacks and tokens. Replacement briefly interrupts that feed, and events during the gap are not guaranteed replayed.

## Verification tools

```bash
npm run test:realtime
npm run smoke:realtime -- --room CHATROOM_ID:CHANNEL_ID --duration 300 --retry-after 90
npm run collect-events -- --room CHATROOM_ID:CHANNEL_ID --duration 300
```

The smoke and collector use the same production controller. The smoke prints state/subscription metadata, event names, IDs and counts. The collector writes schema-redacted JSONL rather than chat content. Neither tool sends chat messages.

For automated verification, prefer local HTTP/WebSocket fixtures. Any live send, deletion or moderation requires explicit authorization for the exact account, room and action. Never infer the target from asynchronously changing composer selection, and never automatically retry a live test message.

## Evidence and limits

On 2026-10-13 the replaced Pusher endpoint rejected the application key with error 4001 in both this fork and current upstream `main`. A 300-second read-only Centrifugo smoke subscribed three rooms across 15 channels, received 651 unique live messages and two deletion events, and recovered after an explicit client retry at 90 seconds. This does not date Kick's migration or prove every private event type arrived.

Connection JWTs alone were observed to fail private userfeed/channelpoints subscription with error 103; they are not substitutes for the private channel JWT flow above. Private event arrival, OS suspend/resume, outage replay, live reply sending and Windows/macOS packages require separate acceptance evidence. Keep unresolved checks on the project card; a build or fixture pass is not release acceptance.
