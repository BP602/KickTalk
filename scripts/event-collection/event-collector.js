#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const { runRealtimeSmoke, parseArguments } = require('../realtime-smoke.cjs');

// Preserve event schema discovery without writing chat text, identities or secrets.
// Only message IDs and the established message-kind discriminator survive redaction.
function describePayload(value, depth = 0) {
  if (depth > 8) return '[depth_limit]';
  if (value === null) return null;
  if (Array.isArray(value)) return value.slice(0, 10).map((item) => describePayload(item, depth + 1));
  if (typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).slice(0, 100)) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,99}$/.test(key)) continue;
      if (key === 'type' && ['message', 'reply', 'system', 'celebration'].includes(value[key])) result[key] = value[key];
      else result[key] = describePayload(value[key], depth + 1);
    }
    return result;
  }
  return `[${typeof value}]`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help || !options.rooms.length) {
    console.log('Usage: npm run collect-events -- --room chatroomId:channelId[:livestreamId] [--room ...] [--duration seconds] [--retry-after seconds]');
    console.log('Uses the production Centrifugo controller. JSONL payloads are schema-only/redacted; no chat content, identities, cookies or JWTs are written.');
    if (!options.help) process.exitCode = 1;
    return;
  }
  const logFile = `kick-events-${new Date().toISOString().slice(0, 10)}.jsonl`;
  const summary = await runRealtimeSmoke({
    ...options,
    onPublication: (publication, metadata) => {
      let data;
      try { data = describePayload(JSON.parse(publication.data)); }
      catch { data = '[invalid_json]'; }
      if (metadata.messageId && data && typeof data === 'object') data.id = metadata.messageId;
      const detailedEventType = metadata.event === 'App\\Events\\ChatMessageEvent' && data?.type
        ? `${metadata.event} (${data.type})` : metadata.event;
      const entry = {
        timestamp: new Date().toISOString(), event: metadata.event,
        channel: metadata.channel, chatroomId: metadata.chatroomId,
        data, detailedEventType, redacted: true,
        ...(metadata.messageId && { messageId: metadata.messageId }),
      };
      fs.appendFileSync(logFile, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
    },
  });
  if (!summary.connected || summary.subscriptionFailures.length) process.exitCode = 1;
}

if (require.main === module) main().catch(() => {
  console.error('Event collection failed: invalid arguments, diagnostic setup or output file');
  process.exitCode = 1;
});

module.exports = { describePayload };
