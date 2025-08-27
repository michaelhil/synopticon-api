/**
 * System Management API Path Definitions
 * OpenAPI path definitions for health checks and configuration endpoints
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
          description: 'Internal server error',
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
      summary: 'System Configuration',
      description: 'Returns system configuration including capabilities, strategies, endpoints, and feature flags.',
      operationId: 'getConfig',
      tags: ['System Management'],
      responses: {
        '200': {
          description: 'System configuration information',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ConfigResponse' }
            }
          }
        },
        '500': {
          description: 'Internal server error',
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