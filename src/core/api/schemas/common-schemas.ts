/**
 * Common OpenAPI Schema Definitions
 * Shared schemas used across all API endpoints
 */

export const commonSchemas = {
  BaseResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: { type: 'object', nullable: true },
      error: { type: 'string', nullable: true },
      timestamp: { type: 'number' }
    },
    required: ['success', 'timestamp']
  },

  ErrorResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      error: { type: 'string' },
      timestamp: { type: 'number' }
    },
    required: ['success', 'error', 'timestamp']
  },

  PaginationMeta: {
    type: 'object',
    properties: {
      page: { type: 'number', minimum: 1 },
      limit: { type: 'number', minimum: 1, maximum: 100 },
      total: { type: 'number', minimum: 0 },
      totalPages: { type: 'number', minimum: 0 }
    },
    required: ['page', 'limit', 'total', 'totalPages']
  },

  ServiceStatus: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['up', 'down', 'degraded'] },
      lastCheck: { type: 'number' },
      responseTime: { type: 'number', nullable: true }
    }
  },

  Metrics: {
    type: 'object',
    properties: {
      requests: {
        type: 'object',
        properties: {
          total: { type: 'number' },
          success: { type: 'number' },
          errors: { type: 'number' }
        }
      },
      memory: {
        type: 'object',
        properties: {
          used: { type: 'number' },
          total: { type: 'number' },
          percentage: { type: 'number' }
        }
      }
    }
  }
};
