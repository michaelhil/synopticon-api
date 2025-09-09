/**
 * VATSIM Network Telemetry Connector
 * Real-time position data from VATSIM network via REST API
 */

import type { TelemetryFrame } from '../../common/types';
import type { SimulatorConnector } from './index';

export interface VATSIMConfig {
  endpoint?: string;
  callsign?: string;
  updateRate?: number;
  enableRealConnection?: boolean;
  fallbackToMock?: boolean;
}

// VATSIM API data structures
interface VATSIMPilot {
  cid: number;
  name: string;
  callsign: string;
  server: string;
  pilot_rating: number;
  latitude: number;
  longitude: number;
  altitude: number;
  groundspeed: number;
  heading: number;
  flight_plan?: {
    departure: string;
    arrival: string;
    aircraft: string;
    cruise_altitude: string;
    route: string;
  };
  transponder: string;
  logon_time: string;
  last_updated: string;
}

interface VATSIMData {
  general: {
    version: number;
    reload: number;
    update: string;
    update_timestamp: string;
    connected_clients: number;
    unique_users: number;
  };
  pilots: VATSIMPilot[];
  controllers: any[];
  atis: any[];
  servers: any[];
  prefiles: any[];
  facilities: any[];
}

// Convert VATSIM pilot data to universal telemetry format
const convertVATSIMToTelemetry = (pilot: VATSIMPilot, sequenceNumber: number): TelemetryFrame => ({
  timestamp: BigInt(Date.now() * 1000),
  sequenceNumber,
  sourceId: `vatsim-${pilot.callsign}`,
  sourceType: 'telemetry',
  simulator: 'vatsim',
  vehicle: {
    position: [pilot.longitude, pilot.latitude, pilot.altitude],
    velocity: [pilot.groundspeed * 0.514444, 0, 0], // Convert kts to m/s
    rotation: [0, 0, pilot.heading * Math.PI / 180, 1],
    heading: pilot.heading
  },
  performance: {
    speed: pilot.groundspeed,
    altitude: pilot.altitude
  },
  environment: {
    network: {
      server: pilot.server,
      transponder: pilot.transponder,
      lastUpdate: pilot.last_updated
    }
  },
  metadata: {
    callsign: pilot.callsign,
    pilotName: pilot.name,
    aircraft: pilot.flight_plan?.aircraft || 'UNKNOWN',
    departure: pilot.flight_plan?.departure || '',
    arrival: pilot.flight_plan?.arrival || '',
    route: pilot.flight_plan?.route || ''
  }
});

// Helper function to create VATSIM data fetcher
const createDataFetcher = (endpoint: string, connectionStats: { errors: number }) => {
  return async (): Promise<VATSIMData | null> => {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json() as VATSIMData;
    } catch (error) {
      console.error('VATSIM API fetch failed:', error);
      connectionStats.errors++;
      return null;
    }
  };
};

// Helper function to create mock data generator
const createMockDataGenerator = (callsign: string, sequenceNumber: () => number) => {
  return (): VATSIMPilot => ({
    cid: 123456,
    name: 'Mock Pilot',
    callsign: callsign || 'TEST123',
    server: 'MOCK',
    pilot_rating: 1,
    latitude: 51.4700 + (Math.random() - 0.5) * 0.1,
    longitude: -0.4543 + (Math.random() - 0.5) * 0.1,
    altitude: 35000 + (Math.random() - 0.5) * 2000,
    groundspeed: 450 + (Math.random() - 0.5) * 50,
    heading: (Date.now() / 1000) % 360,
    flight_plan: {
      departure: 'EGLL',
      arrival: 'KJFK', 
      aircraft: 'B777',
      cruise_altitude: 'FL350',
      route: 'MOCK ROUTE'
    },
    transponder: '2000',
    logon_time: new Date().toISOString(),
    last_updated: new Date().toISOString()
  });
};

// Helper function to create subscriber notifier
const createSubscriberNotifier = (connectionStats: { errors: number }) => {
  return (subscribers: Array<(data: TelemetryFrame) => void>, frame: TelemetryFrame) => {
    subscribers.forEach(callback => {
      try {
        callback(frame);
      } catch (error) {
        console.error('VATSIM subscriber error:', error);
        connectionStats.errors++;
      }
    });
  };
};

// Helper function to create connection handlers
const createConnectionHandlers = (settings: Required<VATSIMConfig>) => {
  const handleConnectionFailure = (): boolean => {
    if (settings.fallbackToMock) {
      console.warn('VATSIM API unavailable, using mock data');
      return true;
    }
    return false;
  };

  const handleConnectionSuccess = (testData: VATSIMData): boolean => {
    console.log(`VATSIM connected: ${testData.general.connected_clients} clients online`);
    return true;
  };

  return { handleConnectionFailure, handleConnectionSuccess };
};

