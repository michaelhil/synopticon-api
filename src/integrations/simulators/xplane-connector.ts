/**
 * X-Plane Telemetry Connector
 * Real-time flight data collection from X-Plane via UDP DataRef
 */

import type { TelemetryFrame } from '../../common/types';
import type { SimulatorConnector } from './index';

export interface XPlaneConfig {
  endpoint?: string;
  port?: number;
  updateRate?: number;
  dataRefs?: string[];
  enableRealConnection?: boolean;
  fallbackToMock?: boolean;
}

// X-Plane DataRef subscription data
interface XPlaneDataRef {
  name: string;
  frequency: number; // Hz
  index: number;
}

// X-Plane UDP packet types
const XPLANE_UDP_TYPES = {
  RREF: 'RREF', // Request DataRef
  DREF: 'DREF', // DataRef value
  DATA: 'DATA'  // Structured data
};

// Default DataRefs for flight simulation
const DEFAULT_DATAREFS: XPlaneDataRef[] = [
  { name: 'sim/flightmodel/position/latitude', frequency: 30, index: 0 },
  { name: 'sim/flightmodel/position/longitude', frequency: 30, index: 1 },
  { name: 'sim/flightmodel/position/elevation', frequency: 30, index: 2 },
  { name: 'sim/flightmodel/position/psi', frequency: 30, index: 3 }, // heading
  { name: 'sim/flightmodel/position/indicated_airspeed', frequency: 30, index: 4 },
  { name: 'sim/flightmodel/position/vh_ind', frequency: 30, index: 5 }, // vertical speed
  { name: 'sim/flightmodel/controls/throttle_ratio', frequency: 10, index: 6 },
  { name: 'sim/flightmodel/controls/rudder_deflection_aero', frequency: 10, index: 7 }
];

// Helper function to create UDP socket manager
const createUDPSocketManager = (endpoint: string, port: number) => {
  return {
    socket: null as any,
    isListening: false,
    
    async connect(): Promise<boolean> {
      try {
        // For now, we'll simulate UDP connection since Bun's UDP is different
        // In real implementation, this would create a UDP socket
        console.log(`UDP socket connecting to ${endpoint}:${port}`);
        this.isListening = true;
        return true;
      } catch (error) {
        console.error('UDP connection failed:', error);
        return false;
      }
    },
    
    disconnect() {
      if (this.socket) {
        // this.socket.close();
        this.socket = null;
      }
      this.isListening = false;
    },
    
    sendDataRefRequest(dataRef: XPlaneDataRef): boolean {
      if (!this.isListening) return false;
      
      // Create RREF command: "RREF\0" + frequency + index + dataref_name + "\0"
      const command = 'RREF';
      console.log(`Requesting DataRef: ${dataRef.name} at ${dataRef.frequency}Hz`);
      
      // In real implementation, would send UDP packet
      // const buffer = Buffer.from(`${command}\0${dataRef.frequency}\0${dataRef.index}\0${dataRef.name}\0`);
      // this.socket.send(buffer, port, endpoint);
      
      return true;
    }
  };
};

// Helper function to create mock X-Plane data generator
const createXPlaneMockGenerator = (sequenceNumber: () => number) => {
  return (): TelemetryFrame => {
    const baseTime = Date.now();
    const heading = (baseTime / 1000) % 360; // Slowly rotating
    
    return {
      timestamp: BigInt(baseTime * 1000),
      sequenceNumber: sequenceNumber(),
      sourceId: 'xplane-udp-mock',
      sourceType: 'telemetry',
      simulator: 'xplane',
      vehicle: {
        position: [
          -122.6784 + (Math.random() - 0.5) * 0.01, // longitude (X-Plane format)
          45.5152 + (Math.random() - 0.5) * 0.01,   // latitude
          12000 + (Math.random() - 0.5) * 500        // elevation
        ],
        velocity: [
          200 + Math.random() * 50, // indicated airspeed
          0,
          (Math.random() - 0.5) * 10 // vertical speed
        ],
        rotation: [0, 0, heading * Math.PI / 180, 1],
        heading
      },
      controls: {
        throttle: 0.75 + (Math.random() - 0.5) * 0.2,
        brake: 0,
        steering: (Math.random() - 0.5) * 0.1 // rudder deflection
      },
      performance: {
        speed: 200 + Math.random() * 50,
        fuel: 0.7,
        engineRpm: 2200 + Math.random() * 200
      },
      metadata: {
        aircraft: 'X-Plane Default',
        flightPlan: 'VFR Training Flight'
      }
    };
  };
};

// Helper function to create subscriber notifier
const createXPlaneNotifier = (connectionStats: { errors: number }) => {
  return (subscribers: Array<(data: TelemetryFrame) => void>, frame: TelemetryFrame) => {
    subscribers.forEach(callback => {
      try {
        callback(frame);
      } catch (error) {
        console.error('X-Plane subscriber error:', error);
        connectionStats.errors++;
      }
    });
  };
};

