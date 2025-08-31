/**
 * BeamNG.drive Telemetry Connector
 * Real-time vehicle physics data from BeamNG.drive
 */

import type { TelemetryFrame } from '../../common/types';
import type { SimulatorConnector } from './index';

export interface BeamNGConfig {
  endpoint?: string;
  port?: number;
  updateRate?: number;
  vehicleId?: string;
}

// BeamNG-specific data structures
interface BeamNGData {
  position: [number, number, number];
  velocity: [number, number, number];
  acceleration: [number, number, number];
  rotation: [number, number, number, number];
  wheelSpeed: number[];
  engineRpm: number;
  throttle: number;
  brake: number;
  steering: number;
  gear: number;
  fuel: number;
  damage: number;
}

// Convert BeamNG data to universal telemetry format
const convertBeamNGToTelemetry = (beamData: BeamNGData, sequenceNumber: number): TelemetryFrame => ({
  timestamp: BigInt(Date.now() * 1000),
  sequenceNumber,
  sourceId: 'beamng-drive',
  sourceType: 'telemetry',
  simulator: 'beamng',
  vehicle: {
    position: beamData.position,
    velocity: beamData.velocity,
    acceleration: beamData.acceleration,
    rotation: beamData.rotation,
    heading: Math.atan2(beamData.rotation[1], beamData.rotation[0]) * 180 / Math.PI
  },
  controls: {
    throttle: beamData.throttle,
    brake: beamData.brake,
    steering: beamData.steering,
    gear: beamData.gear
  },
  performance: {
    speed: Math.sqrt(beamData.velocity[0]**2 + beamData.velocity[1]**2 + beamData.velocity[2]**2),
    fuel: beamData.fuel,
    engineRpm: beamData.engineRpm,
    damage: beamData.damage
  }
});

// Factory function for BeamNG connector
export const createBeamNGConnector = (config: BeamNGConfig = {}): SimulatorConnector => {
  const settings = {
    endpoint: 'localhost',
    port: 64256,
    updateRate: 100,
    vehicleId: 'default',
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

  let vehicleState = {
    x: 0, y: 0, z: 0,
    vx: 0, vy: 0, vz: 0,
    heading: 0,
    speed: 0,
    rpm: 800,
    gear: 1
  };

  const connect = async (): Promise<boolean> => {
    try {
      console.log(`Connecting to BeamNG.drive on ${settings.endpoint}:${settings.port}`);
      // In real implementation, this would connect to BeamNG's Lua API
      isConnected = true;
      startDataStream();
      return true;
    } catch (error) {
      console.error('BeamNG connection failed:', error);
      connectionStats.errors++;
      return false;
    }
  };

  const disconnect = async (): Promise<void> => {
    isConnected = false;
    subscribers = [];
    console.log('BeamNG connection closed');
  };

  // Simulate BeamNG vehicle physics data
  const startDataStream = () => {
    const interval = setInterval(() => {
      if (!isConnected) {
        clearInterval(interval);
        return;
      }

      // Simulate realistic vehicle physics
      const throttleInput = 0.6 + Math.random() * 0.3;
      const brakeInput = vehicleState.speed > 60 ? Math.random() * 0.3 : 0;
      const steeringInput = (Math.random() - 0.5) * 0.4;

      // Update vehicle physics
      const acceleration = (throttleInput - brakeInput) * 8;
      vehicleState.speed = Math.max(0, vehicleState.speed + acceleration * 0.1);
      vehicleState.heading += steeringInput * vehicleState.speed * 0.01;
      vehicleState.x += Math.cos(vehicleState.heading) * vehicleState.speed * 0.1;
      vehicleState.y += Math.sin(vehicleState.heading) * vehicleState.speed * 0.1;
      vehicleState.rpm = 800 + vehicleState.speed * 45;

      const mockData: BeamNGData = {
        position: [vehicleState.x, vehicleState.y, vehicleState.z],
        velocity: [
          Math.cos(vehicleState.heading) * vehicleState.speed,
          Math.sin(vehicleState.heading) * vehicleState.speed,
          0
        ],
        acceleration: [acceleration, 0, 0],
        rotation: [0, 0, Math.sin(vehicleState.heading / 2), Math.cos(vehicleState.heading / 2)],
        wheelSpeed: [vehicleState.speed, vehicleState.speed, vehicleState.speed, vehicleState.speed],
        engineRpm: vehicleState.rpm,
        throttle: throttleInput,
        brake: brakeInput,
        steering: steeringInput,
        gear: vehicleState.gear,
        fuel: 0.8 - (Date.now() % 300000) / 500000,
        damage: Math.min(1.0, (Date.now() % 600000) / 600000)
      };

      const telemetryFrame = convertBeamNGToTelemetry(mockData, sequenceNumber++);
      
      connectionStats.lastData = Date.now();
      
      subscribers.forEach(callback => {
        try {
          callback(telemetryFrame);
        } catch (error) {
          console.error('BeamNG subscriber error:', error);
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
    reliability: Math.max(0, 1.0 - (connectionStats.errors * 0.05)),
    errors: connectionStats.errors
  });

  return {
    id: 'beamng-connector',
    simulator: 'beamng',
    connect,
    disconnect,
    isConnected: () => isConnected,
    subscribe,
    getStatus
  };
};