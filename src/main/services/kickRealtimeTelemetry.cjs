'use strict';

const { metrics, trace } = require('@opentelemetry/api');

// Only protocol categories cross the diagnostics boundary, never private IDs.
function channelKind(channel) {
  if (typeof channel !== 'string') return undefined;
  if (/^chatrooms\.\d+\.v2$/.test(channel)) return 'primary';
  if (/^(channel[_.]|chatroom_|chatrooms\.)\d+$/.test(channel)) return 'public_alias';
  if (/^private-userfeed\.\d+$/.test(channel)) return 'private_userfeed';
  if (/^private-channelpoints-\d+$/.test(channel)) return 'private_channelpoints';
  if (/^private-livestream\.\d+$/.test(channel)) return 'private_livestream';
  if (/^predictions-channel-\d+$/.test(channel)) return 'predictions';
  return 'unknown';
}

function createKickRealtimeTelemetry(options = {}) {
  const meter = options.meter || metrics.getMeter('kicktalk.realtime');
  const tracer = options.tracer || trace.getTracer('kicktalk.realtime');
  const isEnabled = options.isEnabled || (() => true);
  let gatewayConnected = false;
  let readyRooms = 0;
  const socketAttributes = { transport: 'kick', connection_kind: 'shared_socket' };
  const roomAttributes = { transport: 'kick', connection_kind: 'primary_room' };
  const sockets = meter.createObservableGauge('kicktalk_websocket_connections_active', {
    description: 'Kick shared sockets with gateway ACK and at least one primary-ready room', unit: '1',
  });
  const rooms = meter.createObservableGauge('kicktalk_realtime_rooms_ready', {
    description: 'Kick rooms whose primary subscription is ready on the established shared gateway', unit: '1',
  });
  sockets.addCallback((result) => {
    result.observe(isEnabled() && gatewayConnected && readyRooms > 0 ? 1 : 0, socketAttributes);
  });
  rooms.addCallback((result) => {
    result.observe(isEnabled() && gatewayConnected ? readyRooms : 0, roomAttributes);
  });
  const episodes = meter.createCounter('kicktalk_realtime_reconnect_episodes_total', { description: 'Logical Kick shared recovery episodes', unit: '1' });
  const attempts = meter.createCounter('kicktalk_realtime_reconnect_attempts_total', { description: 'Kick shared recovery attempts actually started', unit: '1' });
  const delays = meter.createHistogram('kicktalk_realtime_reconnect_delay_seconds', { description: 'Scheduled Kick shared recovery delay', unit: 's' });
  const terminal = meter.createCounter('kicktalk_realtime_terminal_failures_total', { description: 'Kick room transitions to terminal failure, excluding private subscription warnings', unit: '1' });
  const warnings = meter.createCounter('kicktalk_realtime_private_subscription_warnings_total', { description: 'Failed private Kick subscriptions, once per subscription failure, not per room alias', unit: '1' });

  return (event) => {
    // Lifecycle tracking never depends on consent; export does.
    if (event.kind === 'health') {
      gatewayConnected = event.gatewayConnected;
      readyRooms = event.readyRooms;
      return;
    }
    if (!isEnabled()) return;
    const attributes = { transport: 'kick' };
    if (event.reason) attributes.reason = event.reason;
    if (event.classification) attributes.classification = event.classification;
    if (event.kind === 'recovery') {
      if (event.state === 'episode') episodes.add(1, attributes);
      if (event.state === 'attempt') attempts.add(1, attributes);
      if (event.state === 'scheduled') delays.record(event.delayMs / 1000, attributes);
    }
    if (event.kind === 'state' && event.state === 'failed') terminal.add(1, attributes);
    if (event.kind === 'warning') warnings.add(1, attributes);
    const spanAttributes = { 'kick.realtime.transport': 'kick' };
    for (const [key, value] of Object.entries({
      state: event.state, room_id: event.chatroomId, attempt: event.attempt,
      reason: event.reason, code: event.code, channel_kind: channelKind(event.channel),
      episode: event.episode, delay_ms: event.delayMs, classification: event.classification,
    })) {
      if (value !== undefined) spanAttributes[`kick.realtime.${key}`] = value;
    }
    tracer.startSpan(`kick.realtime.${event.kind}`, { attributes: spanAttributes }).end();
  };
}

module.exports = { createKickRealtimeTelemetry };
