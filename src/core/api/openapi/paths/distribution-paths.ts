/**
 * Distribution System API Paths
 * Endpoints for distribution status, discovery, streaming, and templates
 */

export const distributionPaths = {
  '/api/distribution/status': {
    get: {
      summary: 'Get Distribution System Status',
      description: 'Returns current status of all distribution components including health metrics and statistics.',
      operationId: 'getDistributionStatus',
      tags: ['Distribution System'],
      responses: {
        '200': {
          description: 'Distribution system status',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DistributionStatusResponse' }
            }
          }
        },
        '500': {
          description: 'Distribution system error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      }
    }
  },

  '/api/distribution/discovery': {
    get: {
      summary: 'Discover Available Services',
      description: 'Discovers and returns information about available distribution services and endpoints.',
      operationId: 'discoverServices',
      tags: ['Distribution System'],
      parameters: [
        {
          name: 'timeout',
          in: 'query',
          description: 'Discovery timeout in milliseconds',
          required: false,
          schema: { type: 'number', default: 5000, minimum: 1000, maximum: 30000 }
        },
        {
          name: 'protocol',
          in: 'query',
          description: 'Filter by protocol type',
          required: false,
          schema: { type: 'string', enum: ['http', 'websocket', 'mqtt', 'udp'] }
        }
      ],
      responses: {
        '200': {
          description: 'Service discovery results',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DiscoveryResponse' }
            }
          }
        },
        '408': {
          description: 'Discovery timeout',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      }
    }
  },

  '/api/distribution/streams': {
    get: {
      summary: 'List Active Streams',
      description: 'Returns information about all active data streams in the distribution system.',
      operationId: 'listStreams',
      tags: ['Distribution System'],
      parameters: [
        {
          name: 'type',
          in: 'query',
          description: 'Filter streams by type',
          required: false,
          schema: { type: 'string', enum: ['video', 'audio', 'data', 'mixed'] }
        },
        {
          name: 'status',
          in: 'query',
          description: 'Filter streams by status',
          required: false,
          schema: { type: 'string', enum: ['active', 'inactive', 'paused', 'error'] }
        }
      ],
      responses: {
        '200': {
          description: 'List of streams',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StreamsResponse' }
            }
          }
        }
      }
    }
  },

  '/api/distribution/streams/{id}': {
    get: {
      summary: 'Get Stream Information',
      description: 'Returns detailed information about a specific stream including performance metrics.',
      operationId: 'getStream',
      tags: ['Distribution System'],
      parameters: [
        {
          name: 'id',
          in: 'path',
          description: 'Stream identifier',
          required: true,
          schema: { type: 'string' }
        },
        {
          name: 'include_session',
          in: 'query',
          description: 'Include session status information',
          required: false,
          schema: { type: 'boolean', default: false }
        }
      ],
      responses: {
        '200': {
          description: 'Stream information',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StreamInfoResponse' }
            }
          }
        },
        '404': {
          description: 'Stream not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      }
    },

    delete: {
      summary: 'Stop Stream',
      description: 'Stops and removes a specific stream from the distribution system.',
      operationId: 'stopStream',
      tags: ['Distribution System'],
      parameters: [
        {
          name: 'id',
          in: 'path',
          description: 'Stream identifier',
          required: true,
          schema: { type: 'string' }
        }
      ],
      responses: {
        '200': {
          description: 'Stream stopped successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiResponse' }
            }
          }
        },
        '404': {
          description: 'Stream not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      },
      security: [
        { apiKey: [] }
      ]
    }
  },

  '/api/distribution/templates': {
    get: {
      summary: 'List Distribution Templates',
      description: 'Returns available distribution configuration templates for common use cases.',
      operationId: 'listTemplates',
      tags: ['Distribution System'],
      parameters: [
        {
          name: 'category',
          in: 'query',
          description: 'Filter templates by category',
          required: false,
          schema: { type: 'string' }
        },
        {
          name: 'complexity',
          in: 'query',
          description: 'Filter templates by complexity level',
          required: false,
          schema: { type: 'string', enum: ['basic', 'intermediate', 'advanced'] }
        }
      ],
      responses: {
        '200': {
          description: 'List of templates',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TemplatesResponse' }
            }
          }
        }
      }
    }
  }
};
