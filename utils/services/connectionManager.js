import SharedKickPusher from "./kick/sharedKickPusher.js";
import SharedStvWebSocket from "./seventv/sharedStvWebSocket.js";

// OpenTelemetry instrumentation
let tracer;
try {
  const { trace } = require('@opentelemetry/api');
  tracer = trace.getTracer('kicktalk-connection-manager', '1.0.0');
} catch (e) {
  // Fallback if OpenTelemetry not available
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

class ConnectionManager {
  constructor() {
    this.kickPusher = new SharedKickPusher();
    this.stvWebSocket = new SharedStvWebSocket();
    this.initializationInProgress = false;
    this.emoteCache = new Map(); // Cache for global/common emotes
    this.globalStvEmotesCache = null; // Cache for global 7TV emotes
    this.channelStvEmoteCache = new Map(); // Cache for channel-specific 7TV emotes
    this.deferredChatrooms = []; // Store chatrooms for lazy loading
    this.loadedChatrooms = new Set(); // Track which chatrooms are fully loaded

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

      // Start shared connections
      span.addEvent('shared_connections_start');
      await this.startSharedConnections();
      span.addEvent('shared_connections_complete');

      // Initialize chatrooms in staggered batches
      span.addEvent('chatroom_batches_start');
      await this.initializeChatroomsInBatches(chatrooms);
      span.addEvent('chatroom_batches_complete');

      // Batch fetch emotes
      span.addEvent('emote_fetching_start');
      await this.batchFetchEmotes(chatrooms);
      span.addEvent('emote_fetching_complete');

      console.log("[ConnectionManager] Initialization completed successfully");
      span.addEvent('initialization_completed');
      span.setStatus({ code: 1 }); // SUCCESS
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
    // Set up KickPusher event handlers
    if (handlers.onKickMessage) {
      this.kickPusher.addEventListener("message", handlers.onKickMessage);
    }
    if (handlers.onKickChannel) {
      this.kickPusher.addEventListener("channel", handlers.onKickChannel);
    }
    if (handlers.onKickRaw) {
      this.kickPusher.addEventListener("raw", handlers.onKickRaw);
    }
    if (handlers.onKickConnection) {
      this.kickPusher.addEventListener("connection", handlers.onKickConnection);
    }
    if (handlers.onKickSubscriptionSuccess) {
      this.kickPusher.addEventListener("subscription_success", handlers.onKickSubscriptionSuccess);
    }
    if (handlers.onChatroomUpdated) {
      this.kickPusher.addEventListener("chatroom-updated", handlers.onChatroomUpdated);
    }

    // Set up 7TV event handlers
    if (handlers.onStvMessage) {
      console.log(`[ConnectionManager] Registering onStvMessage handler`);
      this.stvWebSocket.addEventListener("message", handlers.onStvMessage);
    } else {
      console.warn(`[ConnectionManager] No onStvMessage handler provided!`);
    }
    if (handlers.onStvOpen) {
      console.log(`[ConnectionManager] Registering onStvOpen handler`);
      this.stvWebSocket.addEventListener("open", handlers.onStvOpen);
    }
    if (handlers.onStvConnection) {
      console.log(`[ConnectionManager] Registering onStvConnection handler`);
      this.stvWebSocket.addEventListener("connection", handlers.onStvConnection);
    }
  }

  async startSharedConnections() {
    const span = tracer.startSpan('connection_manager.shared_connections', {
      attributes: {
        'connection.kick.enabled': true,
        'connection.7tv.enabled': true,
        'connection.timeout_ms': 10000
      }
    });

    console.log("[ConnectionManager] Starting shared connections...");
    span.addEvent('shared_connections_start');

    try {
      // Start both connections in parallel
      const kickPromise = new Promise((resolve) => {
        const onConnection = (event) => {
          if (event.detail.content === "connection-success") {
            this.kickPusher.removeEventListener("connection", onConnection);
            span.addEvent('kick_connection_success');
            resolve();
          }
        };
        this.kickPusher.addEventListener("connection", onConnection);
        span.addEvent('kick_connection_attempt');
        this.kickPusher.connect();
      });

      const stvPromise = new Promise((resolve) => {
        const onConnection = (event) => {
          if (event.detail.content === "connection-success") {
            this.stvWebSocket.removeEventListener("connection", onConnection);
            span.addEvent('7tv_connection_success');
            resolve();
          }
        };
        this.stvWebSocket.addEventListener("connection", onConnection);
        span.addEvent('7tv_connection_attempt');
        this.stvWebSocket.connect();
      });

      // Wait for both connections with timeout
      await Promise.race([
        Promise.all([kickPromise, stvPromise]),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Connection timeout")), 10000)
        )
      ]);

      console.log("[ConnectionManager] Shared connections established");
      span.addEvent('all_connections_established');
      span.setStatus({ code: 1 }); // SUCCESS
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
      throw error;
    } finally {
      span.end();
    }
  }

  async initializeChatroomsInBatches(chatrooms) {
    const span = tracer.startSpan('connection_manager.chatroom_batches', {
      attributes: {
        'chatroom.total_count': chatrooms.length,
        'batch.size': this.config.batchSize,
        'batch.stagger_delay_ms': this.config.staggerDelay
      }
    });

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

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`[ConnectionManager] Processing batch ${i + 1}/${batches.length} (${batch.length} chatrooms)`);
        
        const batchSpan = tracer.startSpan(`connection_manager.chatroom_batch_${i + 1}`, {
          attributes: {
            'batch.index': i + 1,
            'batch.total': batches.length,
            'batch.chatroom_count': batch.length
          }
        });

        try {
          // Process batch in parallel
          const batchPromises = batch.map(chatroom => this.addChatroom(chatroom));
          const results = await Promise.allSettled(batchPromises);
          
          const successCount = results.filter(r => r.status === 'fulfilled').length;
          const failureCount = results.filter(r => r.status === 'rejected').length;
          
          batchSpan.setAttributes({
            'batch.success_count': successCount,
            'batch.failure_count': failureCount
          });
          
          if (failureCount > 0) {
            batchSpan.addEvent('batch_had_failures', { failure_count: failureCount });
          }

          // Add delay between batches (except for the last one)
          if (i < batches.length - 1) {
            await this.delay(this.config.staggerDelay);
            batchSpan.addEvent('stagger_delay_applied');
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

      console.log("[ConnectionManager] All chatrooms initialized");
      span.addEvent('all_chatrooms_initialized');
      span.setStatus({ code: 1 }); // SUCCESS
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
      throw error;
    } finally {
      span.end();
    }
  }

  async addChatroom(chatroom) {
    const span = tracer.startSpan('connection_manager.add_chatroom', {
      attributes: {
        'chatroom.id': chatroom.id,
        'chatroom.username': chatroom.streamerData?.user?.username,
        'chatroom.slug': chatroom.streamerData?.slug,
        'chatroom.kick_channel_id': chatroom.streamerData.id
      }
    });

    try {
      // Add to KickPusher
      span.addEvent('kick_pusher_add_start');
      this.kickPusher.addChatroom(
        chatroom.id,
        chatroom.streamerData.id,
        chatroom
      );
      span.addEvent('kick_pusher_add_complete');

      // Add to 7TV WebSocket
      // Extract 7TV user ID and emote set ID from channel emotes
      const channelEmoteSet = Array.isArray(chatroom.channel7TVEmotes) 
        ? chatroom.channel7TVEmotes.find(set => set.type === "channel")
        : null;
      const stvId = channelEmoteSet?.user?.id || "0";
      const stvEmoteSetId = channelEmoteSet?.setInfo?.id || "0";

      span.setAttributes({
        '7tv.user_id': stvId,
        '7tv.emote_set_id': stvEmoteSetId,
        '7tv.channel_emote_set_found': !!channelEmoteSet
      });

      span.addEvent('7tv_websocket_add_start');
      this.stvWebSocket.addChatroom(
        chatroom.id,
        chatroom.streamerData.user_id, // Use the correct Kick user ID for cosmetic/entitlement subscriptions
        stvId,
        stvEmoteSetId
      );
      span.addEvent('7tv_websocket_add_complete');

      // Fetch initial messages for this chatroom
      span.addEvent('initial_messages_fetch_start');
      await this.fetchInitialMessages(chatroom);
      span.addEvent('initial_messages_fetch_complete');

      // Fetch initial chatroom info (including livestream status)
      span.addEvent('chatroom_info_fetch_start');
      await this.fetchInitialChatroomInfo(chatroom);
      span.addEvent('chatroom_info_fetch_complete');

      // Mark chatroom as loaded so lazy loader skips it
      this.loadedChatrooms.add(chatroom.id);

      console.log(`[ConnectionManager] Added chatroom ${chatroom.id} (${chatroom.streamerData?.user?.username})`);
      span.addEvent('chatroom_added_successfully');
      span.setStatus({ code: 1 }); // SUCCESS
    } catch (error) {
      console.error(`[ConnectionManager] Error adding chatroom ${chatroom.id}:`, error);
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // ERROR

      if (this.loadedChatrooms.has(chatroom.id)) {
        this.loadedChatrooms.delete(chatroom.id);
      }
    } finally {
      span.end();
    }
  }

  async removeChatroom(chatroomId) {
    this.kickPusher.removeChatroom(chatroomId);
    this.stvWebSocket.removeChatroom(chatroomId);
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
      const pendingChatrooms = chatrooms.filter((chatroom) => {
        const cacheKey = `${chatroom.streamerData?.slug}`;
        return !this.emoteCache.has(cacheKey);
      });

      if (pendingChatrooms.length === 0) {
        span.addEvent('batch_skipped_all_cached');
        span.setStatus({ code: 1 });
        return;
      }

      // Fetch global 7TV emotes first (cached)
      span.addEvent('global_7tv_emotes_fetch_start');
      await this.fetchGlobalStvEmotes();
      span.addEvent('global_7tv_emotes_fetch_complete');

      // Batch fetch channel-specific emotes
      span.addEvent('channel_emotes_batch_preparation_start');
      const emoteFetchPromises = pendingChatrooms.map(chatroom =>
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
      console.log("[ConnectionManager] ✅ Using cached global 7TV emotes (cache hit)");
      span.addEvent('cache_hit');
      span.setStatus({ code: 1 }); // SUCCESS
      span.end();
      return this.globalStvEmotesCache;
    }

    try {
      console.log("[ConnectionManager] 🚀 Fetching global 7TV emotes for first time...");
      span.addEvent('api_fetch_start');

      // Use axios directly since we don't have the window.app.seventv API
      const axios = (await import('axios')).default;
      const globalResponse = await axios.get(`https://7tv.io/v3/emote-sets/global`);

      if (globalResponse.status !== 200) {
        throw new Error(`Error fetching Global 7TV Emotes. Status: ${globalResponse.status}`);
      }

      const emoteGlobalData = globalResponse?.data;

      if (emoteGlobalData) {
        // Format the global emotes in the expected structure
        const formattedGlobalEmotes = [
          {
            setInfo: {
              id: emoteGlobalData.id,
              name: emoteGlobalData.name,
              emote_count: emoteGlobalData.emote_count,
              capacity: emoteGlobalData.capacity,
            },
            emotes: emoteGlobalData.emotes.map((emote) => {
              return {
                id: emote.id,
                actor_id: emote.actor_id,
                flags: emote.flags,
                name: emote.name,
                alias: emote.data.name !== emote.name ? emote.data.name : null,
                owner: emote.data.owner,
                file: emote.data.host.files?.[0] || emote.data.host.files?.[1],
                added_timestamp: emote.timestamp,
                platform: "7tv",
                type: "global",
              };
            }),
            type: "global",
          },
        ];

        // Cache the result
        this.globalStvEmotesCache = formattedGlobalEmotes;

        console.log(`[ConnectionManager] ✅ Global 7TV emotes cached successfully (${emoteGlobalData.emotes.length} emotes)`);
        span.addEvent('cache_stored');
        span.setAttributes({
          'emote.count': emoteGlobalData.emotes.length,
          'emote.set_id': emoteGlobalData.id,
          'emote.set_name': emoteGlobalData.name
        });
      }

      span.setStatus({ code: 1 }); // SUCCESS
      return this.globalStvEmotesCache;

    } catch (error) {
      console.error("[ConnectionManager] ❌ Error fetching global 7TV emotes:", error);
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
    } finally {
      span.end();
    }
  }

  async fetchChatroomEmotes(chatroom) {
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
      return this.emoteCache.get(cacheKey);
    }

    try {
      console.log(`[ConnectionManager] Fetching emotes for ${chatroom.streamerData?.user?.username}`);
      span.addEvent('api_fetch_start');

      // Fetch Kick emotes
      const kickEmotes = await window.app.kick.getEmotes(chatroom.streamerData?.slug);
      span.addEvent('api_fetch_complete');

      // Cache the result
      this.emoteCache.set(cacheKey, kickEmotes);
      span.addEvent('cache_stored');
      
      span.setAttributes({
        'emote.count': Array.isArray(kickEmotes) ? kickEmotes.length : 0
      });
      span.setStatus({ code: 1 }); // SUCCESS

      await this.fetchChannel7TVEmotes(chatroom);

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
    if (!chatroom?.streamerData?.user_id) {
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

      // Ensure global emotes are cached before fetching channel emotes
      const cachedGlobalEmotes = await this.fetchGlobalStvEmotes();
      span.addEvent('global_emotes_ensured');

      const channel7TVEmotes = await window.app.stv.getChannelEmotes(chatroom.streamerData.user_id, cachedGlobalEmotes);
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
      kick: {
        state: this.kickPusher.getConnectionState(),
        chatrooms: this.kickPusher.getChatroomCount(),
        channels: this.kickPusher.getSubscribedChannelCount(),
      },
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

      if (!response?.data?.data) {
        console.log(`[ConnectionManager] No initial messages data for chatroom ${chatroom.id}`);
        return;
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
    } catch (error) {
      console.error(`[ConnectionManager] Error fetching initial messages for chatroom ${chatroom.id}:`, error);
    }
  }

  // Fetch initial chatroom info (including livestream status)
  async fetchInitialChatroomInfo(chatroom) {
    try {
      const chatroomData = await window.app.kick.getChannelChatroomInfo(chatroom.streamerData.slug);

      if (!chatroomData) {
        return;
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
    } catch (error) {
      console.error(`[ConnectionManager] Error fetching initial chatroom info for chatroom ${chatroom.id}:`, error);
    }
  }

  // Set deferred chatrooms for lazy loading
  setDeferredChatrooms(chatrooms) {
    this.deferredChatrooms = chatrooms || [];
    console.log(`[ConnectionManager] Set ${this.deferredChatrooms.length} chatrooms for deferred loading`);
  }

  // Auto-load deferred chatrooms in background (for mentions/notifications)
  async initializeDeferredChatroomsInBackground() {
    const span = tracer.startSpan('connection_manager.initialize_deferred_chatrooms', {
      attributes: {
        'chatroom.count': this.deferredChatrooms.length,
        'background_load': true
      }
    });

    try {
      if (this.deferredChatrooms.length === 0) {
        console.log('[ConnectionManager] No deferred chatrooms to load');
        span.addEvent('no_deferred_chatrooms');
        span.setStatus({ code: 1 });
        span.end();
        return;
      }

      console.log(`[ConnectionManager] 🔄 Starting background load of ${this.deferredChatrooms.length} deferred chatrooms...`);
      span.addEvent('background_load_started');

      // Process in batches to avoid overwhelming resources
      const batchSize = 2;
      const staggerDelayMs = 300;

      for (let i = 0; i < this.deferredChatrooms.length; i += batchSize) {
        const batch = this.deferredChatrooms.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(this.deferredChatrooms.length / batchSize);

        console.log(`[ConnectionManager] Loading batch ${batchNum}/${totalBatches} (${batch.length} chatrooms)...`);

        // Load batch in parallel
        const batchPromises = batch.map(chatroom =>
          this.initializeChatroomLazily(chatroom.id).catch(error => {
            console.warn(`[ConnectionManager] Failed to load chatroom ${chatroom.username}:`, error);
          })
        );

        await Promise.allSettled(batchPromises);

        // Stagger batches
        if (i + batchSize < this.deferredChatrooms.length) {
          await new Promise(resolve => setTimeout(resolve, staggerDelayMs));
        }
      }

      const loadedCount = this.loadedChatrooms.size;
      console.log(`[ConnectionManager] ✅ Background load complete! ${loadedCount} chatrooms now connected`);
      span.setAttribute('chatrooms.loaded', loadedCount);
      span.addEvent('background_load_complete');
      span.setStatus({ code: 1 });
    } catch (error) {
      console.error('[ConnectionManager] Error during background chatroom loading:', error);
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
    } finally {
      span.end();
    }
  }

  // Lazily initialize a single chatroom when first accessed
  async initializeChatroomLazily(chatroomId) {
    const span = tracer.startSpan('connection_manager.lazy_initialize_chatroom', {
      attributes: {
        'chatroom.id': chatroomId,
        'lazy_load': true
      }
    });

    try {
      // Check if already loaded
      if (this.loadedChatrooms.has(chatroomId)) {
        console.log(`[ConnectionManager] Chatroom ${chatroomId} already loaded`);
        span.addEvent('chatroom_already_loaded');
        span.end();
        return;
      }

      // Find the chatroom in deferred list
      const chatroom = this.deferredChatrooms.find(room => room.id === chatroomId);
      if (!chatroom) {
        console.log(`[ConnectionManager] Chatroom ${chatroomId} not in deferred list (already managed)`);
        this.loadedChatrooms.add(chatroomId);
        span.addEvent('chatroom_not_in_deferred_list_already_managed');
        span.setStatus({ code: 1 });
        span.end();
        return;
      }

      console.log(`[ConnectionManager] Lazy-loading chatroom: ${chatroom.username} (${chatroomId})`);
      span.addEvent('lazy_initialization_started');

      // Add to shared connections
      this.kickPusher.addChatroom(
        chatroom.id,
        chatroom.streamerData.id,
        chatroom,
      );

      // Only add to 7TV if we have valid IDs
      const stvId = chatroom.streamerData?.user?.stv_id || "0";
      const stvEmoteSetId = chatroom?.channel7TVEmotes?.[1]?.setInfo?.id || "0";
      this.stvWebSocket.addChatroom(chatroom.id, chatroom.streamerData.user_id, stvId, stvEmoteSetId);

      // Fetch initial data
      await this.fetchInitialMessages(chatroom);
      await this.fetchInitialChatroomInfo(chatroom);

      // Fetch emotes in background (non-blocking)
      this.fetchChatroomEmotes(chatroom).catch(error => {
        console.warn(`[ConnectionManager] Background emote fetch failed for ${chatroom.username}:`, error);
      });

      // Mark as loaded
      this.loadedChatrooms.add(chatroomId);

      console.log(`[ConnectionManager] ✅ Lazy-loaded chatroom ${chatroom.username} successfully`);
      span.addEvent('lazy_initialization_completed');
      span.setStatus({ code: 1 }); // SUCCESS

    } catch (error) {
      console.error(`[ConnectionManager] Error during lazy chatroom initialization for ${chatroomId}:`, error);
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
      throw error;
    } finally {
      span.end();
    }
  }

  // Check if chatroom is loaded
  isChatroomLoaded(chatroomId) {
    return this.loadedChatrooms.has(chatroomId);
  }

  // Get status of lazy loading
  getLazyLoadingStatus() {
    return {
      totalDeferredChatrooms: this.deferredChatrooms.length,
      loadedChatrooms: this.loadedChatrooms.size,
      pendingChatrooms: this.deferredChatrooms.length - this.loadedChatrooms.size
    };
  }

  // Cleanup method
  cleanup() {
    console.log("[ConnectionManager] Cleaning up connections...");
    this.kickPusher.close();
    this.stvWebSocket.close();
    this.emoteCache.clear();
    this.globalStvEmotesCache = null;
    this.channelStvEmoteCache.clear();
    this.deferredChatrooms = [];
    this.loadedChatrooms.clear();
    this.initializationInProgress = false;
  }
}

export default ConnectionManager;
