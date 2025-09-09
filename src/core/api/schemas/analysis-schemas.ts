/**
 * Analysis OpenAPI Schema Definitions
 * Schemas for face detection, emotion analysis, and processing endpoints
 */

export const analysisSchemas = {
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

  FaceData: {
    type: 'object',
    properties: {
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      bbox: {
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
        type: 'array',
        items: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            z: { type: 'number', nullable: true }
          }
        },
        nullable: true
      },
      pose: {
        type: 'object',
        properties: {
          pitch: { type: 'number' },
          yaw: { type: 'number' },
          roll: { type: 'number' }
        },
        nullable: true
      },
      emotions: {
        type: 'object',
        properties: {
          happy: { type: 'number' },
          sad: { type: 'number' },
          angry: { type: 'number' },
          surprised: { type: 'number' },
          neutral: { type: 'number' },
          disgusted: { type: 'number' },
          fearful: { type: 'number' }
        },
        nullable: true
      }
    },
    required: ['confidence', 'bbox']
  }
};
