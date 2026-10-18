import KickRealtimeClient from "./kick/kickRealtimeClient.js";
import SharedStvWebSocket from "./seventv/sharedStvWebSocket.js";

// OpenTelemetry instrumentation
let tracer;
let otelContext;
let otelTrace;
try {
  const { context, trace } = require('@opentelemetry/api');
  otelContext = context;
  otelTrace = trace;
  tracer = trace.getTracer('kicktalk-connection-manager', '1.0.0');
} catch {
  // Fallback if OpenTelemetry not available
  otelContext = { active: () => ({}) };
  otelTrace = { setSpan: (ctx) => ctx };
  tracer = {
    startSpan: (name, options) => ({
      end: () => {},
      setStatus: () => {},
      recordException: () => {},
      addEvent: () => {},
      setAttribute: () => {},
      setAttributes: () => {}
    })
  };
}

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
  const succeeded = !outcome || outcome.succeeded !== false;
  span.setAttribute(`room_load.stage.${stage}`, succeeded ? 'succeeded' : 'failed');
  if (!succeeded) {
    const attributes = {
      'room_load.stage': stage,
      'room_load.stage_required': required,
      'error.type': stageErrorType(outcome.error),
    };
    const status = stageHttpStatus(outcome.error);
    if (status !== undefined) attributes['http.response.status_code'] = status;
    span.addEvent('room_load_stage_failed', attributes);
  }
  return succeeded;
}

