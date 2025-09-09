/**
 * @fileoverview Analysis pipeline configuration schema and validation
 * Defines validation rules for ML/AI analysis pipeline settings
 */

import { ValidationTypes, SecurityRules } from '../validation-helpers.js';

/**
 * Analysis configuration validation schema
 */
export const createAnalysisConfig = () => ({
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

/**
 * Analysis configuration factory with defaults
 */
export const createDefaultAnalysisConfig = () => ({
  logging: {
    level: 'info' as const,
    enableConsole: true,
    enableFile: false,
    maxFileSize: '10mb',
    maxFiles: 5
  },
  security: {
    enableAuth: false,
    sessionTimeout: 3600000,
    maxLoginAttempts: 5,
    enableCsrf: true,
    contentSecurityPolicy: true
  },
  performance: {
    enableCaching: true,
    cacheMaxAge: 300000,
    maxConcurrentRequests: 50,
    requestTimeout: 30000,
    enableGzipCompression: true
  },
  environment: {
    type: 'development' as const,
    debug: true,
    telemetryEnabled: false,
    metricsEnabled: true
  }
});
