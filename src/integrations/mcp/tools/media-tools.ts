/**
 * Media Streaming MCP Tools
 * Tools for media capture, streaming, and device management
 */

import type { MCPTool } from './base-tool.js';
import { createBaseToolFactory } from './base-tool.js';
import { CommonSchemas } from '../utils/validation.js';

const toolFactory = createBaseToolFactory('Media');

/**
 * Start media streaming tool
 */
export const startMediaStreamTool: MCPTool = toolFactory.createActionTool(
  'start_media_stream',
  'Start media streaming with specified devices and quality settings',
  {
    devices: {
      type: 'array',
      required: false
    },
    quality: {
      ...CommonSchemas.quality,
      required: false
    }
  },
  {
    devices: {
      type: 'array',
      description: 'Array of device IDs to use for streaming (optional)',
      items: {
        type: 'string',
        pattern: '^[a-zA-Z0-9_-]+$'
      },
      default: []
    },
    quality: {
      type: 'string',
      description: 'Streaming quality level',
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    }
  },
  async (client, params) => {
    const result = await client.startMediaStream(params);
    
    return {
      action: 'media_stream_started',
      streamId: result.streamId,
      endpoints: result.endpoints,
      parameters: {
        devices: params.devices || ['default'],
        quality: params.quality || 'medium'
      },
      message: 'Media streaming has been started. Use synopticon_get_stream_status to monitor stream health.',
      accessInfo: {
        streamId: result.streamId,
        endpoints: result.endpoints,
        note: 'Use these endpoints to access the media streams'
      },
      timestamp: new Date().toISOString()
    };
  }
);

/**
 * Get stream status tool
 */
export const getStreamStatusTool: MCPTool = toolFactory.createStatusTool(
  'get_stream_status',
  'Get current status of all active media streams',
  async (client) => {
    const status = await client.getStreamStatus();
    
    if (!status.active) {
      return {
        status: 'inactive',
        message: 'No media streams are currently active',
        activeStreams: 0,
        streams: [],
        timestamp: new Date().toISOString()
      };
    }

    const streamsByType = status.streams.reduce((acc, stream) => {
      if (!acc[stream.type]) acc[stream.type] = [];
      acc[stream.type].push(stream);
      return acc;
    }, {} as Record<string, typeof status.streams>);

    return {
      status: 'active',
      activeStreams: status.streams.length,
      streamsByType: {
        video: streamsByType.video?.length || 0,
        audio: streamsByType.audio?.length || 0
      },
      streams: status.streams.map(stream => ({
        id: stream.id,
        type: stream.type,
        status: stream.status,
        device: stream.device,
        health: stream.status === 'running' ? 'healthy' : 'issues'
      })),
      message: `${status.streams.length} stream${status.streams.length === 1 ? '' : 's'} active`,
      timestamp: new Date().toISOString()
    };
  }
);

/**
 * Stop media streaming tool
 */
export const stopMediaStreamTool: MCPTool = toolFactory.createStatusTool(
  'stop_media_stream',
  'Stop all currently active media streams',
  async (client) => {
    const result = await client.stopMediaStream();
    
    return {
      action: 'media_stream_stopped',
      success: result.success,
      message: 'All media streams have been stopped',
      timestamp: new Date().toISOString()
    };
  }
);

/**
 * List available devices tool
 */
export const listDevicesTool: MCPTool = toolFactory.createStatusTool(
  'list_devices',
  'List all available cameras and microphones for media capture',
  async (client) => {
    const devices = await client.listDevices();
    
    const totalDevices = devices.cameras.length + devices.microphones.length;
    
    if (totalDevices === 0) {
      return {
        status: 'no_devices',
        message: 'No media devices available',
        cameras: [],
        microphones: [],
        totalDevices: 0,
        timestamp: new Date().toISOString()
      };
    }

    return {
      status: 'devices_available',
      totalDevices,
      cameras: devices.cameras.map(camera => ({
        id: camera.id,
        label: camera.label || `Camera ${camera.id}`,
        type: camera.type,
        available: true
      })),
      microphones: devices.microphones.map(mic => ({
        id: mic.id,
        label: mic.label || `Microphone ${mic.id}`,
        type: mic.type,
        available: true
      })),
      deviceSummary: {
        cameras: devices.cameras.length,
        microphones: devices.microphones.length,
        total: totalDevices
      },
      message: `Found ${totalDevices} available device${totalDevices === 1 ? '' : 's'}`,
      usage: {
        note: 'Use device IDs with other streaming tools',
        example: 'synopticon_start_media_stream with devices: ["camera_id", "mic_id"]'
      },
      timestamp: new Date().toISOString()
    };
  }
);

/**
 * Export all media streaming tools
 */
export const mediaTools: MCPTool[] = [
  startMediaStreamTool,
  getStreamStatusTool,
  stopMediaStreamTool,
  listDevicesTool
];
