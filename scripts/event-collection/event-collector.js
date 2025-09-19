#!/usr/bin/env node

const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');

/**
 * Kick Event Collector
 * Connects to popular Kick channels via WebSocket and logs all events for analysis
 */

class KickEventCollector {
  constructor() {
    this.ws = null;
    this.socketId = null;
    this.connectedChannels = new Set();
    this.eventCount = 0;
    this.logFile = `kick-events-${new Date().toISOString().slice(0, 10)}.jsonl`;
    this.lastEventTime = Date.now();
    this.heartbeatInterval = null;
    this.reconnectTimer = null;
    this.connecting = false;
    this.statusInterval = null;

    // Smart sampling state
    this.eventTypeCounts = new Map();
    this.lastRegularMessageTime = 0;
    this.lastReplyMessageTime = 0;
    this.regularMessageInterval = 60 * 60 * 1000; // Sample regular messages every hour
    this.replyMessageInterval = 60 * 60 * 1000; // Sample reply messages every hour
    this.savedEventCount = 0;
    this.skippedEventCount = 0;
    
    // Real IDs provided by user - mix of chatroom IDs and streamer IDs
    this.allRealIds = [
      1466067, 668, 2915525, 2907820, 2587387, 2579856, 67262278, 66973867, 10127341, 9975231,
      2381527, 27670567, 875396, 875062, 35211, 35210, 5541527, 5512091
    ];
    
    this.channelData = new Map();
    
    // Since we don't know which IDs are chatroom vs streamer IDs,
    // we'll subscribe to both patterns for each ID
    this.allRealIds.forEach((id, index) => {
      this.channelData.set(`id_${id}`, { 
        id: id,
        slug: `id_${id}` 
      });
    });
  }

  scheduleReconnect(delayMs = 5000) {
    if (this.connecting || (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING))) {
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;

      if (this.connecting || (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING))) {
        return;
      }

