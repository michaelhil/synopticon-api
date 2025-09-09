/**
 * Tobii 5 Device Discovery
 * Auto-discovers Tobii bridge servers on the network
 * Integrates with Synopticon's device discovery system
 */

import { createLogger } from '../../../../shared/utils/logger.js';
import { createEventEmitter } from '../../../../shared/utils/events.js';

const logger = createLogger({ level: 2, component: 'Tobii5Discovery' });

/**
 * Network discovery configuration
 */
const DISCOVERY_CONFIG = {
  broadcastPort: 8083,
  listenPort: 8084, 
  discoveryInterval: 5000,
  deviceTimeout: 15000,
  maxDiscoveryTime: 30000
};

/**
 * Create Tobii 5 discovery service
 */
export const createTobii5Discovery = (config = {}) => {
  const {
    broadcastPort = DISCOVERY_CONFIG.broadcastPort,
    listenPort = DISCOVERY_CONFIG.listenPort,
    discoveryInterval = DISCOVERY_CONFIG.discoveryInterval,
    deviceTimeout = DISCOVERY_CONFIG.deviceTimeout
  } = config;

  const eventEmitter = createEventEmitter();
  const discoveredDevices = new Map();
  
  let udpSocket = null;
  let discoveryTimer = null;
  let timeoutTimer = null;
  let isDiscovering = false;

  /**
   * Start network discovery for Tobii bridges
   */
  const discoverDevices = async (timeout = DISCOVERY_CONFIG.maxDiscoveryTime) => {
    if (isDiscovering) {
      return Array.from(discoveredDevices.values());
    }

    logger.info('🔍 Starting Tobii 5 device discovery');
    isDiscovering = true;
    discoveredDevices.clear();

    try {
      // Dynamic import for dgram (Node.js UDP)
      const dgram = await import('dgram');
      
      return new Promise((resolve) => {
        // Create UDP socket for listening to discovery responses
        udpSocket = dgram.createSocket('udp4');
        
        udpSocket.on('message', (message, remoteInfo) => {
          handleDiscoveryResponse(message, remoteInfo);
        });

        udpSocket.on('error', (error) => {
          logger.error('UDP discovery socket error:', error);
        });

        // Bind to listen port
        udpSocket.bind(listenPort, () => {
          logger.debug(`UDP discovery socket bound to port ${listenPort}`);
          
          // Start sending discovery broadcasts
          startDiscoveryBroadcast();
          
          // Set timeout for discovery completion
          timeoutTimer = setTimeout(() => {
            stopDiscovery();
            const devices = Array.from(discoveredDevices.values());
            logger.info(`✅ Discovery completed: found ${devices.length} Tobii bridge(s)`);
            resolve(devices);
          }, timeout);
        });
      });
    } catch (error) {
      logger.error('Failed to start Tobii 5 discovery:', error);
      isDiscovering = false;
      return [];
    }
  };

  /**
   * Start broadcasting discovery requests
   */
  const startDiscoveryBroadcast = async () => {
    try {
      const dgram = await import('dgram');
      const broadcastSocket = dgram.createSocket('udp4');
      
      broadcastSocket.bind(() => {
        broadcastSocket.setBroadcast(true);
        
        // Send discovery broadcast every interval
        const sendBroadcast = () => {
          if (!isDiscovering) return;
          
          const discoveryMessage = JSON.stringify({
            type: 'tobii-discovery-request',
            timestamp: Date.now(),
            requestId: `discovery-${Date.now()}`,
            source: 'synopticon-tobii5-discovery'
          });

          broadcastSocket.send(discoveryMessage, broadcastPort, '255.255.255.255', (error) => {
            if (error) {
              logger.error('Failed to send discovery broadcast:', error);
            } else {
              logger.debug('Sent Tobii discovery broadcast');
            }
          });
        };

        // Send immediate broadcast
        sendBroadcast();
        
        // Continue broadcasting at intervals
        discoveryTimer = setInterval(sendBroadcast, discoveryInterval);
        
        // Cleanup broadcast socket after discovery
        setTimeout(() => {
          if (broadcastSocket) {
            broadcastSocket.close();
          }
        }, DISCOVERY_CONFIG.maxDiscoveryTime + 1000);
      });
    } catch (error) {
      logger.error('Failed to setup discovery broadcast:', error);
    }
  };

  /**
   * Handle discovery response from Tobii bridge
   */
  const handleDiscoveryResponse = (message, remoteInfo) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'tobii-bridge-announcement') {
        const deviceInfo = createDeviceInfoFromAnnouncement(data, remoteInfo);
        
        // Update or add discovered device
        const existingDevice = discoveredDevices.get(deviceInfo.id);
        if (!existingDevice || existingDevice.lastSeen < deviceInfo.lastSeen) {
          discoveredDevices.set(deviceInfo.id, deviceInfo);
          
          logger.info(`📡 Discovered Tobii bridge: ${deviceInfo.name} at ${deviceInfo.host}:${deviceInfo.websocketPort}`);
          eventEmitter.emit('deviceDiscovered', deviceInfo);
        }
      }
    } catch (error) {
      logger.error('Failed to parse discovery response:', error);
    }
  };

  /**
   * Create device info from bridge announcement
   */
  const createDeviceInfoFromAnnouncement = (announcement, remoteInfo) => {
    const {
      service,
      version,
      host,
      websocket_port: websocketPort,
      udp_port: udpPort,
      config_port: configPort,
      capabilities = []
    } = announcement;

    const deviceHost = host || remoteInfo.address;
    const deviceId = `tobii-5-${deviceHost.replace(/\./g, '-')}`;

    return {
      id: deviceId,
      name: `Tobii Eye Tracker 5 (${deviceHost})`,
      type: 'tobii-5',
      
      // Connection details
      host: deviceHost,
      websocketPort: websocketPort || 8080,
      udpPort: udpPort || 4242,
      configPort: configPort || 8081,
      
      // Device capabilities
      capabilities: capabilities.length > 0 ? capabilities : [
        'gaze-tracking', 
        'head-tracking', 
        'presence-detection'
      ],
      
      // Bridge information
      bridgeService: service,
      bridgeVersion: version,
      
      // Discovery metadata
      discoveredAt: Date.now(),
      lastSeen: Date.now(),
      source: 'network-discovery',
      
      // Quality indicators
      networkLatency: calculateNetworkLatency(remoteInfo),
      signalStrength: 'unknown' // Could be enhanced with ping tests
    };
  };

  /**
   * Calculate approximate network latency
   */
  const calculateNetworkLatency = (remoteInfo) => {
    // This is a placeholder - in reality you'd need to implement ping
    // For local network, assume low latency
    return remoteInfo.address.startsWith('192.168.') || 
           remoteInfo.address.startsWith('10.') ||
           remoteInfo.address === '127.0.0.1' ? 'low' : 'medium';
  };

  /**
   * Stop discovery process
   */
  const stopDiscovery = () => {
    isDiscovering = false;
    
    if (discoveryTimer) {
      clearInterval(discoveryTimer);
      discoveryTimer = null;
    }
    
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
    
    if (udpSocket) {
      udpSocket.close();
      udpSocket = null;
    }
    
    logger.debug('Tobii 5 discovery stopped');
  };

  /**
   * Get cached discovered devices
   */
  const getDiscoveredDevices = () => {
    // Filter out devices that haven't been seen recently
    const now = Date.now();
    const activeDevices = Array.from(discoveredDevices.values()).filter(
      device => (now - device.lastSeen) < deviceTimeout
    );
    
    // Update the cache to remove stale entries
    discoveredDevices.clear();
    activeDevices.forEach(device => {
      discoveredDevices.set(device.id, device);
    });
    
    return activeDevices;
  };

  /**
   * Test connectivity to a discovered device
   */
  const testDeviceConnectivity = async (deviceInfo) => {
    logger.debug(`Testing connectivity to ${deviceInfo.name}`);
    
    try {
      // Try to connect to WebSocket port
      const WebSocketModule = await import('ws');
      const WebSocket = WebSocketModule.default || WebSocketModule.WebSocket;
      
      return new Promise((resolve) => {
        const ws = new WebSocket(`ws://${deviceInfo.host}:${deviceInfo.websocketPort}`);
        
        const timeout = setTimeout(() => {
          ws.close();
          resolve({
            success: false,
            error: 'Connection timeout',
            latency: null
          });
        }, 5000);
        
        const startTime = Date.now();
        
        ws.onopen = () => {
          const latency = Date.now() - startTime;
          clearTimeout(timeout);
          ws.close();
          
          resolve({
            success: true,
            latency,
            status: 'reachable'
          });
        };
        
        ws.onerror = (error) => {
          clearTimeout(timeout);
          resolve({
            success: false,
            error: error.message || 'Connection failed',
            latency: null
          });
        };
      });
    } catch (error) {
      return {
        success: false,
        error: error.message,
        latency: null
      };
    }
  };

  /**
   * Enhanced discovery with connectivity testing
   */
  const discoverAndTestDevices = async (timeout = DISCOVERY_CONFIG.maxDiscoveryTime) => {
    const devices = await discoverDevices(timeout);
    
    // Test connectivity for all discovered devices
    const testedDevices = await Promise.all(
      devices.map(async (device) => {
        const connectivity = await testDeviceConnectivity(device);
        return {
          ...device,
          connectivity,
          available: connectivity.success,
          latency: connectivity.latency
        };
      })
    );
    
    return testedDevices;
  };

  // Public API
  return {
    // Discovery methods
    discoverDevices,
    discoverAndTestDevices,
    getDiscoveredDevices,
    
    // Device testing
    testDeviceConnectivity,
    
    // Control
    stopDiscovery,
    
    // Status
    isDiscovering: () => isDiscovering,
    getDiscoveryConfig: () => ({ broadcastPort, listenPort, discoveryInterval, deviceTimeout }),
    
    // Events
    on: (event, callback) => eventEmitter.on(event, callback),
    off: (event, callback) => eventEmitter.off(event, callback),
    once: (event, callback) => eventEmitter.once(event, callback),
    
    // Cleanup
    cleanup: () => {
      stopDiscovery();
      discoveredDevices.clear();
      eventEmitter.removeAllListeners();
      logger.info('🧹 Tobii 5 discovery cleaned up');
    }
  };
};
