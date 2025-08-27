/**
 * System MCP Tools
 * Tools for system health, status, and capability queries
 */

import type { MCPTool } from './base-tool.ts';
import { createBaseToolFactory } from './base-tool.ts';

const toolFactory = createBaseToolFactory('System');

/**
 * Health check tool - verify Synopticon API is available
 */
export const healthCheckTool: MCPTool = toolFactory.createStatusTool(
  'health_check',
  'Check system health and verify API connectivity',
  async (client) => {
    const isHealthy = await client.isHealthy();
    
    if (!isHealthy) {
      throw new Error('Synopticon API is not responding');
    }

    const health = await client.getHealth();
    
    return {
      status: 'healthy',
      apiConnectivity: 'ok',
      capabilities: health,
      timestamp: new Date().toISOString()
    };
  }
);

/**
 * System status tool - get detailed system and pipeline status
 */
export const getStatusTool: MCPTool = toolFactory.createStatusTool(
  'get_status',
  'Get detailed system status including active pipelines',
  async (client) => {
    const [health, status] = await Promise.all([
      client.getHealth(),
      client.getStatus()
    ]);

    return {
      system: {
        version: health.version,
        uptime: 'available',
        timestamp: new Date().toISOString()
      },
      capabilities: {
        faceDetection: health.face_detection,
        emotionAnalysis: health.emotion_analysis,
        eyeTracking: health.eye_tracking,
        mediaStreaming: health.media_streaming,
        speechAnalysis: health.speech_analysis
      },
      pipelines: status.pipelines.map(pipeline => ({
        name: pipeline.pipeline,
        status: pipeline.status,
        startTime: pipeline.startTime,
        error: pipeline.error
      }))
    };
  }
);

/**
 * Get capabilities tool - list available analysis capabilities
 */
export const getCapabilitiesTool: MCPTool = toolFactory.createStatusTool(
  'get_capabilities',
  'List all available analysis capabilities and their current status',
  async (client) => {
    const health = await client.getHealth();
    const devices = await client.listDevices();

    const capabilities = {
      analysis: {
        faceDetection: {
          available: health.face_detection,
          description: 'Real-time face detection with landmark analysis',
          features: ['face_landmarks', 'bounding_boxes', 'confidence_scores']
        },
        emotionAnalysis: {
          available: health.emotion_analysis,
          description: 'Emotion recognition from facial expressions',
          features: ['emotion_classification', 'valence_arousal', 'confidence_scores']
        },
        eyeTracking: {
          available: health.eye_tracking,
          description: 'Eye gaze tracking and analysis',
          features: ['gaze_direction', 'eye_movements', 'calibration']
        },
        speechAnalysis: {
          available: health.speech_analysis,
          description: 'Speech recognition and audio analysis',
          features: ['speech_to_text', 'audio_quality', 'voice_activity']
        }
      },
      media: {
        streaming: {
          available: health.media_streaming,
          description: 'Real-time media capture and streaming',
          features: ['video_capture', 'audio_capture', 'quality_control']
        }
      },
      devices: {
        cameras: devices.cameras.map(cam => ({
          id: cam.id,
          label: cam.label,
          type: cam.type
        })),
        microphones: devices.microphones.map(mic => ({
          id: mic.id,
          label: mic.label,
          type: mic.type
        }))
      },
      version: health.version
    };

    return capabilities;
  }
);

/**
 * Export all system tools
 */
export const systemTools: MCPTool[] = [
  healthCheckTool,
  getStatusTool,
  getCapabilitiesTool
];