      console.log('Attempting to reconnect...');
      this.connect();
    }, delayMs);
  }

  async fetchChannelData(slug) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'kick.com',
        path: `/api/v2/channels/${slug}`,
        method: 'GET',
        headers: {
          'User-Agent': 'KickEventCollector/1.0',
          'Accept': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            if (jsonData.data) {
              resolve({
                streamerId: jsonData.data.id,
                chatroomId: jsonData.data.chatroom.id,
                livestreamId: jsonData.data.livestream?.id,
                slug: jsonData.data.slug,
                username: jsonData.data.username,
                isLive: jsonData.data.livestream !== null
              });
            } else {
              reject(new Error(`No data for ${slug}: ${data}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error(`Timeout fetching ${slug}`));
      });

      req.end();
    });
  }

  async loadChannelData() {
    console.log('Using provided IDs (mix of chatroom and streamer IDs)...');
    console.log(`Loaded ${this.channelData.size} IDs to monitor`);
    
    // Print the IDs we'll monitor
    for (const [, data] of this.channelData) {
      console.log(`✓ ID ${data.id} - will try both streamer and chatroom patterns`);
    }
    console.log('');
  }

  connect() {
    if (this.connecting) {
      return;
    }
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.connecting = true;
    console.log('Connecting to Kick WebSocket...');

    this.ws = new WebSocket(
      "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false"
    );

    this.ws.on('open', () => {
      console.log('✓ Connected to Kick WebSocket');
      this.connecting = false;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.startHeartbeat();
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing message:', error.message);
      }
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.connecting = false;
    });

    this.ws.on('close', () => {
      console.log('WebSocket connection closed');
      this.stopHeartbeat();
      this.connecting = false;
      this.scheduleReconnect();
    });
  }

  handleMessage(message) {
    // Handle connection establishment
    if (message.event === "pusher:connection_established") {
      const data = JSON.parse(message.data);
      this.socketId = data.socket_id;
      console.log(`✓ Connection established. Socket ID: ${this.socketId}`);
      
      // Start subscribing to channels
      setTimeout(() => {
        this.subscribeToChannels();
      }, 1000);
      return;
    }

    // Handle subscription success
    if (message.event === "pusher_internal:subscription_succeeded") {
      this.connectedChannels.add(message.channel);
      console.log(`✓ Subscribed to: ${message.channel}`);
      return;
    }

    // Log all interesting events
    if (this.isInterestingEvent(message)) {
      this.logEvent(message);
    }
  }

  subscribeToChannels() {
    console.log('\nSubscribing to channels...');
    
    // For each ID, subscribe to both streamer channel patterns AND chatroom patterns
    // since we don't know which type each ID is
    for (const [, data] of this.channelData) {
      const channels = [
        // Streamer channel patterns (in case this ID is a streamer ID)
        `channel_${data.id}`,
        `channel.${data.id}`,
        // Chatroom patterns (in case this ID is a chatroom ID)  
        `chatrooms.${data.id}`,
        `chatrooms.${data.id}.v2`,
        `chatroom_${data.id}`
      ];

      channels.forEach(channel => {
        this.subscribe(channel);
      });

      console.log(`Subscribed to all patterns for ID ${data.id}`);
    }
    
    console.log(`Total subscriptions: ${this.channelData.size * 5} = ${this.channelData.size * 5} channels`);
  }

  subscribe(channel) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        event: "pusher:subscribe",
        data: { auth: "", channel }
      }));
    }
  }

  isInterestingEvent(message) {
    // Skip internal Pusher events only - capture EVERYTHING else
    if (message.event && message.event.startsWith('pusher')) {
      return false;
    }

    // Log all non-pusher events to catch new event types early
    return message.event && message.event.length > 0;
  }

  getDetailedEventType(event, data) {
    const baseEventType = event;

    // Enhanced classification for ChatMessageEvent
    if (baseEventType === 'App\\Events\\ChatMessageEvent' && data) {
      if (data.type) {
        if (data.type === 'celebration' && data.metadata?.celebration?.type) {
          const celebrationType = data.metadata.celebration.type;
          return `App\\Events\\ChatMessageEvent (${data.type} - ${celebrationType})`;
        }
        if (data.type === 'message') {
          const isReply = Boolean(
            data.metadata?.reply_to ||
            data.metadata?.replied_to ||
            data.metadata?.reply ||
            data.metadata?.parent_message_id
          );
          return `App\\Events\\ChatMessageEvent (${isReply ? 'reply' : 'regular'})`;
        }
        return `App\\Events\\ChatMessageEvent (${data.type})`;
      }
    }

    return baseEventType;
  }

  shouldSampleEvent(eventType, data) {
    const now = Date.now();

    // Always sample rare/important events (not regular or reply)
    if (!eventType.includes('(regular)') && !eventType.includes('(reply)')) {
      return true;
    }

    // For regular messages, sample every hour
    if (eventType.includes('(regular)')) {
      if (now - this.lastRegularMessageTime >= this.regularMessageInterval) {
        this.lastRegularMessageTime = now;
        return true;
      }
      return false;
    }

    // For reply messages, sample every hour
    if (eventType.includes('(reply)')) {
      if (now - this.lastReplyMessageTime >= this.replyMessageInterval) {
        this.lastReplyMessageTime = now;
        return true;
      }
      return false;
    }

    return false;
  }

  logEvent(message) {
    this.eventCount++;
    this.lastEventTime = Date.now();

    let data = null;
    let rawData = null;
    let dataParseError = null;
    let sanitizedMessage = message;
    if (message.data) {
      rawData = message.data;
      try {
        data = JSON.parse(rawData);
      } catch (error) {
        dataParseError = error.message;
        console.warn('Captured event with invalid JSON payload', {
          event: message.event,
          channel: message.channel,
          error: dataParseError,
        });
      }
    }

    const MAX_RAW_LEN = 50_000;
    if (rawData && rawData.length > MAX_RAW_LEN) {
      rawData = `${rawData.slice(0, MAX_RAW_LEN)}…(truncated)`;
    }
    if (rawData !== null) {
      sanitizedMessage = { ...message, data: rawData };
    }
    const detailedEventType = this.getDetailedEventType(message.event, data);

    // Update event type counts
    this.eventTypeCounts.set(detailedEventType, (this.eventTypeCounts.get(detailedEventType) || 0) + 1);

    // Smart sampling decision
    if (!this.shouldSampleEvent(detailedEventType, data)) {
      // Still count and log to console, but don't write to file
      this.skippedEventCount++;
      console.log(`[${this.eventCount}] ${detailedEventType} on ${message.channel} (SKIPPED)`);
      return;
    }

    this.savedEventCount++;

    const logEntry = {
      timestamp: new Date().toISOString(),
      event: message.event,
      channel: message.channel,
      data: data,
      raw: sanitizedMessage,
      detailedEventType: detailedEventType
    };

    if (rawData !== null) {
      logEntry.rawData = rawData;
    }

    if (dataParseError) {
      logEntry.dataParseError = dataParseError;
    }

    // Console output for monitoring
    console.log(`[${this.eventCount}] ${detailedEventType} on ${message.channel} (SAVED)`);

    // Write to log file
    fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
  }

  startHeartbeat() {
    this.stopHeartbeat(); // Clear any existing heartbeat
    
    // Check connection health every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastEvent = now - this.lastEventTime;
      
      // If no events for more than 2 minutes and we think we're connected, force reconnect
      if (timeSinceLastEvent > 120000 && this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log(`⚠️  No events for ${Math.round(timeSinceLastEvent / 1000)}s, forcing reconnect...`);
        this.ws.close();
      }
      
      // Also check if websocket is in a bad state
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        if (this.connecting) {
          return;
        }
        console.log(`⚠️  WebSocket in bad state (${this.ws?.readyState}), scheduling reconnect...`);
        if (!this.reconnectTimer) {
          this.scheduleReconnect(0);
        }
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  getEventStats() {
    return {
      saved: this.savedEventCount,
      skipped: this.skippedEventCount,
      compressionRatio: this.eventCount > 0 ? (this.skippedEventCount / this.eventCount * 100).toFixed(1) : 0
    };
  }

  async start() {
    console.log('🚀 Starting Kick Event Collector\n');
    
    try {
      await this.loadChannelData();
      this.connect();
      
      // Set up graceful shutdown
      process.on('SIGINT', () => {
        const stats = this.getEventStats();
        console.log(`\n🛑 Shutting down. Processed ${this.eventCount} events total.`);
        console.log(`📁 Saved ${stats.saved} events (${stats.compressionRatio}% compression) to: ${this.logFile}`);
        console.log(`📊 Final event type counts:`);

        const sortedTypes = Array.from(this.eventTypeCounts.entries()).sort((a, b) => b[1] - a[1]);
        sortedTypes.slice(0, 10).forEach(([type, count]) => {
          console.log(`   ${type}: ${count}`);
        });

        if (this.ws) {
          this.ws.close();
        }
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.stopHeartbeat();
        if (this.statusInterval) {
          clearInterval(this.statusInterval);
          this.statusInterval = null;
        }
        process.exit(0);
      });

      // Status update every 60 seconds
      this.statusInterval = setInterval(() => {
        const stats = this.getEventStats();
        console.log(`📊 Status: ${this.eventCount} total events, ${stats.saved} saved (${stats.skipped} skipped), ${this.connectedChannels.size} channels`);
        console.log(`📊 Event types: ${Array.from(this.eventTypeCounts.entries()).map(([type, count]) => `${type}=${count}`).slice(0, 3).join(', ')}`);
      }, 60000);
      
    } catch (error) {
      console.error('Failed to start collector:', error);
      process.exit(1);
    }
  }
}

// Start the collector
const collector = new KickEventCollector();
collector.start();
