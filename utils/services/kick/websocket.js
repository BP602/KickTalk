/**
 * WebSocket service for Kick.com integration
 * Handles WebSocket connections, message processing, and error management
 */
class KickWebSocket extends EventTarget {
  constructor(url, options = {}) {
    super();
    
    // Configuration
    this.url = url;
    this.options = {
      reconnectDelay: 5000,
      maxReconnectDelay: 60000,
      reconnectMultiplier: 1.5,
      maxReconnectAttempts: 10,
      connectionTimeout: 30000,
      heartbeatInterval: 30000,
      maxConsecutiveErrors: 3,
      ...options
    };

    // Connection state
    this.websocket = null;
    this.connectionState = 'disconnected';
    this.socketId = null;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.consecutiveErrors = 0;
    
    // Timing and error tracking
    this.connectionStartTime = null;
    this.lastPingTime = null;
    this.lastPongTime = null;
    this.lastErrorTime = null;
    this.connectionTimeout = null;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    
    // Message queue for buffering messages during reconnection
    this.messageQueue = [];
    this.maxQueueSize = 100;
    
    // Circuit breaker state
    this.circuitBreakerOpen = false;
    this.circuitBreakerResetTime = null;
    
    this.bindMethods();

    // Normalize WebSocket readyState constants for test environments
    this.WS_STATES = {
      CONNECTING: (typeof WebSocket !== 'undefined' && typeof WebSocket.CONNECTING === 'number') ? WebSocket.CONNECTING : 0,
      OPEN: (typeof WebSocket !== 'undefined' && typeof WebSocket.OPEN === 'number') ? WebSocket.OPEN : 1,
      CLOSING: (typeof WebSocket !== 'undefined' && typeof WebSocket.CLOSING === 'number') ? WebSocket.CLOSING : 2,
      CLOSED: (typeof WebSocket !== 'undefined' && typeof WebSocket.CLOSED === 'number') ? WebSocket.CLOSED : 3
    };
  }

  bindMethods() {
    this.handleOpen = this.handleOpen.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.handleHeartbeat = this.handleHeartbeat.bind(this);
  }

  /**
   * Connect to WebSocket server
   * @returns {Promise<void>}
   */
  async connect() {
    if (!this.shouldReconnect) {
      console.log('WebSocket connection disabled, not connecting');
      return;
    }

    if (this.connectionState === 'connecting' || this.connectionState === 'connected') {
      console.log('WebSocket already connecting or connected');
      return;
    }

    // Check circuit breaker
    if (this.circuitBreakerOpen) {
      const now = Date.now();
      if (now < this.circuitBreakerResetTime) {
        console.log('Circuit breaker open, connection blocked');
        return;
      } else {
        console.log('Circuit breaker reset, attempting connection');
        this.circuitBreakerOpen = false;
      }
    }

    try {
      this.connectionState = 'connecting';
      this.connectionStartTime = Date.now();
      
      console.log(`Connecting to WebSocket (attempt ${this.reconnectAttempts + 1}/${this.options.maxReconnectAttempts})`);
      
      this.dispatchEvent(new CustomEvent('connecting', { 
        detail: { 
          attempt: this.reconnectAttempts + 1,
          maxAttempts: this.options.maxReconnectAttempts
        }
      }));

      await this.createConnection();
      
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.handleConnectionFailure(error);
    }
  }

