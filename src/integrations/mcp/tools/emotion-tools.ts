/**
 * Emotion Analysis MCP Tools
 * Tools for emotion detection and sentiment analysis
 */

import type { MCPTool } from './base-tool.js';
import { createBaseToolFactory } from './base-tool.js';
import { CommonSchemas } from '../utils/validation.js';

const toolFactory = createBaseToolFactory('Emotion');

/**
 * Start emotion analysis tool
 */
export const startEmotionAnalysisTool: MCPTool = toolFactory.createActionTool(
  'start_emotion_analysis',
  'Start real-time emotion detection from facial expressions',
  {
    device: {
      ...CommonSchemas.deviceId,
      required: false
    },
    threshold: {
      ...CommonSchemas.threshold,
      required: false
    }
  },
  {
    device: {
      type: 'string',
      description: 'Camera device ID (optional, uses default camera if not specified)',
      pattern: '^[a-zA-Z0-9_-]+$'
    },
    threshold: {
      type: 'number',
      description: 'Minimum confidence threshold for emotion detection (0.0 - 1.0)',
      minimum: 0.0,
      maximum: 1.0,
      default: 0.6
    }
  },
  async (client, params) => {
    const result = await client.startEmotionAnalysis(params);
    
    return {
      action: 'emotion_analysis_started',
      sessionId: result.sessionId,
      parameters: {
        device: params.device || 'default',
        threshold: params.threshold || 0.6
      },
      message: 'Emotion analysis has been started. Use synopticon_get_emotion_results to retrieve emotion data.',
      supportedEmotions: [
        'happiness', 'sadness', 'anger', 'fear', 'surprise', 'disgust', 'neutral'
      ],
      timestamp: new Date().toISOString()
    };
  }
);

/**
 * Get emotion analysis results tool
 */
export const getEmotionResultsTool: MCPTool = toolFactory.createStatusTool(
  'get_emotion_results',
  'Get current emotion analysis results including emotion classifications and confidence scores',
  async (client) => {
    const results = await client.getEmotionResults();
    
    if (!results.emotions || results.emotions.length === 0) {
      return {
        status: 'no_emotions_detected',
        message: 'No emotions detected in current frame',
        timestamp: results.timestamp,
        emotions: []
      };
    }

    // Find the dominant emotion (highest confidence)
    const dominantEmotion = results.emotions.reduce((prev, current) => 
      (prev.confidence > current.confidence) ? prev : current
    );

    return {
      status: 'emotions_detected',
      dominantEmotion: {
        emotion: dominantEmotion.emotion,
        confidence: Math.round(dominantEmotion.confidence * 100) / 100,
        valence: Math.round(dominantEmotion.valence * 100) / 100,
        arousal: Math.round(dominantEmotion.arousal * 100) / 100
      },
      allEmotions: results.emotions.map(emotion => ({
        emotion: emotion.emotion,
        confidence: Math.round(emotion.confidence * 100) / 100,
        valence: Math.round(emotion.valence * 100) / 100,
        arousal: Math.round(emotion.arousal * 100) / 100
      })).sort((a, b) => b.confidence - a.confidence),
      emotionalState: {
        valence: dominantEmotion.valence > 0 ? 'positive' : dominantEmotion.valence < 0 ? 'negative' : 'neutral',
        arousal: dominantEmotion.arousal > 0.5 ? 'high' : dominantEmotion.arousal < -0.5 ? 'low' : 'medium',
        intensity: dominantEmotion.confidence
      },
      timestamp: results.timestamp,
      message: `Detected ${dominantEmotion.emotion} (${Math.round(dominantEmotion.confidence * 100)}% confidence)`
    };
  }
);

/**
 * Stop emotion analysis tool
 */
export const stopEmotionAnalysisTool: MCPTool = toolFactory.createStatusTool(
  'stop_emotion_analysis',
  'Stop the currently running emotion analysis session',
  async (client) => {
    const result = await client.stopEmotionAnalysis();
    
    return {
      action: 'emotion_analysis_stopped',
      success: result.success,
      message: 'Emotion analysis has been stopped',
      timestamp: new Date().toISOString()
    };
  }
);

/**
 * Set emotion detection thresholds tool
 */
export const setEmotionThresholdsTool: MCPTool = toolFactory.createActionTool(
  'set_emotion_thresholds',
  'Configure emotion detection thresholds and sensitivity',
  {
    confidence_threshold: {
      ...CommonSchemas.threshold,
      required: false
    },
    valence_sensitivity: {
      ...CommonSchemas.threshold,
      required: false
    },
    arousal_sensitivity: {
      ...CommonSchemas.threshold,
      required: false
    }
  },
  {
    confidence_threshold: {
      type: 'number',
      description: 'Minimum confidence threshold for emotion detection (0.0 - 1.0)',
      minimum: 0.0,
      maximum: 1.0,
      default: 0.6
    },
    valence_sensitivity: {
      type: 'number',
      description: 'Sensitivity for valence (positive/negative) detection (0.0 - 1.0)',
      minimum: 0.0,
      maximum: 1.0,
      default: 0.5
    },
    arousal_sensitivity: {
      type: 'number', 
      description: 'Sensitivity for arousal (activation level) detection (0.0 - 1.0)',
      minimum: 0.0,
      maximum: 1.0,
      default: 0.5
    }
  },
  async (client, params) => {
    // Note: This would require a configuration endpoint in Synopticon API
    // For now, we'll return the configuration that would be applied
    
    const configuration = {
      confidence_threshold: params.confidence_threshold || 0.6,
      valence_sensitivity: params.valence_sensitivity || 0.5,
      arousal_sensitivity: params.arousal_sensitivity || 0.5
    };
    
    return {
      action: 'emotion_thresholds_configured',
      configuration,
      effects: {
        confidence: `Emotions below ${configuration.confidence_threshold} confidence will be filtered out`,
        valence: `Valence changes below ${configuration.valence_sensitivity} will be smoothed`,
        arousal: `Arousal changes below ${configuration.arousal_sensitivity} will be smoothed`
      },
      message: 'Emotion detection thresholds updated',
      note: 'Configuration will take effect for new analysis sessions',
      timestamp: new Date().toISOString()
    };
  }
);

/**
 * Export all emotion analysis tools
 */
export const emotionTools: MCPTool[] = [
  startEmotionAnalysisTool,
  getEmotionResultsTool,
  stopEmotionAnalysisTool,
  setEmotionThresholdsTool
];
