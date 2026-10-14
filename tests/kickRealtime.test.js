// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import WebSocket, { WebSocketServer } from 'ws';

const { KickRealtimeController } = createRequire(import.meta.url)('../src/main/services/kickRealtime.cjs');

const ROOM_A = { chatroomId: 101, channelId: 501, streamerName: 'fixture-a' };
const ROOM_B = { chatroomId: 102, channelId: 501, streamerName: 'fixture-b' };
const PRIMARY_A = 'chatrooms.101.v2';
const PRIMARY_B = 'chatrooms.102.v2';
const AUTH_PATH = '/api/v1/realtime/auth/connection';
const CHANNEL_AUTH_PATH = '/api/v1/realtime/auth/channel';
const MESSAGE_EVENT = 'App\\Events\\ChatMessageEvent';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function until(predicate, description, timeout = 3000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${description}`);
    await sleep(5);
  }
}

function trackUnhandledRejections() {
  const reasons = [];
  const listener = (reason) => reasons.push(reason);
  process.on('unhandledRejection', listener);
  return {
    reasons,
    stop: () => process.off('unhandledRejection', listener),
  };
}

function publicChannels(room) {
  return [
    `channel_${room.channelId}`,
    `channel.${room.channelId}`,
    `chatroom_${room.chatroomId}`,
    `chatrooms.${room.chatroomId}`,
    `chatrooms.${room.chatroomId}.v2`,
  ];
}

// The fixture speaks Centrifugo JSON protocol over actual loopback HTTP/WS.
// It never echoes a client publication: tests inject independent server pushes.
async function createFixture() {
  const requests = [];
  const connections = [];
  const errors = [];
  const holds = [];
  const scheduled = new Set();
  const heldChannels = new Set();
  const heldSubRefreshChannels = new Set();
  const subscribeErrors = new Map();
  const channelAuthStatuses = new Map();
  const channelTokens = new Map();
  const connectionTokens = [];
  const subscriptionTtls = new Map();
  const options = { authStatus: 200, discoveryStatus: 200, ttl: null, ping: 0 };
  let httpHandler = null;
  let subscribeHandler = null;
  let connectError = null;
  let holdRefresh = false;
  let baseUrl;

  const http = createServer(async (request, response) => {
    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const text = Buffer.concat(chunks).toString('utf8');
      const entry = {
        path: new URL(request.url, baseUrl).pathname,
        method: request.method,
        headers: request.headers,
        body: text ? JSON.parse(text) : null,
      };
      requests.push(entry);
      const hold = holds.find((candidate) => !candidate.claimed && candidate.path === entry.path
        && (!candidate.channel || entry.body?.channel === candidate.channel));
      if (hold) {
        hold.claimed = true;
        hold.reached.resolve(entry);
        await hold.released.promise;
      }
      let result = httpHandler ? await httpHandler(entry) : undefined;
      if (!result && entry.path === AUTH_PATH) {
        const number = requests.filter((candidate) => candidate.path === AUTH_PATH).length;
        if (options.authStatus === 200) {
          const token = `fixture-token-${number}`;
          connectionTokens.push(token);
          result = { status: 200, body: { data: { token } } };
        } else {
          result = { status: options.authStatus, body: { error: 'fixture-private-response-marker' } };
        }
      }
      if (!result && entry.path === CHANNEL_AUTH_PATH) {
        const channel = entry.body?.channel;
        const status = typeof channel === 'string' ? (channelAuthStatuses.get(channel) ?? 200) : 400;
        if (status === 200) {
          const issued = channelTokens.get(channel) ?? [];
          const token = `fixture-channel-jwt-${issued.length + 1}-${channel.replace(/[^a-z0-9]+/gi, '-')}`;
          issued.push(token);
          channelTokens.set(channel, issued);
          result = { status: 200, body: { data: { token } } };
        } else {
          result = { status, body: { error: 'fixture-private-response-marker' } };
        }
      }
      if (!result && (entry.path === '/api/v1/realtime/connection'
        || /^\/api\/v1\/realtime\/channels\/\d+\/chat\/connection$/.test(entry.path))) {
        result = options.discoveryStatus === 200
          ? {
            status: 200,
            body: { data: { mode: 'websocket', connections: [{ provider: 'centrifugo', credentials: { url: `${baseUrl.replace('http:', 'ws:')}/connection/websocket` } }] } },
          }
          : { status: options.discoveryStatus, body: { error: 'fixture-private-response-marker' } };
      }
      if (!result) {
        errors.push(`Unexpected HTTP route: ${entry.method} ${entry.path}`);
        result = { status: 404, body: { error: 'unknown fixture route' } };
      }
      if (!response.destroyed) {
        response.writeHead(result.status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(result.body));
      }
    } catch (error) {
      if (!request.destroyed) {
        errors.push(`Fixture HTTP handler failed: ${error.message}`);
        response.writeHead(500);
        response.end();
      }
    }
  });
  const ws = new WebSocketServer({ server: http, path: '/connection/websocket' });

  function send(connection, value) {
    if (connection.socket.readyState === WebSocket.OPEN) connection.socket.send(JSON.stringify(value));
  }

  function hasExpectedPrivateToken(channel, token) {
    return !channel.startsWith('private-') || token === channelTokens.get(channel)?.at(-1);
  }

  function acknowledge(connection, command) {
    const channel = command.subscribe.channel;
    connection.pending.delete(channel);
    connection.subscriptions.add(channel);
    const ttl = subscriptionTtls.get(channel);
    send(connection, { id: command.id, subscribe: ttl ? { expires: true, ttl } : {} });
  }

  function acknowledgeRefresh(connection, command) {
    send(connection, { id: command.id, refresh: { expires: true, ttl: 30 } });
  }

  ws.on('connection', (socket) => {
    const connection = {
      socket,
      commands: [],
      pending: new Map(),
      pendingRefreshes: [],
      pendingSubRefreshes: [],
      subscriptions: new Set(),
      pongs: 0,
      closed: false,
    };
    connections.push(connection);
    socket.on('error', () => {});
    socket.on('close', () => { connection.closed = true; });
    socket.on('message', (bytes) => {
      try {
        for (const text of bytes.toString('utf8').split('\n').filter(Boolean)) {
          const command = JSON.parse(text);
          if (Object.keys(command).length === 0) {
            connection.pongs += 1;
            continue;
          }
          connection.commands.push(command);
          if (command.connect) {
            if (connectError) {
              send(connection, { id: command.id, error: connectError });
            } else {
              send(connection, {
                id: command.id,
                connect: {
                  client: `fixture-client-${connections.length}`,
                  version: '6.9.7',
                  ping: options.ping,
                  pong: true,
                  ...(options.ttl === null ? {} : { expires: true, ttl: options.ttl }),
                },
              });
            }
          } else if (command.subscribe) {
            const channel = command.subscribe.channel;
            if (subscribeHandler?.(connection, command) === false) continue;
            if (subscribeErrors.has(channel)) {
              send(connection, { id: command.id, error: subscribeErrors.get(channel) });
            } else if (heldChannels.has(channel)) {
              connection.pending.set(channel, command);
            } else if (!hasExpectedPrivateToken(channel, command.subscribe.token)) {
              send(connection, { id: command.id, error: { code: 103, message: 'missing expected private subscription token' } });
            } else {
              acknowledge(connection, command);
            }
          } else if (command.unsubscribe) {
            connection.subscriptions.delete(command.unsubscribe.channel);
            send(connection, { id: command.id, unsubscribe: {} });
          } else if (command.refresh) {
            if (holdRefresh) connection.pendingRefreshes.push(command);
            else acknowledgeRefresh(connection, command);
          } else if (command.sub_refresh) {
            if (!hasExpectedPrivateToken(command.sub_refresh.channel, command.sub_refresh.token)) {
              send(connection, { id: command.id, error: { code: 103, message: 'missing expected private subscription token' } });
            } else if (heldSubRefreshChannels.has(command.sub_refresh.channel)) {
              connection.pendingSubRefreshes.push(command);
            } else {
              send(connection, { id: command.id, sub_refresh: { expires: true, ttl: 30 } });
            }
          } else {
            errors.push(`Unexpected Centrifugo command: ${Object.keys(command).join(',')}`);
          }
        }
      } catch (error) {
        errors.push(`Fixture WS handler failed: ${error.message}`);
      }
    });
  });
  ws.on('error', (error) => errors.push(`Fixture WS server failed: ${error.message}`));
  await new Promise((resolve, reject) => {
    http.once('error', reject);
    http.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${http.address().port}`;

  async function fetchImpl(input, init) {
    const target = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (target.origin !== baseUrl) {
      errors.push('Controller attempted non-fixture HTTP traffic');
      throw new Error('Only fixture loopback HTTP is permitted');
    }
    return globalThis.fetch(input, init);
  }

  class FixtureWebSocket extends WebSocket {
    constructor(address, ...arguments_) {
      const target = new URL(address);
      if (target.origin !== baseUrl.replace('http:', 'ws:') || target.pathname !== '/connection/websocket') {
        errors.push('Controller attempted non-fixture WebSocket traffic');
        throw new Error('Only fixture loopback WebSocket is permitted');
      }
      super(address, ...arguments_);
    }
  }

  return {
    baseUrl,
    fetchImpl,
    WebSocketImpl: FixtureWebSocket,
    options,
    requests,
    connections,
    errors,
    heldChannels,
    subscribeErrors,
    channelAuthStatuses,
    channelTokens,
    connectionTokens,
    subscriptionTtls,
    heldSubRefreshChannels,
    set httpHandler(handler) { httpHandler = handler; },
    set subscribeHandler(handler) { subscribeHandler = handler; },
    set connectError(error) { connectError = error; },
    set holdRefresh(value) { holdRefresh = value; },
    authRequests: () => requests.filter((entry) => entry.path === AUTH_PATH),
    channelAuthRequests: (channel) => requests.filter((entry) => entry.path === CHANNEL_AUTH_PATH
      && (channel === undefined || entry.body?.channel === channel)),
    latestChannelToken: (channel) => channelTokens.get(channel)?.at(-1),
    commands: (type) => connections.flatMap((connection) => connection.commands.filter((command) => command[type])),
    holdNextRequest(path, channel) {
      const hold = { path, channel, claimed: false, reached: deferred(), released: deferred() };
      holds.push(hold);
      return { reached: hold.reached.promise, release: () => hold.released.resolve() };
    },
    holdNextChannelAuth(channel) {
      return this.holdNextRequest(CHANNEL_AUTH_PATH, channel);
    },
    pendingRefreshes: () => connections.flatMap((connection) => connection.pendingRefreshes),
    pendingSubRefreshes: (channel) => connections.flatMap((connection) => connection.pendingSubRefreshes)
      .filter((command) => command.sub_refresh.channel === channel),
    releaseSubRefresh(channel, result) {
      for (const connection of connections) {
        const pending = connection.pendingSubRefreshes.filter((command) => command.sub_refresh.channel === channel);
        connection.pendingSubRefreshes = connection.pendingSubRefreshes.filter((command) => command.sub_refresh.channel !== channel);
        for (const command of pending) send(connection, { id: command.id, ...result });
      }
    },
    releaseRefreshes() {
      holdRefresh = false;
      for (const connection of connections) {
        for (const command of connection.pendingRefreshes.splice(0)) acknowledgeRefresh(connection, command);
      }
    },
    releaseSubscription(channel) {
      heldChannels.delete(channel);
      for (const connection of connections) {
        const command = connection.pending.get(channel);
        if (command) acknowledge(connection, command);
      }
    },
    publish(channel, event, data, target) {
      for (const connection of target ? [target] : connections) {
        if (target || connection.subscriptions.has(channel)) {
          send(connection, { push: { channel, pub: { data: { event, data: JSON.stringify(data) } } } });
        }
      }
    },
    ping(connection = connections.at(-1)) { send(connection, {}); },
    disconnect(connection, code = 3001, reason = 'fixture recoverable disconnect') {
      send(connection, { push: { disconnect: { code, reason, reconnect: code < 3500 } } });
    },
    later(callback, milliseconds = 5) {
      const timer = setTimeout(() => { scheduled.delete(timer); callback(); }, milliseconds);
      scheduled.add(timer);
    },
    async close() {
      for (const hold of holds) hold.released.resolve();
      for (const timer of scheduled) clearTimeout(timer);
      for (const connection of connections) connection.pendingRefreshes.length = 0;
      for (const connection of connections) connection.socket.terminate();
      await new Promise((resolve) => ws.close(resolve));
      http.closeAllConnections();
      await new Promise((resolve) => http.close(resolve));
    },
  };
}

