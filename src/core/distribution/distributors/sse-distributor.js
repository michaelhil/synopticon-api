/**
 * Server-Sent Events (SSE) Distributor
 * Handles distribution via Server-Sent Events for real-time web streaming
 */

import { createBaseDistributor, DistributorCapabilities } from '../base-distributor.js';

/**
 * Create SSE distributor for real-time web streaming
 * @param {Object} config - SSE distributor configuration
 * @returns {Object} SSE distributor instance
 */
export const createSseDistributor = (config = {}) => {
  const baseDistributor = createBaseDistributor({
    name: 'sse',
    ...config
  });

  const state = {
    server: null,
    clients: new Set(),
    config: {
      endpoint: config.endpoint || '/events/stream',
      port: config.port || 3001,
      host: config.host || 'localhost',
      heartbeatInterval: config.heartbeatInterval || 30000,
      compression: config.compression !== false,
      maxConnections: config.maxConnections || 500,
      corsOrigins: config.corsOrigins || ['*'],
      ...config
    },
    capabilities: [
      DistributorCapabilities.SEND,
      DistributorCapabilities.BROADCAST,
      DistributorCapabilities.REAL_TIME,
      DistributorCapabilities.SUBSCRIBE
    ],
    subscriptions: new Map(), // event pattern -> Set of client connections
    heartbeatInterval: null
  };

  /**
   * Create Bun HTTP server for SSE
   */
  const createServer = async () => {
    if (typeof window !== 'undefined') {
      // Browser environment - cannot create server
      console.warn('SSE server not available in browser environment');
      return null;
    }

    try {
      const server = Bun.serve({
        hostname: state.config.host,
        port: state.config.port,
        
        fetch(request) {
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

        error(error) {
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
  const getCorsHeaders = () => {
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
  const handleHealthCheck = (request) => {
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
  const handleSseConnection = (request) => {
    if (state.clients.size >= state.config.maxConnections) {
      return new Response('Server at capacity', { 
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    const clientId = generateClientId();
    
    // Create ReadableStream for SSE
    const stream = new ReadableStream({
      start(controller) {
        const clientInfo = {
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
  const cleanupClientSubscriptions = (clientInfo) => {
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
  const sendToClient = (clientInfo, event, data) => {
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
  const formatSseMessage = (event, data) => {
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
  const generateClientId = () => {
    return `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  /**
   * Send data via SSE to all connected clients
   */
  const send = async (event, data, options = {}) => {
    const startTime = Date.now();
    let sentCount = 0;
    let errorCount = 0;

    // Check if targeting specific clients
    const targetClients = options.clientIds ? 
      Array.from(state.clients).filter(client => options.clientIds.includes(client.id)) :
      Array.from(state.clients);

    // Check if event has specific subscribers
    let subscribedClients = [];
    if (state.subscriptions.has(event)) {
      subscribedClients = Array.from(state.subscriptions.get(event));
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
      baseDistributor._updateHealth('healthy', { lastSuccessfulSend: Date.now() });
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
  const connect = async () => {
    try {
      if (typeof window !== 'undefined') {
        // Browser environment - mark as connected for client-side usage
        baseDistributor._updateHealth('healthy', { connected: true });
        return true;
      }

      state.server = await createServer();
      
      // Start heartbeat interval
      if (state.config.heartbeatInterval > 0) {
        state.heartbeatInterval = setInterval(() => {
          broadcast('heartbeat', { timestamp: Date.now() });
        }, state.config.heartbeatInterval);
      }

      baseDistributor._updateHealth('healthy', { 
        connected: true,
        server: true,
        port: state.config.port,
        endpoint: state.config.endpoint
      });

      console.log(`🚀 SSE distributor listening on ${state.config.host}:${state.config.port}${state.config.endpoint}`);
      return true;
    } catch (error) {
      console.error('Failed to start SSE server:', error);
      baseDistributor._updateHealth('error', { 
        connected: false,
        lastError: error.message 
      });
      return false;
    }
  };

  /**
   * Disconnect (stop SSE server)
   */
  const disconnect = async () => {
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
  const broadcast = async (event, data, options = {}) => {
    return send(event, data, { ...options, broadcast: true });
  };

  /**
   * Subscribe to events (manage client subscriptions)
   */
  const subscribe = (eventPattern, clientId = null) => {
    // Find client if clientId provided
    let targetClients = clientId ? 
      Array.from(state.clients).filter(c => c.id === clientId) :
      Array.from(state.clients);

    for (const clientInfo of targetClients) {
      clientInfo.subscriptions.add(eventPattern);
      
      if (!state.subscriptions.has(eventPattern)) {
        state.subscriptions.set(eventPattern, new Set());
      }
      state.subscriptions.get(eventPattern).add(clientInfo);
    }

    console.log(`📡 Subscribed to pattern: ${eventPattern} (${targetClients.length} clients)`);
    return true;
  };

  /**
   * Get SSE-specific health information
   */
  const getHealth = () => {
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
  const cleanup = async () => {
    await disconnect();
  };

  // Return enhanced distributor with SSE-specific methods
  return {
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
    getClients: () => Array.from(state.clients).map(c => ({
      id: c.id,
      connectedAt: c.connectedAt,
      lastActivity: c.lastActivity,
      subscriptions: Array.from(c.subscriptions)
    })),
    
    sendToClient: (clientId, event, data) => {
      const client = Array.from(state.clients).find(c => c.id === clientId);
      return client ? sendToClient(client, event, data) : false;
    },
    
    getSubscriptions: () => Array.from(state.subscriptions.entries()).map(([pattern, subscribers]) => ({
      pattern,
      subscriberCount: subscribers.size
    })),
    
    // Configuration
    getCapabilities: () => [...state.capabilities],
    getEndpoint: () => state.config.endpoint,
    getPort: () => state.config.port,
    getHost: () => state.config.host,
    
    // Protocol identifier
    protocol: 'sse'
  };
};

export default createSseDistributor;