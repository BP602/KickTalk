#!/usr/bin/env node
'use strict';

const { KickRealtimeController } = require('../src/main/services/kickRealtime.cjs');

const safeEventName = (value) => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_\\]{0,199}$/.test(value) ? value : 'unrecognized_event';
function publicationMetadata(event) {
  let payload;
  try { payload = JSON.parse(event.data); } catch { payload = null; }
  const id = payload?.id ?? payload?.message?.id;
  const messageId = /ChatMessageEvent$/.test(event.event) &&
    (typeof id === 'string' || typeof id === 'number') && /^[a-z0-9_-]{1,100}$/i.test(String(id)) ? String(id) : undefined;
  return {
    event: safeEventName(event.event), chatroomId: event.chatroomId, channel: event.channel,
    ...(messageId && { messageId }),
  };
}

// Programmatic getSession enables main-owned authenticated diagnostics without
// cookie/JWT CLI flags, environment variables, or credentials in the report.
async function runRealtimeSmoke({ rooms, duration = 300000, retryAfter, getSession, output = (record) => console.log(JSON.stringify(record)), onPublication, ...controllerOptions }) {
  if (!Number.isFinite(duration) || duration <= 0 || (retryAfter !== undefined && (!Number.isFinite(retryAfter) || retryAfter <= 0 || retryAfter >= duration))) {
    throw new TypeError('Invalid smoke duration');
  }
  const counts = new Map();
  const messageIds = new Set();
  const subscriptions = new Set();
  const subscriptionFailures = new Map();
  const startedAt = Date.now();
  let publicationError = false;
  let retryTimer;
  let durationTimer;
  let finish;
  const finished = new Promise((resolve) => { finish = resolve; });
  const controller = new KickRealtimeController({
    ...controllerOptions, getSession,
    telemetry: (record) => {
      if (record.kind !== 'subscription') return;
      if (record.state === 'connected') {
        subscriptions.add(record.channel);
        subscriptionFailures.delete(record.channel);
      } else subscriptionFailures.set(record.channel, { channel: record.channel, reason: record.reason, code: record.code });
      output({ ...record });
    },
    emit: (event) => {
      if (event.kind === 'state') {
        output(event);
      } else {
        const metadata = publicationMetadata(event);
        const count = (counts.get(metadata.event) || 0) + 1;
        counts.set(metadata.event, count);
        if (metadata.messageId) messageIds.add(metadata.messageId);
        output({ kind: 'publication', ...metadata, count });
        try { onPublication?.(event, metadata); }
        catch { publicationError = true; finish(); }
      }
    },
  });
  const stop = () => finish();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    durationTimer = setTimeout(stop, duration);
    if (retryAfter !== undefined) retryTimer = setTimeout(() => {
      output({ kind: 'controlled_retry' });
      void controller.retry();
    }, retryAfter);
    await controller.setRooms(rooms);
    await finished;
    if (publicationError) throw new Error('realtime_diagnostic_output_failed');
    const snapshot = controller.getSnapshot();
    const summary = {
      kind: 'summary', rooms: snapshot, subscriptions: [...subscriptions],
      elapsedMs: Date.now() - startedAt,
      subscriptionFailures: [...subscriptionFailures.values()],
      eventCounts: Object.fromEntries(counts), uniqueMessageIds: messageIds.size,
      connected: snapshot.length === rooms.length && snapshot.every((room) => room.state === 'connected'),
    };
    output(summary);
    return summary;
  } finally {
    clearTimeout(durationTimer);
    clearTimeout(retryTimer);
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    controller.close();
  }
}

function parseArguments(args) {
  const rooms = [];
  let duration = 300000;
  let retryAfter;
  let help = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--help') { help = true; continue; }
    if (arg === '--room') {
      const value = args[++index];
      if (!/^\d+:\d+(?::\d+)?$/.test(value || '')) throw new TypeError('Room must be chatroomId:channelId[:livestreamId]');
      const [chatroomId, channelId, livestreamId] = value.split(':').map(Number);
      rooms.push({ chatroomId, channelId, ...(livestreamId !== undefined && { livestreamId }) });
    } else if (arg === '--duration' || arg === '--retry-after') {
      const value = Number(args[++index]);
      if (!Number.isFinite(value) || value <= 0) throw new TypeError('Duration must be positive seconds');
      if (arg === '--duration') duration = value * 1000;
      else retryAfter = value * 1000;
    } else throw new TypeError('Unknown realtime smoke argument');
  }
  return { rooms, duration, retryAfter, help };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help || !options.rooms.length) {
    console.log('Usage: node scripts/realtime-smoke.cjs --room chatroomId:channelId[:livestreamId] [--room ...] [--duration seconds] [--retry-after seconds]');
    console.log('Receives only. Reports event names, message IDs, counts and sanitized connection/subscription states; never sends chat or prints credentials/content.');
    if (!options.help) process.exitCode = 1;
    return;
  }
  const summary = await runRealtimeSmoke(options);
  if (!summary.connected || summary.subscriptionFailures.length) process.exitCode = 1;
}

if (require.main === module) main().catch(() => {
  console.error('Realtime smoke failed: invalid arguments or diagnostic setup');
  process.exitCode = 1;
});

module.exports = { runRealtimeSmoke, publicationMetadata, parseArguments };
