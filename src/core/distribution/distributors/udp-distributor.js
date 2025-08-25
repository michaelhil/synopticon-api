/**
 * UDP Distributor
 * Handles distribution via UDP datagrams for high-frequency, low-latency data
 */

import { createBaseDistributor, DistributorCapabilities } from '../base-distributor.js';

/**
 * Create UDP distributor for high-frequency, low-latency data transmission
 * @param {Object} config - UDP distributor configuration
 * @returns {Object} UDP distributor instance
 */
export const createUdpDistributor = (config = {}) => {
  const baseDistributor = createBaseDistributor({
    name: 'udp',
    ...config
  });

  const state = {
    socket: null,
    config: {
      port: config.port || 9999,
      host: config.host || '127.0.0.1',
      bindPort: config.bindPort || 0, // 0 for random port
      maxPayload: config.maxPayload || 1024, // 1KB default for UDP
      compress: config.compress !== false,
      targets: config.targets || [{ host: '127.0.0.1', port: 9999 }],
      ...config
    },
    capabilities: [
      DistributorCapabilities.SEND,
      DistributorCapabilities.BROADCAST,
      DistributorCapabilities.FAST
    ],
    messageQueue: [],
    isConnected: false
  };

  /**
   * Create UDP socket
   */
  const createSocket = async () => {
    try {
      // Dynamic import for dgram module
      let dgram;
      try {
        dgram = await import('dgram');
      } catch (error) {
        console.warn('UDP (dgram) not available in this environment');
        throw new Error('UDP not supported in this environment');
      }

      const socket = dgram.createSocket('udp4');

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('UDP socket creation timeout'));
        }, 5000);

        socket.on('listening', () => {
          clearTimeout(timeout);
          const address = socket.address();
          state.isConnected = true;
          
          console.log(`🚀 UDP distributor listening on ${address.address}:${address.port}`);
          
          baseDistributor._updateHealth('healthy', {
            connected: true,
            listening: true,
            bindAddress: address
          });
          
          resolve(socket);
        });

        socket.on('message', (message, remoteInfo) => {
          handleMessage(message, remoteInfo);
        });

        socket.on('error', (error) => {
          clearTimeout(timeout);
          state.isConnected = false;
          console.error('UDP socket error:', error);
          
          baseDistributor._updateHealth('error', {
            connected: false,
            lastError: error.message
          });
          
          reject(error);
        });

        socket.on('close', () => {
          state.isConnected = false;
          console.log('🔌 UDP socket closed');
          
          baseDistributor._updateHealth('disconnected', {
            connected: false
          });
        });

        // Bind to port
        socket.bind(state.config.bindPort, () => {
          // Binding successful, will trigger 'listening' event
        });
      });
    } catch (error) {
      console.error('Failed to create UDP socket:', error);
      throw error;
    }
  };

  /**
   * Handle incoming UDP messages
   */
  const handleMessage = (message, remoteInfo) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`📨 Received UDP message from ${remoteInfo.address}:${remoteInfo.port}`);
      
      baseDistributor._updateStats('messagesReceived');
    } catch (error) {
      console.error('Error handling UDP message:', error);
    }
  };

  /**
   * Compress data if enabled
   */
  const compressData = async (data) => {
    if (!state.config.compress) {
      return data;
    }

    try {
      // Simple compression using built-in zlib
      const zlib = await import('zlib');
      const { promisify } = await import('util');
      const gzip = promisify(zlib.gzip);
      
      return await gzip(Buffer.from(data));
    } catch (error) {
      console.warn('Compression failed, sending uncompressed:', error.message);
      return Buffer.from(data);
    }
  };

  /**
   * Send data via UDP
   */
  const send = async (event, data, options = {}) => {
    if (!state.socket || !state.isConnected) {
      throw new Error('UDP socket not connected');
    }

    const startTime = Date.now();
    const targets = options.targets || state.config.targets;

    // Prepare payload
    const payload = JSON.stringify({
      event,
      data,
      timestamp: Date.now(),
      metadata: {
        source: 'synopticon-api',
        distributor: 'udp',
        ...options.metadata
      }
    });

    // Check payload size
    if (Buffer.byteLength(payload) > state.config.maxPayload) {
      throw new Error(`Payload too large: ${Buffer.byteLength(payload)} bytes > ${state.config.maxPayload} bytes`);
    }

    // Compress if enabled
    const finalPayload = await compressData(payload);

    const results = [];

    // Send to all targets
    const sendPromises = targets.map(target => {
      return new Promise((resolve) => {
        const targetHost = target.host || state.config.host;
        const targetPort = target.port || state.config.port;

        state.socket.send(finalPayload, targetPort, targetHost, (error) => {
          const duration = Date.now() - startTime;
          
          if (error) {
            console.error(`UDP send error to ${targetHost}:${targetPort}:`, error);
            baseDistributor._updateStats('errors');
            
            resolve({
              target: `${targetHost}:${targetPort}`,
              success: false,
              error: error.message,
              duration
            });
          } else {
            baseDistributor._updateStats('messagesSent');
            
            resolve({
              target: `${targetHost}:${targetPort}`,
              success: true,
              duration,
              payloadSize: Buffer.byteLength(finalPayload)
            });
          }
        });
      });
    });

    const sendResults = await Promise.all(sendPromises);
    results.push(...sendResults);

    const successCount = results.filter(r => r.success).length;
    if (successCount > 0) {
      baseDistributor._updateHealth('healthy', { lastSuccessfulSend: Date.now() });
    }

    return {
      success: successCount > 0,
      event,
      targets: results.length,
      successful: successCount,
      failed: results.length - successCount,
      results,
      totalDuration: Date.now() - startTime
    };
  };

  /**
   * Connect (start UDP socket)
   */
  const connect = async () => {
    try {
      state.socket = await createSocket();
      return true;
    } catch (error) {
      console.error('Failed to start UDP socket:', error);
      return false;
    }
  };

  /**
   * Disconnect (close UDP socket)
   */
  const disconnect = async () => {
    if (state.socket) {
      return new Promise((resolve) => {
        state.socket.close(() => {
          state.isConnected = false;
          console.log('🛑 UDP socket stopped');
          baseDistributor._updateHealth('disconnected');
          resolve(true);
        });
      });
    }
    return true;
  };

  /**
   * Broadcast to all configured targets
   */
  const broadcast = async (event, data, options = {}) => {
    return send(event, data, { 
      ...options, 
      targets: options.targets || state.config.targets 
    });
  };

  /**
   * Send to specific target
   */
  const sendTo = async (host, port, event, data, options = {}) => {
    return send(event, data, {
      ...options,
      targets: [{ host, port }]
    });
  };

  /**
   * Add target for broadcasting
   */
  const addTarget = (host, port) => {
    const target = { host, port };
    const exists = state.config.targets.some(t => t.host === host && t.port === port);
    
    if (!exists) {
      state.config.targets.push(target);
      console.log(`📡 Added UDP target: ${host}:${port}`);
    }
  };

  /**
   * Remove target from broadcasting
   */
  const removeTarget = (host, port) => {
    const index = state.config.targets.findIndex(t => t.host === host && t.port === port);
    
    if (index > -1) {
      state.config.targets.splice(index, 1);
      console.log(`📡 Removed UDP target: ${host}:${port}`);
      return true;
    }
    return false;
  };

  /**
   * Get UDP-specific health information
   */
  const getHealth = () => {
    const baseHealth = baseDistributor.getHealth();
    const socketAddress = state.socket ? state.socket.address() : null;
    
    return {
      ...baseHealth,
      protocol: 'udp',
      socket: {
        connected: state.isConnected,
        address: socketAddress
      },
      config: {
        port: state.config.port,
        host: state.config.host,
        maxPayload: state.config.maxPayload,
        compress: state.config.compress
      },
      targets: state.config.targets.length,
      capabilities: state.capabilities
    };
  };

  /**
   * Cleanup UDP resources
   */
  const cleanup = async () => {
    await disconnect();
    state.messageQueue.length = 0;
  };

  // Return enhanced distributor with UDP-specific methods
  return {
    ...baseDistributor,
    
    // Override base methods
    send,
    connect,
    disconnect,
    broadcast,
    getHealth,
    cleanup,
    
    // UDP-specific methods
    sendTo,
    addTarget,
    removeTarget,
    getCapabilities: () => [...state.capabilities],
    getTargets: () => [...state.config.targets],
    
    // Configuration
    getMaxPayload: () => state.config.maxPayload,
    setMaxPayload: (size) => {
      state.config.maxPayload = Math.min(size, 65507); // UDP max payload
    },
    
    isConnected: () => state.isConnected,
    
    // Protocol identifier
    protocol: 'udp'
  };
};

export default createUdpDistributor;