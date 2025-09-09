/**
 * @fileoverview Features configuration schema and validation
 * Defines validation rules for feature-specific settings
 */

import { ValidationTypes, SecurityRules } from '../validation-helpers.js';

/**
 * Features configuration validation schema
 */
export const createFeaturesConfig = () => ({
  features: {
    type: ValidationTypes.OBJECT,
    required: true,
    properties: {
      faceAnalysis: {
        type: ValidationTypes.OBJECT,
        required: true,
        properties: {
          enabled: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          confidenceThreshold: {
            type: ValidationTypes.NUMBER,
            required: true,
            range: [0, 1],
            validate: (threshold: number) => {
              if (threshold < 0.3) return 'Confidence threshold should be at least 0.3 for reliable results';
              if (threshold > 0.95) return 'Confidence threshold above 0.95 may be too restrictive';
              return true;
            }
          },
          maxFaces: {
            type: ValidationTypes.NUMBER,
            required: true,
            range: [1, 20],
            validate: (max: number) => {
              if (max > 10) return 'Processing more than 10 faces may impact performance';
              return true;
            }
          },
          realTimeProcessing: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          enableLandmarks: {
            type: ValidationTypes.BOOLEAN,
            required: true
          }
        }
      },
      eyeTracking: {
        type: ValidationTypes.OBJECT,
        required: true,
        properties: {
          enabled: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          devices: {
            type: ValidationTypes.ARRAY,
            required: true,
            validate: (devices: string[]) => {
              const supportedDevices = ['tobii5', 'webcam', 'simulation'];
              for (const device of devices) {
                if (!supportedDevices.includes(device)) {
                  return `Unsupported device: ${device}. Supported: ${supportedDevices.join(', ')`;
                }
              }
              return true;
            }
          },
          calibrationRequired: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          gazeSmoothing: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          confidenceThreshold: {
            type: ValidationTypes.NUMBER,
            required: true,
            range: [0, 1]
          }
        }
      },
      emotionAnalysis: {
        type: ValidationTypes.OBJECT,
        required: true,
        properties: {
          enabled: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          models: {
            type: ValidationTypes.ARRAY,
            required: true,
            validate: (models: string[]) => {
              const supportedModels = ['small', 'medium', 'large'];
              for (const model of models) {
                if (!supportedModels.includes(model)) {
                  return `Unsupported model: ${model}. Supported: ${supportedModels.join(', ')`;
                }
              }
              return true;
            }
          },
          realTime: {
            type: ValidationTypes.BOOLEAN,
            required: true
          }
        }
      },
      mediaStreaming: {
        type: ValidationTypes.OBJECT,
        required: true,
        properties: {
          enabled: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          webrtc: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          websocket: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          maxStreams: {
            type: ValidationTypes.NUMBER,
            required: true,
            range: [1, 100],
            validate: (max: number) => {
              if (max > 50) return 'High stream count may impact server performance';
              return true;
            }
          },
          bitrateLimit: {
            type: ValidationTypes.NUMBER,
            required: true,
            range: [100000, 10000000], // 100kbps to 10Mbps
            validate: (bitrate: number) => {
              if (bitrate < 500000) return 'Bitrate below 500kbps may result in poor quality';
              if (bitrate > 5000000) return 'Bitrate above 5Mbps may cause bandwidth issues';
              return true;
            }
          }
        }
      },
      distribution: {
        type: ValidationTypes.OBJECT,
        required: true,
        properties: {
          enabled: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          protocols: {
            type: ValidationTypes.ARRAY,
            required: true,
            validate: (protocols: string[]) => {
              const supportedProtocols = ['websocket', 'http', 'sse', 'mqtt', 'udp'];
              for (const protocol of protocols) {
                if (!supportedProtocols.includes(protocol)) {
                  return `Unsupported protocol: ${protocol}. Supported: ${supportedProtocols.join(', ')`;
                }
              }
              if (protocols.length === 0) {
                return 'At least one distribution protocol must be enabled';
              }
              return true;
            }
          },
          buffering: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          compression: {
            type: ValidationTypes.BOOLEAN,
            required: true
          }
        }
      }
    }
  }
});

/**
 * Features configuration factory with defaults
 */
export const createDefaultFeaturesConfig = () => ({
  faceAnalysis: {
    enabled: true,
    confidenceThreshold: 0.8,
    maxFaces: 5,
    realTimeProcessing: true,
    enableLandmarks: true
  },
  eyeTracking: {
    enabled: false,
    devices: ['tobii5'],
    calibrationRequired: true,
    gazeSmoothing: true,
    confidenceThreshold: 0.7
  },
  emotionAnalysis: {
    enabled: false,
    models: ['medium'],
    realTime: false
  },
  mediaStreaming: {
    enabled: true,
    webrtc: true,
    websocket: true,
    maxStreams: 10,
    bitrateLimit: 2000000
  },
  distribution: {
    enabled: true,
    protocols: ['websocket', 'http'],
    buffering: true,
    compression: true
  }
});
