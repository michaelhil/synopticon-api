/**
 * Analysis API Path Definitions
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
  }
};