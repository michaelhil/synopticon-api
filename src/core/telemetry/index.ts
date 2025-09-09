/**
 * Telemetry Infrastructure Hub
 * Multi-simulator telemetry data collection and processing
 */

export * from './simulators';
export * from './streaming';
export * from './correlation';

// Core telemetry interfaces
export interface TelemetryConnection {
  id: string;
  simulator: 'msfs' | 'xplane' | 'beamng' | 'vatsim' | 'custom';
  status: 'connected' | 'disconnected' | 'error';
  lastData: number;
  reliability: number;
}

export interface TelemetryConfig {
  simulator: 'msfs' | 'xplane' | 'beamng' | 'vatsim' | 'custom';
  endpoint?: string;
  port?: number;
  updateRate?: number;
  timeout?: number;
  retries?: number;
}

// Factory for telemetry connection management
export const createTelemetryManager = () => {
  const connections = new Map<string, TelemetryConnection>();
  const dataStreams = new Map<string, unknown>();

  const addConnection = (id: string, connection: TelemetryConnection) => {
    connections.set(id, connection);
  };

  const removeConnection = (id: string) => {
    return connections.delete(id);
  };

  const getConnection = (id: string) => connections.get(id);

  const listConnections = () => Array.from(connections.values());

  const getHealthyConnections = () => {
    return listConnections().filter(conn => 
      conn.status === 'connected' && conn.reliability > 0.8
    );
  };

  return {
    addConnection,
    removeConnection,
    getConnection,
    listConnections,
    getHealthyConnections,
    size: () => connections.size
  };
};
