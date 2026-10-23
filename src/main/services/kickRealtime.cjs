'use strict';

const { randomUUID, createHash } = require('node:crypto');
const { Centrifuge, UnauthorizedError } = require('centrifuge');
const WebSocket = require('ws');

const API_BASE = 'https://web.kick.com';
const isId = (value) => Number.isSafeInteger(value) && value > 0;
const isLoopback = (hostname) => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
const failureClassification = (error) => {
  if (error.reason?.includes('subscription')) return 'subscription';
  if (error.reason === 'realtime_retry_exhausted') return 'retry_exhausted';
  if (error.reason?.includes('auth') || error.reason?.includes('identity')) return 'authentication';
  if (error.reason === 'realtime_http_error') return 'http';
  if (error.reason === 'realtime_network_error') return 'network';
  if (error.reason === 'realtime_server_denied') return 'gateway_denied';
  if (error.code >= 1000 && error.code < 2000) return 'socket_close';
  if (error.reason === 'realtime_server_disconnected') return 'gateway_disconnect';
  if (error.reason === 'realtime_connection_lost' || error.reason === 'realtime_transport_error') return 'transport_error';
  return 'setup';
};
// Node EventEmitter treats an unhandled `error` event as a throw. Disposed SDK
// objects can emit from already-queued callbacks, so retain an inert handler.
const silenceEmitter = (emitter) => {
  emitter.removeAllListeners();
  emitter.on('error', () => {});
};


class RealtimeError extends Error {
  constructor(reason, code, fatal = false) {
    super(reason);
    this.reason = reason;
    this.code = code;
    this.fatal = fatal;
  }
}

function validateRooms(rooms) {
  if (!Array.isArray(rooms) || rooms.length > 200) throw new TypeError('Invalid realtime rooms');
  const unique = new Map();
  for (const room of rooms) {
    if (!room || !isId(room.chatroomId) || !isId(room.channelId) ||
        (room.livestreamId !== undefined && !isId(room.livestreamId)) ||
        (room.streamerName !== undefined && (typeof room.streamerName !== 'string' || room.streamerName.length > 100))) {
      throw new TypeError('Invalid realtime room');
    }
    if (unique.has(room.chatroomId)) throw new TypeError('Duplicate realtime room');
    unique.set(room.chatroomId, {
      chatroomId: room.chatroomId, channelId: room.channelId,
      ...(room.streamerName !== undefined && { streamerName: room.streamerName }),
      ...(room.livestreamId !== undefined && { livestreamId: room.livestreamId }),
    });
  }
  return unique;
}

// One main-process client and desired subscription map. Credentials and SDK objects
// never cross the public state/publication boundary. The SDK owns ping/pong and JWT
// renewal; the controller bounds shared retries until primary readiness and private
// retries until that subscription's healthy ACK.
class KickRealtimeController {
  constructor(options = {}) {
    this.fetch = options.fetchImpl || globalThis.fetch;
    this.WebSocket = options.WebSocketImpl || WebSocket;
    this.getSession = options.getSession || (async () => ({}));
    this.emit = options.emit || (() => {});
    this.telemetry = options.telemetry;
    this.apiBaseUrl = options.apiBaseUrl || API_BASE;
    const api = new URL(this.apiBaseUrl);
    this.fixture = !!options.apiBaseUrl && isLoopback(api.hostname);
    if (api.username || api.password || (api.origin !== API_BASE && !this.fixture) ||
        (!['http:', 'https:'].includes(api.protocol))) throw new TypeError('Invalid realtime API URL');
    this.apiBaseUrl = api.origin;
    this.maxAttempts = options.maxAttempts ?? 5;
    this.minReconnectDelay = options.minReconnectDelay ?? 1000;
    this.maxReconnectDelay = options.maxReconnectDelay ?? 15000;
    if (!isId(this.maxAttempts) || this.maxAttempts > 100 ||
        !Number.isFinite(this.minReconnectDelay) || this.minReconnectDelay < 0 ||
        !Number.isFinite(this.maxReconnectDelay) || this.maxReconnectDelay < this.minReconnectDelay) {
      throw new TypeError('Invalid realtime retry options');
    }
    this.clientId = randomUUID();
    this.rooms = new Map();
    this.states = new Map();
    this.recent = new Map();
    this.privateFailures = new Map();
    this.subscriptions = new Map();
    this.client = null;
    this.generation = 0;
    this.timer = null;
    this.starting = null;
    this.abort = null;
    this.session = {};
    this.tokenFlight = null;
    this.channelTokenFlights = new Map();
    this.stopped = false;
    this.terminalFailure = null;
    this.gatewayConnected = false;
    this.recoveryEpisode = null;
    this.recoveryEpisodes = 0;
  }

