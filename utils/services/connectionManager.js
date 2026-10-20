import KickRealtimeClient from "./kick/kickRealtimeClient.js";
import SharedStvWebSocket from "./seventv/sharedStvWebSocket.js";

import { context as otelContext, trace as otelTrace } from '@opentelemetry/api';

const tracer = otelTrace.getTracer('kicktalk-connection-manager', '1.0.0');

function stageHttpStatus(error) {
  const candidate = error?.response?.status ?? error?.status ?? error?.data?.status?.code;
  return Number.isInteger(candidate) && candidate >= 100 && candidate <= 599 ? candidate : undefined;
}

function stageErrorType(error) {
  if (stageHttpStatus(error) !== undefined) return 'http_error';
  if (['ETIMEDOUT', 'ECONNABORTED'].includes(error?.code)) return 'timeout';
  return 'request_failed';
}

// Records one low-cardinality stage outcome; never copies error text or payloads.
function recordStageOutcome(span, stage, required, outcome) {
  const result = outcome.result;
  span.setAttribute(`room_load.stage.${stage}`, result);
  if (result === 'failed') {
    const attributes = {
      'room_load.stage': stage,
      'room_load.stage_required': required,
      'error.type': outcome.failure.type,
    };
    const candidate = outcome.failure.status;
    const status = Number.isInteger(candidate) && candidate >= 100 && candidate <= 599 ? candidate : undefined;
    if (status !== undefined) attributes['http.response.status_code'] = status;
    span.addEvent('room_load_stage_failed', attributes);
  }
  return result;
}

