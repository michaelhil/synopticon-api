/**
 * Server-Sent Events (SSE) Protocol Adapter
 * Consolidation of sse-distributor.ts
 * Functional factory pattern with zero dependencies
 */

import { ProtocolAdapter, AdapterResult } from '../universal-distributor.js';
import { createLogger } from '../../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

export interface SSEAdapterConfig {
  host?: string;
  port?: number;
  path?: string;
  maxConnections?: number;
  heartbeatInterval?: number;
  corsOrigins?: string[];
  compression?: boolean;
}

export interface SSEClient {
  id: string;
  response: any; // Bun Response stream
  connected: boolean;
  connectedAt: number;
  lastActivity: number;
  channels: Set<string>;
}

export interface SSEAdapterStats {
  totalConnections: number;
  activeConnections: number;
  messagesSent: number;
  bytesTransmitted: number;
  lastMessageTime: number | null;
}

export interface SSEMessage {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

// SSE Adapter Factory (ADR 004/005 compliant)
export const createSSEAdapter = (config: SSEAdapterConfig = {}): ProtocolAdapter => {
  const state = {
    clients: new Map<string, SSEClient>(),
    server: null as any,
    stats: {
      totalConnections: 0,
      activeConnections: 0,
      messagesSent: 0,
      bytesTransmitted: 0,
      lastMessageTime: null as number | null,
    },
    config: {
      host: '0.0.0.0',
      port: 8766,
      path: '/events',
      maxConnections: 100,
      heartbeatInterval: 30000,
      corsOrigins: ['*'],
      compression: false,
      ...config,
    },
  };

  // Initialize SSE server
  const initializeServer = (): void => {
    if (state.server) {
      return; // Already initialized
    }

    try {
      state.server = Bun.serve({
        port: state.config.port,
        hostname: state.config.host,
        fetch: handleRequest,
      });

      logger.info(`SSE server listening on ${state.config.host}:${state.config.port}${state.config.path}`);
      
      // Start heartbeat interval
      if (state.config.heartbeatInterval > 0) {
        startHeartbeat();
      }
    } catch (error) {
      logger.error(`Failed to initialize SSE server: ${error}`);
      throw error;
    }
  };

  // Handle HTTP requests
  const handleRequest = (req: Request): Response | Promise<Response> => {
    const url = new URL(req.url);
    
    // Check if this is an SSE endpoint request
    if (url.pathname === state.config.path) {
      return handleSSEConnection(req);
    }
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ 
        status: 'healthy', 
        activeConnections: state.stats.activeConnections 
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response('Not Found', { status: 404 });
  };

  // Handle new SSE connection
  const handleSSEConnection = (req: Request): Response => {
    const clientId = generateClientId();
    
    // Create SSE response stream
    const stream = new ReadableStream({
      start(controller) {
        const client: SSEClient = {
          id: clientId,
          response: controller,
          connected: true,
          connectedAt: Date.now(),
          lastActivity: Date.now(),
          channels: new Set(),
        };

        state.clients.set(clientId, client);
        
        // Update stats
        state.stats = {
          ...state.stats,
          totalConnections: state.stats.totalConnections + 1,
          activeConnections: state.clients.size,
        };

        logger.debug(`SSE client connected: ${clientId}`);

        // Send initial connection message
        sendToClient(client, {
          event: 'connection',
          data: JSON.stringify({ clientId, connectedAt: client.connectedAt }),
        });
      },
      
      cancel() {
        handleDisconnection(clientId);
      },
    });

    // Set SSE headers
    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': state.config.corsOrigins.join(', ')),
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    if (state.config.compression) {
      headers.set('Content-Encoding', 'gzip');
    }

    return new Response(stream, { headers });
  };

  // Handle client disconnection
  const handleDisconnection = (clientId: string): void => {
    const client = state.clients.get(clientId);
    
    if (client) {
      client.connected = false;
      state.clients.delete(clientId);
      
      // Update stats
      state.stats = {
        ...state.stats,
        activeConnections: state.clients.size,
      };
      
      logger.debug(`SSE client disconnected: ${clientId}`);
    }
  };

  // Core send function (broadcast SSE messages)
  const send = async (data: any, targetConfig: any): Promise<AdapterResult> => {
    const startTime = Date.now();
    
    try {
      // Initialize server if needed
      if (!state.server) {
        initializeServer();
      }

      // Prepare SSE message
      const message: SSEMessage = {
        id: targetConfig.id || generateMessageId(),
        event: targetConfig.event || 'message',
        data: typeof data === 'string' ? data : JSON.stringify(data),
        retry: targetConfig.retry,
      };

      // Find target clients
      const targetClients = findTargetClients(targetConfig);
      
      if (targetClients.length === 0) {
        return {
          success: false,
          protocol: 'sse',
          error: 'No connected clients match the target criteria',
          code: 'NO_TARGETS',
          timing: { startTime, endTime: Date.now(), duration: Date.now() - startTime },
        };
      }

      // Send to all matching clients
      let successCount = 0;
      let totalBytes = 0;
      
      for (const client of targetClients) {
        try {
          const messageBytes = sendToClient(client, message);
          totalBytes += messageBytes;
          successCount++;
        } catch (error) {
          logger.warn(`Failed to send SSE message to client ${client.id}: ${error}`);
        }
      }

      const endTime = Date.now();
      
      // Update stats
      state.stats = {
        ...state.stats,
        messagesSent: state.stats.messagesSent + successCount,
        bytesTransmitted: state.stats.bytesTransmitted + totalBytes,
        lastMessageTime: endTime,
      };

      return {
        success: successCount > 0,
        protocol: 'sse',
        data: {
          targetClients: targetClients.length,
          successfulDeliveries: successCount,
          failedDeliveries: targetClients.length - successCount,
          totalBytes,
        },
        timing: { startTime, endTime, duration: endTime - startTime },
      };

    } catch (error) {
      const endTime = Date.now();
      const errorMessage = error instanceof Error ? error.message : 'Unknown SSE error';
      
      return {
        success: false,
        protocol: 'sse',
        error: errorMessage,
        code: 'SSE_ERROR',
        timing: { startTime, endTime, duration: endTime - startTime },
      };
    }
  };

  // Find clients matching target criteria
  const findTargetClients = (config: any): SSEClient[] => {
    const targetClients: SSEClient[] = [];
    
    for (const client of state.clients.values()) {
      if (!client.connected) continue;
      
      // Filter by channel if specified
      if (config.channel) {
        if (client.channels.has(config.channel)) {
          targetClients.push(client);
        }
      } else {
        // Broadcast to all connected clients
        targetClients.push(client);
      }
    }
    
    return targetClients;
  };

  // Send SSE message to specific client
  const sendToClient = (client: SSEClient, message: SSEMessage): number => {
    const sseData = formatSSEMessage(message);
    const bytes = new TextEncoder().encode(sseData).length;
    
    try {
      client.response.enqueue(sseData);
      client.lastActivity = Date.now();
      return bytes;
    } catch (error) {
      // Mark client as disconnected
      client.connected = false;
      throw error;
    }
  };

  // Format message as SSE protocol
  const formatSSEMessage = (message: SSEMessage): string => {
    let formatted = '';
    
    if (message.id) {
      formatted += `id: ${message.id}
`;
    }
    
    if (message.event) {
      formatted += `event: ${message.event}
`;
    }
    
    // Handle multi-line data
    const dataLines = message.data.split('

    for (const line of dataLines) {
      formatted += `data: ${line}
`;
    }
    
    if (message.retry !== undefined) {
      formatted += `retry: ${message.retry}
`;
    }
    
    formatted += '
'; // End of message marker
    
    return formatted;
  };

  // Generate unique client ID
  const generateClientId = (): string => {
    return `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Generate unique message ID
  const generateMessageId = (): string => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  };

  // Start heartbeat to maintain connections
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
          // Send heartbeat to potentially stale clients
          try {
            sendToClient(client, {
              event: 'heartbeat',
              data: JSON.stringify({ timestamp: now }),
            });
          } catch (error) {
            staleClients.push(clientId);
          }
        }
      }
      
      // Remove stale clients
      for (const clientId of staleClients) {
        handleDisconnection(clientId);
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
    logger.debug('SSE adapter configuration updated');
  };

  // Get current statistics
  const getStats = (): SSEAdapterStats => ({ ...state.stats });

  // Get connected clients info
  const getClients = (): SSEClient[] => Array.from(state.clients.values());

  // Shutdown server
  const shutdown = async (): Promise<void> => {
    if (state.server) {
      // Close all client connections
      for (const client of state.clients.values()) {
        try {
          client.response.close();
        } catch (error) {
          // Client may already be disconnected
        }
      }
      
      state.server.stop();
      state.server = null;
      state.clients.clear();
      logger.info('SSE server stopped');
    }
  };

  // Return adapter instance
  return {
    protocol: 'sse',
    capabilities: ['server-sent-events', 'streaming', 'text-data', 'realtime'],
    send,
    healthCheck,
    configure,
    
    // Additional SSE-specific methods
    getStats,
    getClients,
    shutdown,
    getConfig: () => ({ ...state.config }),
  };
};

export type SSEAdapter = ReturnType<typeof createSSEAdapter>;