  getSnapshot() {
    return [...this.states.values()].map((state) => ({ ...state }));
  }

  async setRooms(rooms) {
    const desired = validateRooms(rooms);
    for (const id of this.rooms.keys()) {
      if (!desired.has(id)) {
        this._state(id, 'disconnected', 0);
        this.states.delete(id);
        this.recent.delete(id);
        this.privateFailures.delete(id);
      }
    }
    this.rooms = desired;
    if (desired.size && this.stopped) {
      const failure = this.terminalFailure || [...this.states.values()].find((state) => state.state === 'failed') ||
        { attempt: this.maxAttempts, reason: 'realtime_terminal_failure' };
      this.terminalFailure = { attempt: failure.attempt, reason: failure.reason, code: failure.code };
      for (const id of desired.keys()) {
        if (this.states.get(id)?.state !== 'failed') {
          this._state(id, 'failed', failure.attempt, failure.reason, failure.code);
        }
      }
      return this.getSnapshot();
    }
    for (const id of desired.keys()) {
      if (!this.states.has(id)) this._state(id, 'connecting', 1);
    }
    if (!desired.size) {
      this._teardown();
      this.recoveryEpisode = null;
      this.stopped = false;
      this.terminalFailure = null;
      return this.getSnapshot();
    }
    if (this.client) this._syncSubscriptions();
    else if (!this.stopped && !this.timer) await this._start();
    return this.getSnapshot();
  }

  async retry(roomId) {
    if (roomId !== undefined && !isId(roomId)) throw new TypeError('Invalid realtime room ID');
    if (roomId !== undefined && !this.rooms.has(roomId)) return this.getSnapshot();
    if (!this.rooms.size) return this.getSnapshot();
    // A shared fatal connection requires a new client for all desired rooms.
    this._teardown();
    this.recoveryEpisode = null;
    this.privateFailures.clear();
    this.stopped = false;
    this.terminalFailure = null;
    for (const id of this.rooms.keys()) this._state(id, 'connecting', 1);
    await this._start();
    return this.getSnapshot();
  }

  close() {
    for (const id of this.rooms.keys()) this._state(id, 'disconnected', 0);
    this._teardown();
    this.recoveryEpisode = null;
    this.rooms.clear();
    this.states.clear();
    this.recent.clear();
    this.privateFailures.clear();
    this.stopped = false;
    this.terminalFailure = null;
  }

  _state(chatroomId, state, attempt, reason, code) {
    const warning = this.privateFailures.get(chatroomId);
    if (warning && state !== 'failed' && state !== 'disconnected') {
      reason = warning.reason;
      code = warning.code;
    }
    const record = { kind: 'state', chatroomId, state, attempt };
    if (reason) record.reason = reason;
    if (Number.isInteger(code)) record.code = code;
    const previous = this.states.get(chatroomId);
    if (previous && previous.state === state && previous.attempt === attempt &&
        previous.reason === reason && previous.code === code) return;
    this.states.set(chatroomId, record);
    this.emit({ ...record });
    this._record({ ...record, ...(reason && { classification: failureClassification({ reason, code }) }) });
    this._health();
  }

  _record(record) {
    try {
      if (typeof this.telemetry === 'function') this.telemetry(record);
      else this.telemetry?.record?.(record);
    } catch { /* Diagnostics must not alter the connection lifecycle. */ }
  }

  _health() {
    let readyRooms = 0;
    if (this.gatewayConnected) {
      for (const state of this.states.values()) if (state.state === 'connected') readyRooms++;
    }
    this._record({ kind: 'health', gatewayConnected: this.gatewayConnected, readyRooms });
  }

