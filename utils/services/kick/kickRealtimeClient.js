const CHANNEL_EVENTS = new Set([
  "LivestreamUpdated",
  "StreamerIsLive",
  "StopStreamBroadcast",
  "PinnedMessageCreatedEvent",
  "PinnedMessageDeletedEvent",
  "ChatroomUpdatedEvent",
  "PollUpdateEvent",
  "PollDeleteEvent",
]);

// The renderer owns consumers only; main owns discovery, credentials and sockets.
export default class KickRealtimeClient extends EventTarget {
  constructor(bridge = window.app.kick.realtime) {
    super();
    this.bridge = bridge;
    this.rooms = new Map();
    this.states = new Map();
    this.closed = false;
    this.operationGeneration = 0;
    this.unsubscribe = null;
  }

  descriptor(chatroom) {
    const livestreamId = chatroom.streamerData?.livestream?.id;
    return {
      chatroomId: Number(chatroom.id),
      channelId: Number(chatroom.streamerData?.id),
      streamerName: chatroom.streamerData?.user?.username,
      ...(livestreamId ? { livestreamId: Number(livestreamId) } : {}),
    };
  }

  setRooms(chatrooms) {
    if (this.closed) return Promise.resolve();
    this.rooms = new Map(chatrooms.map((room) => [String(room.id), this.descriptor(room)]));
    for (const key of this.states.keys()) {
      if (!this.rooms.has(key)) this.states.delete(key);
    }
    return this.syncRooms();
  }

  addChatroom(chatroom) {
    if (this.closed) return Promise.resolve();
    const key = String(chatroom.id);
    const descriptor = this.descriptor(chatroom);
    const previous = this.rooms.get(key);
    if (previous && previous.channelId === descriptor.channelId
      && previous.streamerName === descriptor.streamerName
      && previous.livestreamId === descriptor.livestreamId) return Promise.resolve();
    this.rooms.set(key, descriptor);
    return this.syncRooms();
  }

  removeChatroom(roomId) {
    if (this.closed) return Promise.resolve();
    const key = String(roomId);
    this.rooms.delete(key);
    this.states.delete(key);
    return this.syncRooms();
  }

  applySnapshot(snapshot, generation) {
    if (this.closed || generation !== this.operationGeneration || !Array.isArray(snapshot)) return;
    for (const event of snapshot) {
      // A snapshot may describe rooms that stopped being desired while IPC was pending.
      if (event?.kind === "state" && this.rooms.has(String(event.chatroomId))) {
        this.handleEvent(event);
      }
    }
  }

  async syncRooms() {
    const generation = ++this.operationGeneration;
    const rooms = [...this.rooms.values()];
    if (rooms.length && !this.unsubscribe) {
      this.unsubscribe = this.bridge.onEvent((event) => this.handleEvent(event));
    } else if (!rooms.length) {
      this.unsubscribe?.();
      this.unsubscribe = null;
    }
    for (const room of rooms) {
      if (!this.states.has(String(room.chatroomId))) {
        this.handleEvent({ kind: "state", chatroomId: room.chatroomId, state: "connecting", attempt: 0 });
      }
    }
    try {
      const snapshot = await this.bridge.setRooms(rooms);
      this.applySnapshot(snapshot, generation);
      return snapshot;
    } catch {
      if (this.closed || generation !== this.operationGeneration) return;
      // IPC errors can contain main-process details. Surface a fixed safe reason.
      for (const room of rooms) {
        if (this.rooms.has(String(room.chatroomId))) {
          this.handleEvent({ kind: "state", chatroomId: room.chatroomId, state: "failed", attempt: 0, reason: "Realtime service unavailable" });
        }
      }
    }
  }

  async retry(roomId) {
    if (this.closed || (roomId != null && !this.rooms.has(String(roomId)))) return;
    const generation = ++this.operationGeneration;
    try {
      const snapshot = await this.bridge.retry(roomId == null ? undefined : Number(roomId));
      this.applySnapshot(snapshot, generation);
      return snapshot;
    } catch {
      if (this.closed || generation !== this.operationGeneration) return;
      const rooms = roomId == null ? [...this.rooms.values()] : [this.rooms.get(String(roomId))];
      for (const room of rooms) {
        if (!room || !this.rooms.has(String(room.chatroomId))) continue;
        this.handleEvent({ kind: "state", chatroomId: room.chatroomId, state: "failed", attempt: this.states.get(String(room.chatroomId))?.attempt || 0, reason: "Realtime retry unavailable" });
      }
    }
  }

  handleEvent(event) {
    if (this.closed || !event || !this.rooms.has(String(event.chatroomId))) return;
    const chatroomId = this.rooms.get(String(event.chatroomId)).chatroomId;
    if (event.kind === "state") {
      const detail = { ...event, chatroomId };
      const previous = this.states.get(String(chatroomId));
      if (previous?.state === detail.state && previous.attempt === detail.attempt
        && previous.reason === detail.reason && previous.code === detail.code) return;
      this.states.set(String(chatroomId), detail);
      this.dispatchEvent(new CustomEvent("connection-state", { detail }));
    } else if (event.kind === "publication" && typeof event.data === "string" && typeof event.event === "string") {
      const detail = { chatroomId, channel: event.channel, event: event.event, data: event.data };
      const eventName = event.event.split("\\").pop();
      this.dispatchEvent(new CustomEvent(CHANNEL_EVENTS.has(eventName) ? "channel" : "message", { detail }));
    }
  }

  getConnectionStatus() {
    return { chatrooms: this.rooms.size, rooms: Object.fromEntries(this.states) };
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.operationGeneration += 1;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.rooms.clear();
    this.states.clear();
    // Invoke synchronously before a replacement adapter sends its desired rooms.
    void this.bridge.setRooms([]).catch(() => {});
  }
}
