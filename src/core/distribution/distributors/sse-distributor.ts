/**
 * Server-Sent Events (SSE) Distributor
 * Handles distribution via Server-Sent Events for real-time web streaming
 */

import { 
  createBaseDistributor, 
  DistributorCapabilities, 
  BaseDistributor, 
  SendOptions,
  EventCallback 
} from '../base-distributor.ts';
import { createLogger } from '../../../shared/utils/logger.ts';

const logger = createLogger({ level: 2 });

// SSE-specific configuration interface
export interface SseDistributorConfig {
  name?: string;
  endpoint?: string;
  port?: number;
  host?: string;
  heartbeatInterval?: number;
  compression?: boolean;
  maxConnections?: number;
  corsOrigins?: string[];
  enabled?: boolean;
}

// SSE client information interface
export interface SseClientInfo {
  id: string;
  controller: ReadableStreamDefaultController<string>;
  connected: boolean;
  connectedAt: number;
  lastActivity: number;
  subscriptions: Set<string>;
  cleanup?: () => void;
}

// SSE send options interface
export interface SseSendOptions extends SendOptions {
  clientIds?: string[];
}

// SSE send result interface
export interface SseSendResult {
  success: boolean;
  event: string;
  duration: number;
  clients: {
    targeted: number;
    sent: number;
    errors: number;
  };
}

// Client summary interface
export interface SseClientSummary {
  id: string;
  connectedAt: number;
  lastActivity: number;
  subscriptions: string[];
}

// Subscription summary interface
export interface SseSubscriptionSummary {
  pattern: string;
  subscriberCount: number;
}

// SSE health information interface
export interface SseHealth {
  name: string;
  status: string;
  uptime: number;
  lastCheck: number;
  enabled: boolean;
  protocol: 'sse';
  server: {
    port: number;
    host: string;
    endpoint: string;
    running: boolean;
  };
  clients: {
    connected: number;
    maxConnections: number;
  };
  subscriptions: {
    patterns: number;
    totalSubscribers: number;
  };
  capabilities: string[];
}

// Enhanced SSE distributor interface
export interface SseDistributor extends BaseDistributor {
  // SSE-specific methods
  getClients: () => SseClientSummary[];
  sendToClient: (clientId: string, event: string, data: any) => boolean;
  getSubscriptions: () => SseSubscriptionSummary[];
  getCapabilities: () => string[];
  getEndpoint: () => string;
  getPort: () => number;
  getHost: () => string;
  protocol: 'sse';
  
  // Override methods with specific types
  send: (event: string, data: any, options?: SseSendOptions) => Promise<SseSendResult>;
  broadcast: (event: string, data: any, options?: SseSendOptions) => Promise<SseSendResult>;
  subscribe: (eventPattern: string | RegExp, clientId?: string | null) => boolean;
  getHealth: () => SseHealth;
}

// Internal state interface
interface SseDistributorState {
  server: any | null;
  clients: Set<SseClientInfo>;
  config: Required<SseDistributorConfig> & { corsOrigins: string[]; };
  capabilities: string[];
  subscriptions: Map<string, Set<SseClientInfo>>;
  heartbeatInterval: NodeJS.Timeout | null;
}

/**
 * Create SSE distributor for real-time web streaming
 */
