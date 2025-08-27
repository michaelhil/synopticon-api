/**
 * Common Response Schemas for OpenAPI
 * Reusable response schemas used across all API domains
 */

export const commonResponseSchemas = {
  ApiResponse: {
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

  ValidationErrorResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      error: { type: 'string' },
      details: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            message: { type: 'string' },
            code: { type: 'string' }
          }
        }
      },
      timestamp: { type: 'number' }
    },
    required: ['success', 'error', 'timestamp']
  }
};