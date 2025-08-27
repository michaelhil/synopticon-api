/**
 * Eye Tracking Device Management Module
 * Handles device discovery, connection, and status operations
 */

export const createDeviceManager = (state, systemHandlers) => {
  // Handle device connection events
  const handleDeviceConnectionEvent = (event) => {
    switch (event.event) {
      case 'discovered':
        console.log(`Device discovered: ${event.device.name}`);
        break;
      case 'connected':
        state.activeDevices.set(event.deviceId, {
          device: state.system.getDevice(event.deviceId),
          connectedAt: Date.now(),
          status: 'connected'
        });
        break;
      case 'disconnected':
        state.activeDevices.delete(event.deviceId);
        // Clean up any active sessions for this device
        systemHandlers.cleanupDeviceSessions(event.deviceId);
        break;
    }

    // Notify status change callbacks
    state.callbacks.onDeviceStatusChange.forEach(cb => {
      try {
        cb(event);
      } catch (error) {
        console.warn('Device status change callback error:', error);
      }
    });
  };

  // Device Discovery API
  const discoverDevices = async (timeout = 10000) => {
    if (!state.system) {
      throw new Error('System not initialized');
    }

    // Discovery is automatically handled by the system
    // Wait for discovery timeout then return results
    await new Promise(resolve => setTimeout(resolve, timeout));
    return state.system.getDiscoveredDevices();
  };

  const getDiscoveredDevices = () => {
    if (!state.system) return [];
    return state.system.getDiscoveredDevices();
  };

  // Device Connection API
  const connectToDevice = async (deviceId) => {
    if (!state.system) {
      throw new Error('System not initialized');
    }

    return await state.system.connectDevice(deviceId);
  };

  const disconnectFromDevice = (deviceId) => {
    if (!state.system) {
      throw new Error('System not initialized');
    }

    state.system.disconnectDevice(deviceId);
  };

  const autoConnectToFirstDevice = async () => {
    if (!state.system) {
      throw new Error('System not initialized');
    }

    return await state.system.autoConnect();
  };

  // Device Status API
  const getDeviceStatus = async (deviceId) => {
    const deviceInfo = state.activeDevices.get(deviceId);
    if (!deviceInfo) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    const {device} = deviceInfo;
    return state.createDeviceStatus({
      deviceId,
      connectionState: device.getConnectionState(),
      lastHeartbeat: device.getLastHeartbeat(),
      connectedAt: deviceInfo.connectedAt,
      deviceInfo: device.getDeviceInfo()
    });
  };

  const getConnectedDevices = () => {
    return Array.from(state.activeDevices.keys());
  };

  return {
    handleDeviceConnectionEvent,
    discoverDevices,
    getDiscoveredDevices,
    connectToDevice,
    disconnectFromDevice,
    autoConnectToFirstDevice,
    getDeviceStatus,
    getConnectedDevices
  };
};