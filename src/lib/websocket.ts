// src/lib/websocket.ts

/**
 * 🔌 WebSocket Manager with Auto-Reconnect, Heartbeat, and Error Recovery
 * Handles all WebSocket connections with robust error handling
 */

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private isConnected = false;
  private listeners: Map<string, Set<Function>> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private connectionPromise: Promise<void> | null = null;
  private resolveConnection: (() => void) | null = null;
  private rejectConnection: ((error: Error) => void) | null = null;
  private url: string;
  private token: string;
  private isIntentionallyClosed = false;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
    
    // Add connection status change listener
    this.on('connection_status', this.handleStatusChange.bind(this));
  }

  async connect(): Promise<void> {
    // If already connected, return
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    // If currently connecting, wait for that connection
    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    this.isConnecting = true;
    this.isIntentionallyClosed = false;
    
    this.connectionPromise = new Promise((resolve, reject) => {
      this.resolveConnection = resolve;
      this.rejectConnection = reject;

      try {
        const wsUrl = new URL(this.url);
        wsUrl.searchParams.append('token', this.token);
        
        // Add timestamp to prevent caching
        wsUrl.searchParams.append('_t', Date.now().toString());

        console.log(`🔌 Connecting to WebSocket: ${wsUrl.toString()}`);
        this.ws = new WebSocket(wsUrl.toString());

        // Connection timeout
        const timeoutId = setTimeout(() => {
          if (!this.isConnected) {
            console.error('⏰ Connection timeout');
            this.ws?.close();
            reject(new Error('Connection timeout - server not responding'));
          }
        }, 15000);

        this.ws.onopen = () => {
          clearTimeout(timeoutId);
          this.isConnected = true;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          
          console.log('✅ WebSocket connected successfully');
          this.emit('connection_status', { status: 'connected' });
          
          // Start heartbeat
          this.startHeartbeat();
          
          if (this.resolveConnection) {
            this.resolveConnection();
            this.resolveConnection = null;
            this.rejectConnection = null;
          }
          resolve();
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeoutId);
          this.isConnected = false;
          this.isConnecting = false;
          this.stopHeartbeat();
          
          console.log(`🔌 WebSocket closed: ${event.code} - ${event.reason}`);
          
          // Emit status change
          this.emit('connection_status', { 
            status: 'disconnected',
            code: event.code,
            reason: event.reason 
          });

          // Auto-reconnect if not intentionally closed
          if (!this.isIntentionallyClosed && event.code !== 1000) {
            this.handleReconnect();
          }

          // Reject pending connection promise if still pending
          if (this.rejectConnection) {
            this.rejectConnection(new Error(`Connection closed: ${event.code}`));
            this.rejectConnection = null;
            this.resolveConnection = null;
          }
        };

        this.ws.onerror = (event) => {
          console.error('❌ WebSocket error:', event);
          
          // Emit error
          this.emit('error', {
            message: 'WebSocket connection error',
            event
          });

          // If we have a reject connection callback, use it
          if (this.rejectConnection) {
            this.rejectConnection(new Error('WebSocket connection error'));
            this.rejectConnection = null;
            this.resolveConnection = null;
          }
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('❌ Failed to parse WebSocket message:', error);
            this.emit('parse_error', { error, raw: event.data });
          }
        };

      } catch (error) {
        this.isConnecting = false;
        console.error('❌ WebSocket creation error:', error);
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnect attempts reached');
      this.emit('connection_failed', { 
        error: 'Failed to connect after maximum attempts',
        attempts: this.reconnectAttempts 
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`🔄 Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.emit('reconnecting', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delay
    });

    setTimeout(() => {
      if (!this.isIntentionallyClosed) {
        this.connectionPromise = null;
        this.connect().catch((error) => {
          console.error('❌ Reconnection attempt failed:', error);
        });
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ 
            type: 'ping', 
            timestamp: Date.now() 
          }));
        } catch (error) {
          console.error('❌ Failed to send ping:', error);
        }
      }
    }, 30000); // Ping every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private handleMessage(data: any): void {
    // Handle different message types
    switch (data.type) {
      case 'pong':
        // Keep connection alive - update last ping time
        console.debug('🏓 Pong received');
        break;
      
      case 'file_update':
        this.emit('file_update', data.payload);
        break;
      
      case 'transfer_progress':
        this.emit('transfer_progress', data.payload);
        break;
      
      case 'connection_status':
        this.emit('connection_status', data.payload);
        break;
      
      case 'error':
        console.error('❌ Server error:', data.message);
        this.emit('server_error', data);
        break;
      
      default:
        // Generic message handler
        this.emit('message', data);
    }
  }

  private handleStatusChange(data: any): void {
    console.log(`📡 Connection status changed: ${data.status}`);
  }

  // Public methods

  send(data: any): boolean {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
        return true;
      } catch (error) {
        console.error('❌ Failed to send message:', error);
        this.emit('send_error', { error, data });
        return false;
      }
    }
    console.warn('⚠️ Cannot send message - WebSocket not connected');
    return false;
  }

  disconnect(): void {
    this.isIntentionallyClosed = true;
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'User disconnected');
      this.ws = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
    console.log('🔌 WebSocket disconnected intentionally');
  }

  // Event system

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  emit(event: string, data: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ Error in ${event} listener:`, error);
        }
      });
    }
  }

  getStatus(): { isConnected: boolean; isConnecting: boolean; attempts: number } {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      attempts: this.reconnectAttempts
    };
  }
}

export const createWebSocketManager = (token: string): WebSocketManager => {
  const wsUrl = import.meta.env.VITE_WS_URL || 'wss://iftp.xus.me';
  return new WebSocketManager(wsUrl, token);
};

export default WebSocketManager;