// Helper function to create pilot filter
const createPilotFilter = (callsign: string) => {
  return (pilots: VATSIMPilot[]): VATSIMPilot[] => {
    return callsign 
      ? pilots.filter(p => p.callsign.includes(callsign.toUpperCase()))
      : pilots.slice(0, 10); // Limit to first 10 for performance
  };
};

// Helper function to create stream processors
const createStreamProcessor = (
  isConnectedCheck: () => boolean,
  processData: () => void
) => {
  return (intervalMs: number): Timer => {
    const process = () => {
      if (isConnectedCheck()) {
        processData();
      }
    };
    
    const interval = setInterval(process, intervalMs);
    process(); // Initial call
    return interval;
  };
};

// Factory function for VATSIM connector
export const createVATSIMConnector = (config: VATSIMConfig = {}): SimulatorConnector => {
  const settings = {
    endpoint: 'https://data.vatsim.net/v3/vatsim-data.json',
    callsign: '',
    updateRate: 0.067, // 15 seconds = 0.067 Hz (VATSIM recommended)
    enableRealConnection: true,
    fallbackToMock: true,
    ...config
  } as Required<VATSIMConfig>;

  let isConnected = false;
  let sequenceNumber = 0;
  let subscribers: Array<(data: TelemetryFrame) => void> = [];
  const connectionStats = { lastData: 0, reliability: 1.0, errors: 0 };
  let currentData: VATSIMData | null = null;
  let updateInterval: Timer | null = null;

  // Create helper functions
  const fetchVATSIMData = createDataFetcher(settings.endpoint, connectionStats);
  const generateMockPilot = createMockDataGenerator(settings.callsign, () => sequenceNumber++);
  const notifySubscribers = createSubscriberNotifier(connectionStats);
  const { handleConnectionFailure, handleConnectionSuccess } = createConnectionHandlers(settings);
  const filterPilots = createPilotFilter(settings.callsign);

  const connect = async (): Promise<boolean> => {
    try {
      console.log(`Connecting to VATSIM network API: ${settings.endpoint}`);
      
      // Force mock mode if real connection is disabled
      if (!settings.enableRealConnection) {
        if (settings.fallbackToMock) {
          console.log('Real connection disabled, using mock data');
          isConnected = true;
          startMockDataStream();
          return true;
        }
        return false;
      }
      
      const testData = await fetchVATSIMData();
      
      if (!testData) {
        if (handleConnectionFailure()) {
          isConnected = true;
          startMockDataStream();
          return true;
        }
        return false;
      }
      
      if (handleConnectionSuccess(testData)) {
        currentData = testData;
        isConnected = true;
        startRealDataStream();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('VATSIM connection failed:', error);
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
    subscribers = [];
    currentData = null;
    console.log('VATSIM connection closed');
  };

  const processRealVATSIMData = async () => {
    const data = await fetchVATSIMData();
    if (!data) {
      if (settings.fallbackToMock) {
        generateAndNotifyMockData();
      }
      return;
    }
    
    currentData = data;
    connectionStats.lastData = Date.now();
    
    const pilotsToProcess = filterPilots(data.pilots);
    pilotsToProcess.forEach(pilot => {
      const telemetryFrame = convertVATSIMToTelemetry(pilot, sequenceNumber++);
      notifySubscribers(subscribers, telemetryFrame);
    });
  };

  const generateAndNotifyMockData = () => {
    const mockPilot = generateMockPilot();
    const telemetryFrame = convertVATSIMToTelemetry(mockPilot, sequenceNumber++);
    connectionStats.lastData = Date.now();
    notifySubscribers(subscribers, telemetryFrame);
  };

  const startRealDataStream = () => {
    const processor = createStreamProcessor(() => isConnected, processRealVATSIMData);
    updateInterval = processor(15000); // 15 seconds
  };

  const startMockDataStream = () => {
    const processor = createStreamProcessor(() => isConnected, generateAndNotifyMockData);
    updateInterval = processor(15000); // 15 seconds
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
    clientsOnline: currentData?.general.connected_clients || 0,
    dataMode: settings.enableRealConnection ? 'real' : 'mock',
    lastUpdate: currentData?.general.update || 'unknown'
  });

  return {
    id: 'vatsim-connector',
    simulator: 'vatsim',
    connect,
    disconnect,
    isConnected: () => isConnected,
    subscribe,
    getStatus
  };
};
