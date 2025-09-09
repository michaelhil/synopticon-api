/**
 * Face Detection API Paths
 * Endpoints for face analysis and detection services
 */

export const faceDetectionPaths = {
  '/api/detect': {
    post: {
      summary: 'Detect Faces in Image',
      description: 'Analyzes an uploaded image and detects faces with optional landmarks, attributes, and emotion analysis.',
      operationId: 'detectFaces',
      tags: ['Face Detection'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/FaceDetectionRequest' }
          },
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                image: {
                  type: 'string',
                  format: 'binary',
                  description: 'Image file to analyze'
                },
                options: {
                  type: 'string',
                  description: 'JSON string of detection options'
                }
              },
              required: ['image']
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
          description: 'Invalid request data',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationErrorResponse' }
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
        '500': {
          description: 'Processing error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      },
      security: [
        { apiKey: [] },
        {}
      ]
    }
  }
};
