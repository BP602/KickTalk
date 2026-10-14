// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
      getInitialChatroomMessages: vi.fn(async () => ({
        data: { data: { messages: [{ id: 'initial-message' }] } },
      })),
      getChannelChatroomInfo: vi.fn(async (slug) => ({ chatroom: { slug } })),
      getSelfChatroomInfo: vi.fn(async () => ({ data: { is_subscribed: false } })),
      getInitialPollInfo: vi.fn(async () => ({ data: { status: { code: 404 } } })),
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
    app.kick.getInitialChatroomMessages.mockClear();
    const pending = deferred();
    app.kick.realtime.setRooms.mockImplementationOnce(() => pending.promise);
    const readdedRoom = room(2); // The provider adds a new object with no 7TV sets.
    const adding = manager.addChatroom(readdedRoom);
    const hydrating = manager.fetchChatroomEmotes(readdedRoom);
    await hydrating;

    expect(app.kick.getEmotes).toHaveBeenCalledTimes(kickFetches);
    expect(app.stv.getChannelEmotes).toHaveBeenCalledTimes(stvFetches);
    expect(app.kick.getInitialChatroomMessages).not.toHaveBeenCalled();
    expectChannelEvent(socket, 2);

    pending.resolve([]);
    await adding;
    expectChannelEvent(socket, 2);
    expectChannelEvent(socket, 1);
    expect(manager.getConnectionStatus().stv.chatrooms).toBe(2);
  });

  it('registers provided 7TV IDs without waiting for Kick IPC while keeping initial fetches behind it', async () => {
    const socket = await initialize([room(1)]);
    app.kick.getInitialChatroomMessages.mockClear();
    const pending = deferred();
    app.kick.realtime.setRooms.mockImplementationOnce(() => pending.promise);
    const adding = manager.addChatroom(room(2, channelEmotes(2)));

    expectChannelEvent(socket, 2);
    expect(app.kick.getInitialChatroomMessages).not.toHaveBeenCalled();

    pending.resolve([]);
    await adding;
    expectChannelEvent(socket, 2);
  });

  it.each(['remove', 'cleanup'])('does not restore a room after %s while its Kick registration is pending', async (action) => {
    const socket = await initialize([room(1)]);
    app.kick.getInitialChatroomMessages.mockClear();
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

    expect(app.kick.getInitialChatroomMessages).not.toHaveBeenCalled();
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
