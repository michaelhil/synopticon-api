/**
 * Telemetry MCP Tools
 * Tools for simulator connection, telemetry data, and command control
 */

import type { MCPTool } from './base-tool.js';
import { createBaseToolFactory } from './base-tool.js';

const toolFactory = createBaseToolFactory('Telemetry');

/**
 * List available simulators tool
 */
export const listSimulatorsTool: MCPTool = toolFactory.createStatusTool(
  'list_simulators',
  'List all available simulator types and their capabilities',
  async (client) => {
    const response = await client.fetch('/api/telemetry/simulators');
    return response;
  }
);

/**
 * Connect to simulator tool
 */
export const connectSimulatorTool: MCPTool = {
  name: 'connect_simulator',
  description: 'Connect to a specific simulator (MSFS, X-Plane, BeamNG, VATSIM)',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['msfs', 'xplane', 'beamng', 'vatsim'],
        description: 'Type of simulator to connect to'
      },
      config: {
        type: 'object',
        properties: {
          endpoint: {
            type: 'string',
            description: 'Simulator endpoint (default: localhost)',
            default: 'localhost'
          },
          port: {
            type: 'number',
            description: 'Simulator port (varies by simulator)'
          },
          useNativeProtocol: {
            type: 'boolean',
            description: 'Use native protocol for MSFS/BeamNG',
            default: false
          },
          remoteHosts: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of remote host IPs to try connecting to'
          }
        },
        additionalProperties: true
      }
    },
    required: ['type'],
    additionalProperties: false
  },
  handler: async (client, args) => {
    const response = await client.fetch('/api/telemetry/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    
    return {
      simulator: args.type,
      connection: response,
      message: response.success ? 
        `Successfully connected to ${args.type}` : 
        `Failed to connect to ${args.type}: ${response.error || 'Unknown error'}`
    };
  }
};

/**
 * Get simulator status tool
 */
export const getSimulatorStatusTool: MCPTool = {
  name: 'get_simulator_status',
  description: 'Get status and connection info for a specific simulator',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['msfs', 'xplane', 'beamng', 'vatsim'],
        description: 'Type of simulator to check'
      }
    },
    required: ['type'],
    additionalProperties: false
  },
  handler: async (client, args) => {
    const response = await client.fetch(`/api/telemetry/status/${args.type}`);
    return response;
  }
};

/**
 * Start telemetry stream tool
 */
export const startTelemetryStreamTool: MCPTool = {
  name: 'start_telemetry_stream',
  description: 'Start collecting telemetry data from a simulator',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['msfs', 'xplane', 'beamng', 'vatsim'],
        description: 'Type of simulator to stream from'
      },
      streamId: {
        type: 'string',
        description: 'Optional custom stream ID'
      },
      config: {
        type: 'object',
        properties: {
          maxSize: {
            type: 'number',
            description: 'Maximum buffer size for telemetry data',
            default: 1000
          }
        }
      }
    },
    required: ['type'],
    additionalProperties: false
  },
  handler: async (client, args) => {
    const response = await client.fetch('/api/telemetry/stream/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    
    return {
      simulator: args.type,
      stream: response,
      message: response.success ? 
        `Telemetry stream started for ${args.type} (ID: ${response.streamId})` :
        `Failed to start stream: ${response.error || 'Unknown error'}`
    };
  }
};

/**
 * Get telemetry data tool
 */
export const getTelemetryDataTool: MCPTool = {
  name: 'get_telemetry_data',
  description: 'Get recent telemetry data from an active stream',
  inputSchema: {
    type: 'object',
    properties: {
      streamId: {
        type: 'string',
        description: 'ID of the telemetry stream'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of data points to return',
        default: 10
      },
      since: {
        type: 'number',
        description: 'Only return data after this timestamp (Unix milliseconds)'
      }
    },
    required: ['streamId'],
    additionalProperties: false
  },
  handler: async (client, args) => {
    const params = new URLSearchParams();
    if (args.limit) params.set('limit', args.limit.toString());
    if (args.since) params.set('since', args.since.toString());
    
    const response = await client.fetch(
      `/api/telemetry/stream/${args.streamId}?${params.toString()}`
    );
    
    return response;
  }
};

/**
 * Send simulator command tool
 */
