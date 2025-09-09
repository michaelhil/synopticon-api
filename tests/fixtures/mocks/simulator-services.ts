/**
 * Mock simulator services for comprehensive testing
 * Provides controllable fake simulators for testing telemetry systems
 */

interface MockTelemetryFrame {
  timestamp: bigint;
  vehicle: {
    position: [number, number, number];
    velocity: [number, number, number];
    rotation: [number, number, number, number];
  };
  controls: {
    throttle: number;
    brake: number;
    steering: number;
  };
  performance: {
    speed: number;
    fuel: number;
  };
}

interface MockSimulatorConfig {
  type: 'msfs' | 'xplane' | 'beamng' | 'vatsim';
  updateRate: number;
  latency: number;
  reliability: number;
  dataVariation: number;
}

// Factory for MSFS mock
export const createMSFSMock = (config: Partial<MockSimulatorConfig> = {}) => {
  const settings = {
    type: 'msfs' as const,
    updateRate: 30,
    latency: 10,
    reliability: 0.95,
    dataVariation: 0.1,
    ...config
  };

  let isConnected = false;
  let subscribers: Array<(data: MockTelemetryFrame) => void> = [];
  let flightState = {
    altitude: 10000,
    airspeed: 250,
    heading: 90,
    latitude: 37.7749,
    longitude: -122.4194
  };

  const generateFlightData = (): MockTelemetryFrame => {
    // Simulate realistic flight progression
    flightState.altitude += (Math.random() - 0.5) * 100;
    flightState.airspeed += (Math.random() - 0.5) * 10;
    flightState.heading += (Math.random() - 0.5) * 5;
    
    // Keep values in realistic ranges
    flightState.altitude = Math.max(0, Math.min(45000, flightState.altitude));
    flightState.airspeed = Math.max(0, Math.min(500, flightState.airspeed));
    flightState.heading = (flightState.heading + 360) % 360;

    return {
      timestamp: BigInt(Date.now() * 1000),
      vehicle: {
        position: [flightState.longitude, flightState.latitude, flightState.altitude],
        velocity: [flightState.airspeed * 0.5, 0, 0],
        rotation: [0, 0, flightState.heading / 180 * Math.PI, 1]
      },
      controls: {
        throttle: 0.7 + (Math.random() - 0.5) * 0.2,
        brake: 0,
        steering: (Math.random() - 0.5) * 0.1
      },
      performance: {
        speed: flightState.airspeed,
        fuel: 0.8 - (Date.now() % 1000000) / 2000000
      }
    };
  };

  const connect = async (): Promise<boolean> => {
    // Simulate connection latency
    await new Promise(resolve => setTimeout(resolve, settings.latency));
    
    // Simulate connection reliability
    if (Math.random() > settings.reliability) {
      throw new Error('Connection failed');
    }
    
    isConnected = true;
    return true;
  };

  const disconnect = async (): Promise<void> => {
    isConnected = false;
    subscribers = [];
  };

  const subscribe = (callback: (data: MockTelemetryFrame) => void) => {
    subscribers.push(callback);
    
    // Start data stream
    const interval = setInterval(() => {
      if (!isConnected) {
        clearInterval(interval);
        return;
      }
      
      // Simulate occasional data loss
      if (Math.random() < settings.reliability) {
        const data = generateFlightData();
        callback(data);
      }
    }, 1000 / settings.updateRate);

    return () => {
      clearInterval(interval);
      subscribers = subscribers.filter(s => s !== callback);
    };
  };

  return {
    connect,
    disconnect,
    subscribe,
    isConnected: () => isConnected,
    getType: () => settings.type,
    getConfig: () => ({ ...settings })
  };
};

