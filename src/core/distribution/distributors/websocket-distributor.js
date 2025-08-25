/**
 * WebSocket Distributor - Bun Native
 * Handles real-time bidirectional communication via Bun native WebSocket
 * Zero external dependencies
 */

import { createBaseDistributor, DistributorCapabilities } from '../base-distributor.js';

/**
 * Create Bun native WebSocket distributor for real-time communication
 * @param {Object} config - WebSocket distributor configuration
 * @returns {Object} WebSocket distributor instance
 */
export const createWebSocketDistributor = (config = {}) => {
  const baseDistributor = createBaseDistributor({
    name: 'websocket',
    ...config
  });

  const state = {
    clients: new Set(),
    server: null,
    config: {
      port: config.port || 8080,
      host: config.host || 'localhost',
      maxConnections: config.maxConnections || 1000,
      heartbeatInterval: config.heartbeatInterval || 30000,
      compression: config.compression !== false,
      maxPayload: config.maxPayload || 1024 * 1024, // 1MB
      ...config
    },
    capabilities: [
      DistributorCapabilities.SEND,
      DistributorCapabilities.RECEIVE,
      DistributorCapabilities.SUBSCRIBE,
      DistributorCapabilities.BROADCAST,
      DistributorCapabilities.REAL_TIME
    ],
    subscriptions: new Map(), // event pattern -> Set of client callbacks
    heartbeatInterval: null
  };

  /**
   * Create Bun native WebSocket server
   */
  const createServer = async () => {
    if (typeof window !== 'undefined') {
      // Browser environment - cannot create server
      console.warn('WebSocket server not available in browser environment');
      return null;
    }

    try {
      // Use Bun.serve for WebSocket server
      const server = Bun.serve({
        port: state.config.port,
        hostname: state.config.host,
        
        // HTTP handler - upgrade WebSocket connections
        async fetch(request, server) {
          const url = new URL(request.url);
          
          if (server.upgrade(request)) {
            return; // WebSocket upgrade successful
          }
          
          // Return 404 for non-WebSocket requests
          return new Response('WebSocket endpoint only', { status: 404 });
        },
        
        // Bun native WebSocket handlers
        websocket: {
          open(ws) {
            if (state.clients.size >= state.config.maxConnections) {
              ws.close(1013, 'Server at capacity');
              return;
            }

            const clientId = generateClientId();
            const clientInfo = {
              id: clientId,
              ws,
              connected: true,
              connectedAt: Date.now(),
              lastActivity: Date.now(),
              subscriptions: new Set()
            };

            ws.clientInfo = clientInfo;
            state.clients.add(clientInfo);

            console.log(`🔌 WebSocket client connected: ${clientId} (${state.clients.size} total)`);

            // Send welcome message
            sendToClient(clientInfo, 'connection', {
              clientId,
              timestamp: Date.now(),
              server: 'synopticon-api'
            });

            baseDistributor._updateStats('messagesReceived');
          },
          
          message(ws, message) {
            // Find client info
            let clientInfo = null;
            for (const client of state.clients) {
              if (client.ws === ws) {
                clientInfo = client;
                break;
              }
            }
            
            if (clientInfo) {
              const data = typeof message === 'string' ? message : new TextDecoder().decode(message);
              handleClientMessage(clientInfo, data);
            }
          },
          
          close(ws) {
            // Find and remove client
            let clientInfo = null;
            for (const client of state.clients) {
              if (client.ws === ws) {
                clientInfo = client;
                break;
              }
            }
            
            if (clientInfo) {
              state.clients.delete(clientInfo);
              cleanupClientSubscriptions(clientInfo);
              console.log(`🔌 WebSocket client disconnected: ${clientInfo.id} (${state.clients.size} remaining)`);
            }
          }
        }
      });

      return server;
    } catch (error) {
      console.error('Failed to create Bun WebSocket server:', error);
      throw error;
    }
  };

  /**
   * Handle messages from clients
   */
  const handleClientMessage = (clientInfo, data) => {
    try {
      const message = JSON.parse(data.toString());
      clientInfo.lastActivity = Date.now();
      
      switch (message.type) {
        case 'subscribe':
          handleSubscription(clientInfo, message.event, true);
          break;
        case 'unsubscribe':
          handleSubscription(clientInfo, message.event, false);
          break;
        case 'ping':
          sendToClient(clientInfo, 'pong', { timestamp: Date.now() });
          break;
        default:
          console.log(`Received message from ${clientInfo.id}:`, message);
      }
      
      baseDistributor._updateStats('messagesReceived');
    } catch (error) {
      console.error('Error handling client message:', error);
      sendToClient(clientInfo, 'error', { error: 'Invalid message format' });
    }
  };

  /**
   * Handle client subscriptions
   */
  const handleSubscription = (clientInfo, eventPattern, subscribe) => {
    if (subscribe) {
      clientInfo.subscriptions.add(eventPattern);
      
      if (!state.subscriptions.has(eventPattern)) {
        state.subscriptions.set(eventPattern, new Set());
      }
      state.subscriptions.get(eventPattern).add(clientInfo);
      
      sendToClient(clientInfo, 'subscribed', { event: eventPattern });
    } else {
      clientInfo.subscriptions.delete(eventPattern);
      
      const subscribers = state.subscriptions.get(eventPattern);
      if (subscribers) {
        subscribers.delete(clientInfo);
        if (subscribers.size === 0) {
          state.subscriptions.delete(eventPattern);
        }
      }
      
      sendToClient(clientInfo, 'unsubscribed', { event: eventPattern });
    }
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
   * Send message to specific client (Bun native)
   */
  const sendToClient = (clientInfo, event, data) => {
    if (!clientInfo.connected) {
      return false;
    }

    try {
      const message = JSON.stringify({
        event,
        data,
        timestamp: Date.now(),
        clientId: clientInfo.id
      });

      clientInfo.ws.send(message);
      return true;
    } catch (error) {
      console.error(`Failed to send to client ${clientInfo.id}:`, error);
      return false;
    }
  };

  /**
   * Generate unique client ID
   */
  const generateClientId = () => {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  /**
   * Send data via WebSocket to all connected clients
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

    const message = JSON.stringify({
      event,
      data,
      timestamp: Date.now(),
      metadata: options.metadata || {}
    });

    for (const clientInfo of clientsToSend) {
      if (clientInfo.connected) {
        try {
          clientInfo.ws.send(message);
          sentCount++;
        } catch (error) {
          errorCount++;
          console.error(`Failed to send to client ${clientInfo.id}:`, error);
        }
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
   * Connect (start WebSocket server)
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
        port: state.config.port
      });

      console.log(`🚀 WebSocket distributor listening on ${state.config.host}:${state.config.port}`);
      return true;
    } catch (error) {
      baseDistributor._updateHealth('error', { 
        connected: false,
        lastError: error.message 
      });
      console.error('Failed to start WebSocket server:', error);
      return false;
    }
  };

  /**
   * Disconnect (stop WebSocket server)
   */
  const disconnect = async () => {
    if (state.heartbeatInterval) {
      clearInterval(state.heartbeatInterval);
      state.heartbeatInterval = null;
    }

    // Close all client connections
    for (const clientInfo of state.clients) {
      try {
        clientInfo.ws.close(1001, 'Server shutting down');
      } catch (error) {
        console.error('Error closing client connection:', error);
      }
    }
    state.clients.clear();
    state.subscriptions.clear();

    // Close Bun server
    if (state.server) {
      state.server.stop();
      console.log('🛑 Bun WebSocket server stopped');
      baseDistributor._updateHealth('disconnected');
      return true;
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
   * Subscribe to events (for client-side usage)
   */
  const subscribe = (eventPattern, callback) => {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    // This would be used in client-side implementations
    console.log(`📡 Subscribed to pattern: ${eventPattern}`);
    return true;
  };

  /**
   * Get WebSocket-specific health information
   */
  const getHealth = () => {
    const baseHealth = baseDistributor.getHealth();
    
    return {
      ...baseHealth,
      protocol: 'websocket',
      server: {
        port: state.config.port,
        host: state.config.host,
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

  // Return enhanced distributor with WebSocket-specific methods
  return {
    ...baseDistributor,
    
    // Override base methods
    send,
    connect,
    disconnect,
    broadcast,
    subscribe,
    getHealth,
    
    // WebSocket-specific methods
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
    getPort: () => state.config.port,
    getHost: () => state.config.host,
    
    // Protocol identifier
    protocol: 'websocket'
  };
};

export default createWebSocketDistributor;