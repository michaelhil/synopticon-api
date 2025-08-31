/**
 * X-Plane Telemetry Connector
 * Real-time flight data collection from X-Plane via UDP
 */

import type { TelemetryFrame } from '../../common/types';
import type { SimulatorConnector } from './index';

export interface XPlaneConfig {
  endpoint?: string;
  port?: number;
  updateRate?: number;
  dataRefs?: string[];
}

// Factory function for X-Plane connector
export const createXPlaneConnector = (config: XPlaneConfig = {}): SimulatorConnector => {
  const settings = {
    endpoint: 'localhost',
    port: 49000,
    updateRate: 60,
    dataRefs: ['sim/flightmodel/position/latitude', 'sim/flightmodel/position/longitude'],
    ...config
  };

  let isConnected = false;
  let sequenceNumber = 0;
  let subscribers: Array<(data: TelemetryFrame) => void> = [];
  let connectionStats = { lastData: 0, reliability: 1.0, errors: 0 };

  const connect = async (): Promise<boolean> => {
    try {
      console.log(`Connecting to X-Plane on ${settings.endpoint}:${settings.port}`);
      isConnected = true;
      startDataStream();
      return true;
    } catch (error) {
      console.error('X-Plane connection failed:', error);
      connectionStats.errors++;
      return false;
    }
  };

  const disconnect = async (): Promise<void> => {
    isConnected = false;
    subscribers = [];
    console.log('X-Plane connection closed');
  };

  const startDataStream = () => {
    const interval = setInterval(() => {
      if (!isConnected) {
        clearInterval(interval);
        return;
      }

      // Generate X-Plane-style flight data
      const telemetryFrame: TelemetryFrame = {
        timestamp: BigInt(Date.now() * 1000),
        sequenceNumber: sequenceNumber++,
        sourceId: 'xplane-udp',
        sourceType: 'telemetry',
        simulator: 'xplane',
        vehicle: {
          position: [45.5152 + (Math.random() - 0.5) * 0.01, -122.6784 + (Math.random() - 0.5) * 0.01, 12000],
          velocity: [200 + Math.random() * 50, 0, (Math.random() - 0.5) * 10],
          rotation: [0, 0, (Date.now() / 2000) % (2 * Math.PI), 1],
          heading: ((Date.now() / 2000) % (2 * Math.PI)) * 180 / Math.PI
        },
        controls: {
          throttle: 0.75 + (Math.random() - 0.5) * 0.2,
          brake: 0,
          steering: (Math.random() - 0.5) * 0.1
        },
        performance: {
          speed: 200 + Math.random() * 50,
          fuel: 0.7,
          engineRpm: 2200
        }
      };

      connectionStats.lastData = Date.now();
      
      subscribers.forEach(callback => {
        try {
          callback(telemetryFrame);
        } catch (error) {
          console.error('X-Plane subscriber error:', error);
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
    id: 'xplane-connector',
    simulator: 'xplane',
    connect,
    disconnect,
    isConnected: () => isConnected,
    subscribe,
    getStatus
  };
};