  async _request(path, body, generation, signal) {
    const headers = {
      accept: 'application/json', 'content-type': 'application/json',
      'x-app-platform': 'web', Origin: 'https://kick.com', Referer: 'https://kick.com/',
    };
    if (this.session.token) headers.authorization = `Bearer ${this.session.token}`;
    if (this.session.session) headers['x-xsrf-token'] = this.session.session;
    let response;
    try {
      const signals = [AbortSignal.timeout(15000)];
      if (this.abort) signals.push(this.abort.signal);
      if (signal) signals.push(signal);
      response = await this.fetch(`${this.apiBaseUrl}${path}`, {
        method: 'POST', headers, body: JSON.stringify(body), redirect: 'error', cache: 'no-store',
        signal: AbortSignal.any(signals),
      });
    } catch {
      throw new RealtimeError('realtime_network_error');
    }
    if (generation !== this.generation) throw new RealtimeError('realtime_cancelled', undefined, true);
    if (!response.ok) {
      throw new RealtimeError(response.status === 401 || response.status === 403 ? 'realtime_auth_denied' : 'realtime_http_error',
        response.status, response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429);
    }
    try { return await response.json(); }
    catch { throw new RealtimeError('realtime_invalid_response', undefined, true); }
  }

  async _token(generation) {
    // A disposed SDK client may invoke its captured refresh callback once more
    // from its own timer. Do not turn that stale callback into an HTTP request.
    if (generation !== this.generation) throw new UnauthorizedError('realtime_cancelled');
    if (this.tokenFlight) return this.tokenFlight;
    const flight = this._request('/api/v1/realtime/auth/connection', { client_id: this.clientId }, generation)
      .then((result) => {
        const token = result?.data?.token;
        if (typeof token !== 'string' || !token) throw new RealtimeError('realtime_token_missing', undefined, true);
        return token;
      });
    this.tokenFlight = flight;
    try { return await flight; }
    catch (error) {
      const failure = error.code === 400
        ? new RealtimeError('realtime_auth_denied', 400, true) : error;
      if (generation === this.generation) this._recover(generation, failure);
      if (failure.fatal) throw new UnauthorizedError('realtime_auth_denied');
      throw new Error('realtime_token_unavailable');
    } finally {
      if (this.tokenFlight === flight) this.tokenFlight = null;
    }
  }

  _cancelChannelToken(channel) {
    const flight = this.channelTokenFlights.get(channel);
    if (!flight) return;
    this.channelTokenFlights.delete(channel);
    flight.controller.abort();
  }

  _cancelChannelTokens() {
    const flights = [...this.channelTokenFlights.values()];
    this.channelTokenFlights.clear();
    for (const flight of flights) flight.controller.abort();
  }

  async _channelToken(generation, channel, entry) {
    const owned = () => generation === this.generation && entry?.generation === generation && !entry.failed && !entry.recovering &&
      this.subscriptions.get(channel) === entry && [...entry.roomIds].some((id) => this.rooms.has(id));
    if (!channel.startsWith('private-') || !this.session.token || !this.session.session ||
        !isId(this.session.userId) || !owned()) {
      throw new UnauthorizedError('realtime_private_subscription_cancelled');
    }
    const existing = this.channelTokenFlights.get(channel);
    if (existing?.generation === generation && existing.entry === entry) return existing.promise;
    if (existing) this._cancelChannelToken(channel);

    const record = { generation, entry, controller: new AbortController(), promise: null };
    this.channelTokenFlights.set(channel, record);
    const request = this._request('/api/v1/realtime/auth/channel', { channel }, generation, record.controller.signal)
      .then((result) => {
        if (record.controller.signal.aborted || !owned()) {
          throw new UnauthorizedError('realtime_private_subscription_cancelled');
        }
        const token = result?.data?.token;
        if (typeof token !== 'string' || !token) {
          throw new UnauthorizedError('realtime_private_token_missing');
        }
        return token;
      })
      .catch((error) => {
        if (error instanceof UnauthorizedError) throw error;
        if (record.controller.signal.aborted || !owned() || [401, 403, 404].includes(error.code)) {
          throw new UnauthorizedError('realtime_private_token_denied');
        }
        throw new Error('realtime_private_token_unavailable');
      });
    record.promise = request.finally(() => {
      if (this.channelTokenFlights.get(channel) === record) this.channelTokenFlights.delete(channel);
    });
    return record.promise;
  }

