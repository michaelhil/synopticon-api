/**
 * @fileoverview Unified configuration validation schema
 * Creates a single validation schema that matches SynopticonConfig structure
 */

import { ValidationTypes, SecurityRules } from '../validation-helpers.js';

/**
 * Create unified configuration validation schema that matches SynopticonConfig interface
 */
export const createUnifiedConfigSchema = () => ({
  server: {
    type: ValidationTypes.OBJECT,
    required: true,
    properties: {
      port: {
        type: ValidationTypes.NUMBER,
        required: true,
        range: [1024, 65535],
        validate: (port: number) => {
          if (port < 1024) return 'Port must be >= 1024 (reserved ports)';
          if (port > 65535) return 'Port must be <= 65535';
          return true;
        }
      },
      host: {
        type: ValidationTypes.STRING,
        required: true,
        security: [SecurityRules.TRUSTED_HOST],
        validate: (host: string) => {
          const validHosts = ['localhost', '0.0.0.0', '127.0.0.1'];
          const isValidIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
          const isValidHostname = /^[a-zA-Z0-9.-]+$/.test(host);
          
          if (!validHosts.includes(host) && !isValidIP && !isValidHostname) {
            return 'Invalid host format';
          }
          return true;
        }
      },
      enableHttps: {
        type: ValidationTypes.BOOLEAN,
        required: true
      },
      cors: {
        type: ValidationTypes.OBJECT,
        required: true,
        properties: {
          enabled: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          origins: {
            type: ValidationTypes.ARRAY,
            required: true,
            validate: (origins: string[]) => {
              for (const origin of origins) {
                if (typeof origin !== 'string') {
                  return 'All origins must be strings';
                }
                if (origin === '*') {
                  return 'Wildcard CORS (*) is not recommended for security';
                }
                try {
                  new URL(origin);
                } catch {
                  return `Invalid origin URL: ${origin}`;
                }
              }
              return true;
            }
          },
          credentials: {
            type: ValidationTypes.BOOLEAN,
            required: true
          }
        }
      },
      rateLimit: {
        type: ValidationTypes.OBJECT,
        required: true,
        properties: {
          enabled: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          maxRequests: {
            type: ValidationTypes.NUMBER,
            required: true,
            range: [1, 10000],
            validate: (max: number) => {
              if (max < 10) return 'Rate limit should be at least 10 requests';
              return true;
            }
          },
          windowMs: {
            type: ValidationTypes.NUMBER,
            required: true,
            range: [1000, 3600000], // 1 second to 1 hour
            validate: (window: number) => {
              if (window < 60000) return 'Rate limit window should be at least 1 minute';
              return true;
            }
          },
          skipSuccessfulRequests: {
            type: ValidationTypes.BOOLEAN,
            required: true
          }
        }
      },
      compression: {
        type: ValidationTypes.BOOLEAN,
        required: true
      },
      helmet: {
        type: ValidationTypes.BOOLEAN,
        required: true
      }
    }
  },
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
  },
  logging: {
    type: ValidationTypes.OBJECT,
    required: true,
    properties: {
      level: {
        type: ValidationTypes.ENUM,
        required: true,
        values: ['error', 'warn', 'info', 'debug', 'verbose'],
        validate: (level: string) => {
          const validLevels = ['error', 'warn', 'info', 'debug', 'verbose'];
          if (!validLevels.includes(level)) {
            return `Invalid log level: ${level}. Valid levels: ${validLevels.join(', ')`;
          }
          return true;
        }
      },
      enableConsole: {
        type: ValidationTypes.BOOLEAN,
        required: true
      },
      enableFile: {
        type: ValidationTypes.BOOLEAN,
        required: true
      },
      maxFileSize: {
        type: ValidationTypes.STRING,
        required: true,
        validate: (size: string) => {
          const validPattern = /^\d+[kmg]b$/i;
          if (!validPattern.test(size)) {
            return 'File size must be in format: 10mb, 1gb, 500kb';
          }
          return true;
        }
      },
      maxFiles: {
        type: ValidationTypes.NUMBER,
        required: true,
        range: [1, 100],
        validate: (max: number) => {
          if (max > 20) return 'High log file count may consume significant disk space';
          return true;
        }
      }
    }
  },
  security: {
    type: ValidationTypes.OBJECT,
    required: true,
    properties: {
      enableAuth: {
        type: ValidationTypes.BOOLEAN,
        required: true
      },
      sessionTimeout: {
        type: ValidationTypes.NUMBER,
        required: true,
        range: [300000, 86400000], // 5 minutes to 24 hours
        validate: (timeout: number) => {
          if (timeout < 900000) return 'Session timeout should be at least 15 minutes';
          return true;
        }
      },
      maxLoginAttempts: {
        type: ValidationTypes.NUMBER,
        required: true,
        range: [1, 20],
        validate: (max: number) => {
          if (max < 3) return 'Minimum 3 login attempts recommended for usability';
          if (max > 10) return 'High login attempt limit may aid brute force attacks';
          return true;
        }
      },
      enableCsrf: {
        type: ValidationTypes.BOOLEAN,
        required: true
      },
      contentSecurityPolicy: {
        type: ValidationTypes.BOOLEAN,
        required: true
      }
    }
  },
  performance: {
    type: ValidationTypes.OBJECT,
    required: true,
    properties: {
      enableCaching: {
        type: ValidationTypes.BOOLEAN,
        required: true
      },
      cacheMaxAge: {
        type: ValidationTypes.NUMBER,
        required: true,
        range: [1000, 3600000], // 1 second to 1 hour
        validate: (age: number) => {
          if (age < 30000) return 'Very short cache age may reduce performance benefits';
          return true;
        }
      },
      maxConcurrentRequests: {
        type: ValidationTypes.NUMBER,
        required: true,
        range: [1, 1000],
        validate: (max: number) => {
          if (max > 200) return 'High concurrent request limit may overwhelm server';
          return true;
        }
      },
      requestTimeout: {
        type: ValidationTypes.NUMBER,
        required: true,
        range: [1000, 300000], // 1 second to 5 minutes
        validate: (timeout: number) => {
          if (timeout < 5000) return 'Very short request timeout may cause frequent failures';
          return true;
        }
      },
      enableGzipCompression: {
        type: ValidationTypes.BOOLEAN,
        required: true
      }
    }
  },
  environment: {
    type: ValidationTypes.OBJECT,
    required: true,
    properties: {
      type: {
        type: ValidationTypes.ENUM,
        required: true,
        values: ['development', 'staging', 'production'],
        validate: (type: string) => {
          const validTypes = ['development', 'staging', 'production'];
          if (!validTypes.includes(type)) {
            return `Invalid environment type: ${type}. Valid types: ${validTypes.join(', ')`;
          }
          return true;
        }
      },
      debug: {
        type: ValidationTypes.BOOLEAN,
        required: true,
        validate: (debug: boolean, path: string, config: any) => {
          if (debug && config?.environment?.type === 'production') {
            return 'Debug mode should not be enabled in production';
          }
          return true;
        }
      },
      telemetryEnabled: {
        type: ValidationTypes.BOOLEAN,
        required: true
      },
      metricsEnabled: {
        type: ValidationTypes.BOOLEAN,
        required: true
      }
    }
  }
});
