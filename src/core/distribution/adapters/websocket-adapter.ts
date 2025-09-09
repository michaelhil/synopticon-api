/**
 * WebSocket Protocol Adapter  
 * Consolidation of websocket-distributor.ts + websocket-distributor-bun.ts
 * Functional factory pattern with Bun native WebSocket support
 */

import { ProtocolAdapter, AdapterResult } from '../universal-distributor.js';
import { createLogger } from '../../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

export interface WebSocketAdapterConfig {
  host?: string;
  port?: number;
  maxConnections?: number;
  heartbeatInterval?: number;
  compression?: boolean;
  maxPayload?: number;
}

export interface ClientInfo {
  id: string;
  ws: any; // Bun WebSocket type
  connected: boolean;
  connectedAt: number;
  lastActivity: number;
  subscriptions: Set<string>;
}

export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'data';
  event?: string;
  data?: any;
  timestamp?: number;
  clientId?: string;
}

export interface WebSocketAdapterStats {
  totalConnections: number;
  activeConnections: number;
  messagesSent: number;
  messagesReceived: number;
  bytesTransmitted: number;
  lastMessageTime: number | null;
}

// WebSocket Adapter Factory (ADR 004/005 compliant)
export const createWebSocketAdapter = (config: WebSocketAdapterConfig = {}): ProtocolAdapter => {
  const state = {
    clients: new Map<string, ClientInfo>(),
    server: null as any,
    stats: {
      totalConnections: 0,
      activeConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      bytesTransmitted: 0,
      lastMessageTime: null as number | null,
    },
    config: {
      host: '0.0.0.0',
      port: 8765,
      maxConnections: 100,
      heartbeatInterval: 30000,
      compression: true,
      maxPayload: 1024 * 1024, // 1MB
      ...config,
    },
  };

  // Initialize WebSocket server  
  const initializeServer = (): void => {
    if (state.server) {
      return; // Already initialized
    }

    try {
      state.server = Bun.serve({
        port: state.config.port,
        hostname: state.config.host,
        websocket: {
          message: handleMessage,
          open: handleConnection,
          close: handleDisconnection,
          drain: handleDrain,
          maxCompressedSize: state.config.maxPayload,
          maxBackpressure: state.config.maxPayload,
        },
        fetch: handleHttpUpgrade,
      });

      logger.info(`WebSocket server listening on ${state.config.host}:${state.config.port}`);
      
      // Start heartbeat interval
      if (state.config.heartbeatInterval > 0) {
        startHeartbeat();
      }
    } catch (error) {
      logger.error(`Failed to initialize WebSocket server: ${error}`);
      throw error;
    }
  };

  // Handle HTTP upgrade to WebSocket
  const handleHttpUpgrade = (req: Request, server: any): Response | undefined => {
    const url = new URL(req.url);
    
    if (url.pathname === '/ws' || url.pathname === '/websocket') {
      const success = server.upgrade(req, {
        data: {
          clientId: generateClientId(),
          connectedAt: Date.now(),
        },
      });
      
      return success 
        ? undefined 
        : new Response('WebSocket upgrade failed', { status: 400 });
    }
    
    return new Response('WebSocket endpoint not found', { status: 404 });
  };

  // Handle new WebSocket connection
  const handleConnection = (ws: any): void => {
    const clientId = ws.data.clientId;
    const clientInfo: ClientInfo = {
      id: clientId,
      ws,
      connected: true,
      connectedAt: ws.data.connectedAt,
      lastActivity: Date.now(),
      subscriptions: new Set(),
    };

    state.clients.set(clientId, clientInfo);
    
    // Update stats (immutable)
    state.stats = {
      ...state.stats,
      totalConnections: state.stats.totalConnections + 1,
      activeConnections: state.clients.size,
    };

    logger.debug(`WebSocket client connected: ${clientId}`);

    // Send welcome message
    const welcomeMessage: WebSocketMessage = {
      type: 'data',
      event: 'connection',
      data: { clientId, connectedAt: clientInfo.connectedAt },
      timestamp: Date.now(),
    };

    ws.send(JSON.stringify(welcomeMessage));
  };

  // Handle WebSocket message
  const handleMessage = (ws: any, message: string | Buffer): void => {
    const clientId = ws.data.clientId;
    const client = state.clients.get(clientId);
    
    if (!client) {
      logger.warn(`Message from unknown client: ${clientId}`);
      return;
    }

    try {
      const messageStr = message instanceof Buffer ? message.toString('utf-8') : message;
      const parsedMessage: WebSocketMessage = JSON.parse(messageStr);
      
      // Update client activity
      client.lastActivity = Date.now();
      
      // Handle message types
      switch (parsedMessage.type) {
        case 'subscribe':
          if (parsedMessage.event) {
            client.subscriptions.add(parsedMessage.event);
            logger.debug(`Client ${clientId} subscribed to ${parsedMessage.event}`);
          }
          break;
          
        case 'unsubscribe':
          if (parsedMessage.event) {
            client.subscriptions.delete(parsedMessage.event);
            logger.debug(`Client ${clientId} unsubscribed from ${parsedMessage.event}`);
          }
          break;
          
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
          
        default:
          logger.debug(`Received message type '${parsedMessage.type}' from client ${clientId}`);
      }
      
      // Update stats
      state.stats = {
        ...state.stats,
        messagesReceived: state.stats.messagesReceived + 1,
        lastMessageTime: Date.now(),
      };
      
    } catch (error) {
      logger.warn(`Invalid message from client ${clientId}: ${error}`);
    }
  };

  // Handle WebSocket disconnection
  const handleDisconnection = (ws: any): void => {
    const clientId = ws.data.clientId;
    const client = state.clients.get(clientId);
    
    if (client) {
      client.connected = false;
      state.clients.delete(clientId);
      
      // Update stats
      state.stats = {
        ...state.stats,
        activeConnections: state.clients.size,
      };
      
      logger.debug(`WebSocket client disconnected: ${clientId}`);
    }
  };

  // Handle WebSocket drain (backpressure relief)
  const handleDrain = (ws: any): void => {
    logger.debug(`WebSocket drain event for client: ${ws.data.clientId}`);
  };

  // Core send function (broadcast to matching clients)
  const send = async (data: any, targetConfig: any): Promise<AdapterResult> => {
    const startTime = Date.now();
    
    try {
      // Initialize server if needed
      if (!state.server) {
        initializeServer();
      }

      // Prepare message
      const message: WebSocketMessage = {
        type: 'data',
        event: targetConfig.event || 'broadcast',
        data,
        timestamp: Date.now(),
      };

      const messageStr = JSON.stringify(message);
      const messageSize = new TextEncoder().encode(messageStr).length;
      
      // Find matching clients (by subscription or broadcast to all)
      const targetClients = findTargetClients(message.event, targetConfig);
      
      if (targetClients.length === 0) {
        return {
          success: false,
          protocol: 'websocket',
          error: 'No connected clients match the target criteria',
          code: 'NO_TARGETS',
          timing: { startTime, endTime: Date.now(), duration: Date.now() - startTime },
        };
      }

      // Send to all matching clients
      const sendPromises = targetClients.map(client => 
        sendToClient(client, messageStr)
      );
      
      const results = await Promise.allSettled(sendPromises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const endTime = Date.now();
      
      // Update stats
      state.stats = {
        ...state.stats,
        messagesSent: state.stats.messagesSent + successCount,
        bytesTransmitted: state.stats.bytesTransmitted + (messageSize * successCount),
        lastMessageTime: endTime,
      };

      return {
        success: successCount > 0,
        protocol: 'websocket',
        data: {
          targetClients: targetClients.length,
          successfulDeliveries: successCount,
          failedDeliveries: targetClients.length - successCount,
          messageSize,
        },
        timing: { startTime, endTime, duration: endTime - startTime },
      };

    } catch (error) {
      const endTime = Date.now();
      const errorMessage = error instanceof Error ? error.message : 'Unknown WebSocket error';
      
      return {
        success: false,
        protocol: 'websocket',
        error: errorMessage,
        code: 'WEBSOCKET_ERROR',
        timing: { startTime, endTime, duration: endTime - startTime },
      };
    }
  };

  // Find clients matching target criteria
  const findTargetClients = (event: string | undefined, config: any): ClientInfo[] => {
    const targetClients: ClientInfo[] = [];
    
    for (const client of state.clients.values()) {
      if (!client.connected) continue;
      
      // If specific event, check subscriptions
      if (event && event !== 'broadcast') {
        if (client.subscriptions.has(event)) {
          targetClients.push(client);
        }
      } else {
        // Broadcast to all connected clients
        targetClients.push(client);
      }
    }
    
    return targetClients;
  };

  // Send message to specific client
  const sendToClient = async (client: ClientInfo, message: string): Promise<void> => {
    try {
      client.ws.send(message);
    } catch (error) {
      logger.warn(`Failed to send message to client ${client.id}: ${error}`);
      throw error;
    }
  };

  // Generate unique client ID
  const generateClientId = (): string => {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Start heartbeat to check client connections
  const startHeartbeat = (): void => {
    setInterval(() => {
      const now = Date.now();
      const staleClients: string[] = [];
      
      for (const [clientId, client] of state.clients) {
        const inactiveTime = now - client.lastActivity;
        
        if (inactiveTime > state.config.heartbeatInterval * 2) {
          // Mark stale clients for removal
          staleClients.push(clientId);
        } else if (inactiveTime > state.config.heartbeatInterval) {
          // Send ping to potentially stale clients
          try {
            client.ws.send(JSON.stringify({ type: 'ping', timestamp: now }));
          } catch (error) {
            staleClients.push(clientId);
          }
        }
      }
      
      // Remove stale clients
      for (const clientId of staleClients) {
        state.clients.delete(clientId);
        logger.debug(`Removed stale client: ${clientId}`);
      }
      
      // Update active connections count
      if (staleClients.length > 0) {
        state.stats = {
          ...state.stats,
          activeConnections: state.clients.size,
        };
      }
    }, state.config.heartbeatInterval);
  };

  // Health check function
  const healthCheck = async (): Promise<boolean> => {
    return state.server !== null && state.stats.activeConnections >= 0;
  };

  // Configuration update
  const configure = (newConfig: any): void => {
    state.config = { ...state.config, ...newConfig };
    logger.debug('WebSocket adapter configuration updated');
  };

  // Get current statistics
  const getStats = (): WebSocketAdapterStats => ({ ...state.stats });

  // Get connected clients info
  const getClients = (): ClientInfo[] => Array.from(state.clients.values());

  // Shutdown server
  const shutdown = async (): Promise<void> => {
    if (state.server) {
      state.server.stop();
      state.server = null;
      state.clients.clear();
      logger.info('WebSocket server stopped');
    }
  };

  // Return adapter instance
  return {
    protocol: 'websocket',
    capabilities: ['realtime', 'bidirectional', 'subscriptions', 'broadcast'],
    send,
    healthCheck,
    configure,
    
    // Additional WebSocket-specific methods
    getStats,
    getClients,
    shutdown,
    getConfig: () => ({ ...state.config }),
  };
};

export type WebSocketAdapter = ReturnType<typeof createWebSocketAdapter>;