  async _start() {
    if (this.starting) return this.starting;
    const generation = this.generation;
    this.abort = new AbortController();
    const start = (async () => {
      try {
        const session = await this.getSession();
        if (generation !== this.generation || !this.rooms.size) return;
        this.session = session || {};
        if ((this.session.token || this.session.session) && !isId(this.session.userId)) {
          throw new RealtimeError('realtime_identity_unavailable', undefined, true);
        }
        const discovery = await this._request('/api/v1/realtime/connection', {
          client: { id: this.clientId, type: 'web' },
          capabilities: { accepted_providers: [{ provider: 'centrifugo' }] },
        }, generation);
        const connection = discovery?.data?.connections?.find((entry) => entry.provider === 'centrifugo');
        if (discovery?.data?.mode !== 'websocket' || !connection?.credentials?.url) {
          throw new RealtimeError('realtime_provider_unavailable', undefined, true);
        }
        const url = new URL(connection.credentials.url);
        const production = url.protocol === 'wss:' && url.hostname.endsWith('.platform.kick.com') && url.pathname === '/connection/websocket';
        const fixture = this.fixture && ['ws:', 'wss:'].includes(url.protocol) && isLoopback(url.hostname);
        if (url.username || url.password || url.hash || (!production && !fixture)) {
          throw new RealtimeError('realtime_gateway_rejected', undefined, true);
        }
        const token = await this._token(generation);
        if (generation !== this.generation || !this.rooms.size) return;
        const controller = this;
        const Transport = this.WebSocket;
        class ObservedWebSocket extends Transport {
          constructor(...args) {
            super(...args);
            for (const name of ['open', 'close', 'error']) {
              this.addEventListener(name, (event) => {
                if (generation !== controller.generation) return;
                controller._record({ kind: 'transport', state: `native_${name}`,
                  ...(Number.isInteger(event.code) && { code: event.code }),
                  ...(name !== 'open' && { classification: name === 'error' ? 'transport_error' : 'socket_close' }) });
              });
            }
          }
        }
        const client = new Centrifuge(url.toString(), {
          websocket: ObservedWebSocket, token, getToken: () => this._token(generation),
          minReconnectDelay: this.minReconnectDelay, maxReconnectDelay: this.maxReconnectDelay,
        });
        this.client = client;
        client.on('error', () => {});
        client.on('connected', () => {
          if (generation !== this.generation) return;
          this.gatewayConnected = true;
          this._record({ kind: 'transport', state: 'gateway_ack' });
          this._health();
        });
        let firstConnecting = true;
        client.on('connecting', (context) => {
          if (firstConnecting) { firstConnecting = false; return; }
          // The SDK routes server disconnect/close codes in its no-reconnect ranges
          // (3500-3999, 4500-4999, as in its _handleDisconnect) to 'disconnected',
          // except a raw socket close with an empty reason, which it misroutes to
          // 'connecting' with the code intact. Apply the SDK's own ranges here so a
          // fatal close cannot reset the attempt budget by resubscribing first.
          const fatal = Number.isInteger(context.code) &&
            ((context.code >= 3500 && context.code < 4000) || (context.code >= 4500 && context.code < 5000));
          this._scheduleRecovery(generation, fatal
            ? new RealtimeError('realtime_server_disconnected', context.code, true)
            : new RealtimeError('realtime_connection_lost', context.code));
        });
        client.on('disconnected', (context) => this._scheduleRecovery(generation,
          new RealtimeError('realtime_server_disconnected', context.code, true)));
        client.on('error', (context) => this._scheduleRecovery(generation,
          this._sdkError(context.error)));
        // Server-side subscriptions share the same routing map as client subscriptions.
        client.on('publication', (context) => {
          if (generation === this.generation) this._publication(context.channel, context.data);
        });
        this._syncSubscriptions();
        client.connect();
      } catch (error) {
        const sessionReason = ['realtime_auth_incomplete', 'realtime_auth_denied', 'realtime_identity_unavailable',
          'realtime_identity_network_error', 'realtime_identity_invalid_response'].includes(error?.reason);
        const failure = error instanceof RealtimeError ? error : sessionReason
          ? new RealtimeError(error.reason, Number.isInteger(error.code) ? error.code : undefined, error.fatal !== false)
          : new RealtimeError('realtime_setup_error', undefined, true);
        if (generation === this.generation) this._recover(generation, failure);
      }
    })();
    this.starting = start;
    try { await start; }
    finally { if (this.starting === start) this.starting = null; }
  }

