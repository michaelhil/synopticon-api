/**
 * Telemetry API Routes - TypeScript Implementation
 * REST endpoints for simulator telemetry data and command control
 */

import { createSimulatorConnector } from '../../../core/telemetry/simulators/index.js';
import { 
  FLIGHT_COMMANDS, 
  VEHICLE_COMMANDS, 
  createFlightCommand, 
  createVehicleCommand 
} from '../../../core/telemetry/commands/command-system.js';

export interface TelemetryRouteDependencies {
  middlewareSystem: any;
  createJSONResponse: (data: any, status?: number, headers?: Record<string, string>) => Response;
  createErrorResponse: (message: string, status?: number, headers?: Record<string, string>) => Response;
  distributionStreams: Map<string, any>;
  createDistributionStream: (config: any) => Promise<any>;
}

export type RouteDefinition = [string, string, (request: Request, params?: string[]) => Promise<Response>];

// Global simulator instances
const simulatorInstances = new Map<string, any>();
const telemetryStreams = new Map<string, any>();

/**
 * Create telemetry routes
 */
export const createTelemetryRoutes = ({
  middlewareSystem,
  createJSONResponse,
  createErrorResponse,
  distributionStreams,
  createDistributionStream
}: TelemetryRouteDependencies): RouteDefinition[] => {
  const routes: RouteDefinition[] = [];

  // Helper function to get or create simulator instance
  const getSimulatorInstance = async (type: string, config: any = {}) => {
    const instanceKey = `${type}_${JSON.stringify(config)}`;
    
    if (!simulatorInstances.has(instanceKey)) {
      const connector = await createSimulatorConnector(type, config);
      simulatorInstances.set(instanceKey, connector);
    }
    
    return simulatorInstances.get(instanceKey);
  };

  // Helper function to validate simulator type
  const validateSimulatorType = (type: string): boolean => {
    const validTypes = ['msfs', 'xplane', 'beamng', 'vatsim'];
    return validTypes.includes(type);
  };

  // GET /api/telemetry/simulators - List available simulators
  routes.push(['GET', '/api/telemetry/simulators', async (request: Request): Promise<Response> => {
    try {
      const simulators = {
        available: ['msfs', 'xplane', 'beamng', 'vatsim'],
        active: Array.from(simulatorInstances.keys()),
        capabilities: {
          msfs: {
            type: 'flight-simulator',
            features: ['telemetry', 'commands', 'native-protocol'],
            commands: ['flight-control', 'system-control', 'navigation']
          },
          xplane: {
            type: 'flight-simulator', 
            features: ['telemetry', 'udp-datarefs'],
            commands: ['flight-control']
          },
          beamng: {
            type: 'vehicle-simulator',
            features: ['telemetry', 'commands', 'vehicle-control'],
            commands: ['vehicle-control', 'simulation']
          },
          vatsim: {
            type: 'network-service',
            features: ['telemetry', 'flight-tracking'],
            commands: []
          }
        }
      };
      
      return createJSONResponse(simulators);
    } catch (error: any) {
      return createErrorResponse('Failed to list simulators', 500);
    }
  }]);

  // POST /api/telemetry/connect - Connect to a simulator
  routes.push(['POST', '/api/telemetry/connect', async (request: Request): Promise<Response> => {
    try {
      const body = await request.json();
      const { type, config = {} } = body;
      
      if (!validateSimulatorType(type)) {
        return createErrorResponse('Invalid simulator type', 400);
      }
      
      const simulator = await getSimulatorInstance(type, config);
      const connected = await simulator.connect();
      
      if (connected) {
        return createJSONResponse({ 
          success: true, 
          simulator: type, 
          status: simulator.getStatus(),
          capabilities: simulator.getCapabilities?.() || null
        });
      } else {
        return createErrorResponse('Failed to connect to simulator', 503);
      }
    } catch (error: any) {
      return createErrorResponse('Connection error', 500);
    }
  }]);

  // DELETE /api/telemetry/disconnect/:type - Disconnect from simulator
  routes.push(['DELETE', '^/api/telemetry/disconnect/([^/]+)$', async (request: Request, params?: string[]): Promise<Response> => {
    try {
      const type = params?.[0];
      if (!type) {
        return createErrorResponse('Simulator type is required', 400);
      }
      
      if (!validateSimulatorType(type)) {
        return createErrorResponse('Invalid simulator type', 400);
      }
      
      // Find and disconnect simulator instances of this type
      let disconnectedCount = 0;
      for (const [key, simulator] of simulatorInstances.entries()) {
        if (key.startsWith(`${type}_`)) {
          await simulator.disconnect();
          simulatorInstances.delete(key);
          disconnectedCount++;
        }
      }
      
      // Clean up telemetry streams
      for (const [streamId, stream] of telemetryStreams.entries()) {
        if (stream.simulator === type) {
          stream.unsubscribe?.();
          telemetryStreams.delete(streamId);
        }
      }
      
      return createJSONResponse({ 
        success: true, 
        simulator: type, 
        disconnectedInstances: disconnectedCount 
      });
    } catch (error: any) {
      return createErrorResponse('Disconnect error', 500);
    }
  }]);

  // GET /api/telemetry/status/:type - Get simulator status
  routes.push(['GET', '^/api/telemetry/status/([^/]+)$', async (request: Request, params?: string[]): Promise<Response> => {
    try {
      const type = params?.[0];
      if (!type) {
        return createErrorResponse('Simulator type is required', 400);
      }
      
      if (!validateSimulatorType(type)) {
        return createErrorResponse('Invalid simulator type', 400);
      }
      
      const instances = [];
      for (const [key, simulator] of simulatorInstances.entries()) {
        if (key.startsWith(`${type}_`)) {
          instances.push({
            key,
            connected: simulator.isConnected(),
            status: simulator.getStatus(),
            capabilities: simulator.getCapabilities?.() || null
          });
        }
      }
      
      if (instances.length === 0) {
        return createErrorResponse('No active instances of this simulator type', 404);
      }
      
      return createJSONResponse({ simulator: type, instances });
    } catch (error: any) {
      return createErrorResponse('Status check failed', 500);
    }
  }]);

  // POST /api/telemetry/stream/start - Start telemetry stream
  routes.push(['POST', '/api/telemetry/stream/start', async (request: Request): Promise<Response> => {
    try {
      const body = await request.json();
      const { type, config = {}, streamId, distribution } = body;
      
      if (!validateSimulatorType(type)) {
        return createErrorResponse('Invalid simulator type', 400);
      }
      
      const simulator = await getSimulatorInstance(type, config);
      
      if (!simulator.isConnected()) {
        await simulator.connect();
      }
      
      const stream = {
        id: streamId || `${type}_${Date.now()}`,
        simulator: type,
        data: [],
        maxSize: config.maxSize || 1000,
        unsubscribe: null,
        distribution: distribution || null
      };
      
      // Subscribe to telemetry data
      stream.unsubscribe = simulator.subscribe((data: any) => {
        const telemetryData = {
          ...data,
          receivedAt: Date.now(),
          streamId: stream.id,
          simulator: type
        };
        
        stream.data.push(telemetryData);
        
        // Keep buffer size manageable
        if (stream.data.length > stream.maxSize) {
          stream.data.shift();
        }
        
        // Distribute to configured distribution system if enabled
        if (stream.distribution && distributionStreams) {
          const distributionStream = distributionStreams.get(stream.distribution.streamId);
          if (distributionStream && distributionStream.status === 'active') {
            // Send telemetry data through distribution system
            middlewareSystem.emit('telemetry_data', {
              type: 'telemetry',
              source: stream.simulator,
              streamId: stream.id,
              data: telemetryData,
              timestamp: telemetryData.receivedAt
            });
          }
        }
      });
      
      telemetryStreams.set(stream.id, stream);
      
      return createJSONResponse({
        success: true,
        streamId: stream.id,
        simulator: type,
        bufferSize: stream.maxSize,
        distribution: stream.distribution
      });
    } catch (error: any) {
      return createErrorResponse('Failed to start stream', 500);
    }
  }]);

  // GET /api/telemetry/stream/:streamId - Get stream data
  routes.push(['GET', '^/api/telemetry/stream/([^/]+)$', async (request: Request, params?: string[]): Promise<Response> => {
    try {
      const streamId = params?.[0];
      if (!streamId) {
        return createErrorResponse('Stream ID is required', 400);
      }
      
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const since = parseInt(url.searchParams.get('since') || '0');
      
      const stream = telemetryStreams.get(streamId);
      if (!stream) {
        return createErrorResponse('Stream not found', 404);
      }
      
      let {data} = stream;
      
      // Filter by timestamp if specified
      if (since > 0) {
        data = data.filter((item: any) => item.receivedAt > since);
      }
      
      // Limit results
      if (data.length > limit) {
        data = data.slice(-limit);
      }
      
      return createJSONResponse({
        streamId,
        simulator: stream.simulator,
        dataCount: data.length,
        totalBuffered: stream.data.length,
        data
      });
    } catch (error: any) {
      return createErrorResponse('Failed to get stream data', 500);
    }
  }]);

  // DELETE /api/telemetry/stream/:streamId - Stop stream
  routes.push(['DELETE', '^/api/telemetry/stream/([^/]+)$', async (request: Request, params?: string[]): Promise<Response> => {
    try {
      const streamId = params?.[0];
      if (!streamId) {
        return createErrorResponse('Stream ID is required', 400);
      }
      
      const stream = telemetryStreams.get(streamId);
      if (!stream) {
        return createErrorResponse('Stream not found', 404);
      }
      
      stream.unsubscribe?.();
      telemetryStreams.delete(streamId);
      
      return createJSONResponse({
        success: true,
        streamId,
        simulator: stream.simulator
      });
    } catch (error: any) {
      return createErrorResponse('Failed to stop stream', 500);
    }
  }]);

  // POST /api/telemetry/command - Send command to simulator
  routes.push(['POST', '/api/telemetry/command', async (request: Request): Promise<Response> => {
    try {
      const body = await request.json();
      const { type, action, parameters = {}, config = {}, priority = 'normal' } = body;
      
      if (!validateSimulatorType(type)) {
        return createErrorResponse('Invalid simulator type', 400);
      }
      
      const simulator = await getSimulatorInstance(type, config);
      
      if (!simulator.isConnected()) {
        return createErrorResponse('Simulator not connected', 503);
      }
      
      if (!simulator.sendCommand) {
        return createErrorResponse('Simulator does not support commands', 400);
      }
      
      // Create appropriate command based on simulator type
      let command;
      if (['msfs', 'xplane'].includes(type)) {
        command = createFlightCommand(action, parameters, { priority });
      } else if (type === 'beamng') {
        command = createVehicleCommand(action, parameters, { priority });
      } else {
        return createErrorResponse('Command not supported for this simulator type', 400);
      }
      
      const result = await simulator.sendCommand(command);
      
      return createJSONResponse({
        command: {
          id: command.id,
          type: command.type,
          action: command.action,
          parameters: command.parameters
        },
        result
      });
    } catch (error: any) {
      return createErrorResponse('Command execution failed', 500);
    }
  }]);

  // POST /api/telemetry/commands/batch - Send multiple commands
  routes.push(['POST', '/api/telemetry/commands/batch', async (request: Request): Promise<Response> => {
    try {
      const body = await request.json();
      const { type, commands, config = {} } = body;
      
      if (!validateSimulatorType(type)) {
        return createErrorResponse('Invalid simulator type', 400);
      }
      
      if (!Array.isArray(commands) || commands.length === 0) {
        return createErrorResponse('Commands array is required and must not be empty', 400);
      }
      
      const simulator = await getSimulatorInstance(type, config);
      
      if (!simulator.isConnected()) {
        return createErrorResponse('Simulator not connected', 503);
      }
      
      if (!simulator.sendCommands && !simulator.sendCommand) {
        return createErrorResponse('Simulator does not support commands', 400);
      }
      
      // Create command objects
      const commandObjects = commands.map(({ action, parameters = {}, priority = 'normal' }) => {
        if (['msfs', 'xplane'].includes(type)) {
          return createFlightCommand(action, parameters, { priority });
        } else if (type === 'beamng') {
          return createVehicleCommand(action, parameters, { priority });
        } else {
          throw new Error('Unsupported simulator type');
        }
      });
      
      // Execute commands
      let results;
      if (simulator.sendCommands) {
        results = await simulator.sendCommands(commandObjects);
      } else {
        // Execute sequentially if batch not supported
        results = [];
        for (const command of commandObjects) {
          const result = await simulator.sendCommand(command);
          results.push(result);
        }
      }
      
      return createJSONResponse({
        batchSize: commandObjects.length,
        commands: commandObjects.map((cmd: any) => ({
          id: cmd.id,
          type: cmd.type,
          action: cmd.action,
          parameters: cmd.parameters
        })),
        results
      });
    } catch (error: any) {
      return createErrorResponse('Batch command execution failed', 500);
    }
  }]);

  // GET /api/telemetry/commands - Get available commands for simulator
  routes.push(['GET', '^/api/telemetry/commands/([^/]+)$', async (request: Request, params?: string[]): Promise<Response> => {
    try {
      const type = params?.[0];
      if (!type) {
        return createErrorResponse('Simulator type is required', 400);
      }
      
      if (!validateSimulatorType(type)) {
        return createErrorResponse('Invalid simulator type', 400);
      }
      
      // Return static command information (could be enhanced with dynamic capabilities)
      let availableCommands: any = {};
      
      if (['msfs', 'xplane'].includes(type)) {
        availableCommands = {
          'flight-control': Object.values(FLIGHT_COMMANDS),
          examples: {
            [FLIGHT_COMMANDS.SET_THROTTLE]: { value: 0.8 },
            [FLIGHT_COMMANDS.SET_ELEVATOR]: { value: -0.2 },
            [FLIGHT_COMMANDS.TOGGLE_GEAR]: {},
            [FLIGHT_COMMANDS.AP_MASTER]: { enabled: true }
          }
        };
      } else if (type === 'beamng') {
        availableCommands = {
          'vehicle-control': Object.values(VEHICLE_COMMANDS),
          examples: {
            [VEHICLE_COMMANDS.SET_STEERING]: { angle: -0.5 },
            [VEHICLE_COMMANDS.SET_THROTTLE]: { value: 0.6 },
            [VEHICLE_COMMANDS.SET_BRAKE]: { value: 0.3 },
            [VEHICLE_COMMANDS.RESET_VEHICLE]: {}
          }
        };
      }
      
      return createJSONResponse({
        simulator: type,
        commands: availableCommands
      });
    } catch (error: any) {
      return createErrorResponse('Failed to get command list', 500);
    }
  }]);

  // POST /api/telemetry/distribution/create - Create distribution stream for telemetry
  routes.push(['POST', '/api/telemetry/distribution/create', async (request: Request): Promise<Response> => {
    try {
      const body = await request.json();
      const { 
        simulatorType, 
        telemetryStreamId, 
        distributionConfig 
      } = body;
      
      if (!validateSimulatorType(simulatorType)) {
        return createErrorResponse('Invalid simulator type', 400);
      }
      
      if (!telemetryStreamId) {
        return createErrorResponse('Telemetry stream ID is required', 400);
      }
      
      // Verify telemetry stream exists
      const telemetryStream = telemetryStreams.get(telemetryStreamId);
      if (!telemetryStream) {
        return createErrorResponse('Telemetry stream not found', 404);
      }
      
      // Create distribution stream configuration
      const streamConfig = {
        type: 'telemetry',
        source: 'simulator',
        destination: distributionConfig.destination,
        telemetry: {
          simulator: simulatorType,
          streamId: telemetryStreamId,
          dataTypes: distributionConfig.dataTypes || ['all']
        },
        ...distributionConfig
      };
      
      const distributionStream = await createDistributionStream(streamConfig);
      
      // Link telemetry stream to distribution stream
      telemetryStream.distribution = {
        streamId: distributionStream.id,
        config: streamConfig
      };
      
      return createJSONResponse({
        success: true,
        distributionStreamId: distributionStream.id,
        telemetryStreamId,
        simulator: simulatorType,
        configuration: streamConfig,
        message: 'Distribution stream created for telemetry data'
      });
    } catch (error: any) {
      return createErrorResponse('Failed to create distribution stream', 500);
    }
  }]);

  console.log(`🎮 Telemetry routes created: ${routes.length} endpoints`);
  
  return routes;
};