/**
import { createLogger } from '../shared/utils/logger.js';

const logger = createLogger({ level: 2 });
 * Transport Infrastructure for Real-time Data Streaming
 * Using Bun's native capabilities for WebSocket, HTTP/3, and other protocols
 * Following functional programming patterns
 */

// WebSocket transport factory using Bun's WebSocket
export const createWebSocketTransport = (config = {}) => {
  const state = {
    connections: new Map(),
    isServer: config.isServer || false,
    port: config.port || 8080,
    server: null,
    clientSocket: null,
    callbacks: {
      onConnect: [],
      onMessage: [],
      onDisconnect: [],
      onError: []
    },
    reconnect: {
      enabled: config.autoReconnect !== false,
      interval: config.reconnectInterval || 5000,
      maxAttempts: config.maxReconnectAttempts || 10,
      attempts: 0
    }
  };

  // Server-side WebSocket implementation
  const startServer = () => {
    if (state.server) return state.server;

    state.server = Bun.serve({
      port: state.port,
      fetch(req, server) {
        
        // Handle WebSocket upgrade
        if (server.upgrade(req, {
          data: { 
            id: crypto.randomUUID(),
            connectedAt: Date.now()
          }
        })) {
          return; // Successfully upgraded
        }
        
        // Fallback for non-WebSocket requests
        return new Response("WebSocket transport server", { status: 200 });
      },
      
      websocket: {
        open(ws) {
          const connectionId = ws.data.id;
          state.connections.set(connectionId, ws);
          
          // Notify connection callbacks
          state.callbacks.onConnect.forEach(cb => {
            try {
              cb({ id: connectionId, socket: ws });
            } catch (error) {
              console.warn('Connect callback error:', error);
            }
          });
        },
        
        message(ws, message) {
          let parsedMessage;
          try {
            parsedMessage = typeof message === 'string' ? JSON.parse(message) : message;
          } catch (error) {
            console.warn('Message parsing error:', error);
            return;
          }
          
          // Notify message callbacks
          state.callbacks.onMessage.forEach(cb => {
            try {
              cb(parsedMessage, ws);
            } catch (error) {
              console.warn('Message callback error:', error);
            }
          });
        },
        
        close(ws) {
          const connectionId = ws.data.id;
          state.connections.delete(connectionId);
          
          // Notify disconnect callbacks
          state.callbacks.onDisconnect.forEach(cb => {
            try {
              cb({ id: connectionId, socket: ws });
            } catch (error) {
              console.warn('Disconnect callback error:', error);
            }
          });
        },
        
        error(ws, error) {
          console.error('WebSocket error:', error);
          
          state.callbacks.onError.forEach(cb => {
            try {
              cb(error, ws);
            } catch (cbError) {
              console.warn('Error callback failed:', cbError);
            }
          });
        }
      }
    });

    console.log(`WebSocket server listening on port ${state.port}`);
    return state.server;
  };

  // Client-side WebSocket connection
  const connect = async (url) => {
    if (state.clientSocket) return state.clientSocket;

    return new Promise((resolve, reject) => {
      try {
        state.clientSocket = new WebSocket(url);
        
        state.clientSocket.onopen = () => {
          state.reconnect.attempts = 0;
          
          state.callbacks.onConnect.forEach(cb => {
            try {
              cb({ socket: state.clientSocket });
            } catch (error) {
              console.warn('Connect callback error:', error);
            }
          });
          
          resolve(state.clientSocket);
        };
        
        state.clientSocket.onmessage = (event) => {
          let parsedMessage;
          try {
            parsedMessage = JSON.parse(event.data);
          } catch (error) {
            console.warn('Message parsing error:', error);
            return;
          }
          
          state.callbacks.onMessage.forEach(cb => {
            try {
              cb(parsedMessage, state.clientSocket);
            } catch (error) {
              console.warn('Message callback error:', error);
            }
          });
        };
        
        state.clientSocket.onclose = () => {
          state.clientSocket = null;
          
          state.callbacks.onDisconnect.forEach(cb => {
            try {
              cb({ socket: state.clientSocket });
            } catch (error) {
              console.warn('Disconnect callback error:', error);
            }
          });
          
          // Auto-reconnect if enabled
          if (state.reconnect.enabled && state.reconnect.attempts < state.reconnect.maxAttempts) {
            setTimeout(() => {
              state.reconnect.attempts++;
              console.log(`Reconnect attempt ${state.reconnect.attempts}/${state.reconnect.maxAttempts}`);
              connect(url);
            }, state.reconnect.interval);
          }
        };
        
        state.clientSocket.onerror = (error) => {
          state.callbacks.onError.forEach(cb => {
            try {
              cb(error, state.clientSocket);
            } catch (cbError) {
              console.warn('Error callback failed:', cbError);
            }
          });
          
          reject(error);
        };
        
      } catch (error) {
        reject(error);
      }
    });
  };

  // Send data to all connections (server) or to server (client)
  const send = (data) => {
    const message = JSON.stringify(data);
    
    if (state.isServer) {
      // Broadcast to all connected clients
      let sent = 0;
      for (const [id, ws] of state.connections) {
        try {
          ws.send(message);
          sent++;
        } catch (error) {
          console.warn(`Failed to send to connection ${id}:`, error);
        }
      }
      return sent;
    } else {
      // Send to server
      if (state.clientSocket && state.clientSocket.readyState === WebSocket.OPEN) {
        state.clientSocket.send(message);
        return 1;
      }
      return 0;
    }
  };

  // Send to specific connection (server only)
  const sendTo = (connectionId, data) => {
    if (!state.isServer) throw new Error('sendTo only available in server mode');
    
    const ws = state.connections.get(connectionId);
    if (ws) {
      try {
        ws.send(JSON.stringify(data));
        return true;
      } catch (error) {
        console.warn(`Failed to send to ${connectionId}:`, error);
        return false;
      }
    }
    return false;
  };

  const stop = () => {
    // Close all connections
    for (const [id, ws] of state.connections) {
      try {
        ws.close();
      } catch (error) {
        console.warn(`Error closing connection ${id}:`, error);
      }
    }
    
    // Stop server if running
    if (state.server) {
      state.server.stop();
      state.server = null;
    }
    
    // Close client connection
    if (state.clientSocket) {
      state.clientSocket.close();
      state.clientSocket = null;
    }
    
    state.connections.clear();
  };

  // Event handlers
  const onConnect = (callback) => {
    state.callbacks.onConnect.push(callback);
    return () => {
      const index = state.callbacks.onConnect.indexOf(callback);
      if (index !== -1) state.callbacks.onConnect.splice(index, 1);
    };
  };

  const onMessage = (callback) => {
    state.callbacks.onMessage.push(callback);
    return () => {
      const index = state.callbacks.onMessage.indexOf(callback);
      if (index !== -1) state.callbacks.onMessage.splice(index, 1);
    };
  };

  const onDisconnect = (callback) => {
    state.callbacks.onDisconnect.push(callback);
    return () => {
      const index = state.callbacks.onDisconnect.indexOf(callback);
      if (index !== -1) state.callbacks.onDisconnect.splice(index, 1);
    };
  };

  const onError = (callback) => {
    state.callbacks.onError.push(callback);
    return () => {
      const index = state.callbacks.onError.indexOf(callback);
      if (index !== -1) state.callbacks.onError.splice(index, 1);
    };
  };

  return {
    // Connection management
    startServer: state.isServer ? startServer : undefined,
    connect: !state.isServer ? connect : undefined,
    stop,
    
    // Data transmission
    send,
    sendTo: state.isServer ? sendTo : undefined,
    
    // Event handlers
    onConnect,
    onMessage,
    onDisconnect,
    onError,
    
    // Status
    getConnectionCount: () => state.connections.size,
    isConnected: () => state.isServer ? state.connections.size > 0 : 
                       (state.clientSocket && state.clientSocket.readyState === WebSocket.OPEN),
    getStats: () => ({
      connectionCount: state.connections.size,
      isServer: state.isServer,
      port: state.port,
      reconnectAttempts: state.reconnect.attempts
    })
  };
};

