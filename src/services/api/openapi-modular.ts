/**
 * Modular OpenAPI Specification
 * Comprehensive OpenAPI 3.0 specification built from modular components
 * Replaces the monolithic openapi-spec.ts file
 */

import { createBaseSpec, type OpenAPISpec } from './openapi/base-spec.js';
import { allSchemas } from './openapi/schemas/index.js';
import { allPaths } from './openapi/paths/index.js';

export const createOpenAPISpec = (config: any = {}): OpenAPISpec => {
  const baseSpec = createBaseSpec(config);
  
  return {
    ...baseSpec,
    paths: allPaths,
    components: {
      ...baseSpec.components,
      schemas: {
        ...baseSpec.components?.schemas,
        ...allSchemas
      }
    }
  } as OpenAPISpec;
};

// Re-export for backwards compatibility
export type { OpenAPISpec };