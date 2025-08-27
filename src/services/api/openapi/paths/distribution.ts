/**
 * Distribution API Paths
 * OpenAPI path definitions for multi-protocol streaming and distribution
 */

export const distributionPaths = {
  '/api/distribution/streams': {
    get: {
      summary: 'List Distribution Streams',
      description: 'Get list of all distribution streams with their current status and statistics.',
      operationId: 'listStreams',
      tags: ['Distribution'],
      security: [
        { apiKey: [] }
      ],
      parameters: [
        {
          name: 'page',
          in: 'query',
          description: 'Page number for pagination',
          required: false,
          schema: {
            type: 'number',
            minimum: 1,
            default: 1
          }
        },
        {
          name: 'limit',
          in: 'query',
          description: 'Number of items per page',
          required: false,
          schema: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 20
          }
        },
        {
          name: 'status',
          in: 'query',
          description: 'Filter by stream status',
          required: false,
          schema: { $ref: '#/components/schemas/StreamStatus' }
        },
        {
          name: 'type',
          in: 'query',
          description: 'Filter by stream type',
          required: false,
          schema: { $ref: '#/components/schemas/StreamType' }
        }
      ],
      responses: {
        '200': {
          description: 'List of distribution streams',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StreamListResponse' }
            }
          }
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      }
    },
    post: {
      summary: 'Create Distribution Stream',
      description: 'Create a new distribution stream with specified configuration.',
      operationId: 'createStream',
      tags: ['Distribution'],
      security: [
        { apiKey: [] }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateStreamRequest' }
          }
        }
      },
      responses: {
        '201': {
          description: 'Stream created successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateStreamResponse' }
            }
          }
        },
        '400': {
          description: 'Invalid stream configuration',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        },
        '409': {
          description: 'Stream with same destination already exists',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      }
    }
  },

  '/api/distribution/streams/{streamId}': {
    get: {
      summary: 'Get Stream Information',
      description: 'Get detailed information about a specific distribution stream.',
      operationId: 'getStream',
      tags: ['Distribution'],
      security: [
        { apiKey: [] }
      ],
      parameters: [
        {
          name: 'streamId',
          in: 'path',
          description: 'Stream identifier',
          required: true,
          schema: { type: 'string' }
        }
      ],
      responses: {
        '200': {
          description: 'Stream information',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/SuccessResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          stream: { $ref: '#/components/schemas/StreamInfo' }
                        }
                      }
                    }
                  }
                ]
              }
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
    put: {
      summary: 'Update Stream Configuration',
      description: 'Update configuration of an existing distribution stream.',
      operationId: 'updateStream',
      tags: ['Distribution'],
      security: [
        { apiKey: [] }
      ],
      parameters: [
        {
          name: 'streamId',
          in: 'path',
          description: 'Stream identifier',
          required: true,
          schema: { type: 'string' }
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                config: { $ref: '#/components/schemas/StreamConfig' }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Stream updated successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateStreamResponse' }
            }
          }
        },
        '404': {
          description: 'Stream not found'
        },
        '400': {
          description: 'Invalid configuration'
        }
      }
    },
    delete: {
      summary: 'Delete Distribution Stream',
      description: 'Stop and delete a distribution stream.',
      operationId: 'deleteStream',
      tags: ['Distribution'],
      security: [
        { apiKey: [] }
      ],
      parameters: [
        {
          name: 'streamId',
          in: 'path',
          description: 'Stream identifier',
          required: true,
          schema: { type: 'string' }
        }
      ],
      responses: {
        '200': {
          description: 'Stream deleted successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SuccessResponse' }
            }
          }
        },
        '404': {
          description: 'Stream not found'
        }
      }
    }
  },

  '/api/distribution/streams/{streamId}/control': {
    post: {
      summary: 'Control Distribution Stream',
      description: 'Control stream operations (start, stop, pause, resume).',
      operationId: 'controlStream',
      tags: ['Distribution'],
      security: [
        { apiKey: [] }
      ],
      parameters: [
        {
          name: 'streamId',
          in: 'path',
          description: 'Stream identifier',
          required: true,
          schema: { type: 'string' }
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/StreamControlRequest' }
          }
        }
      },
      responses: {
        '200': {
          description: 'Control action executed successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SuccessResponse' }
            }
          }
        },
        '404': {
          description: 'Stream not found'
        },
        '409': {
          description: 'Invalid state transition'
        }
      }
    }
  },

  '/api/distribution/status': {
    get: {
      summary: 'Distribution System Status',
      description: 'Get overall status and statistics of the distribution system.',
      operationId: 'getDistributionStatus',
      tags: ['Distribution'],
      security: [
        { apiKey: [] }
      ],
      responses: {
        '200': {
          description: 'Distribution system status',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StreamStatusResponse' }
            }
          }
        }
      }
    }
  },

  '/api/distribution/clients': {
    get: {
      summary: 'List Distribution Clients',
      description: 'Get list of connected distribution clients.',
      operationId: 'listClients',
      tags: ['Distribution'],
      security: [
        { apiKey: [] }
      ],
      parameters: [
        {
          name: 'page',
          in: 'query',
          description: 'Page number for pagination',
          required: false,
          schema: {
            type: 'number',
            minimum: 1,
            default: 1
          }
        },
        {
          name: 'limit',
          in: 'query',
          description: 'Number of items per page',
          required: false,
          schema: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 20
          }
        },
        {
          name: 'active',
          in: 'query',
          description: 'Filter by client activity',
          required: false,
          schema: { type: 'boolean' }
        }
      ],
      responses: {
        '200': {
          description: 'List of distribution clients',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ClientListResponse' }
            }
          }
        }
      }
    }
  },

  '/api/distribution/presets': {
    get: {
      summary: 'List Distribution Presets',
      description: 'Get available distribution configuration presets.',
      operationId: 'listPresets',
      tags: ['Distribution'],
      responses: {
        '200': {
          description: 'Available distribution presets',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PresetListResponse' }
            }
          }
        }
      }
    }
  },

  '/api/distribution/presets/{presetId}/apply': {
    post: {
      summary: 'Apply Distribution Preset',
      description: 'Create a new stream using a predefined preset configuration.',
      operationId: 'applyPreset',
      tags: ['Distribution'],
      security: [
        { apiKey: [] }
      ],
      parameters: [
        {
          name: 'presetId',
          in: 'path',
          description: 'Preset identifier',
          required: true,
          schema: { type: 'string' }
        }
      ],
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                overrides: {
                  type: 'object',
                  description: 'Configuration overrides for the preset'
                },
                destination: {
                  type: 'string',
                  description: 'Override destination URL/endpoint'
                }
              }
            }
          }
        }
      },
      responses: {
        '201': {
          description: 'Stream created from preset',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateStreamResponse' }
            }
          }
        },
        '404': {
          description: 'Preset not found'
        }
      }
    }
  }
};