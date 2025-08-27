/**
 * HTTP Distributor Configuration Validator
 */

import { createFieldValidators } from './field-validators.js';
import type { HttpDistributorConfig, ValidationResult, BaseValidator } from './validator-types.js';

/**
 * Creates HTTP distributor configuration validator
 */
export const createHttpValidator = (): BaseValidator<HttpDistributorConfig> => {
  const fieldValidators = createFieldValidators();

  const validate = (config: HttpDistributorConfig): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate required fields
      const requiredError = fieldValidators.required(config, 'config');
      if (requiredError) {
        errors.push(requiredError);
        return { valid: false, errors, warnings };
      }

      // Validate baseUrl
      const baseUrlError = fieldValidators.required(config.baseUrl, 'baseUrl');
      if (baseUrlError) {
        errors.push(baseUrlError);
      } else {
        const urlError = fieldValidators.url(config.baseUrl, 'baseUrl');
        if (urlError) {
          errors.push(urlError);
        } else {
          // Additional URL validation
          try {
            const url = new URL(config.baseUrl);
            if (!['http:', 'https:'].includes(url.protocol)) {
              errors.push('baseUrl must use HTTP or HTTPS protocol');
            }
          } catch {
            errors.push('baseUrl is not a valid URL');
          }
        }
      }

      // Validate optional timeout
      if (config.timeout !== undefined) {
        const timeoutError = fieldValidators.positiveNumber(config.timeout, 'timeout');
        if (timeoutError) {
          errors.push(timeoutError);
        } else {
          if (config.timeout < 100 || config.timeout > 300000) {
            errors.push('timeout must be between 100ms and 300000ms');
          }
          if (config.timeout < 1000) {
            warnings.push('timeout less than 1 second may cause reliability issues');
          }
        }
      }

      // Validate optional retryCount
      if (config.retryCount !== undefined) {
        const retryError = fieldValidators.positiveNumber(config.retryCount, 'retryCount');
        if (retryError) {
          errors.push(retryError);
        } else {
          if (config.retryCount > 10) {
            errors.push('retryCount cannot exceed 10');
          }
          if (config.retryCount > 5) {
            warnings.push('high retry count may cause excessive delays');
          }
        }
      }

      // Validate optional compression
      if (config.compression !== undefined) {
        if (typeof config.compression !== 'boolean') {
          errors.push('compression must be a boolean');
        }
      }

      // Validate optional headers
      if (config.headers !== undefined) {
        const headerError = fieldValidators.object(config.headers, 'headers');
        if (headerError) {
          errors.push(headerError);
        } else {
          // Validate header values
          for (const [key, value] of Object.entries(config.headers)) {
            if (typeof key !== 'string' || !key.trim()) {
              errors.push('header keys must be non-empty strings');
              break;
            }
            if (typeof value !== 'string') {
              errors.push('header values must be strings');
              break;
            }
            
            // Check for potentially problematic headers
            const lowerKey = key.toLowerCase();
            if (['host', 'content-length', 'transfer-encoding'].includes(lowerKey)) {
              warnings.push(`header '${key}' may be overridden by the HTTP client`);
            }
          }
        }
      }

      // Validate optional endpoints
      if (config.endpoints !== undefined) {
        const endpointsError = fieldValidators.object(config.endpoints, 'endpoints');
        if (endpointsError) {
          errors.push(endpointsError);
        } else {
          for (const [key, endpoint] of Object.entries(config.endpoints)) {
            if (typeof key !== 'string' || !key.trim()) {
              errors.push('endpoint keys must be non-empty strings');
              break;
            }
            if (typeof endpoint !== 'string' || !endpoint.trim()) {
              errors.push('endpoint values must be non-empty strings');
              break;
            }
            
            // Validate endpoint format
            if (!endpoint.startsWith('/')) {
              warnings.push(`endpoint '${key}' should start with '/'`);
            }
          }
        }
      }

      // Type validation
      if (config.type !== 'http') {
        errors.push(`type must be 'http', got '${config.type}'`);
      }

      return { valid: errors.length === 0, errors, warnings };

    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return { valid: false, errors, warnings };
    }
  };

  const getSchema = () => ({
    type: 'object',
    required: ['type', 'baseUrl'],
    properties: {
      type: { type: 'string', enum: ['http'] },
      baseUrl: { type: 'string', format: 'url' },
      timeout: { type: 'number', minimum: 100, maximum: 300000 },
      retryCount: { type: 'number', minimum: 0, maximum: 10 },
      compression: { type: 'boolean' },
      headers: {
        type: 'object',
        additionalProperties: { type: 'string' }
      },
      endpoints: {
        type: 'object',
        additionalProperties: { type: 'string' }
      }
    }
  });

  return { validate, getSchema };
};