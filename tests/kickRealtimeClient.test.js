// @vitest-environment node
import { describe, expect, it } from 'vitest';
import KickRealtimeClient from '../utils/services/kick/kickRealtimeClient.js';

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
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const room = (id, channelId = 500 + id) => ({
  id,
  streamerData: {
    id: channelId,
    user: { username: `streamer-${id}` },
  },
});

const state = (chatroomId, value, attempt, extra = {}) => ({
  kind: 'state',
  chatroomId,
  state: value,
  attempt,
  ...extra,
});

function createBridge() {
  const listeners = new Set();
  const bridge = {
    listeners,
    setRoomsCalls: [],
    retryCalls: [],
    setRoomsHandler: null,
    retryHandler: null,
    onEvent(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    emit(event) {
      for (const callback of [...listeners]) callback(event);
    },
    async setRooms(rooms) {
      bridge.setRoomsCalls.push(rooms.map((entry) => ({ ...entry })));
      if (bridge.setRoomsHandler) {
        return bridge.setRoomsHandler(rooms, bridge.setRoomsCalls.length);
      }
      return [];
    },
    async retry(roomId) {
      bridge.retryCalls.push(roomId);
      if (bridge.retryHandler) {
        return bridge.retryHandler(roomId, bridge.retryCalls.length);
      }
      return [];
    },
  };
  return bridge;
}

function collectStates(client) {
  const states = [];
  client.addEventListener('connection-state', (event) => states.push(event.detail));
  return states;
}

describe('KickRealtimeClient snapshot lifecycle', () => {
  it('hydrates a replacement adapter from the returned snapshot without another main event', async () => {
    const bridge = createBridge();
    bridge.setRoomsHandler = async () => [
      state(101, 'connected', 0, { reason: 'realtime_private_subscription_denied', code: 103 }),
      state(102, 'failed', 5, { reason: 'realtime_server_denied', code: 104 }),
      state(999, 'connected', 0),
    ];
    const client = new KickRealtimeClient(bridge);
    const states = collectStates(client);

    await client.setRooms([room(101), room(102)]);

    expect(states).toEqual([
      state(101, 'connecting', 0),
      state(102, 'connecting', 0),
      state(101, 'connected', 0, { reason: 'realtime_private_subscription_denied', code: 103 }),
      state(102, 'failed', 5, { reason: 'realtime_server_denied', code: 104 }),
    ]);
    expect(client.getConnectionStatus()).toEqual({
      chatrooms: 2,
      rooms: {
        101: state(101, 'connected', 0, { reason: 'realtime_private_subscription_denied', code: 103 }),
        102: state(102, 'failed', 5, { reason: 'realtime_server_denied', code: 104 }),
      },
    });
  });

  it('ignores a stale overlapping snapshot after the desired room set changes', async () => {
    const bridge = createBridge();
    const first = deferred();
    const second = deferred();
    bridge.setRoomsHandler = (_rooms, call) => (call === 1 ? first.promise : second.promise);
    const client = new KickRealtimeClient(bridge);
    const states = collectStates(client);

    const staleRequest = client.setRooms([room(101), room(102)]);
    const currentRequest = client.setRooms([room(101)]);

    second.resolve([state(101, 'connected', 2)]);
    await currentRequest;
    first.resolve([
      state(101, 'failed', 5, { reason: 'stale_failure', code: 104 }),
      state(102, 'connected', 0),
    ]);
    await staleRequest;

    expect(states).toEqual([
      state(101, 'connecting', 0),
      state(102, 'connecting', 0),
      state(101, 'connected', 2),
    ]);
    expect(client.getConnectionStatus()).toEqual({
      chatrooms: 1,
      rooms: { 101: state(101, 'connected', 2) },
    });
  });

  it('ignores a stale overlapping failure after a newer snapshot succeeds', async () => {
    const bridge = createBridge();
    const first = deferred();
    const second = deferred();
    bridge.setRoomsHandler = (_rooms, call) => (call === 1 ? first.promise : second.promise);
    const client = new KickRealtimeClient(bridge);
    const states = collectStates(client);

    const staleRequest = client.setRooms([room(101)]);
    const currentRequest = client.addChatroom(room(102));

    second.resolve([
      state(101, 'connected', 1),
      state(102, 'connected', 1),
    ]);
    await currentRequest;
    first.reject(new Error('stale transport failure'));
    await staleRequest;

    expect(states).toEqual([
      state(101, 'connecting', 0),
      state(102, 'connecting', 0),
      state(101, 'connected', 1),
      state(102, 'connected', 1),
    ]);
  });

  it('applies retry snapshots and preserves attempt when a later retry IPC call fails', async () => {
    const bridge = createBridge();
    bridge.setRoomsHandler = async () => [
      state(101, 'failed', 5, { reason: 'realtime_server_denied', code: 104 }),
    ];
    bridge.retryHandler = async () => [state(101, 'connecting', 1)];
    const client = new KickRealtimeClient(bridge);
    const states = collectStates(client);

    await client.setRooms([room(101)]);
    await client.retry(101);
    bridge.emit(state(101, 'reconnecting', 3));

    bridge.retryHandler = async () => { throw new Error('bridge unavailable'); };
    await client.retry(101);

    expect(bridge.retryCalls).toEqual([101, 101]);
    expect(states).toEqual([
      state(101, 'connecting', 0),
      state(101, 'failed', 5, { reason: 'realtime_server_denied', code: 104 }),
      state(101, 'connecting', 1),
      state(101, 'reconnecting', 3),
      state(101, 'failed', 3, { reason: 'Realtime retry unavailable' }),
    ]);
  });

  it('detaches on final room removal and rehydrates when the room is added again', async () => {
    const bridge = createBridge();
    bridge.setRoomsHandler = async (rooms) => rooms.map((entry) => (
      state(entry.chatroomId, 'connected', 1)
    ));
    const client = new KickRealtimeClient(bridge);
    const states = collectStates(client);

    await client.setRooms([room(101)]);
    expect(bridge.listeners.size).toBe(1);

    await client.removeChatroom(101);
    expect(bridge.listeners.size).toBe(0);
    bridge.emit(state(101, 'connected', 9));

    bridge.setRoomsHandler = async () => [
      state(101, 'failed', 5, { reason: 'realtime_server_denied', code: 104 }),
    ];
    await client.addChatroom(room(101));

    expect(bridge.listeners.size).toBe(1);
    expect(states).toEqual([
      state(101, 'connecting', 0),
      state(101, 'connected', 1),
      state(101, 'connecting', 0),
      state(101, 'failed', 5, { reason: 'realtime_server_denied', code: 104 }),
    ]);
  });

  it('does not resurrect state when an in-flight request resolves after close', async () => {
    const bridge = createBridge();
    const pending = deferred();
    bridge.setRoomsHandler = (rooms) => (rooms.length ? pending.promise : []);
    const client = new KickRealtimeClient(bridge);
    const states = collectStates(client);

    const request = client.setRooms([room(101)]);
    client.close();
    pending.resolve([state(101, 'connected', 1)]);
    await request;

    expect(bridge.listeners.size).toBe(0);
    expect(states).toEqual([state(101, 'connecting', 0)]);
    expect(client.getConnectionStatus()).toEqual({ chatrooms: 0, rooms: {} });
  });
});