describe('KickRealtimeController with the real Centrifugo wire protocol', () => {
  let fixture;
  let controller;
  let events;
  let session;

  beforeEach(async () => {
    fixture = await createFixture();
    events = [];
    session = {};
    controller = new KickRealtimeController({
      fetchImpl: fixture.fetchImpl,
      WebSocketImpl: fixture.WebSocketImpl,
      apiBaseUrl: fixture.baseUrl,
      getSession: async () => session,
      emit: (event) => events.push(event),
      maxAttempts: 3,
      minReconnectDelay: 10,
      maxReconnectDelay: 20,
    });
  });

  afterEach(async () => {
    try {
      await controller?.close();
    } finally {
      await fixture?.close();
    }
    expect(fixture?.errors ?? []).toEqual([]);
  });

  const stateEvents = (roomId) => events.filter((event) => event.kind === 'state' && event.chatroomId === roomId);
  const publications = (roomId) => events.filter((event) => event.kind === 'publication' && event.chatroomId === roomId);
  const latestState = (roomId) => stateEvents(roomId).at(-1);
  const waitConnected = async (roomId) => until(() => latestState(roomId)?.state === 'connected', `room ${roomId} primary readiness`);

  it('stays connecting after native open and other ACKs until the primary room subscription is ready', async () => {
    fixture.heldChannels.add(PRIMARY_A);
    await controller.setRooms([ROOM_A]);
    await until(() => fixture.connections[0]?.pending.has(PRIMARY_A), 'pending primary subscription');
    const connection = fixture.connections[0];
    expect(connection.socket.readyState).toBe(WebSocket.OPEN);
    expect([...connection.subscriptions].sort()).toEqual(publicChannels(ROOM_A).filter((channel) => channel !== PRIMARY_A).sort());
    expect(stateEvents(101).some((event) => event.state === 'connecting')).toBe(true);
    expect(stateEvents(101).some((event) => event.state === 'connected')).toBe(false);
    expect(controller.getSnapshot().find((room) => room.chatroomId === 101).state).not.toBe('connected');
    const discovery = fixture.requests.find((entry) => entry.path === '/api/v1/realtime/connection');
    expect(discovery).toMatchObject({
      method: 'POST',
      body: { client: { type: 'web' }, capabilities: { accepted_providers: [{ provider: 'centrifugo' }] } },
      headers: { accept: 'application/json', 'content-type': 'application/json', 'x-app-platform': 'web', origin: 'https://kick.com' },
    });
    expect(discovery.body.client.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(fixture.authRequests()[0].body).toEqual({ client_id: discovery.body.client.id });
    expect(fixture.authRequests()[0].headers.authorization).toBeUndefined();

    fixture.releaseSubscription(PRIMARY_A);
    await waitConnected(101);
    expect(controller.getSnapshot().find((room) => room.chatroomId === 101)).toMatchObject({ state: 'connected', attempt: 0 });
    expect(fixture.channelAuthRequests()).toHaveLength(0);
    expect(stateEvents(101).filter((event) => event.state === 'connected')).toHaveLength(1);
  });

  it('shares one socket and subscription per channel across rooms without duplicate room deliveries', async () => {
    await controller.setRooms([ROOM_A]);
    await waitConnected(101);
    await controller.setRooms([ROOM_A, ROOM_B]);
    await waitConnected(102);
    await controller.setRooms([ROOM_B, ROOM_A]);
    const channels = [...new Set([...publicChannels(ROOM_A), ...publicChannels(ROOM_B)])].sort();
    expect(fixture.connections).toHaveLength(1);
    expect(fixture.authRequests()).toHaveLength(1);
    expect(fixture.commands('subscribe').map((command) => command.subscribe.channel).sort()).toEqual(channels);

    const sharedEvent = 'App\\Events\\StreamerIsLive';
    fixture.publish('channel.501', sharedEvent, { id: 'fixture-live', channel_id: 501 });
    const message = { id: 'fixture-message', chatroom_id: 101, content: 'fixture text', sender: { id: 1, username: 'fixture' } };
    fixture.publish(PRIMARY_A, MESSAGE_EVENT, message);
    fixture.publish('chatrooms.101', MESSAGE_EVENT, message);
    fixture.publish('chatroom_101', MESSAGE_EVENT, { sender: message.sender, content: message.content, chatroom_id: 101, id: message.id });
    await until(() => publications(101).length >= 2 && publications(102).length >= 1, 'shared and primary publications');
    await sleep(40);
    expect(publications(101)).toHaveLength(2);
    expect(publications(102)).toHaveLength(1);
    expect(publications(101).find((event) => event.event === MESSAGE_EVENT)).toMatchObject({
      chatroomId: 101, channel: PRIMARY_A, event: MESSAGE_EVENT, data: JSON.stringify(message),
    });
    expect(publications(102)[0]).toMatchObject({ chatroomId: 102, channel: 'channel.501', event: sharedEvent });
    expect(stateEvents(101).filter((event) => event.state === 'connected')).toHaveLength(1);
    expect(stateEvents(102).filter((event) => event.state === 'connected')).toHaveLength(1);
  });

  it('delivers non-consecutive repeats of an idless chatroom state while retaining alias and stable message dedup', async () => {
    await controller.setRooms([ROOM_A]);
    await waitConnected(101);
    const updateEvent = 'App\\Events\\ChatroomUpdatedEvent';
    const emotesOn = { emotes_mode: true };
    const emotesOff = { emotes_mode: false };
    fixture.publish(PRIMARY_A, updateEvent, emotesOn);
    fixture.publish('chatrooms.101', updateEvent, emotesOn);
    fixture.publish(PRIMARY_A, updateEvent, emotesOff);
    fixture.publish('chatrooms.101', updateEvent, emotesOn);
    const updates = () => publications(101).filter((event) => event.event === updateEvent);
    await until(() => updates().length >= 3, 'A-B-A chatroom state publications');
    await sleep(40);
    expect(updates()).toHaveLength(3);
    expect(updates().map((event) => JSON.parse(event.data).emotes_mode)).toEqual([true, false, true]);

    const message = { id: 'fixture-state-sequence-message', chatroom_id: 101, content: 'fixture text', sender: { id: 1, username: 'fixture' } };
    fixture.publish(PRIMARY_A, MESSAGE_EVENT, message);
    fixture.publish('chatrooms.101', MESSAGE_EVENT, message);
    fixture.publish('chatroom_101', MESSAGE_EVENT, { sender: message.sender, content: message.content, chatroom_id: 101, id: message.id });
    await until(() => publications(101).length >= 4, 'stable-ID message after state sequence');
    await sleep(40);
    expect(publications(101)).toHaveLength(4);
    expect(publications(101).filter((event) => event.event === MESSAGE_EVENT)).toEqual([
      expect.objectContaining({ channel: PRIMARY_A, data: JSON.stringify(message) }),
    ]);
  });

  it.each([
    ['pin created-deleted-created', 'PinnedMessageCreatedEvent', 'PinnedMessageDeletedEvent', { message: { id: 'fixture-pin' } }, {}],
    ['pin deleted-created-deleted', 'PinnedMessageDeletedEvent', 'PinnedMessageCreatedEvent', {}, { message: { id: 'fixture-pin' } }],
    ['poll updated-deleted-updated', 'PollUpdateEvent', 'PollDeleteEvent', { poll: { title: 'fixture-poll' } }, {}],
    ['poll deleted-updated-deleted', 'PollDeleteEvent', 'PollUpdateEvent', {}, { poll: { title: 'fixture-poll' } }],
    ['live stopped-live', 'StreamerIsLive', 'StopStreamBroadcast', { livestream: { id: 701 } }, {}],
    ['stopped live-stopped', 'StopStreamBroadcast', 'StreamerIsLive', {}, { livestream: { id: 701 } }],
  ])('delivers all opposing %s transitions while suppressing their adjacent aliases', async (_name, first, opposite, firstData, oppositeData) => {
    await controller.setRooms([ROOM_A]);
    await waitConnected(101);
    const sequence = [
      [`App\\Events\\${first}`, firstData],
      [`App\\Events\\${opposite}`, oppositeData],
      [`App\\Events\\${first}`, firstData],
    ];
    for (const [event, data] of sequence) {
      fixture.publish(PRIMARY_A, event, data);
      fixture.publish('chatrooms.101', event, data);
      fixture.publish('chatroom_101', event, data);
    }
    await until(() => publications(101).length >= 3, 'three opposing lifecycle transitions');
    await sleep(40);
    expect(publications(101).map((event) => [event.event, JSON.parse(event.data)])).toEqual(sequence);
    expect(publications(101).every((event) => event.channel === PRIMARY_A)).toBe(true);
  });

  it('tracks primary readiness independently when a new room joins an already connected socket', async () => {
    await controller.setRooms([ROOM_A]);
    await waitConnected(101);
    fixture.heldChannels.add(PRIMARY_B);
    await controller.setRooms([ROOM_A, ROOM_B]);
    await until(() => fixture.connections[0].pending.has(PRIMARY_B), 'second room pending primary');
    expect(latestState(101).state).toBe('connected');
    expect(latestState(102).state).not.toBe('connected');
    expect(fixture.connections).toHaveLength(1);
    fixture.releaseSubscription(PRIMARY_B);
    await waitConnected(102);
  });

  it.each([401, 403])('stops on HTTP %i authentication without exposing response data or retrying automatically', async (status) => {
    fixture.options.authStatus = status;
    await controller.setRooms([ROOM_A]);
    await until(() => latestState(101)?.state === 'failed', 'terminal token authorization failure');
    const failure = latestState(101);
    expect(failure).toMatchObject({ kind: 'state', chatroomId: 101, state: 'failed', code: status });
    expect(failure.reason).toEqual(expect.any(String));
    expect(JSON.stringify(events)).not.toContain('fixture-private-response-marker');
    expect(JSON.stringify(events)).not.toContain('fixture-token-');
    await sleep(120);
    expect(fixture.authRequests()).toHaveLength(1);
    expect(fixture.connections).toHaveLength(0);
  });

  it('allows an explicit room retry to recover a terminal authentication failure', async () => {
    fixture.options.authStatus = 401;
    await controller.setRooms([ROOM_A]);
    await until(() => latestState(101)?.state === 'failed', 'initial terminal failure');
    fixture.options.authStatus = 200;
    await controller.retry(101);
    await waitConnected(101);
    expect(fixture.authRequests()).toHaveLength(2);
    expect(fixture.connections).toHaveLength(1);
    expect(controller.getSnapshot()).toEqual([expect.objectContaining({ chatroomId: 101, state: 'connected', attempt: 0 })]);
  });

  it('bounds transient HTTP token failures instead of inheriting unlimited SDK retries', async () => {
    fixture.options.authStatus = 503;
    await controller.setRooms([ROOM_A]);
    await until(() => latestState(101)?.state === 'failed', 'exhausted HTTP retry budget');
    expect(fixture.authRequests()).toHaveLength(3);
    expect(latestState(101).attempt).toBe(3);
    expect(stateEvents(101).some((event) => event.state === 'reconnecting')).toBe(true);
    expect(JSON.stringify(events)).not.toContain('fixture-private-response-marker');
    await sleep(120);
    expect(fixture.authRequests()).toHaveLength(3);
    expect(fixture.connections).toHaveLength(0);
  });

  it.each([
    { label: 'fatal authentication', status: 401, initialAuthRequests: 1 },
    { label: 'retry exhaustion', status: 503, initialAuthRequests: 3 },
  ])('marks a room added after $label as failed until an explicit retry', async ({ status, initialAuthRequests }) => {
    fixture.options.authStatus = status;
    await controller.setRooms([ROOM_A]);
    await until(() => latestState(101)?.state === 'failed', 'initial terminal room state');
    const terminal = { ...latestState(101) };
    expect(terminal.reason).toEqual(expect.any(String));
    expect(terminal.code).toBe(status);
    expect(fixture.authRequests()).toHaveLength(initialAuthRequests);

    await controller.setRooms([ROOM_A, ROOM_B]);
    await until(() => latestState(102)?.state === 'failed', 'new room inherits terminal state');
    expect(latestState(102)).toMatchObject({ state: 'failed', reason: terminal.reason, code: terminal.code });
    expect(controller.getSnapshot()).toEqual([
      expect.objectContaining({ chatroomId: 101, state: 'failed', reason: terminal.reason, code: terminal.code }),
      expect.objectContaining({ chatroomId: 102, state: 'failed', reason: terminal.reason, code: terminal.code }),
    ]);
    expect(JSON.stringify(events)).not.toContain('fixture-private-response-marker');
    await sleep(120);
    expect(fixture.authRequests()).toHaveLength(initialAuthRequests);
    expect(fixture.connections).toHaveLength(0);
    expect(latestState(102).state).toBe('failed');

    fixture.options.authStatus = 200;
    await controller.retry(102);
    await Promise.all([waitConnected(101), waitConnected(102)]);
    expect(fixture.authRequests()).toHaveLength(initialAuthRequests + 1);
    expect(fixture.connections).toHaveLength(1);
    expect(controller.getSnapshot()).toEqual([
      expect.objectContaining({ chatroomId: 101, state: 'connected', attempt: 0 }),
      expect.objectContaining({ chatroomId: 102, state: 'connected', attempt: 0 }),
    ]);
  });

  it('does not reset the finite retry budget on socket open or connect ACK before primary readiness', async () => {
    fixture.subscribeHandler = (connection, command) => {
      if (command.subscribe.channel !== PRIMARY_A) return true;
      fixture.later(() => fixture.disconnect(connection), 1);
      return false;
    };
    await controller.setRooms([ROOM_A]);
    await until(() => latestState(101)?.state === 'failed', 'exhausted pre-readiness disconnect budget');
    expect(fixture.connections).toHaveLength(3);
    expect(fixture.commands('connect')).toHaveLength(3);
    expect(stateEvents(101).some((event) => event.state === 'connected')).toBe(false);
    expect(latestState(101).attempt).toBe(3);
    const attempts = stateEvents(101)
      .filter((event) => ['connecting', 'reconnecting'].includes(event.state))
      .map((event) => event.attempt);
    expect([...new Set(attempts)]).toEqual([1, 2, 3]);
    expect(attempts.every((attempt, index) => index === 0 || attempt >= attempts[index - 1])).toBe(true);
    await sleep(120);
    expect(fixture.connections).toHaveLength(3);
  });

  it('resets the retry budget after primary readiness so independent later outages can recover', async () => {
    await controller.setRooms([ROOM_A]);
    await waitConnected(101);
    for (let outage = 0; outage < 4; outage += 1) {
      const previousCount = fixture.connections.length;
      fixture.disconnect(fixture.connections.at(-1));
      await until(() => fixture.connections.length > previousCount, 'replacement physical connection');
      await waitConnected(101);
      expect(controller.getSnapshot().find((room) => room.chatroomId === 101).attempt).toBe(0);
    }
    expect(fixture.connections).toHaveLength(5);
    expect(stateEvents(101).some((event) => event.state === 'failed')).toBe(false);
  });

  it('treats a permanent protocol connect error as terminal and sanitizes its reason', async () => {
    fixture.connectError = { code: 101, message: 'fixture-token-1 fixture-private-response-marker' };
    await controller.setRooms([ROOM_A]);
    await until(() => latestState(101)?.state === 'failed', 'terminal protocol authorization');
    expect(latestState(101).code).toBe(101);
    expect(JSON.stringify(events)).not.toContain('fixture-private-response-marker');
    expect(JSON.stringify(events)).not.toContain('fixture-token-');
    await sleep(120);
    expect(fixture.connections).toHaveLength(1);
  });

  it('honors fatal server disconnect advice instead of reconnecting a ready room', async () => {
    await controller.setRooms([ROOM_A]);
    await waitConnected(101);
    fixture.disconnect(fixture.connections[0], 3500, 'fixture-private-response-marker');
    await until(() => latestState(101)?.state === 'failed', 'terminal server disconnect');
    expect(latestState(101).code).toBe(3500);
    expect(JSON.stringify(events)).not.toContain('fixture-private-response-marker');
    await sleep(120);
    expect(fixture.connections).toHaveLength(1);
  });

  it('keeps another ready room receiving when one primary subscription is permanently denied', async () => {
    fixture.subscribeErrors.set(PRIMARY_A, { code: 103, message: 'fixture-private-response-marker' });
    await controller.setRooms([ROOM_A, ROOM_B]);
    await until(() => latestState(101)?.state === 'failed', 'terminal room subscription denial');
    await waitConnected(102);
    expect(latestState(101).code).toBe(103);
    expect(fixture.connections).toHaveLength(1);
    fixture.publish(PRIMARY_B, MESSAGE_EVENT, { id: 'fixture-surviving-room', chatroom_id: 102 });
    await until(() => publications(102).length === 1, 'surviving room publication');
    expect(publications(101)).toHaveLength(0);
    expect(JSON.stringify(events)).not.toContain('fixture-private-response-marker');
    await sleep(120);
    expect(fixture.commands('subscribe').filter((command) => command.subscribe.channel === PRIMARY_A)).toHaveLength(1);
  });

  it('renews an expiring token and answers server pings without reconnecting or rebuilding room subscriptions', async () => {
    fixture.options.ttl = 1;
    fixture.options.ping = 1;
    await controller.setRooms([ROOM_A, ROOM_B]);
    await Promise.all([waitConnected(101), waitConnected(102)]);
    const connection = fixture.connections[0];
    const subscriptionCount = fixture.commands('subscribe').length;
    const stateCount = events.filter((event) => event.kind === 'state').length;
    fixture.ping(connection);
    await until(() => connection.pongs === 1, 'SDK server ping pong');
    await until(() => fixture.commands('refresh').length === 1, 'SDK token renewal', 4000);
    expect(fixture.authRequests()).toHaveLength(2);
    expect(fixture.commands('refresh')[0].refresh.token).not.toBe(fixture.commands('connect')[0].connect.token);
    expect(fixture.connections).toHaveLength(1);
    expect(fixture.commands('subscribe')).toHaveLength(subscriptionCount);
    expect(fixture.commands('unsubscribe')).toHaveLength(0);
    expect(events.filter((event) => event.kind === 'state')).toHaveLength(stateCount);
    fixture.ping(connection);
    await until(() => connection.pongs === 2, 'pong after token refresh');
    fixture.publish(PRIMARY_B, MESSAGE_EVENT, { id: 'fixture-after-renewal', chatroom_id: 102 });
    await until(() => publications(102).length === 1, 'publication after refresh');
    expect(controller.getSnapshot().every((room) => room.state === 'connected')).toBe(true);
    expect(JSON.stringify(events)).not.toContain('fixture-token-');
  }, 7000);

  it('stops on a fatal token refresh instead of leaving rooms apparently connected', async () => {
    fixture.options.ttl = 1;
    await controller.setRooms([ROOM_A]);
    await waitConnected(101);
    fixture.options.authStatus = 403;
    await until(() => latestState(101)?.state === 'failed', 'terminal refresh authorization', 4000);
    expect(latestState(101).code).toBe(403);
    await until(() => fixture.connections[0].closed, 'socket closed after refresh failure');
    expect(fixture.authRequests()).toHaveLength(2);
    expect(fixture.connections).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain('fixture-private-response-marker');
    await sleep(120);
    expect(fixture.authRequests()).toHaveLength(2);
  }, 7000);

  it('tears down cleanly when the final room is removed while a real refresh command awaits its server ACK', async () => {
    const unhandled = trackUnhandledRejections();
    try {
      fixture.options.ttl = 1;
      fixture.holdRefresh = true;
      await controller.setRooms([ROOM_A]);
      await waitConnected(101);
      await until(() => fixture.pendingRefreshes().length === 1, 'server-held refresh command', 4000);
      expect(fixture.authRequests()).toHaveLength(2);
      expect(fixture.commands('refresh')[0].refresh.token).not.toBe(fixture.commands('connect')[0].connect.token);
      const old = fixture.connections[0];

      await controller.setRooms([]);
      fixture.releaseRefreshes();
      await until(() => old.closed, 'socket closed with refresh ACK still racing teardown');
      expect(controller.getSnapshot()).toEqual([]);
      const requestCount = fixture.requests.length;
      const eventCount = events.length;
      await sleep(1250);
      expect(fixture.requests).toHaveLength(requestCount);
      expect(fixture.authRequests()).toHaveLength(2);
      expect(fixture.connections).toHaveLength(1);
      expect(events).toHaveLength(eventCount);
      expect(unhandled.reasons).toEqual([]);
    } finally {
      unhandled.stop();
    }
  }, 7000);

  it('replaces the stale client when explicitly retried while a real refresh command awaits its server ACK', async () => {
    const unhandled = trackUnhandledRejections();
    try {
      fixture.options.ttl = 1;
      fixture.holdRefresh = true;
      await controller.setRooms([ROOM_A]);
      await waitConnected(101);
      await until(() => fixture.pendingRefreshes().length === 1, 'server-held refresh command before retry', 4000);
      expect(fixture.authRequests()).toHaveLength(2);
      const old = fixture.connections[0];
      fixture.options.ttl = null;

      await controller.retry(101);
      await waitConnected(101);
      fixture.releaseRefreshes();
      await until(() => old.closed && fixture.connections.length === 2, 'replacement socket after pending-refresh retry');
      expect(fixture.authRequests()).toHaveLength(3);
      expect(fixture.connections[1].closed).toBe(false);
      expect(controller.getSnapshot()).toEqual([expect.objectContaining({ chatroomId: 101, state: 'connected', attempt: 0 })]);
      const requestCount = fixture.requests.length;
      await sleep(1250);
      expect(fixture.requests).toHaveLength(requestCount);
      expect(fixture.authRequests()).toHaveLength(3);
      expect(fixture.connections).toHaveLength(2);
      expect(latestState(101).state).toBe('connected');
      expect(unhandled.reasons).toEqual([]);
      fixture.publish(PRIMARY_A, MESSAGE_EVENT, { id: 'fixture-after-pending-refresh-retry' });
      await until(() => publications(101).length === 1, 'replacement publication after pending-refresh retry');
    } finally {
      unhandled.stop();
    }
  }, 7000);

  it('single-flights concurrent desired-room updates while the initial token request is pending', async () => {
    const hold = fixture.holdNextRequest(AUTH_PATH);
    const first = controller.setRooms([ROOM_A, ROOM_B]);
    await hold.reached;
    const second = controller.setRooms([ROOM_B, ROOM_A]);
    hold.release();
    await Promise.all([first, second]);
    await Promise.all([waitConnected(101), waitConnected(102)]);
    expect(fixture.authRequests()).toHaveLength(1);
    expect(fixture.connections).toHaveLength(1);
    expect(fixture.commands('subscribe')).toHaveLength(8);
    expect(controller.getSnapshot()).toHaveLength(2);
  });

  it('does not resurrect a removed room when its initial HTTP setup completes late', async () => {
    const hold = fixture.holdNextRequest(AUTH_PATH);
    const stale = controller.setRooms([ROOM_A]);
    await hold.reached;
    const replacement = controller.setRooms([ROOM_B]);
    const removalIndex = events.length;
    hold.release();
    await Promise.all([stale, replacement]);
    await waitConnected(102);
    expect(controller.getSnapshot()).toEqual([expect.objectContaining({ chatroomId: 102, state: 'connected' })]);
    expect(events.slice(removalIndex).some((event) => event.chatroomId === 101 && event.state === 'connected')).toBe(false);
    const active = fixture.connections.filter((connection) => !connection.closed);
    expect(active).toHaveLength(1);
    fixture.publish(PRIMARY_A, MESSAGE_EVENT, { id: 'fixture-stale-setup' }, active[0]);
    fixture.publish(PRIMARY_B, MESSAGE_EVENT, { id: 'fixture-replacement' });
    await until(() => publications(102).length === 1, 'replacement room publication');
    expect(publications(101)).toHaveLength(0);
  });

  it('removes and re-adds one room without losing shared channels or accumulating delivery listeners', async () => {
    await controller.setRooms([ROOM_A, ROOM_B]);
    await Promise.all([waitConnected(101), waitConnected(102)]);
    const connection = fixture.connections[0];
    await controller.setRooms([ROOM_B]);
    await until(() => !connection.subscriptions.has(PRIMARY_A), 'removed primary unsubscribe');
    expect(connection.subscriptions.has('channel.501')).toBe(true);
    expect(connection.subscriptions.has('channel_501')).toBe(true);
    expect(controller.getSnapshot()).toEqual([expect.objectContaining({ chatroomId: 102, state: 'connected' })]);
    fixture.publish(PRIMARY_A, MESSAGE_EVENT, { id: 'fixture-late-removed-room' }, connection);
    fixture.publish('channel.501', 'App\\Events\\StreamerIsLive', { id: 'fixture-shared-after-removal' });
    await until(() => publications(102).length === 1, 'remaining shared-channel owner');
    expect(publications(101)).toHaveLength(0);

    await controller.setRooms([ROOM_A, ROOM_B]);
    await waitConnected(101);
    fixture.publish(PRIMARY_A, MESSAGE_EVENT, { id: 'fixture-readded-room', chatroom_id: 101 });
    fixture.publish('channel.501', 'App\\Events\\StreamerIsLive', { id: 'fixture-shared-after-readd' });
    await until(() => publications(101).length >= 2 && publications(102).length >= 2, 're-added room publications');
    await sleep(40);
    expect(publications(101)).toHaveLength(2);
    expect(publications(102)).toHaveLength(2);
    expect(fixture.connections).toHaveLength(1);
    expect(fixture.commands('subscribe').filter((command) => command.subscribe.channel === PRIMARY_A)).toHaveLength(2);
    expect(fixture.commands('subscribe').filter((command) => command.subscribe.channel === 'channel.501')).toHaveLength(1);
  });

  it('ignores a late primary ACK after removal and can subscribe that room again', async () => {
    fixture.heldChannels.add(PRIMARY_A);
    await controller.setRooms([ROOM_A, ROOM_B]);
    await waitConnected(102);
    await until(() => fixture.connections[0].pending.has(PRIMARY_A), 'held removed-room primary ACK');
    await controller.setRooms([ROOM_B]);
    const removalIndex = events.length;
    fixture.releaseSubscription(PRIMARY_A);
    fixture.publish(PRIMARY_A, MESSAGE_EVENT, { id: 'fixture-after-late-ack' }, fixture.connections[0]);
    await sleep(40);
    expect(events.slice(removalIndex).some((event) => event.chatroomId === 101 && event.state === 'connected')).toBe(false);
    expect(publications(101)).toHaveLength(0);
    expect(latestState(102).state).toBe('connected');
    await controller.setRooms([ROOM_A, ROOM_B]);
    await waitConnected(101);
    fixture.publish(PRIMARY_A, MESSAGE_EVENT, { id: 'fixture-after-ack-readd' });
    await until(() => publications(101).length === 1, 'publication after late ACK and re-add');
    expect(fixture.connections).toHaveLength(1);
  });

  it('closes the final room and cancels token/heartbeat work, then permits a fresh room cycle', async () => {
    fixture.options.ttl = 1;
    fixture.options.ping = 1;
    await controller.setRooms([ROOM_A]);
    await waitConnected(101);
    const old = fixture.connections[0];
    await controller.setRooms([]);
    await until(() => old.closed, 'final room socket teardown');
    expect(controller.getSnapshot()).toEqual([]);
    const requestCount = fixture.requests.length;
    const eventCount = events.length;
    await sleep(1150);
    expect(fixture.requests).toHaveLength(requestCount);
    expect(fixture.connections).toHaveLength(1);
    expect(events).toHaveLength(eventCount);

    fixture.options.ttl = null;
    await controller.setRooms([ROOM_B]);
    await waitConnected(102);
    expect(fixture.connections).toHaveLength(2);
    expect(fixture.connections[1].closed).toBe(false);
    fixture.publish(PRIMARY_B, MESSAGE_EVENT, { id: 'fixture-new-room-cycle' });
    await until(() => publications(102).length === 1, 'new cycle after final room teardown');
  }, 7000);

  it('cancels a scheduled reconnect when the final room is removed', async () => {
    await controller.setRooms([ROOM_A]);
    await waitConnected(101);
    fixture.disconnect(fixture.connections[0]);
    await until(() => latestState(101)?.state === 'reconnecting', 'scheduled room reconnect');
    await controller.setRooms([]);
    await until(() => fixture.connections.every((connection) => connection.closed), 'all reconnect sockets closed');
    const requestCount = fixture.requests.length;
    const connectionCount = fixture.connections.length;
    await sleep(120);
    expect(fixture.requests).toHaveLength(requestCount);
    expect(fixture.connections).toHaveLength(connectionCount);
    expect(controller.getSnapshot()).toEqual([]);
  });

  it('does not let final-room teardown close an immediately re-added replacement', async () => {
    await controller.setRooms([ROOM_A]);
    await waitConnected(101);
    const remove = controller.setRooms([]);
    const readd = controller.setRooms([ROOM_A]);
    await Promise.all([remove, readd]);
    await until(() => fixture.connections.length === 2, 'immediate re-add socket');
    await waitConnected(101);
    await sleep(60);
    expect(fixture.connections[0].closed).toBe(true);
    expect(fixture.connections[1].closed).toBe(false);
    expect(controller.getSnapshot()).toEqual([expect.objectContaining({ chatroomId: 101, state: 'connected' })]);
    fixture.publish(PRIMARY_A, MESSAGE_EVENT, { id: 'fixture-immediate-readd' });
    await until(() => publications(101).length === 1, 'immediate replacement publication');
  });

  it('invalidates pending setup on close without letting its late response destroy a reusable controller', async () => {
    const hold = fixture.holdNextRequest(AUTH_PATH);
    const stale = controller.setRooms([ROOM_A]);
    await hold.reached;
    await controller.close();
    expect(controller.getSnapshot()).toEqual([]);
    const replacement = controller.setRooms([ROOM_B]);
    hold.release();
    await Promise.all([stale, replacement]);
    await waitConnected(102);
    await sleep(60);
    expect(controller.getSnapshot()).toEqual([expect.objectContaining({ chatroomId: 102, state: 'connected' })]);
    expect(fixture.connections.filter((connection) => !connection.closed)).toHaveLength(1);
    fixture.publish(PRIMARY_B, MESSAGE_EVENT, { id: 'fixture-after-close-race' });
    await until(() => publications(102).length === 1, 'publication after close/setup race');
    expect(publications(101)).toHaveLength(0);
  });

  it('shares authenticated global subscriptions across rooms while keeping credentials main-only', async () => {
    session = { token: 'fixture-account-token', session: 'fixture-xsrf', userId: 901 };
    const rooms = [{ ...ROOM_A, livestreamId: 701 }, { ...ROOM_B, livestreamId: 701 }];
    await controller.setRooms(rooms);
    await Promise.all([waitConnected(101), waitConnected(102)]);
    const privateChannels = ['private-userfeed.901', 'private-channelpoints-901', 'private-livestream.701', 'predictions-channel-501'];
    await until(() => privateChannels.every((channel) => fixture.connections[0].subscriptions.has(channel)), 'authenticated global subscriptions');
    for (const channel of privateChannels) {
      expect(fixture.commands('subscribe').filter((command) => command.subscribe.channel === channel)).toHaveLength(1);
    }
    expect(fixture.connections).toHaveLength(1);
    expect(fixture.authRequests()).toHaveLength(1);
    expect(fixture.authRequests()[0].headers).toMatchObject({
      authorization: 'Bearer fixture-account-token', 'x-xsrf-token': 'fixture-xsrf',
    });
    fixture.publish('private-userfeed.901', 'App\\Events\\UserSubscriptionEvent', { id: 'fixture-global-private' });
    await until(() => publications(101).length === 1 && publications(102).length === 1, 'private global room owners');
    await sleep(40);
    expect(publications(101)).toHaveLength(1);
    expect(publications(102)).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain('fixture-account-token');
    expect(JSON.stringify(controller.getSnapshot())).not.toContain('fixture-xsrf');

    await controller.setRooms([{ ...ROOM_B, livestreamId: 701 }]);
    expect(fixture.connections[0].subscriptions.has('private-userfeed.901')).toBe(true);
    fixture.publish('private-userfeed.901', 'App\\Events\\UserSubscriptionEvent', { id: 'fixture-global-remaining-owner' });
    await until(() => publications(102).length === 2, 'remaining authenticated global owner');
    expect(publications(101)).toHaveLength(1);
  });

  it('exposes a private subscription denial without killing primary chat readiness or retrying it indefinitely', async () => {
    session = { token: 'fixture-account-token', session: 'fixture-xsrf', userId: 901 };
    fixture.subscribeErrors.set('private-userfeed.901', { code: 103, message: 'fixture-private-response-marker' });
    await controller.setRooms([ROOM_A, ROOM_B]);
    await Promise.all([waitConnected(101), waitConnected(102)]);
    await until(() => latestState(101)?.reason === 'realtime_private_subscription_denied'
      && latestState(102)?.reason === 'realtime_private_subscription_denied', 'visible private subscription denial');
    for (const roomId of [101, 102]) {
      expect(latestState(roomId)).toMatchObject({ state: 'connected', reason: 'realtime_private_subscription_denied', code: 103 });
    }
    fixture.publish(PRIMARY_A, MESSAGE_EVENT, { id: 'fixture-public-after-private-denial' });
    await until(() => publications(101).length === 1, 'public chat after private denial');
    expect(stateEvents(101).some((event) => event.state === 'failed')).toBe(false);
    expect(stateEvents(102).some((event) => event.state === 'failed')).toBe(false);
    expect(JSON.stringify(events)).not.toContain('fixture-private-response-marker');
    await sleep(120);
    expect(fixture.connections).toHaveLength(1);
    expect(fixture.commands('subscribe').filter((command) => command.subscribe.channel === 'private-userfeed.901')).toHaveLength(1);
  });

  it('authenticates only private channels with their issued permission JWTs under the parent connection JWT', async () => {
    session = { token: 'fixture-account-token', session: 'fixture-xsrf', userId: 901 };
    const privateChannels = ['private-userfeed.901', 'private-channelpoints-901', 'private-livestream.701'];
    await controller.setRooms([{ ...ROOM_A, livestreamId: 701 }, { ...ROOM_B, livestreamId: 701 }]);
    await Promise.all([waitConnected(101), waitConnected(102)]);
    await until(() => [...privateChannels, 'predictions-channel-501'].every((channel) => fixture.connections[0].subscriptions.has(channel)), 'token-authorized private subscriptions');

    expect(fixture.commands('connect')).toHaveLength(1);
    expect(fixture.commands('connect')[0].connect.token).toBe(fixture.connectionTokens[0]);
    expect(fixture.commands('connect')[0].connect.token).not.toBe('fixture-account-token');
    expect(fixture.channelAuthRequests().map((entry) => entry.body.channel).sort()).toEqual([...privateChannels].sort());
    expect(fixture.channelAuthRequests('predictions-channel-501')).toHaveLength(0);
    expect(fixture.channelAuthRequests(PRIMARY_A)).toHaveLength(0);
    for (const entry of fixture.channelAuthRequests()) {
      expect(entry.method).toBe('POST');
      expect(entry.body).toEqual({ channel: entry.body.channel });
      expect(entry.headers).toMatchObject({
        authorization: 'Bearer fixture-account-token', 'x-xsrf-token': 'fixture-xsrf',
      });
    }
    for (const channel of privateChannels) {
      const commands = fixture.commands('subscribe').filter((command) => command.subscribe.channel === channel);
      expect(commands).toHaveLength(1);
      expect(commands[0].subscribe.token).toBe(fixture.latestChannelToken(channel));
      expect(commands[0].subscribe.token).not.toBe(fixture.connectionTokens[0]);
    }
    expect(fixture.commands('subscribe').find((command) => command.subscribe.channel === 'predictions-channel-501').subscribe.token).toBeUndefined();
    expect(fixture.commands('subscribe').find((command) => command.subscribe.channel === PRIMARY_A).subscribe.token).toBeUndefined();

    fixture.publish('private-userfeed.901', 'App\\Events\\UserSubscriptionEvent', { id: 'fixture-own-private-event' });
    fixture.publish('private-livestream.701', 'App\\Events\\LivestreamUpdated', { id: 'fixture-own-livestream-event' });
    await until(() => publications(101).length === 2 && publications(102).length === 2, 'own private events for both room owners');
    const publicBoundary = JSON.stringify({ events, snapshot: controller.getSnapshot() });
    for (const secret of ['fixture-account-token', 'fixture-xsrf', fixture.connectionTokens[0], ...privateChannels.map((channel) => fixture.latestChannelToken(channel))]) {
      expect(publicBoundary).not.toContain(secret);
    }
  });

  it('renews an expiring private channel JWT by sub-refresh without refreshing or changing primary chat state', async () => {
    session = { token: 'fixture-account-token', session: 'fixture-xsrf', userId: 901 };
    const channel = 'private-userfeed.901';
    fixture.subscriptionTtls.set(channel, 1);
    await controller.setRooms([ROOM_A]);
    await waitConnected(101);
    await until(() => fixture.connections[0].subscriptions.has(channel), 'initial private JWT subscription');
    const initialToken = fixture.latestChannelToken(channel);
    const stateCount = stateEvents(101).length;
    expect(fixture.channelAuthRequests(channel)).toHaveLength(1);

    await until(() => fixture.commands('sub_refresh').some((command) => command.sub_refresh.channel === channel), 'private channel sub-refresh', 4000);
    const refresh = fixture.commands('sub_refresh').find((command) => command.sub_refresh.channel === channel);
    expect(fixture.channelAuthRequests(channel)).toHaveLength(2);
    expect(refresh.sub_refresh.token).toBe(fixture.latestChannelToken(channel));
    expect(refresh.sub_refresh.token).not.toBe(initialToken);
    expect(fixture.commands('refresh')).toHaveLength(0);
    expect(fixture.commands('subscribe').filter((command) => command.subscribe.channel === channel)).toHaveLength(1);
    expect(fixture.commands('unsubscribe').filter((command) => command.unsubscribe.channel === channel)).toHaveLength(0);
    expect(fixture.connections).toHaveLength(1);
    expect(stateEvents(101)).toHaveLength(stateCount);
    expect(latestState(101)).toMatchObject({ state: 'connected', attempt: 0 });
    expect(latestState(101).reason).toBeUndefined();

    fixture.publish(channel, 'App\\Events\\UserSubscriptionEvent', { id: 'fixture-private-after-subrefresh' });
    fixture.publish(PRIMARY_A, MESSAGE_EVENT, { id: 'fixture-chat-after-subrefresh' });
    await until(() => publications(101).length === 2, 'private and chat publications after sub-refresh');
    expect(JSON.stringify(events)).not.toContain('fixture-channel-jwt-');
  }, 7000);

  it.each(['sub-refresh ACK', 'channel-token HTTP'])('recovers five independent private renewal failures at %s separated by fresh readiness and successful sub-refresh ACKs', async (failure) => {
    session = { token: 'fixture-account-token', session: 'fixture-xsrf', userId: 901 };
    const channel = 'private-userfeed.901';
    fixture.subscriptionTtls.set(channel, 0.02);
    fixture.heldSubRefreshChannels.add(channel);
    let failNextRenewal = false;
    fixture.httpHandler = (request) => {
      if (failNextRenewal && request.path === CHANNEL_AUTH_PATH && request.body?.channel === channel) {
        failNextRenewal = false;
        return { status: 503, body: { error: 'fixture temporary renewal failure' } };
      }
    };
    await controller.setRooms([ROOM_A]);
    await waitConnected(101);
    const subscribeCommands = () => fixture.commands('subscribe').filter((command) => command.subscribe.channel === channel);
    const stateCount = stateEvents(101).length;
    for (let episode = 1; episode <= 5; episode++) {
      await until(() => fixture.pendingSubRefreshes(channel).length === 1, `private renewal episode ${episode}`);
      if (episode === 5) fixture.subscriptionTtls.delete(channel);
      if (failure === 'channel-token HTTP') {
        failNextRenewal = true;
        fixture.releaseSubRefresh(channel, { sub_refresh: { expires: true, ttl: 0.02 } });
      } else {
        fixture.releaseSubRefresh(channel, { error: { code: 7, message: 'fixture temporary renewal failure', temporary: true } });
      }
      await until(() => subscribeCommands().length === episode + 1 && fixture.connections[0].subscriptions.has(channel),
        `fresh private subscription ACK for episode ${episode}`);
      fixture.publish(channel, 'App\\Events\\UserSubscriptionEvent', { id: `fixture-private-episode-${episode}` });
      fixture.publish(PRIMARY_A, MESSAGE_EVENT, { id: `fixture-chat-episode-${episode}` });
      await until(() => publications(101).length === episode * 2, `private and public delivery for episode ${episode}`);
      expect(latestState(101).reason).toBeUndefined();
      if (failure === 'sub-refresh ACK' && episode < 5) {
        await until(() => fixture.pendingSubRefreshes(channel).length === 1, `healthy renewal after episode ${episode}`);
        fixture.releaseSubRefresh(channel, { sub_refresh: { expires: true, ttl: 0.02 } });
      }
    }
    expect(subscribeCommands()).toHaveLength(6);
    expect(fixture.commands('sub_refresh').filter((command) => command.sub_refresh.channel === channel))
      .toHaveLength(failure === 'sub-refresh ACK' ? 9 : 5);
    expect(fixture.commands('unsubscribe').filter((command) => command.unsubscribe.channel === channel)).toHaveLength(5);
    expect(fixture.connections).toHaveLength(1);
    expect(fixture.authRequests()).toHaveLength(1);
    expect(stateEvents(101)).toHaveLength(stateCount);
    expect(controller.getSnapshot()).toEqual([expect.objectContaining({ chatroomId: 101, state: 'connected', attempt: 0 })]);
  });

  it.each(['subscription ACK', 'channel-token HTTP'])('bounds a private renewal episode when recovery keeps failing at %s', async (failure) => {
    session = { token: 'fixture-account-token', session: 'fixture-xsrf', userId: 901 };
    const channel = 'private-userfeed.901';
    fixture.subscriptionTtls.set(channel, 0.02);
    fixture.heldSubRefreshChannels.add(channel);
    await controller.setRooms([ROOM_A]);
    await waitConnected(101);
    await until(() => fixture.pendingSubRefreshes(channel).length === 1, 'first private renewal');
    if (failure === 'subscription ACK') {
      fixture.subscribeErrors.set(channel, { code: 7, message: 'fixture recovery failure', temporary: true });
    } else {
      fixture.channelAuthStatuses.set(channel, 503);
    }
    fixture.releaseSubRefresh(channel, { error: { code: 7, message: 'fixture renewal failure', temporary: true } });
    await until(() => latestState(101)?.reason === 'realtime_private_subscription_denied', 'bounded private recovery exhaustion');
    const subscribes = () => fixture.commands('subscribe').filter((command) => command.subscribe.channel === channel);
    expect(subscribes()).toHaveLength(failure === 'subscription ACK' ? 3 : 1);
    expect(fixture.channelAuthRequests(channel)).toHaveLength(failure === 'subscription ACK' ? 3 : 4);
    expect(fixture.connections[0].subscriptions.has(channel)).toBe(false);
    expect(latestState(101)).toMatchObject({ state: 'connected', attempt: 0 });
    fixture.publish(PRIMARY_A, MESSAGE_EVENT, { id: 'fixture-chat-after-private-recovery-exhaustion' });
    fixture.publish('private-channelpoints-901', 'App\\Events\\ChannelPointsUpdated', { id: 'fixture-points-after-private-recovery-exhaustion' });
    await until(() => publications(101).length === 2, 'unaffected public and other private subscriptions');
    const requestCount = fixture.channelAuthRequests(channel).length;
    const subscribeCount = subscribes().length;
    await sleep(120);
    expect(fixture.channelAuthRequests(channel)).toHaveLength(requestCount);
    expect(subscribes()).toHaveLength(subscribeCount);
    expect(fixture.connections).toHaveLength(1);
    expect(fixture.authRequests()).toHaveLength(1);
  });

  it.each(['remaining room', 'last room teardown'])('keeps recovery-token ownership safe during %s', async (destination) => {
    const unhandled = trackUnhandledRejections();
    try {
      session = { token: 'fixture-account-token', session: 'fixture-xsrf', userId: 901 };
      const channel = 'private-userfeed.901';
      fixture.subscriptionTtls.set(channel, 0.02);
      fixture.heldSubRefreshChannels.add(channel);
      await controller.setRooms([ROOM_A]);
      await waitConnected(101);
      await until(() => fixture.pendingSubRefreshes(channel).length === 1, 'private renewal before recovery ownership change');
      fixture.subscriptionTtls.delete(channel);
      const hold = fixture.holdNextChannelAuth(channel);
      fixture.releaseSubRefresh(channel, { error: { code: 7, message: 'fixture renewal failure', temporary: true } });
      await hold.reached;
      await controller.setRooms(destination === 'remaining room' ? [ROOM_B] : []);
      hold.release();
      if (destination === 'remaining room') {
        await waitConnected(102);
        await until(() => fixture.connections[0].subscriptions.has(channel), 'private recovery ACK for remaining owner');
        fixture.publish(channel, 'App\\Events\\UserSubscriptionEvent', { id: 'fixture-recovery-remaining-owner' });
        await until(() => publications(102).length === 1, 'private recovery delivery to new owner');
        expect(publications(101)).toHaveLength(0);
        expect(fixture.commands('subscribe').filter((command) => command.subscribe.channel === channel)).toHaveLength(2);
        expect(latestState(102).reason).toBeUndefined();
      } else {
        await until(() => fixture.connections[0].closed, 'last-owner teardown during recovery');
        await sleep(100);
        expect(fixture.commands('subscribe').filter((command) => command.subscribe.channel === channel)).toHaveLength(1);
        expect(controller.getSnapshot()).toEqual([]);
      }
      const requestCount = fixture.channelAuthRequests(channel).length;
      await sleep(100);
      expect(fixture.channelAuthRequests(channel)).toHaveLength(requestCount);
      expect(unhandled.reasons).toEqual([]);
    } finally {
      unhandled.stop();
    }
  });

  it.each([401, 403, 404])('turns private channel-token HTTP %i into a terminal warning while public chat continues', async (status) => {
    session = { token: 'fixture-account-token', session: 'fixture-xsrf', userId: 901 };
    const deniedChannel = 'private-userfeed.901';
    fixture.channelAuthStatuses.set(deniedChannel, status);
    await controller.setRooms([ROOM_A, ROOM_B]);
    await Promise.all([waitConnected(101), waitConnected(102)]);
    await until(() => latestState(101)?.reason === 'realtime_private_subscription_denied'
      && latestState(102)?.reason === 'realtime_private_subscription_denied', 'terminal private channel-token denial');
    for (const roomId of [101, 102]) {
      expect(latestState(roomId)).toMatchObject({
        state: 'connected', attempt: 0, reason: 'realtime_private_subscription_denied', code: 1,
      });
      expect(stateEvents(roomId).some((event) => event.state === 'failed')).toBe(false);
    }
    expect(fixture.channelAuthRequests(deniedChannel)).toEqual([
      expect.objectContaining({
        method: 'POST',
        body: { channel: deniedChannel },
        headers: expect.objectContaining({ authorization: 'Bearer fixture-account-token', 'x-xsrf-token': 'fixture-xsrf' }),
      }),
    ]);
    expect(fixture.commands('subscribe').filter((command) => command.subscribe.channel === deniedChannel)).toHaveLength(0);
    await until(() => fixture.connections[0].subscriptions.has('private-channelpoints-901'), 'other private subscription after denial');
    fixture.publish(PRIMARY_A, MESSAGE_EVENT, { id: 'fixture-chat-after-channel-token-denial' });
    fixture.publish('private-channelpoints-901', 'App\\Events\\ChannelPointsUpdated', { id: 'fixture-points-after-channel-token-denial' });
    await until(() => publications(101).length === 2 && publications(102).length === 1, 'public and surviving private publications after denial');
    expect(JSON.stringify(events)).not.toContain('fixture-private-response-marker');
    expect(JSON.stringify(events)).not.toContain('fixture-channel-jwt-');
    await sleep(150);
    expect(fixture.channelAuthRequests(deniedChannel)).toHaveLength(1);
    expect(fixture.commands('subscribe').filter((command) => command.subscribe.channel === deniedChannel)).toHaveLength(0);
    expect(fixture.connections).toHaveLength(1);
  });

  it('clears only the departing owner warning when one room leaves a shared denied private livestream', async () => {
    session = { token: 'fixture-account-token', session: 'fixture-xsrf', userId: 901 };
    const deniedChannel = 'private-livestream.77';
    const allowedChannel = 'private-livestream.78';
    const roomB = { ...ROOM_B, livestreamId: 77 };
    fixture.channelAuthStatuses.set(deniedChannel, 404);
    await controller.setRooms([{ ...ROOM_A, livestreamId: 77 }, roomB]);
    await Promise.all([waitConnected(101), waitConnected(102)]);
    await until(() => latestState(101)?.reason === 'realtime_private_subscription_denied'
      && latestState(102)?.reason === 'realtime_private_subscription_denied', 'shared denied livestream warning');
    for (const roomId of [101, 102]) {
      expect(latestState(roomId)).toMatchObject({
        state: 'connected', attempt: 0, reason: 'realtime_private_subscription_denied', code: 1,
      });
    }
    expect(fixture.channelAuthRequests(deniedChannel)).toHaveLength(1);
    expect(fixture.commands('subscribe').filter((command) => command.subscribe.channel === deniedChannel)).toHaveLength(0);
    const roomAStateCount = stateEvents(101).length;

    await controller.setRooms([{ ...ROOM_A, livestreamId: 78 }, roomB]);
    await until(() => latestState(101)?.state === 'connected' && latestState(101).reason === undefined,
      'departing owner warning cleared');
    await until(() => fixture.connections[0].subscriptions.has(allowedChannel), 'replacement private livestream subscription');
    expect(stateEvents(101).length).toBeGreaterThan(roomAStateCount);
    expect(latestState(101)).toEqual({ kind: 'state', chatroomId: 101, state: 'connected', attempt: 0 });
    expect(controller.getSnapshot()).toEqual([
      { kind: 'state', chatroomId: 101, state: 'connected', attempt: 0 },
      {
        kind: 'state', chatroomId: 102, state: 'connected', attempt: 0,
        reason: 'realtime_private_subscription_denied', code: 1,
      },
    ]);
    expect(latestState(102)).toMatchObject({
      state: 'connected', attempt: 0, reason: 'realtime_private_subscription_denied', code: 1,
    });
    expect(fixture.channelAuthRequests(deniedChannel)).toHaveLength(1);
    expect(fixture.channelAuthRequests(allowedChannel)).toHaveLength(1);
    expect(fixture.commands('subscribe').filter((command) => command.subscribe.channel === deniedChannel)).toHaveLength(0);
    expect(fixture.commands('subscribe').filter((command) => command.subscribe.channel === allowedChannel)).toEqual([
      expect.objectContaining({ subscribe: expect.objectContaining({ token: fixture.latestChannelToken(allowedChannel) }) }),
    ]);
    expect(fixture.connections).toHaveLength(1);

    fixture.publish(deniedChannel, 'App\\Events\\LivestreamUpdated', { id: 'fixture-stale-denied-livestream' }, fixture.connections[0]);
    fixture.publish(allowedChannel, 'App\\Events\\LivestreamUpdated', { id: 'fixture-replacement-livestream' });
    await until(() => publications(101).length === 1, 'replacement livestream publication');
    await sleep(40);
    expect(publications(101)).toEqual([
      expect.objectContaining({ channel: allowedChannel, data: JSON.stringify({ id: 'fixture-replacement-livestream' }) }),
    ]);
    expect(publications(102).some((event) => event.channel === allowedChannel)).toBe(false);
    expect(latestState(102)).toMatchObject({ reason: 'realtime_private_subscription_denied', code: 1 });
  });

  it('does not resubscribe or leak a private JWT when room ownership changes during pending channel-token responses', async () => {
    const unhandled = trackUnhandledRejections();
    try {
      session = { token: 'fixture-account-token', session: 'fixture-xsrf', userId: 901 };
      const userfeed = 'private-userfeed.901';
      const channelPoints = 'private-channelpoints-901';
      const userfeedHold = fixture.holdNextChannelAuth(userfeed);
      const channelPointsHold = fixture.holdNextChannelAuth(channelPoints);
      await controller.setRooms([ROOM_A]);
      await Promise.all([userfeedHold.reached, channelPointsHold.reached]);
      await waitConnected(101);
      await controller.setRooms([ROOM_A, ROOM_B]);
      await waitConnected(102);
      expect(fixture.channelAuthRequests(userfeed)).toHaveLength(1);
      expect(fixture.channelAuthRequests(channelPoints)).toHaveLength(1);
      expect(fixture.commands('subscribe').filter((command) => [userfeed, channelPoints].includes(command.subscribe.channel))).toHaveLength(0);

      await controller.setRooms([ROOM_B]);
      userfeedHold.release();
      await until(() => fixture.connections[0].subscriptions.has(userfeed), 'shared private subscription for remaining owner');
      expect(fixture.commands('subscribe').filter((command) => command.subscribe.channel === userfeed)).toEqual([
        expect.objectContaining({ subscribe: expect.objectContaining({ token: fixture.latestChannelToken(userfeed) }) }),
      ]);
      fixture.publish(userfeed, 'App\\Events\\UserSubscriptionEvent', { id: 'fixture-private-after-owner-removal' });
      await until(() => publications(102).length === 1, 'remaining owner private publication');
      expect(publications(101)).toHaveLength(0);

      const connection = fixture.connections[0];
      await controller.setRooms([]);
      channelPointsHold.release();
      await until(() => connection.closed, 'final teardown during pending private token response');
      await until(() => fixture.latestChannelToken(channelPoints), 'late private token reaches fixture response stage');
      await sleep(100);
      expect(fixture.commands('subscribe').filter((command) => command.subscribe.channel === channelPoints)).toHaveLength(0);
      expect(controller.getSnapshot()).toEqual([]);
      const requestCount = fixture.requests.length;
      await sleep(100);
      expect(fixture.requests).toHaveLength(requestCount);
      expect(fixture.connections).toHaveLength(1);
      expect(unhandled.reasons).toEqual([]);
      const publicBoundary = JSON.stringify(events);
      for (const secret of ['fixture-account-token', 'fixture-xsrf', fixture.latestChannelToken(userfeed), fixture.latestChannelToken(channelPoints)]) {
        expect(publicBoundary).not.toContain(secret);
      }
    } finally {
      unhandled.stop();
    }
  });

  it('bounds transient gateway discovery failures before creating any physical connection', async () => {
    fixture.options.discoveryStatus = 503;
    await controller.setRooms([ROOM_A]);
    await until(() => latestState(101)?.state === 'failed', 'exhausted discovery retry budget');
    const discoveries = () => fixture.requests.filter((entry) => entry.path === '/api/v1/realtime/connection');
    expect(discoveries()).toHaveLength(3);
    expect(new Set(discoveries().map((entry) => entry.body.client.id)).size).toBe(1);
    expect(latestState(101)).toMatchObject({ state: 'failed', attempt: 3, code: 503 });
    expect(fixture.authRequests()).toHaveLength(0);
    expect(fixture.connections).toHaveLength(0);
    expect(JSON.stringify(events)).not.toContain('fixture-private-response-marker');
    await sleep(120);
    expect(discoveries()).toHaveLength(3);
  });

  it.each([
    'ws://outside.invalid/connection/websocket',
    'wss://outside.invalid/connection/websocket',
    'wss://realtime.platform.kick.com/wrong-path',
    'wss://fixture-user:fixture-pass@realtime.platform.kick.com/connection/websocket',
  ])('rejects an unsafe discovered gateway without performing outbound traffic (%s)', async (url) => {
    fixture.httpHandler = (entry) => entry.path === '/api/v1/realtime/connection'
      ? { status: 200, body: { data: { mode: 'websocket', connections: [{ provider: 'centrifugo', credentials: { url } }] } } }
      : undefined;
    await controller.setRooms([ROOM_A]);
    await until(() => latestState(101)?.state === 'failed', 'unsafe gateway validation');
    expect(fixture.requests).toHaveLength(1);
    expect(fixture.authRequests()).toHaveLength(0);
    expect(fixture.connections).toHaveLength(0);
    expect(JSON.stringify(events)).not.toContain(url);
    expect(JSON.stringify(events)).not.toContain('fixture-pass');
    await sleep(120);
    expect(fixture.requests).toHaveLength(1);
  });
});
