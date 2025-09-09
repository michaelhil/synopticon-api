/**
 * @fileoverview Server configuration schema and validation
 * Defines validation rules for HTTP/WebSocket server settings
 */

import { ValidationTypes, SecurityRules } from '../validation-helpers.js';

/**
 * Server configuration validation schema
 */
export const createServerConfig = () => ({
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
  }
});

/**
 * Server configuration factory with defaults
 */
export const createDefaultServerConfig = () => ({
  port: 8081,
  host: 'localhost',
  enableHttps: false,
  cors: {
    enabled: true,
    origins: ['http://localhost:3000'],
    credentials: true
  },
  rateLimit: {
    enabled: true,
    maxRequests: 100,
    windowMs: 60000,
    skipSuccessfulRequests: false
  },
  compression: true,
  helmet: true
});
