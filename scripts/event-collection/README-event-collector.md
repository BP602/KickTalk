# Kick event collector

The collector uses the same main-owned Centrifugo controller as KickTalk. It collects event schemas for analysis without saving chat text, user identities, cookies, JWTs or raw request headers. It never sends chat messages.

## Setup

From the project root, use the committed npm dependency tree:

```bash
npm ci
```

Do not install a separate WebSocket package or rewrite the lockfile just to run this tool.

## Collect and analyze

Supply explicit chatroom and channel IDs, obtained from `GET https://kick.com/api/v2/channels/<slug>` (`chatroom.id` and `id` respectively):

```bash
npm run collect-events -- --room CHATROOM_ID:CHANNEL_ID --duration 300
# Add another --room argument for each additional room.
npm run analyze-events -- kick-events-YYYY-MM-DD.jsonl
```

For an optional controlled read-only reconnect, add `--retry-after 90`. Use `--help` for argument syntax. The CLI defaults to guest authentication; do not paste account credentials into command arguments or event files.

`kick-events-YYYY-MM-DD.jsonl` contains timestamp, event name, channel, room ID, redacted data schema and message ID where available. Files are created with mode `0600`; permissions of an existing file are not changed. Scalar payload values become type descriptions, except the recognized message-kind discriminator and message ID. The analyzer can derive event counts and schema descriptions, but redaction prevents inference of celebration subtypes or monetary values from their original values.

For records with `redacted: true`, the analyzer interprets scalar markers such as `[number]` and `[boolean]` recursively as their schema types. Historical unredacted marker-like strings remain strings. Each event schema follows its first sample's redaction contract; schemas are not merged across samples.

## Connection behavior

- Discover the current Centrifugo URL through Kick's realtime API.
- One shared connection for all supplied rooms; public dot/underscore channel aliases share owners.
- Room readiness requires the primary `.v2` subscription acknowledgment.
- SDK heartbeat/token renewal and bounded application reconnects.
- Terminal connection failure, incomplete room readiness or private-subscription failure produces a non-zero exit status.
- Ctrl+C closes the controller and emits the final summary.

A socket opening is not success. Check the summary and exit status. A quiet room can subscribe successfully without producing a new event during the collection window.

## Diagnostics and limits

For schema-free transport diagnostics, use:

```bash
npm run smoke:realtime -- --room CHATROOM_ID:CHANNEL_ID --duration 300 --retry-after 90
npm run test:realtime
```

The smoke outputs only lifecycle/subscription metadata, event names, IDs and counts. The test suite uses isolated loopback HTTP/WebSocket fixtures and synthetic credentials; it does not access Kick.

See [the realtime channel guide](../../docs/kick-websocket-channels.md) for IDs, JWT scope, channel mapping and acceptance limits. Do not treat collector success as verification of sending, moderation, private event arrival or platform packaging. Any live mutation needs explicit authorization for the exact account, room and action; these tools deliberately provide no send/delete/moderation operation.
