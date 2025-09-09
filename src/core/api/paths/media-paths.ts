/**
 * Media Streaming API Path Definitions
 * OpenAPI path definitions for distribution, streaming, and media management endpoints
 */

export const mediaPaths = {
  '/api/distribution/status': {
    get: {
      summary: 'Distribution System Status',
      description: 'Returns overall status of the distribution system including streams, clients, and data sources.',
      operationId: 'getDistributionStatus',
      tags: ['Distribution Management'],
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

  '/api/distribution/discovery': {
    get: {
      summary: 'Service Discovery',
      description: 'Returns service discovery information including capabilities, available distributors, and API endpoints.',
      operationId: 'getDiscoveryInfo',
      tags: ['Distribution Management'],
      responses: {
        '200': {
          description: 'Service discovery information',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DiscoveryResponse' }
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

  '/api/distribution/streams': {
    get: {
      summary: 'List All Streams',
      description: 'Returns a list of all active and inactive streams.',
      operationId: 'getStreams',
      tags: ['Stream Management'],
      responses: {
        '200': {
          description: 'List of streams',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StreamsResponse' }
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
    },
    post: {
      summary: 'Create New Stream',
      description: 'Creates a new data stream with specified configuration.',
      operationId: 'createStream',
      tags: ['Stream Management'],
      security: [
        { apiKey: [] },
        {}
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/StreamConfig' }
          }
        }
      },
      responses: {
        '200': {
          description: 'Stream created successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StreamCreationResponse' }
            }
          }
        },
        '400': {
          description: 'Bad request - invalid stream configuration',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
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

  '/api/distribution/streams/{id}': {
    get: {
      summary: 'Get Stream Status',
      description: 'Returns detailed information about a specific stream.',
      operationId: 'getStreamStatus',
      tags: ['Stream Management'],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: {
            type: 'string'
          },
          description: 'Stream ID'
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

  '/api/distribution/templates': {
    get: {
      summary: 'Get Configuration Templates',
      description: 'Returns available configuration templates for common use cases.',
      operationId: 'getTemplates',
      tags: ['Distribution Management'],
      responses: {
        '200': {
          description: 'Available templates',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TemplatesResponse' }
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
