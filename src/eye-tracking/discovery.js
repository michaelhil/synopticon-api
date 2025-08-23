/**
 * Eye Tracker Device Discovery Service
 * mDNS-based automatic discovery of Pupil Labs Neon devices on network
 * Following functional programming patterns with factory functions
 */

// Device discovery factory using mDNS service discovery
export const createDeviceDiscovery = (config = {}) => {
  const state = {
    serviceName: config.serviceName || '_pupil-mobile._tcp',
    discoveryTimeout: config.discoveryTimeout || 5000,
    isDiscovering: false,
    devices: new Map(),
    callbacks: {
      onDeviceFound: [],
      onDeviceUpdated: [],
      onDeviceLost: [],
      onError: []
    }
  };

  // Mock mDNS implementation for development without hardware
  const createMockDevice = (id, name) => ({
    id,
    name: name || `Mock Neon ${id}`,
    address: '192.168.1.100',
    port: 8080,
    type: 'neon',
    capabilities: ['gaze_streaming', 'video_streaming', 'imu_data'],
    status: 'available',
    lastSeen: Date.now(),
    deviceInfo: {
      serial: `MOCK-${id}`,
      firmware: '1.0.0-mock',
      battery: 85,
      charging: false,
      temperature: 25.5,
      calibration: {
        status: 'valid',
        timestamp: Date.now() - 300000 // 5 minutes ago
      }
    }
  });

  // Real mDNS implementation (placeholder for when available)
  const discoverRealDevices = async () => {
    // Note: This would use Node.js mdns or similar library
    // For now, we simulate discovery delay and return empty results
    await new Promise(resolve => setTimeout(resolve, 1000));
    return [];
  };

  const startDiscovery = async () => {
    if (state.isDiscovering) return false;
    
    state.isDiscovering = true;
    state.devices.clear();

    try {
      // Try real device discovery first
      const realDevices = await discoverRealDevices();
      
      // If no real devices found and in development mode, add mock device
      if (realDevices.length === 0 && config.useMockDevices !== false) {
        const mockDevice = createMockDevice('mock-001', 'Mock Neon Device');
        state.devices.set(mockDevice.id, mockDevice);
        
        // Notify callbacks
        state.callbacks.onDeviceFound.forEach(cb => {
          try {
            cb(mockDevice);
          } catch (error) {
            console.warn('Device found callback error:', error);
          }
        });
      }

      // Process real devices
      for (const device of realDevices) {
        state.devices.set(device.id, device);
        
        state.callbacks.onDeviceFound.forEach(cb => {
          try {
            cb(device);
          } catch (error) {
            console.warn('Device found callback error:', error);
          }
        });
      }

      return true;
    } catch (error) {
      state.callbacks.onError.forEach(cb => {
        try {
          cb(error);
        } catch (cbError) {
          console.warn('Error callback failed:', cbError);
        }
      });
      throw error;
    } finally {
      // Auto-stop discovery after timeout
      setTimeout(() => {
        if (state.isDiscovering) {
          stopDiscovery();
        }
      }, state.discoveryTimeout);
    }
  };

  const stopDiscovery = () => {
    state.isDiscovering = false;
    // Clean up any ongoing discovery processes
  };

  const getDiscoveredDevices = () => {
    return Array.from(state.devices.values()).map(device => ({ ...device }));
  };

  const getDeviceById = (deviceId) => {
    const device = state.devices.get(deviceId);
    return device ? { ...device } : null;
  };

  const updateDeviceStatus = (deviceId, statusUpdate) => {
    const device = state.devices.get(deviceId);
    if (device) {
      const updatedDevice = {
        ...device,
        ...statusUpdate,
        lastSeen: Date.now()
      };
      
      state.devices.set(deviceId, updatedDevice);
      
      state.callbacks.onDeviceUpdated.forEach(cb => {
        try {
          cb(updatedDevice);
        } catch (error) {
          console.warn('Device updated callback error:', error);
        }
      });
    }
  };

  // Simulate device status updates for mock devices
  const startMockStatusUpdates = () => {
    if (config.useMockDevices === false) return;
    
    setInterval(() => {
      for (const device of state.devices.values()) {
        if (device.id.startsWith('mock-')) {
          const batteryLevel = Math.max(0, device.deviceInfo.battery - Math.random() * 0.5);
          updateDeviceStatus(device.id, {
            deviceInfo: {
              ...device.deviceInfo,
              battery: batteryLevel,
              charging: batteryLevel < 20 ? Math.random() > 0.5 : false,
              temperature: 25 + (Math.random() - 0.5) * 2
            }
          });
        }
      }
    }, 30000); // Update every 30 seconds
  };

  // Check for stale devices and mark as lost
  const checkDeviceHealth = () => {
    const staleThreshold = Date.now() - 60000; // 1 minute
    
    for (const [deviceId, device] of state.devices.entries()) {
      if (device.lastSeen < staleThreshold && device.status !== 'lost') {
        const lostDevice = {
          ...device,
          status: 'lost'
        };
        
        state.devices.set(deviceId, lostDevice);
        
        state.callbacks.onDeviceLost.forEach(cb => {
          try {
            cb(lostDevice);
          } catch (error) {
            console.warn('Device lost callback error:', error);
          }
        });
      }
    }
  };

  // Start health monitoring
  const healthCheckInterval = setInterval(checkDeviceHealth, 10000); // Check every 10 seconds

  // Event handlers
  const onDeviceFound = (callback) => {
    state.callbacks.onDeviceFound.push(callback);
    return () => {
      const index = state.callbacks.onDeviceFound.indexOf(callback);
      if (index !== -1) state.callbacks.onDeviceFound.splice(index, 1);
    };
  };

  const onDeviceUpdated = (callback) => {
    state.callbacks.onDeviceUpdated.push(callback);
    return () => {
      const index = state.callbacks.onDeviceUpdated.indexOf(callback);
      if (index !== -1) state.callbacks.onDeviceUpdated.splice(index, 1);
    };
  };

  const onDeviceLost = (callback) => {
    state.callbacks.onDeviceLost.push(callback);
    return () => {
      const index = state.callbacks.onDeviceLost.indexOf(callback);
      if (index !== -1) state.callbacks.onDeviceLost.splice(index, 1);
    };
  };

  const onError = (callback) => {
    state.callbacks.onError.push(callback);
    return () => {
      const index = state.callbacks.onError.indexOf(callback);
      if (index !== -1) state.callbacks.onError.splice(index, 1);
    };
  };

  // Cleanup function
  const cleanup = () => {
    stopDiscovery();
    clearInterval(healthCheckInterval);
    state.devices.clear();
  };

  // Start mock status updates if using mock devices
  if (config.useMockDevices !== false) {
    startMockStatusUpdates();
  }

  return {
    // Discovery control
    startDiscovery,
    stopDiscovery,
    
    // Device access
    getDiscoveredDevices,
    getDeviceById,
    updateDeviceStatus,
    
    // Event handlers
    onDeviceFound,
    onDeviceUpdated,
    onDeviceLost,
    onError,
    
    // Status
    isDiscovering: () => state.isDiscovering,
    getDeviceCount: () => state.devices.size,
    
    // Cleanup
    cleanup
  };
};

// Discovery factory registry for different device types
export const createDiscoveryFactory = () => {
  const discoveryTypes = new Map();
  
  const register = (type, factory) => {
    discoveryTypes.set(type, factory);
  };
  
  const create = (type, config = {}) => {
    const factory = discoveryTypes.get(type);
    if (!factory) {
      throw new Error(`Unknown discovery type: ${type}`);
    }
    return factory(config);
  };
  
  const getAvailableTypes = () => Array.from(discoveryTypes.keys());
  
  return {
    register,
    create,
    getAvailableTypes
  };
};

// Default discovery factory instance
export const discoveryFactory = createDiscoveryFactory();

// Register eye tracker discovery
discoveryFactory.register('eyetracker', createDeviceDiscovery);