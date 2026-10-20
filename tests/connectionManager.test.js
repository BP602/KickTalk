// @vitest-environment node
import { trace } from '@opentelemetry/api';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import ConnectionManager from '../utils/services/connectionManager.js';

if (typeof globalThis.CustomEvent !== 'function') {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, init = {}) {
      super(type);
      this.detail = init.detail;
    }
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

const room = (id, channel7TVEmotes = []) => ({
  id,
  channel7TVEmotes,
  streamerData: {
    id: 500 + id,
    user_id: 1000 + id,
    slug: `streamer-${id}`,
    user: { username: `streamer-${id}` },
  },
});

const channelEmotes = (id) => [{
  type: 'channel',
  user: { id: `stv-user-${id}` },
  setInfo: { id: `stv-set-${id}` },
  emotes: [{ id: `emote-${id}`, name: `ChannelEmote${id}` }],
}];

// The only transport replacement is the browser's public WebSocket boundary.
// All subscriptions, message decoding and room routing use SharedStvWebSocket.
class SocketFixture {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = SocketFixture.CONNECTING;
    this.sent = [];
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    SocketFixture.instances.push(this);
  }

  send(data) {
    this.sent.push(JSON.parse(data));
  }

  open() {
    this.readyState = SocketFixture.OPEN;
    return this.onopen?.();
  }

  receive(type, body) {
    this.onmessage?.({ data: JSON.stringify({ op: 0, d: { type, body } }) });
  }

  close() {
    this.readyState = SocketFixture.CLOSED;
    this.onclose?.({ code: 1000, reason: '', wasClean: true });
  }
}

function createApp() {
  const realtime = {
    onEvent: vi.fn(() => () => {}),
    setRooms: vi.fn(async () => []),
  };
  return {
    kick: {
      realtime,
      initialLoad: {
        channelEmotes: vi.fn(async (slug) => ({ ok: true, value: [{ name: `KickEmote-${slug}` }] })),
        channel7tvEmotes: vi.fn(async (userId) => ({ ok: true, value: channelEmotes(userId - 1000) })),
        messages: vi.fn(async () => ({ ok: true, value: { data: { data: { messages: [{ id: 'initial-message' }] } } } })),
        chatroomInfo: vi.fn(async (slug) => ({ ok: true, value: { chatroom: { slug } } })),
        selfChatroomInfo: vi.fn(async () => ({ ok: true, value: { data: { is_subscribed: false } } })),
        pollInfo: vi.fn(async () => ({ ok: true, value: { data: { status: { code: 404 } } } })),
      },
    },
  };
}

let manager;
let app;
let callbacks;
let events;

beforeEach(() => {
  vi.useFakeTimers();
  SocketFixture.instances = [];
  vi.stubGlobal('WebSocket', SocketFixture);
  app = createApp();
  vi.stubGlobal('window', { app });
  callbacks = {
    setKickEmotes: vi.fn(),
    updateChannel7TVEmotes: vi.fn(),
    addInitialChatroomMessages: vi.fn(),
    setInitialChatroomInfo: vi.fn(),
    setUserChatroomInfo: vi.fn(),
    handlePollDelete: vi.fn(),
  };
  events = [];
  manager = new ConnectionManager();
});

