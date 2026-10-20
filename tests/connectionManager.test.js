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
      getEmotes: vi.fn(async (slug) => [{ name: `KickEmote-${slug}` }]),
      initialLoad: {
        messages: vi.fn(async () => ({ ok: true, value: { data: { data: { messages: [{ id: 'initial-message' }] } } } })),
        chatroomInfo: vi.fn(async (slug) => ({ ok: true, value: { chatroom: { slug } } })),
        selfChatroomInfo: vi.fn(async () => ({ ok: true, value: { data: { is_subscribed: false } } })),
        pollInfo: vi.fn(async () => ({ ok: true, value: { data: { status: { code: 404 } } } })),
      },
    },
    stv: {
      getChannelEmotes: vi.fn(async (userId) => channelEmotes(userId - 1000)),
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
    const kickFetches = app.kick.getEmotes.mock.calls.length;
    const stvFetches = app.stv.getChannelEmotes.mock.calls.length;
    app.kick.initialLoad.messages.mockClear();
    const pending = deferred();
    app.kick.realtime.setRooms.mockImplementationOnce(() => pending.promise);
    const readdedRoom = room(2); // The provider adds a new object with no 7TV sets.
    const adding = manager.addChatroom(readdedRoom);
    const hydrating = manager.fetchChatroomEmotes(readdedRoom);
    await hydrating;

    expect(app.kick.getEmotes).toHaveBeenCalledTimes(kickFetches);
    expect(app.stv.getChannelEmotes).toHaveBeenCalledTimes(stvFetches);
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

  it('counts swallowed realtime IPC registration failure as failed rather than ready', async () => {
    app.kick.realtime.setRooms.mockRejectedValue(new Error('IPC unavailable'));
    await expect(manager.addChatroom(room(1))).resolves.toBe('failed');
    const span = addChatroomSpan();
    expect(span.attributes['room_load.stage.realtime_registration']).toBe('failed');
    expect(span.attributes['room_load.outcome']).toBe('failed');
    expect(span.attributes['room_load.realtime_state']).toBe('failed');
    expect(callbacks.setInitialChatroomInfo).toHaveBeenCalled();
    spanExporter.reset();
    await manager.initializeChatroomsInBatches([room(1)]);
    const batch = spanExporter.getFinishedSpans().find((entry) => entry.name === 'connection_manager.chatroom_batch_1');
    expect(batch.attributes).toMatchObject({ 'batch.failure_count': 1, 'batch.success_count': 0 });
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
  });

  it('returns cancelled when a replacement supersedes pending messages', async () => {
    const pending = deferred();
    const started = deferred();
    app.kick.initialLoad.messages.mockImplementationOnce(() => {
      started.resolve();
      return pending.promise;
    });
    const adding = manager.addChatroom(room(1));
    await started.promise;
    manager.chatrooms.set('1', room(1));
    pending.resolve({ ok: false, failure: { type: 'timeout' } });
    await expect(adding).resolves.toBe('cancelled');
    const span = addChatroomSpan();
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
    expect(JSON.stringify({ attributes: span.attributes, events: span.events, status: span.status }))
      .not.toContain('secret upstream detail');
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
    expect(JSON.stringify({ attributes: span.attributes, events: span.events, status: span.status }))
      .not.toContain('secret info detail');
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
    expect(JSON.stringify({ attributes: span.attributes, events: span.events })).not.toContain('secret user detail');
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
    expect(JSON.stringify({ attributes: span.attributes, events: span.events })).not.toContain('secret poll detail');
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
