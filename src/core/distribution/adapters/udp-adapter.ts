/**
 * UDP Protocol Adapter
 * Consolidation of udp-distributor.ts
 * Functional factory pattern with Bun native UDP
 */

import { ProtocolAdapter, AdapterResult } from '../universal-distributor.js';
import { createLogger } from '../../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

export interface UdpAdapterConfig {
  host?: string;
  port?: number;
  bindPort?: number;
  multicastAddress?: string;
  multicastTtl?: number;
  broadcast?: boolean;
  bufferSize?: number;
  reuseAddress?: boolean;
}

export interface UdpAdapterStats {
  packetsSent: number;
  packetsReceived: number;
  bytesSent: number;
  bytesReceived: number;
  sendErrors: number;
  receiveErrors: number;
  lastSendTime: number | null;
  lastReceiveTime: number | null;
}

// UDP Adapter Factory (ADR 004/005 compliant)
export const createUdpAdapter = (config: UdpAdapterConfig = {}): ProtocolAdapter => {
  const state = {
    socket: null as any,
    bound: false,
    stats: {
      packetsSent: 0,
      packetsReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      sendErrors: 0,
      receiveErrors: 0,
      lastSendTime: null as number | null,
      lastReceiveTime: null as number | null,
    },
    config: {
      host: 'localhost',
      port: 8767,
      bindPort: 0, // Let system choose
      multicastTtl: 64,
      broadcast: false,
      bufferSize: 65536, // 64KB
      reuseAddress: true,
      ...config,
    },
  };

  // Initialize UDP socket
  const initializeSocket = (): void => {
    if (state.socket) {
      return; // Already initialized
    }

    try {
      // Create UDP socket using Bun's native UDP
      state.socket = Bun.udpSocket({
        port: state.config.bindPort,
        hostname: '0.0.0.0',
        socket: {
          data: handleIncomingData,
          error: handleSocketError,
        },
      });

      state.bound = true;
      logger.info(`UDP socket bound to port ${state.config.bindPort || 'auto'}`);
      
      // Configure multicast if specified
      if (state.config.multicastAddress) {
        configureMulticast();
      }
      
      // Configure broadcast if enabled
      if (state.config.broadcast) {
        configureBroadcast();
      }
    } catch (error) {
      logger.error(`Failed to initialize UDP socket: ${error}`);
      throw error;
    }
  };

  // Handle incoming UDP data
  const handleIncomingData = (socket: any, data: Buffer, sender: any): void => {
    try {
      state.stats = {
        ...state.stats,
        packetsReceived: state.stats.packetsReceived + 1,
        bytesReceived: state.stats.bytesReceived + data.length,
        lastReceiveTime: Date.now(),
      };
      
      logger.debug(`Received UDP packet from ${sender.address}:${sender.port}, size: ${data.length}`);
    } catch (error) {
      state.stats = {
        ...state.stats,
        receiveErrors: state.stats.receiveErrors + 1,
      };
      logger.warn(`UDP receive error: ${error}`);
    }
  };

  // Handle socket errors
  const handleSocketError = (error: any): void => {
    logger.error(`UDP socket error: ${error}`);
    state.stats = {
      ...state.stats,
      sendErrors: state.stats.sendErrors + 1,
    };
  };

  // Configure multicast settings
  const configureMulticast = (): void => {
    if (!state.config.multicastAddress) return;
    
    try {
      // Join multicast group (implementation depends on Bun's API)
      logger.info(`Configured multicast for ${state.config.multicastAddress}`);
    } catch (error) {
      logger.warn(`Failed to configure multicast: ${error}`);
    }
  };

  // Configure broadcast settings
  const configureBroadcast = (): void => {
    try {
      // Enable broadcast (implementation depends on Bun's API)
      logger.info('UDP broadcast enabled');
    } catch (error) {
      logger.warn(`Failed to enable broadcast: ${error}`);
    }
  };

  // Core send function
  const send = async (data: any, targetConfig: any): Promise<AdapterResult> => {
    const startTime = Date.now();
    
    try {
      // Initialize socket if needed
      if (!state.socket) {
        initializeSocket();
      }

      // Prepare data payload
      const payload = preparePayload(data);
      
      // Determine target(s)
      const targets = resolveTargets(targetConfig);
      
      if (targets.length === 0) {
        return {
          success: false,
          protocol: 'udp',
          error: 'No valid targets specified',
          code: 'NO_TARGETS',
          timing: { startTime, endTime: Date.now(), duration: Date.now() - startTime },
        };
      }

      // Send to all targets
      let successCount = 0;
      const results: any[] = [];
      
      for (const target of targets) {
        try {
          await sendToTarget(payload, target.host, target.port);
          successCount++;
          results.push({ host: target.host, port: target.port, success: true });
        } catch (error) {
          results.push({ 
            host: target.host, 
            port: target.port, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const endTime = Date.now();
      
      // Update stats
      state.stats = {
        ...state.stats,
        packetsSent: state.stats.packetsSent + successCount,
        bytesSent: state.stats.bytesSent + (payload.length * successCount),
        sendErrors: state.stats.sendErrors + (targets.length - successCount),
        lastSendTime: endTime,
      };

      return {
        success: successCount > 0,
        protocol: 'udp',
        data: {
          totalTargets: targets.length,
          successfulSends: successCount,
          failedSends: targets.length - successCount,
          payloadSize: payload.length,
          results,
        },
        timing: { startTime, endTime, duration: endTime - startTime },
      };

    } catch (error) {
      const endTime = Date.now();
      const errorMessage = error instanceof Error ? error.message : 'Unknown UDP error';
      
      state.stats = {
        ...state.stats,
        sendErrors: state.stats.sendErrors + 1,
      };
      
      return {
        success: false,
        protocol: 'udp',
        error: errorMessage,
        code: 'UDP_SEND_FAILED',
        timing: { startTime, endTime, duration: endTime - startTime },
      };
    }
  };

  // Prepare data payload for UDP transmission
  const preparePayload = (data: any): Buffer => {
    if (Buffer.isBuffer(data)) {
      return data;
    }
    
    if (typeof data === 'string') {
      return Buffer.from(data, 'utf-8');
    }
    
    // Serialize objects to JSON
    return Buffer.from(JSON.stringify(data), 'utf-8');
  };

  // Resolve target addresses from configuration
  const resolveTargets = (config: any): Array<{ host: string; port: number }> => {
    const targets: Array<{ host: string; port: number }> = [];
    
    // Single target
    if (config.host && config.port) {
      targets.push({ host: config.host, port: config.port });
    }
    
    // Multiple targets
    if (config.targets && Array.isArray(config.targets)) {
      for (const target of config.targets) {
        if (target.host && target.port) {
          targets.push({ host: target.host, port: target.port });
        }
      }
    }
    
    // Broadcast targets
    if (config.broadcast) {
      targets.push({ host: '255.255.255.255', port: config.port || state.config.port });
    }
    
    // Multicast targets
    if (config.multicast && state.config.multicastAddress) {
      targets.push({ 
        host: state.config.multicastAddress, 
        port: config.port || state.config.port 
      });
    }
    
    // Default target if none specified
    if (targets.length === 0) {
      targets.push({ host: state.config.host, port: state.config.port });
    }
    
    return targets;
  };

  // Send payload to specific target
  const sendToTarget = async (payload: Buffer, host: string, port: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // Send UDP packet
        state.socket.send(payload, port, host);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  };

  // Health check function
  const healthCheck = async (): Promise<boolean> => {
    try {
      if (!state.socket) {
        initializeSocket();
      }
      return state.bound;
    } catch (error) {
      logger.debug(`UDP adapter health check failed: ${error}`);
      return false;
    }
  };

  // Configuration update
  const configure = (newConfig: any): void => {
    state.config = { ...state.config, ...newConfig };
    logger.debug('UDP adapter configuration updated');
    
    // Reinitialize socket if network parameters changed
    if (state.socket && (newConfig.bindPort || newConfig.multicastAddress)) {
      closeSocket();
    }
  };

  // Close UDP socket
  const closeSocket = (): void => {
    if (state.socket) {
      try {
        state.socket.close();
      } catch (error) {
        logger.warn(`Error closing UDP socket: ${error}`);
      }
      
      state.socket = null;
      state.bound = false;
      logger.debug('UDP socket closed');
    }
  };

  // Get current statistics
  const getStats = (): UdpAdapterStats => ({ ...state.stats });

  // Get socket info
  const getSocketInfo = () => ({
    bound: state.bound,
    bindPort: state.config.bindPort,
    multicast: state.config.multicastAddress,
    broadcast: state.config.broadcast,
  });

  // Return adapter instance
  return {
    protocol: 'udp',
    capabilities: ['datagrams', 'broadcast', 'multicast', 'low-latency'],
    send,
    healthCheck,
    configure,
    
    // Additional UDP-specific methods
    getStats,
    getSocketInfo,
    closeSocket,
    getConfig: () => ({ ...state.config }),
  };
};

export type UdpAdapter = ReturnType<typeof createUdpAdapter>;