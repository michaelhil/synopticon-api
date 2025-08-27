/**
 * Common OpenAPI Schemas
 * Shared schema definitions used across all endpoints
 */

export const commonSchemas = {
  // Base response structures
  ErrorResponse: {
    type: 'object',
    required: ['success', 'error', 'timestamp'],
    properties: {
      success: {
        type: 'boolean',
        example: false,
        description: 'Indicates request failure'
      },
      error: {
        type: 'string',
        description: 'Error message describing what went wrong'
      },
      timestamp: {
        type: 'number',
        description: 'Unix timestamp when the error occurred'
      },
      details: {
        type: 'object',
        description: 'Additional error details (optional)'
      }
    }
  },

  SuccessResponse: {
    type: 'object',
    required: ['success', 'timestamp'],
    properties: {
      success: {
        type: 'boolean',
        example: true,
        description: 'Indicates request success'
      },
      data: {
        type: 'object',
        description: 'Response data (varies by endpoint)'
      },
      timestamp: {
        type: 'number',
        description: 'Unix timestamp when the response was generated'
      }
    }
  },

  // Health monitoring schemas
  HealthStatus: {
    type: 'string',
    enum: ['healthy', 'degraded', 'unhealthy'],
    description: 'Overall system health status'
  },

  ComponentHealth: {
    type: 'object',
    properties: {
      status: { $ref: '#/components/schemas/HealthStatus' },
      uptime: {
        type: 'number',
        description: 'Component uptime in milliseconds'
      },
      lastCheck: {
        type: 'number',
        description: 'Unix timestamp of last health check'
      },
      issues: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of current issues or warnings'
      }
    }
  },

  HealthResponse: {
    allOf: [
      { $ref: '#/components/schemas/SuccessResponse' },
      {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              status: { $ref: '#/components/schemas/HealthStatus' },
              timestamp: { type: 'number' },
              uptime: { type: 'number' },
              version: { type: 'string' },
              environment: { type: 'string' },
              components: {
                type: 'object',
                additionalProperties: { $ref: '#/components/schemas/ComponentHealth' }
              },
              metrics: {
                type: 'object',
                properties: {
                  requestCount: { type: 'number' },
                  errorRate: { type: 'number' },
                  averageResponseTime: { type: 'number' },
                  memoryUsage: {
                    type: 'object',
                    properties: {
                      used: { type: 'number' },
                      total: { type: 'number' },
                      percentage: { type: 'number' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    ]
  },

  // Configuration schemas
  ConfigResponse: {
    allOf: [
      { $ref: '#/components/schemas/SuccessResponse' },
      {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              version: { type: 'string' },
              capabilities: {
                type: 'object',
                properties: {
                  faceDetection: { type: 'boolean' },
                  emotionAnalysis: { type: 'boolean' },
                  ageEstimation: { type: 'boolean' },
                  distribution: { type: 'boolean' },
                  mediaStreaming: { type: 'boolean' }
                }
              },
              endpoints: {
                type: 'object',
                properties: {
                  websocket: { type: 'string' },
                  health: { type: 'string' },
                  documentation: { type: 'string' }
                }
              },
              limits: {
                type: 'object',
                properties: {
                  maxImageSize: { type: 'number' },
                  maxFrameRate: { type: 'number' },
                  maxConcurrentSessions: { type: 'number' }
                }
              }
            }
          }
        }
      }
    ]
  },

  // WebSocket schemas
  WebSocketMessage: {
    type: 'object',
    required: ['type'],
    properties: {
      type: {
        type: 'string',
        enum: ['frame', 'status', 'error', 'config'],
        description: 'Message type identifier'
      },
      data: {
        type: 'object',
        description: 'Message payload (varies by type)'
      },
      timestamp: {
        type: 'number',
        description: 'Unix timestamp when message was created'
      },
      sessionId: {
        type: 'string',
        description: 'WebSocket session identifier'
      }
    }
  },

  // Pagination schemas
  PaginationMeta: {
    type: 'object',
    properties: {
      page: {
        type: 'number',
        minimum: 1,
        description: 'Current page number'
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        description: 'Number of items per page'
      },
      total: {
        type: 'number',
        description: 'Total number of items'
      },
      totalPages: {
        type: 'number',
        description: 'Total number of pages'
      }
    }
  },

  PaginatedResponse: {
    allOf: [
      { $ref: '#/components/schemas/SuccessResponse' },
      {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                description: 'Array of items for current page'
              },
              pagination: { $ref: '#/components/schemas/PaginationMeta' }
            }
          }
        }
      }
    ]
  }
};