afterEach(() => {
  manager.cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function initialize(rooms) {
  await manager.initializeConnections(rooms, {
    onStvMessage: (event) => events.push(event.detail),
  }, callbacks);
  const socket = SocketFixture.instances[0];
  const opening = socket.open();
  await vi.advanceTimersByTimeAsync(1000);
  await opening;
  return socket;
}

function expectChannelEvent(socket, id) {
  const body = { id: `stv-set-${id}`, kind: 1, pushed: [] };
  socket.receive('emote_set.update', body);
  expect(events.at(-1)).toEqual({
    type: 'emote_set.update',
    body,
    chatroomId: id,
    isPersonalEmoteSet: false,
  });
}

describe('ConnectionManager concurrent 7TV hydration', () => {
  it('keeps warm channel routing after remove/readd when Kick IPC resolves after cached provider hydration', async () => {
    const socket = await initialize([room(1), room(2)]);
    expectChannelEvent(socket, 2);
    expect(socket.sent).toContainEqual(expect.objectContaining({
      op: 35,
      d: { type: 'emote_set.*', condition: { object_id: 'stv-set-2' } },
    }));

    await manager.removeChatroom(2);
    expect(socket.readyState).toBe(SocketFixture.OPEN);
    expect(manager.getConnectionStatus().stv.chatrooms).toBe(1);
    const kickFetches = app.kick.initialLoad.channelEmotes.mock.calls.length;
    const stvFetches = app.kick.initialLoad.channel7tvEmotes.mock.calls.length;
    app.kick.initialLoad.messages.mockClear();
    const pending = deferred();
    app.kick.realtime.setRooms.mockImplementationOnce(() => pending.promise);
    const readdedRoom = room(2); // The provider adds a new object with no 7TV sets.
    const adding = manager.addChatroom(readdedRoom);
    const hydrating = manager.fetchChatroomEmotes(readdedRoom);
    await hydrating;

    expect(app.kick.initialLoad.channelEmotes).toHaveBeenCalledTimes(kickFetches);
    expect(app.kick.initialLoad.channel7tvEmotes).toHaveBeenCalledTimes(stvFetches);
    expect(app.kick.initialLoad.messages).not.toHaveBeenCalled();
    expectChannelEvent(socket, 2);

    pending.resolve([]);
    await adding;
    expectChannelEvent(socket, 2);
    expectChannelEvent(socket, 1);
    expect(manager.getConnectionStatus().stv.chatrooms).toBe(2);
  });

  it('registers provided 7TV IDs without waiting for Kick IPC while keeping initial fetches behind it', async () => {
    const socket = await initialize([room(1)]);
    app.kick.initialLoad.messages.mockClear();
    const pending = deferred();
    app.kick.realtime.setRooms.mockImplementationOnce(() => pending.promise);
    const adding = manager.addChatroom(room(2, channelEmotes(2)));

    expectChannelEvent(socket, 2);
    expect(app.kick.initialLoad.messages).not.toHaveBeenCalled();

    pending.resolve([]);
    await adding;
    expectChannelEvent(socket, 2);
  });

  it.each(['remove', 'cleanup'])('does not restore a room after %s while its Kick registration is pending', async (action) => {
    const socket = await initialize([room(1)]);
    app.kick.initialLoad.messages.mockClear();
    const pending = deferred();
    app.kick.realtime.setRooms.mockImplementationOnce(() => pending.promise);
    const adding = manager.addChatroom(room(2, channelEmotes(2)));

    if (action === 'remove') {
      await manager.removeChatroom(2);
    } else {
      manager.cleanup();
    }
    const callsAfterRemoval = app.kick.realtime.setRooms.mock.calls.length;
    pending.resolve([]);
    await adding;

    expect(app.kick.initialLoad.messages).not.toHaveBeenCalled();
    expect(app.kick.realtime.setRooms).toHaveBeenCalledTimes(callsAfterRemoval);
    if (action === 'remove') {
      expect(manager.getConnectionStatus().stv.chatrooms).toBe(1);
      socket.receive('emote_set.update', { id: 'stv-set-2', kind: 1 });
      expect(events.at(-1)).toMatchObject({ chatroomId: null, isPersonalEmoteSet: true });
    } else {
      expect(socket.readyState).toBe(SocketFixture.CLOSED);
    }
  });
});

describe('ConnectionManager room-load stage telemetry', () => {
  let traceProvider;
  let spanExporter;

  beforeAll(() => {
    spanExporter = new InMemorySpanExporter();
    traceProvider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(spanExporter)],
    });
    trace.setGlobalTracerProvider(traceProvider);
  });

  afterAll(async () => {
    await traceProvider.shutdown();
    trace.disable();
  });

  beforeEach(() => {
    spanExporter.reset();
    manager.storeCallbacks = callbacks;
  });

  const addChatroomSpan = () => spanExporter.getFinishedSpans()
    .find((span) => span.name === 'connection_manager.add_chatroom');

  it('defers the initialize trace until enabled renderer tracing is ready and parents every phase', async () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => JSON.stringify({ telemetry: { enabled: true } })) });
    let completed = false;
    const initializing = manager.initializeConnections([room(1)], {}, callbacks).then(() => { completed = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(completed).toBe(false);
    expect(spanExporter.getFinishedSpans().some((span) => span.name === 'connection_manager.initialize')).toBe(false);
    expect(app.kick.initialLoad.messages).not.toHaveBeenCalled();
    window.__KT_TRACER__ = {};
    await vi.advanceTimersByTimeAsync(25);
    await initializing;
    const spans = spanExporter.getFinishedSpans();
    const root = spans.find((span) => span.name === 'connection_manager.initialize');
    const batches = spans.find((span) => span.name === 'connection_manager.chatroom_batches');
    expect(batches.parentSpanContext.spanId).toBe(root.spanContext().spanId);
    for (const name of ['connection_manager.chatroom_batches', 'connection_manager.chatroom_batch_1', 'connection_manager.add_chatroom', 'connection_manager.batch_emote_fetch']) {
      expect(spans.find((span) => span.name === name).spanContext().traceId).toBe(root.spanContext().traceId);
    }
    const nanos = ([seconds, fraction]) => seconds * 1e9 + fraction;
    expect(nanos(root.startTime)).toBeLessThanOrEqual(nanos(batches.startTime));
    expect(nanos(root.events.find((event) => event.name === 'setup_event_handlers_complete').time))
      .toBeLessThanOrEqual(nanos(batches.startTime));
    expect(root.attributes['chatroom.success_count']).toBe(1);
    expect(root.status.code).toBe(1);
  });

  it('bounds enabled tracer readiness to one second when the renderer tracer never arrives', async () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => JSON.stringify({ telemetry: { enabled: true } })) });
    let completed = false;
    const initializing = manager.initializeConnections([room(1)], {}, callbacks).then(() => { completed = true; });
    await vi.advanceTimersByTimeAsync(999);
    expect(completed).toBe(false);
    expect(app.kick.initialLoad.messages).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await initializing;
    expect(completed).toBe(true);
    expect(app.kick.initialLoad.messages).toHaveBeenCalledTimes(1);
    expect(window.__KT_TRACER__).toBeUndefined();
  });

  it.each([null, '{}', '{"telemetry":{"enabled":false}}', 'invalid settings'])('does not wait for a tracer when telemetry settings are %s', async (settings) => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => settings) });
    let completed = false;
    const initializing = manager.initializeConnections([room(1)], {}, callbacks).then(() => { completed = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(completed).toBe(true);
    expect(window.__KT_TRACER__).toBeUndefined();
    await initializing;
  });

  it('creates and ends the deferred initialize span when registration rejects before readiness', async () => {
    app.kick.realtime.onEvent.mockImplementationOnce(() => { throw new Error('registration setup failed'); });
    await expect(manager.initializeConnections([room(1)], {}, callbacks)).rejects.toThrow('registration setup failed');
    const span = spanExporter.getFinishedSpans().find((entry) => entry.name === 'connection_manager.initialize');
    expect(span.attributes).toMatchObject({ 'chatroom.count': 1, 'connection.type': 'shared_pooled', 'batch.size': 3 });
    expect(span.events.map((event) => event.name)).toEqual(expect.arrayContaining([
      'initialization_started', 'setup_event_handlers_start', 'setup_event_handlers_complete', 'exception',
    ]));
    expect(span.status).toMatchObject({ code: 2, message: 'registration setup failed' });
    expect(manager.initializationInProgress).toBe(false);
  });

  it('creates and ends the deferred initialize span after cleanup during registration', async () => {
    const pending = deferred();
    app.kick.realtime.setRooms.mockImplementationOnce(() => pending.promise);
    const initializing = manager.initializeConnections([room(1)], {}, callbacks);
    manager.cleanup();
    pending.resolve([]);
    await initializing;
    const spans = spanExporter.getFinishedSpans().filter((entry) => entry.name === 'connection_manager.initialize');
    expect(spans).toHaveLength(1);
    expect(spans[0].events.map((event) => event.name)).toContain('setup_event_handlers_complete');
    expect(app.kick.initialLoad.messages).not.toHaveBeenCalled();
    expect(manager.initializationInProgress).toBe(false);
  });

  it('preserves the running initialization when a duplicate call ends its own deferred span', async () => {
    const pending = deferred();
    app.kick.realtime.setRooms.mockImplementationOnce(() => pending.promise);
    const initializing = manager.initializeConnections([room(1)], {}, callbacks);
    await manager.initializeConnections([], {}, callbacks);
    expect(manager.initializationInProgress).toBe(true);
    const duplicate = spanExporter.getFinishedSpans().find((entry) => entry.name === 'connection_manager.initialize');
    expect(duplicate.attributes['chatroom.count']).toBe(0);
    expect(duplicate.events.map((event) => event.name)).toEqual(['initialization_already_in_progress']);
    pending.resolve([]);
    await initializing;
    expect(manager.initializationInProgress).toBe(false);
  });

  it('preserves public emote helper values, caches and callbacks across provider failures', async () => {
    const activeRoom = room(1);
    manager.chatrooms.set('1', activeRoom);
    const kickValue = [{ name: 'SyntheticKick' }];
    const stvValue = channelEmotes(1);
    app.kick.initialLoad.channelEmotes.mockResolvedValueOnce({ ok: true, value: kickValue });
    app.kick.initialLoad.channel7tvEmotes.mockResolvedValueOnce({ ok: true, value: stvValue });
    await expect(manager.fetchChatroomEmotes(activeRoom)).resolves.toBe(kickValue);
    await expect(manager.fetchChannel7TVEmotes(activeRoom)).resolves.toBe(stvValue);
    await expect(manager.fetchChatroomEmotes(activeRoom)).resolves.toBe(kickValue);
    expect(app.kick.initialLoad.channelEmotes).toHaveBeenCalledTimes(1);
    expect(app.kick.initialLoad.channel7tvEmotes).toHaveBeenCalledTimes(1);
    expect(callbacks.setKickEmotes).toHaveBeenCalledWith(1, kickValue);
    expect(callbacks.updateChannel7TVEmotes).toHaveBeenCalledWith(1, stvValue);
    await expect(manager.fetchChatroomEmotes(room(99))).resolves.toBeNull();
    const otherRoom = room(2);
    manager.chatrooms.set('2', otherRoom);
    app.kick.initialLoad.channelEmotes.mockResolvedValueOnce({ ok: true, value: kickValue });
    app.kick.initialLoad.channel7tvEmotes.mockResolvedValueOnce({ ok: false, failure: { type: 'timeout' } });
    await expect(manager.fetchChatroomEmotes(otherRoom)).resolves.toBe(kickValue);
    expect(callbacks.setKickEmotes).toHaveBeenCalledWith(2, kickValue);
    const failedRoom = room(3);
    manager.chatrooms.set('3', failedRoom);
    app.kick.initialLoad.channelEmotes.mockResolvedValueOnce({ ok: false, failure: { type: 'request_failed' } });
    await expect(manager.fetchChatroomEmotes(failedRoom)).resolves.toBeNull();
    expect(app.kick.initialLoad.channel7tvEmotes).toHaveBeenCalledTimes(2);
  });

  it.each(['kick', '7tv'])('correlates %s emote failure without changing the ready room outcome', async (provider) => {
    const bridge = provider === 'kick' ? 'channelEmotes' : 'channel7tvEmotes';
    app.kick.initialLoad[bridge].mockResolvedValueOnce({ ok: false, failure: { type: 'http_error', status: 503 } });
    await manager.initializeConnections([room(1), room(2)], {}, callbacks);
    const spans = spanExporter.getFinishedSpans();
    const initializeSpan = spans.find((span) => span.name === 'connection_manager.initialize');
    const roomSpan = spans.find((span) => span.name === 'connection_manager.add_chatroom' && span.attributes['chatroom.id'] === 1);
    const kickSpan = spans.find((span) => span.name === 'connection_manager.fetch_chatroom_emotes' && span.attributes['chatroom.id'] === 1);
    const failureSpan = provider === 'kick' ? kickSpan : spans.find((span) =>
      span.name === 'connection_manager.fetch_channel_7tv_emotes' && span.attributes['chatroom.id'] === 1);
    const stage = provider === 'kick' ? 'initial_emotes' : 'initial_emotes_7tv';
    expect(failureSpan.attributes[`room_load.stage.${stage}`]).toBe('failed');
    expect(failureSpan.events.find((event) => event.name === 'room_load_stage_failed').attributes).toMatchObject({
      'room_load.stage': stage, 'error.type': 'http_error', 'http.response.status_code': 503,
    });
    expect(kickSpan.spanContext().traceId).toBe(initializeSpan.spanContext().traceId);
    expect(kickSpan.links[0].context.spanId).toBe(roomSpan.spanContext().spanId);
    expect(roomSpan.attributes['room_load.outcome']).toBe('ready');
    expect(initializeSpan.attributes['chatroom.emote_failure_count']).toBe(1);
    expect(initializeSpan.status).toMatchObject({ code: 2, message: 'chatroom_emotes_partial' });
    const batch = spans.find((span) => span.name === 'connection_manager.emote_batch_1');
    const outer = spans.find((span) => span.name === 'connection_manager.batch_emote_fetch');
    expect(batch.attributes).toMatchObject({ 'emote.batch.success_count': 1, 'emote.batch.failure_count': 1, 'emote.batch.cancelled_count': 0 });
    expect(outer.attributes).toMatchObject({ 'emote.success_count': 1, 'emote.failure_count': 1, 'emote.cancelled_count': 0 });
    expect(batch.status.code).toBe(2);
    expect(outer.status.code).toBe(2);
    for (const span of spans.filter((entry) => /emote/.test(entry.name))) {
      expect(span.spanContext().traceId).toBe(initializeSpan.spanContext().traceId);
    }
  });

  it('counts a room removed before emote work as cancelled rather than successful', async () => {
    const pending = deferred();
    const started = deferred();
    app.kick.initialLoad.messages.mockImplementationOnce(() => {
      started.resolve();
      return pending.promise;
    });
    const initializing = manager.initializeConnections([room(1)], {}, callbacks);
    await started.promise;
    await manager.removeChatroom(1);
    pending.resolve({ ok: true, value: null });
    await initializing;
    const spans = spanExporter.getFinishedSpans();
    const outer = spans.find((span) => span.name === 'connection_manager.batch_emote_fetch');
    const batch = spans.find((span) => span.name === 'connection_manager.emote_batch_1');
    expect(outer.attributes).toMatchObject({ 'emote.success_count': 0, 'emote.failure_count': 0, 'emote.cancelled_count': 1 });
    expect(batch.attributes).toMatchObject({ 'emote.batch.success_count': 0, 'emote.batch.cancelled_count': 1 });
    expect(outer.status.code).toBe(0);
    expect(batch.status.code).toBe(0);
    const initializingSpan = spans.find((span) => span.name === 'connection_manager.initialize');
    expect(initializingSpan.attributes['chatroom.emote_cancelled_count']).toBe(1);
    expect(initializingSpan.status.code).toBe(0);
  });

  it.each(['remove', 'cleanup', 'replace', 'initialize'])('ends a pending room-load span promptly on %s and only once after settlement', async (action) => {
    const pending = deferred();
    const started = deferred();
    app.kick.initialLoad.messages.mockImplementationOnce(() => {
      started.resolve();
      return pending.promise;
    });
    const previousRoom = room(1);
    previousRoom.streamerData.slug = 'pending-room';
    manager.chatrooms.set('1', previousRoom);
    const batching = manager.initializeChatroomsInBatches([previousRoom]);
    await started.promise;
    if (action === 'remove') await manager.removeChatroom(1);
    if (action === 'cleanup') manager.cleanup();
    if (action === 'replace') await manager.addChatroom(room(1));
    if (action === 'initialize') await manager.initializeConnections([room(1)], {}, callbacks);
    const oldSpans = () => spanExporter.getFinishedSpans().filter((span) =>
      span.name === 'connection_manager.add_chatroom' && span.attributes['chatroom.slug'] === 'pending-room');
    expect(oldSpans()).toHaveLength(1);
    expect(oldSpans()[0].attributes['room_load.outcome']).toBe('cancelled');
    pending.resolve({ ok: true, value: null });
    const totals = await batching;
    expect(totals).toMatchObject({ cancelledCount: 1, successCount: 0 });
    expect(oldSpans()).toHaveLength(1);
  });

  it.each([
    ['fetchInitialChatroomInfo', 'chatroomInfo', 'initial chatroom info'],
    ['fetchInitialMessages', 'messages', 'initial messages'],
  ])('keeps standalone %s failures visible without throwing or exposing raw data', async (helper, bridge, label) => {
    const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
    const activeRoom = room(1);
    manager.chatrooms.set('1', activeRoom);
    app.kick.initialLoad[bridge].mockResolvedValueOnce({
      ok: false, failure: { type: 'http_error', status: 503, detail: 'secret diagnostic payload' },
    });
    try {
      await expect(manager[helper](activeRoom)).resolves.toMatchObject({
        result: 'failed', failure: { type: 'http_error', status: 503 },
      });
      expect(diagnostic).toHaveBeenCalledExactlyOnceWith(
        `[ConnectionManager] Error fetching ${label} for chatroom 1:`,
        { type: 'http_error', status: 503 },
      );
      expect(JSON.stringify(diagnostic.mock.calls)).not.toContain('secret diagnostic payload');
    } finally {
      diagnostic.mockRestore();
    }
  });

  it('leaves cancelled-only initialize, outer-batch and batch spans unset', async () => {
    const pending = deferred();
    const started = deferred();
    app.kick.initialLoad.messages.mockImplementationOnce(() => {
      started.resolve();
      return pending.promise;
    });
    const initializing = manager.initializeConnections([room(1)], {}, callbacks);
    await started.promise;
    await manager.removeChatroom(1);
    pending.resolve({ ok: true, value: null });
    await initializing;
    for (const name of ['connection_manager.initialize', 'connection_manager.chatroom_batches', 'connection_manager.chatroom_batch_1']) {
      const span = spanExporter.getFinishedSpans().find((entry) => entry.name === name);
      expect(span.status.code).toBe(0);
      expect(span.attributes[name === 'connection_manager.chatroom_batch_1' ? 'batch.cancelled_count' : 'chatroom.cancelled_count']).toBe(1);
    }
  });

  it('counts swallowed realtime IPC registration failure as failed rather than ready', async () => {
    app.kick.realtime.setRooms.mockRejectedValue(new Error('secret realtime IPC detail'));
    await expect(manager.addChatroom(room(1))).resolves.toBe('failed');
    const span = addChatroomSpan();
    expect(span.attributes['room_load.stage.realtime_registration']).toBe('failed');
    expect(span.attributes['room_load.outcome']).toBe('failed');
    expect(span.attributes['room_load.realtime_state']).toBe('failed');
    expect(JSON.stringify({ attributes: span.attributes, events: span.events, status: span.status }))
      .not.toContain('secret realtime IPC detail');
    expect(callbacks.setInitialChatroomInfo).toHaveBeenCalled();
    spanExporter.reset();
    await manager.initializeChatroomsInBatches([room(1)]);
    const batch = spanExporter.getFinishedSpans().find((entry) => entry.name === 'connection_manager.chatroom_batch_1');
    expect(batch.attributes).toMatchObject({ 'batch.failure_count': 1, 'batch.success_count': 0 });
  });

  it('counts terminal realtime failure during optional fetches as failed', async () => {
    const pending = deferred();
    const started = deferred();
    app.kick.initialLoad.messages.mockImplementationOnce(() => {
      started.resolve();
      return pending.promise;
    });
    const loadingRoom = room(1);
    manager.chatrooms.set('1', loadingRoom);
    const batching = manager.initializeChatroomsInBatches([loadingRoom]);
    await started.promise;
    const deliver = app.kick.realtime.onEvent.mock.calls[0][0];
    deliver({ kind: 'state', chatroomId: 1, state: 'failed', attempt: 1, reason: 'Realtime unavailable' });
    pending.resolve({ ok: true, value: { data: { data: { messages: [] } } } });
    const totals = await batching;
    const span = addChatroomSpan();
    expect(span.attributes['room_load.outcome']).toBe('failed');
    expect(span.attributes['room_load.stage.realtime_registration']).toBe('failed');
    expect(span.attributes['room_load.realtime_state']).toBe('failed');
    expect(span.status.code).toBe(2);
    expect(totals).toMatchObject({ failureCount: 1, successCount: 0 });
    const batch = spanExporter.getFinishedSpans().find((entry) => entry.name === 'connection_manager.chatroom_batch_1');
    expect(batch.attributes).toMatchObject({ 'batch.failure_count': 1, 'batch.success_count': 0 });
  });

  it('does not borrow replacement realtime failure after old registration settles', async () => {
    const pending = deferred();
    app.kick.realtime.setRooms.mockImplementationOnce(() => pending.promise);
    const previousRoom = room(1);
    previousRoom.streamerData.slug = 'previous-room';
    const previousLoad = manager.addChatroom(previousRoom);
    await manager.removeChatroom(1);
    app.kick.realtime.setRooms.mockRejectedValueOnce(new Error('replacement IPC failure'));
    await expect(manager.addChatroom(room(1))).resolves.toBe('failed');
    pending.resolve([]);
    await expect(previousLoad).resolves.toBe('cancelled');
    const span = spanExporter.getFinishedSpans().find((entry) => entry.attributes['chatroom.slug'] === 'previous-room');
    expect(span.attributes['room_load.outcome']).toBe('cancelled');
    expect(span.attributes['room_load.stage.realtime_registration']).toBe('cancelled');
    expect(span.attributes).not.toHaveProperty('room_load.realtime_state');
    expect(span.events.some((event) => event.name === 'room_load_stage_failed')).toBe(false);
  });

  it('counts a room removed during initial messages as cancelled rather than successful', async () => {
    const pending = deferred();
    const started = deferred();
    app.kick.initialLoad.messages.mockImplementationOnce(() => {
      started.resolve();
      return pending.promise;
    });
    const loadingRoom = room(1);
    manager.chatrooms.set('1', loadingRoom);
    const batching = manager.initializeChatroomsInBatches([loadingRoom]);
    await started.promise;
    await manager.removeChatroom(1);
    pending.resolve({ ok: true, value: { data: { data: { messages: [] } } } });
    const totals = await batching;
    expect(totals).toMatchObject({ cancelledCount: 1, successCount: 0 });
    const span = addChatroomSpan();
    expect(span.attributes['room_load.stage.initial_messages']).toBe('cancelled');
    expect(span.attributes['room_load.stage.initial_user_info']).toBe('cancelled');
    expect(span.attributes['room_load.outcome']).toBe('cancelled');
    expect(span.status.code).toBe(0);
    expect(callbacks.addInitialChatroomMessages).not.toHaveBeenCalled();
    const batch = spanExporter.getFinishedSpans().find((entry) => entry.name === 'connection_manager.chatroom_batch_1');
    expect(batch.attributes).toMatchObject({ 'batch.cancelled_count': 1, 'batch.success_count': 0 });
    expect(batch.status.code).not.toBe(1);
    const outer = spanExporter.getFinishedSpans().find((entry) => entry.name === 'connection_manager.chatroom_batches');
    expect(outer.attributes['chatroom.cancelled_count']).toBe(1);
    expect(outer.status.code).not.toBe(1);
  });

  it('returns cancelled when a replacement supersedes pending messages', async () => {
    const pending = deferred();
    const started = deferred();
    app.kick.initialLoad.messages.mockImplementationOnce(() => {
      started.resolve();
      return pending.promise;
    });
    const previousRoom = room(1);
    previousRoom.streamerData.slug = 'previous-room';
    const adding = manager.addChatroom(previousRoom);
    await started.promise;
    await manager.removeChatroom(1);
    app.kick.realtime.setRooms.mockRejectedValueOnce(new Error('replacement IPC failure'));
    await expect(manager.addChatroom(room(1))).resolves.toBe('failed');
    pending.resolve({ ok: false, failure: { type: 'timeout' } });
    await expect(adding).resolves.toBe('cancelled');
    const span = spanExporter.getFinishedSpans().find((entry) => entry.attributes['chatroom.slug'] === 'previous-room');
    expect(span.attributes).not.toHaveProperty('room_load.realtime_state');
    expect(span.attributes['room_load.stage.initial_messages']).toBe('cancelled');
    expect(span.attributes['room_load.outcome']).toBe('cancelled');
    expect(span.events.some((event) => event.name === 'room_load_stage_failed')).toBe(false);
  });

  it('marks a fully loaded room ready with every stage succeeded', async () => {
    await expect(manager.addChatroom(room(1))).resolves.toBe('ready');

    const span = addChatroomSpan();
    expect(span.attributes['room_load.outcome']).toBe('ready');
    expect(span.attributes['room_load.failed_stage_count']).toBe(0);
    for (const stage of ['realtime_registration', 'initial_messages', 'initial_chatroom_info', 'initial_user_info', 'initial_poll_info']) {
      expect(span.attributes[`room_load.stage.${stage}`]).toBe('succeeded');
    }
    expect(span.events.some((event) => event.name === 'room_load_stage_failed')).toBe(false);
    expect(span.status.code).toBe(1);
  });

  it('attributes an initial-messages failure to its optional stage while the room still loads', async () => {
    app.kick.initialLoad.messages.mockResolvedValueOnce({ ok: false, failure: { type: 'http_error', status: 503 } });

    await expect(manager.addChatroom(room(1))).resolves.toBe('partial');

    expect(callbacks.setInitialChatroomInfo).toHaveBeenCalled();
    const span = addChatroomSpan();
    expect(span).toBeDefined();
    expect(span.attributes['chatroom.id']).toBe(1);
    expect(span.attributes['room_load.stage.realtime_registration']).toBe('succeeded');
    expect(span.attributes['room_load.stage.initial_messages']).toBe('failed');
    expect(span.attributes['room_load.stage.initial_chatroom_info']).toBe('succeeded');
    expect(span.attributes['room_load.outcome']).toBe('partial');
    const failure = span.events.find((event) => event.name === 'room_load_stage_failed');
    expect(failure.attributes).toMatchObject({
      'room_load.stage': 'initial_messages',
      'room_load.stage_required': false,
      'error.type': 'http_error',
      'http.response.status_code': 503,
    });
  });

  it('attributes an initial chatroom-info failure to its optional stage without inventing an HTTP status', async () => {
    app.kick.initialLoad.chatroomInfo.mockResolvedValueOnce({ ok: false, failure: { type: 'request_failed' } });

    await expect(manager.addChatroom(room(1))).resolves.toBe('partial');

    expect(callbacks.addInitialChatroomMessages).toHaveBeenCalled();
    const span = addChatroomSpan();
    expect(span.attributes['room_load.stage.initial_messages']).toBe('succeeded');
    expect(span.attributes['room_load.stage.initial_chatroom_info']).toBe('failed');
    expect(span.attributes['room_load.outcome']).toBe('partial');
    const failure = span.events.find((event) => event.name === 'room_load_stage_failed');
    expect(failure.attributes).toMatchObject({
      'room_load.stage': 'initial_chatroom_info',
      'room_load.stage_required': false,
      'error.type': 'request_failed',
    });
    expect(failure.attributes).not.toHaveProperty('http.response.status_code');
  });

  it('attributes a user-info failure to its own optional stage while poll info succeeds', async () => {
    app.kick.initialLoad.selfChatroomInfo.mockResolvedValueOnce({ ok: false, failure: { type: 'request_failed' } });

    await expect(manager.addChatroom(room(1))).resolves.toBe('partial');

    expect(callbacks.handlePollDelete).toHaveBeenCalledWith(1);
    const span = addChatroomSpan();
    expect(span.attributes['room_load.stage.initial_user_info']).toBe('failed');
    expect(span.attributes['room_load.stage.initial_poll_info']).toBe('succeeded');
    expect(span.attributes['room_load.outcome']).toBe('partial');
    const failure = span.events.find((event) => event.name === 'room_load_stage_failed');
    expect(failure.attributes).toMatchObject({
      'room_load.stage': 'initial_user_info',
      'room_load.stage_required': false,
      'error.type': 'request_failed',
    });
  });

  it('attributes a poll failure to its own optional stage while user info succeeds', async () => {
    app.kick.initialLoad.pollInfo.mockResolvedValueOnce({ ok: false, failure: { type: 'timeout' } });

    await expect(manager.addChatroom(room(1))).resolves.toBe('partial');

    expect(callbacks.setUserChatroomInfo).toHaveBeenCalled();
    const span = addChatroomSpan();
    expect(span.attributes['room_load.stage.initial_user_info']).toBe('succeeded');
    expect(span.attributes['room_load.stage.initial_poll_info']).toBe('failed');
    const failure = span.events.find((event) => event.name === 'room_load_stage_failed');
    expect(failure.attributes).toMatchObject({
      'room_load.stage': 'initial_poll_info',
      'room_load.stage_required': false,
      'error.type': 'timeout',
    });
    expect(failure.attributes).not.toHaveProperty('http.response.status_code');
  });

  it('propagates exceptional realtime onEvent setup rejection and attributes the required stage', async () => {
    app.kick.realtime.onEvent.mockImplementationOnce(() => { throw new Error('secret realtime detail'); });

    await expect(manager.addChatroom(room(1))).rejects.toThrow('secret realtime detail');

    expect(app.kick.initialLoad.messages).not.toHaveBeenCalled();
    const span = addChatroomSpan();
    expect(span.attributes['room_load.stage.realtime_registration']).toBe('failed');
    expect(span.attributes['room_load.stage.initial_messages']).toBeUndefined();
    expect(span.attributes['room_load.outcome']).toBe('failed');
    expect(span.status.code).toBe(2);
    const failure = span.events.find((event) => event.name === 'room_load_stage_failed');
    expect(failure.attributes).toMatchObject({
      'room_load.stage': 'realtime_registration',
      'room_load.stage_required': true,
      'error.type': 'request_failed',
    });
    expect(JSON.stringify({ attributes: span.attributes, events: span.events, status: span.status }))
      .not.toContain('secret realtime detail');
  });

  it('does not mark batches successful when a child room is partial or rejected', async () => {
    const rejectedRoom = room(1);
    const partialRoom = room(2);
    manager.chatrooms.set('1', rejectedRoom);
    manager.chatrooms.set('2', partialRoom);
    app.kick.initialLoad.messages.mockImplementation(async (channelId) => {
      if (channelId === partialRoom.streamerData.id) return { ok: false, failure: { type: 'request_failed' } };
      return { ok: true, value: { data: { data: { messages: [] } } } };
    });
    app.kick.realtime.onEvent.mockImplementationOnce(() => { throw new Error('secret realtime detail'); });

    await manager.initializeChatroomsInBatches([rejectedRoom, partialRoom]);

    const spans = spanExporter.getFinishedSpans();
    const batch = spans.find((span) => span.name === 'connection_manager.chatroom_batch_1');
    const outer = spans.find((span) => span.name === 'connection_manager.chatroom_batches');
    const rooms = spans.filter((span) => span.name === 'connection_manager.add_chatroom');
    expect(rooms.map((span) => span.attributes['room_load.outcome']).sort()).toEqual(['failed', 'partial']);
    expect(batch.attributes).toMatchObject({
      'batch.success_count': 0,
      'batch.partial_count': 1,
      'batch.failure_count': 1,
    });
    expect(batch.status.code).toBe(2);
    expect(outer.attributes).toMatchObject({
      'chatroom.success_count': 0,
      'chatroom.partial_count': 1,
      'chatroom.failure_count': 1,
    });
    expect(outer.status.code).toBe(2);
    // One trace: batch and room spans are children of the outer batch span.
    expect(batch.spanContext().traceId).toBe(outer.spanContext().traceId);
    expect(batch.parentSpanContext.spanId).toBe(outer.spanContext().spanId);
    for (const roomSpan of rooms) {
      expect(roomSpan.spanContext().traceId).toBe(outer.spanContext().traceId);
      expect(roomSpan.parentSpanContext.spanId).toBe(batch.spanContext().spanId);
    }
  });
});
