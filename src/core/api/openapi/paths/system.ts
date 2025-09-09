/**
 * System Management API Paths
 * OpenAPI path definitions for health monitoring and configuration
 */

export const systemPaths = {
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

  '/api/status': {
    get: {
      summary: 'Service Status',
      description: 'Get current operational status of all services',
      operationId: 'getStatus',
      tags: ['System Management'],
      responses: {
        '200': {
          description: 'Service status information',
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
                          services: {
                            type: 'object',
                            additionalProperties: {
                              type: 'object',
                              properties: {
                                status: { type: 'string' },
                                uptime: { type: 'number' },
                                version: { type: 'string' },
                                lastCheck: { type: 'number' }
                              }
                            }
                          },
                          overall: {
                            type: 'string',
                            enum: ['operational', 'degraded', 'down']
                          }
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      }
    }
  },

  '/api/metrics': {
    get: {
      summary: 'Performance Metrics',
      description: 'Get detailed performance metrics and statistics',
      operationId: 'getMetrics',
      tags: ['System Management'],
      parameters: [
        {
          name: 'timeRange',
          in: 'query',
          description: 'Time range for metrics (1h, 24h, 7d, 30d)',
          required: false,
          schema: {
            type: 'string',
            enum: ['1h', '24h', '7d', '30d'],
            default: '1h'
          }
        },
        {
          name: 'granularity',
          in: 'query',
          description: 'Data point granularity',
          required: false,
          schema: {
            type: 'string',
            enum: ['1m', '5m', '1h', '1d'],
            default: '5m'
          }
        }
      ],
      responses: {
        '200': {
          description: 'Performance metrics data',
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
                          timeRange: { type: 'string' },
                          granularity: { type: 'string' },
                          metrics: {
                            type: 'object',
                            properties: {
                              requests: {
                                type: 'object',
                                properties: {
                                  total: { type: 'number' },
                                  successful: { type: 'number' },
                                  failed: { type: 'number' },
                                  rate: { type: 'number' }
                                }
                              },
                              latency: {
                                type: 'object',
                                properties: {
                                  average: { type: 'number' },
                                  p50: { type: 'number' },
                                  p95: { type: 'number' },
                                  p99: { type: 'number' }
                                }
                              },
                              resources: {
                                type: 'object',
                                properties: {
                                  cpu: { type: 'number' },
                                  memory: { type: 'number' },
                                  disk: { type: 'number' }
                                }
                              },
                              processing: {
                                type: 'object',
                                properties: {
                                  totalFrames: { type: 'number' },
                                  averageProcessingTime: { type: 'number' },
                                  queueDepth: { type: 'number' }
                                }
                              }
                            }
                          },
                          timeSeries: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                timestamp: { type: 'number' },
                                values: { type: 'object' }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      }
    }
  },

  '/api/info': {
    get: {
      summary: 'API Information',
      description: 'Get basic API information and version details',
      operationId: 'getApiInfo',
      tags: ['System Management'],
      responses: {
        '200': {
          description: 'API information',
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
                          name: { type: 'string' },
                          version: { type: 'string' },
                          description: { type: 'string' },
                          buildInfo: {
                            type: 'object',
                            properties: {
                              version: { type: 'string' },
                              commit: { type: 'string' },
                              buildTime: { type: 'string' },
                              runtime: { type: 'string' }
                            }
                          },
                          endpoints: {
                            type: 'object',
                            properties: {
                              total: { type: 'number' },
                              categories: {
                                type: 'array',
                                items: { type: 'string' }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      }
    }
  }
};