// HTTP transport factory using Bun's fetch
export const createHttpTransport = (config = {}) => {
  const state = {
    baseUrl: config.baseUrl || (process.env.TRANSPORT_BASE_URL || 'http://localhost:8080'), // localhost HTTP OK for dev
    headers: config.headers || {
      'Content-Type': 'application/json'
    },
    timeout: config.timeout || 10000
  };

  const send = async (endpoint, data, options = {}) => {
    const url = `${state.baseUrl}${endpoint}`;
    const method = options.method || 'POST';
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          ...state.headers,
          ...options.headers
        },
        body: method !== 'GET' ? JSON.stringify(data) : undefined,
        signal: AbortSignal.timeout(state.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        data: result,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  };

  const get = (endpoint, options = {}) => send(endpoint, null, { ...options, method: 'GET' });
  const post = (endpoint, data, options = {}) => send(endpoint, data, { ...options, method: 'POST' });
  const put = (endpoint, data, options = {}) => send(endpoint, data, { ...options, method: 'PUT' });
  const del = (endpoint, options = {}) => send(endpoint, null, { ...options, method: 'DELETE' });

  // Eye tracker specific API methods
  const getStatus = () => get('/api/status');
  const startRecording = (recordingId, config = {}) => post('/api/recordings', { 
    recording_id: recordingId,
    ...config 
  });
  const stopRecording = () => post('/api/recordings/stop');
  const getRecordings = () => get('/api/recordings');
  const startCalibration = () => post('/api/calibration/start');
  const stopCalibration = () => post('/api/calibration/stop');
  const getCalibration = () => get('/api/calibration');

  return {
    send,
    get,
    post,
    put,
    delete: del,
    
    // Eye tracker specific methods
    getStatus,
    startRecording,
    stopRecording,
    getRecordings,
    startCalibration,
    stopCalibration,
    getCalibration,
    
    // Configuration
    getBaseUrl: () => state.baseUrl,
    setTimeout: (timeout) => { state.timeout = timeout; },
    setHeaders: (headers) => { state.headers = { ...state.headers, ...headers }; }
  };
};