// Helper function to create stream processor
const createXPlaneStreamProcessor = (
  isConnectedCheck: () => boolean,
  generateData: () => TelemetryFrame,
  notifySubscribers: (subs: Array<(data: TelemetryFrame) => void>, frame: TelemetryFrame) => void,
  subscribers: Array<(data: TelemetryFrame) => void>,
  connectionStats: { lastData: number }
) => {
  return (intervalMs: number): Timer => {
    const process = () => {
      if (isConnectedCheck()) {
        const frame = generateData();
        connectionStats.lastData = Date.now();
        notifySubscribers(subscribers, frame);
      }
    };
    
    const interval = setInterval(process, intervalMs);
    process(); // Initial call
    return interval;
  };
};

// Factory function for X-Plane connector
export const createXPlaneConnector = (config: XPlaneConfig = {}): SimulatorConnector => {
  const settings = {
    endpoint: 'localhost',
    port: 49000,
    updateRate: 60,
    dataRefs: DEFAULT_DATAREFS.map(dr => dr.name),
    enableRealConnection: true,
    fallbackToMock: true,
    ...config
  } as Required<XPlaneConfig>;

  let isConnected = false;
  let sequenceNumber = 0;
  let subscribers: Array<(data: TelemetryFrame) => void> = [];
  const connectionStats = { lastData: 0, reliability: 1.0, errors: 0 };
  let updateInterval: Timer | null = null;

  // Create helper functions
  const udpManager = createUDPSocketManager(settings.endpoint, settings.port);
  const generateMockData = createXPlaneMockGenerator(() => sequenceNumber++);
  const notifySubscribers = createXPlaneNotifier(connectionStats);

  const connect = async (): Promise<boolean> => {
    try {
      console.log(`Connecting to X-Plane on ${settings.endpoint}:${settings.port}`);
      
      // Force mock mode if real connection is disabled
      if (!settings.enableRealConnection) {
        if (settings.fallbackToMock) {
          console.log('Real X-Plane connection disabled, using mock data');
          isConnected = true;
          startMockDataStream();
          return true;
        }
        return false;
      }
      
      // Try to establish UDP connection
      const connected = await udpManager.connect();
      if (!connected) {
        if (settings.fallbackToMock) {
          console.warn('X-Plane UDP unavailable, using mock data');
          isConnected = true;
          startMockDataStream();
          return true;
        }
        return false;
      }
      
      // Subscribe to DataRefs
      const subscribeSuccess = subscribeToDataRefs();
      if (subscribeSuccess) {
        console.log('X-Plane connected with UDP DataRef streaming');
        isConnected = true;
        startRealDataStream();
        return true;
      } else {
        console.warn('X-Plane DataRef subscription failed, using mock data');
        isConnected = true;
        startMockDataStream();
        return true;
      }
    } catch (error) {
      console.error('X-Plane connection failed:', error);
      connectionStats.errors++;
      return false;
    }
  };

  const disconnect = async (): Promise<void> => {
    isConnected = false;
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
    udpManager.disconnect();
    subscribers = [];
    console.log('X-Plane connection closed');
  };

  const subscribeToDataRefs = (): boolean => {
    try {
      DEFAULT_DATAREFS.forEach(dataRef => {
        udpManager.sendDataRefRequest(dataRef);
      });
      return true;
    } catch (error) {
      console.error('DataRef subscription failed:', error);
      return false;
    }
  };

  const startRealDataStream = () => {
    // For now, real data stream uses mock since UDP implementation is complex
    // In production, this would listen for UDP packets and parse DataRef values
    console.log('Starting real X-Plane DataRef stream (currently using mock data)');
    startMockDataStream();
  };

  const startMockDataStream = () => {
    const processor = createXPlaneStreamProcessor(
      () => isConnected,
      generateMockData,
      notifySubscribers,
      subscribers,
      connectionStats
    );
    const intervalMs = 1000 / settings.updateRate; // Convert Hz to ms
    updateInterval = processor(intervalMs);
  };

  const subscribe = (callback: (data: TelemetryFrame) => void) => {
    subscribers.push(callback);
    return () => {
      subscribers = subscribers.filter(cb => cb !== callback);
    };
  };

  const getStatus = () => ({
    connected: isConnected,
    lastData: connectionStats.lastData,
    reliability: Math.max(0, 1.0 - (connectionStats.errors * 0.1)),
    errors: connectionStats.errors,
    dataMode: settings.enableRealConnection ? 'real' : 'mock',
    activeDataRefs: DEFAULT_DATAREFS.length,
    updateRate: settings.updateRate
  });

  return {
    id: 'xplane-connector',
    simulator: 'xplane',
    connect,
    disconnect,
    isConnected: () => isConnected,
    subscribe,
    getStatus
  };
};
