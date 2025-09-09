/**
 * System Management API Paths
 * Health check, configuration, and system management endpoints
 */

export const systemPaths = {
  '/api/health': {
    get: {
      summary: 'System Health Check',
      description: 'Returns comprehensive system health information including service status, metrics, and performance data.',
      operationId: 'getHealth',
      tags: ['System Management'],
      responses: {
        '200': {
          description: 'System health information',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/HealthResponse' }
            }
          }
        },
        '500': {
          description: 'System error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      }
    }
  },

  '/api/config': {
    get: {
      summary: 'Get System Configuration',
      description: 'Returns current system configuration and feature flags.',
      operationId: 'getConfig',
      tags: ['System Management'],
      responses: {
        '200': {
          description: 'System configuration',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ConfigResponse' }
            }
          }
        },
        '500': {
          description: 'Configuration error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      }
    }
  }
};
