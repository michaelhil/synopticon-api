/**
 * Media Streaming OpenAPI Schema Definitions
 * Schemas for streaming, distribution, and media management endpoints
 */

export const mediaSchemas = {
  StreamConfig: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['udp', 'mqtt', 'websocket', 'http', 'sse']
      },
      destination: {
        type: 'object',
        properties: {
          host: { type: 'string' },
          port: { type: 'number' },
          path: { type: 'string', nullable: true }
        },
        required: ['host', 'port']
      },
      source: {
        type: 'string',
        enum: ['eye_tracking', 'face_analysis', 'speech_analysis', 'emotion_analysis', 'age_estimation']
      },
      distributors: {
        type: 'array',
        items: { type: 'string' }
      },
      filter: {
        type: 'object',
        properties: {
          sampleRate: { type: 'number', nullable: true },
          includeMetadata: { type: 'boolean', nullable: true }
        }
      },
      clientId: { type: 'string', nullable: true },
      metadata: { type: 'object', nullable: true }
    },
    required: ['type', 'destination', 'source', 'distributors']
  },

  DistributionStatusResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          timestamp: { type: 'number' },
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
          data_sources: { type: 'object' }
        }
      },
      timestamp: { type: 'number' }
    }
  },

  DiscoveryResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          service: { type: 'string' },
          version: { type: 'string' },
          capabilities: {
            type: 'array',
            items: { type: 'string' }
          },
          availableDistributors: {
            type: 'array',
            items: { type: 'string' }
          },
          apiEndpoints: {
            type: 'object',
            additionalProperties: { type: 'string' }
          }
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
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                status: { type: 'string', enum: ['active', 'stopped', 'error'] },
                source: { type: 'string' },
                destination: { type: 'object' },
                startTime: { type: 'number' },
                lastActivity: { type: 'number' },
                metrics: {
                  type: 'object',
                  properties: {
                    packetsTransmitted: { type: 'number' },
                    packetsLost: { type: 'number' },
                    averageLatency: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      },
      timestamp: { type: 'number' }
    }
  },

  DeviceInfo: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      label: { type: 'string' },
      type: { type: 'string' },
      capabilities: {
        type: 'array',
        items: { type: 'string' },
        nullable: true
      },
      status: {
        type: 'string',
        enum: ['available', 'busy', 'offline'],
        nullable: true
      }
    },
    required: ['id', 'label', 'type']
  },

  StreamInfo: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      deviceId: { type: 'string' },
      format: { type: 'string' },
      resolution: {
        type: 'object',
        properties: {
          width: { type: 'number' },
          height: { type: 'number' }
        }
      },
      frameRate: { type: 'number' },
      bitrate: { type: 'number', nullable: true }
    },
    required: ['id', 'deviceId', 'format']
  }
};