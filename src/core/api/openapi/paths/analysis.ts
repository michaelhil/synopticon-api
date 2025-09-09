/**
 * Analysis API Paths
 * OpenAPI path definitions for face detection and analysis endpoints
 */

export const analysisPaths = {
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
          'multipart/form-data': {
            schema: { $ref: '#/components/schemas/FaceDetectionRequest' }
          },
          'application/json': {
            schema: {
              type: 'object',
              required: ['imageData'],
              properties: {
                imageData: {
                  type: 'string',
                  format: 'base64',
                  description: 'Base64-encoded image data'
                },
                options: { $ref: '#/components/schemas/FaceDetectionRequest/properties/options' }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Face detection results',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/FaceDetectionResponse' }
            }
          }
        },
        '400': {
          description: 'Invalid request or image format',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        },
        '413': {
          description: 'Image too large',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        },
        '429': {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        },
        '500': {
          description: 'Internal processing error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      }
    }
  },

  '/api/detect/batch': {
    post: {
      summary: 'Batch Face Detection',
      description: 'Process multiple images in a single request for face detection and analysis.',
      operationId: 'batchDetectFaces',
      tags: ['Analysis'],
      security: [
        { apiKey: [] },
        {}
      ],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: { $ref: '#/components/schemas/BatchDetectionRequest' }
          }
        }
      },
      responses: {
        '200': {
          description: 'Batch detection results',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BatchDetectionResponse' }
            }
          }
        },
        '400': {
          description: 'Invalid batch request',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        },
        '413': {
          description: 'Batch size limit exceeded',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      }
    }
  },

  '/api/analyze': {
    post: {
      summary: 'Comprehensive Face Analysis',
      description: 'Performs comprehensive face analysis including emotion detection, age estimation, and pose analysis.',
      operationId: 'analyzeFace',
      tags: ['Analysis'],
      security: [
        { apiKey: [] },
        {}
      ],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['image'],
              properties: {
                image: {
                  type: 'string',
                  format: 'binary',
                  description: 'Image file for analysis'
                },
                options: {
                  type: 'object',
                  properties: {
                    includeAll: {
                      type: 'boolean',
                      default: true,
                      description: 'Include all available analysis features'
                    },
                    features: {
                      type: 'array',
                      items: {
                        type: 'string',
                        enum: ['detection', 'landmarks', 'emotion', 'age', 'pose', 'quality']
                      },
                      description: 'Specific features to include'
                    },
                    minConfidence: {
                      type: 'number',
                      minimum: 0,
                      maximum: 1,
                      default: 0.5
                    }
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Comprehensive analysis results',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/FaceDetectionResponse' }
            }
          }
        },
        '400': {
          description: 'Invalid analysis request',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      }
    }
  },

  '/api/analyze/stream': {
    post: {
      summary: 'Stream Analysis Setup',
      description: 'Set up real-time analysis for streaming data.',
      operationId: 'setupStreamAnalysis',
      tags: ['Analysis', 'Streaming'],
      security: [
        { apiKey: [] }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['streamConfig'],
              properties: {
                streamConfig: {
                  type: 'object',
                  properties: {
                    source: { type: 'string' },
                    format: { type: 'string' },
                    quality: { type: 'string' }
                  }
                },
                analysisOptions: {
                  type: 'object',
                  properties: {
                    realTime: { type: 'boolean' },
                    bufferSize: { type: 'number' },
                    analysisInterval: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Stream analysis session created',
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
                          sessionId: { type: 'string' },
                          streamEndpoint: { type: 'string' },
                          analysisEndpoint: { type: 'string' }
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

  '/api/models': {
    get: {
      summary: 'Available Analysis Models',
      description: 'Get information about available analysis models and their capabilities.',
      operationId: 'getModels',
      tags: ['Analysis'],
      responses: {
        '200': {
          description: 'Available models information',
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
                          models: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                name: { type: 'string' },
                                type: { type: 'string' },
                                capabilities: {
                                  type: 'array',
                                  items: { type: 'string' }
                                },
                                accuracy: { type: 'number' },
                                speed: { type: 'string' },
                                version: { type: 'string' },
                                loaded: { type: 'boolean' }
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
