/**
 * OpenAPI Specification Main Assembly
 * Modular OpenAPI documentation for Synopticon API
 * Assembled from domain-specific modules for better maintainability
 */

// Import all modular components
import { commonResponseSchemas } from './components/common-responses.js';
import { securitySchemes } from './components/security-schemes.js';
import { systemSchemas } from './schemas/system-schemas.js';
import { faceDetectionSchemas } from './schemas/face-detection-schemas.js';
import { distributionSchemas } from './schemas/distribution-schemas.js';
import { systemPaths } from './paths/system-paths.js';
import { faceDetectionPaths } from './paths/face-detection-paths.js';
import { distributionPaths } from './paths/distribution-paths.js';

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

/**
 * Creates the complete OpenAPI specification from modular components
 */
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

## Modular Architecture
This API documentation is built using a modular approach:
- **System Management**: Health checks and configuration
- **Face Detection**: Computer vision and analysis services
- **Distribution System**: Multi-protocol data distribution and streaming

Each module is independently maintained for better code organization and team collaboration.
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
      },
      {
        url: 'https://api.synopticon.dev',
        description: 'Production API Server'
      }
    ],

    // Assemble all paths from domain modules
    paths: {
      ...systemPaths,
      ...faceDetectionPaths,
      ...distributionPaths
    },

    // Assemble all components from domain modules
    components: {
      schemas: {
        ...commonResponseSchemas,
        ...systemSchemas,
        ...faceDetectionSchemas,
        ...distributionSchemas
      },
      securitySchemes
    }
  };
};

// Re-export individual modules for direct access if needed
export {
  commonResponseSchemas,
  securitySchemes,
  systemSchemas,
  faceDetectionSchemas,
  distributionSchemas,
  systemPaths,
  faceDetectionPaths,
  distributionPaths
};