class ConnectionManager {
  constructor() {
    this.kickRealtime = new KickRealtimeClient();
    this.chatrooms = new Map();
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
    const span = tracer.startSpan('connection_manager.initialize', {
      attributes: {
        'chatroom.count': chatrooms.length,
        'connection.type': 'shared_pooled',
        'batch.size': this.config.batchSize
      }
    });

    if (this.initializationInProgress) {
      console.log("[ConnectionManager] Initialization already in progress");
      span.addEvent('initialization_already_in_progress');
      span.end();
      return;
    }

    this.initializationInProgress = true;
    this.storeCallbacks = storeCallbacks;
    console.log(`[ConnectionManager] Starting optimized initialization for ${chatrooms.length} chatrooms`);
    
    span.addEvent('initialization_started');

    try {
      // Set up event handlers
      span.addEvent('setup_event_handlers_start');
      this.setupEventHandlers(eventHandlers);
      span.addEvent('setup_event_handlers_complete');

      // Register every Kick room before starting optional 7TV work.
      this.chatrooms = new Map(chatrooms.map((room) => [String(room.id), room]));
      await this.kickRealtime.setRooms(chatrooms);
      if (this.closed) return;
      this.startSharedConnections();

      // Initialize chatrooms in staggered batches
      span.addEvent('chatroom_batches_start');
      const roomTotals = await this.initializeChatroomsInBatches(chatrooms, otelTrace.setSpan(otelContext.active(), span));
      if (this.closed) return;
      span.addEvent('chatroom_batches_complete');

      // Batch fetch emotes
      span.addEvent('emote_fetching_start');
      await this.batchFetchEmotes(chatrooms);
      span.addEvent('emote_fetching_complete');

      console.log("[ConnectionManager] Initialization completed successfully");
      span.addEvent('initialization_completed');
      if (roomTotals) {
        span.setAttributes({
          'chatroom.success_count': roomTotals.successCount,
          'chatroom.partial_count': roomTotals.partialCount,
          'chatroom.failure_count': roomTotals.failureCount
        });
      }
      if (roomTotals?.failureCount > 0) span.setStatus({ code: 2, message: 'chatroom_batches_failed' }); // ERROR
      else if (roomTotals?.partialCount > 0) span.setStatus({ code: 2, message: 'chatroom_batches_partial' }); // ERROR
      else span.setStatus({ code: 1 }); // SUCCESS
    } catch (error) {
      console.error("[ConnectionManager] Error during initialization:", error);
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
      throw error;
    } finally {
      this.initializationInProgress = false;
      span.end();
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

      const totals = { successCount: 0, partialCount: 0, failureCount: 0 };
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
          const failureCount = results.filter(r => r.status === 'rejected').length;
          totals.successCount += successCount;
          totals.partialCount += partialCount;
          totals.failureCount += failureCount;

          batchSpan.setAttributes({
            'batch.success_count': successCount,
            'batch.partial_count': partialCount,
            'batch.failure_count': failureCount
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
          else batchSpan.setStatus({ code: 1 }); // SUCCESS
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
        'chatroom.failure_count': totals.failureCount
      });
      if (totals.failureCount > 0) span.setStatus({ code: 2, message: 'chatroom_batches_failed' }); // ERROR
      else if (totals.partialCount > 0) span.setStatus({ code: 2, message: 'chatroom_batches_partial' }); // ERROR
      else span.setStatus({ code: 1 }); // SUCCESS
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
    let registrationFailed = false;

    try {
      try {
        await kickRegistration;
      } catch (error) {
        registrationFailed = true;
        recordStageOutcome(span, 'realtime_registration', true, { succeeded: false, error });
        span.setAttribute('room_load.outcome', 'failed');
        span.setStatus({ code: 2, message: 'realtime_registration_failed' }); // ERROR
        throw error;
      }
      recordStageOutcome(span, 'realtime_registration', true, { succeeded: true });
      if (!this.isActiveRoom(chatroom)) return;
      span.addEvent('kick_realtime_room_registered');

      span.setAttributes({
        '7tv.user_id': stvId,
        '7tv.emote_set_id': stvEmoteSetId,
        '7tv.channel_emote_set_found': !!channelEmoteSet
      });

      let failedStages = 0;
      // Fetch initial messages for this chatroom
      span.addEvent('initial_messages_fetch_start');
      if (!recordStageOutcome(span, 'initial_messages', false, await this.fetchInitialMessages(chatroom))) failedStages += 1;
      else span.addEvent('initial_messages_fetch_complete');

      // Fetch initial chatroom info (including livestream status)
      span.addEvent('chatroom_info_fetch_start');
      if (!recordStageOutcome(span, 'initial_chatroom_info', false, await this.fetchInitialChatroomInfo(chatroom))) failedStages += 1;
      else span.addEvent('chatroom_info_fetch_complete');
      for (const [stage, outcome] of await this.fetchInitialUserAndPollInfo(chatroom)) {
        if (!recordStageOutcome(span, stage, false, outcome)) failedStages += 1;
      }

      const outcome = failedStages > 0 ? 'partial' : 'ready';
      span.setAttributes({
        'room_load.outcome': outcome,
        'room_load.failed_stage_count': failedStages,
      });
      console.log(`[ConnectionManager] Added chatroom ${chatroom.id} (${chatroom.streamerData?.user?.username})`);
      span.addEvent('chatroom_added_successfully');
      if (failedStages > 0) span.setStatus({ code: 2, message: 'room_load_partial' }); // ERROR
      else span.setStatus({ code: 1 }); // SUCCESS
      return outcome;
    } catch (error) {
      if (registrationFailed) throw error;
      console.error(`[ConnectionManager] Error adding chatroom ${chatroom.id}:`, error);
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
      return undefined;
    } finally {
      span.end();
    }
  }

  async removeChatroom(chatroomId) {
    this.chatrooms.delete(String(chatroomId));
    const update = this.kickRealtime.removeChatroom(chatroomId);
    this.stvWebSocket.removeChatroom(chatroomId);
    await update;
    console.log(`[ConnectionManager] Removed chatroom ${chatroomId}`);
  }

  async batchFetchEmotes(chatrooms) {
    const span = tracer.startSpan('connection_manager.batch_emote_fetch', {
      attributes: {
        'emote.chatroom_count': chatrooms.length,
        'emote.batch_size': this.config.maxConcurrentEmoteFetches,
        'emote.delay_ms': 100
      }
    });

    console.log("[ConnectionManager] Starting batch emote fetching...");
    span.addEvent('batch_emote_fetch_started');

    try {
      // Fetch global 7TV emotes first (cached)
      span.addEvent('global_7tv_emotes_fetch_start');
      await this.fetchGlobalStvEmotes();
      span.addEvent('global_7tv_emotes_fetch_complete');

      // Batch fetch channel-specific emotes
      span.addEvent('channel_emotes_batch_preparation_start');
      const emoteFetchPromises = chatrooms.map(chatroom =>
        this.fetchChatroomEmotes(chatroom)
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
        });

        try {
          const results = await Promise.allSettled(batch);
          
          const successCount = results.filter(r => r.status === 'fulfilled').length;
          const failureCount = results.filter(r => r.status === 'rejected').length;
          
          batchSpan.setAttributes({
            'emote.batch.success_count': successCount,
            'emote.batch.failure_count': failureCount
          });

          if (failureCount > 0) {
            batchSpan.addEvent('emote_batch_had_failures', { failure_count: failureCount });
          }

          // Add delay between batches (except for the last one)
          if (i < emoteBatches.length - 1) {
            await this.delay(100);
            batchSpan.addEvent('emote_batch_delay_applied');
          }

          batchSpan.setStatus({ code: 1 }); // SUCCESS
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
      span.setStatus({ code: 1 }); // SUCCESS
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
      throw error;
    } finally {
      span.end();
    }
  }

  async fetchGlobalStvEmotes() {
    const span = tracer.startSpan('connection_manager.fetch_global_7tv_emotes', {
      attributes: {
        'emote.type': 'global',
        'emote.provider': '7tv',
        'cache.available': !!this.globalStvEmotesCache
      }
    });

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

  async fetchChatroomEmotes(chatroom) {
    if (!this.isActiveRoom(chatroom)) return null;
    const cacheKey = `${chatroom.streamerData?.slug}`;
    
    const span = tracer.startSpan('connection_manager.fetch_chatroom_emotes', {
      attributes: {
        'emote.type': 'channel',
        'emote.provider': 'kick',
        'chatroom.id': chatroom.id,
        'chatroom.slug': chatroom.streamerData?.slug,
        'chatroom.username': chatroom.streamerData?.user?.username,
        'cache.key': cacheKey,
        'cache.available': this.emoteCache.has(cacheKey)
      }
    });

    if (this.emoteCache.has(cacheKey)) {
      console.log(`[ConnectionManager] Using cached emotes for ${chatroom.streamerData?.user?.username}`);
      span.addEvent('cache_hit');
      span.setStatus({ code: 1 }); // SUCCESS
      span.end();

      await this.fetchChannel7TVEmotes(chatroom);
      if (this.isActiveRoom(chatroom)) {
        this.storeCallbacks?.setKickEmotes?.(chatroom.id, this.emoteCache.get(cacheKey));
      }
      return this.emoteCache.get(cacheKey);
    }

    try {
      console.log(`[ConnectionManager] Fetching emotes for ${chatroom.streamerData?.user?.username}`);
      span.addEvent('api_fetch_start');

      // Fetch Kick emotes
      const kickEmotes = await window.app.kick.getEmotes(chatroom.streamerData?.slug);
      if (!this.isActiveRoom(chatroom)) return null;
      span.addEvent('api_fetch_complete');

      // Cache the result
      this.emoteCache.set(cacheKey, kickEmotes);
      span.addEvent('cache_stored');
      
      span.setAttributes({
        'emote.count': Array.isArray(kickEmotes) ? kickEmotes.length : 0
      });
      span.setStatus({ code: 1 }); // SUCCESS

      await this.fetchChannel7TVEmotes(chatroom);
      if (this.isActiveRoom(chatroom)) this.storeCallbacks?.setKickEmotes?.(chatroom.id, kickEmotes);

      return kickEmotes;
    } catch (error) {
      console.error(`[ConnectionManager] Error fetching emotes for ${chatroom.streamerData?.user?.username}:`, error);
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
      return null;
    } finally {
      span.end();
    }
  }

  async fetchChannel7TVEmotes(chatroom) {
    if (!this.isActiveRoom(chatroom) || !chatroom?.streamerData?.user_id) {
      return null;
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
    });

    const useCached = this.channelStvEmoteCache.has(cacheKey);
    if (useCached) {
      span.addEvent('cache_hit');
      const cached = this.channelStvEmoteCache.get(cacheKey) || [];
      this.storeCallbacks?.updateChannel7TVEmotes?.(chatroom.id, cached);
      this.syncSharedStvChatroom(chatroom, cached);
      span.setStatus({ code: 1 });
      span.end();
      return cached;
    }

    try {
      span.addEvent('api_fetch_start');
      const channel7TVEmotes = await window.app.stv.getChannelEmotes(chatroom.streamerData.user_id);
      if (!this.isActiveRoom(chatroom)) return null;
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

      span.setStatus({ code: 1 });
      return channel7TVEmotes;
    } catch (error) {
      console.error(`[ConnectionManager] Error fetching 7TV emotes for ${chatroom.streamerData?.user?.username}:`, error);
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
      return null;
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
      const response = await window.app.kick.getInitialChatroomMessages(chatroom.streamerData.id);
      if (!this.isActiveRoom(chatroom)) return { succeeded: true };

      if (!response?.data?.data) {
        console.log(`[ConnectionManager] No initial messages data for chatroom ${chatroom.id}`);
        return { succeeded: true };
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
      return { succeeded: true };
    } catch (error) {
      console.error(`[ConnectionManager] Error fetching initial messages for chatroom ${chatroom.id}:`, error);
      return { succeeded: false, error };
    }
  }

  // Fetch initial chatroom info (including livestream status)
  async fetchInitialChatroomInfo(chatroom) {
    try {
      const chatroomData = await window.app.kick.getChannelChatroomInfo(chatroom.streamerData.slug);
      if (!this.isActiveRoom(chatroom)) return { succeeded: true };

      if (!chatroomData) {
        return { succeeded: true };
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
      return { succeeded: true };
    } catch (error) {
      console.error(`[ConnectionManager] Error fetching initial chatroom info for chatroom ${chatroom.id}:`, error);
      return { succeeded: false, error };
    }
  }

  isActiveRoom(chatroom) {
    return !this.closed && this.chatrooms.get(String(chatroom.id)) === chatroom;
  }

  async fetchInitialUserAndPollInfo(chatroom) {
    const stages = ['initial_user_info', 'initial_poll_info'];
    if (!this.isActiveRoom(chatroom)) return stages.map((stage) => [stage, { succeeded: true }]);
    const results = await Promise.allSettled([
      (async () => {
        const response = await window.app.kick.getSelfChatroomInfo(chatroom.streamerData.slug);
        if (this.isActiveRoom(chatroom) && response?.data) {
          this.storeCallbacks?.setUserChatroomInfo?.(chatroom.id, response.data);
        }
      })(),
      (async () => {
        const response = await window.app.kick.getInitialPollInfo(chatroom.streamerData.slug);
        if (!this.isActiveRoom(chatroom)) return;
        if (response?.data?.status?.code === 404) {
          this.storeCallbacks?.handlePollDelete?.(chatroom.id);
        } else if (response?.data?.status?.code === 200) {
          this.storeCallbacks?.handlePollUpdate?.(chatroom.id, response.data.data?.poll);
        }
      })(),
    ]);
    return stages.map((stage, index) => [stage, results[index].status === 'fulfilled'
      ? { succeeded: true }
      : { succeeded: false, error: results[index].reason }]);
  }

  // Cleanup method
  cleanup() {
    console.log("[ConnectionManager] Cleaning up connections...");
    this.closed = true;
    this.chatrooms.clear();
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
