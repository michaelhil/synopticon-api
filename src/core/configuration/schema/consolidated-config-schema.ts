/**
 * Consolidated Configuration Schema
 * Validation schema for all operational settings from scattered configuration files
 */

import { ValidationTypes } from '../validation-helpers.js'
import type { ConfigurationValidationSchema, ConfigurationValidationRule } from './extended-config-types.js';

/**
 * Create consolidated configuration validation schema
 */
export const createConsolidatedConfigSchema = (): ConfigurationValidationSchema => ({
  // Existing base schema (server, features, logging, security, performance, environment)
  // ... (keeping existing schema from unified-config-schema.ts)
  
  // Extended operational configurations
  pipeline: {
    type: ValidationTypes.OBJECT,
    required: true,
    properties: {
      // Base pipeline settings
      confidenceThreshold: {
        type: ValidationTypes.NUMBER,
        required: true,
        min: 0,
        max: 1,
        validate: (value: number) => value >= 0.1 && value <= 0.95 || 'Confidence threshold should be between 0.1 and 0.95'
      },
      smoothingFactor: {
        type: ValidationTypes.NUMBER,
        required: true,
        min: 0,
        max: 1
      },
      enableAdvancedFeatures: {
        type: ValidationTypes.BOOLEAN,
        required: true
      },
      debug: {
        type: ValidationTypes.BOOLEAN,
        required: true
      },
      maxRetries: {
        type: ValidationTypes.NUMBER,
        required: true,
        min: 1,
        max: 10
      },
      timeout: {
        type: ValidationTypes.NUMBER,
        required: true,
        min: 1000,
        max: 30000
      },
      enablePerformanceMetrics: {
        type: ValidationTypes.BOOLEAN,
        required: true
      },
      
      // Age estimation configuration (migrated from core pipeline config)
      ageEstimation: {
        type: ValidationTypes.OBJECT,
        required: true,
        properties: {
          inputSize: {
            type: ValidationTypes.ARRAY,
            required: true,
            validate: (value: number[]) => {
              if (!Array.isArray(value) || value.length !== 2) {
                return 'Input size must be an array of 2 numbers [width, height]';
              }
              if (value[0] < 32 || value[0] > 512 || value[1] < 32 || value[1] > 512) {
                return 'Input size dimensions must be between 32 and 512';
              }
              return true;
            }
          },
          enableGenderDetection: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          ageRangeMapping: {
            type: ValidationTypes.OBJECT,
            required: true,
            properties: {
              child: {
                type: ValidationTypes.ARRAY,
                required: true,
                validate: (value: number[]) => Array.isArray(value) && value.length === 2 && value[0] < value[1] || 'Age range must be [min, max] with min < max'
              },
              teen: {
                type: ValidationTypes.ARRAY,
                required: true,
                validate: (value: number[]) => Array.isArray(value) && value.length === 2 && value[0] < value[1] || 'Age range must be [min, max] with min < max'
              },
              adult: {
                type: ValidationTypes.ARRAY,
                required: true,
                validate: (value: number[]) => Array.isArray(value) && value.length === 2 && value[0] < value[1] || 'Age range must be [min, max] with min < max'
              },
              senior: {
                type: ValidationTypes.ARRAY,
                required: true,
                validate: (value: number[]) => Array.isArray(value) && value.length === 2 && value[0] < value[1] || 'Age range must be [min, max] with min < max'
              }
            }
          },
          modelUrl: {
            type: ValidationTypes.STRING,
            required: false,
            validate: (value: string | null) => {
              if (value && !value.startsWith('http')) {
                return 'Model URL must be a valid HTTP(S) URL';
              }
              return true;
            }
          },
          batchSize: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 1,
            max: 32
          }
        }
      },
      
      // Emotion analysis configuration (migrated from core pipeline config)
      emotionAnalysis: {
        type: ValidationTypes.OBJECT,
        required: true,
        properties: {
          inputSize: {
            type: ValidationTypes.ARRAY,
            required: true,
            validate: (value: number[]) => Array.isArray(value) && value.length === 2 || 'Input size must be [width, height]'
          },
          enableValenceArousal: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          modelUrl: {
            type: ValidationTypes.STRING,
            required: true,
            validate: (value: string) => value.startsWith('http') || 'Model URL must be a valid HTTP(S) URL'
          },
          batchSize: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 1,
            max: 32
          },
          emotionLabels: {
            type: ValidationTypes.ARRAY,
            required: true,
            validate: (value: string[]) => {
              if (!Array.isArray(value) || value.length === 0) {
                return 'Emotion labels must be a non-empty array';
              }
              const validLabels = ['angry', 'disgusted', 'fearful', 'happy', 'sad', 'surprised', 'neutral'];
              const invalidLabels = value.filter(label => !validLabels.includes(label));
              if (invalidLabels.length > 0) {
                return `Invalid emotion labels: ${invalidLabels.join(', ')}. Valid labels: ${validLabels.join(', ')}`;
              }
              return true;
            }
          },
          enableWebGL: {
            type: ValidationTypes.BOOLEAN,
            required: true
          }
        }
      },
      
      // MediaPipe Face Mesh configuration (migrated from core pipeline config)
      mediapipeFaceMesh: {
        type: ValidationTypes.OBJECT,
        required: true,
        properties: {
          maxNumFaces: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 1,
            max: 10
          },
          refineLandmarks: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          minDetectionConfidence: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 0,
            max: 1
          },
          minTrackingConfidence: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 0,
            max: 1
          },
          selfieMode: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          enableIris: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          staticImageMode: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          enable6DOF: {
            type: ValidationTypes.BOOLEAN,
            required: true
          }
        }
      },
      
      // MediaPipe Face configuration (migrated from core pipeline config)
      mediapipeFace: {
        type: ValidationTypes.OBJECT,
        required: true,
        properties: {
          modelSelection: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 0,
            max: 1
          },
          minDetectionConfidence: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 0,
            max: 1
          },
          maxFaces: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 1,
            max: 10
          },
          staticImageMode: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          enablePoseEstimation: {
            type: ValidationTypes.BOOLEAN,
            required: true
          }
        }
      },
      
      // Iris tracking configuration (migrated from core pipeline config)
      irisTracking: {
        type: ValidationTypes.OBJECT,
        required: true,
        properties: {
          maxNumFaces: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 1,
            max: 5
          },
          minDetectionConfidence: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 0,
            max: 1
          },
          minTrackingConfidence: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 0,
            max: 1
          },
          refineLandmarks: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          enableGazeEstimation: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          smoothingFactor: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 0,
            max: 1
          },
          enablePupilDilation: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          gazeCalibrationPoints: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 4,
            max: 25
          }
        }
      }
    }
  },
  
  // Audio/Speech Analysis Configuration
  speechAnalysis: {
    type: ValidationTypes.OBJECT,
    required: true,
    properties: {
      audio: {
        type: ValidationTypes.OBJECT,
        required: true,
        properties: {
          // AGC Configuration
          agc: {
            type: ValidationTypes.OBJECT,
            required: true,
            properties: {
              targetLevel: {
                type: ValidationTypes.NUMBER,
                required: true,
                min: -30,
                max: 0,
                validate: (value: number) => value >= -20 && value <= -6 || 'Target level should be between -20dB and -6dB for optimal results'
              },
              maxGain: {
                type: ValidationTypes.NUMBER,
                required: true,
                min: 0,
                max: 40
              },
              minGain: {
                type: ValidationTypes.NUMBER,
                required: true,
                min: -20,
                max: 0
              },
              attackTime: {
                type: ValidationTypes.NUMBER,
                required: true,
                min: 0.0001,
                max: 0.1
              },
              releaseTime: {
                type: ValidationTypes.NUMBER,
                required: true,
                min: 0.001,
                max: 1.0
              },
              sampleRate: {
                type: ValidationTypes.NUMBER,
                required: true,
                values: [8000, 16000, 22050, 44100, 48000],
                validate: (value: number) => [8000, 16000, 22050, 44100, 48000].includes(value) || 'Sample rate must be 8000, 16000, 22050, 44100, or 48000 Hz'
              }
            }
          },
          
          // VAD Configuration (migrated from vad-config.js)
          vad: {
            type: ValidationTypes.OBJECT,
            required: true,
            properties: {
              energyThreshold: {
                type: ValidationTypes.NUMBER,
                required: true,
                min: 0,
                max: 1
              },
              energyWeight: {
                type: ValidationTypes.NUMBER,
                required: true,
                min: 0,
                max: 1,
                validate: (value: number, path: string, config: any) => {
                  const totalWeight = (config?.speechAnalysis?.audio?.vad?.energyWeight || 0) + 
                                    (config?.speechAnalysis?.audio?.vad?.zcrWeight || 0) + 
                                    (config?.speechAnalysis?.audio?.vad?.entropyWeight || 0);
                  return Math.abs(totalWeight - 1.0) < 0.1 || 'VAD algorithm weights must sum to 1.0';
                }
              },
              zcrWeight: {
                type: ValidationTypes.NUMBER,
                required: true,
                min: 0,
                max: 1
              },
              entropyWeight: {
                type: ValidationTypes.NUMBER,
                required: true,
                min: 0,
                max: 1
              },
              frameSize: {
                type: ValidationTypes.NUMBER,
                required: true,
                validate: (value: number) => {
                  const validSizes = [256, 512, 1024, 2048];
                  return validSizes.includes(value) || `Frame size must be one of: ${validSizes.join(', ')`;
                }
              },
              smoothingWindow: {
                type: ValidationTypes.NUMBER,
                required: true,
                min: 1,
                max: 20
              },
              consensusThreshold: {
                type: ValidationTypes.NUMBER,
                required: true,
                min: 0,
                max: 1
              },
              hangoverFrames: {
                type: ValidationTypes.NUMBER,
                required: true,
                min: 1,
                max: 10
              }
            }
          },
          
          // Noise Reduction Configuration
          noiseReduction: {
            type: ValidationTypes.OBJECT,
            required: true,
            properties: {
              enableSpectralSubtraction: {
                type: ValidationTypes.BOOLEAN,
                required: true
              },
              spectralFloor: {
                type: ValidationTypes.NUMBER,
                required: true,
                min: 0.001,
                max: 0.1
              },
              windowType: {
                type: ValidationTypes.ENUM,
                required: true,
                values: ['hanning', 'hamming', 'blackman'],
                validate: (value: string) => ['hanning', 'hamming', 'blackman'].includes(value) || 'Window type must be hanning, hamming, or blackman'
              }
            }
          }
        }
      },
      
      // LLM Configuration
      llm: {
        type: ValidationTypes.OBJECT,
        required: true,
        properties: {
          provider: {
            type: ValidationTypes.ENUM,
            required: true,
            values: ['openai', 'anthropic', 'local'],
            validate: (value: string) => ['openai', 'anthropic', 'local'].includes(value) || 'Provider must be openai, anthropic, or local'
          },
          modelName: {
            type: ValidationTypes.STRING,
            required: true,
            minLength: 1
          },
          maxTokens: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 100,
            max: 32000
          },
          temperature: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 0,
            max: 2
          },
          timeout: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 5000,
            max: 120000
          }
        }
      }
    }
  },
  
  // Extended Rate Limiting Configuration
  rateLimit: {
    type: ValidationTypes.OBJECT,
    required: true,
    properties: {
      windowMs: {
        type: ValidationTypes.NUMBER,
        required: true,
        min: 1000,
        max: 3600000
      },
      maxRequests: {
        type: ValidationTypes.NUMBER,
        required: true,
        min: 1,
        max: 10000
      },
      algorithm: {
        type: ValidationTypes.ENUM,
        required: true,
        values: ['sliding-window', 'fixed-window', 'token-bucket'],
        validate: (value: string) => ['sliding-window', 'fixed-window', 'token-bucket'].includes(value) || 'Algorithm must be sliding-window, fixed-window, or token-bucket'
      },
      burstAllowance: {
        type: ValidationTypes.NUMBER,
        required: true,
        min: 0,
        max: 1,
        validate: (value: number) => value <= 0.5 || 'Burst allowance should not exceed 50% for stability'
      },
      enableMonitoring: {
        type: ValidationTypes.BOOLEAN,
        required: true
      },
      logViolations: {
        type: ValidationTypes.BOOLEAN,
        required: true
      }
    }
  },
  
  // Resource Pool Configuration
  resources: {
    type: ValidationTypes.OBJECT,
    required: true,
    properties: {
      memory: {
        type: ValidationTypes.OBJECT,
        required: true,
        properties: {
          maxPoolSize: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 10,
            max: 1000,
            validate: (value: number) => value <= 500 || 'Large memory pools may cause memory pressure'
          },
          initialSize: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 1,
            max: 100
          },
          growthFactor: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 1.1,
            max: 3.0
          },
          enableAutoGrowth: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          cleanupInterval: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 1000,
            max: 300000
          }
        }
      },
      
      webgl: {
        type: ValidationTypes.OBJECT,
        required: true,
        properties: {
          maxContexts: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 1,
            max: 10,
            validate: (value: number) => value <= 4 || 'High WebGL context count may exhaust GPU memory'
          },
          maxTextures: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 10,
            max: 1000
          },
          enableDebug: {
            type: ValidationTypes.BOOLEAN,
            required: true
          }
        }
      },
      
      canvas: {
        type: ValidationTypes.OBJECT,
        required: true,
        properties: {
          maxCanvases: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 5,
            max: 100
          },
          maxWidth: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 256,
            max: 4096
          },
          maxHeight: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 256,
            max: 4096
          }
        }
      }
    }
  },
  
  // MCP Configuration
  mcp: {
    type: ValidationTypes.OBJECT,
    required: true,
    properties: {
      server: {
        type: ValidationTypes.OBJECT,
        required: true,
        properties: {
          port: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 1024,
            max: 65535
          },
          maxConnections: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 1,
            max: 1000
          },
          timeout: {
            type: ValidationTypes.NUMBER,
            required: true,
            min: 1000,
            max: 60000
          }
        }
      },
      
      tools: {
        type: ValidationTypes.OBJECT,
        required: true,
        properties: {
          enabled: {
            type: ValidationTypes.ARRAY,
            required: true
          },
          rateLimit: {
            type: ValidationTypes.OBJECT,
            required: true,
            properties: {
              enabled: {
                type: ValidationTypes.BOOLEAN,
                required: true
              },
              maxRequestsPerMinute: {
                type: ValidationTypes.NUMBER,
                required: true,
                min: 1,
                max: 1000
              }
            }
          }
        }
      }
    }
  },
  
  // Cross-cutting defaults
  defaults: {
    type: ValidationTypes.OBJECT,
    required: true,
    properties: {
      timeout: {
        type: ValidationTypes.NUMBER,
        required: true,
        min: 1000,
        max: 30000
      },
      retryAttempts: {
        type: ValidationTypes.NUMBER,
        required: true,
        min: 0,
        max: 5
      },
      enableCaching: {
        type: ValidationTypes.BOOLEAN,
        required: true
      },
      cacheTimeout: {
        type: ValidationTypes.NUMBER,
        required: true,
        min: 1000,
        max: 3600000
      },
      enableMetrics: {
        type: ValidationTypes.BOOLEAN,
        required: true
      },
      enableHealthChecks: {
        type: ValidationTypes.BOOLEAN,
        required: true
      }
    }
  }
});