async function waitForRendererTracer() {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined'
      || JSON.parse(localStorage.getItem('settings') || '{}')?.telemetry?.enabled !== true) return;
  } catch {
    return;
  }
  const startedAt = Date.now();
  while (!window.__KT_TRACER__ && Date.now() - startedAt < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

class ConnectionManager {
  constructor() {
    this.kickRealtime = new KickRealtimeClient();
    this.chatrooms = new Map();
    this.activeRoomLoads = new Map();
    this.roomLoadSpanContexts = new Map();
    this.handlerCleanups = [];
    this.closed = false;
    this.stvWebSocket = new SharedStvWebSocket();
    this.initializationInProgress = false;
    this.emoteCache = new Map(); // Cache for global/common emotes
    this.globalStvEmotesCache = null; // Cache for global 7TV emotes
    this.channelStvEmoteCache = new Map(); // Cache for channel-specific 7TV emotes

    // Callbacks to avoid circular imports
    this.storeCallbacks = null;

    // Connection configuration
    this.config = {
      staggerDelay: 200, // ms between batches
      batchSize: 3, // chatrooms per batch
      maxConcurrentEmoteFetches: 5,
    };
  }

  async initializeConnections(chatrooms, eventHandlers = {}, storeCallbacks = {}) {
    const startedAt = Date.now();
    const events = [];
    let span;
    const addEarlyEvent = (name) => events.push({ name, time: Date.now() });
    const ensureSpan = () => {
      if (!span) {
        span = tracer.startSpan('connection_manager.initialize', {
          startTime: startedAt,
          attributes: {
            'chatroom.count': chatrooms.length,
            'connection.type': 'shared_pooled',
            'batch.size': this.config.batchSize
          }
        });
        for (const event of events) span.addEvent(event.name, {}, event.time);
      }
      return span;
    };

    if (this.initializationInProgress) {
      console.log("[ConnectionManager] Initialization already in progress");
      addEarlyEvent('initialization_already_in_progress');
      ensureSpan().end();
      return;
    }

    this.initializationInProgress = true;
    this.storeCallbacks = storeCallbacks;
    console.log(`[ConnectionManager] Starting optimized initialization for ${chatrooms.length} chatrooms`);
    
    addEarlyEvent('initialization_started');

    try {
      // Set up event handlers
      addEarlyEvent('setup_event_handlers_start');
      this.setupEventHandlers(eventHandlers);
      addEarlyEvent('setup_event_handlers_complete');

      // Register every Kick room before starting optional 7TV work.
      for (const load of this.activeRoomLoads.values()) load.finishCancelled();
      this.chatrooms = new Map(chatrooms.map((room) => [String(room.id), room]));
      await this.kickRealtime.setRooms(chatrooms);
      if (this.closed) return;
      this.startSharedConnections();
      // Startup may reach this manager before the renderer registers its tracer.
      // Defer the root span, but retain its original start time and early events.
      await waitForRendererTracer();
      if (this.closed) return;
      ensureSpan();

      // Initialize chatrooms in staggered batches
      span.addEvent('chatroom_batches_start');
      const roomTotals = await this.initializeChatroomsInBatches(chatrooms, otelTrace.setSpan(otelContext.active(), span));
      if (this.closed) return;
      span.addEvent('chatroom_batches_complete');

      // Batch fetch emotes
      span.addEvent('emote_fetching_start');
      const emoteTotals = await this.batchFetchEmotes(chatrooms, otelTrace.setSpan(otelContext.active(), span));
      span.addEvent('emote_fetching_complete');

      console.log("[ConnectionManager] Initialization completed successfully");
      span.addEvent('initialization_completed');
      span.setAttributes({
        'chatroom.emote_failure_count': emoteTotals.failureCount,
        'chatroom.emote_cancelled_count': emoteTotals.cancelledCount
      });
      if (roomTotals) {
        span.setAttributes({
          'chatroom.success_count': roomTotals.successCount,
          'chatroom.partial_count': roomTotals.partialCount,
          'chatroom.failure_count': roomTotals.failureCount,
          'chatroom.cancelled_count': roomTotals.cancelledCount
        });
      }
      if (roomTotals?.failureCount > 0) span.setStatus({ code: 2, message: 'chatroom_batches_failed' }); // ERROR
      else if (roomTotals?.partialCount > 0) span.setStatus({ code: 2, message: 'chatroom_batches_partial' }); // ERROR
      else if (emoteTotals.failureCount > 0) span.setStatus({ code: 2, message: 'chatroom_emotes_partial' }); // ERROR
      else if (roomTotals?.cancelledCount === 0 && emoteTotals.cancelledCount === 0) span.setStatus({ code: 1 }); // SUCCESS
    } catch (error) {
      console.error("[ConnectionManager] Error during initialization:", error);
      ensureSpan().recordException(error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
      throw error;
    } finally {
      this.initializationInProgress = false;
      ensureSpan().end();
    }
  }

  setupEventHandlers(handlers) {
    this.handlerCleanups.forEach((cleanup) => cleanup());
    this.handlerCleanups = [];
    const listen = (target, name, handler) => {
      if (!handler) return;
      target.addEventListener(name, handler);
      this.handlerCleanups.push(() => target.removeEventListener(name, handler));
    };
    listen(this.kickRealtime, "message", handlers.onKickMessage);
    listen(this.kickRealtime, "channel", handlers.onKickChannel);
    listen(this.kickRealtime, "connection-state", handlers.onKickConnectionState);
    listen(this.stvWebSocket, "message", handlers.onStvMessage);
    listen(this.stvWebSocket, "open", handlers.onStvOpen);
    listen(this.stvWebSocket, "connection", handlers.onStvConnection);
  }

  startSharedConnections() {
    // 7TV is optional: neither its readiness nor failure gates Kick receive.
    try {
      this.stvWebSocket.connect();
    } catch (error) {
      console.warn("[ConnectionManager] Unable to start 7TV connection:", error);
    }
  }

  async initializeChatroomsInBatches(chatrooms, parentContext) {
    const span = tracer.startSpan('connection_manager.chatroom_batches', {
      attributes: {
        'chatroom.total_count': chatrooms.length,
        'batch.size': this.config.batchSize,
        'batch.stagger_delay_ms': this.config.staggerDelay
      }
    }, parentContext);

    console.log(`[ConnectionManager] Initializing ${chatrooms.length} chatrooms in batches of ${this.config.batchSize}`);
    span.addEvent('chatroom_batch_processing_start');

    try {
      // Sort chatrooms by priority (you can customize this logic)
      const prioritizedChatrooms = this.prioritizeChatrooms(chatrooms);
      span.addEvent('chatrooms_prioritized');

      // Split into batches
      const batches = this.chunkArray(prioritizedChatrooms, this.config.batchSize);
      span.setAttribute('batch.count', batches.length);
      span.addEvent('chatrooms_split_into_batches');

      const totals = { successCount: 0, partialCount: 0, failureCount: 0, cancelledCount: 0 };
      for (let i = 0; i < batches.length; i++) {
        if (this.closed) return;
        const batch = batches[i];
        console.log(`[ConnectionManager] Processing batch ${i + 1}/${batches.length} (${batch.length} chatrooms)`);

        const batchSpan = tracer.startSpan(`connection_manager.chatroom_batch_${i + 1}`, {
          attributes: {
            'batch.index': i + 1,
            'batch.total': batches.length,
            'batch.chatroom_count': batch.length
          }
        }, otelTrace.setSpan(otelContext.active(), span));

        try {
          // Process batch in parallel; room spans take the batch span as parent.
          const roomParentContext = otelTrace.setSpan(otelContext.active(), batchSpan);
          const batchPromises = batch
            .filter((room) => this.chatrooms.has(String(room.id)))
            .map((room) => this.addChatroom(room, roomParentContext));
          const results = await Promise.allSettled(batchPromises);

          const successCount = results.filter(r => r.status === 'fulfilled' && r.value === 'ready').length;
          const partialCount = results.filter(r => r.status === 'fulfilled' && r.value === 'partial').length;
          const failureCount = results.filter(r => r.status === 'rejected' || r.value === 'failed').length;
          const cancelledCount = results.filter(r => r.status === 'fulfilled' && r.value === 'cancelled').length;
          totals.successCount += successCount;
          totals.partialCount += partialCount;
          totals.failureCount += failureCount;
          totals.cancelledCount += cancelledCount;

          batchSpan.setAttributes({
            'batch.success_count': successCount,
            'batch.partial_count': partialCount,
            'batch.failure_count': failureCount,
            'batch.cancelled_count': cancelledCount
          });

          if (failureCount > 0) {
            batchSpan.addEvent('batch_had_failures', { failure_count: failureCount });
          }
          if (partialCount > 0) {
            batchSpan.addEvent('batch_had_partial_rooms', { partial_count: partialCount });
          }

          // Add delay between batches (except for the last one)
          if (i < batches.length - 1) {
            await this.delay(this.config.staggerDelay);
            batchSpan.addEvent('stagger_delay_applied');
          }

          if (failureCount > 0) batchSpan.setStatus({ code: 2, message: 'chatroom_batch_failed' }); // ERROR
          else if (partialCount > 0) batchSpan.setStatus({ code: 2, message: 'chatroom_batch_partial' }); // ERROR
          else if (cancelledCount === 0) batchSpan.setStatus({ code: 1 }); // SUCCESS
        } catch (error) {
          batchSpan.recordException(error);
          batchSpan.setStatus({ code: 2, message: error.message }); // ERROR
          throw error;
        } finally {
          batchSpan.end();
        }
      }

      console.log("[ConnectionManager] All chatrooms initialized");
      span.addEvent('all_chatrooms_initialized');
      span.setAttributes({
        'chatroom.success_count': totals.successCount,
        'chatroom.partial_count': totals.partialCount,
        'chatroom.failure_count': totals.failureCount,
        'chatroom.cancelled_count': totals.cancelledCount
      });
      if (totals.failureCount > 0) span.setStatus({ code: 2, message: 'chatroom_batches_failed' }); // ERROR
      else if (totals.partialCount > 0) span.setStatus({ code: 2, message: 'chatroom_batches_partial' }); // ERROR
      else if (totals.cancelledCount === 0) span.setStatus({ code: 1 }); // SUCCESS
      return totals;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
      throw error;
    } finally {
      span.end();
    }
  }

  async addChatroom(chatroom, parentContext) {
    if (this.closed) return;
    const previousRoom = this.chatrooms.get(String(chatroom.id));
    if (previousRoom && previousRoom !== chatroom) this.activeRoomLoads.get(previousRoom)?.finishCancelled();
    this.chatrooms.set(String(chatroom.id), chatroom);
    const kickRegistration = this.kickRealtime.addChatroom(chatroom);

    // Register initial 7TV IDs before yielding; concurrent emote hydration may
    // replace them while Kick IPC is pending and must remain authoritative.
    const channelEmoteSet = Array.isArray(chatroom.channel7TVEmotes)
      ? chatroom.channel7TVEmotes.find(set => set.type === "channel")
      : null;
    const stvId = channelEmoteSet?.user?.id || "0";
    const stvEmoteSetId = channelEmoteSet?.setInfo?.id || "0";

    try {
      if (this.isActiveRoom(chatroom)) {
        this.stvWebSocket.addChatroom(
          chatroom.id,
          chatroom.streamerData.user_id,
          stvId,
          stvEmoteSetId
        );
      }
    } catch (error) {
      console.warn("[ConnectionManager] Unable to add 7TV room:", error);
    }

    const span = tracer.startSpan('connection_manager.add_chatroom', {
      attributes: {
        'chatroom.id': chatroom.id,
        'chatroom.username': chatroom.streamerData?.user?.username,
        'chatroom.slug': chatroom.streamerData?.slug,
        'chatroom.kick_channel_id': chatroom.streamerData.id
      }
    }, parentContext);
    const roomSpanContext = span.spanContext?.();
    if (roomSpanContext) this.roomLoadSpanContexts.set(String(chatroom.id), roomSpanContext);
    else this.roomLoadSpanContexts.delete(String(chatroom.id));
    const remainingStages = new Set(['realtime_registration', 'initial_messages', 'initial_chatroom_info', 'initial_user_info', 'initial_poll_info']);
    const load = {
      finished: false,
      finishCancelled: () => {
        if (load.finished) return;
        for (const stage of remainingStages) recordStageOutcome(span, stage, stage === 'realtime_registration', { result: 'cancelled' });
        span.setAttribute('room_load.outcome', 'cancelled');
        load.finished = true;
        span.end();
        if (this.activeRoomLoads.get(chatroom) === load) this.activeRoomLoads.delete(chatroom);
      },
    };
    this.activeRoomLoads.set(chatroom, load);
    const recordRoomStage = (stage, required, outcome) => {
      if (load.finished) return outcome.result;
      remainingStages.delete(stage);
      return recordStageOutcome(span, stage, required, outcome);
    };
    let registrationFailed = false;

    try {
      try {
        await kickRegistration;
        if (load.finished) return 'cancelled';
      } catch (error) {
        if (load.finished) return 'cancelled';
        registrationFailed = true;
        recordRoomStage('realtime_registration', true, { result: 'failed', failure: { type: stageErrorType(error), status: stageHttpStatus(error) } });
        span.setAttribute('room_load.outcome', 'failed');
        span.setStatus({ code: 2, message: 'realtime_registration_failed' }); // ERROR
        throw error;
      }
      if (!this.isActiveRoom(chatroom)) {
        recordRoomStage('realtime_registration', true, { result: 'cancelled' });
        span.setAttribute('room_load.outcome', 'cancelled');
        return 'cancelled';
      }
      const realtimeState = this.kickRealtime.getConnectionStatus().rooms[String(chatroom.id)]?.state;
      let realtimeFailed = realtimeState === 'failed';
      recordRoomStage('realtime_registration', true, realtimeFailed
        ? { result: 'failed', failure: { type: 'request_failed' } } : { result: 'succeeded' });
      span.addEvent('kick_realtime_room_registered');

      span.setAttributes({
        '7tv.user_id': stvId,
        '7tv.emote_set_id': stvEmoteSetId,
        '7tv.channel_emote_set_found': !!channelEmoteSet
      });

      let failedStages = 0;
      let cancelledStages = 0;
      const recordOptionalStage = (stage, outcome) => {
        const result = recordRoomStage(stage, false, outcome);
        if (result === 'failed') failedStages += 1;
        if (result === 'cancelled') cancelledStages += 1;
        return result;
      };
      // Fetch initial messages for this chatroom
      span.addEvent('initial_messages_fetch_start');
      if (recordOptionalStage('initial_messages', await this.fetchInitialMessages(chatroom)) === 'succeeded' && !load.finished) {
        span.addEvent('initial_messages_fetch_complete');
      }

      // Fetch initial chatroom info (including livestream status)
      if (!load.finished) span.addEvent('chatroom_info_fetch_start');
      if (recordOptionalStage('initial_chatroom_info', await this.fetchInitialChatroomInfo(chatroom)) === 'succeeded' && !load.finished) {
        span.addEvent('chatroom_info_fetch_complete');
      }
      for (const [stage, outcome] of await this.fetchInitialUserAndPollInfo(chatroom)) {
        recordOptionalStage(stage, outcome);
      }
      if (load.finished) return 'cancelled';

      if (this.isActiveRoom(chatroom) && !realtimeFailed
        && this.kickRealtime.getConnectionStatus().rooms[String(chatroom.id)]?.state === 'failed') {
        realtimeFailed = true;
        recordRoomStage('realtime_registration', true, { result: 'failed', failure: { type: 'request_failed' } });
      }
      const outcome = realtimeFailed ? 'failed' : cancelledStages > 0 ? 'cancelled' : failedStages > 0 ? 'partial' : 'ready';
      span.setAttributes({
        'room_load.outcome': outcome,
        'room_load.failed_stage_count': failedStages,
      });
      console.log(`[ConnectionManager] Added chatroom ${chatroom.id} (${chatroom.streamerData?.user?.username})`);
      span.addEvent('chatroom_added_successfully');
      if (realtimeFailed) span.setStatus({ code: 2, message: 'realtime_registration_failed' }); // ERROR
      else if (failedStages > 0) span.setStatus({ code: 2, message: 'room_load_partial' }); // ERROR
      else if (outcome === 'ready') span.setStatus({ code: 1 }); // SUCCESS
      return outcome;
    } catch (error) {
      if (load.finished) return 'cancelled';
      if (registrationFailed) throw error;
      console.error(`[ConnectionManager] Error adding chatroom ${chatroom.id}:`, error);
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
      return undefined;
    } finally {
      if (!load.finished) {
        if (this.isActiveRoom(chatroom)) {
          const realtimeState = this.kickRealtime.getConnectionStatus().rooms[String(chatroom.id)]?.state;
          if (realtimeState) span.setAttribute('room_load.realtime_state', realtimeState);
        }
        load.finished = true;
        span.end();
        if (this.activeRoomLoads.get(chatroom) === load) this.activeRoomLoads.delete(chatroom);
      }
    }
  }

  async removeChatroom(chatroomId) {
    this.activeRoomLoads.get(this.chatrooms.get(String(chatroomId)))?.finishCancelled();
    this.chatrooms.delete(String(chatroomId));
    this.roomLoadSpanContexts.delete(String(chatroomId));
    const update = this.kickRealtime.removeChatroom(chatroomId);
    this.stvWebSocket.removeChatroom(chatroomId);
    await update;
    console.log(`[ConnectionManager] Removed chatroom ${chatroomId}`);
  }

  async batchFetchEmotes(chatrooms, parentContext) {
    const span = tracer.startSpan('connection_manager.batch_emote_fetch', {
      attributes: {
        'emote.chatroom_count': chatrooms.length,
        'emote.batch_size': this.config.maxConcurrentEmoteFetches,
        'emote.delay_ms': 100
      }
    }, parentContext);
    const emoteParentContext = otelTrace.setSpan(otelContext.active(), span);
    const totals = { successCount: 0, failureCount: 0, cancelledCount: 0 };

    console.log("[ConnectionManager] Starting batch emote fetching...");
    span.addEvent('batch_emote_fetch_started');

    try {
      // Fetch global 7TV emotes first (cached)
      span.addEvent('global_7tv_emotes_fetch_start');
      await this.fetchGlobalStvEmotes(emoteParentContext);
      span.addEvent('global_7tv_emotes_fetch_complete');

      // Batch fetch channel-specific emotes
      span.addEvent('channel_emotes_batch_preparation_start');
      const emoteFetchPromises = chatrooms.map(chatroom =>
        this.fetchChatroomEmotesOutcome(chatroom, emoteParentContext)
      );

      // Process in batches to avoid overwhelming the APIs
      const emoteBatches = this.chunkArray(emoteFetchPromises, this.config.maxConcurrentEmoteFetches);
      span.setAttribute('emote.batch_count', emoteBatches.length);
      span.addEvent('channel_emotes_batch_preparation_complete');

      for (let i = 0; i < emoteBatches.length; i++) {
        const batch = emoteBatches[i];
        
        const batchSpan = tracer.startSpan(`connection_manager.emote_batch_${i + 1}`, {
          attributes: {
            'emote.batch.index': i + 1,
            'emote.batch.total': emoteBatches.length,
            'emote.batch.promise_count': batch.length
          }
        }, emoteParentContext);

        try {
          const results = await Promise.allSettled(batch);
          
          const successCount = results.filter(r => r.status === 'fulfilled' && r.value.result === 'succeeded').length;
          const failureCount = results.filter(r => r.status === 'rejected' || r.value.result === 'failed').length;
          const cancelledCount = results.filter(r => r.status === 'fulfilled' && r.value.result === 'cancelled').length;
          totals.successCount += successCount;
          totals.failureCount += failureCount;
          totals.cancelledCount += cancelledCount;
          
          batchSpan.setAttributes({
            'emote.batch.success_count': successCount,
            'emote.batch.failure_count': failureCount,
            'emote.batch.cancelled_count': cancelledCount
          });

          if (failureCount > 0) {
            batchSpan.addEvent('emote_batch_had_failures', { failure_count: failureCount });
          }

          // Add delay between batches (except for the last one)
          if (i < emoteBatches.length - 1) {
            await this.delay(100);
            batchSpan.addEvent('emote_batch_delay_applied');
          }

          if (failureCount > 0) batchSpan.setStatus({ code: 2, message: 'emote_batch_failed' });
          else if (cancelledCount === 0) batchSpan.setStatus({ code: 1 }); // SUCCESS
        } catch (error) {
          batchSpan.recordException(error);
          batchSpan.setStatus({ code: 2, message: error.message }); // ERROR
          throw error;
        } finally {
          batchSpan.end();
        }
      }

      console.log("[ConnectionManager] Batch emote fetching completed");
      span.addEvent('batch_emote_fetch_completed');
      span.setAttributes({
        'emote.success_count': totals.successCount,
        'emote.failure_count': totals.failureCount,
        'emote.cancelled_count': totals.cancelledCount
      });
      if (totals.failureCount > 0) span.setStatus({ code: 2, message: 'emote_fetch_failed' });
      else if (totals.cancelledCount === 0) span.setStatus({ code: 1 }); // SUCCESS
      return totals;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
      throw error;
    } finally {
      span.end();
    }
  }

  async fetchGlobalStvEmotes(parentContext) {
    const span = tracer.startSpan('connection_manager.fetch_global_7tv_emotes', {
      attributes: {
        'emote.type': 'global',
        'emote.provider': '7tv',
        'cache.available': !!this.globalStvEmotesCache
      }
    }, parentContext);

    if (this.globalStvEmotesCache) {
      console.log("[ConnectionManager] Using cached global 7TV emotes");
      span.addEvent('cache_hit');
      span.setStatus({ code: 1 }); // SUCCESS
      span.end();
      return this.globalStvEmotesCache;
    }

    try {
      // Fetch global 7TV emotes (implementation would depend on your existing API)
      // This is a placeholder - you'd implement the actual API call
      console.log("[ConnectionManager] Fetching global 7TV emotes...");
      span.addEvent('api_fetch_start');
      
      // const globalEmotes = await window.app.seventv.getGlobalEmotes();
      // this.globalStvEmotesCache = globalEmotes;
      
      console.log("[ConnectionManager] Global 7TV emotes cached");
      span.addEvent('cache_stored');
      span.setStatus({ code: 1 }); // SUCCESS
    } catch (error) {
      console.error("[ConnectionManager] Error fetching global 7TV emotes:", error);
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
    } finally {
      span.end();
    }
  }

  async fetchChatroomEmotes(chatroom, parentContext) {
    return (await this.fetchChatroomEmotesOutcome(chatroom, parentContext)).value;
  }

  async fetchChatroomEmotesOutcome(chatroom, parentContext) {
    if (!this.isActiveRoom(chatroom)) return { value: null, result: 'cancelled' };
    const cacheKey = `${chatroom.streamerData?.slug}`;
    const retainedContext = this.roomLoadSpanContexts.get(String(chatroom.id));
    
    const span = tracer.startSpan('connection_manager.fetch_chatroom_emotes', {
      attributes: {
        'emote.type': 'channel',
        'emote.provider': 'kick',
        'chatroom.id': chatroom.id,
        'chatroom.slug': chatroom.streamerData?.slug,
        'chatroom.username': chatroom.streamerData?.user?.username,
        'cache.key': cacheKey,
        'cache.available': this.emoteCache.has(cacheKey)
      },
      ...(retainedContext ? { links: [{ context: retainedContext }] } : {})
    }, parentContext);
    const channelParentContext = otelTrace.setSpan(otelContext.active(), span);

    if (this.emoteCache.has(cacheKey)) {
      console.log(`[ConnectionManager] Using cached emotes for ${chatroom.streamerData?.user?.username}`);
      span.addEvent('cache_hit');
      recordStageOutcome(span, 'initial_emotes', false, { result: 'succeeded' });
      span.setStatus({ code: 1 }); // SUCCESS
      span.end();

      const channelOutcome = await this.fetchChannel7TVEmotesOutcome(chatroom, channelParentContext);
      if (this.isActiveRoom(chatroom)) {
        this.storeCallbacks?.setKickEmotes?.(chatroom.id, this.emoteCache.get(cacheKey));
      }
      return { value: this.emoteCache.get(cacheKey), result: channelOutcome.result };
    }

    try {
      console.log(`[ConnectionManager] Fetching emotes for ${chatroom.streamerData?.user?.username}`);
      span.addEvent('api_fetch_start');

      // Fetch Kick emotes
      const settled = await window.app.kick.initialLoad.channelEmotes(chatroom.streamerData?.slug);
      if (!this.isActiveRoom(chatroom)) {
        recordStageOutcome(span, 'initial_emotes', false, { result: 'cancelled' });
        return { value: null, result: 'cancelled' };
      }
      if (!settled.ok) {
        recordStageOutcome(span, 'initial_emotes', false, { result: 'failed', failure: settled.failure });
        span.setStatus({ code: 2, message: 'initial_emotes_failed' });
        return { value: null, result: 'failed' };
      }
      const kickEmotes = settled.value;
      span.addEvent('api_fetch_complete');

      // Cache the result
      this.emoteCache.set(cacheKey, kickEmotes);
      span.addEvent('cache_stored');
      
      span.setAttributes({
        'emote.count': Array.isArray(kickEmotes) ? kickEmotes.length : 0
      });
      recordStageOutcome(span, 'initial_emotes', false, { result: 'succeeded' });
      span.setStatus({ code: 1 }); // SUCCESS

      const channelOutcome = await this.fetchChannel7TVEmotesOutcome(chatroom, channelParentContext);
      if (this.isActiveRoom(chatroom)) this.storeCallbacks?.setKickEmotes?.(chatroom.id, kickEmotes);

      return { value: kickEmotes, result: channelOutcome.result };
    } catch (error) {
      console.error(`[ConnectionManager] Error fetching emotes for ${chatroom.streamerData?.user?.username}:`, error);
      const result = this.isActiveRoom(chatroom) ? 'failed' : 'cancelled';
      recordStageOutcome(span, 'initial_emotes', false, { result, failure: { type: 'request_failed' } });
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
      return { value: null, result };
    } finally {
      span.end();
    }
  }

  async fetchChannel7TVEmotes(chatroom, parentContext) {
    return (await this.fetchChannel7TVEmotesOutcome(chatroom, parentContext)).value;
  }

  async fetchChannel7TVEmotesOutcome(chatroom, parentContext) {
    if (!this.isActiveRoom(chatroom) || !chatroom?.streamerData?.user_id) {
      return { value: null, result: 'cancelled' };
    }

    const cacheKey = `${chatroom.streamerData.user_id}`;

    const span = tracer.startSpan('connection_manager.fetch_channel_7tv_emotes', {
      attributes: {
        'emote.type': 'channel',
        'emote.provider': '7tv',
        'chatroom.id': chatroom.id,
        'chatroom.slug': chatroom.streamerData?.slug,
        'chatroom.username': chatroom.streamerData?.user?.username,
        'cache.key': cacheKey,
        'cache.available': this.channelStvEmoteCache.has(cacheKey)
      }
    }, parentContext);

    const useCached = this.channelStvEmoteCache.has(cacheKey);
    if (useCached) {
      span.addEvent('cache_hit');
      const cached = this.channelStvEmoteCache.get(cacheKey) || [];
      this.storeCallbacks?.updateChannel7TVEmotes?.(chatroom.id, cached);
      this.syncSharedStvChatroom(chatroom, cached);
      recordStageOutcome(span, 'initial_emotes_7tv', false, { result: 'succeeded' });
      span.setStatus({ code: 1 });
      span.end();
      return { value: cached, result: 'succeeded' };
    }

    try {
      span.addEvent('api_fetch_start');
      const settled = await window.app.kick.initialLoad.channel7tvEmotes(chatroom.streamerData.user_id);
      if (!this.isActiveRoom(chatroom)) {
        recordStageOutcome(span, 'initial_emotes_7tv', false, { result: 'cancelled' });
        return { value: null, result: 'cancelled' };
      }
      if (!settled.ok) {
        recordStageOutcome(span, 'initial_emotes_7tv', false, { result: 'failed', failure: settled.failure });
        span.setStatus({ code: 2, message: 'initial_emotes_7tv_failed' });
        return { value: null, result: 'failed' };
      }
      const channel7TVEmotes = settled.value;
      span.addEvent('api_fetch_complete');

      if (channel7TVEmotes) {
        this.channelStvEmoteCache.set(cacheKey, channel7TVEmotes);
        span.addEvent('cache_stored');
        this.storeCallbacks?.updateChannel7TVEmotes?.(chatroom.id, channel7TVEmotes);
        this.syncSharedStvChatroom(chatroom, channel7TVEmotes);
        span.setAttributes({
          'emote.count': Array.isArray(channel7TVEmotes)
            ? channel7TVEmotes.reduce((count, set) => count + (Array.isArray(set?.emotes) ? set.emotes.length : 0), 0)
            : 0,
        });
      }

      recordStageOutcome(span, 'initial_emotes_7tv', false, { result: 'succeeded' });
      span.setStatus({ code: 1 });
      return { value: channel7TVEmotes, result: 'succeeded' };
    } catch (error) {
      console.error(`[ConnectionManager] Error fetching 7TV emotes for ${chatroom.streamerData?.user?.username}:`, error);
      const result = this.isActiveRoom(chatroom) ? 'failed' : 'cancelled';
      recordStageOutcome(span, 'initial_emotes_7tv', false, { result, failure: { type: 'request_failed' } });
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
      return { value: null, result };
    } finally {
      span.end();
    }
  }

  syncSharedStvChatroom(chatroom, channel7TVEmotes) {
    if (!Array.isArray(channel7TVEmotes)) {
      return;
    }

    const channelSet = channel7TVEmotes.find((set) => set?.type === 'channel');
    const stvId = channelSet?.user?.id || '0';
    const stvEmoteSetId = channelSet?.setInfo?.id || '0';

    // console.log(`[ConnectionManager] Syncing 7TV chatroom ${chatroom.id} with emote set ID: ${stvEmoteSetId}`);

    this.stvWebSocket.updateChatroom(
      chatroom.id,
      chatroom.streamerData?.user_id,
      stvId,
      stvEmoteSetId,
    );
  }

  prioritizeChatrooms(chatrooms) {
    // Sort chatrooms by priority - you can customize this logic
    return chatrooms.sort((a, b) => {
      // Prioritize live streamers
      if (a.isStreamerLive && !b.isStreamerLive) return -1;
      if (!a.isStreamerLive && b.isStreamerLive) return 1;

      // Then by last activity or other criteria
      return 0;
    });
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Status methods
  getConnectionStatus() {
    return {
      kick: this.kickRealtime.getConnectionStatus(),
      stv: {
        state: this.stvWebSocket.getConnectionState(),
        chatrooms: this.stvWebSocket.getChatroomCount(),
        events: this.stvWebSocket.getSubscribedEventCount(),
      },
      emoteCache: {
        size: this.emoteCache.size,
        globalCached: !!this.globalStvEmotesCache,
      },
    };
  }

  // Fetch initial messages for a chatroom
  async fetchInitialMessages(chatroom) {
    try {
      const settled = await window.app.kick.initialLoad.messages(chatroom.streamerData.id);
      if (!this.isActiveRoom(chatroom)) return { result: 'cancelled' };
      if (!settled.ok) {
        const { type, status } = settled.failure;
        console.error(`[ConnectionManager] Error fetching initial messages for chatroom ${chatroom.id}:`, {
          type, ...(Number.isInteger(status) && status >= 100 && status <= 599 ? { status } : {}),
        });
        return { result: 'failed', failure: settled.failure };
      }
      const response = settled.value;

      if (!response?.data?.data) {
        console.log(`[ConnectionManager] No initial messages data for chatroom ${chatroom.id}`);
        return { result: 'succeeded' };
      }

      const data = response.data.data;

      // Use callbacks to avoid circular imports
      if (this.storeCallbacks) {
        // Handle initial pinned message
        if (data?.pinned_message) {
          this.storeCallbacks.handlePinnedMessageCreated?.(chatroom.id, data.pinned_message);
        } else {
          this.storeCallbacks.handlePinnedMessageDeleted?.(chatroom.id);
        }

        // Add initial messages to the chatroom
        if (data?.messages) {
          this.storeCallbacks.addInitialChatroomMessages?.(chatroom.id, data.messages.reverse());
          console.log(`[ConnectionManager] Loaded ${data.messages.length} initial messages for chatroom ${chatroom.id}`);
        }
      }
      return { result: 'succeeded' };
    } catch (error) {
      console.error(`[ConnectionManager] Error fetching initial messages for chatroom ${chatroom.id}:`, error);
      return this.isActiveRoom(chatroom) ? { result: 'failed', failure: { type: 'request_failed' } } : { result: 'cancelled' };
    }
  }

  // Fetch initial chatroom info (including livestream status)
  async fetchInitialChatroomInfo(chatroom) {
    try {
      const settled = await window.app.kick.initialLoad.chatroomInfo(chatroom.streamerData.slug);
      if (!this.isActiveRoom(chatroom)) return { result: 'cancelled' };
      if (!settled.ok) {
        const { type, status } = settled.failure;
        console.error(`[ConnectionManager] Error fetching initial chatroom info for chatroom ${chatroom.id}:`, {
          type, ...(Number.isInteger(status) && status >= 100 && status <= 599 ? { status } : {}),
        });
        return { result: 'failed', failure: settled.failure };
      }
      const chatroomData = settled.value;

      if (!chatroomData) {
        return { result: 'succeeded' };
      }

      // Use callbacks to avoid circular imports
      if (this.storeCallbacks) {
        this.storeCallbacks.setInitialChatroomInfo?.(chatroom.id, chatroomData);
        if (chatroomData?.chatroom) {
          this.storeCallbacks.handleChatroomUpdated?.(chatroom.id, chatroomData.chatroom);
        }
        const isLive = chatroomData?.livestream?.is_live || false;
        this.storeCallbacks.handleStreamStatus?.(chatroom.id, chatroomData, isLive);
      }
      return { result: 'succeeded' };
    } catch (error) {
      console.error(`[ConnectionManager] Error fetching initial chatroom info for chatroom ${chatroom.id}:`, error);
      return this.isActiveRoom(chatroom) ? { result: 'failed', failure: { type: 'request_failed' } } : { result: 'cancelled' };
    }
  }

  isActiveRoom(chatroom) {
    return !this.closed && this.chatrooms.get(String(chatroom.id)) === chatroom;
  }

  async fetchInitialUserAndPollInfo(chatroom) {
    const stages = ['initial_user_info', 'initial_poll_info'];
    if (!this.isActiveRoom(chatroom)) return stages.map((stage) => [stage, { result: 'cancelled' }]);
    const results = await Promise.all([
      (async () => {
        const settled = await window.app.kick.initialLoad.selfChatroomInfo(chatroom.streamerData.slug);
        if (!this.isActiveRoom(chatroom)) return { result: 'cancelled' };
        if (!settled.ok) return { result: 'failed', failure: settled.failure };
        if (settled.value?.data) {
          this.storeCallbacks?.setUserChatroomInfo?.(chatroom.id, settled.value.data);
        }
        return { result: 'succeeded' };
      })(),
      (async () => {
        const settled = await window.app.kick.initialLoad.pollInfo(chatroom.streamerData.slug);
        if (!this.isActiveRoom(chatroom)) return { result: 'cancelled' };
        if (!settled.ok) return { result: 'failed', failure: settled.failure };
        const response = settled.value;
        if (response?.data?.status?.code === 404) {
          this.storeCallbacks?.handlePollDelete?.(chatroom.id);
        } else if (response?.data?.status?.code === 200) {
          this.storeCallbacks?.handlePollUpdate?.(chatroom.id, response.data.data?.poll);
        }
        return { result: 'succeeded' };
      })(),
    ].map(async (request) => {
      try {
        return await request;
      } catch {
        return this.isActiveRoom(chatroom)
          ? { result: 'failed', failure: { type: 'request_failed' } } : { result: 'cancelled' };
      }
    }));
    return stages.map((stage, index) => [stage, results[index]]);
  }

  // Cleanup method
  cleanup() {
    console.log("[ConnectionManager] Cleaning up connections...");
    for (const load of this.activeRoomLoads.values()) load.finishCancelled();
    this.closed = true;
    this.chatrooms.clear();
    this.roomLoadSpanContexts.clear();
    this.handlerCleanups.forEach((cleanup) => cleanup());
    this.handlerCleanups = [];
    this.kickRealtime.close();
    this.stvWebSocket.close();
    this.emoteCache.clear();
    this.channelStvEmoteCache.clear();
    this.storeCallbacks = null;
    this.globalStvEmotesCache = null;
    this.initializationInProgress = false;
  }
}

export default ConnectionManager;