export const createSseDistributor = (config: SseDistributorConfig = {}): SseDistributor => {
  const baseDistributor = createBaseDistributor({
    name: 'sse',
    ...config
  });

  const state: SseDistributorState = {
    server: null,
    clients: new Set(),
    config: {
      name: config.name || 'sse',
      enabled: config.enabled !== false,
      endpoint: config.endpoint || '/events/stream',
      port: config.port || 3001,
      host: config.host || 'localhost',
      heartbeatInterval: config.heartbeatInterval || 30000,
      compression: config.compression !== false,
      maxConnections: config.maxConnections || 500,
      corsOrigins: config.corsOrigins || ['*']
    },
    capabilities: [
      DistributorCapabilities.SEND,
      DistributorCapabilities.BROADCAST,
      DistributorCapabilities.REAL_TIME,
      DistributorCapabilities.SUBSCRIBE
    ],
    subscriptions: new Map(),
    heartbeatInterval: null
  };

  /**
   * Create Bun HTTP server for SSE
   */
  const createServer = async (): Promise<any> => {
    if (typeof window !== 'undefined') {
      // Browser environment - cannot create server
      console.warn('SSE server not available in browser environment');
      return null;
    }

    try {
      const server = Bun.serve({
        hostname: state.config.host,
        port: state.config.port,
        
        fetch(request: Request): Response {
          const url = new URL(request.url);
          
          // Handle CORS preflight
          if (request.method === 'OPTIONS') {
            return new Response(null, {
              status: 200,
              headers: getCorsHeaders()
            });
          }

          // Handle SSE endpoint
          if (url.pathname === state.config.endpoint) {
            return handleSseConnection(request);
          } else if (url.pathname === '/health') {
            return handleHealthCheck(request);
          } else {
            return new Response('Not Found', { status: 404 });
          }
        },

        error(error: Error): Response {
          console.error('SSE server error:', error);
          baseDistributor._updateHealth('error', { lastError: error.message });
          return new Response('Internal Server Error', { status: 500 });
        }
      });

      return server;
    } catch (error) {
      console.error('Failed to create SSE server:', error);
      throw error;
    }
  };

  /**
   * Get CORS headers
   */
  const getCorsHeaders = (): Record<string, string> => {
    const origins = state.config.corsOrigins;
    
    return {
      'Access-Control-Allow-Origin': origins.includes('*') ? '*' : origins[0],
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'Access-Control-Max-Age': '86400'
    };
  };

  /**
   * Handle health check endpoint
   */
  const handleHealthCheck = (request: Request): Response => {
    const healthData = {
      status: 'healthy',
      protocol: 'sse',
      clients: state.clients.size,
      uptime: Date.now() - baseDistributor._getState().stats.startTime
    };

    return new Response(JSON.stringify(healthData), {
      status: 200,
      headers: {
        ...getCorsHeaders(),
        'Content-Type': 'application/json'
      }
    });
  };

  /**
   * Handle SSE connection
   */
  const handleSseConnection = (request: Request): Response => {
    if (state.clients.size >= state.config.maxConnections) {
      return new Response('Server at capacity', { 
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    const clientId = generateClientId();
    
    // Create ReadableStream for SSE
    const stream = new ReadableStream<string>({
      start(controller) {
        const clientInfo: SseClientInfo = {
          id: clientId,
          controller,
          connected: true,
          connectedAt: Date.now(),
          lastActivity: Date.now(),
          subscriptions: new Set()
        };

        state.clients.add(clientInfo);
        console.log(`📡 SSE client connected: ${clientId} (${state.clients.size} total)`);

        // Send welcome message
        const welcomeMsg = formatSseMessage('connection', {
          clientId,
          timestamp: Date.now(),
          server: 'synopticon-api'
        });
        controller.enqueue(welcomeMsg);

        // Store client info for cleanup
        clientInfo.cleanup = () => {
          state.clients.delete(clientInfo);
          cleanupClientSubscriptions(clientInfo);
          console.log(`📡 SSE client disconnected: ${clientId} (${state.clients.size} remaining)`);
        };

        baseDistributor._updateStats('messagesReceived');
      },
      
      cancel() {
        // Client disconnected
        const clientInfo = Array.from(state.clients).find(c => c.id === clientId);
        if (clientInfo && clientInfo.cleanup) {
          clientInfo.cleanup();
        }
      }
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...getCorsHeaders(),
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Disable nginx buffering
      }
    });
  };

  /**
   * Clean up client subscriptions
   */
  const cleanupClientSubscriptions = (clientInfo: SseClientInfo): void => {
    for (const eventPattern of clientInfo.subscriptions) {
      const subscribers = state.subscriptions.get(eventPattern);
      if (subscribers) {
        subscribers.delete(clientInfo);
        if (subscribers.size === 0) {
          state.subscriptions.delete(eventPattern);
        }
      }
    }
  };

  /**
   * Send SSE message to specific client
   */
  const sendToClient = (clientInfo: SseClientInfo, event: string, data: any): boolean => {
    if (!clientInfo.connected) {
      return false;
    }

    try {
      const message = formatSseMessage(event, data);
      clientInfo.controller.enqueue(message);
      clientInfo.lastActivity = Date.now();
      return true;
    } catch (error) {
      console.error(`Failed to send to SSE client ${clientInfo.id}:`, error);
      clientInfo.connected = false;
      state.clients.delete(clientInfo);
      return false;
    }
  };

  /**
   * Format message for SSE protocol
   */
  const formatSseMessage = (event: string, data: any): string => {
    const payload = JSON.stringify({
      event,
      data,
      timestamp: Date.now()
    });

    return `event: ${event}\ndata: ${payload}\n\n`;
  };

  /**
   * Generate unique client ID
   */
  const generateClientId = (): string => {
    return `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  /**
   * Send data via SSE to all connected clients
   */
  const send = async (event: string, data: any, options: SseSendOptions = {}): Promise<SseSendResult> => {
    const startTime = Date.now();
    let sentCount = 0;
    let errorCount = 0;

    // Check if targeting specific clients
    const targetClients = options.clientIds ? 
      Array.from(state.clients).filter(client => options.clientIds!.includes(client.id)) :
      Array.from(state.clients);

    // Check if event has specific subscribers
    let subscribedClients: SseClientInfo[] = [];
    if (state.subscriptions.has(event)) {
      subscribedClients = Array.from(state.subscriptions.get(event)!);
    }

    // Use subscribed clients if available, otherwise all clients
    const clientsToSend = subscribedClients.length > 0 ? subscribedClients : targetClients;

    for (const clientInfo of clientsToSend) {
      if (sendToClient(clientInfo, event, {
        ...data,
        metadata: options.metadata || {}
      })) {
        sentCount++;
      } else {
        errorCount++;
      }
    }

    const duration = Date.now() - startTime;
    baseDistributor._updateStats('messagesSent', sentCount);
    if (errorCount > 0) {
      baseDistributor._updateStats('errors', errorCount);
    }

    if (sentCount > 0) {
      baseDistributor._updateHealth('connected', { lastSuccessfulSend: Date.now() });
    }

    return {
      success: sentCount > 0,
      event,
      duration,
      clients: {
        targeted: clientsToSend.length,
        sent: sentCount,
        errors: errorCount
      }
    };
  };

  /**
   * Connect (start SSE server)
   */
  const connect = async (): Promise<boolean> => {
    try {
      if (typeof window !== 'undefined') {
        // Browser environment - mark as connected for client-side usage
        baseDistributor._updateHealth('connected', { connected: true });
        return true;
      }

      state.server = await createServer();
      
      // Start heartbeat interval
      if (state.config.heartbeatInterval > 0) {
        state.heartbeatInterval = setInterval(() => {
          broadcast('heartbeat', { timestamp: Date.now() });
        }, state.config.heartbeatInterval);
      }

      baseDistributor._updateHealth('connected', { 
        connected: true,
        server: true,
        port: state.config.port,
        endpoint: state.config.endpoint
      });

      console.log(`🚀 SSE distributor listening on ${state.config.host}:${state.config.port}${state.config.endpoint}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to start SSE server:', error);
      baseDistributor._updateHealth('error', { 
        connected: false,
        lastError: errorMessage 
      });
      return false;
    }
  };

  /**
   * Disconnect (stop SSE server)
   */
  const disconnect = async (): Promise<boolean> => {
    if (state.heartbeatInterval) {
      clearInterval(state.heartbeatInterval);
      state.heartbeatInterval = null;
    }

    // Close all client connections
    for (const clientInfo of state.clients) {
      try {
        clientInfo.controller.close();
        clientInfo.connected = false;
      } catch (error) {
        console.error('Error closing SSE client connection:', error);
      }
    }
    state.clients.clear();
    state.subscriptions.clear();

    // Stop Bun server
    if (state.server && state.server.stop) {
      try {
        state.server.stop();
        console.log('🛑 SSE server stopped');
      } catch (error) {
        console.error('Error stopping SSE server:', error);
      }
    }

    baseDistributor._updateHealth('disconnected');
    return true;
  };

  /**
   * Broadcast to all clients
   */
  const broadcast = async (event: string, data: any, options: SseSendOptions = {}): Promise<SseSendResult> => {
    return send(event, data, { ...options, broadcast: true });
  };

  /**
   * Subscribe to events (manage client subscriptions)
   */
  const subscribe = (eventPattern: string | RegExp, clientId: string | null = null): boolean => {
    const pattern = eventPattern instanceof RegExp ? eventPattern.toString() : eventPattern;
    
    // Find client if clientId provided
    const targetClients = clientId ? 
      Array.from(state.clients).filter(c => c.id === clientId) :
      Array.from(state.clients);

    for (const clientInfo of targetClients) {
      clientInfo.subscriptions.add(pattern);
      
      if (!state.subscriptions.has(pattern)) {
        state.subscriptions.set(pattern, new Set());
      }
      state.subscriptions.get(pattern)!.add(clientInfo);
    }

    console.log(`📡 Subscribed to pattern: ${pattern} (${targetClients.length} clients)`);
    return true;
  };

  /**
   * Get SSE-specific health information
   */
  const getHealth = (): SseHealth => {
    const baseHealth = baseDistributor.getHealth();
    
    return {
      ...baseHealth,
      protocol: 'sse',
      server: {
        port: state.config.port,
        host: state.config.host,
        endpoint: state.config.endpoint,
        running: !!state.server
      },
      clients: {
        connected: state.clients.size,
        maxConnections: state.config.maxConnections
      },
      subscriptions: {
        patterns: state.subscriptions.size,
        totalSubscribers: Array.from(state.subscriptions.values())
          .reduce((sum, subscribers) => sum + subscribers.size, 0)
      },
      capabilities: state.capabilities
    };
  };

  /**
   * Cleanup SSE resources
   */
  const cleanup = async (): Promise<void> => {
    await disconnect();
  };

  // Return enhanced distributor with SSE-specific methods
  const sseDistributor: SseDistributor = {
    ...baseDistributor,
    
    // Override base methods
    send,
    connect,
    disconnect,
    broadcast,
    subscribe,
    getHealth,
    cleanup,
    
    // SSE-specific methods
    getClients: (): SseClientSummary[] => Array.from(state.clients).map(c => ({
      id: c.id,
      connectedAt: c.connectedAt,
      lastActivity: c.lastActivity,
      subscriptions: Array.from(c.subscriptions)
    })),
    
    sendToClient: (clientId: string, event: string, data: any): boolean => {
      const client = Array.from(state.clients).find(c => c.id === clientId);
      return client ? sendToClient(client, event, data) : false;
    },
    
    getSubscriptions: (): SseSubscriptionSummary[] => Array.from(state.subscriptions.entries()).map(([pattern, subscribers]) => ({
      pattern,
      subscriberCount: subscribers.size
    })),
    
    // Configuration
    getCapabilities: (): string[] => [...state.capabilities],
    getEndpoint: (): string => state.config.endpoint,
    getPort: (): number => state.config.port,
    getHost: (): string => state.config.host,
    
    // Protocol identifier
    protocol: 'sse'
  };

  return sseDistributor;
};

