/**
 * WebSocket Distributor - Bun Native Implementation
 * Uses Bun.serve native WebSocket for optimal performance
 * Zero external dependencies
 */

import { createLogger } from '../../../shared/utils/logger.ts';

const logger = createLogger({ level: 2 });

// Bun WebSocket distributor configuration interface
export interface BunWebSocketDistributorConfig {
  port?: number;
  host?: string;
  compression?: boolean;
  maxPayload?: number;
}

// Bun WebSocket distributor stats interface
export interface BunWebSocketDistributorStats {
  messagesSent: number;
  connectionsCount: number;
  bytesTransmitted: number;
  errors: number;
}

// Bun WebSocket distributor status interface
export interface BunWebSocketDistributorStatus {
  type: 'websocket';
  active: boolean;
  config: Required<BunWebSocketDistributorConfig>;
  connections: number;
  stats: BunWebSocketDistributorStats;
  health: 'healthy' | 'stopped';
}

// Data payload interface
export interface WebSocketDataPayload {
  type?: string;
  source?: string;
  [key: string]: any;
}

// Bun WebSocket distributor interface
export interface BunWebSocketDistributor {
  type: 'websocket';
  distribute: (data: WebSocketDataPayload) => Promise<boolean>;
  initialize: () => Promise<boolean>;
  cleanup: () => Promise<void>;
  getStatus: () => BunWebSocketDistributorStatus;
  getConnections: () => any[];
  isHealthy: () => boolean;
}

// Internal state interface
interface BunWebSocketDistributorState {
  server: any | null;
  connections: Set<any>;
  isActive: boolean;
  config: Required<BunWebSocketDistributorConfig>;
  stats: BunWebSocketDistributorStats;
}

export const createWebSocketDistributor = (config: BunWebSocketDistributorConfig = {}): BunWebSocketDistributor => {
  const state: BunWebSocketDistributorState = {
    server: null,
    connections: new Set(),
    isActive: false,
    config: {
      port: config.port || 8080,
      host: config.host || '0.0.0.0',
      compression: config.compression !== false,
      maxPayload: config.maxPayload || 1024 * 1024 // 1MB
    },
    stats: {
      messagesSent: 0,
      connectionsCount: 0,
      bytesTransmitted: 0,
      errors: 0
    }
  };

  const distribute = async (data: WebSocketDataPayload): Promise<boolean> => {
    if (!state.isActive || state.connections.size === 0) {
      return false;
    }

    const message = JSON.stringify({
      timestamp: Date.now(),
      type: data.type || 'data',
      source: data.source,
      payload: data
    });

    let successCount = 0;
    const messageBytes = new TextEncoder().encode(message).length;

    // Send to all connected clients
    for (const ws of state.connections) {
      try {
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(message);
          successCount++;
          state.stats.messagesSent++;
          state.stats.bytesTransmitted += messageBytes;
        } else {
          // Remove dead connections
          state.connections.delete(ws);
        }
      } catch (error) {
        console.error('WebSocket send error:', error);
        state.stats.errors++;
        state.connections.delete(ws);
      }
    }

    return successCount > 0;
  };

  const initialize = async (): Promise<boolean> => {
    if (state.isActive) {
      throw new Error('WebSocket distributor already initialized');
    }

    try {
      // Create Bun.serve WebSocket server
      state.server = Bun.serve({
        port: state.config.port,
        hostname: state.config.host,
        
        fetch(req: Request, server: any): Response | undefined {
          const url = new URL(req.url);
          
          // Handle WebSocket upgrade
          if (server.upgrade(req)) {
            return; // WebSocket upgrade successful
          }
          
          // Handle HTTP requests for status/info
          if (url.pathname === '/status') {
            return new Response(JSON.stringify({
              active: state.isActive,
              connections: state.connections.size,
              stats: state.stats
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          // Default response
          return new Response('WebSocket Distributor', { 
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
          });
        },
        
        websocket: {
          open(ws: any) {
            state.connections.add(ws);
            state.stats.connectionsCount++;
            
            // Send welcome message
            ws.send(JSON.stringify({
              type: 'connected',
              timestamp: Date.now(),
              distributor: 'websocket',
              config: {
                compression: state.config.compression,
                maxPayload: state.config.maxPayload
              }
            }));
          },
          
          message(ws: any, message: string | Buffer) {
            // Handle client messages (optional)
            try {
              const data = typeof message === 'string' ? message : new TextDecoder().decode(message);
              const parsed = JSON.parse(data);
              
              // Echo ping/pong
              if (parsed.type === 'ping') {
                ws.send(JSON.stringify({
                  type: 'pong',
                  timestamp: Date.now()
                }));
              }
            } catch (error) {
              console.warn('WebSocket message parse error:', error);
            }
          },
          
          close(ws: any) {
            state.connections.delete(ws);
          },
          
          error(ws: any, error: Error) {
            console.error('WebSocket error:', error);
            state.stats.errors++;
            state.connections.delete(ws);
          }
        }
      });

      state.isActive = true;
      console.log(`🚀 WebSocket distributor listening on ${state.config.host}:${state.config.port}`);
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to initialize WebSocket distributor:', errorMessage);
      state.isActive = false;
      throw error;
    }
  };

  const cleanup = async (): Promise<void> => {
    if (!state.isActive) return;

    try {
      // Close all connections
      for (const ws of state.connections) {
        try {
          ws.close();
        } catch (error) {
          console.warn('Error closing WebSocket connection:', error);
        }
      }
      state.connections.clear();

      // Stop server
      if (state.server) {
        state.server.stop();
        state.server = null;
      }

      state.isActive = false;
      console.log('✅ WebSocket distributor stopped');
    } catch (error) {
      console.error('Error during WebSocket distributor cleanup:', error);
      throw error;
    }
  };

  const getStatus = (): BunWebSocketDistributorStatus => ({
    type: 'websocket',
    active: state.isActive,
    config: state.config,
    connections: state.connections.size,
    stats: { ...state.stats },
    health: state.isActive ? 'healthy' : 'stopped'
  });

  const getConnections = (): any[] => Array.from(state.connections);

  return {
    type: 'websocket',
    distribute,
    initialize,
    cleanup,
    getStatus,
    getConnections,
    isHealthy: () => state.isActive && state.server !== null
  };
};

