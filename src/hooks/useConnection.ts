// src/hooks/useConnection.ts

/**
 * 🔗 Connection Hook with WebSocket Management and State Recovery
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createWebSocketManager, WebSocketManager } from '../lib/websocket';
import { apiClient, ApiError } from '../lib/api';

interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  reconnectAttempts: number;
  connectionId: string | null;
}

interface UseConnectionOptions {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  onReconnecting?: (attempt: number) => void;
  autoConnect?: boolean;
  retryOnError?: boolean;
}

export const useConnection = (
  connectionId: string | null,
  token: string | null,
  options: UseConnectionOptions = {}
) => {
  const {
    onConnected,
    onDisconnected,
    onError,
    onReconnecting,
    autoConnect = true,
    retryOnError = true,
  } = options;

  const [state, setState] = useState<ConnectionState>({
    status: 'disconnected',
    isConnected: false,
    isConnecting: false,
    error: null,
    reconnectAttempts: 0,
    connectionId: connectionId,
  });

  const wsManagerRef = useRef<WebSocketManager | null>(null);
  const isMountedRef = useRef(true);
  const connectAttemptRef = useRef(0);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (wsManagerRef.current) {
      wsManagerRef.current.disconnect();
      wsManagerRef.current = null;
    }
  }, []);

  // Connect function
  const connect = useCallback(async () => {
    if (!connectionId || !token) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: new Error('Missing connection credentials'),
        isConnected: false,
        isConnecting: false,
      }));
      return;
    }

    if (state.isConnected) {
      return;
    }

    if (state.isConnecting) {
      return;
    }

    setState(prev => ({
      ...prev,
      status: 'connecting',
      isConnecting: true,
      error: null,
      reconnectAttempts: 0,
      connectionId: connectionId,
    }));

    try {
      // Setup API client
      apiClient.setToken(token);

      // Create WebSocket manager
      const wsManager = createWebSocketManager(token);
      wsManagerRef.current = wsManager;

      // Set up event handlers
      wsManager.on('connection_status', (data: any) => {
        if (!isMountedRef.current) return;
        
        if (data.status === 'connected') {
          setState(prev => ({
            ...prev,
            status: 'connected',
            isConnected: true,
            isConnecting: false,
            error: null,
          }));
          onConnected?.();
        } else if (data.status === 'disconnected') {
          setState(prev => ({
            ...prev,
            status: 'disconnected',
            isConnected: false,
            isConnecting: false,
          }));
          onDisconnected?.();
        }
      });

      wsManager.on('reconnecting', (data: any) => {
        if (!isMountedRef.current) return;
        
        setState(prev => ({
          ...prev,
          status: 'reconnecting',
          reconnectAttempts: data.attempt,
          isConnecting: true,
        }));
        onReconnecting?.(data.attempt);
      });

      wsManager.on('connection_failed', (data: any) => {
        if (!isMountedRef.current) return;
        
        const error = new Error(data.error || 'Connection failed');
        setState(prev => ({
          ...prev,
          status: 'error',
          error: error,
          isConnected: false,
          isConnecting: false,
        }));
        onError?.(error);
      });

      wsManager.on('error', (error: any) => {
        if (!isMountedRef.current) return;
        
        const err = error instanceof Error ? error : new Error(String(error));
        setState(prev => ({
          ...prev,
          status: 'error',
          error: err,
          isConnected: false,
        }));
        onError?.(err);
      });

      wsManager.on('server_error', (data: any) => {
        if (!isMountedRef.current) return;
        
        const error = new Error(data.message || 'Server error');
        setState(prev => ({
          ...prev,
          status: 'error',
          error: error,
        }));
        onError?.(error);
      });

      // Attempt connection
      await wsManager.connect();

      connectAttemptRef.current++;

    } catch (error) {
      if (!isMountedRef.current) return;
      
      const err = error instanceof Error ? error : new Error('Connection failed');
      setState(prev => ({
        ...prev,
        status: 'error',
        error: err,
        isConnected: false,
        isConnecting: false,
      }));
      onError?.(err);

      // Retry if enabled
      if (retryOnError && connectAttemptRef.current < 3) {
        setTimeout(() => {
          if (isMountedRef.current) {
            connect();
          }
        }, 2000 * connectAttemptRef.current);
      }
    }
  }, [connectionId, token, state.isConnected, state.isConnecting, onConnected, onDisconnected, onError, onReconnecting, retryOnError]);

  // Disconnect function
  const disconnect = useCallback(() => {
    cleanup();
    setState(prev => ({
      ...prev,
      status: 'disconnected',
      isConnected: false,
      isConnecting: false,
      error: null,
      reconnectAttempts: 0,
    }));
  }, [cleanup]);

  // Reconnect function
  const reconnect = useCallback(async () => {
    disconnect();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await connect();
  }, [disconnect, connect]);

  // Auto-connect on mount
  useEffect(() => {
    isMountedRef.current = true;
    
    if (autoConnect && connectionId && token) {
      connect();
    }

    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [connectionId, token, autoConnect, connect, cleanup]);

  // Send message through WebSocket
  const sendMessage = useCallback((data: any): boolean => {
    if (wsManagerRef.current) {
      return wsManagerRef.current.send(data);
    }
    return false;
  }, []);

  // Listen to WebSocket events
  const onWebSocketEvent = useCallback((event: string, callback: Function) => {
    if (wsManagerRef.current) {
      wsManagerRef.current.on(event, callback);
      return () => wsManagerRef.current?.off(event, callback);
    }
    return () => {};
  }, []);

  // Get connection status
  const getStatus = useCallback(() => {
    return {
      ...state,
      wsManager: wsManagerRef.current,
    };
  }, [state]);

  return {
    ...state,
    connect,
    disconnect,
    reconnect,
    sendMessage,
    onWebSocketEvent,
    getStatus,
    wsManager: wsManagerRef.current,
  };
};

export default useConnection;
