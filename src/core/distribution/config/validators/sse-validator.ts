/**
 * SSE (Server-Sent Events) Distributor Configuration Validator
 */

import { createFieldValidators } from './field-validators.js';
import { ValidationConstraints } from './validator-types.js';
import type { SseDistributorConfig, ValidationResult, BaseValidator } from './validator-types.js';

/**
 * Creates SSE distributor configuration validator
 */
export const createSseValidator = (): BaseValidator<SseDistributorConfig> => {
  const fieldValidators = createFieldValidators();

  const validate = (config: SseDistributorConfig): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate required fields
      const requiredError = fieldValidators.required(config, 'config');
      if (requiredError) {
        errors.push(requiredError);
        return { valid: false, errors, warnings };
      }

      // Validate required port
      const portRequiredError = fieldValidators.required(config.port, 'port');
      if (portRequiredError) {
        errors.push(portRequiredError);
      } else {
        const portError = fieldValidators.port(config.port, 'port');
        if (portError) {
          errors.push(portError);
        } else {
          // Check for ports commonly used by HTTP services
          if ([80, 443, 8080, 3000, 3001].includes(config.port)) {
            warnings.push(`port ${config.port} is commonly used by HTTP servers`);
          }
          
          // Warn about privileged ports
          if (config.port < 1024) {
            warnings.push('ports below 1024 require elevated privileges');
          }
        }
      }

      // Validate optional endpoint
      if (config.endpoint !== undefined) {
        const endpointError = fieldValidators.nonEmptyString(config.endpoint, 'endpoint');
        if (endpointError) {
          errors.push(endpointError);
        } else {
          // Endpoint path validation
          if (!config.endpoint.startsWith('/')) {
            errors.push("endpoint must start with '/'");
          }
          
          // Check for potentially problematic endpoint paths
          const problematicPaths = ['/api', '/admin', '/status', '/health'];
          if (problematicPaths.some(path => config.endpoint.startsWith(path))) {
            warnings.push(`endpoint '${config.endpoint}' may conflict with common API paths`);
          }
          
          // Validate URL path characters
          try {
            new URL(`http://example.com${config.endpoint}`);
          } catch {
            errors.push('endpoint contains invalid URL characters');
          }
        }
      } else {
        // Default endpoint recommendation
        warnings.push('no endpoint specified - will use default /events');
      }

      // Validate optional maxConnections
      if (config.maxConnections !== undefined) {
        const maxConnError = fieldValidators.range(
          config.maxConnections,
          'maxConnections',
          ValidationConstraints.MAX_CONNECTIONS_MIN,
          ValidationConstraints.MAX_CONNECTIONS_MAX
        );
        if (maxConnError) {
          errors.push(maxConnError);
        } else {
          // SSE-specific connection warnings
          if (config.maxConnections > 1000) {
            warnings.push('high maxConnections may impact performance due to persistent connections');
          }
          
          if (config.maxConnections < 10) {
            warnings.push('low maxConnections may limit scalability');
          }
        }
      }

      // Type validation
      if (config.type !== 'sse') {
        errors.push(`type must be 'sse', got '${config.type}'`);
      }

      // SSE-specific recommendations
      warnings.push('SSE requires clients to handle connection drops and reconnection');
      
      // Check for CORS considerations
      warnings.push('ensure CORS is properly configured for cross-origin SSE connections');

      return { valid: errors.length === 0, errors, warnings };

    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return { valid: false, errors, warnings };
    }
  };

  const getSchema = () => ({
    type: 'object',
    required: ['type', 'port'],
    properties: {
      type: { type: 'string', enum: ['sse'] },
      port: { type: 'number', minimum: 1, maximum: 65535 },
      endpoint: { 
        type: 'string',
        pattern: '^/.*',
        minLength: 1
      },
      maxConnections: { 
        type: 'number', 
        minimum: ValidationConstraints.MAX_CONNECTIONS_MIN,
        maximum: ValidationConstraints.MAX_CONNECTIONS_MAX
      }
    }
  });

  return { validate, getSchema };
};