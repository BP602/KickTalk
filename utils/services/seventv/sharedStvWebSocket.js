// This shared websocket class optimizes 7TV connections by using a single WebSocket for all chatrooms
// Original websocket class originally made by https://github.com/Fiszh and edited by ftk789 and Drkness

const cosmetics = {
  paints: [],
  badges: [],
};

// Constants for ID validation
const INVALID_7TV_NULL_ID = "00000000000000000000000000"; // Known 7TV null ID pattern

const updateCosmetics = async (body) => {
  if (!body?.object) {
    return;
  }

  const { object } = body;

  if (object?.kind === "BADGE") {
    if (!object?.user) {
      const data = object.data;

      const foundBadge = cosmetics.badges.find(
        (badge) => badge && badge.id === (data && data.id === "00000000000000000000000000" ? data.ref_id : data.id),
      );

      if (foundBadge) {
        return;
      }

      const newBadge = {
        id: data.id === "00000000000000000000000000" ? data.ref_id || "default_id" : data.id,
        title: data.tooltip,
        url: `https:${data.host.url}/${data.host.files[data.host.files.length - 1].name}`,
      };
      cosmetics.badges.push(newBadge);
      console.log(`[Shared7TV] Added badge: ${newBadge.title}`);
    }
  } else if (object?.kind === "PAINT") {
    if (!object.user) {
      const data = object.data;

      const foundPaint = cosmetics.paints.find(
        (paint) => paint && paint.id === (data && data.id === "00000000000000000000000000" ? data.ref_id : data.id),
      );

      if (foundPaint) {
        return;
      }

      const randomColor = "#00f742";

      let push = {};

      if (data.stops.length) {
        const normalizedColors = data.stops.map((stop) => ({
          at: stop.at * 100,
          color: stop.color,
        }));

        const gradient = normalizedColors.map((stop) => `${argbToRgba(stop.color)} ${stop.at}%`).join(", ");

        if (data.repeat) {
          data.function = `repeating-${data.function}`;
        }

        data.function = data.function.toLowerCase().replace("_", "-");

        let isDeg_or_Shape = `${data.angle}deg`;

        if (data.function !== "linear-gradient" && data.function !== "repeating-linear-gradient") {
          isDeg_or_Shape = data.shape;
        }

        push = {
          id: data.id === "00000000000000000000000000" ? data.ref_id || "default_id" : data.id,
          name: data.name,
          style: data.function,
          shape: data.shape,
          backgroundImage:
            `${data.function || "linear-gradient"}(${isDeg_or_Shape}, ${gradient})` ||
            `${data.style || "linear-gradient"}(${data.shape || ""} 0deg, ${randomColor}, ${randomColor})`,
          shadows: null,
          KIND: "non-animated",
          url: data.image_url,
        };
      } else {
        push = {
          id: data.id === "00000000000000000000000000" ? data.ref_id || "default_id" : data.id,
          name: data.name,
          style: data.function,
          shape: data.shape,
          backgroundImage:
            `url('${[data.image_url]}')` ||
            `${data.style || "linear-gradient"}(${data.shape || ""} 0deg, ${randomColor}, ${randomColor})`,
          shadows: null,
          KIND: "animated",
          url: data.image_url,
        };
      }

      // SHADOWS
      let shadow = null;

      if (data.shadows.length) {
        const shadows = data.shadows;

        shadow = await shadows
          .map((shadow) => {
            let rgbaColor = argbToRgba(shadow.color);

            rgbaColor = rgbaColor.replace(/rgba\((\d+), (\d+), (\d+), (\d+(\.\d+)?)\)/, `rgba($1, $2, $3)`);

            return `drop-shadow(${rgbaColor} ${shadow.x_offset}px ${shadow.y_offset}px ${shadow.radius}px)`;
          })
          .join(" ");

        push["shadows"] = shadow;
      }

      cosmetics.paints.push(push);
      console.log(`[Shared7TV] Added paint: ${push.name}`);
    }
  } else if (
    object?.name === "Personal Emotes" ||
    object?.name === "Personal Emotes Set" ||
    object?.user ||
    object?.id === "00000000000000000000000000" ||
    (object?.flags && (object.flags === 11 || object.flags === 4))
  ) {
    if (object?.id === "00000000000000000000000000" && object?.ref_id) {
      object.id = object.ref_id;
    }
  } else {
    console.log("[Shared7TV] Didn't process cosmetics:", body);
  }
};

