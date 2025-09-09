/**
 * System Management OpenAPI Schema Definitions
 * Schemas for health checks, configuration, and system management endpoints
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
            additionalProperties: { $ref: '#/components/schemas/ServiceStatus' }
          },
          metrics: { $ref: '#/components/schemas/Metrics' }
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
          capabilities: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['face_detection', 'pose_3dof', 'pose_6dof', 'eye_tracking', 'expression', 'landmarks', 'age_estimation', 'gender_detection']
            }
          },
          strategies: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['accuracy_first', 'performance_first', 'balanced']
            }
          },
          endpoints: {
            type: 'object',
            additionalProperties: { type: 'string' }
          },
          features: {
            type: 'object',
            properties: {
              analysis: { type: 'boolean' },
              distribution: { type: 'boolean' },
              monitoring: { type: 'boolean' },
              websocket: { type: 'boolean' }
            }
          }
        }
      },
      timestamp: { type: 'number' }
    }
  }
};
