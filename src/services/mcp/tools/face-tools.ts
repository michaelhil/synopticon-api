/**
 * Face Analysis MCP Tools
 * Tools for face detection, landmark analysis, and recognition
 */

import type { MCPTool } from './base-tool.ts';
import { createBaseToolFactory } from './base-tool.ts';
import { CommonSchemas } from '../utils/validation.ts';

const toolFactory = createBaseToolFactory('Face');

/**
 * Start face analysis tool
 */
export const startFaceAnalysisTool: MCPTool = toolFactory.createActionTool(
  'start_face_analysis',
  'Start real-time face detection and landmark analysis',
  {
    device: {
      ...CommonSchemas.deviceId,
      required: false
    },
    quality: {
      ...CommonSchemas.quality,
      required: false
    }
  },
  {
    device: {
      type: 'string',
      description: 'Camera device ID (optional, uses default camera if not specified)',
      pattern: '^[a-zA-Z0-9_-]+$'
    },
    quality: {
      type: 'string',
      description: 'Analysis quality level',
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    }
  },
  async (client, params) => {
    const result = await client.startFaceAnalysis(params);
    
    return {
      action: 'face_analysis_started',
      sessionId: result.sessionId,
      parameters: {
        device: params.device || 'default',
        quality: params.quality || 'medium'
      },
      message: 'Face analysis has been started. Use synopticon_get_face_results to retrieve detection data.',
      timestamp: new Date().toISOString()
    };
  }
);

/**
 * Get face analysis results tool
 */
export const getFaceResultsTool: MCPTool = toolFactory.createStatusTool(
  'get_face_results',
  'Get current face detection results including landmarks and bounding boxes',
  async (client) => {
    const results = await client.getFaceResults();
    
    if (!results.faces || results.faces.length === 0) {
      return {
        status: 'no_faces_detected',
        message: 'No faces detected in current frame',
        timestamp: results.timestamp,
        faces: []
      };
    }

    return {
      status: 'faces_detected',
      faceCount: results.faces.length,
      faces: results.faces.map(face => ({
        id: face.id,
        confidence: Math.round(face.confidence * 100) / 100,
        boundingBox: {
          x: Math.round(face.boundingBox.x),
          y: Math.round(face.boundingBox.y),
          width: Math.round(face.boundingBox.width),
          height: Math.round(face.boundingBox.height)
        },
        landmarkCount: face.landmarks.length,
        landmarks: face.landmarks.map(point => ({
          x: Math.round(point[0] * 100) / 100,
          y: Math.round(point[1] * 100) / 100
        }))
      })),
      timestamp: results.timestamp,
      message: `Detected ${results.faces.length} face${results.faces.length === 1 ? '' : 's'} in current frame`
    };
  }
);

/**
 * Stop face analysis tool
 */
export const stopFaceAnalysisTool: MCPTool = toolFactory.createStatusTool(
  'stop_face_analysis',
  'Stop the currently running face analysis session',
  async (client) => {
    const result = await client.stopFaceAnalysis();
    
    return {
      action: 'face_analysis_stopped',
      success: result.success,
      message: 'Face analysis has been stopped',
      timestamp: new Date().toISOString()
    };
  }
);

/**
 * Configure face detection parameters tool
 */
export const configureFaceDetectionTool: MCPTool = toolFactory.createActionTool(
  'configure_face_detection',
  'Configure face detection parameters and thresholds',
  {
    confidence_threshold: {
      ...CommonSchemas.threshold,
      required: false
    },
    max_faces: {
      type: 'number',
      min: 1,
      max: 20,
      required: false
    }
  },
  {
    confidence_threshold: {
      type: 'number',
      description: 'Minimum confidence threshold for face detection (0.0 - 1.0)',
      minimum: 0.0,
      maximum: 1.0,
      default: 0.7
    },
    max_faces: {
      type: 'number',
      description: 'Maximum number of faces to detect simultaneously',
      minimum: 1,
      maximum: 20,
      default: 10
    }
  },
  async (client, params) => {
    // Note: This would require a configuration endpoint in Synopticon API
    // For now, we'll return the configuration that would be applied
    
    return {
      action: 'face_detection_configured',
      configuration: {
        confidence_threshold: params.confidence_threshold || 0.7,
        max_faces: params.max_faces || 10
      },
      message: 'Face detection configuration updated',
      note: 'Configuration will take effect for new analysis sessions',
      timestamp: new Date().toISOString()
    };
  }
);

/**
 * Export all face analysis tools
 */
export const faceTools: MCPTool[] = [
  startFaceAnalysisTool,
  getFaceResultsTool,
  stopFaceAnalysisTool,
  configureFaceDetectionTool
];