// Factory for BeamNG mock
export const createBeamNGMock = (config: Partial<MockSimulatorConfig> = {}) => {
  const settings = {
    type: 'beamng' as const,
    updateRate: 100,
    latency: 5,
    reliability: 0.98,
    dataVariation: 0.15,
    ...config
  };

  let isConnected = false;
  let subscribers: Array<(data: MockTelemetryFrame) => void> = [];
  let vehicleState = {
    speed: 0,
    rpm: 800,
    gear: 1,
    x: 0,
    y: 0,
    heading: 0
  };

  const generateVehicleData = (): MockTelemetryFrame => {
    // Simulate driving physics
    const throttleInput = 0.3 + Math.random() * 0.4;
    const acceleration = throttleInput * 5 - 2; // Some deceleration
    
    vehicleState.speed = Math.max(0, vehicleState.speed + acceleration * 0.1);
    vehicleState.rpm = 800 + vehicleState.speed * 50;
    vehicleState.x += Math.cos(vehicleState.heading) * vehicleState.speed * 0.1;
    vehicleState.y += Math.sin(vehicleState.heading) * vehicleState.speed * 0.1;
    vehicleState.heading += (Math.random() - 0.5) * 0.05;

    return {
      timestamp: BigInt(Date.now() * 1000),
      vehicle: {
        position: [vehicleState.x, vehicleState.y, 0],
        velocity: [vehicleState.speed, 0, 0],
        rotation: [0, 0, vehicleState.heading, 1]
      },
      controls: {
        throttle: throttleInput,
        brake: vehicleState.speed > 50 ? Math.random() * 0.2 : 0,
        steering: (Math.random() - 0.5) * 0.3
      },
      performance: {
        speed: vehicleState.speed,
        fuel: 1.0 - (Date.now() % 500000) / 1000000
      }
    };
  };

  const connect = async (): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, settings.latency));
    
    if (Math.random() > settings.reliability) {
      throw new Error('BeamNG connection failed');
    }
    
    isConnected = true;
    return true;
  };

  const disconnect = async (): Promise<void> => {
    isConnected = false;
    subscribers = [];
  };

  const subscribe = (callback: (data: MockTelemetryFrame) => void) => {
    subscribers.push(callback);
    
    const interval = setInterval(() => {
      if (!isConnected) {
        clearInterval(interval);
        return;
      }
      
      if (Math.random() < settings.reliability) {
        const data = generateVehicleData();
        callback(data);
      }
    }, 1000 / settings.updateRate);

    return () => {
      clearInterval(interval);
      subscribers = subscribers.filter(s => s !== callback);
    };
  };

  return {
    connect,
    disconnect,
    subscribe,
    isConnected: () => isConnected,
    getType: () => settings.type,
    getConfig: () => ({ ...settings })
  };
};

// Factory for creating mock simulator by type
export const createMockSimulator = (
  type: MockSimulatorConfig['type'], 
  config: Partial<MockSimulatorConfig> = {}
) => {
  switch (type) {
    case 'msfs':
      return createMSFSMock(config);
    case 'beamng':
      return createBeamNGMock(config);
    case 'xplane':
      // Similar to MSFS but with different parameters
      return createMSFSMock({ ...config, type: 'xplane', updateRate: 60 });
    case 'vatsim':
      // Network simulation with position updates
      return createMSFSMock({ ...config, type: 'vatsim', updateRate: 0.2 });
    default:
      throw new Error(`Unknown simulator type: ${type}`);
  }
};

// Network condition simulator
export const createNetworkSimulator = () => {
  let latency = 10;
  let packetLoss = 0.01;
  let bandwidth = 1000000; // 1MB/s

  const setConditions = (conditions: {
    latency?: number;
    packetLoss?: number;
    bandwidth?: number;
  }) => {
    latency = conditions.latency ?? latency;
    packetLoss = conditions.packetLoss ?? packetLoss;
    bandwidth = conditions.bandwidth ?? bandwidth;
  };

  const simulateNetworkDelay = async (dataSize: number = 1000): Promise<void> => {
    // Simulate packet loss
    if (Math.random() < packetLoss) {
      throw new Error('Packet lost');
    }

    // Calculate transmission delay based on bandwidth
    const transmissionDelay = (dataSize * 8) / bandwidth * 1000;
    const totalDelay = latency + transmissionDelay;

    await new Promise(resolve => setTimeout(resolve, totalDelay));
  };

  return {
    setConditions,
    simulateNetworkDelay,
    getConditions: () => ({ latency, packetLoss, bandwidth })
  };
};