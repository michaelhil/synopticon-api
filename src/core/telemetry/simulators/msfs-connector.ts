/**
 * Microsoft Flight Simulator Telemetry Connector
 * Real-time flight data collection from MSFS via SimConnect
 */

import type { TelemetryFrame, VehicleState } from '../../common/types';
import type { SimulatorConnector } from './index';

export interface MSFSConfig {
  endpoint?: string;
  port?: number;
  updateRate?: number;
  dataFields?: string[];
}

// MSFS-specific data structures
interface MSFSData {
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  airspeed: number;
  verticalSpeed: number;
  throttlePosition: number;
  rudderPosition: number;
  elevatorPosition: number;
  aileronPosition: number;
  fuelQuantity: number;
  engineRpm: number;
}

// Convert MSFS data to universal telemetry format
const convertMSFSToTelemetry = (msfsData: MSFSData, sequenceNumber: number): TelemetryFrame => ({
  timestamp: BigInt(Date.now() * 1000),
  sequenceNumber,
  sourceId: 'msfs-simconnect',
  sourceType: 'telemetry',
  simulator: 'msfs',
  vehicle: {
    position: [msfsData.longitude, msfsData.latitude, msfsData.altitude],
    velocity: [msfsData.airspeed * 0.514444, 0, msfsData.verticalSpeed * 0.00508],
    rotation: [0, 0, msfsData.heading * Math.PI / 180, 1],
    heading: msfsData.heading
  },
  controls: {
    throttle: msfsData.throttlePosition,
    brake: 0,
    steering: msfsData.rudderPosition,
    custom: {
      elevator: msfsData.elevatorPosition,
      aileron: msfsData.aileronPosition
    }
  },
  performance: {
    speed: msfsData.airspeed,
    fuel: msfsData.fuelQuantity,
    engineRpm: msfsData.engineRpm
  }
});

// Factory function for MSFS connector
export const createMSFSConnector = (config: MSFSConfig = {}): SimulatorConnector => {
  const settings = {
    endpoint: 'localhost',
    port: 500,
    updateRate: 30,
    dataFields: ['latitude', 'longitude', 'altitude', 'heading', 'airspeed'],
    ...config
  };

  let isConnected = false;
  let sequenceNumber = 0;
  let subscribers: Array<(data: TelemetryFrame) => void> = [];
  let connectionStats = {
    lastData: 0,
    reliability: 1.0,
    errors: 0
  };

  // Simulate connection to MSFS SimConnect
  const connect = async (): Promise<boolean> => {
    try {
      console.log(`Connecting to MSFS on ${settings.endpoint}:${settings.port}`);
      // In real implementation, this would establish SimConnect connection
      isConnected = true;
      startDataStream();
      return true;
    } catch (error) {
      console.error('MSFS connection failed:', error);
      connectionStats.errors++;
      return false;
    }
  };

  const disconnect = async (): Promise<void> => {
    isConnected = false;
    subscribers = [];
    console.log('MSFS connection closed');
  };

  // Simulate MSFS data stream
  const startDataStream = () => {
    const interval = setInterval(() => {
      if (!isConnected) {
        clearInterval(interval);
        return;
      }

      // Generate realistic flight data
      const mockData: MSFSData = {
        latitude: 47.6062 + (Math.random() - 0.5) * 0.01,
        longitude: -122.3321 + (Math.random() - 0.5) * 0.01,
        altitude: 10000 + (Math.random() - 0.5) * 1000,
        heading: (Date.now() / 1000) % 360,
        airspeed: 250 + (Math.random() - 0.5) * 50,
        verticalSpeed: (Math.random() - 0.5) * 500,
        throttlePosition: 0.8 + (Math.random() - 0.5) * 0.2,
        rudderPosition: (Math.random() - 0.5) * 0.1,
        elevatorPosition: (Math.random() - 0.5) * 0.2,
        aileronPosition: (Math.random() - 0.5) * 0.3,
        fuelQuantity: 0.75 - (Date.now() % 1000000) / 2000000,
        engineRpm: 2400 + (Math.random() - 0.5) * 200
      };

      const telemetryFrame = convertMSFSToTelemetry(mockData, sequenceNumber++);
      
      connectionStats.lastData = Date.now();
      
      // Notify subscribers
      subscribers.forEach(callback => {
        try {
          callback(telemetryFrame);
        } catch (error) {
          console.error('MSFS subscriber error:', error);
          connectionStats.errors++;
        }
      });
    }, 1000 / settings.updateRate);
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
    errors: connectionStats.errors
  });

  return {
    id: 'msfs-connector',
    simulator: 'msfs',
    connect,
    disconnect,
    isConnected: () => isConnected,
    subscribe,
    getStatus
  };
};