// UDP transport factory using Bun's dgram
export const createUdpTransport = (config = {}) => {
  const state = {
    socket: null,
    port: config.port || 8080,
    host: config.host || (process.env.WEBSOCKET_HOST || 'localhost'),
    isServer: config.isServer || false,
    callbacks: {
      onMessage: [],
      onError: []
    }
  };

  // Note: Bun doesn't have built-in UDP support yet
  // This is a placeholder for when it's available or using Node.js dgram
  const start = async () => {
    throw new Error('UDP transport not yet implemented - waiting for Bun UDP support');
  };

  const send = async () => {
    throw new Error('UDP transport not yet implemented - waiting for Bun UDP support');
  };

  const stop = () => {
    if (state.socket) {
      state.socket.close();
      state.socket = null;
    }
  };

  return {
    start,
    send,
    stop,
    onMessage: (callback) => {
      state.callbacks.onMessage.push(callback);
      return () => {
        const index = state.callbacks.onMessage.indexOf(callback);
        if (index !== -1) state.callbacks.onMessage.splice(index, 1);
      };
    },
    onError: (callback) => {
      state.callbacks.onError.push(callback);
      return () => {
        const index = state.callbacks.onError.indexOf(callback);
        if (index !== -1) state.callbacks.onError.splice(index, 1);
      };
    }
  };
};

// Transport factory registry
export const createTransportFactory = () => {
  const transports = new Map();
  
  // Register default transports
  transports.set('websocket', createWebSocketTransport);
  transports.set('http', createHttpTransport);
  transports.set('udp', createUdpTransport);

  const register = (protocol, factory) => {
    transports.set(protocol, factory);
  };

  const create = (protocol, config = {}) => {
    const factory = transports.get(protocol);
    if (!factory) {
      throw new Error(`Unknown transport protocol: ${protocol}`);
    }
    return factory(config);
  };

  const getAvailableProtocols = () => Array.from(transports.keys());

  return {
    register,
    create,
    getAvailableProtocols
  };
};

// Default transport factory instance
export const transportFactory = createTransportFactory();