export const sendSimulatorCommandTool: MCPTool = {
  name: 'send_simulator_command',
  description: 'Send a control command to a connected simulator',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['msfs', 'xplane', 'beamng', 'vatsim'],
        description: 'Type of simulator to send command to'
      },
      action: {
        type: 'string',
        description: 'Command action (varies by simulator type)',
        examples: [
          'set-throttle', 'set-elevator', 'toggle-gear', 'set-steering', 'set-brake', 'reset-vehicle'
        ]
      },
      parameters: {
        type: 'object',
        description: 'Command parameters (varies by action)',
        examples: [
          { value: 0.8 },
          { angle: -0.5 },
          { enabled: true }
        ]
      },
      priority: {
        type: 'string',
        enum: ['low', 'normal', 'high', 'critical'],
        description: 'Command priority level',
        default: 'normal'
      },
      config: {
        type: 'object',
        description: 'Simulator configuration if not already connected'
      }
    },
    required: ['type', 'action'],
    additionalProperties: false
  },
  handler: async (client, args) => {
    const response = await client.fetch('/api/telemetry/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    
    return {
      simulator: args.type,
      command: response.command,
      result: response.result,
      message: response.result.success ?
        `Command executed successfully: ${args.action}` :
        `Command failed: ${response.result.error?.message || 'Unknown error'}`
    };
  }
};

/**
 * Get available commands tool
 */
export const getAvailableCommandsTool: MCPTool = {
  name: 'get_available_commands',
  description: 'Get list of available commands for a specific simulator',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['msfs', 'xplane', 'beamng', 'vatsim'],
        description: 'Type of simulator'
      }
    },
    required: ['type'],
    additionalProperties: false
  },
  handler: async (client, args) => {
    const response = await client.fetch(`/api/telemetry/commands/${args.type}`);
    return response;
  }
};

/**
 * Send batch commands tool
 */
export const sendBatchCommandsTool: MCPTool = {
  name: 'send_batch_commands',
  description: 'Send multiple commands to a simulator at once',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['msfs', 'xplane', 'beamng', 'vatsim'],
        description: 'Type of simulator to send commands to'
      },
      commands: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action: { type: 'string' },
            parameters: { type: 'object' },
            priority: {
              type: 'string',
              enum: ['low', 'normal', 'high', 'critical'],
              default: 'normal'
            }
          },
          required: ['action']
        },
        description: 'Array of commands to execute'
      },
      config: {
        type: 'object',
        description: 'Simulator configuration if not already connected'
      }
    },
    required: ['type', 'commands'],
    additionalProperties: false
  },
  handler: async (client, args) => {
    const response = await client.fetch('/api/telemetry/commands/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    
    return {
      simulator: args.type,
      batchSize: response.batchSize,
      commands: response.commands,
      results: response.results,
      summary: {
        total: response.results.length,
        successful: response.results.filter((r: any) => r.success).length,
        failed: response.results.filter((r: any) => !r.success).length
      }
    };
  }
};

/**
 * Disconnect simulator tool
 */
export const disconnectSimulatorTool: MCPTool = {
  name: 'disconnect_simulator',
  description: 'Disconnect from a specific simulator and clean up resources',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['msfs', 'xplane', 'beamng', 'vatsim'],
        description: 'Type of simulator to disconnect from'
      }
    },
    required: ['type'],
    additionalProperties: false
  },
  handler: async (client, args) => {
    const response = await client.fetch(`/api/telemetry/disconnect/${args.type}`, {
      method: 'DELETE'
    });
    
    return {
      simulator: args.type,
      disconnection: response,
      message: response.success ? 
        `Disconnected from ${args.type}` : 
        `Failed to disconnect: ${response.error || 'Unknown error'}`
    };
  }
};

/**
 * Stop telemetry stream tool
 */
export const stopTelemetryStreamTool: MCPTool = {
  name: 'stop_telemetry_stream',
  description: 'Stop an active telemetry stream',
  inputSchema: {
    type: 'object',
    properties: {
      streamId: {
        type: 'string',
        description: 'ID of the stream to stop'
      }
    },
    required: ['streamId'],
    additionalProperties: false
  },
  handler: async (client, args) => {
    const response = await client.fetch(`/api/telemetry/stream/${args.streamId}`, {
      method: 'DELETE'
    });
    
    return {
      streamId: args.streamId,
      result: response,
      message: response.success ? 
        'Stream stopped successfully' : 
        `Failed to stop stream: ${response.error || 'Unknown error'}`
    };
  }
};

// Export all telemetry tools
export const telemetryTools = [
  listSimulatorsTool,
  connectSimulatorTool,
  getSimulatorStatusTool,
  startTelemetryStreamTool,
  getTelemetryDataTool,
  sendSimulatorCommandTool,
  getAvailableCommandsTool,
  sendBatchCommandsTool,
  disconnectSimulatorTool,
  stopTelemetryStreamTool
];
