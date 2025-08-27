/**
 * Media Streaming OpenAPI Schemas
 * Schema definitions for real-time media streaming endpoints
 */

export const mediaStreamingSchemas = {
  // Device management schemas
  DeviceInfo: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Unique device identifier'
      },
      name: {
        type: 'string',
        description: 'Human-readable device name'
      },
      type: {
        type: 'string',
        enum: ['camera', 'microphone', 'eye_tracker', 'sensor'],
        description: 'Type of media device'
      },
      status: {
        type: 'string',
        enum: ['online', 'offline', 'streaming', 'error'],
        description: 'Current device status'
      },
      capabilities: {
        type: 'object',
        properties: {
          video: {
            type: 'object',
            properties: {
              resolutions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    width: { type: 'number' },
                    height: { type: 'number' },
                    frameRate: { type: 'number' }
                  }
                }
              },
              formats: {
                type: 'array',
                items: { type: 'string' }
              }
            }
          },
          audio: {
            type: 'object',
            properties: {
              sampleRates: {
                type: 'array',
                items: { type: 'number' }
              },
              channels: {
                type: 'array',
                items: { type: 'number' }
              }
            }
          }
        }
      },
      metadata: {
        type: 'object',
        description: 'Device-specific metadata'
      },
      lastSeen: {
        type: 'number',
        description: 'Unix timestamp of last activity'
      }
    }
  },

  DeviceListResponse: {
    allOf: [
      { $ref: '#/components/schemas/SuccessResponse' },
      {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              devices: {
                type: 'array',
                items: { $ref: '#/components/schemas/DeviceInfo' }
              },
              summary: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  online: { type: 'number' },
                  streaming: { type: 'number' }
                }
              }
            }
          }
        }
      }
    ]
  },

  // Stream session schemas
  StreamQuality: {
    type: 'string',
    enum: ['low', 'medium', 'high', 'ultra'],
    description: 'Stream quality level'
  },

  StreamSessionConfig: {
    type: 'object',
    properties: {
      deviceId: {
        type: 'string',
        description: 'Target device identifier'
      },
      quality: { $ref: '#/components/schemas/StreamQuality' },
      format: {
        type: 'string',
        enum: ['webrtc', 'hls', 'dash', 'mjpeg'],
        default: 'webrtc',
        description: 'Streaming format/protocol'
      },
      resolution: {
        type: 'object',
        properties: {
          width: { type: 'number' },
          height: { type: 'number' }
        }
      },
      frameRate: {
        type: 'number',
        minimum: 1,
        maximum: 60,
        default: 30,
        description: 'Target frame rate (fps)'
      },
      bitRate: {
        type: 'number',
        description: 'Target bit rate (kbps)'
      },
      enableAnalysis: {
        type: 'boolean',
        default: false,
        description: 'Enable real-time analysis during streaming'
      },
      analysisOptions: {
        type: 'object',
        properties: {
          faceDetection: { type: 'boolean' },
          emotionAnalysis: { type: 'boolean' },
          ageEstimation: { type: 'boolean' }
        }
      }
    }
  },

  CreateStreamSessionRequest: {
    type: 'object',
    required: ['config'],
    properties: {
      config: { $ref: '#/components/schemas/StreamSessionConfig' }
    }
  },

  StreamSessionInfo: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Unique session identifier'
      },
      config: { $ref: '#/components/schemas/StreamSessionConfig' },
      status: {
        type: 'string',
        enum: ['starting', 'active', 'paused', 'stopped', 'error'],
        description: 'Current session status'
      },
      device: { $ref: '#/components/schemas/DeviceInfo' },
      connectionInfo: {
        type: 'object',
        properties: {
          streamUrl: { type: 'string' },
          protocol: { type: 'string' },
          iceServers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                urls: {
                  type: 'array',
                  items: { type: 'string' }
                },
                username: { type: 'string' },
                credential: { type: 'string' }
              }
            }
          }
        }
      },
      statistics: {
        type: 'object',
        properties: {
          duration: { type: 'number' },
          framesStreamed: { type: 'number' },
          bytesTransferred: { type: 'number' },
          currentBitrate: { type: 'number' },
          droppedFrames: { type: 'number' },
          latency: { type: 'number' }
        }
      },
      createdAt: { type: 'number' },
      updatedAt: { type: 'number' }
    }
  },

  CreateStreamSessionResponse: {
    allOf: [
      { $ref: '#/components/schemas/SuccessResponse' },
      {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              session: { $ref: '#/components/schemas/StreamSessionInfo' }
            }
          }
        }
      }
    ]
  },

  StreamSessionListResponse: {
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
                items: { $ref: '#/components/schemas/StreamSessionInfo' }
              }
            }
          }
        }
      }
    ]
  },

  // Multi-device coordination schemas
  CoordinationStrategy: {
    type: 'string',
    enum: ['round_robin', 'load_balanced', 'quality_based', 'manual'],
    description: 'Device coordination strategy'
  },

  CoordinationConfig: {
    type: 'object',
    properties: {
      strategy: { $ref: '#/components/schemas/CoordinationStrategy' },
      deviceIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of device IDs to coordinate'
      },
      syncMode: {
        type: 'string',
        enum: ['strict', 'loose', 'independent'],
        default: 'loose',
        description: 'Synchronization mode between devices'
      },
      qualityControl: {
        type: 'object',
        properties: {
          adaptive: { type: 'boolean' },
          targetLatency: { type: 'number' },
          maxRetries: { type: 'number' }
        }
      },
      loadBalancing: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          algorithm: {
            type: 'string',
            enum: ['round_robin', 'least_connections', 'weighted']
          },
          weights: {
            type: 'object',
            description: 'Device weights for load balancing (device_id -> weight)'
          }
        }
      }
    }
  },

  CoordinationSession: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      config: { $ref: '#/components/schemas/CoordinationConfig' },
      devices: {
        type: 'array',
        items: { $ref: '#/components/schemas/DeviceInfo' }
      },
      status: {
        type: 'string',
        enum: ['initializing', 'active', 'degraded', 'stopped']
      },
      statistics: {
        type: 'object',
        properties: {
          totalDevices: { type: 'number' },
          activeDevices: { type: 'number' },
          averageLatency: { type: 'number' },
          totalThroughput: { type: 'number' },
          failoverCount: { type: 'number' }
        }
      },
      createdAt: { type: 'number' },
      updatedAt: { type: 'number' }
    }
  },

  CreateCoordinationRequest: {
    type: 'object',
    required: ['config'],
    properties: {
      config: { $ref: '#/components/schemas/CoordinationConfig' }
    }
  },

  CoordinationResponse: {
    allOf: [
      { $ref: '#/components/schemas/SuccessResponse' },
      {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              session: { $ref: '#/components/schemas/CoordinationSession' }
            }
          }
        }
      }
    ]
  },

  // Stream control schemas
  StreamControlAction: {
    type: 'string',
    enum: ['start', 'stop', 'pause', 'resume', 'restart'],
    description: 'Stream control action'
  },

  StreamControlRequest: {
    type: 'object',
    required: ['action'],
    properties: {
      action: { $ref: '#/components/schemas/StreamControlAction' },
      config: {
        type: 'object',
        description: 'Updated configuration (optional)'
      }
    }
  }
};