  _sdkError(error) {
    const code = Number.isInteger(error?.code) ? error.code : undefined;
    const fatal = code !== undefined && code >= 100 && code !== 109 && error?.temporary !== true;
    return new RealtimeError(fatal ? 'realtime_server_denied' : 'realtime_transport_error', code, fatal);
  }

  _desiredChannels() {
    const desired = new Map();
    const add = (channel, id) => {
      if (!desired.has(channel)) desired.set(channel, new Set());
      desired.get(channel).add(id);
    };
    for (const [id, room] of this.rooms) {
      if (this.states.get(id)?.state === 'failed') continue;
      for (const channel of [`channel_${room.channelId}`, `channel.${room.channelId}`, `chatroom_${id}`, `chatrooms.${id}`, `chatrooms.${id}.v2`]) add(channel, id);
      if (this.session.token && isId(this.session.userId)) {
        add(`private-userfeed.${this.session.userId}`, id);
        add(`private-channelpoints-${this.session.userId}`, id);
        if (room.livestreamId) add(`private-livestream.${room.livestreamId}`, id);
        add(`predictions-channel-${room.channelId}`, id);
      }
    }
    return desired;
  }

  _clearPrivateWarning(chatroomId, channel) {
    const warning = this.privateFailures.get(chatroomId);
    if (!warning) return;
    warning.channels.delete(channel);
    if (warning.channels.size) return;
    this.privateFailures.delete(chatroomId);
    const state = this.states.get(chatroomId);
    if (state && state.state !== 'failed' && state.state !== 'disconnected') {
      this._state(chatroomId, state.state, state.attempt);
    }
  }

  _syncSubscriptions() {
    const client = this.client;
    if (!client) return;
    const desired = this._desiredChannels();
    for (const [channel, entry] of this.subscriptions) {
      if (!desired.has(channel)) {
        this._cancelChannelToken(channel);
        silenceEmitter(entry.subscription);
        client.removeSubscription(entry.subscription);
        this.subscriptions.delete(channel);
        for (const id of entry.roomIds) this._clearPrivateWarning(id, channel);
      }
    }
    for (const [channel, roomIds] of desired) {
      const existing = this.subscriptions.get(channel);
      if (existing) {
        for (const id of existing.roomIds) {
          if (!roomIds.has(id)) this._clearPrivateWarning(id, channel);
        }
        existing.roomIds = roomIds;
        if (existing.failed) this._subscriptionFailure(channel, existing, existing.failureCode);
        continue;
      }
      this._subscribe(channel, roomIds);
    }
  }

