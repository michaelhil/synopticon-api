/**
 * Simulator Telemetry Connectors
 * Standardized interfaces for different flight and driving simulators
 */

export * from './msfs-connector';
export * from './beamng-connector';
export * from './xplane-connector';
export * from './vatsim-connector';

// Base simulator connector interface
export interface SimulatorConnector {
  id: string;
  simulator: string;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  subscribe(callback: (data: any) => void): () => void;
  getStatus(): {
    connected: boolean;
    lastData: number;
    reliability: number;
    errors: number;
  };
}

// Factory for creating simulator connectors
export const createSimulatorConnector = (
  type: 'msfs' | 'xplane' | 'beamng' | 'vatsim',
  config: Record<string, unknown> = {}
) => {
  switch (type) {
    case 'msfs':
      return import('./msfs-connector').then(m => m.createMSFSConnector(config));
    case 'beamng':
      return import('./beamng-connector').then(m => m.createBeamNGConnector(config));
    case 'xplane':
      return import('./xplane-connector').then(m => m.createXPlaneConnector(config));
    case 'vatsim':
      return import('./vatsim-connector').then(m => m.createVATSIMConnector(config));
    default:
      throw new Error(`Unknown simulator type: ${type}`);
  }
};