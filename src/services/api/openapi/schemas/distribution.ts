/**
 * Distribution System OpenAPI Schemas
 * Schema definitions for multi-protocol streaming and distribution endpoints
 */

export const distributionSchemas = {
  // Stream configuration schemas
  StreamType: {
    type: 'string',
    enum: ['websocket', 'sse', 'mqtt', 'udp', 'media'],
    description: 'Type of distribution stream'
  },

  StreamStatus: {
    type: 'string',
    enum: ['active', 'paused', 'stopped', 'error'],
    description: 'Current status of distribution stream'
  },

  StreamConfig: {
    type: 'object',
    required: ['type', 'destination', 'source'],
    properties: {
      type: { $ref: '#/components/schemas/StreamType' },
      destination: {
        type: 'string',
        description: 'Target destination for the stream (URL, topic, etc.)'
      },
      source: {
        type: 'string',
        description: 'Source identifier for the data stream'
      },
      format: {
        type: 'string',
        enum: ['json', 'binary', 'image', 'video'],
        default: 'json',
        description: 'Data format for the stream'
      },
      quality: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        default: 'medium',
        description: 'Stream quality level'
      },
      compression: {
        type: 'boolean',
        default: false,
        description: 'Enable compression for the stream'
      },
      metadata: {
        type: 'object',
        description: 'Additional stream-specific configuration'
      }
    }
  },

  CreateStreamRequest: {
    type: 'object',
    required: ['config'],
    properties: {
      config: { $ref: '#/components/schemas/StreamConfig' }
    }
  },

  StreamInfo: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Unique stream identifier'
      },
      config: { $ref: '#/components/schemas/StreamConfig' },
      status: { $ref: '#/components/schemas/StreamStatus' },
      created_at: {
        type: 'number',
        description: 'Unix timestamp when stream was created'
      },
      updated_at: {
        type: 'number',
        description: 'Unix timestamp when stream was last updated'
      },
      statistics: {
        type: 'object',
        properties: {
          messagesSent: { type: 'number' },
          bytesTransferred: { type: 'number' },
          errorCount: { type: 'number' },
          lastMessageTime: { type: 'number' },
          averageLatency: { type: 'number' }
        }
      }
    }
  },

  CreateStreamResponse: {
    allOf: [
      { $ref: '#/components/schemas/SuccessResponse' },
      {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              stream: { $ref: '#/components/schemas/StreamInfo' },
              connectionInfo: {
                type: 'object',
                properties: {
                  endpoint: { type: 'string' },
                  protocol: { type: 'string' },
                  credentials: { type: 'object' }
                }
              }
            }
          }
        }
      }
    ]
  },

  StreamListResponse: {
    allOf: [
      { $ref: '#/components/schemas/PaginatedResponse' },
      {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/StreamInfo' }
              }
            }
          }
        }
      }
    ]
  },

  StreamStatusResponse: {
    allOf: [
      { $ref: '#/components/schemas/SuccessResponse' },
      {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              streams: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  active: { type: 'number' },
                  stopped: { type: 'number' }
                }
              },
              clients: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  active: { type: 'number' }
                }
              },
              performance: {
                type: 'object',
                properties: {
                  totalThroughput: { type: 'number' },
                  averageLatency: { type: 'number' },
                  errorRate: { type: 'number' }
                }
              }
            }
          }
        }
      }
    ]
  },

  // Client management schemas
  ClientInfo: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Unique client identifier'
      },
      connected_at: {
        type: 'number',
        description: 'Unix timestamp when client connected'
      },
      last_seen: {
        type: 'number',
        description: 'Unix timestamp of last activity'
      },
      subscriptions: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of stream IDs client is subscribed to'
      },
      statistics: {
        type: 'object',
        properties: {
          messagesReceived: { type: 'number' },
          bytesReceived: { type: 'number' },
          connectionDuration: { type: 'number' }
        }
      },
      metadata: {
        type: 'object',
        description: 'Client-specific metadata'
      }
    }
  },

  ClientListResponse: {
    allOf: [
      { $ref: '#/components/schemas/PaginatedResponse' },
      {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/ClientInfo' }
              }
            }
          }
        }
      }
    ]
  },

  // Distribution preset schemas
  PresetInfo: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      config: { $ref: '#/components/schemas/StreamConfig' },
      tags: {
        type: 'array',
        items: { type: 'string' }
      },
      isDefault: { type: 'boolean' }
    }
  },

  PresetListResponse: {
    allOf: [
      { $ref: '#/components/schemas/SuccessResponse' },
      {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              presets: {
                type: 'array',
                items: { $ref: '#/components/schemas/PresetInfo' }
              }
            }
          }
        }
      }
    ]
  },

  // Stream control schemas
  StreamControlRequest: {
    type: 'object',
    required: ['action'],
    properties: {
      action: {
        type: 'string',
        enum: ['start', 'stop', 'pause', 'resume'],
        description: 'Control action to perform on stream'
      },
      config: {
        type: 'object',
        description: 'Updated configuration (optional)'
      }
    }
  }
};