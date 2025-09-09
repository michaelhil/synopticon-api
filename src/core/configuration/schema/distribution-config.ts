/**
 * @fileoverview Distribution configuration schema and validation
 * Defines validation rules for data distribution and streaming settings
 */

import { ValidationTypes, SecurityRules } from '../validation-helpers.js';

/**
 * Distribution configuration validation schema
 */
export const createDistributionConfig = () => ({
  distribution: {
    type: ValidationTypes.OBJECT,
    required: false, // Distribution can be disabled
    properties: {
      protocols: {
        type: ValidationTypes.ARRAY,
        required: true,
        validate: (protocols: string[]) => {
          const supportedProtocols = ['websocket', 'http', 'sse', 'mqtt', 'udp'];
          const invalidProtocols = protocols.filter(p => !supportedProtocols.includes(p));
          
          if (invalidProtocols.length > 0) {
            return `Unsupported protocols: ${invalidProtocols.join(', '). Supported: ${supportedProtocols.join(', ')}`;
          }
          
          if (protocols.length === 0) {
            return 'At least one distribution protocol must be specified when distribution is enabled';
          }
          
          return true;
        }
      },
      bufferSize: {
        type: ValidationTypes.NUMBER,
        required: false,
        range: [1024, 1048576], // 1KB to 1MB
        validate: (size: number) => {
          if (size > 65536) return 'Large buffer sizes may increase memory usage';
          return true;
        }
      },
      maxConnections: {
        type: ValidationTypes.NUMBER,
        required: false,
        range: [1, 10000],
        validate: (max: number) => {
          if (max > 1000) return 'High connection limit may impact server performance';
          return true;
        }
      },
      compression: {
        type: ValidationTypes.OBJECT,
        required: false,
        properties: {
          enabled: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          algorithm: {
            type: ValidationTypes.ENUM,
            required: false,
            values: ['gzip', 'deflate', 'brotli'],
            validate: (algorithm: string) => {
              const supported = ['gzip', 'deflate', 'brotli'];
              if (!supported.includes(algorithm)) {
                return `Unsupported compression algorithm: ${algorithm}. Supported: ${supported.join(', ')`;
              }
              return true;
            }
          },
          level: {
            type: ValidationTypes.NUMBER,
            required: false,
            range: [1, 9],
            validate: (level: number) => {
              if (level > 6) return 'High compression levels may impact performance';
              return true;
            }
          }
        }
      },
      rateLimit: {
        type: ValidationTypes.OBJECT,
        required: false,
        properties: {
          enabled: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          messagesPerSecond: {
            type: ValidationTypes.NUMBER,
            required: false,
            range: [1, 10000],
            validate: (rate: number) => {
              if (rate > 1000) return 'High message rate may overwhelm clients';
              return true;
            }
          },
          burstSize: {
            type: ValidationTypes.NUMBER,
            required: false,
            range: [1, 1000],
            validate: (burst: number) => {
              if (burst > 100) return 'Large burst size may cause client buffering issues';
              return true;
            }
          }
        }
      },
      security: {
        type: ValidationTypes.OBJECT,
        required: false,
        properties: {
          enableAuth: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          allowedOrigins: {
            type: ValidationTypes.ARRAY,
            required: false,
            validate: (origins: string[]) => {
              for (const origin of origins) {
                if (typeof origin !== 'string') {
                  return 'All origins must be strings';
                }
                if (origin === '*') {
                  return 'Wildcard origin (*) is not recommended for production';
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
          enableEncryption: {
            type: ValidationTypes.BOOLEAN,
            required: false
          }
        }
      },
      monitoring: {
        type: ValidationTypes.OBJECT,
        required: false,
        properties: {
          enableMetrics: {
            type: ValidationTypes.BOOLEAN,
            required: true
          },
          metricsInterval: {
            type: ValidationTypes.NUMBER,
            required: false,
            range: [1000, 300000], // 1 second to 5 minutes
            validate: (interval: number) => {
              if (interval < 5000) return 'Very short metrics interval may impact performance';
              return true;
            }
          },
          enableHealthCheck: {
            type: ValidationTypes.BOOLEAN,
            required: false
          }
        }
      }
    }
  }
});

/**
 * Distribution configuration factory with defaults
 */
export const createDefaultDistributionConfig = () => ({
  protocols: ['websocket', 'http'],
  bufferSize: 8192,
  maxConnections: 100,
  compression: {
    enabled: true,
    algorithm: 'gzip' as const,
    level: 6
  },
  rateLimit: {
    enabled: true,
    messagesPerSecond: 100,
    burstSize: 10
  },
  security: {
    enableAuth: false,
    allowedOrigins: ['http://localhost:3000'],
    enableEncryption: false
  },
  monitoring: {
    enableMetrics: true,
    metricsInterval: 30000,
    enableHealthCheck: true
  }
});
