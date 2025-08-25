/**
 * OpenAPI/Swagger Documentation for Synopticon API
 * Provides comprehensive API documentation following OpenAPI 3.0 specification
 */

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    contact?: {
      name: string;
      url: string;
      email: string;
    };
    license?: {
      name: string;
      url: string;
    };
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
}

export const createOpenAPISpec = (config: any = {}): OpenAPISpec => {
  const baseUrl = config.baseUrl || 'http://localhost:3000';
  const version = config.version || '0.6.0-beta.1';

  return {
    openapi: '3.0.3',
    info: {
      title: 'Synopticon API',
      version,
      description: `
# Synopticon API Documentation

A comprehensive real-time multi-modal behavioral analysis and sensor synchronization platform.

## Features
- **Face Analysis**: Detection, landmarks, pose estimation, expression analysis
- **Distribution System**: Multi-protocol streaming and data distribution  
- **Health Monitoring**: Comprehensive system health and performance metrics
- **WebSocket Support**: Real-time streaming and status updates

## Authentication
API supports optional API key authentication via \`X-API-Key\` header.

## Rate Limiting
Default rate limit: 100 requests per minute per IP address.

## Response Format
All API responses follow this format:
\`\`\`json
{
  "success": boolean,
  "data": object | null,
  "error": string | null,
  "timestamp": number
}
\`\`\`
      `,
      contact: {
        name: 'Synopticon API Support',
        url: 'https://github.com/synopticon/synopticon-api',
        email: 'support@synopticon.dev'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: baseUrl,
        description: 'Synopticon API Server'
      }
    ],
    paths: {
      '/api/health': {
        get: {
          summary: 'System Health Check',
          description: 'Returns comprehensive system health information including service status, metrics, and performance data.',
          operationId: 'getHealth',
          tags: ['System Management'],
          responses: {
            '200': {
              description: 'System health information',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HealthResponse' }
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
      '/api/config': {
        get: {
          summary: 'System Configuration',
          description: 'Returns system configuration including capabilities, strategies, endpoints, and feature flags.',
          operationId: 'getConfig',
          tags: ['System Management'],
          responses: {
            '200': {
              description: 'System configuration information',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ConfigResponse' }
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
      '/api/detect': {
        post: {
          summary: 'Face Detection Analysis',
          description: 'Performs face detection and analysis on provided image data.',
          operationId: 'detectFaces',
          tags: ['Analysis'],
          security: [
            { apiKey: [] },
            {}
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DetectionRequest' }
              }
            }
          },
          responses: {
            '200': {
              description: 'Face detection results',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/DetectionResponse' }
                }
              }
            },
            '400': {
              description: 'Bad request - missing or invalid data',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            },
            '401': {
              description: 'Unauthorized - invalid API key',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            },
            '429': {
              description: 'Too many requests - rate limit exceeded',
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
    },
    components: {
      schemas: {
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
        HealthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                status: { 
                  type: 'string', 
                  enum: ['healthy', 'degraded', 'critical'],
                  example: 'healthy'
                },
                timestamp: { type: 'number' },
                uptime: { type: 'number', description: 'Server uptime in milliseconds' },
                version: { type: 'string', example: '0.6.0-beta.1' },
                services: {
                  type: 'object',
                  additionalProperties: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', enum: ['up', 'down', 'degraded'] },
                      lastCheck: { type: 'number' },
                      responseTime: { type: 'number', nullable: true }
                    }
                  }
                },
                metrics: {
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
              }
            },
            timestamp: { type: 'number' }
          }
        },
        ConfigResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                capabilities: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['face_detection', 'pose_3dof', 'pose_6dof', 'eye_tracking', 'expression', 'landmarks', 'age_estimation', 'gender_detection']
                  }
                },
                strategies: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['accuracy_first', 'performance_first', 'balanced']
                  }
                },
                endpoints: {
                  type: 'object',
                  additionalProperties: { type: 'string' }
                },
                features: {
                  type: 'object',
                  properties: {
                    analysis: { type: 'boolean' },
                    distribution: { type: 'boolean' },
                    monitoring: { type: 'boolean' },
                    websocket: { type: 'boolean' }
                  }
                },
                limits: {
                  type: 'object',
                  properties: {
                    maxImageSize: { type: 'number' },
                    maxRequests: { type: 'number' },
                    timeout: { type: 'number' }
                  }
                }
              }
            },
            timestamp: { type: 'number' }
          }
        },
        DetectionRequest: {
          type: 'object',
          properties: {
            image: { 
              type: 'string', 
              description: 'Base64 encoded image data',
              nullable: true
            },
            imageUrl: { 
              type: 'string', 
              description: 'URL to image file',
              nullable: true
            },
            requirements: {
              type: 'object',
              properties: {
                capabilities: {
                  type: 'array',
                  items: { type: 'string' }
                },
                quality: {
                  type: 'object',
                  properties: {
                    minConfidence: { type: 'number' },
                    maxLatency: { type: 'number' },
                    requiredFPS: { type: 'number' }
                  }
                }
              }
            },
            options: {
              type: 'object',
              properties: {
                returnLandmarks: { type: 'boolean' },
                returnPose: { type: 'boolean' },
                returnEmotions: { type: 'boolean' },
                maxFaces: { type: 'number' }
              }
            }
          },
          oneOf: [
            { required: ['image'] },
            { required: ['imageUrl'] }
          ]
        },
        DetectionResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                faces: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      confidence: { type: 'number' },
                      bbox: {
                        type: 'object',
                        properties: {
                          x: { type: 'number' },
                          y: { type: 'number' },
                          width: { type: 'number' },
                          height: { type: 'number' }
                        }
                      },
                      landmarks: { type: 'array', items: { type: 'object' }, nullable: true },
                      pose: { type: 'object', nullable: true },
                      emotions: { type: 'object', nullable: true }
                    }
                  }
                },
                processingTime: { type: 'number' },
                timestamp: { type: 'number' },
                imageSize: {
                  type: 'object',
                  properties: {
                    width: { type: 'number' },
                    height: { type: 'number' }
                  }
                }
              }
            },
            timestamp: { type: 'number' }
          }
        },
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
                  items: { $ref: '#/components/schemas/StreamInfo' }
                },
                count: { type: 'number' }
              }
            },
            timestamp: { type: 'number' }
          }
        },
        StreamInfo: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string' },
            source: { type: 'string' },
            destination: {
              type: 'object',
              properties: {
                host: { type: 'string' },
                port: { type: 'number' },
                path: { type: 'string', nullable: true }
              }
            },
            status: {
              type: 'string',
              enum: ['active', 'stopped', 'error']
            },
            createdAt: { type: 'number' },
            statistics: {
              type: 'object',
              properties: {
                packetsSent: { type: 'number' },
                bytesSent: { type: 'number' },
                lastActivity: { type: 'number' }
              }
            }
          }
        },
        StreamCreationResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                stream_id: { type: 'string' },
                data: { $ref: '#/components/schemas/StreamInfo' },
                websocket_status_url: { type: 'string' }
              }
            },
            timestamp: { type: 'number' }
          }
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
                  config: { type: 'object' }
                }
              }
            },
            timestamp: { type: 'number' }
          }
        }
      },
      securitySchemes: {
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key'
        }
      }
    }
  };
};

// Generate OpenAPI JSON
export const generateOpenAPIJSON = (config: any = {}): string => {
  return JSON.stringify(createOpenAPISpec(config), null, 2);
};

// Generate OpenAPI YAML (basic conversion)
export const generateOpenAPIYAML = (config: any = {}): string => {
  const spec = createOpenAPISpec(config);
  
  // Simple JSON to YAML conversion for basic structure
  const yamlLines = [
    'openapi: 3.0.3',
    'info:',
    `  title: "${spec.info.title}"`,
    `  version: "${spec.info.version}"`,
    `  description: |`,
    ...spec.info.description.split('\n').map(line => `    ${line}`),
    'servers:',
    ...spec.servers.map(server => [
      `  - url: "${server.url}"`,
      `    description: "${server.description}"`
    ].join('\n')),
    'paths:',
    '  # Full path definitions available in JSON format',
    'components:',
    '  # Full schema definitions available in JSON format'
  ];
  
  return yamlLines.join('\n');
};