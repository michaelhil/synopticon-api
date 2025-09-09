/**
 * Face Detection Schemas
 * Data models for face analysis and detection endpoints
 */

export const faceDetectionSchemas = {
  FaceDetectionRequest: {
    type: 'object',
    properties: {
      image: {
        type: 'string',
        format: 'base64',
        description: 'Base64 encoded image data'
      },
      options: {
        type: 'object',
        properties: {
          includeLandmarks: { type: 'boolean', default: true },
          includeAttributes: { type: 'boolean', default: true },
          includeEmotion: { type: 'boolean', default: false },
          minConfidence: { type: 'number', minimum: 0, maximum: 1, default: 0.5 }
        }
      }
    },
    required: ['image']
  },

  FaceDetectionResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          faces: {
            type: 'array',
            items: { $ref: '#/components/schemas/FaceData' }
          },
          metadata: {
            type: 'object',
            properties: {
              processingTime: { type: 'number' },
              imageSize: {
                type: 'object',
                properties: {
                  width: { type: 'number' },
                  height: { type: 'number' }
                }
              },
              algorithm: { type: 'string' }
            }
          }
        }
      },
      timestamp: { type: 'number' }
    }
  },

  FaceData: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      boundingBox: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' }
        },
        required: ['x', 'y', 'width', 'height']
      },
      landmarks: {
        type: 'object',
        properties: {
          leftEye: { $ref: '#/components/schemas/Point2D' },
          rightEye: { $ref: '#/components/schemas/Point2D' },
          nose: { $ref: '#/components/schemas/Point2D' },
          leftMouth: { $ref: '#/components/schemas/Point2D' },
          rightMouth: { $ref: '#/components/schemas/Point2D' }
        }
      },
      attributes: {
        type: 'object',
        properties: {
          age: { 
            type: 'object',
            properties: {
              estimated: { type: 'number' },
              confidence: { type: 'number' }
            }
          },
          gender: {
            type: 'object', 
            properties: {
              predicted: { type: 'string', enum: ['male', 'female'] },
              confidence: { type: 'number' }
            }
          },
          emotion: {
            type: 'object',
            properties: {
              dominant: { type: 'string' },
              scores: {
                type: 'object',
                additionalProperties: { type: 'number' }
              }
            }
          }
        }
      }
    },
    required: ['id', 'confidence', 'boundingBox']
  },

  Point2D: {
    type: 'object',
    properties: {
      x: { type: 'number' },
      y: { type: 'number' }
    },
    required: ['x', 'y']
  }
};
