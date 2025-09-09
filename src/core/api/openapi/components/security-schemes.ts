/**
 * Security Schemes for OpenAPI
 * Authentication and authorization configurations
 */

export const securitySchemes = {
  apiKey: {
    type: 'apiKey',
    in: 'header',
    name: 'X-API-Key',
    description: 'API key for authentication. Optional for most endpoints.'
  },

  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'JWT bearer token authentication for advanced features.'
  }
};