// OpenTelemetry instrumentation
let tracer;
try {
  const { trace } = require('@opentelemetry/api');
  tracer = trace.getTracer('kicktalk-shared-7tv-websocket', '1.0.0');
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

class SharedStvWebSocket extends EventTarget {
  constructor() {
    super();
    this.startDelay = 1000;
    this.maxRetrySteps = 5;
    this.reconnectAttempts = 0;
    this.chat = null;
    this.shouldReconnect = true;
    this.connectionState = 'disconnected'; // disconnected, connecting, connected
    this.chatrooms = new Map(); // Map of chatroomId -> channel data
    this.subscribedEvents = new Set(); // Track subscribed events
    this.userEventSubscribed = false; // Track global user events
    this.connectionSpan = null; // Track current connection span
  }

  addChatroom(chatroomId, channelKickID, stvId = "0", stvEmoteSetId = "0", chatroomData = null) {
    // Store all available ID variants for diagnostic subscriptions
    const storedData = {
      channelKickID: String(channelKickID),
      stvId,
      stvEmoteSetId,
    };

    // Add additional ID variants if chatroomData is provided
    if (chatroomData) {
      storedData.idVariants = {
        chatroom_id: String(chatroomId),
        streamer_id: String(channelKickID), // This is chatroomData.streamerData.id
        streamer_user_id: chatroomData.streamerData?.user_id ? String(chatroomData.streamerData.user_id) : null,
        username: chatroomData.streamerData?.username || null,
        user_username: chatroomData.streamerData?.user?.username || null,
        slug: chatroomData.slug || null,
      };
    } else {
      // Fallback for legacy calls - just store the basic IDs
      storedData.idVariants = {
        chatroom_id: String(chatroomId),
        streamer_id: String(channelKickID),
      };
    }

    this.chatrooms.set(chatroomId, storedData);

    console.log(
      `[Shared7TV]: Registered chatroom ${chatroomId} (kick=${channelKickID}, stvUser=${stvId}, stvSet=${stvEmoteSetId})`,
    );

    // If we're already connected, subscribe to this chatroom's events
    console.log(`[Shared7TV DIAGNOSTIC]: addChatroom called for ${chatroomId}`, {
      connectionState: this.connectionState,
      willSubscribe: this.connectionState === 'connected',
      totalChatrooms: this.chatrooms.size,
      channelKickID: channelKickID
    });

    if (this.connectionState === 'connected') {
      console.log(`[Shared7TV DIAGNOSTIC]: Subscribing to events for new chatroom ${chatroomId}`);
      this.subscribeToChatroomEvents(chatroomId);
    } else {
      console.log(`[Shared7TV DIAGNOSTIC]: WebSocket not connected (${this.connectionState}), will subscribe when connected`);
    }
  }

  removeChatroom(chatroomId) {
    const chatroomData = this.chatrooms.get(chatroomId);
    if (chatroomData && this.connectionState === 'connected') {
      this.unsubscribeFromChatroomEvents(chatroomId);
    }
    this.chatrooms.delete(chatroomId);

    // If no more chatrooms, close the connection
    if (this.chatrooms.size === 0) {
      this.close();
    }
  }

  connect() {
    if (!this.shouldReconnect) {
      console.log(`[Shared7TV]: Not connecting to WebSocket - reconnect disabled`);
      return;
    }

    if (this.connectionState === 'connecting' || this.connectionState === 'connected') {
      console.log("[Shared7TV]: Already connecting/connected");
      return;
    }

    // Start OpenTelemetry span for 7TV WebSocket connection
    this.connectionSpan = tracer.startSpan('seventv_websocket_connection', {
      attributes: {
        'websocket.url': 'wss://events.7tv.io/v3',
        'websocket.protocol': '7tv-events',
        'websocket.type': 'pooled_shared',
        'connection.chatroom_count': this.chatrooms.size,
        'connection.attempt': this.reconnectAttempts + 1,
        'connection.max_attempts': this.maxRetrySteps,
        'seventv.app': 'kicktalk',
        'seventv.version': '420.69'
      }
    });

    this.connectionState = 'connecting';
    console.log(`[Shared7TV]: Connecting to WebSocket for ${this.chatrooms.size} chatrooms (attempt ${this.reconnectAttempts + 1})`);
    
    this.connectionSpan.addEvent('websocket_connection_started', {
      chatroom_count: this.chatrooms.size,
      connection_state: 'connecting'
    });

    this.chat = new WebSocket("wss://events.7tv.io/v3?app=kicktalk&version=420.69");

    this.chat.onerror = (event) => {
      console.log(`[Shared7TV]: WebSocket error:`, event);
      this.connectionState = 'disconnected';
      this.handleConnectionError();

      // Complete the connection span with error
      if (this.connectionSpan) {
        this.connectionSpan.addEvent('websocket_connection_error', {
          error_type: event.type || 'Unknown WebSocket error',
          connection_state: 'disconnected'
        });
        this.connectionSpan.setAttributes({
          'connection.success': false,
          'connection.error': event.type || 'Unknown error',
          'connection.state': 'disconnected'
        });
        this.connectionSpan.recordException(new Error(`7TV WebSocket error: ${event.type || 'Unknown'}`));
        this.connectionSpan.setStatus({ code: 2, message: event.type || 'WebSocket error' }); // ERROR
        this.connectionSpan.end();
        this.connectionSpan = null;
      }

      // Telemetry: record connection error + reconnection intent for all chatrooms
      try {
        for (const [chatroomId] of this.chatrooms) {
          window.app?.telemetry?.recordConnectionError?.(chatroomId, 'stv_ws_error');
          window.app?.telemetry?.recordReconnection?.(chatroomId, 'stv_ws_error');
        }
      } catch (_) {}
    };

    this.chat.onclose = (event) => {
      console.log(`[Shared7TV]: WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
      this.connectionState = 'disconnected';
      this.subscribedEvents.clear();
      this.userEventSubscribed = false;

      // Complete the connection span if still active
      if (this.connectionSpan) {
        this.connectionSpan.addEvent('websocket_connection_closed', {
          close_code: event.code,
          close_reason: event.reason || 'Unknown',
          was_clean: event.wasClean,
          connection_state: 'disconnected'
        });
        this.connectionSpan.setAttributes({
          'connection.success': false,
          'connection.close_code': event.code,
          'connection.close_reason': event.reason || 'Connection closed',
          'connection.was_clean': event.wasClean,
          'connection.state': 'disconnected'
        });
        this.connectionSpan.setStatus({ code: 2, message: `Connection closed: ${event.reason || 'Unknown'}` }); // ERROR
        this.connectionSpan.end();
        this.connectionSpan = null;
      }

      // Telemetry: mark disconnected and maybe reconnection
      try {
        for (const [chatroomId] of this.chatrooms) {
          window.app?.telemetry?.recordWebSocketConnection?.(chatroomId, null, false, `stv_${chatroomId}`);
          if (this.shouldReconnect) {
            window.app?.telemetry?.recordReconnection?.(chatroomId, 'stv_ws_close');
          }
        }
      } catch (_) {}
      
      // Don't reconnect if we're getting persistent Invalid Payload errors
      if (event.code === 1008 && event.reason === "Invalid Payload") {
        console.log(`[Shared7TV]: Invalid Payload error - checking for valid 7TV data before reconnecting`);
        const hasValidData = Array.from(this.chatrooms.values()).some(data =>
          data.stvId && data.stvId !== "0" && data.stvId !== INVALID_7TV_NULL_ID
        );
        if (!hasValidData) {
          console.log(`[Shared7TV]: No valid 7TV data found - stopping reconnection attempts`);
          return;
        }
      }
      
      this.handleReconnection();
    };

    this.chat.onopen = async () => {
      console.log(`[Shared7TV]: Connection opened successfully`);
      this.connectionState = 'connected';
      this.reconnectAttempts = 0;

      // Complete the connection span successfully
      if (this.connectionSpan) {
        this.connectionSpan.addEvent('websocket_connection_opened', {
          connection_state: 'connected',
          chatroom_count: this.chatrooms.size
        });
        this.connectionSpan.setAttributes({
          'connection.success': true,
          'connection.state': 'connected'
        });
        this.connectionSpan.setStatus({ code: 1 }); // SUCCESS
        this.connectionSpan.end();
        this.connectionSpan = null;
      }

      // Telemetry: mark connected for all chatrooms
      try {
        for (const [chatroomId] of this.chatrooms) {
          window.app?.telemetry?.recordWebSocketConnection?.(chatroomId, null, true, `stv_${chatroomId}`);
        }
      } catch (_) {}

      await this.delay(1000);

      // Subscribe to events for all chatrooms
      console.log(`[Shared7TV]: Starting subscription to all events for ${this.chatrooms.size} chatrooms`);
      try {
        window.app?.telemetry?.recordWebSocketEvent?.('7tv_shared', 'subscription_start', {
          chatroom_count: this.chatrooms.size
        });
      } catch (_) {}
      await this.subscribeToAllEvents();
      console.log(`[Shared7TV]: Finished subscribing to all events`);
      try {
        window.app?.telemetry?.recordWebSocketEvent?.('7tv_shared', 'subscription_complete', {
          chatroom_count: this.chatrooms.size,
          subscribed_events: this.subscribedEvents.size
        });
      } catch (_) {}

      // Setup message handler
      console.log(`[Shared7TV]: Setting up message handler`);
      this.setupMessageHandler();
      console.log(`[Shared7TV]: Message handler setup complete`);

      // Dispatch connection event
      this.dispatchEvent(
        new CustomEvent("connection", {
          detail: {
            type: "system",
            content: "connection-success",
            chatrooms: Array.from(this.chatrooms.keys()),
          },
        }),
      );
    };
  }

  handleConnectionError() {
    this.reconnectAttempts++;
    console.log(`[Shared7TV]: Connection error. Attempt ${this.reconnectAttempts}`);
    try {
      window.app?.telemetry?.recordWebSocketError?.('7tv_shared', 'connection_error', {
        attempt: this.reconnectAttempts,
        chatroom_count: this.chatrooms.size
      });
    } catch (_) {}
  }

  handleReconnection() {
    if (!this.shouldReconnect) {
      console.log(`[Shared7TV]: Reconnection disabled`);
      try {
        window.app?.telemetry?.recordWebSocketEvent?.('7tv_shared', 'reconnection_disabled', {
          attempt: this.reconnectAttempts
        });
      } catch (_) {}
      return;
    }

    // exponential backoff: start * 2^(step-1)
    // cap at maxRetrySteps, so after step 5 it stays at start * 2^(maxRetrySteps-1)
    const step = Math.min(this.reconnectAttempts, this.maxRetrySteps);
    const delay = this.startDelay * Math.pow(2, step - 1);

    console.log(`[Shared7TV]: Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    try {
      window.app?.telemetry?.recordWebSocketEvent?.('7tv_shared', 'reconnection_scheduled', {
        attempt: this.reconnectAttempts + 1,
        delay_ms: delay,
        step: step
      });
    } catch (_) {}

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  async subscribeToAllEvents() {
    // Subscribe to user events (only once for all chatrooms)
    await this.subscribeToUserEvents();

    // Subscribe to events for each chatroom
    for (const [chatroomId] of this.chatrooms) {
      await this.subscribeToChatroomEvents(chatroomId);
    }
  }

  async subscribeToChatroomEvents(chatroomId) {
    console.log(`[Shared7TV DIAGNOSTIC]: subscribeToChatroomEvents called for ${chatroomId}`);

    const chatroomData = this.chatrooms.get(chatroomId);
    if (!chatroomData) {
      console.log(`[Shared7TV]: Chatroom ${chatroomId} not found`);
      return;
    }

    console.log(
      `[Shared7TV]: Preparing subscriptions for chatroom ${chatroomId} (kick=${chatroomData.channelKickID}, emoteSet=${chatroomData.stvEmoteSetId})`,
    );

    const { channelKickID, stvEmoteSetId } = chatroomData;

    // Validate IDs for specific subscriptions
    const hasValidChannelKickID = channelKickID && channelKickID !== "0" && typeof channelKickID === "string";
    const hasValidEmoteSetId = stvEmoteSetId && stvEmoteSetId !== "0" && stvEmoteSetId !== INVALID_7TV_NULL_ID;
    
    // Subscribe to cosmetic and entitlement events if we have a valid Kick channel ID
    if (hasValidChannelKickID) {
      await this.subscribeToCosmeticEvents(chatroomId, channelKickID);
      await this.subscribeToEntitlementEvents(chatroomId, channelKickID);
    } else {
      console.log(`[Shared7TV]: No valid Kick channel ID for chatroom ${chatroomId} (channelKickID: ${channelKickID}) - skipping cosmetic/entitlement subscriptions`);
    }

    // Subscribe to emote set events only if we have valid emote set ID
    if (hasValidEmoteSetId) {
      await this.subscribeToEmoteSetEvents(chatroomId, stvEmoteSetId);
    } else {
      console.log(`[Shared7TV]: No valid emote set ID for chatroom ${chatroomId} (setId: ${stvEmoteSetId}) - skipping emote set subscription`);
    }
  }

  unsubscribeFromChatroomEvents(chatroomId) {
    // Note: 7TV doesn't have explicit unsubscribe, so we just remove tracking
    // The events will be filtered out in the message handler
    console.log(`[Shared7TV]: Unsubscribing events for chatroom ${chatroomId}`);
  }

  /**
   * Subscribe to user events (global, only once)
   */
  async subscribeToUserEvents() {
    if (this.userEventSubscribed || !this.chat || this.chat.readyState !== WebSocket.OPEN) {
      return;
    }

    // Find any chatroom with a valid 7TV user ID
    const chatroomWithStvId = Array.from(this.chatrooms.values()).find(data => 
      data.stvId && data.stvId !== "0" && data.stvId !== INVALID_7TV_NULL_ID
    );
    if (!chatroomWithStvId) {
      console.log(`[Shared7TV]: No valid 7TV user ID found for user events (skipping subscription)`);
      return;
    }

    const eventKey = `user.*:${chatroomWithStvId.stvId}`;
    if (this.subscribedEvents.has(eventKey)) {
      return;
    }

    const subscribeUserMessage = {
      op: 35,
      d: {
        type: "user.*",
        condition: { object_id: chatroomWithStvId.stvId },
      },
    };

    this.chat.send(JSON.stringify(subscribeUserMessage));
    this.subscribedEvents.add(eventKey);
    this.userEventSubscribed = true;
    console.log(`[Shared7TV]: Subscribed to user.* events with stvId: ${chatroomWithStvId.stvId}`);
  }

  /**
   * Subscribe to cosmetic events for a specific chatroom (using wildcard like Firefox extension)
   */
  async subscribeToCosmeticEvents(chatroomId, channelKickID) {
    if (!this.chat || this.chat.readyState !== WebSocket.OPEN) {
      console.log(`[Shared7TV]: Cannot subscribe to cosmetic events - WebSocket not ready. State: ${this.chat?.readyState}`);
      return;
    }

    const eventKey = `cosmetic.*:${channelKickID}`;
    if (this.subscribedEvents.has(eventKey)) {
      console.log(`[Shared7TV]: Cosmetic subscription already exists for channel ${channelKickID}`);
      return;
    }

    const subscribeCosmeticAll = {
      op: 35,
      d: {
        type: "cosmetic.*",
        condition: { ctx: "channel", platform: "KICK", id: channelKickID },
      },
    };

    console.log(`[Shared7TV]: Subscribing to cosmetic.* events for channel ${channelKickID}`);
    this.chat.send(JSON.stringify(subscribeCosmeticAll));
    this.subscribedEvents.add(eventKey);
  }

  /**
   * Subscribe to entitlement events for a specific chatroom (using wildcard like Firefox extension)
   */
  async subscribeToEntitlementEvents(chatroomId, channelKickID) {
    if (!this.chat || this.chat.readyState !== WebSocket.OPEN) {
      console.log(`[Shared7TV]: Cannot subscribe to entitlement events - WebSocket not ready. State: ${this.chat?.readyState}`);
      return;
    }

    const eventKey = `entitlement.*:${channelKickID}`;
    if (this.subscribedEvents.has(eventKey)) {
      console.log(`[Shared7TV]: Entitlement subscription already exists for channel ${channelKickID}`);
      return;
    }

    const subscribeEntitlementAll = {
      op: 35,
      d: {
        type: "entitlement.*",
        condition: { ctx: "channel", platform: "KICK", id: channelKickID },
      },
    };

    console.log(`[Shared7TV]: Subscribing to entitlement.* events for channel ${channelKickID}`);
    this.chat.send(JSON.stringify(subscribeEntitlementAll));
    this.subscribedEvents.add(eventKey);

    this.dispatchEvent(new CustomEvent("open", { detail: { body: "SUBSCRIBED", type: "entitlement.*" } }));
  }

  /**
   * Subscribe to emote set events for a specific chatroom
   */
  async subscribeToEmoteSetEvents(chatroomId, stvEmoteSetId) {
    if (!this.chat || this.chat.readyState !== WebSocket.OPEN) {
      console.log(`[Shared7TV]: Cannot subscribe to emote set events - WebSocket not ready`);
      return;
    }

    // Validate emote set ID
    if (!stvEmoteSetId || stvEmoteSetId === "0" || stvEmoteSetId === INVALID_7TV_NULL_ID) {
      console.log(`[Shared7TV]: Invalid emote set ID "${stvEmoteSetId}" for chatroom ${chatroomId} (skipping subscription)`);
      return;
    }

    const eventKey = `emote_set.*:${stvEmoteSetId}`;
    if (this.subscribedEvents.has(eventKey)) {
      return;
    }

    const subscribeAllEmoteSets = {
      op: 35,
      d: {
        type: "emote_set.*",
        condition: { object_id: stvEmoteSetId },
      },
    };

    this.chat.send(JSON.stringify(subscribeAllEmoteSets));
    this.subscribedEvents.add(eventKey);
    console.log(`[Shared7TV]: Subscribed to emote_set.* events for chatroom ${chatroomId} with setId: ${stvEmoteSetId}`);
  }

  setupMessageHandler() {
    this.chat.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        // Only log non-heartbeat messages
        if (msg?.op !== 2) {
          console.log(`[Shared7TV]: Message received:`, {
            op: msg?.op,
            type: msg?.d?.type,
            hasBody: !!msg?.d?.body
          });
        }

        // Handle different 7TV opcodes
        switch (msg?.op) {
          case 0: // Dispatch (actual events)
            try {
              window.app?.telemetry?.recordWebSocketMessage?.('7tv_shared', 'dispatch', msg?.d?.type);
            } catch (_) {}
            break; // Break here to continue to event processing logic below the switch statement
          case 1: // Hello (connection established)
            console.log(`[Shared7TV]: Hello received`, {
              heartbeat_interval: msg?.d?.heartbeat_interval,
              session_id: msg?.d?.session_id
            });
            try {
              window.app?.telemetry?.recordWebSocketMessage?.('7tv_shared', 'hello', null, {
                heartbeat_interval: msg?.d?.heartbeat_interval,
                has_session_id: !!msg?.d?.session_id
              });
            } catch (_) {}
            return;
          case 2: // Heartbeat
            console.log(`[Shared7TV]: Heartbeat received`, { count: msg?.d?.count });
            try {
              window.app?.telemetry?.recordWebSocketMessage?.('7tv_shared', 'heartbeat', null, {
                count: msg?.d?.count
              });
            } catch (_) {}
            return; // Don't process heartbeats further
          case 4: // Reconnect (server requests reconnection)
            console.log(`[Shared7TV]: Reconnect request received`, msg?.d);
            try {
              window.app?.telemetry?.recordWebSocketMessage?.('7tv_shared', 'reconnect', null, {
                reason: msg?.d?.reason
              });
            } catch (_) {}
            // Handle reconnection logic if needed
            return;
          case 5: // Ack (acknowledgment)
            console.log(`[Shared7TV]: ACK received`, {
              command: msg?.d?.command,
              type: msg?.d?.data?.type,
              id: msg?.d?.data?.id
            });
            try {
              window.app?.telemetry?.recordWebSocketMessage?.('7tv_shared', 'ack', msg?.d?.data?.type, {
                command: msg?.d?.command
              });
            } catch (_) {}
            return;
          case 6: // Error
            console.error(`[Shared7TV]: Error received`, {
              message: msg?.d?.message,
              code: msg?.d?.code,
              data: msg?.d?.data
            });
            try {
              window.app?.telemetry?.recordWebSocketError?.('7tv_shared', msg?.d?.message, {
                code: msg?.d?.code,
                data: msg?.d?.data
              });
            } catch (_) {}
            return;
          case 7: // EndOfStream
            console.log(`[Shared7TV]: End of stream received`, msg?.d);
            try {
              window.app?.telemetry?.recordWebSocketMessage?.('7tv_shared', 'end_of_stream', null, msg?.d);
            } catch (_) {}
            return;
          case 33: // Identify (client authentication)
            console.log(`[Shared7TV]: Identify opcode (should not be received by client)`, msg);
            try {
              window.app?.telemetry?.recordWebSocketMessage?.('7tv_shared', 'identify_unexpected', null);
            } catch (_) {}
            return;
          case 34: // Resume (session resumption)
            console.log(`[Shared7TV]: Resume opcode (should not be received by client)`, msg);
            try {
              window.app?.telemetry?.recordWebSocketMessage?.('7tv_shared', 'resume_unexpected', null);
            } catch (_) {}
            return;
          case 35: // Subscribe (subscription request)
            console.log(`[Shared7TV]: Subscribe opcode (should not be received by client)`, msg);
            try {
              window.app?.telemetry?.recordWebSocketMessage?.('7tv_shared', 'subscribe_unexpected', null);
            } catch (_) {}
            return;
          case 36: // Unsubscribe (unsubscription request)
            console.log(`[Shared7TV]: Unsubscribe opcode (should not be received by client)`, msg);
            try {
              window.app?.telemetry?.recordWebSocketMessage?.('7tv_shared', 'unsubscribe_unexpected', null);
            } catch (_) {}
            return;
          case 37: // Signal
            console.log(`[Shared7TV]: Signal received`, msg?.d);
            try {
              window.app?.telemetry?.recordWebSocketMessage?.('7tv_shared', 'signal', null, msg?.d);
            } catch (_) {}
            return;
          case 38: // Bridge (deprecated)
            console.log(`[Shared7TV]: Bridge opcode received (deprecated)`, msg);
            try {
              window.app?.telemetry?.recordWebSocketMessage?.('7tv_shared', 'bridge_deprecated', null);
            } catch (_) {}
            return;
          default:
            console.log(`[Shared7TV]: Unknown opcode ${msg?.op}:`, msg);
            try {
              window.app?.telemetry?.recordWebSocketMessage?.('7tv_shared', 'unknown_opcode', null, {
                opcode: msg?.op
              });
            } catch (_) {}
            return;
        }

        // Only process dispatch events (op: 0) that have a body
        if (!msg?.d?.body) {
          console.log(`[Shared7TV]: Dispatch event has no body, skipping:`, msg);
          return;
        }

        const { body, type } = msg.d;

        // Log cosmetic-related events (condensed)
        if (type?.includes('cosmetic') || type?.includes('entitlement')) {
          console.log(`[Shared7TV]: ${type} event for ${body?.object?.user?.username || 'unknown'}`);
        }

        // Find which chatroom this event belongs to
        const chatroomId = this.findChatroomForEvent(body, type);

        console.log(
          `[Shared7TV]: Received ${type} for ${chatroomId === null ? 'broadcast' : `chatroom ${chatroomId}`}`,
          {
            channelContext: body?.context || body?.condition || null,
            entitlementUser: body?.object?.user?.username,
          },
        );

        switch (type) {
          case "user.update":
            console.log(`[Shared7TV]: Dispatching user.update event for chatroomId: ${chatroomId}`);
            this.dispatchEvent(
              new CustomEvent("message", {
                detail: {
                  body,
                  type: "user.update",
                  chatroomId,
                },
              }),
            );
            break;

          case "emote_set.update":
            console.log(`[Shared7TV]: Dispatching emote_set.update event for chatroomId: ${chatroomId}`);
            this.dispatchEvent(
              new CustomEvent("message", {
                detail: {
                  body,
                  type: "emote_set.update",
                  chatroomId,
                },
              }),
            );
            break;

          case "cosmetic.create":
            updateCosmetics(body);

            this.dispatchEvent(
              new CustomEvent("message", {
                detail: {
                  body: cosmetics,
                  type: "cosmetic.create",
                  chatroomId,
                },
              }),
            );
            break;

          case "entitlement.create":
            // Process entitlements for both cosmetics (kind 10) and emote sets (kind 5)
            if (body.kind === 10 || body.kind === 5) {
              this.dispatchEvent(
                new CustomEvent("message", {
                  detail: {
                    body,
                    type: "entitlement.create",
                    chatroomId,
                  },
                }),
              );
            }
            break;

          case "entitlement.delete":
            this.dispatchEvent(
              new CustomEvent("message", {
                detail: {
                  body,
                  type: "entitlement.delete",
                  chatroomId,
                },
              }),
            );
            break;
        }
      } catch (error) {
        console.log("[Shared7TV] Error parsing message:", error);
      }
    };
  }

  findChatroomForEvent(body, type) {
    // Try to identify which chatroom this event belongs to

    // For user events, broadcast to all chatrooms
    if (type.startsWith("user.")) {
      return null; // null means broadcast to all chatrooms
    }

    // For emote_set events, find chatroom by emote set ID
    if (type.startsWith("emote_set.") && body?.id) {
      for (const [chatroomId, data] of this.chatrooms) {
        if (data.stvEmoteSetId === body.id) {
          return chatroomId;
        }
      }
    }

    // For cosmetic and entitlement events, check all ID variants to see which subscription received this
    if (type.startsWith("cosmetic.") || type.startsWith("entitlement.")) {
      const contextId = body?.context?.id || body?.condition?.id || null;

      if (contextId) {
        // Check each chatroom's ID variants to see which one matches
        for (const [chatroomId, data] of this.chatrooms) {
          const idVariants = data.idVariants || {};

          for (const [idType, idValue] of Object.entries(idVariants)) {
            if (idValue && String(idValue) === String(contextId)) {
              return chatroomId;
            }
          }
        }
      }
    }

    return null;
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  close() {
    console.log(`[Shared7TV]: Closing shared connection`);
    this.shouldReconnect = false;
    this.connectionState = 'disconnected';

    if (this.chat) {
      try {
        if (this.chat.readyState === WebSocket.OPEN || this.chat.readyState === WebSocket.CONNECTING) {
          console.log(`[Shared7TV]: WebSocket state: ${this.chat.readyState}, closing...`);
          this.chat.close();
        }
        this.chat = null;
        this.subscribedEvents.clear();
        this.userEventSubscribed = false;
        console.log(`[Shared7TV]: Shared connection closed`);
      } catch (error) {
        console.error(`[Shared7TV]: Error during closing of connection:`, error);
      }
    } else {
      console.log(`[Shared7TV]: No active connection to close`);
    }
  }

  // Get connection status
  getConnectionState() {
    return this.connectionState;
  }

  // Get number of subscribed events
  getSubscribedEventCount() {
    return this.subscribedEvents.size;
  }

  // Get number of chatrooms
  getChatroomCount() {
    return this.chatrooms.size;
  }
}

const argbToRgba = (color) => {
  if (color < 0) {
    color = color >>> 0;
  }

  const red = (color >> 24) & 0xff;
  const green = (color >> 16) & 0xff;
  const blue = (color >> 8) & 0xff;
  return `rgba(${red}, ${green}, ${blue}, 1)`;
};

export default SharedStvWebSocket;