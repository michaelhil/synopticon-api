/**
 * Face Analysis OpenAPI Schemas
 * Schema definitions for face detection and analysis endpoints
 */

export const faceAnalysisSchemas = {
  // Face detection request/response schemas
  FaceDetectionRequest: {
    type: 'object',
    required: ['image'],
    properties: {
      image: {
        type: 'string',
        format: 'binary',
        description: 'Image file in JPEG, PNG, or WebP format'
      },
      options: {
        type: 'object',
        properties: {
          includeLandmarks: {
            type: 'boolean',
            default: true,
            description: 'Include facial landmarks in response'
          },
          includeAge: {
            type: 'boolean',
            default: false,
            description: 'Include age estimation in response'
          },
          includeEmotion: {
            type: 'boolean',
            default: false,
            description: 'Include emotion analysis in response'
          },
          includePose: {
            type: 'boolean',
            default: false,
            description: 'Include head pose estimation in response'
          },
          minConfidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            default: 0.5,
            description: 'Minimum confidence threshold for face detection'
          },
          maxFaces: {
            type: 'number',
            minimum: 1,
            maximum: 20,
            default: 10,
            description: 'Maximum number of faces to detect'
          }
        }
      }
    }
  },

  BoundingBox: {
    type: 'object',
    required: ['x', 'y', 'width', 'height'],
    properties: {
      x: {
        type: 'number',
        description: 'X coordinate of top-left corner (normalized 0-1)'
      },
      y: {
        type: 'number',
        description: 'Y coordinate of top-left corner (normalized 0-1)'
      },
      width: {
        type: 'number',
        description: 'Width of bounding box (normalized 0-1)'
      },
      height: {
        type: 'number',
        description: 'Height of bounding box (normalized 0-1)'
      }
    }
  },

  Point2D: {
    type: 'object',
    required: ['x', 'y'],
    properties: {
      x: {
        type: 'number',
        description: 'X coordinate (normalized 0-1)'
      },
      y: {
        type: 'number',
        description: 'Y coordinate (normalized 0-1)'
      }
    }
  },

  FacialLandmarks: {
    type: 'object',
    properties: {
      leftEye: { $ref: '#/components/schemas/Point2D' },
      rightEye: { $ref: '#/components/schemas/Point2D' },
      nose: { $ref: '#/components/schemas/Point2D' },
      leftMouth: { $ref: '#/components/schemas/Point2D' },
      rightMouth: { $ref: '#/components/schemas/Point2D' },
      all: {
        type: 'array',
        items: { $ref: '#/components/schemas/Point2D' },
        description: 'Complete set of facial landmarks (468 points for face mesh)'
      }
    }
  },

  HeadPose: {
    type: 'object',
    properties: {
      pitch: {
        type: 'number',
        description: 'Head pitch angle in degrees (-90 to 90)'
      },
      yaw: {
        type: 'number',
        description: 'Head yaw angle in degrees (-90 to 90)'
      },
      roll: {
        type: 'number',
        description: 'Head roll angle in degrees (-180 to 180)'
      }
    }
  },

  EmotionScores: {
    type: 'object',
    properties: {
      anger: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Anger confidence score'
      },
      disgust: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Disgust confidence score'
      },
      fear: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Fear confidence score'
      },
      happiness: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Happiness confidence score'
      },
      neutral: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Neutral confidence score'
      },
      sadness: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Sadness confidence score'
      },
      surprise: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Surprise confidence score'
      },
      dominant: {
        type: 'string',
        description: 'Most confident emotion'
      }
    }
  },

  AgeEstimation: {
    type: 'object',
    properties: {
      age: {
        type: 'number',
        description: 'Estimated age in years'
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence score for age estimation'
      },
      ageRange: {
        type: 'object',
        properties: {
          min: { type: 'number' },
          max: { type: 'number' }
        },
        description: 'Estimated age range'
      }
    }
  },

  DetectedFace: {
    type: 'object',
    required: ['boundingBox', 'confidence'],
    properties: {
      boundingBox: { $ref: '#/components/schemas/BoundingBox' },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Face detection confidence score'
      },
      landmarks: { $ref: '#/components/schemas/FacialLandmarks' },
      pose: { $ref: '#/components/schemas/HeadPose' },
      emotions: { $ref: '#/components/schemas/EmotionScores' },
      age: { $ref: '#/components/schemas/AgeEstimation' },
      quality: {
        type: 'object',
        properties: {
          brightness: { type: 'number' },
          sharpness: { type: 'number' },
          frontality: { type: 'number' }
        }
      }
    }
  },

  FaceDetectionResponse: {
    allOf: [
      { $ref: '#/components/schemas/SuccessResponse' },
      {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              faces: {
                type: 'array',
                items: { $ref: '#/components/schemas/DetectedFace' },
                description: 'Array of detected faces'
              },
              imageInfo: {
                type: 'object',
                properties: {
                  width: { type: 'number' },
                  height: { type: 'number' },
                  format: { type: 'string' },
                  size: { type: 'number' }
                }
              },
              processingTime: {
                type: 'number',
                description: 'Processing time in milliseconds'
              },
              model: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  version: { type: 'string' },
                  backend: { type: 'string' }
                }
              }
            }
          }
        }
      }
    ]
  },

  // Batch processing schemas
  BatchDetectionRequest: {
    type: 'object',
    required: ['images'],
    properties: {
      images: {
        type: 'array',
        items: {
          type: 'string',
          format: 'binary'
        },
        minItems: 1,
        maxItems: 10,
        description: 'Array of image files to process'
      },
      options: { $ref: '#/components/schemas/FaceDetectionRequest/properties/options' }
    }
  },

  BatchDetectionResponse: {
    allOf: [
      { $ref: '#/components/schemas/SuccessResponse' },
      {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    faces: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/DetectedFace' }
                    },
                    error: { type: 'string' },
                    processingTime: { type: 'number' }
                  }
                }
              },
              summary: {
                type: 'object',
                properties: {
                  totalImages: { type: 'number' },
                  successfulImages: { type: 'number' },
                  failedImages: { type: 'number' },
                  totalFaces: { type: 'number' },
                  totalProcessingTime: { type: 'number' }
                }
              }
            }
          }
        }
      }
    ]
  }
};