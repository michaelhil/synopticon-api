/**
 * OpenAPI/Swagger Documentation for Synopticon API - Modular Version
 * This file maintains backward compatibility while using the new modular structure
 * 
 * MIGRATION NOTICE:
 * This file now imports from the modular OpenAPI structure in ./openapi/
 * The original monolithic file has been split into domain-specific modules for better maintainability.
 * 
 * To migrate your imports:
 * - Old: import { createOpenAPISpec } from './openapi-spec.ts'
 * - New: import { createOpenAPISpec } from './openapi/index.ts'
 */

// Import the modular implementation
export { 
  createOpenAPISpec,
  type OpenAPISpec,
  commonResponseSchemas,
  securitySchemes,
  systemSchemas,
  faceDetectionSchemas,
  distributionSchemas,
  systemPaths,
  faceDetectionPaths,
  distributionPaths
} from './openapi/index.ts';

// Default export for backward compatibility
export { default } from './openapi/index.ts';