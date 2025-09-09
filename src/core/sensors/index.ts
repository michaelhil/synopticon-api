/**
 * Sensor Infrastructure Hub
 * Centralized sensor management and factory functions
 */

export * from './camera';
export * from './face-detection';
export * from './eye-tracking';
export * from './media-streaming';
export * from './audio';

// Sensor type definitions
export interface SensorCapabilities {
  dataTypes: ('visual' | 'audio' | 'positional')[];
  maxFrequency: number;
  latency: number;
  reliability: number;
}

export interface SensorConfig {
  id: string;
  type: string;
  enabled: boolean;
  capabilities: SensorCapabilities;
  settings: Record<string, unknown>;
}

// Factory for creating sensor instances
export const createSensorFactory = () => {
  const sensors = new Map<string, unknown>();
  
  const register = (id: string, sensor: unknown) => {
    sensors.set(id, sensor);
  };
  
  const get = (id: string) => sensors.get(id);
  
  const list = () => Array.from(sensors.keys());
  
  const remove = (id: string) => sensors.delete(id);
  
  return {
    register,
    get,
    list,
    remove,
    size: () => sensors.size
  };
};