  _subscribe(channel, roomIds, attempts = 0) {
    const client = this.client;
    const generation = this.generation;
    let entry;
    const subscription = client.newSubscription(channel, {
      minResubscribeDelay: this.minReconnectDelay, maxResubscribeDelay: this.maxReconnectDelay,
      ...(channel.startsWith('private-') && {
        getToken: ({ channel: requestedChannel }) => requestedChannel === channel
          ? this._channelToken(generation, channel, entry)
          : Promise.reject(new UnauthorizedError('realtime_private_subscription_cancelled')),
      }),
    });
    entry = { subscription, generation, roomIds, attempts, private: channel.startsWith('private-') || channel.startsWith('predictions-channel-') };
    this.subscriptions.set(channel, entry);
    const owned = () => generation === this.generation && client === this.client &&
      this.subscriptions.get(channel) === entry && !entry.failed && !entry.recovering;
    subscription.on('error', () => {});
    subscription.on('publication', (context) => {
      if (owned()) this._publication(channel, context.data);
    });
    subscription.on('subscribed', () => {
      if (!owned()) return;
      entry.attempts = 0;
      this._record({ kind: 'subscription', channel, state: 'connected' });
      for (const id of entry.roomIds) {
        if (entry.private) this._clearPrivateWarning(id, channel);
        if (channel === `chatrooms.${id}.v2`) {
          this._record({ kind: 'transport', state: 'primary_ack', chatroomId: id });
          this._state(id, 'connected', 0);
        }
        if (channel === `chatrooms.${id}.v2` && this.recoveryEpisode) {
          this._record({ kind: 'recovery', state: 'ready', episode: this.recoveryEpisode.id });
          this.recoveryEpisode = null;
        }
      }
    });
    subscription.on('subscribing', (context) => {
      if (context.code === 0 || context.code === 1 || !owned()) return;
      if ([...entry.roomIds].some((id) => channel === `chatrooms.${id}.v2`)) {
        this._scheduleRecovery(generation, new RealtimeError('realtime_primary_subscription_lost', context.code));
      }
    });
    subscription.on('error', (context) => {
      if (!owned()) return;
      const error = this._sdkError(context.error);
      if (!entry.private) {
        if (error.fatal) this._subscriptionFailure(channel, entry, error.code);
        else this._scheduleRecovery(generation, error);
        return;
      }
      entry.attempts++;
      const exhausted = error.fatal || entry.attempts >= this.maxAttempts;
      const renewal = context.type === 'refresh' || context.type === 'refreshToken';
      if (!exhausted && !renewal) return;
      entry.recovering = true;
      // Centrifuge emits no healthy renewal ACK event. Replace only the private
      // subscription after a transient renewal error; its fresh subscribed ACK
      // resets the episode budget. Defer disposal until the SDK installs its timer.
      queueMicrotask(() => {
        if (generation !== this.generation || client !== this.client || this.subscriptions.get(channel) !== entry) return;
        this._cancelChannelToken(channel);
        silenceEmitter(subscription);
        if (exhausted) {
          subscription.unsubscribe();
          this._subscriptionFailure(channel, entry, error.code);
          return;
        }
        client.removeSubscription(subscription);
        this.subscriptions.delete(channel);
        const desiredRoomIds = this._desiredChannels().get(channel);
        if (desiredRoomIds) this._subscribe(channel, desiredRoomIds, entry.attempts);
      });
    });
    subscription.on('unsubscribed', (context) => {
      if (!owned() || context.code === 0) return;
      this._subscriptionFailure(channel, entry, context.code);
    });
    subscription.subscribe();
  }

  _subscriptionFailure(channel, entry, code) {
    if (entry.private) this._cancelChannelToken(channel);
    if (entry.private && !entry.failed) {
      this._record({ kind: 'warning', state: 'private_subscription_failed', channel,
        reason: 'realtime_private_subscription_denied', code, classification: 'subscription' });
    }
    entry.failed = true;
    entry.failureCode = code;
    for (const id of entry.roomIds) {
      const reason = entry.private ? 'realtime_private_subscription_denied' : 'realtime_subscription_denied';
      this._record({ kind: 'subscription', channel, chatroomId: id, state: 'failed', reason, code });
      const state = this.states.get(id);
      if (entry.private) {
        const warning = this.privateFailures.get(id) || { reason, code, channels: new Set() };
        warning.channels.add(channel);
        warning.code = code;
        this.privateFailures.set(id, warning);
        if (state) this._state(id, state.state, state.attempt, reason, code);
      } else {
        this._state(id, 'failed', state?.attempt || 1, reason, code);
      }
    }
    if (!entry.private) {
      this._syncSubscriptions();
      if ([...this.states.values()].every((state) => state.state === 'failed')) {
        this.stopped = true;
        this.terminalFailure = { attempt: this.states.get([...entry.roomIds][0])?.attempt || 1,
          reason: 'realtime_subscription_denied', code };
        this._teardown();
      }
    }
  }

