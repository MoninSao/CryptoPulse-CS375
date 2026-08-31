/**
 * CryptoPulse WebSocket, Real-time price updates
 * Manages WebSocket connection and price broadcasting
 */

class PriceWebSocket {
  constructor() {
    this.ws = null;
    this.url = this.getWebSocketURL();
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000; // ms
    this.listeners = new Map();
    this.messageQueue = [];
    this.isReconnecting = false;
  }

  /**
   * Get WebSocket URL based on environment config or current location
   */
  getWebSocketURL() {
    // Use injected config if available
    if (typeof window !== 'undefined' && window.CRYPTOPULSE_CONFIG?.WEBSOCKET_URL) {
      return window.CRYPTOPULSE_CONFIG.WEBSOCKET_URL;
    }
    
    // Fallback: derive from current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.hostname}:4000/ws/prices`;
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔌 Connecting to WebSocket:', this.url);
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('✅ WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.isReconnecting = false;

          // Process queued messages
          while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.ws.send(message);
          }

          this.emit('connected', { timestamp: new Date().toISOString() });
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.isConnected = false;
          this.emit('error', { error });
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('🔌 WebSocket disconnected');
          this.isConnected = false;
          this.emit('disconnected', { timestamp: new Date().toISOString() });
          this.attemptReconnect();
        };
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  handleMessage(data) {
    const { type, data: messageData, timestamp } = data;

    switch (type) {
      case 'prices':
        // messageData now contains { prices: {...}, changes: {...}, meta: {...} }
        this.emit('prices', {
          prices: messageData.prices,
          changes: messageData.changes,
          meta: messageData.meta,
          timestamp
        });
        break;
      case 'price':
        this.emit('price', { coin: messageData.coin, price: messageData.price, timestamp });
        break;
      case 'connected':
        console.log('Server acknowledged connection');
        break;
      default:
        console.log('Unknown message type:', type);
    }
  }

  /**
   * Attempt to reconnect
   */
  attemptReconnect() {
    if (this.isReconnecting) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.emit('reconnect_failed');
      return;
    }

    this.reconnectAttempts++;
    this.isReconnecting = true;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    console.log(`⏳ Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Send message to server
   */
  send(message) {
    if (!this.ws) {
      console.error('WebSocket not initialized');
      return;
    }

    const data = typeof message === 'string' ? message : JSON.stringify(message);

    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      console.warn('WebSocket not ready, queuing message');
      this.messageQueue.push(data);
    }
  }

  /**
   * Subscribe to event
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Unsubscribe from event
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return;

    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Emit event
   */
  emit(event, data) {
    if (!this.listeners.has(event)) return;

    const callbacks = this.listeners.get(event);
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }

  /**
   * Check connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      isReconnecting: this.isReconnecting,
      reconnectAttempts: this.reconnectAttempts,
      url: this.url
    };
  }

  /**
   * Disconnect and cleanup
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.listeners.clear();
    this.messageQueue = [];
  }
}

// Export WebSocket instance
const priceWebSocket = new PriceWebSocket();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  priceWebSocket.disconnect();
});
