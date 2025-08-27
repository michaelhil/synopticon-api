/**
 * Base OpenAPI Specification Structure
 * Core OpenAPI 3.0 specification foundation
 */

export interface OpenAPIInfo {
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
}

export interface OpenAPIServer {
  url: string;
  description: string;
}

export interface OpenAPISpec {
  openapi: string;
  info: OpenAPIInfo;
  servers: OpenAPIServer[];
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
}

export const createBaseSpec = (config: any = {}): Partial<OpenAPISpec> => {
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
    components: {
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