  /**
   * Create WebSocket connection with timeout
   * @returns {Promise<void>}
   */
  createConnection() {
    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(this.url);
        this.setupEventListeners();
        
        // Connection timeout
        this.connectionTimeout = setTimeout(() => {
          if (this.connectionState !== 'connected') {
            const error = new Error('Connection timeout');
            error.code = 'CONNECTION_TIMEOUT';
            this.cleanup();
            reject(error);
          }
        }, this.options.connectionTimeout);

        // Wait for connection to open or fail
        const onOpen = () => {
          clearTimeout(this.connectionTimeout);
          if (this.websocket && typeof this.websocket.removeEventListener === 'function') {
            this.websocket.removeEventListener('error', onError);
          }
          resolve();
        };

        const onError = (error) => {
          clearTimeout(this.connectionTimeout);
          if (this.websocket && typeof this.websocket.removeEventListener === 'function') {
            this.websocket.removeEventListener('open', onOpen);
          }
          reject(error);
        };

        this.websocket.addEventListener('open', onOpen, { once: true });
        this.websocket.addEventListener('error', onError, { once: true });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Setup WebSocket event listeners
   */
  setupEventListeners() {
    if (!this.websocket) return;

    this.websocket.addEventListener('open', this.handleOpen);
    this.websocket.addEventListener('close', this.handleClose);
    this.websocket.addEventListener('error', this.handleError);
    this.websocket.addEventListener('message', this.handleMessage);
  }

  /**
   * Handle WebSocket open event
   */
  handleOpen() {
    const connectionDuration = Date.now() - this.connectionStartTime;
    console.log(`WebSocket connected (${connectionDuration}ms)`);
    
    this.connectionState = 'connected';
    this.reconnectAttempts = 0;
    this.consecutiveErrors = 0;
    this.circuitBreakerOpen = false;
    
    this.startHeartbeat();
    this.processMessageQueue();
    
    this.dispatchEvent(new CustomEvent('open', { 
      detail: { 
        connectionDuration,
        url: this.url
      }
    }));
  }

  /**
   * Handle WebSocket close event
   */
  handleClose(event = {}) {
    const { code, reason, wasClean } = event;
    console.log(`WebSocket closed (code: ${code}, reason: ${reason})`);
    
    this.connectionState = 'disconnected';
    this.stopHeartbeat();
    
    this.dispatchEvent(new CustomEvent('close', { 
      detail: { 
        code,
        reason,
        wasClean
      }
    }));

    if (this.shouldReconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.dispatchEvent(new CustomEvent('max_reconnects_reached', { 
        detail: { attempts: this.reconnectAttempts }
      }));
    }
  }

  /**
   * Handle WebSocket error event
   */
  handleError(event) {
    this.consecutiveErrors++;
    this.lastErrorTime = Date.now();
    
    console.error(`WebSocket error (consecutive: ${this.consecutiveErrors}):`, event);
    
    this.dispatchEvent(new CustomEvent('error', { 
      detail: { 
        error: event,
        consecutiveErrors: this.consecutiveErrors,
        timestamp: this.lastErrorTime
      }
    }));

    // Open circuit breaker if too many consecutive errors
    if (this.consecutiveErrors >= this.options.maxConsecutiveErrors) {
      this.openCircuitBreaker();
    }
  }

  /**
   * Handle WebSocket message event
   */
  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      
      // Handle ping/pong for heartbeat
      if (data.event === 'ping') {
        this.handlePing(data);
        return;
      }
      
      if (data.event === 'pong') {
        this.handlePong(data);
        return;
      }

      // Handle connection established
      if (data.event === 'pusher:connection_established') {
        this.socketId = JSON.parse(data.data).socket_id;
        console.log(`Connection established: socket ID - ${this.socketId}`);
      }

      this.dispatchEvent(new CustomEvent('message', { 
        detail: { 
          data,
          raw: event.data,
          timestamp: Date.now()
        }
      }));
      
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      this.dispatchEvent(new CustomEvent('parse_error', { 
        detail: { 
          error,
          data: event.data
        }
      }));
    }
  }

  /**
   * Send message through WebSocket
   * @param {Object} message - Message to send
   * @returns {boolean} - Success status
   */
  send(message) {
    if (
      this.connectionState !== 'connected' ||
      !this.websocket ||
      this.websocket.readyState !== this.WS_STATES.OPEN
    ) {
      // Queue message for later sending
      if (this.messageQueue.length < this.maxQueueSize) {
        this.messageQueue.push({
          message,
          timestamp: Date.now(),
          retries: 0
        });
        console.log('Message queued (WebSocket not connected)');
        return false;
      } else {
        console.warn('Message queue full, dropping message');
        return false;
      }
    }

    try {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      this.websocket.send(payload);
      return true;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      this.dispatchEvent(new CustomEvent('send_error', { detail: { error, message } }));
      return false;
    }
  }

  /**
   * Subscribe to channel
   * @param {string} channel - Channel name
   * @param {string} auth - Authentication token (optional)
   */
  subscribe(channel, auth = '') {
    const message = {
      event: 'pusher:subscribe',
      data: { 
        auth,
        channel 
      }
    };
    
    return this.send(message);
  }

  /**
   * Unsubscribe from channel
   * @param {string} channel - Channel name
   */
  unsubscribe(channel) {
    const message = {
      event: 'pusher:unsubscribe',
      data: { channel }
    };
    
    return this.send(message);
  }

  /**
   * Process queued messages
   */
  processMessageQueue() {
    if (this.messageQueue.length === 0) return;

    console.log(`Processing ${this.messageQueue.length} queued messages`);
    
    const messages = [...this.messageQueue];
    this.messageQueue = [];
    
    messages.forEach(({ message, retries }) => {
      if (!this.send(message) && retries < 3) {
        // Re-queue with incremented retry count
        this.messageQueue.push({ message, timestamp: Date.now(), retries: retries + 1 });
      }
    });
  }

  /**
   * Start heartbeat mechanism
   */
  startHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    
    this.heartbeatTimer = setInterval(this.handleHeartbeat, this.options.heartbeatInterval);
  }

  /**
   * Stop heartbeat mechanism
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Handle heartbeat ping/pong
   */
  handleHeartbeat() {
    if (this.connectionState !== 'connected') return;

    const now = Date.now();
    
    // Check if we missed a pong response
    if (this.lastPingTime && this.lastPongTime < this.lastPingTime) {
      const pingAge = now - this.lastPingTime;
      if (pingAge > this.options.heartbeatInterval * 2) {
        console.warn('Heartbeat timeout, connection may be stale');
        this.handleConnectionFailure(new Error('Heartbeat timeout'));
        return;
      }
    }

    // Send ping
    this.lastPingTime = now;
    this.send({ event: 'ping', data: { timestamp: now } });
  }

  /**
   * Handle ping message
   */
  handlePing(data) {
    // Respond with pong
    this.send({ event: 'pong', data: data.data });
  }

  /**
   * Handle pong message
   */
  handlePong(data) {
    this.lastPongTime = Date.now();
    const latency = this.lastPongTime - (data.data?.timestamp || this.lastPingTime);
    
    this.dispatchEvent(new CustomEvent('pong', { 
      detail: { 
        latency,
        timestamp: this.lastPongTime
      }
    }));
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    
    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(this.options.reconnectMultiplier, this.reconnectAttempts - 1),
      this.options.maxReconnectDelay
    );

    console.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      // Guard: only attempt reconnect if still desired and not already connected
      if (!this.shouldReconnect || this.connectionState === 'connected') return;
      this.dispatchEvent(new CustomEvent('reconnecting', { 
        detail: { 
          attempt: this.reconnectAttempts,
          delay
        }
      }));
      
      await this.connect();
    }, delay);
  }

  /**
   * Handle connection failure
   */
  handleConnectionFailure(error) {
    console.error('Connection failure:', error.message || error);
    this.connectionState = 'disconnected';
    
    this.dispatchEvent(new CustomEvent('connection_failure', { 
      detail: { 
        error,
        consecutiveErrors: this.consecutiveErrors,
        reconnectAttempts: this.reconnectAttempts
      }
    }));

    // Trigger circuit breaker if too many errors
    if (this.consecutiveErrors >= this.options.maxConsecutiveErrors) {
      this.openCircuitBreaker();
    }
  }

  /**
   * Open circuit breaker to prevent cascading failures
   */
  openCircuitBreaker() {
    this.circuitBreakerOpen = true;
    this.circuitBreakerResetTime = Date.now() + (this.options.maxReconnectDelay * 2);
    
    console.warn('Circuit breaker opened, blocking connections for', this.options.maxReconnectDelay * 2, 'ms');
    
    this.dispatchEvent(new CustomEvent('circuit_breaker_open', { 
      detail: { 
        resetTime: this.circuitBreakerResetTime,
        consecutiveErrors: this.consecutiveErrors
      }
    }));
  }

  /**
   * Reset connection state
   */
  resetConnectionState() {
    this.reconnectAttempts = 0;
    this.consecutiveErrors = 0;
    this.shouldReconnect = true;
    this.circuitBreakerOpen = false;
    this.circuitBreakerResetTime = null;
    this.messageQueue = [];
    
    console.log('Connection state reset');
    
    this.dispatchEvent(new CustomEvent('state_reset'));
  }

  /**
   * Get current connection health status
   */
  getConnectionHealth() {
    const now = Date.now();
    const isConnected = this.connectionState === 'connected' && this.websocket?.readyState === this.WS_STATES.OPEN;
    const start = this.connectionStartTime || now;
    
    return {
      isConnected,
      connectionState: this.connectionState,
      reconnectAttempts: this.reconnectAttempts,
      consecutiveErrors: this.consecutiveErrors,
      shouldReconnect: this.shouldReconnect,
      circuitBreakerOpen: this.circuitBreakerOpen,
      lastErrorTime: this.lastErrorTime,
      connectionStartTime: this.connectionStartTime,
      queuedMessages: this.messageQueue.length,
      socketId: this.socketId,
      latency: this.lastPongTime && this.lastPingTime ? this.lastPongTime - this.lastPingTime : null,
      uptime: isConnected ? now - start : null
    };
  }

  /**
   * Cleanup resources and close connection
   */
  cleanup() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHeartbeat();
    
    if (this.websocket && typeof this.websocket.removeEventListener === 'function') {
      this.websocket.removeEventListener('open', this.handleOpen);
      this.websocket.removeEventListener('close', this.handleClose);
      this.websocket.removeEventListener('error', this.handleError);
      this.websocket.removeEventListener('message', this.handleMessage);
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect() {
    console.log('Disconnecting WebSocket');
    
    this.shouldReconnect = false;
    this.connectionState = 'disconnecting';
    
    this.cleanup();
    
    if (this.websocket && this.websocket.readyState !== this.WS_STATES.CLOSED) {
      try {
        this.websocket.close(1000, 'Client disconnect');
      } catch (_e) {
        // ignore close errors during teardown
      }
    }
    
    this.websocket = null;
    this.connectionState = 'disconnected';
    this.messageQueue = [];
    
    this.dispatchEvent(new CustomEvent('disconnected'));
  }
}

export default KickWebSocket;