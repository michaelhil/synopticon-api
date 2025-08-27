/**
 * Distribution System Schemas
 * Data models for distribution, streaming, and template management
 */

export const distributionSchemas = {
  DistributionStatusResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['running', 'stopped', 'error'] },
          distributors: {
            type: 'array',
            items: { $ref: '#/components/schemas/DistributorStatus' }
          },
          statistics: {
            type: 'object',
            properties: {
              totalMessages: { type: 'number' },
              successfulDeliveries: { type: 'number' },
              failedDeliveries: { type: 'number' },
              activeConnections: { type: 'number' }
            }
          },
          uptime: { type: 'number' }
        }
      },
      timestamp: { type: 'number' }
    }
  },

  DistributorStatus: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['http', 'websocket', 'mqtt', 'udp', 'sse'] },
      name: { type: 'string' },
      status: { type: 'string', enum: ['active', 'inactive', 'error'] },
      health: {
        type: 'object',
        properties: {
          healthy: { type: 'boolean' },
          lastCheck: { type: 'number' },
          responseTime: { type: 'number', nullable: true },
          errorMessage: { type: 'string', nullable: true }
        }
      },
      statistics: {
        type: 'object',
        properties: {
          messagesSent: { type: 'number' },
          messagesReceived: { type: 'number' },
          errors: { type: 'number' },
          connections: { type: 'number' }
        }
      },
      config: { type: 'object' }
    },
    required: ['type', 'name', 'status']
  },

  DiscoveryResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          services: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string' },
                host: { type: 'string' },
                port: { type: 'number' },
                protocol: { type: 'string' },
                status: { type: 'string', enum: ['available', 'unavailable'] },
                metadata: { type: 'object' }
              }
            }
          },
          discoveredAt: { type: 'number' }
        }
      },
      timestamp: { type: 'number' }
    }
  },

  StreamsResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          streams: {
            type: 'array',
            items: { $ref: '#/components/schemas/StreamInfo' }
          },
          totalCount: { type: 'number' },
          activeCount: { type: 'number' }
        }
      },
      timestamp: { type: 'number' }
    }
  },

  StreamInfo: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      type: { type: 'string', enum: ['video', 'audio', 'data', 'mixed'] },
      status: { type: 'string', enum: ['active', 'inactive', 'paused', 'error'] },
      source: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          url: { type: 'string' },
          device: { type: 'string' }
        }
      },
      destination: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          url: { type: 'string' },
          protocol: { type: 'string' }
        }
      },
      quality: {
        type: 'object',
        properties: {
          resolution: { type: 'string' },
          framerate: { type: 'number' },
          bitrate: { type: 'number' },
          format: { type: 'string' }
        }
      },
      statistics: {
        type: 'object',
        properties: {
          duration: { type: 'number' },
          bytesTransferred: { type: 'number' },
          frameCount: { type: 'number' },
          dropCount: { type: 'number' },
          averageLatency: { type: 'number' }
        }
      },
      createdAt: { type: 'number' },
      lastActivity: { type: 'number' }
    },
    required: ['id', 'name', 'type', 'status']
  },

  StreamInfoResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        allOf: [
          { $ref: '#/components/schemas/StreamInfo' },
          {
            type: 'object',
            properties: {
              session_status: { type: 'object', nullable: true }
            }
          }
        ]
      },
      timestamp: { type: 'number' }
    }
  },

  TemplatesResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            config: { type: 'object' },
            metadata: {
              type: 'object',
              properties: {
                author: { type: 'string' },
                version: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
                complexity: { type: 'string', enum: ['basic', 'intermediate', 'advanced'] }
              }
            },
            createdAt: { type: 'number' },
            updatedAt: { type: 'number' }
          },
          required: ['id', 'name', 'config']
        }
      },
      timestamp: { type: 'number' }
    }
  }
};