  _publication(channel, payload) {
    if (!payload || typeof payload.event !== 'string' || !payload.event || payload.event.length > 200) return;
    const roomIds = this.subscriptions.get(channel)?.roomIds;
    if (!roomIds) return;
    let data;
    try { data = typeof payload.data === 'string' ? payload.data : JSON.stringify(payload.data); }
    catch { return; }
    if (typeof data !== 'string') return;
    // A stable chat-message ID is a durable publication identity across aliases.
    // Stateful events have no such identity: suppress only adjacent equal values,
    // including aliases. Any intervening state event may be an opposite transition.
    let messageId;
    if (/ChatMessageEvent$/.test(payload.event)) {
      try {
        const message = JSON.parse(data);
        const candidate = message?.id ?? message?.message?.id;
        if (typeof candidate === 'string' || typeof candidate === 'number') messageId = String(candidate);
      } catch { /* The renderer owns malformed message payload handling. */ }
    }
    const key = createHash('sha256').update(payload.event).update('\0')
      .update(messageId === undefined ? data : `id:${messageId}`).digest('base64');
    const now = Date.now();
    for (const id of roomIds) {
      if (!this.rooms.has(id)) continue;
      let cache = this.recent.get(id);
      if (!cache) {
        cache = { messageIds: new Set(), lastState: null };
        this.recent.set(id, cache);
      }
      if (messageId !== undefined) {
        if (cache.messageIds.has(key)) continue;
        cache.messageIds.add(key);
        if (cache.messageIds.size > 512) cache.messageIds.delete(cache.messageIds.values().next().value);
      } else {
        const previous = cache.lastState;
        if (previous?.key === key && now - previous.at < 30000) continue;
        cache.lastState = { key, at: now };
      }
      this.emit({ kind: 'publication', chatroomId: id, channel, event: payload.event, data });
    }
  }

  _scheduleRecovery(generation, error) {
    // SDK callbacks may schedule their next timer after emitting an event. Dispose
    // after that callback returns so disconnect clears those timers as well.
    queueMicrotask(() => this._recover(generation, error));
  }

  _recover(generation, error) {
    if (generation !== this.generation || !this.rooms.size || this.stopped) return;
    const fatal = !!error.fatal;
    const next = new Map();
    for (const id of this.rooms.keys()) {
      if (this.states.get(id)?.state !== 'failed') next.set(id, (this.states.get(id)?.attempt || 0) + 1);
    }
    this._teardown();
    if (!next.size) {
      this.stopped = true;
      if (!this.terminalFailure) {
        const failure = [...this.states.values()].find((state) => state.state === 'failed');
        this.terminalFailure = failure
          ? { attempt: failure.attempt, reason: failure.reason, code: failure.code }
          : { attempt: this.maxAttempts, reason: error.reason, code: error.code };
      }
      return;
    }
    const exhausted = [...next.values()].some((attempt) => attempt > this.maxAttempts);
    if (fatal || exhausted) {
      this.stopped = true;
      const reason = fatal ? error.reason : 'realtime_retry_exhausted';
      this.terminalFailure = {
        attempt: Math.max(...[...next.values()].map((attempt) => Math.min(attempt - 1, this.maxAttempts))),
        reason, code: error.code,
      };
      for (const [id, attempt] of next) this._state(id, 'failed', Math.min(attempt - 1, this.maxAttempts), reason, error.code);
      return;
    }
    for (const [id, attempt] of next) this._state(id, 'reconnecting', attempt, error.reason, error.code);
    const attempt = Math.max(...next.values());
    const delay = Math.min(this.maxReconnectDelay, this.minReconnectDelay * (2 ** Math.max(0, attempt - 2)));
    const classification = failureClassification(error);
    if (!this.recoveryEpisode) {
      this.recoveryEpisode = { id: ++this.recoveryEpisodes };
      this._record({ kind: 'recovery', state: 'episode', episode: this.recoveryEpisode.id,
        reason: error.reason, code: error.code, classification });
    }
    const episode = this.recoveryEpisode.id;
    this._record({ kind: 'recovery', state: 'scheduled', episode, attempt, delayMs: delay,
      reason: error.reason, code: error.code, classification });
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.stopped && this.rooms.size) {
        this._record({ kind: 'recovery', state: 'attempt', episode, attempt,
          reason: error.reason, code: error.code, classification });
        void this._start();
      }
    }, delay);
  }

  _teardown() {
    if (this.client || this.starting || this.timer) this._record({ kind: 'transport', state: 'teardown' });
    this.gatewayConnected = false;
    this._health();
    this.generation++;
    clearTimeout(this.timer);
    this.timer = null;
    this.abort?.abort();
    this.abort = null;
    this.starting = null;
    this.tokenFlight = null;
    this._cancelChannelTokens();
    for (const entry of this.subscriptions.values()) silenceEmitter(entry.subscription);
    this.subscriptions.clear();
    const client = this.client;
    this.client = null;
    if (client) {
      silenceEmitter(client);
      client.disconnect();
      for (const subscription of Object.values(client.subscriptions())) client.removeSubscription(subscription);
    }
    this.session = {};
  }
}

module.exports = { KickRealtimeController };
