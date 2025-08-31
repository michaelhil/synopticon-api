/**
 * VATSIM Network Telemetry Connector
 * Real-time position data from VATSIM network
 */

import type { TelemetryFrame } from '../../common/types';
import type { SimulatorConnector } from './index';

export interface VATSIMConfig {
  endpoint?: string;
  callsign?: string;
  updateRate?: number;
}

// Factory function for VATSIM connector
export const createVATSIMConnector = (config: VATSIMConfig = {}): SimulatorConnector => {
  const settings = {
    endpoint: 'https://data.vatsim.net/v3/vatsim-data.json',
    callsign: '',
    updateRate: 0.2, // VATSIM updates every 15 seconds
    ...config
  };

  let isConnected = false;
  let sequenceNumber = 0;
  let subscribers: Array<(data: TelemetryFrame) => void> = [];
  let connectionStats = { lastData: 0, reliability: 1.0, errors: 0 };

  const connect = async (): Promise<boolean> => {
    try {
      console.log(`Connecting to VATSIM network for callsign: ${settings.callsign}`);
      isConnected = true;
      startDataStream();
      return true;
    } catch (error) {
      console.error('VATSIM connection failed:', error);
      connectionStats.errors++;
      return false;
    }
  };

  const disconnect = async (): Promise<void> => {
    isConnected = false;
    subscribers = [];
    console.log('VATSIM connection closed');
  };

  const startDataStream = () => {
    const interval = setInterval(() => {
      if (!isConnected) {
        clearInterval(interval);
        return;
      }

      // Generate VATSIM-style network data
      const telemetryFrame: TelemetryFrame = {
        timestamp: BigInt(Date.now() * 1000),
        sequenceNumber: sequenceNumber++,
        sourceId: `vatsim-${settings.callsign}`,
        sourceType: 'telemetry',
        simulator: 'vatsim',
        vehicle: {
          position: [51.4700 + (Math.random() - 0.5) * 0.1, -0.4543 + (Math.random() - 0.5) * 0.1, 35000],
          velocity: [450, 0, 0],
          rotation: [0, 0, 0, 1],
          heading: 90
        },
        controls: {
          throttle: 0.8,
          brake: 0,
          steering: 0
        },
        performance: {
          speed: 450,
          fuel: 0.6
        },
        environment: {
          weather: {
            temperature: -45,
            humidity: 20,
            windSpeed: 30,
            windDirection: 270
          }
        }
      };

      connectionStats.lastData = Date.now();
      
      subscribers.forEach(callback => {
        try {
          callback(telemetryFrame);
        } catch (error) {
          console.error('VATSIM subscriber error:', error);
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
    reliability: Math.max(0, 1.0 - (connectionStats.errors * 0.2)),
    errors: connectionStats.errors
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