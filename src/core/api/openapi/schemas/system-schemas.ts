/**
 * System Management Schemas
 * Schemas for health, configuration, and system management endpoints
 */

export const systemSchemas = {
  HealthResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          status: { 
            type: 'string', 
            enum: ['healthy', 'degraded', 'critical'],
            example: 'healthy'
          },
          timestamp: { type: 'number' },
          uptime: { type: 'number', description: 'Server uptime in milliseconds' },
          version: { type: 'string', example: '0.6.0-beta.1' },
          services: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['up', 'down', 'degraded'] },
                lastCheck: { type: 'number' },
                responseTime: { type: 'number', nullable: true }
              }
            }
          },
          metrics: {
            type: 'object',
            properties: {
              requests: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  success: { type: 'number' },
                  errors: { type: 'number' },
                  averageResponseTime: { type: 'number' }
                }
              },
              memory: {
                type: 'object',
                properties: {
                  used: { type: 'number' },
                  total: { type: 'number' },
                  percentage: { type: 'number' }
                }
              },
              cpu: {
                type: 'object',
                properties: {
                  usage: { type: 'number' },
                  cores: { type: 'number' }
                }
              }
            }
          }
        }
      },
      timestamp: { type: 'number' }
    }
  },

  ConfigResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          version: { type: 'string' },
          environment: { type: 'string' },
          features: {
            type: 'object',
            additionalProperties: { type: 'boolean' }
          },
          limits: {
            type: 'object',
            properties: {
              maxConnections: { type: 'number' },
              requestTimeout: { type: 'number' },
              maxPayloadSize: { type: 'number' }
            }
          }
        }
      },
      timestamp: { type: 'number' }
    }
  }
};
